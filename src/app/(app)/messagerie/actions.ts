"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, getSettings, logActivity } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { sendMail, isSmtpConfigured, renderTemplate, buildSignature } from "@/lib/mail";
import { generateDocumentPdf } from "@/lib/pdf";
import { formatCHF } from "@/lib/money";
import { formatDate, formatTime } from "@/lib/utils";

const messageSchema = z.object({
  clientId: z.string().optional(),
  to: z.string().email("Adresse e-mail invalide"),
  subject: z.string().trim().min(1, "Objet requis"),
  body: z.string().trim().min(1, "Le message est vide"),
  quoteId: z.string().optional(),
  invoiceId: z.string().optional(),
  attachPdf: z.coerce.boolean().default(false),
});

export interface MessageState {
  error?: string;
  warning?: string;
  success?: boolean;
}

/** Enregistre le message et l'envoie si le SMTP est configuré. */
export async function sendMessage(
  _prev: MessageState,
  formData: FormData,
): Promise<MessageState> {
  await requireSession();

  const parsed = messageSchema.safeParse({
    ...Object.fromEntries(formData.entries()),
    attachPdf: formData.get("attachPdf") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }

  const input = parsed.data;
  const settings = await getSettings();

  // Pièce jointe : le PDF du devis ou de la facture concerné
  const attachments: { filename: string; content: Buffer; contentType: string }[] = [];

  if (input.attachPdf && (input.quoteId || input.invoiceId)) {
    try {
      if (input.quoteId) {
        const quote = await db.quote.findUnique({
          where: { id: input.quoteId },
          include: { client: true, items: { orderBy: { position: "asc" } } },
        });
        if (quote) {
          const pdf = await generateDocumentPdf(
            {
              kind: "quote",
              number: quote.number,
              issuedAt: quote.issuedAt,
              secondDate: quote.validUntil,
              client: quote.client,
              items: quote.items,
              subtotal: quote.subtotal,
              discount: quote.discount,
              vatRate: quote.vatRate,
              vatAmount: quote.vatAmount,
              total: quote.total,
              depositAmount: quote.depositAmount,
              notes: quote.notes,
              terms: quote.terms,
            },
            settings,
          );
          attachments.push({
            filename: `${quote.number}.pdf`,
            content: pdf,
            contentType: "application/pdf",
          });
        }
      }

      if (input.invoiceId) {
        const invoice = await db.invoice.findUnique({
          where: { id: input.invoiceId },
          include: { client: true, items: { orderBy: { position: "asc" } } },
        });
        if (invoice) {
          const pdf = await generateDocumentPdf(
            {
              kind: "invoice",
              number: invoice.number,
              issuedAt: invoice.issuedAt,
              secondDate: invoice.dueAt,
              client: invoice.client,
              items: invoice.items,
              subtotal: invoice.subtotal,
              discount: invoice.discount,
              vatRate: invoice.vatRate,
              vatAmount: invoice.vatAmount,
              total: invoice.total,
              amountPaid: invoice.amountPaid,
              qrReference: invoice.qrReference,
              notes: invoice.notes,
              terms: invoice.terms,
            },
            settings,
          );
          attachments.push({
            filename: `${invoice.number}.pdf`,
            content: pdf,
            contentType: "application/pdf",
          });
        }
      }
    } catch (error) {
      console.error("PDF non joint :", error);
    }
  }

  const result = await sendMail({
    to: input.to,
    subject: input.subject,
    text: input.body,
    replyTo: settings.email || undefined,
    attachments,
  });

  await db.message.create({
    data: {
      clientId: input.clientId || null,
      direction: "out",
      subject: input.subject,
      body: input.body,
      fromAddr: process.env.SMTP_FROM || settings.email || "non-configure@local",
      toAddr: input.to,
      status: result.status === "sent" ? "sent" : result.status,
      error: result.error,
      messageId: result.messageId,
      threadKey: input.to.toLowerCase(),
      relatedQuoteId: input.quoteId || null,
      relatedInvoiceId: input.invoiceId || null,
      attachments: JSON.stringify(attachments.map((a) => a.filename)),
      needsReply: true,
      sentAt: result.status === "sent" ? new Date() : null,
    },
  });

  // Le devis passe automatiquement en « envoyé »
  if (input.quoteId) {
    await db.quote.updateMany({
      where: { id: input.quoteId, status: "draft" },
      data: { status: "sent", sentAt: new Date() },
    });
  }
  if (input.invoiceId) {
    await db.invoice.updateMany({
      where: { id: input.invoiceId, status: "draft" },
      data: { status: "sent", sentAt: new Date() },
    });
  }

  await logActivity("message.send", `E-mail à ${input.to}`, "message");

  revalidatePath("/messagerie");
  if (input.clientId) revalidatePath(`/clients/${input.clientId}`);

  if (result.status === "failed") {
    return { error: `L'envoi a échoué : ${result.error}` };
  }

  redirect(
    result.status === "simulated"
      ? "/messagerie?simule=1"
      : "/messagerie?envoye=1",
  );
}

export async function markMessageRead(id: string) {
  await requireSession();
  await db.message.update({ where: { id }, data: { readAt: new Date() } });
  revalidatePath("/messagerie");
}

export async function deleteMessage(id: string) {
  await requireSession();
  await db.message.delete({ where: { id } });
  revalidatePath("/messagerie");
}

export async function toggleNeedsReply(id: string, needsReply: boolean) {
  await requireSession();
  await db.message.update({ where: { id }, data: { needsReply } });
  revalidatePath("/messagerie");
}

/* ───────────────────────── Modèles d'e-mails ───────────────────────── */

const templateSchema = z.object({
  id: z.string().optional(),
  key: z.string().trim().min(1),
  name: z.string().trim().min(1, "Nom requis"),
  category: z.string().default("general"),
  subject: z.string().trim().min(1, "Objet requis"),
  body: z.string().trim().min(1, "Contenu requis"),
});

export async function saveTemplate(
  _prev: MessageState,
  formData: FormData,
): Promise<MessageState> {
  await requireSession();

  const parsed = templateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }

  const { id, ...data } = parsed.data;

  if (id) {
    await db.emailTemplate.update({ where: { id }, data });
  } else {
    await db.emailTemplate.create({ data });
  }

  revalidatePath("/messagerie/modeles");
  return { success: true };
}

export async function deleteTemplate(id: string) {
  await requireSession();
  await db.emailTemplate.delete({ where: { id } });
  revalidatePath("/messagerie/modeles");
}

/**
 * Prépare le contenu d'un e-mail à partir d'un modèle et du contexte métier.
 * Le résultat est toujours modifiable avant envoi : aucun message ne part
 * sans validation humaine.
 */
export async function prepareFromTemplate(
  templateKey: string,
  clientId: string,
  options: { quoteId?: string; invoiceId?: string; appointmentId?: string } = {},
) {
  await requireSession();

  const [template, client, settings] = await Promise.all([
    db.emailTemplate.findUnique({ where: { key: templateKey } }),
    db.client.findUnique({ where: { id: clientId } }),
    getSettings(),
  ]);

  if (!template || !client) return null;

  const [quote, invoice, appointment] = await Promise.all([
    options.quoteId
      ? db.quote.findUnique({ where: { id: options.quoteId } })
      : null,
    options.invoiceId
      ? db.invoice.findUnique({ where: { id: options.invoiceId } })
      : null,
    options.appointmentId
      ? db.appointment.findUnique({
          where: { id: options.appointmentId },
          include: { project: true },
        })
      : null,
  ]);

  const appUrl = process.env.APP_URL ?? "";
  const context = {
    prenom: client.firstName,
    nom: client.lastName,
    tatoueur: settings.ownerName,
    // Anciens noms de {{tatoueur}}, encore compris dans les modèles déjà écrits.
    artiste: settings.ownerName,
    salon: settings.ownerName,
    signature: buildSignature(settings),
    date_rdv: appointment ? formatDate(appointment.startAt) : "",
    heure_rdv: appointment ? formatTime(appointment.startAt) : "",
    projet: appointment?.project?.title ?? "",
    montant: quote
      ? formatCHF(quote.total)
      : invoice
        ? formatCHF(invoice.total)
        : "",
    acompte: quote ? formatCHF(quote.depositAmount) : "",
    numero: quote?.number ?? invoice?.number ?? "",
    echeance: invoice ? formatDate(invoice.dueAt) : "",
    lien: quote
      ? `${appUrl}/devis-public/${quote.publicToken}`
      : invoice
        ? `${appUrl}/facture-publique/${invoice.publicToken}`
        : "",
  };

  return {
    subject: renderTemplate(template.subject, context),
    body: renderTemplate(template.body, context),
  };
}

export async function smtpStatus() {
  return { configured: isSmtpConfigured() };
}
