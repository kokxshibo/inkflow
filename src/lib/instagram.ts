import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Integration } from "@prisma/client";
import { db, logActivity } from "./db";
import { decryptSecret, encryptSecret } from "./crypto";
import {
  appUrl,
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
  saveAvatar,
} from "./leads";

/**
 * Instagram, via l'API officielle « Instagram API with Instagram Login ».
 *
 * Prérequis côté Meta (une seule fois) : un compte Instagram professionnel
 * (Business ou Créateur) et une application Meta avec le produit Instagram.
 * Les messages arrivent par webhook ; les réponses partent par l'API d'envoi.
 */

const GRAPH = "https://graph.instagram.com/v24.0";

/** Jeton anti-falsification de la connexion (aller-retour vers Instagram). */
export const INSTAGRAM_STATE_COOKIE = "inkflow_ig_state";
const SCOPES = ["instagram_business_basic", "instagram_business_manage_messages"];
const NEW_CONVERSATION_WINDOW_MS = 24 * 60 * 60 * 1000;

export function redirectUri() {
  return `${appUrl()}/api/integrations/instagram/callback`;
}

export function webhookUrl() {
  return `${appUrl()}/api/webhooks/instagram`;
}

export function authorizeUrl(appId: string, state: string) {
  const params = new URLSearchParams({
    enable_fb_login: "0",
    force_authentication: "1",
    client_id: appId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(","),
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${params}`;
}

class GraphError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
  }
}

async function graph<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  const data = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; code?: number; error_user_msg?: string };
    error_message?: string;
  } & T;
  if (!response.ok || data.error) {
    const message =
      data.error?.error_user_msg ?? data.error?.message ?? data.error_message ?? `HTTP ${response.status}`;
    throw new GraphError(`Instagram : ${message}`, data.error?.code);
  }
  return data;
}

/* ─────────────────────────── Connexion ─────────────────────────── */

/**
 * Échange le code d'autorisation contre un jeton longue durée (60 jours),
 * lit le profil du compte et l'abonne aux messages.
 */
export async function completeConnection(code: string) {
  const integration = await getIntegration("instagram");
  const appSecret = decryptSecret(integration.appSecret);
  if (!integration.appId || !appSecret) {
    throw new Error("Renseigne d'abord l'identifiant et la clé secrète de l'application.");
  }

  const short = await graph<{
    access_token?: string;
    user_id?: string | number;
    data?: { access_token: string; user_id: string | number }[];
  }>("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: integration.appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(),
      code,
    }),
  });
  const shortToken = short.access_token ?? short.data?.[0]?.access_token;
  if (!shortToken) throw new Error("Instagram n'a pas renvoyé de jeton d'accès.");

  const long = await graph<{ access_token: string; expires_in: number }>(
    `https://graph.instagram.com/access_token?${new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: appSecret,
      access_token: shortToken,
    })}`,
  );

  const me = await graph<{
    user_id: string;
    username: string;
    name?: string;
    profile_picture_url?: string;
  }>(
    `${GRAPH}/me?${new URLSearchParams({
      fields: "user_id,username,name,profile_picture_url",
      access_token: long.access_token,
    })}`,
  );

  await graph(`${GRAPH}/me/subscribed_apps?${new URLSearchParams({
    subscribed_fields: "messages",
    access_token: long.access_token,
  })}`, { method: "POST" });

  await db.integration.update({
    where: { channel: "instagram" },
    data: {
      account: me.username,
      accountId: String(me.user_id),
      accountName: me.name ?? null,
      accountAvatar: me.profile_picture_url ?? null,
      secret: encryptSecret(long.access_token),
      tokenExpiresAt: new Date(Date.now() + long.expires_in * 1000),
      connectedAt: new Date(),
      lastError: null,
    },
  });
  await logActivity("integration.instagram", `Instagram connecté : @${me.username}`);
}

/**
 * Le jeton dure 60 jours et se prolonge tant qu'il est valide : on le
 * renouvelle dès qu'il lui reste moins de 20 jours.
 */
export async function refreshInstagramToken() {
  const integration = await getIntegration("instagram");
  const token = decryptSecret(integration.secret);
  if (!token || !integration.tokenExpiresAt) return;
  if (integration.tokenExpiresAt.getTime() - Date.now() > 20 * 24 * 60 * 60 * 1000) return;

  try {
    const renewed = await graph<{ access_token: string; expires_in: number }>(
      `https://graph.instagram.com/refresh_access_token?${new URLSearchParams({
        grant_type: "ig_refresh_token",
        access_token: token,
      })}`,
    );
    await db.integration.update({
      where: { channel: "instagram" },
      data: {
        secret: encryptSecret(renewed.access_token),
        tokenExpiresAt: new Date(Date.now() + renewed.expires_in * 1000),
      },
    });
  } catch (error) {
    await reportError("instagram", error);
  }
}

/* ─────────────────────────── Webhook ─────────────────────────── */

/** Vérifie la signature X-Hub-Signature-256 envoyée par Meta. */
export function isValidSignature(rawBody: string, signature: string | null, appSecret: string) {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const given = signature.slice("sha256=".length);
  return (
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"))
  );
}

interface MessagingEvent {
  sender?: { id: string };
  recipient?: { id: string };
  timestamp?: number;
  message?: {
    mid: string;
    text?: string;
    is_echo?: boolean;
    is_deleted?: boolean;
    is_unsupported?: boolean;
    attachments?: { type?: string }[];
  };
}

export interface WebhookPayload {
  object?: string;
  entry?: { id?: string; messaging?: MessagingEvent[] }[];
}

function describe(message: NonNullable<MessagingEvent["message"]>) {
  if (message.text?.trim()) return message.text.trim();
  const type = message.attachments?.[0]?.type;
  const labels: Record<string, string> = {
    image: "[Photo]",
    video: "[Vidéo]",
    audio: "[Message vocal]",
    story_mention: "[Mention dans sa story]",
    share: "[Publication partagée]",
    reel: "[Reel partagé]",
    ig_reel: "[Reel partagé]",
  };
  return (type && labels[type]) ?? "[Pièce jointe]";
}

export async function handleWebhook(payload: WebhookPayload) {
  if (payload.object !== "instagram") return;
  const integration = await getIntegration("instagram");
  const token = decryptSecret(integration.secret);
  if (!token || !integration.accountId) return;

  for (const entry of payload.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      try {
        await handleEvent(event, integration, token);
      } catch (error) {
        await reportError("instagram", error);
      }
    }
  }
}

async function handleEvent(event: MessagingEvent, integration: Integration, token: string) {
  const message = event.message;
  if (!message?.mid || message.is_deleted || message.is_unsupported) return;
  const ownId = integration.accountId!;
  const sentAt = event.timestamp ? new Date(event.timestamp) : new Date();

  // Message envoyé par le salon (depuis l'app Instagram ou par l'API) :
  // il rejoint la conversation du contact s'il est connu.
  if (message.is_echo || event.sender?.id === ownId) {
    const recipient = event.recipient?.id;
    if (!recipient) return;
    const lead = await findLead("instagram", recipient);
    if (lead) {
      await recordMessage(lead.id, {
        direction: "out",
        body: describe(message),
        externalId: message.mid,
        sentAt,
      });
    }
    return;
  }

  const senderId = event.sender?.id;
  if (!senderId) return;
  const text = describe(message);
  const incoming = { direction: "in" as const, body: text, externalId: message.mid, sentAt };

  const known = await findLead("instagram", senderId);
  if (known) {
    await recordMessage(known.id, incoming);
    return;
  }

  if (!matchesKeywords(message.text ?? "", parseKeywords(integration.keywords))) return;

  // Nouvelle conversation seulement : le salon ne lui a encore jamais écrit.
  const history = await conversationHistory(token, senderId, ownId);
  if (history.salonHasWritten || history.startedBefore < sentAt.getTime() - NEW_CONVERSATION_WINDOW_MS) {
    return;
  }

  const profile = await fetchProfile(token, senderId);
  if (
    profile?.username &&
    (await db.client.findFirst({
      where: { instagram: { equals: profile.username, mode: "insensitive" } },
    }))
  ) {
    return;
  }

  const lead = await createLead({
    channel: "instagram",
    externalId: senderId,
    name: profile?.name ?? null,
    username: profile?.username ?? null,
  });
  if (profile?.profile_pic) {
    const avatarUrl = await saveAvatar(lead, profile.profile_pic);
    if (avatarUrl) await db.lead.update({ where: { id: lead.id }, data: { avatarUrl } });
  }

  // Les messages précédents de la même conversation (« Salut ! »…) sont repris,
  // sans doubler le message qui vient d'arriver.
  for (const previous of history.messages) {
    const same =
      previous.externalId === message.mid ||
      (previous.body === text && Math.abs(previous.sentAt.getTime() - sentAt.getTime()) < 120_000);
    if (!same) await recordMessage(lead.id, previous);
  }
  await recordMessage(lead.id, incoming);
  await logActivity(
    "lead.instagram",
    `Nouveau contact Instagram : ${profile?.username ? `@${profile.username}` : (profile?.name ?? senderId)}`,
  );

  if (!integration.autoReply || !(await claimAutoReply(lead.id))) return;
  try {
    const reply = await buildAutoReply(integration, lead);
    const sent = await sendInstagramMessage(token, senderId, reply.text);
    await recordMessage(lead.id, {
      direction: "out",
      body: reply.text,
      externalId: sent.message_id,
      auto: true,
    });
  } catch (error) {
    await releaseAutoReply(lead.id);
    throw error;
  }
}

/* ─────────────────────────── API ─────────────────────────── */

interface Profile {
  name?: string;
  username?: string;
  profile_pic?: string;
}

export async function fetchProfile(token: string, igsid: string): Promise<Profile | null> {
  try {
    return await graph<Profile>(
      `${GRAPH}/${igsid}?${new URLSearchParams({
        fields: "name,username,profile_pic",
        access_token: token,
      })}`,
    );
  } catch {
    return null;
  }
}

/**
 * Historique de la conversation avec cette personne : a-t-on déjà écrit, et
 * depuis quand dure-t-elle ? En cas d'échec de lecture, la conversation est
 * considérée comme nouvelle (le contact n'existait pas encore chez nous).
 */
async function conversationHistory(token: string, igsid: string, ownId: string) {
  const result = {
    salonHasWritten: false,
    startedBefore: Date.now(),
    messages: [] as { direction: "in"; body: string; externalId: string; sentAt: Date }[],
  };
  try {
    const data = await graph<{
      data?: {
        messages?: {
          data?: { id: string; created_time: string; from?: { id: string }; message?: string }[];
        };
      }[];
    }>(
      `${GRAPH}/me/conversations?${new URLSearchParams({
        platform: "instagram",
        user_id: igsid,
        fields: "messages.limit(25){from,created_time,message}",
        access_token: token,
      })}`,
    );
    for (const item of data.data?.[0]?.messages?.data ?? []) {
      const time = new Date(item.created_time).getTime();
      if (Number.isFinite(time)) result.startedBefore = Math.min(result.startedBefore, time);
      if (item.from?.id === ownId) {
        result.salonHasWritten = true;
      } else if (item.message?.trim()) {
        result.messages.push({
          direction: "in",
          body: item.message.trim(),
          externalId: item.id,
          sentAt: new Date(item.created_time),
        });
      }
    }
  } catch {
    // Lecture impossible : on s'en tient au fait que le contact est inconnu.
  }
  return result;
}

export async function sendInstagramMessage(token: string, recipientId: string, text: string) {
  try {
    return await graph<{ recipient_id: string; message_id: string }>(`${GRAPH}/me/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: recipientId }, message: { text: text.slice(0, 1000) } }),
    });
  } catch (error) {
    // Hors de la fenêtre de 24 h, Instagram refuse tout message du salon.
    if (error instanceof GraphError && (error.code === 10 || /24/.test(error.message))) {
      throw new Error(
        "Instagram n'autorise une réponse que dans les 24 h qui suivent le dernier message de la personne.",
      );
    }
    throw error;
  }
}

/** Envoi manuel du lien à un contact Instagram (depuis la fiche du contact). */
export async function sendLinkByInstagram(leadId: string) {
  const integration = await getIntegration("instagram");
  const token = decryptSecret(integration.secret);
  if (!token) throw new Error("Instagram n'est pas connecté.");
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (lead.channel !== "instagram") throw new Error("Ce contact n'est pas un contact Instagram.");

  const reply = await buildAutoReply(integration, lead);
  const sent = await sendInstagramMessage(token, lead.externalId, reply.text);
  await recordMessage(lead.id, {
    direction: "out",
    body: reply.text,
    externalId: sent.message_id,
    auto: true,
  });
  await db.lead.update({ where: { id: lead.id }, data: { autoRepliedAt: new Date() } });
}

/** Met à jour pseudo, nom et photo de profil d'un contact Instagram. */
export async function refreshLeadProfile(leadId: string) {
  const integration = await getIntegration("instagram");
  const token = decryptSecret(integration.secret);
  if (!token) throw new Error("Instagram n'est pas connecté.");
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (lead.channel !== "instagram") return;

  const profile = await fetchProfile(token, lead.externalId);
  if (!profile) throw new Error("Profil Instagram introuvable (compte supprimé ou bloqué ?).");
  const avatarUrl = profile.profile_pic ? await saveAvatar(lead, profile.profile_pic) : null;
  await db.lead.update({
    where: { id: lead.id },
    data: {
      name: profile.name ?? lead.name,
      username: profile.username ?? lead.username,
      ...(avatarUrl ? { avatarUrl } : {}),
    },
  });
}
