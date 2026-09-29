"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, getPersonalSettings, logActivity } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { parseCHF } from "@/lib/money";
import { storeFile, removeFile, UploadError } from "@/lib/storage";

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  // Champ absent du formulaire (masqué car sans objet) : même chose qu'un champ vide.
  .default(null);

export interface PersonalState {
  error?: string;
  success?: boolean;
}

/* ───────────────────────── Réglages personnels ───────────────────────── */

const settingsSchema = z.object({
  // AVS
  avsNumber: optionalString,
  avsCaisse: optionalString,
  avsMemberNo: optionalString,
  avsRate: z.coerce.number().min(0).max(30).default(10),
  avsAdminRate: z.coerce.number().min(0).max(10).default(3),
  avsDeclaredIncome: z.string().default("0"),
  // LAMal
  lamalInsurer: optionalString,
  lamalPolicyNo: optionalString,
  lamalPremium: z.string().default("0"),
  lamalFranchise: z.coerce.number().int().default(250000),
  lamalAccident: z.coerce.boolean().default(true),
  lamalSubsidy: z.string().default("0"),
  // Impôts
  taxCanton: optionalString,
  taxCommune: optionalString,
  taxNumber: optionalString,
  taxRate: z.coerce.number().min(0).max(60).default(20),
  // Prévoyance
  pillar3aInsurer: optionalString,
  pillar3aCeiling: z.string().default("0"),
  // Provisions
  provisionAvsPercent: z.coerce.number().min(0).max(50).default(10),
  provisionTaxPercent: z.coerce.number().min(0).max(60).default(20),
});

export async function savePersonalSettings(
  _prev: PersonalState,
  formData: FormData,
): Promise<PersonalState> {
  await requireSession();

  const parsed = settingsSchema.safeParse({
    ...Object.fromEntries(formData.entries()),
    lamalAccident: formData.get("lamalAccident") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }

  const input = parsed.data;

  // Le numéro AVS suisse suit le format 756.XXXX.XXXX.XX
  if (input.avsNumber && !/^756\.?\d{4}\.?\d{4}\.?\d{2}$/.test(input.avsNumber.replace(/\s/g, ""))) {
    return { error: "Numéro AVS invalide — format attendu : 756.1234.5678.90" };
  }

  await db.personalSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      ...input,
      avsDeclaredIncome: parseCHF(input.avsDeclaredIncome),
      lamalPremium: parseCHF(input.lamalPremium),
      lamalSubsidy: parseCHF(input.lamalSubsidy),
      pillar3aCeiling: parseCHF(input.pillar3aCeiling),
    },
    update: {
      ...input,
      avsDeclaredIncome: parseCHF(input.avsDeclaredIncome),
      lamalPremium: parseCHF(input.lamalPremium),
      lamalSubsidy: parseCHF(input.lamalSubsidy),
      pillar3aCeiling: parseCHF(input.pillar3aCeiling),
    },
  });

  await logActivity("personal.settings", "Réglages personnels mis à jour");
  revalidatePath("/perso", "layout");

  return { success: true };
}

/* ─────────────────────────── Échéances ─────────────────────────── */

const obligationSchema = z.object({
  kind: z.string().min(1),
  label: z.string().trim().min(1, "Un libellé est requis"),
  period: optionalString,
  amount: z.string().min(1, "Le montant est requis"),
  dueAt: z.string().min(1, "La date d'échéance est requise"),
  reference: optionalString,
  notes: optionalString,
});

export async function saveObligation(
  _prev: PersonalState,
  formData: FormData,
): Promise<PersonalState> {
  await requireSession();

  const id = String(formData.get("id") ?? "");
  const parsed = obligationSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }

  const input = parsed.data;
  const data = {
    kind: input.kind,
    label: input.label,
    period: input.period,
    amount: parseCHF(input.amount),
    dueAt: new Date(input.dueAt),
    reference: input.reference,
    notes: input.notes,
  };

  if (id) {
    await db.obligation.update({ where: { id }, data });
  } else {
    await db.obligation.create({ data: { ...data, status: "planned" } });
  }

  revalidatePath("/perso", "layout");
  revalidatePath("/tableau-de-bord");
  return { success: true };
}

export async function payObligation(id: string, amount?: number) {
  await requireSession();

  const obligation = await db.obligation.findUnique({ where: { id } });
  if (!obligation) return;

  const paid = amount ?? obligation.amount;
  await db.obligation.update({
    where: { id },
    data: {
      paidAt: new Date(),
      paidAmount: paid,
      status: paid >= obligation.amount ? "paid" : "due",
    },
  });

  await logActivity("obligation.paid", `Échéance payée : ${obligation.label}`);
  revalidatePath("/perso", "layout");
  revalidatePath("/tableau-de-bord");
}

export async function deleteObligation(id: string) {
  await requireSession();
  await db.obligation.delete({ where: { id } });
  revalidatePath("/perso", "layout");
}

/**
 * Génère l'échéancier d'une année.
 *
 * AVS : quatre acomptes trimestriels (usage le plus courant pour un indépendant).
 * LAMal : douze primes mensuelles.
 * Impôts : le nombre de tranches varie selon le canton, d'où le paramètre.
 */
export async function generateSchedule(
  kind: "avs" | "lamal" | "tax",
  year: number,
  installments: number,
) {
  await requireSession();
  const settings = await getPersonalSettings();

  // On ne réécrit jamais par-dessus : seules les échéances manquantes sont créées.
  const existing = await db.obligation.findMany({
    where: { kind, period: { startsWith: String(year) } },
    select: { period: true },
  });
  const done = new Set(existing.map((o) => o.period));

  let totalCents = 0;
  let labelPrefix = "";

  if (kind === "avs") {
    const base = settings.avsDeclaredIncome;
    const contributions = Math.round((base * settings.avsRate) / 100);
    const adminFees = Math.round((contributions * settings.avsAdminRate) / 100);
    totalCents = contributions + adminFees;
    labelPrefix = "Acompte AVS/AI/APG";
  } else if (kind === "lamal") {
    totalCents = Math.max(0, settings.lamalPremium - settings.lamalSubsidy) * 12;
    labelPrefix = "Prime assurance maladie";
  } else {
    const base = settings.avsDeclaredIncome;
    totalCents = Math.round((base * settings.taxRate) / 100);
    labelPrefix = "Acompte d'impôts";
  }

  if (totalCents <= 0) {
    return { error: "Renseigne d'abord le revenu ou la prime dans les réglages." };
  }

  const perInstallment = Math.round(totalCents / installments);
  const created: { kind: string; label: string; period: string; amount: number; dueAt: Date; status: string; autoGenerated: boolean }[] = [];

  for (let index = 0; index < installments; index++) {
    // Réparti sur l'année : une échéance au milieu de chaque période.
    const month = Math.round(((index + 1) * 12) / installments) - 1;
    const period =
      installments === 12
        ? `${year}-${String(month + 1).padStart(2, "0")}`
        : installments === 4
          ? `${year}-T${index + 1}`
          : `${year}-${index + 1}`;

    if (done.has(period)) continue;

    created.push({
      kind,
      label: `${labelPrefix} ${period}`,
      period,
      // La dernière tranche absorbe l'écart d'arrondi.
      amount:
        index === installments - 1
          ? totalCents - perInstallment * (installments - 1)
          : perInstallment,
      dueAt: new Date(year, month, 28),
      status: "planned",
      autoGenerated: true,
    });
  }

  if (created.length === 0) {
    return { error: "Toutes les échéances de cette année existent déjà." };
  }

  await db.obligation.createMany({ data: created });
  await logActivity("obligation.schedule", `${created.length} échéances générées (${kind})`);

  revalidatePath("/perso", "layout");
  return { success: true, count: created.length };
}

/* ───────────────────────── Frais médicaux ───────────────────────── */

const healthCostSchema = z.object({
  date: z.string().min(1, "La date est requise"),
  provider: z.string().trim().min(1, "Le prestataire est requis"),
  description: optionalString,
  amount: z.string().min(1, "Le montant est requis"),
  reimbursed: z.string().default("0"),
});

export async function saveHealthCost(
  _prev: PersonalState,
  formData: FormData,
): Promise<PersonalState> {
  await requireSession();

  const parsed = healthCostSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }

  const input = parsed.data;
  const amount = parseCHF(input.amount);
  const settings = await getPersonalSettings();

  // Répartition franchise / quote-part sur l'année civile en cours.
  const date = new Date(input.date);
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const yearEnd = new Date(date.getFullYear(), 11, 31, 23, 59, 59);

  const previous = await db.healthCost.aggregate({
    _sum: { appliedToFranchise: true, appliedToCoinsurance: true },
    where: { date: { gte: yearStart, lte: yearEnd } },
  });

  const franchiseUsed = previous._sum.appliedToFranchise ?? 0;
  const coinsuranceUsed = previous._sum.appliedToCoinsurance ?? 0;

  // Tant que la franchise n'est pas atteinte, tout reste à ta charge.
  const franchiseRemaining = Math.max(0, settings.lamalFranchise - franchiseUsed);
  const appliedToFranchise = Math.min(amount, franchiseRemaining);

  // Au-delà : quote-part de 10 %, plafonnée à CHF 700 par an.
  const beyondFranchise = amount - appliedToFranchise;
  const coinsuranceRemaining = Math.max(0, settings.lamalCoinsuranceCap - coinsuranceUsed);
  const appliedToCoinsurance = Math.min(
    Math.round(beyondFranchise * 0.1),
    coinsuranceRemaining,
  );

  let attachmentUrl: string | null = null;
  const file = formData.get("attachment");
  if (file instanceof File && file.size > 0) {
    try {
      const stored = await storeFile(file, "sante", { allowPdf: true });
      attachmentUrl = stored.url;
    } catch (error) {
      return {
        error:
          error instanceof UploadError
            ? error.message
            : "Le justificatif n'a pas pu être enregistré.",
      };
    }
  }

  await db.healthCost.create({
    data: {
      date,
      provider: input.provider,
      description: input.description,
      amount,
      reimbursed: parseCHF(input.reimbursed),
      appliedToFranchise,
      appliedToCoinsurance,
      attachmentUrl,
    },
  });

  revalidatePath("/perso/assurance");
  return { success: true };
}

export async function deleteHealthCost(id: string) {
  await requireSession();
  const cost = await db.healthCost.findUnique({ where: { id } });
  if (cost?.attachmentUrl) await removeFile(cost.attachmentUrl);
  await db.healthCost.delete({ where: { id } });
  revalidatePath("/perso/assurance");
}
