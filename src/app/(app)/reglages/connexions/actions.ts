"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, logActivity } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { connectGmail, syncGmail } from "@/lib/gmail";
import { testGeminiKey } from "@/lib/gemini";
import { INSTAGRAM_STATE_COOKIE, authorizeUrl } from "@/lib/instagram";
import { getIntegration, parseKeywords } from "@/lib/leads";
import { randomToken } from "@/lib/utils";

export interface ConnexionState {
  error?: string;
  success?: string;
}

const PATH = "/reglages/connexions";

/* ─────────────────────────── Gmail ─────────────────────────── */

const gmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
  // Google affiche le mot de passe d'application par groupes de 4 lettres.
  password: z
    .string()
    .transform((value) => value.replace(/\s+/g, ""))
    .pipe(
      z
        .string()
        .length(16, "Le mot de passe d'application fait 16 lettres (ex. abcd efgh ijkl mnop)."),
    ),
});

export async function connectGmailAction(
  _prev: ConnexionState,
  formData: FormData,
): Promise<ConnexionState> {
  await requireSession();

  const parsed = gmailSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Champs invalides" };

  let cursor;
  try {
    cursor = await connectGmail(parsed.data.email, parsed.data.password);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Connexion impossible." };
  }

  await getIntegration("gmail");
  await db.integration.update({
    where: { channel: "gmail" },
    data: {
      account: parsed.data.email,
      secret: encryptSecret(parsed.data.password),
      cursor: JSON.stringify(cursor),
      connectedAt: new Date(),
      lastSyncAt: null,
      lastError: null,
    },
  });
  await logActivity("integration.gmail", `Gmail connecté : ${parsed.data.email}`);

  revalidatePath(PATH);
  return { success: "Gmail est connecté. Les e-mails reçus à partir de maintenant seront traités." };
}

export async function disconnectGmailAction() {
  await requireSession();
  await db.integration.update({
    where: { channel: "gmail" },
    data: { account: null, secret: null, cursor: null, connectedAt: null, lastError: null },
  });
  await logActivity("integration.gmail", "Gmail déconnecté");
  revalidatePath(PATH);
}

export async function syncGmailAction(): Promise<ConnexionState> {
  await requireSession();
  await syncGmail();
  const integration = await getIntegration("gmail");
  revalidatePath(PATH);
  revalidatePath("/demandes");
  return integration.lastError
    ? { error: integration.lastError }
    : { success: "Relève terminée." };
}

/* ─────────────────────── Réponse automatique ─────────────────────── */

const autoReplySchema = z.object({
  channel: z.enum(["gmail", "instagram"]),
  keywords: z.string().trim(),
  subject: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || null),
  message: z.string().trim().min(1, "Le message est vide."),
});

export async function saveAutoReplyAction(
  _prev: ConnexionState,
  formData: FormData,
): Promise<ConnexionState> {
  await requireSession();

  const parsed = autoReplySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  const input = parsed.data;

  if (!/\{\{\s*lien\s*\}\}/.test(input.message)) {
    return { error: "Le message doit contenir {{lien}} : c'est là que s'insère le lien perso." };
  }
  if (parseKeywords(input.keywords).length === 0) {
    return { error: "Indique au moins un mot-clé." };
  }
  // Instagram limite un message à 1000 caractères, lien compris.
  if (input.channel === "instagram" && input.message.length > 900) {
    return { error: "Message trop long pour Instagram : 900 caractères maximum." };
  }

  await getIntegration(input.channel);
  await db.integration.update({
    where: { channel: input.channel },
    data: {
      autoReply: formData.get("autoReply") === "on",
      keywords: input.keywords,
      subject: input.channel === "gmail" ? input.subject : null,
      message: input.message,
    },
  });

  revalidatePath(PATH);
  return { success: "Réponse automatique enregistrée." };
}

/* ─────────────────────────── Instagram ─────────────────────────── */

const instagramAppSchema = z.object({
  appId: z
    .string()
    .trim()
    .regex(/^\d{6,20}$/, "L'identifiant de l'application est une suite de chiffres."),
  appSecret: z.string().trim(),
});

export async function saveInstagramAppAction(
  _prev: ConnexionState,
  formData: FormData,
): Promise<ConnexionState> {
  await requireSession();

  const parsed = instagramAppSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Champs invalides" };

  const integration = await getIntegration("instagram");
  const { appId, appSecret } = parsed.data;
  if (!appSecret && !decryptSecret(integration.appSecret)) {
    return { error: "Colle la clé secrète de l'application Instagram." };
  }
  if (appSecret && !/^[a-f0-9]{32}$/i.test(appSecret)) {
    return { error: "La clé secrète fait 32 caractères (chiffres et lettres de a à f)." };
  }

  await db.integration.update({
    where: { channel: "instagram" },
    data: {
      appId,
      ...(appSecret ? { appSecret: encryptSecret(appSecret) } : {}),
      verifyToken: integration.verifyToken ?? randomToken(32),
    },
  });

  revalidatePath(PATH);
  return { success: "Application enregistrée. Tu peux maintenant connecter ton compte." };
}

/** Part vers Instagram pour autoriser l'accès au compte professionnel. */
export async function startInstagramAction() {
  await requireSession();
  const integration = await getIntegration("instagram");
  if (!integration.appId || !decryptSecret(integration.appSecret)) {
    redirect(`${PATH}?instagram_erreur=${encodeURIComponent("Enregistre d'abord l'application Meta.")}`);
  }

  const state = randomToken(24);
  (await cookies()).set(INSTAGRAM_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 15,
    path: "/",
  });
  redirect(authorizeUrl(integration.appId, state));
}

export async function disconnectInstagramAction() {
  await requireSession();
  await db.integration.update({
    where: { channel: "instagram" },
    data: {
      account: null,
      accountId: null,
      accountName: null,
      accountAvatar: null,
      secret: null,
      tokenExpiresAt: null,
      connectedAt: null,
      lastError: null,
    },
  });
  await logActivity("integration.instagram", "Instagram déconnecté");
  revalidatePath(PATH);
}

/* ─────────────────────── Scanner IA (Gemini) ─────────────────────── */

export async function saveGeminiKeyAction(
  _prev: ConnexionState,
  formData: FormData,
): Promise<ConnexionState> {
  await requireSession();
  const key = String(formData.get("geminiKey") ?? "").trim();
  if (!/^[A-Za-z0-9_-]{20,}$/.test(key)) {
    return { error: "Colle la clé API Gemini complète (elle commence en général par « AIza »)." };
  }
  try {
    await testGeminiKey(key);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Clé refusée par Gemini." };
  }
  await db.integration.upsert({
    where: { channel: "gemini" },
    create: { channel: "gemini", secret: encryptSecret(key), connectedAt: new Date() },
    update: { secret: encryptSecret(key), connectedAt: new Date(), lastError: null },
  });
  await logActivity("integration.gemini", "Scanner IA (Gemini) activé");
  revalidatePath(PATH);
  revalidatePath("/depenses/scanner");
  return { success: "Clé vérifiée : le scanner analysera désormais tes factures." };
}

export async function removeGeminiKeyAction() {
  await requireSession();
  await db.integration.updateMany({
    where: { channel: "gemini" },
    data: { secret: null, connectedAt: null },
  });
  await logActivity("integration.gemini", "Scanner IA (Gemini) désactivé");
  revalidatePath(PATH);
  revalidatePath("/depenses/scanner");
}
