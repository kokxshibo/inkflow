"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, getSettings, logActivity, nextNumber } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { computeTotals, computeDeposit, parseCHF } from "@/lib/money";
import { randomToken } from "@/lib/utils";

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  // Champ absent du formulaire (masqué car sans objet) : même chose qu'un champ vide.
  .default(null);

const quoteSchema = z.object({
  clientId: z.string().min(1, "Sélectionne un client"),
  projectId: optionalString,
  issuedAt: z.string().min(1),
  validUntil: z.string().min(1),
  discount: optionalString,
  depositPercent: z.coerce.number().min(0).max(100).default(30),
  notes: optionalString,
  terms: optionalString,
});

export interface QuoteState {
  error?: string;
}

interface LineInput {
  label: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
}

/** Les lignes arrivent sous forme de tableaux parallèles depuis le formulaire. */
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

export async function saveQuote(
  _prev: QuoteState,
  formData: FormData,
): Promise<QuoteState> {
  await requireSession();

  const id = String(formData.get("id") ?? "");
  const parsed = quoteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }

  const lines = readLines(formData);
  if (lines.length === 0) {
    return { error: "Ajoute au moins une ligne de prestation." };
  }

  const settings = await getSettings();
  // Sans assujettissement, aucune TVA n'est appliquée ni affichée.
  const vatRate = settings.vatEnabled ? settings.vatRate : 0;

  const input = parsed.data;
  const totals = computeTotals(lines, parseCHF(input.discount ?? "0"), vatRate);
  const depositAmount = computeDeposit(totals.total, input.depositPercent);

  const data = {
    clientId: input.clientId,
    projectId: input.projectId,
    issuedAt: new Date(input.issuedAt),
    validUntil: new Date(input.validUntil),
    subtotal: totals.subtotal,
    discount: totals.discount,
    vatRate: totals.vatRate,
    vatAmount: totals.vatAmount,
    total: totals.total,
    depositAmount,
    notes: input.notes,
    terms: input.terms,
  };

  let quoteId = id;

  if (id) {
    const existing = await db.quote.findUnique({ where: { id } });
    if (!existing) return { error: "Devis introuvable." };
    if (existing.status === "accepted") {
      return { error: "Un devis accepté ne peut plus être modifié." };
    }

    await db.$transaction([
      db.quoteItem.deleteMany({ where: { quoteId: id } }),
      db.quote.update({ where: { id }, data }),
      db.quoteItem.createMany({
        data: lines.map((line, index) => ({ ...line, quoteId: id, position: index })),
      }),
    ]);
    await logActivity("quote.update", `Devis ${existing.number} mis à jour`, "quote", id);
  } else {
    const number = await nextNumber("quote", settings.quotePrefix);
    const created = await db.quote.create({
      data: {
        ...data,
        number,
        status: "draft",
        publicToken: randomToken(28),
        items: {
          create: lines.map((line, index) => ({ ...line, position: index })),
        },
      },
    });
    quoteId = created.id;
    await logActivity("quote.create", `Devis ${number} créé`, "quote", created.id);
  }

  revalidatePath("/devis");
  revalidatePath(`/clients/${input.clientId}`);
  redirect(`/devis/${quoteId}`);
}

export async function sendQuote(id: string) {
  await requireSession();
  const quote = await db.quote.update({
    where: { id },
    data: { status: "sent", sentAt: new Date() },
  });

  if (quote.projectId) {
    await db.project.updateMany({
      where: { id: quote.projectId, status: { in: ["idea"] } },
      data: { status: "quoted" },
    });
  }

  await logActivity("quote.send", `Devis ${quote.number} marqué comme envoyé`, "quote", id);
  revalidatePath(`/devis/${id}`);
  revalidatePath("/devis");
}

export async function setQuoteStatus(id: string, status: string) {
  await requireSession();
  const quote = await db.quote.update({
    where: { id },
    data: {
      status,
      acceptedAt: status === "accepted" ? new Date() : null,
    },
  });

  if (status === "accepted" && quote.projectId) {
    await db.project.update({
      where: { id: quote.projectId },
      data: { status: "accepted" },
    });
  }

  await logActivity("quote.status", `Devis ${quote.number} : ${status}`, "quote", id);
  revalidatePath(`/devis/${id}`);
  revalidatePath("/devis");
}

export async function deleteQuote(id: string) {
  await requireSession();
  const quote = await db.quote.findUnique({ where: { id } });
  if (!quote) return;

  if (quote.status === "accepted") {
    throw new Error("Un devis accepté ne peut pas être supprimé.");
  }

  await db.quote.delete({ where: { id } });
  await logActivity("quote.delete", `Devis ${quote.number} supprimé`, "quote", id);

  revalidatePath("/devis");
  redirect("/devis");
}
