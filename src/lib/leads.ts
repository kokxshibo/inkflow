import "server-only";
import { Prisma, type Integration } from "@prisma/client";
import { db, getSettings } from "./db";
import { buildSignature, renderTemplate } from "./mail";
import { removeFile, storeBuffer } from "./storage";
import { randomToken } from "./utils";

/**
 * Contacts arrivés par Instagram ou Gmail.
 *
 * Quand une personne écrit pour la première fois au sujet d'un tatouage, elle
 * reçoit automatiquement un lien de demande qui lui est propre (/d/<jeton>).
 * Le lien permet de savoir qui a cliqué, d'où la personne venait, et de
 * rattacher sa demande à la conversation d'origine.
 */

/** Cookie posé par le lien perso : la demande reste rattachée si la personne revient plus tard. */
export const REF_COOKIE = "inkflow_ref";

export type Channel = "gmail" | "instagram";
export type LeadChannel = "email" | "instagram";

export const DEFAULT_KEYWORDS = [
  "tatouage",
  "tatoo",
  "tattoo",
  "tatouer",
  "tatoué",
  "projet",
  "flash",
  "devis",
  "prix",
  "tarif",
  "combien",
  "dispo",
  "rdv",
  "rendez-vous",
  "séance",
  "cover",
  "recouvrement",
  "retouche",
  "piercing",
].join(", ");

/**
 * Message envoyé automatiquement : en français puis en anglais, avec un seul
 * lien de demande à la fin (le formulaire propose aussi l'allemand).
 */
export const AUTO_REPLY_TEXT =
  "Salut à toi, merci de me contacter et de l’intérêt que tu portes à mon travail. " +
  "Afin de centraliser toutes les demandes de projet provenant de différentes plateformes, " +
  "je t’incite à répondre au questionnaire en cliquant sur le lien ci-dessous. " +
  "Je te répondrai dans les plus brefs délais ! Merci d’avance.\n\n" +
  "Hi there, thank you for reaching out and for your interest in my work. " +
  "To keep all project requests from the different platforms in one place, " +
  "I invite you to fill in the questionnaire by clicking the link below. " +
  "I’ll get back to you as soon as possible! Thanks in advance.\n\n" +
  "👉 {{lien}}";

export const DEFAULT_MESSAGES: Record<Channel, { subject: string | null; message: string }> = {
  instagram: { subject: null, message: AUTO_REPLY_TEXT },
  // Par e-mail, la signature suit le message, comme dans Gmail.
  gmail: { subject: null, message: `${AUTO_REPLY_TEXT}\n\n{{signature}}` },
};

/** Ligne de réglages d'un canal, créée avec les valeurs par défaut si absente. */
export async function getIntegration(channel: Channel): Promise<Integration> {
  const existing = await db.integration.findUnique({ where: { channel } });
  if (existing) return existing;
  return db.integration.upsert({
    where: { channel },
    create: {
      channel,
      keywords: DEFAULT_KEYWORDS,
      subject: DEFAULT_MESSAGES[channel].subject,
      message: DEFAULT_MESSAGES[channel].message,
    },
    update: {},
  });
}

export function appUrl() {
  return (process.env.APP_URL ?? "").replace(/\/+$/, "");
}

export function leadLink(token: string) {
  return `${appUrl()}/d/${token}`;
}

/* ─────────────────────────── Mots-clés ─────────────────────────── */

/** Minuscules sans accents : « Tatoué » et « tatoue » se valent. */
export function normalizeText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function parseKeywords(list: string): string[] {
  return list
    .split(/[,\n;]/)
    .map((keyword) => normalizeText(keyword.trim()))
    .filter(Boolean);
}

/**
 * Vrai si le texte contient un des mots-clés en début de mot :
 * « dispo » trouve « disponible », mais « rdv » ne trouve pas « lourdvoir ».
 */
export function matchesKeywords(text: string, keywords: string[]) {
  const haystack = normalizeText(text);
  return keywords.some((keyword) => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}`).test(haystack);
  });
}

/* ─────────────────────────── Message ─────────────────────────── */

/** Premier prénom exploitable d'un nom affiché (« léa MORAND » → « Léa »). */
export function firstNameOf(name: string | null | undefined) {
  const first = name?.trim().split(/\s+/)[0] ?? "";
  if (!first || /[@\d_]/.test(first)) return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export async function buildAutoReply(
  integration: Integration,
  lead: { token: string; name: string | null },
  extra: Record<string, string> = {},
) {
  if (!/^https?:\/\//.test(appUrl())) {
    throw new Error("APP_URL n'est pas configurée : impossible de construire le lien à envoyer.");
  }
  const settings = await getSettings();
  const prenom = firstNameOf(lead.name);
  const context = {
    prenom,
    lien: leadLink(lead.token),
    tatoueur: settings.ownerName,
    // Anciens noms de {{tatoueur}}, encore compris dans les messages déjà écrits.
    artiste: settings.ownerName,
    salon: settings.ownerName,
    signature: buildSignature(settings),
    ...extra,
  };
  // Sans prénom connu, « Salut {{prenom}} ! » devient « Salut ! » et non « Salut  ! ».
  const template = prenom
    ? integration.message
    : integration.message.replace(/[ \t]*\{\{\s*prenom\s*\}\}/g, "");
  return {
    text: renderTemplate(template, context).trim(),
    subject: integration.subject?.trim()
      ? renderTemplate(integration.subject, context)
      : null,
  };
}

/* ─────────────────────────── Contacts ─────────────────────────── */

export async function findLead(channel: LeadChannel, externalId: string) {
  return db.lead.findUnique({
    where: { channel_externalId: { channel, externalId } },
  });
}

export async function createLead(data: {
  channel: LeadChannel;
  externalId: string;
  name?: string | null;
  username?: string | null;
  email?: string | null;
}) {
  return db.lead.upsert({
    where: { channel_externalId: { channel: data.channel, externalId: data.externalId } },
    create: { ...data, token: randomToken(12) },
    update: {},
  });
}

/** Ajoute un message à la conversation. Sans effet s'il est déjà enregistré. */
export async function recordMessage(
  leadId: string,
  message: {
    direction: "in" | "out";
    body: string;
    subject?: string | null;
    externalId?: string | null;
    auto?: boolean;
    sentAt?: Date;
  },
) {
  const sentAt = message.sentAt ?? new Date();

  // Déjà reçu (webhook rejoué, copie dans « Envoyés »…). Une réponse
  // automatique garde tout de même sa marque.
  if (message.externalId) {
    const existing = await db.leadMessage.findUnique({
      where: { externalId: message.externalId },
      select: { auto: true },
    });
    if (existing) {
      if (message.auto && !existing.auto) {
        await db.leadMessage.update({
          where: { externalId: message.externalId },
          data: { auto: true },
        });
      }
      return false;
    }
  }

  try {
    await db.leadMessage.create({
      data: {
        leadId,
        direction: message.direction,
        body: message.body.slice(0, 5000),
        subject: message.subject ?? null,
        externalId: message.externalId ?? null,
        auto: message.auto ?? false,
        sentAt,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      message.externalId
    ) {
      // Même message enregistré au même instant par un autre traitement.
      if (message.auto) {
        await db.leadMessage.update({
          where: { externalId: message.externalId },
          data: { auto: true },
        });
      }
      return false;
    }
    throw error;
  }
  await db.lead.updateMany({
    where: { id: leadId, OR: [{ lastMessageAt: null }, { lastMessageAt: { lt: sentAt } }] },
    data: { lastMessageAt: sentAt },
  });
  if (message.direction === "in") {
    // Heure de réception par l'app, pas celle écrite par l'expéditeur : un
    // e-mail distribué en retard doit quand même apparaître comme non lu.
    await db.lead.update({ where: { id: leadId }, data: { lastIncomingAt: new Date() } });
  }
  return true;
}

/** Contacts avec un message reçu depuis la dernière lecture (badge du menu). */
export function countUnreadLeads() {
  return db.lead.count({
    where: {
      lastIncomingAt: { not: null },
      OR: [{ lastReadAt: null }, { lastReadAt: { lt: db.lead.fields.lastIncomingAt } }],
    },
  });
}

export async function markLeadRead(leadId: string) {
  await db.lead.update({ where: { id: leadId }, data: { lastReadAt: new Date() } });
}

/**
 * Instagram n'accepte une réponse que dans les 24 h qui suivent le dernier
 * message de la personne. Renvoie l'échéance, ou null si aucun message reçu.
 */
export function instagramReplyDeadline(lastIncomingAt: Date | null) {
  return lastIncomingAt ? new Date(lastIncomingAt.getTime() + 24 * 60 * 60 * 1000) : null;
}

/**
 * Réserve l'envoi de la réponse automatique : un seul envoi par contact, même
 * si deux relèves ou deux webhooks traitent le même message en parallèle.
 */
export async function claimAutoReply(leadId: string) {
  const { count } = await db.lead.updateMany({
    where: { id: leadId, autoRepliedAt: null },
    data: { autoRepliedAt: new Date() },
  });
  return count === 1;
}

export async function releaseAutoReply(leadId: string) {
  await db.lead.update({ where: { id: leadId }, data: { autoRepliedAt: null } });
}

/**
 * Copie une photo de profil sur le serveur : les liens fournis par Instagram
 * expirent au bout de quelques jours.
 */
export async function saveAvatar(
  lead: { id: string; avatarUrl: string | null },
  sourceUrl: string,
): Promise<string | null> {
  try {
    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(10_000) });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.startsWith("image/")) return null;
    const content = Buffer.from(await response.arrayBuffer());
    if (content.length === 0 || content.length > 3 * 1024 * 1024) return null;

    const extension = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const url = await storeBuffer(content, "contacts", `${lead.id}-${randomToken(6)}.${extension}`);
    if (lead.avatarUrl?.startsWith("/uploads/")) await removeFile(lead.avatarUrl);
    return url;
  } catch {
    return null;
  }
}

/** Enregistre la dernière erreur d'un canal (visible dans Réglages → Connexions). */
export async function reportError(channel: Channel, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${channel}]`, message);
  await db.integration
    .update({ where: { channel }, data: { lastError: message.slice(0, 500) } })
    .catch(() => {});
}
