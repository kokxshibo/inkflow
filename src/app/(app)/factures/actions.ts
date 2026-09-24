"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, getSettings, logActivity, nextNumber } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { computeTotals, parseCHF, buildQrReference } from "@/lib/money";
import { randomToken } from "@/lib/utils";

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable();

const invoiceSchema = z.object({
  clientId: z.string().min(1, "Sélectionne un client"),
  projectId: optionalString,
  issuedAt: z.string().min(1),
  dueAt: z.string().min(1),
  kind: z.string().default("full"),
  discount: optionalString,
  notes: optionalString,
  terms: optionalString,
});

export interface InvoiceState {
  error?: string;
}

interface LineInput {
  label: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
}

function readLines(formData: FormData): LineInput[] {
  const labels = formData.getAll("lineLabel").map(String);
  const descriptions = formData.getAll("lineDescription").map(String);
  const quantities = formData.getAll("lineQuantity").map(String);
  const prices = formData.getAll("linePrice").map(String);

  return labels
    .map((label, index) => ({
      label: label.trim(),
      description: descriptions[index]?.trim() || null,
      quantity: Number.parseFloat((quantities[index] ?? "1").replace(",", ".")) || 0,
      unitPrice: parseCHF(prices[index] ?? "0"),
    }))
    .filter((line) => line.label !== "" && line.quantity > 0);
}

export async function saveInvoice(
  _prev: InvoiceState,
  formData: FormData,
): Promise<InvoiceState> {
  await requireSession();

  const id = String(formData.get("id") ?? "");
  const parsed = invoiceSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }

  const lines = readLines(formData);
  if (lines.length === 0) {
    return { error: "Ajoute au moins une ligne de prestation." };
  }

  const settings = await getSettings();
  const vatRate = settings.vatEnabled ? settings.vatRate : 0;

  const input = parsed.data;
  const totals = computeTotals(lines, parseCHF(input.discount ?? "0"), vatRate);

  const data = {
    clientId: input.clientId,
    projectId: input.projectId,
    kind: input.kind,
    issuedAt: new Date(input.issuedAt),
    dueAt: new Date(input.dueAt),
    subtotal: totals.subtotal,
    discount: totals.discount,
    vatRate: totals.vatRate,
    vatAmount: totals.vatAmount,
    total: totals.total,
    notes: input.notes,
    terms: input.terms,
  };

  let invoiceId = id;

  if (id) {
    const existing = await db.invoice.findUnique({ where: { id } });
    if (!existing) return { error: "Facture introuvable." };

    // Une facture émise est figée : seul un brouillon reste modifiable.
    if (existing.status !== "draft") {
      return {
        error:
          "Cette facture a déjà été émise et ne peut plus être modifiée. Établis une note de crédit puis une nouvelle facture.",
      };
    }

    await db.$transaction([
      db.invoiceItem.deleteMany({ where: { invoiceId: id } }),
      db.invoice.update({ where: { id }, data }),
      db.invoiceItem.createMany({
        data: lines.map((line, index) => ({ ...line, invoiceId: id, position: index })),
      }),
    ]);
    await logActivity("invoice.update", `Facture ${existing.number} mise à jour`, "invoice", id);
  } else {
    const number = await nextNumber("invoice", settings.invoicePrefix);
    const created = await db.invoice.create({
      data: {
        ...data,
        number,
        status: "draft",
        qrReference: settings.qrIban ? buildQrReference(number) : null,
        publicToken: randomToken(28),
        items: { create: lines.map((line, index) => ({ ...line, position: index })) },
      },
    });
    invoiceId = created.id;
    await logActivity("invoice.create", `Facture ${number} créée`, "invoice", created.id);
  }

  revalidatePath("/factures");
  revalidatePath(`/clients/${input.clientId}`);
  redirect(`/factures/${invoiceId}`);
}

export async function sendInvoice(id: string) {
  await requireSession();
  const invoice = await db.invoice.update({
    where: { id },
    data: { status: "sent", sentAt: new Date() },
  });
  await logActivity("invoice.send", `Facture ${invoice.number} émise`, "invoice", id);
  revalidatePath(`/factures/${id}`);
  revalidatePath("/factures");
}

export async function setInvoiceStatus(id: string, status: string) {
  await requireSession();
  const invoice = await db.invoice.update({ where: { id }, data: { status } });
  await logActivity("invoice.status", `Facture ${invoice.number} : ${status}`, "invoice", id);
  revalidatePath(`/factures/${id}`);
  revalidatePath("/factures");
}

const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.string().min(1, "Montant requis"),
  method: z.string().default("twint"),
  paidAt: z.string().min(1),
  reference: optionalString,
  // Le formulaire d'encaissement n'envoie pas de note : la clé peut être absente.
  note: optionalString.optional(),
});

export async function recordPayment(
  _prev: InvoiceState,
  formData: FormData,
): Promise<InvoiceState & { success?: boolean }> {
  await requireSession();

  const parsed = paymentSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }

  const amount = parseCHF(parsed.data.amount);
  if (amount <= 0) return { error: "Le montant doit être supérieur à zéro." };

  const invoice = await db.invoice.findUnique({
    where: { id: parsed.data.invoiceId },
    include: { payments: true },
  });
  if (!invoice) return { error: "Facture introuvable." };

  await db.payment.create({
    data: {
      invoiceId: invoice.id,
      amount,
      method: parsed.data.method,
      paidAt: new Date(parsed.data.paidAt),
      reference: parsed.data.reference,
      note: parsed.data.note,
    },
  });

  const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0) + amount;
  const status = totalPaid >= invoice.total ? "paid" : "partial";

  await db.invoice.update({
    where: { id: invoice.id },
    data: {
      amountPaid: totalPaid,
      status,
      paidAt: status === "paid" ? new Date() : null,
    },
  });

  // Une facture d'acompte encaissée débloque le projet et confirme les séances.
  if (invoice.projectId && status === "paid" && invoice.kind === "deposit") {
    await db.project.updateMany({
      where: { id: invoice.projectId, status: { in: ["quoted", "accepted"] } },
      data: { status: "deposit_paid" },
    });
    await db.appointment.updateMany({
      where: { projectId: invoice.projectId, status: "draft" },
      data: { status: "confirmed", depositPaid: true },
    });
  }

  await logActivity(
    "payment.create",
    `Paiement enregistré sur ${invoice.number}`,
    "invoice",
    invoice.id,
  );

  revalidatePath(`/factures/${invoice.id}`);
  revalidatePath("/factures");
  revalidatePath("/tableau-de-bord");
  revalidatePath(`/clients/${invoice.clientId}`);

  return { success: true };
}

export async function deletePayment(paymentId: string) {
  await requireSession();

  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { invoice: { include: { payments: true } } },
  });
  if (!payment) return;

  await db.payment.delete({ where: { id: paymentId } });

  const remaining = payment.invoice.payments
    .filter((p) => p.id !== paymentId)
    .reduce((sum, p) => sum + p.amount, 0);

  await db.invoice.update({
    where: { id: payment.invoiceId },
    data: {
      amountPaid: remaining,
      status:
        remaining >= payment.invoice.total
          ? "paid"
          : remaining > 0
            ? "partial"
            : "sent",
      paidAt: remaining >= payment.invoice.total ? payment.invoice.paidAt : null,
    },
  });

  revalidatePath(`/factures/${payment.invoiceId}`);
  revalidatePath("/factures");
}

export async function deleteInvoice(id: string) {
  await requireSession();
  const invoice = await db.invoice.findUnique({ where: { id } });
  if (!invoice) return;

  if (invoice.status !== "draft") {
    throw new Error(
      "Seul un brouillon peut être supprimé. Une facture émise doit être annulée par une note de crédit et conservée 10 ans.",
    );
  }

  await db.invoice.delete({ where: { id } });
  await logActivity("invoice.delete", `Brouillon ${invoice.number} supprimé`, "invoice", id);

  revalidatePath("/factures");
  redirect("/factures");
}

/** Établit une note de crédit annulant une facture émise. */
export async function createCreditNote(id: string) {
  await requireSession();

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!invoice) throw new Error("Facture introuvable");

  const settings = await getSettings();
  const number = await nextNumber("invoice", settings.invoicePrefix);

  const creditNote = await db.invoice.create({
    data: {
      number,
      clientId: invoice.clientId,
      projectId: invoice.projectId,
      quoteId: invoice.quoteId,
      kind: "credit_note",
      status: "sent",
      issuedAt: new Date(),
      dueAt: new Date(),
      sentAt: new Date(),
      // Montants négatifs : la note de crédit annule la facture d'origine.
      subtotal: -invoice.subtotal,
      discount: -invoice.discount,
      vatRate: invoice.vatRate,
      vatAmount: -invoice.vatAmount,
      total: -invoice.total,
      notes: `Note de crédit annulant la facture ${invoice.number}.`,
      publicToken: randomToken(28),
      items: {
        create: invoice.items.map((item, index) => ({
          label: item.label,
          description: item.description,
          quantity: item.quantity,
          unitPrice: -item.unitPrice,
          position: index,
        })),
      },
    },
  });

  await db.invoice.update({ where: { id }, data: { status: "cancelled" } });

  await logActivity(
    "invoice.credit_note",
    `Note de crédit ${number} pour ${invoice.number}`,
    "invoice",
    creditNote.id,
  );

  revalidatePath("/factures");
  redirect(`/factures/${creditNote.id}`);
}
