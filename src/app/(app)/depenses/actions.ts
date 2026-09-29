"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, getSettings, logActivity } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { parseCHF } from "@/lib/money";
import { splitGrossAmount } from "@/lib/swiss-qr";
import { storeFile, removeFile, UploadError } from "@/lib/storage";

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  // Champ absent du formulaire (masqué car sans objet) : même chose qu'un champ vide.
  .default(null);

const expenseSchema = z.object({
  supplier: z.string().trim().min(1, "Le nom du fournisseur est requis"),
  category: z.string().default("supplies"),
  label: optionalString,
  amountGross: z.string().min(1, "Le montant est requis"),
  vatRate: z.coerce.number().min(0).max(30).default(0),
  vatDeductible: z.coerce.boolean().default(false),
  issuedAt: z.string().min(1, "La date est requise"),
  dueAt: optionalString,
  paidAt: optionalString,
  status: z.string().default("to_pay"),
  paymentMethod: optionalString,
  invoiceNumber: optionalString,
  creditorIban: optionalString,
  creditorName: optionalString,
  qrReference: optionalString,
  scannedFromQr: z.coerce.boolean().default(false),
  recurrenceMonths: optionalString,
  notes: optionalString,
});

export interface ExpenseState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

function collectErrors(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]);
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

export async function saveExpense(
  _prev: ExpenseState,
  formData: FormData,
): Promise<ExpenseState> {
  await requireSession();

  const id = String(formData.get("id") ?? "");
  const parsed = expenseSchema.safeParse({
    ...Object.fromEntries(formData.entries()),
    vatDeductible: formData.get("vatDeductible") === "on",
    scannedFromQr: formData.get("scannedFromQr") === "on",
  });

  if (!parsed.success) {
    return {
      error: "Certains champs sont invalides.",
      fieldErrors: collectErrors(parsed.error),
    };
  }

  const input = parsed.data;
  const settings = await getSettings();

  const amountGross = parseCHF(input.amountGross);
  if (amountGross <= 0) {
    return {
      error: "Le montant doit être supérieur à zéro.",
      fieldErrors: { amountGross: "Montant invalide" },
    };
  }

  // L'impôt préalable n'est récupérable que si l'activité est assujettie à la TVA.
  const vatDeductible = settings.vatEnabled && input.vatDeductible;
  const { net, vat } = splitGrossAmount(amountGross, input.vatRate);

  // Pièce jointe : photo ou PDF de la facture fournisseur
  const file = formData.get("attachment");
  let attachment: { url: string; name: string; type: string } | null = null;

  if (file instanceof File && file.size > 0) {
    try {
      const stored = await storeFile(file, "depenses", { allowPdf: true });
      attachment = { url: stored.url, name: stored.name, type: stored.contentType };
    } catch (error) {
      return {
        error:
          error instanceof UploadError
            ? error.message
            : "Le justificatif n'a pas pu être enregistré.",
      };
    }
  }

  // Version numérisée par l'IA (scanner) : gardée telle quelle si c'est bien du JSON.
  const scanRaw = String(formData.get("scanData") ?? "");
  let scanData: string | null = null;
  if (scanRaw && scanRaw.length <= 200_000) {
    try {
      JSON.parse(scanRaw);
      scanData = scanRaw;
    } catch {
      scanData = null;
    }
  }

  const paidAt = input.paidAt ? new Date(input.paidAt) : null;
  const data = {
    supplier: input.supplier,
    category: input.category,
    label: input.label,
    amountGross,
    vatRate: input.vatRate,
    vatAmount: vat,
    amountNet: net,
    vatDeductible,
    issuedAt: new Date(input.issuedAt),
    dueAt: input.dueAt ? new Date(input.dueAt) : null,
    paidAt,
    // Une dépense avec une date de paiement est forcément réglée.
    status: paidAt ? "paid" : input.status,
    paymentMethod: input.paymentMethod,
    invoiceNumber: input.invoiceNumber,
    creditorIban: input.creditorIban?.replace(/\s/g, "") ?? null,
    creditorName: input.creditorName,
    qrReference: input.qrReference?.replace(/\s/g, "") ?? null,
    scannedFromQr: input.scannedFromQr,
    recurrenceMonths: input.recurrenceMonths
      ? Number.parseInt(input.recurrenceMonths, 10)
      : null,
    notes: input.notes,
    ...(scanData ? { scanData } : {}),
    ...(attachment
      ? {
          attachmentUrl: attachment.url,
          attachmentName: attachment.name,
          attachmentType: attachment.type,
        }
      : {}),
  };

  let expenseId = id;

  if (id) {
    const existing = await db.expense.findUnique({ where: { id } });
    if (!existing) return { error: "Dépense introuvable." };

    // Un nouveau justificatif remplace l'ancien : on nettoie le stockage.
    if (attachment && existing.attachmentUrl) {
      await removeFile(existing.attachmentUrl);
    }
    await db.expense.update({ where: { id }, data });
    await logActivity("expense.update", `Dépense ${input.supplier}`, "expense", id);
  } else {
    const created = await db.expense.create({ data });
    expenseId = created.id;
    await logActivity(
      "expense.create",
      `Dépense enregistrée : ${input.supplier}`,
      "expense",
      created.id,
    );
  }

  revalidatePath("/depenses");
  revalidatePath("/tableau-de-bord");
  redirect(`/depenses/${expenseId}`);
}

export async function markExpensePaid(id: string, method: string) {
  await requireSession();
  await db.expense.update({
    where: { id },
    data: { status: "paid", paidAt: new Date(), paymentMethod: method },
  });
  await logActivity("expense.paid", "Dépense marquée payée", "expense", id);
  revalidatePath("/depenses");
  revalidatePath(`/depenses/${id}`);
  revalidatePath("/tableau-de-bord");
}

export async function setExpenseStatus(id: string, status: string) {
  await requireSession();
  await db.expense.update({
    where: { id },
    data: { status, paidAt: status === "paid" ? new Date() : null },
  });
  revalidatePath("/depenses");
  revalidatePath(`/depenses/${id}`);
}

export async function deleteExpense(id: string) {
  await requireSession();
  const expense = await db.expense.findUnique({ where: { id } });
  if (!expense) return;

  if (expense.attachmentUrl) await removeFile(expense.attachmentUrl);
  await db.expense.delete({ where: { id } });
  await logActivity("expense.delete", `Dépense supprimée : ${expense.supplier}`);

  revalidatePath("/depenses");
  redirect("/depenses");
}

/**
 * Duplique une charge récurrente sur l'échéance suivante.
 * Pratique pour le loyer ou les abonnements.
 */
export async function duplicateExpense(id: string) {
  await requireSession();
  const source = await db.expense.findUnique({ where: { id } });
  if (!source) return;

  const months = source.recurrenceMonths ?? 1;
  const issuedAt = new Date(source.issuedAt);
  issuedAt.setMonth(issuedAt.getMonth() + months);

  const dueAt = source.dueAt ? new Date(source.dueAt) : null;
  if (dueAt) dueAt.setMonth(dueAt.getMonth() + months);

  const created = await db.expense.create({
    data: {
      supplier: source.supplier,
      category: source.category,
      label: source.label,
      amountGross: source.amountGross,
      vatRate: source.vatRate,
      vatAmount: source.vatAmount,
      amountNet: source.amountNet,
      vatDeductible: source.vatDeductible,
      issuedAt,
      dueAt,
      status: "to_pay",
      paymentMethod: source.paymentMethod,
      creditorIban: source.creditorIban,
      creditorName: source.creditorName,
      recurrenceMonths: source.recurrenceMonths,
      notes: source.notes,
    },
  });

  revalidatePath("/depenses");
  redirect(`/depenses/${created.id}`);
}
