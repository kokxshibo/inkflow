"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, logActivity } from "@/lib/db";
import { requireSession, hashPassword, verifyCredentials } from "@/lib/auth";
import { parseCHF, isValidIban, isQrIban } from "@/lib/money";

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable();

const settingsSchema = z.object({
  studioName: z.string().trim().min(1, "Le nom du salon est requis"),
  ownerName: z.string().trim().default(""),
  tagline: optionalString,
  addressLine: z.string().trim().default(""),
  postalCode: z.string().trim().default(""),
  city: z.string().trim().default(""),
  canton: optionalString,
  country: z.string().default("CH"),
  email: z.string().trim().default(""),
  phone: optionalString,
  website: optionalString,
  instagram: optionalString,

  ide: optionalString,
  legalForm: z.string().default("individual"),

  vatEnabled: z.coerce.boolean().default(false),
  vatRate: z.coerce.number().min(0).max(30).default(8.1),
  vatMethod: z.string().default("effective"),

  bankName: optionalString,
  iban: optionalString,
  qrIban: optionalString,

  quotePrefix: z.string().trim().default("DEV"),
  invoicePrefix: z.string().trim().default("FAC"),
  quoteValidityDays: z.coerce.number().int().min(1).max(365).default(30),
  paymentTermDays: z.coerce.number().int().min(0).max(365).default(30),
  depositPercent: z.coerce.number().int().min(0).max(100).default(30),
  hourlyRate: z.string().default("150"),
  minimumPrice: z.string().default("150"),

  emailSignature: optionalString,
  googleReviewUrl: optionalString,
  aftercareUrl: optionalString,
});

export interface SettingsState {
  error?: string;
  success?: boolean;
  fieldErrors?: Record<string, string>;
}

export async function saveSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireSession();

  const parsed = settingsSchema.safeParse({
    ...Object.fromEntries(formData.entries()),
    vatEnabled: formData.get("vatEnabled") === "on",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Certains champs sont invalides.", fieldErrors };
  }

  const input = parsed.data;
  const fieldErrors: Record<string, string> = {};

  // Validation des IBAN (mod 97)
  if (input.iban && !isValidIban(input.iban)) {
    fieldErrors.iban = "IBAN invalide — vérifie la saisie.";
  }
  if (input.qrIban) {
    if (!isValidIban(input.qrIban)) {
      fieldErrors.qrIban = "QR-IBAN invalide — vérifie la saisie.";
    } else if (!isQrIban(input.qrIban)) {
      fieldErrors.qrIban =
        "Ce n'est pas un QR-IBAN (l'identifiant d'institution doit être compris entre 30000 et 31999). Utilise le champ IBAN standard.";
    }
  }
  if (input.ide && !/^CHE-?\d{3}\.?\d{3}\.?\d{3}$/i.test(input.ide.replace(/\s/g, ""))) {
    fieldErrors.ide = "Format attendu : CHE-123.456.789";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Corrige les champs signalés.", fieldErrors };
  }

  await db.settings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      ...input,
      hourlyRate: parseCHF(input.hourlyRate),
      minimumPrice: parseCHF(input.minimumPrice),
    },
    update: {
      ...input,
      hourlyRate: parseCHF(input.hourlyRate),
      minimumPrice: parseCHF(input.minimumPrice),
    },
  });

  await logActivity("settings.update", "Réglages mis à jour");

  revalidatePath("/reglages");
  revalidatePath("/", "layout");

  return { success: true };
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Mot de passe actuel requis"),
    next: z.string().min(10, "10 caractères minimum"),
    confirm: z.string(),
  })
  .refine((data) => data.next === data.confirm, {
    message: "Les deux mots de passe ne correspondent pas",
    path: ["confirm"],
  });

export async function changePassword(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const session = await requireSession();

  const parsed = passwordSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }

  const user = await verifyCredentials(session.email, parsed.data.current);
  if (!user) {
    return { error: "Le mot de passe actuel est incorrect." };
  }

  await db.user.update({
    where: { id: session.userId },
    data: { passwordHash: await hashPassword(parsed.data.next) },
  });

  await logActivity("auth.password", "Mot de passe modifié", "user", session.userId);

  return { success: true };
}
