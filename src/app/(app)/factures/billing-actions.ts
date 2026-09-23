"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, getSettings, logActivity, nextNumber } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { buildQrReference, formatCHF, fromGross, parseCHF } from "@/lib/money";
import { addDays, randomToken } from "@/lib/utils";
import { getBillingSuggestions, UNBILLED_SESSION } from "@/lib/billing";

export interface QuickBillingState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const PAYMENT_METHODS = ["twint", "cash", "card", "bank_transfer"] as const;

const baseSchema = z.object({
  label: z.string().trim().min(1, "Indique ce qui est facturé."),
  description: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .default(null),
  amount: z.string().min(1, "Le montant est requis."),
  paid: z.enum(["yes", "no"]).default("no"),
  method: z.enum(PAYMENT_METHODS).default("twint"),
});

function collectErrors(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]);
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: "Vérifie les champs signalés.", fieldErrors };
}

class AlreadyBilledError extends Error {}

const ALREADY_BILLED =
  "Ceci a déjà été facturé entre-temps. Recharge la page pour voir la liste à jour.";

interface IssueInput {
  clientId: string;
  projectId: string | null;
  quoteId: string | null;
  kind: "full" | "deposit" | "balance";
  label: string;
  description: string | null;
  amount: number;
  paid: boolean;
  method: (typeof PAYMENT_METHODS)[number];
  /** Séance précise à rattacher */
  appointmentId?: string;
  /** Rattacher toutes les séances effectuées non facturées du projet */
  attachProjectSessions?: boolean;
}

/**
 * Émet la facture : numéro, ligne unique, rattachement des séances et
 * paiement éventuel, dans une seule transaction. Si quoi que ce soit échoue,
 * rien n'est enregistré et le numéro n'est pas consommé.
 */
async function issueInvoice(input: IssueInput) {
  const settings = await getSettings();
  const vatRate = settings.vatEnabled ? settings.vatRate : 0;
  // Le montant saisi est ce que paie le client : la TVA en est extraite.
  const totals = fromGross(input.amount, vatRate);
  const now = new Date();

  const invoice = await db.$transaction(async (tx) => {
    const number = await nextNumber("invoice", settings.invoicePrefix, tx);

    const created = await tx.invoice.create({
      data: {
        number,
        clientId: input.clientId,
        projectId: input.projectId,
        quoteId: input.quoteId,
        kind: input.kind,
        // Émise directement : le montant vient d'être vérifié à l'écran.
        status: input.paid ? "paid" : "sent",
        issuedAt: now,
        dueAt: input.paid ? now : addDays(now, settings.paymentTermDays),
        sentAt: now,
        paidAt: input.paid ? now : null,
        subtotal: totals.subtotal,
        discount: 0,
        vatRate,
        vatAmount: totals.vatAmount,
        total: totals.total,
        amountPaid: input.paid ? totals.total : 0,
        qrReference: settings.qrIban ? buildQrReference(number) : null,
        publicToken: randomToken(28),
        items: {
          create: [
            {
              label: input.label,
              description: input.description,
              quantity: 1,
              unitPrice: totals.subtotal,
              position: 0,
            },
          ],
        },
      },
    });

    if (input.appointmentId) {
      // Condition vérifiée dans la transaction : deux validations simultanées
      // (deux appareils) ne peuvent pas facturer la même séance.
      const { count } = await tx.appointment.updateMany({
        where: { id: input.appointmentId, ...UNBILLED_SESSION },
        data: { invoiceId: created.id },
      });
      if (count === 0) throw new AlreadyBilledError();
    }

    if (input.attachProjectSessions && input.projectId) {
      await tx.appointment.updateMany({
        where: { projectId: input.projectId, ...UNBILLED_SESSION },
        data: { invoiceId: created.id },
      });
    }

    if (input.paid) {
      await tx.payment.create({
        data: {
          invoiceId: created.id,
          amount: totals.total,
          method: input.method,
          paidAt: now,
        },
      });
    }

    // Acompte encaissé : le projet est lancé et ses créneaux provisoires confirmés.
    if (input.paid && input.kind === "deposit" && input.projectId) {
      await tx.project.updateMany({
        where: { id: input.projectId, status: { in: ["idea", "quoted", "accepted"] } },
        data: { status: "deposit_paid" },
      });
      await tx.appointment.updateMany({
        where: { projectId: input.projectId, status: "draft" },
        data: { status: "confirmed", depositPaid: true },
      });
    }

    return created;
  });

  await logActivity(
    "invoice.create",
    `Facture ${invoice.number} émise (${formatCHF(invoice.total)})${input.paid ? " et encaissée" : ""}`,
    "invoice",
    invoice.id,
  );

  revalidatePath("/factures");
  revalidatePath("/tableau-de-bord");
  revalidatePath(`/clients/${input.clientId}`);
  if (input.projectId) revalidatePath(`/projets/${input.projectId}`);
  revalidatePath("/agenda");

  return invoice;
}

/* ─────────────────────── Depuis une suggestion ─────────────────────── */

export async function createInvoiceFromSuggestion(
  _prev: QuickBillingState,
  formData: FormData,
): Promise<QuickBillingState> {
  await requireSession();

  const key = String(formData.get("key") ?? "");
  const parsed = baseSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return collectErrors(parsed.error);

  const amount = parseCHF(parsed.data.amount);
  if (amount <= 0) {
    return { error: "Vérifie le montant.", fieldErrors: { amount: "Le montant doit être supérieur à zéro." } };
  }

  // La suggestion est recalculée ici : si elle a déjà été facturée entre-temps
  // (autre onglet, autre appareil), on refuse plutôt que de facturer deux fois.
  const settings = await getSettings();
  const [suggestion] = await getBillingSuggestions(settings, { key });
  if (!suggestion) return { error: ALREADY_BILLED };

  let invoiceId: string;
  try {
    const invoice = await issueInvoice({
      clientId: suggestion.clientId,
      projectId: suggestion.projectId,
      quoteId: suggestion.quoteId ?? null,
      kind: suggestion.invoiceKind,
      label: parsed.data.label,
      description: parsed.data.description,
      amount,
      paid: parsed.data.paid === "yes",
      method: parsed.data.method,
      appointmentId: suggestion.appointmentId,
      attachProjectSessions: suggestion.kind === "balance",
    });
    invoiceId = invoice.id;
  } catch (error) {
    if (error instanceof AlreadyBilledError) return { error: ALREADY_BILLED };
    throw error;
  }

  redirect(`/factures/${invoiceId}?creee=1`);
}

/* ─────────────────────── Montant libre ─────────────────────── */

const quickSchema = baseSchema.extend({
  clientId: z.string().min(1, "Choisis le client."),
});

export async function createQuickInvoice(
  _prev: QuickBillingState,
  formData: FormData,
): Promise<QuickBillingState> {
  await requireSession();

  const parsed = quickSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return collectErrors(parsed.error);

  const amount = parseCHF(parsed.data.amount);
  if (amount <= 0) {
    return { error: "Vérifie le montant.", fieldErrors: { amount: "Le montant doit être supérieur à zéro." } };
  }

  const client = await db.client.findUnique({ where: { id: parsed.data.clientId } });
  if (!client) return { error: "Client introuvable.", fieldErrors: { clientId: "Client introuvable." } };

  const invoice = await issueInvoice({
    clientId: client.id,
    projectId: null,
    quoteId: null,
    kind: "full",
    label: parsed.data.label,
    description: parsed.data.description,
    amount,
    paid: parsed.data.paid === "yes",
    method: parsed.data.method,
  });

  redirect(`/factures/${invoice.id}?creee=1`);
}
