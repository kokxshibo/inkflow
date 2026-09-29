import "server-only";
import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";
import nodemailer from "nodemailer";
import { db, getSettings, logActivity } from "./db";
import { decryptSecret } from "./crypto";
import { textToHtml } from "./mail";
import {
  buildAutoReply,
  claimAutoReply,
  createLead,
  findLead,
  getIntegration,
  matchesKeywords,
  parseKeywords,
  recordMessage,
  releaseAutoReply,
  reportError,
} from "./leads";

/**
 * Gmail, via IMAP (lecture) et SMTP (envoi) avec un mot de passe
 * d'application : aucun projet Google Cloud à créer.
 *
 * La relève tourne chaque minute (minuteur systemd sur le VPS) et reprend là
 * où elle s'était arrêtée. À la connexion, la position est placée au dernier
 * message existant : seuls les e-mails reçus ensuite sont traités.
 */

const IMAP = { host: "imap.gmail.com", port: 993, secure: true } as const;
const SMTP = { host: "smtp.gmail.com", port: 465, secure: true } as const;

/** Une relève ne traite qu'un nombre limité de messages, la suivante continue. */
const BATCH = 40;
/** Au-delà, un échange précédent avec la personne n'est plus une « nouvelle conversation ». */
const NEW_CONVERSATION_WINDOW_MS = 24 * 60 * 60 * 1000;

interface FolderCursor {
  validity: string;
  uid: number;
}
interface GmailCursor {
  inbox?: FolderCursor;
  sent?: FolderCursor & { path: string };
}

function imapClient(user: string, pass: string) {
  return new ImapFlow({ ...IMAP, auth: { user, pass }, logger: false, emitLogs: false });
}

function smtpTransport(user: string, pass: string) {
  return nodemailer.createTransport({ ...SMTP, auth: { user, pass } });
}

/** Message d'erreur compréhensible pour les échecs de connexion Gmail. */
function explain(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const details = error as { authenticationFailed?: boolean; code?: string; responseText?: string };
  if (
    details.authenticationFailed ||
    details.code === "EAUTH" ||
    /AUTHENTICATIONFAILED|Invalid credentials|Username and Password not accepted/i.test(
      `${raw} ${details.responseText ?? ""}`,
    )
  ) {
    return "Gmail a refusé la connexion : vérifie l'adresse et le mot de passe d'application (pas ton mot de passe habituel).";
  }
  if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN/i.test(raw)) {
    return "Impossible de joindre Gmail depuis le serveur. Réessaie dans quelques minutes.";
  }
  return raw;
}

/**
 * Vérifie les identifiants (IMAP + SMTP) et renvoie la position de départ de
 * la relève : le dernier message actuel de la boîte de réception et des envoyés.
 */
export async function connectGmail(user: string, pass: string): Promise<GmailCursor> {
  const client = imapClient(user, pass);
  try {
    await client.connect();
    const cursor: GmailCursor = {};

    const inbox = await client.getMailboxLock("INBOX");
    try {
      const box = client.mailbox;
      if (box) cursor.inbox = { validity: String(box.uidValidity), uid: box.uidNext - 1 };
    } finally {
      inbox.release();
    }

    const sentPath = (await client.list()).find((folder) => folder.specialUse === "\\Sent")?.path;
    if (sentPath) {
      const sent = await client.getMailboxLock(sentPath);
      try {
        const box = client.mailbox;
        if (box) {
          cursor.sent = { path: sentPath, validity: String(box.uidValidity), uid: box.uidNext - 1 };
        }
      } finally {
        sent.release();
      }
    }

    await client.logout();
    await smtpTransport(user, pass).verify();
    return cursor;
  } catch (error) {
    client.close();
    throw new Error(explain(error));
  }
}

/* ─────────────────────────── Analyse ─────────────────────────── */

function header(parsed: ParsedMail, name: string): string {
  const value = parsed.headers.get(name);
  if (value == null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** Newsletters, notifications, réponses automatiques : jamais de réponse. */
function isAutomated(parsed: ParsedMail, address: string) {
  const autoSubmitted = header(parsed, "auto-submitted").toLowerCase();
  if (autoSubmitted && autoSubmitted !== "no") return true;
  // mailparser regroupe les en-têtes List-Id, List-Unsubscribe… sous « list ».
  if (parsed.headers.has("list") || parsed.headers.has("list-id")) return true;
  if (/bulk|list|junk|auto_reply/i.test(header(parsed, "precedence"))) return true;
  if (parsed.headers.has("x-autoreply") || parsed.headers.has("x-autorespond")) return true;
  return /^(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounces?|notifications?)\b/i.test(
    address.split("@")[0] ?? "",
  );
}

function firstAddress(field: AddressObject | AddressObject[] | undefined) {
  const list = Array.isArray(field) ? field.flatMap((item) => item.value) : (field?.value ?? []);
  const entry = list.find((item) => item.address);
  return entry ? { address: entry.address!.toLowerCase(), name: entry.name || null } : null;
}

function allAddresses(field: AddressObject | AddressObject[] | undefined) {
  const list = Array.isArray(field) ? field.flatMap((item) => item.value) : (field?.value ?? []);
  return list.map((item) => item.address?.toLowerCase()).filter((a): a is string => Boolean(a));
}

/** Retire la citation du message précédent (« Le … a écrit : », lignes « > »). */
export function stripQuoted(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    const withNext = `${line} ${lines[index + 1]?.trim() ?? ""}`;
    if (
      line.startsWith(">") ||
      /^(Le|On)\s.+(a écrit|wrote)\s*:\s*$/i.test(line) ||
      /^(Le|On)\s.+(a écrit|wrote)\s*:\s*$/i.test(withNext) ||
      /^-{2,}\s*(Original Message|Message d'origine)/i.test(line) ||
      /^_{5,}$/.test(line)
    ) {
      break;
    }
    kept.push(lines[index]);
  }
  const result = kept.join("\n").trim();
  return result || text.trim();
}

/* ─────────────────────────── Relève ─────────────────────────── */

interface Fetched {
  uid: number;
  parsed: ParsedMail;
  date: Date;
}

async function fetchNew(client: ImapFlow, path: string, cursor: FolderCursor | undefined) {
  const lock = await client.getMailboxLock(path);
  try {
    const box = client.mailbox;
    if (!box) return { messages: [] as Fetched[], cursor };
    const validity = String(box.uidValidity);

    // Première relève, ou dossier recréé côté Gmail : on repart du message actuel.
    if (!cursor || cursor.validity !== validity) {
      return { messages: [] as Fetched[], cursor: { validity, uid: box.uidNext - 1 } };
    }

    const uids = ((await client.search({ uid: `${cursor.uid + 1}:*` }, { uid: true })) || [])
      .filter((uid) => uid > cursor.uid)
      .sort((a, b) => a - b)
      .slice(0, BATCH);
    if (uids.length === 0) return { messages: [] as Fetched[], cursor };

    // Pas d'autre commande IMAP pendant un FETCH : on lit tout, puis on traite.
    const raw: { uid: number; source: Buffer; date: Date }[] = [];
    for await (const message of client.fetch(
      uids,
      { uid: true, internalDate: true, source: { maxLength: 512 * 1024 } },
      { uid: true },
    )) {
      if (!message.source) continue;
      raw.push({
        uid: message.uid,
        source: message.source,
        date: new Date(message.internalDate ?? Date.now()),
      });
    }

    const messages: Fetched[] = [];
    for (const item of raw) {
      try {
        messages.push({ uid: item.uid, parsed: await simpleParser(item.source), date: item.date });
      } catch {
        // Message illisible : ignoré, la relève continue.
      }
    }
    return { messages, cursor: { validity, uid: uids[uids.length - 1] } };
  } finally {
    lock.release();
  }
}

/** Vrai si la personne a déjà échangé avec le salon avant ce message. */
async function hasHistory(
  client: ImapFlow,
  address: string,
  before: Date,
  sentPath: string | undefined,
) {
  const since = new Date(before.getTime() - NEW_CONVERSATION_WINDOW_MS);

  const inbox = await client.getMailboxLock("INBOX");
  try {
    const older = await client.search({ from: address, before: since }, { uid: true });
    if (older && older.length > 0) return true;
  } finally {
    inbox.release();
  }

  if (sentPath) {
    const sent = await client.getMailboxLock(sentPath);
    try {
      const written = await client.search({ to: address }, { uid: true });
      if (written && written.length > 0) return true;
    } finally {
      sent.release();
    }
  }
  return false;
}

interface Original {
  messageId?: string | null;
  references?: string[];
  subject?: string | null;
}

function referencesOf(parsed: ParsedMail): string[] {
  if (Array.isArray(parsed.references)) return parsed.references;
  return parsed.references ? [parsed.references] : [];
}

/** Répond dans le fil de l'e-mail d'origine, depuis l'adresse Gmail reliée. */
async function sendReply(
  user: string,
  pass: string,
  to: { address: string; name: string | null },
  original: Original,
  reply: { text: string; subject: string | null },
) {
  const settings = await getSettings();
  const originalSubject = original.subject?.trim() || "Ton message";
  const subject =
    reply.subject ?? (/^re\s*:/i.test(originalSubject) ? originalSubject : `Re: ${originalSubject}`);
  const references = [
    ...(original.references ?? []),
    ...(original.messageId ? [original.messageId] : []),
  ];

  const info = await smtpTransport(user, pass).sendMail({
    from: { name: settings.studioName, address: user },
    to: to.name ? { name: to.name, address: to.address } : to.address,
    subject,
    text: reply.text,
    html: textToHtml(reply.text),
    inReplyTo: original.messageId ?? undefined,
    references: references.length > 0 ? references : undefined,
    headers: {
      // RFC 3834 : évite les boucles avec les répondeurs automatiques.
      "Auto-Submitted": "auto-replied",
      "X-Auto-Response-Suppress": "All",
      "X-InkFlow": "auto",
    },
  });
  return { messageId: info.messageId as string, subject };
}

async function handleIncoming(
  client: ImapFlow,
  item: Fetched,
  context: {
    user: string;
    pass: string;
    sentPath: string | undefined;
    keywords: string[];
    autoReply: boolean;
  },
) {
  const { parsed } = item;
  const sender = firstAddress(parsed.from);
  if (!sender || sender.address === context.user.toLowerCase()) return;
  if (isAutomated(parsed, sender.address)) return;

  const body = stripQuoted(parsed.text ?? "");
  const subject = parsed.subject?.trim() || null;
  const message = {
    direction: "in" as const,
    body: body || "(message sans texte)",
    subject,
    externalId: parsed.messageId ?? null,
    sentAt: parsed.date ?? item.date,
  };

  // Personne déjà connue : le message rejoint sa conversation, sans nouvelle réponse.
  const known = await findLead("email", sender.address);
  if (known) {
    await recordMessage(known.id, message);
    return;
  }

  if (!matchesKeywords(`${subject ?? ""}\n${body}`, context.keywords)) return;
  if (await db.client.findFirst({ where: { email: { equals: sender.address, mode: "insensitive" } } })) {
    return;
  }
  if (await hasHistory(client, sender.address, message.sentAt, context.sentPath)) return;

  const lead = await createLead({
    channel: "email",
    externalId: sender.address,
    name: sender.name,
    email: sender.address,
  });
  await recordMessage(lead.id, message);
  await logActivity("lead.email", `Nouveau contact Gmail : ${sender.name ?? sender.address}`);

  if (!context.autoReply || !(await claimAutoReply(lead.id))) return;
  try {
    const integration = await getIntegration("gmail");
    const reply = await buildAutoReply(integration, lead);
    const sent = await sendReply(
      context.user,
      context.pass,
      sender,
      { messageId: parsed.messageId, references: referencesOf(parsed), subject },
      reply,
    );
    await recordMessage(lead.id, {
      direction: "out",
      body: reply.text,
      subject: sent.subject,
      externalId: sent.messageId,
      auto: true,
    });
  } catch (error) {
    await releaseAutoReply(lead.id);
    throw error;
  }
}

/** Copie des messages envoyés depuis Gmail aux contacts connus (réponses manuelles). */
async function handleSent(item: Fetched) {
  const { parsed } = item;
  // Nos réponses automatiques sont déjà dans la conversation.
  if (parsed.headers.has("x-inkflow")) return;
  for (const address of allAddresses(parsed.to)) {
    const lead = await findLead("email", address);
    if (!lead) continue;
    await recordMessage(lead.id, {
      direction: "out",
      body: stripQuoted(parsed.text ?? "") || "(message sans texte)",
      subject: parsed.subject?.trim() || null,
      externalId: parsed.messageId ?? null,
      sentAt: parsed.date ?? item.date,
    });
  }
}

let running: Promise<void> | null = null;

/** Relève Gmail. Une seule à la fois : un appel pendant une relève attend sa fin. */
export function syncGmail(): Promise<void> {
  running ??= runSync().finally(() => {
    running = null;
  });
  return running;
}

async function runSync() {
  const integration = await getIntegration("gmail");
  const user = integration.account;
  const pass = decryptSecret(integration.secret);
  if (!user || !pass) return;

  let cursor: GmailCursor = {};
  try {
    cursor = integration.cursor ? (JSON.parse(integration.cursor) as GmailCursor) : {};
  } catch {
    cursor = {};
  }

  const client = imapClient(user, pass);
  try {
    await client.connect();
    const context = {
      user,
      pass,
      sentPath: cursor.sent?.path,
      keywords: parseKeywords(integration.keywords),
      autoReply: integration.autoReply,
    };

    // Une erreur sur un message (envoi refusé…) est signalée sans bloquer les
    // suivants : le contact reste visible et le lien peut être renvoyé à la main.
    const problems: string[] = [];

    const inbox = await fetchNew(client, "INBOX", cursor.inbox);
    for (const item of inbox.messages) {
      try {
        await handleIncoming(client, item, context);
      } catch (error) {
        problems.push(explain(error));
      }
      // La position avance message par message : une coupure n'en fait perdre aucun.
      cursor.inbox = { validity: inbox.cursor!.validity, uid: item.uid };
      await saveCursor(cursor);
    }
    cursor.inbox = inbox.cursor;

    if (cursor.sent?.path) {
      const sent = await fetchNew(client, cursor.sent.path, cursor.sent);
      for (const item of sent.messages) {
        try {
          await handleSent(item);
        } catch (error) {
          problems.push(explain(error));
        }
      }
      if (sent.cursor) cursor.sent = { path: cursor.sent.path, ...sent.cursor };
    }

    await client.logout();
    await db.integration.update({
      where: { channel: "gmail" },
      data: {
        cursor: JSON.stringify(cursor),
        lastSyncAt: new Date(),
        lastError: problems.length > 0 ? problems.join(" · ").slice(0, 500) : null,
      },
    });
  } catch (error) {
    client.close();
    await reportError("gmail", new Error(explain(error)));
  }
}

async function saveCursor(cursor: GmailCursor) {
  await db.integration.update({
    where: { channel: "gmail" },
    data: { cursor: JSON.stringify(cursor) },
  });
}

/**
 * Envoie le lien de demande à un contact Gmail, dans le fil de son dernier
 * message (envoi manuel depuis l'app, par exemple si la réponse automatique
 * était désactivée).
 */
export async function sendLinkByEmail(leadId: string) {
  const integration = await getIntegration("gmail");
  const user = integration.account;
  const pass = decryptSecret(integration.secret);
  if (!user || !pass) throw new Error("Gmail n'est pas connecté.");

  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (lead.channel !== "email" || !lead.email) throw new Error("Ce contact n'est pas un contact Gmail.");

  const last = await db.leadMessage.findFirst({
    where: { leadId, direction: "in" },
    orderBy: { sentAt: "desc" },
  });

  const reply = await buildAutoReply(integration, lead);
  try {
    const sent = await sendReply(
      user,
      pass,
      { address: lead.email, name: lead.name },
      { messageId: last?.externalId, subject: last?.subject },
      reply,
    );
    await recordMessage(lead.id, {
      direction: "out",
      body: reply.text,
      subject: sent.subject,
      externalId: sent.messageId,
      auto: true,
    });
    await db.lead.update({ where: { id: lead.id }, data: { autoRepliedAt: new Date() } });
  } catch (error) {
    throw new Error(explain(error));
  }
}
