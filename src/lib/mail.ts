import "server-only";
import nodemailer from "nodemailer";
import type { Settings } from "@prisma/client";

export interface SendResult {
  status: "sent" | "simulated" | "failed";
  messageId?: string;
  error?: string;
}

/** Le SMTP n'est considéré configuré que si l'hôte et l'expéditeur sont définis. */
export function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function transporter() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

/**
 * Envoie un e-mail.
 *
 * Sans SMTP configuré, le message est marqué « simulated » : il reste enregistré
 * dans la messagerie mais n'est pas expédié. Cela permet de travailler en local
 * sans jamais écrire accidentellement à un vrai client.
 */
export async function sendMail({
  to,
  subject,
  text,
  replyTo,
  attachments,
}: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}): Promise<SendResult> {
  if (!isSmtpConfigured()) {
    return { status: "simulated" };
  }

  try {
    const info = await transporter().sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text,
      html: textToHtml(text),
      replyTo,
      attachments,
    });
    return { status: "sent", messageId: info.messageId };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Erreur d'envoi inconnue",
    };
  }
}

/** Conversion texte → HTML simple, avec échappement. */
function textToHtml(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#b45309">$1</a>',
  );

  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.6;color:#18181b;white-space:pre-wrap">${linked}</div>`;
}

/* ─────────────────── Substitution des variables ─────────────────── */

export interface TemplateContext {
  prenom?: string;
  nom?: string;
  salon?: string;
  tatoueur?: string;
  date_rdv?: string;
  heure_rdv?: string;
  montant?: string;
  acompte?: string;
  numero?: string;
  echeance?: string;
  lien?: string;
  projet?: string;
  signature?: string;
  [key: string]: string | undefined;
}

/** Remplace les {{variables}} d'un modèle. Les inconnues sont retirées. */
export function renderTemplate(template: string, context: TemplateContext): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
    return context[key] ?? "";
  });
}

export function buildSignature(settings: Settings): string {
  if (settings.emailSignature) return settings.emailSignature;

  return [
    settings.ownerName,
    settings.studioName,
    [settings.addressLine, [settings.postalCode, settings.city].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", "),
    settings.phone,
    settings.website,
  ]
    .filter(Boolean)
    .join("\n");
}

// La liste des variables proposées dans l'éditeur vit dans lib/constants.ts :
// ce module est marqué « server-only » et ne peut pas être importé par un
// composant client.
