"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, logActivity } from "@/lib/db";
import { requireSession } from "@/lib/auth";

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable();

const clientSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est requis"),
  lastName: z.string().trim().min(1, "Le nom est requis"),
  email: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .refine(
      (value) => value === null || z.string().email().safeParse(value).success,
      "Adresse e-mail invalide",
    ),
  phone: optionalString,
  instagram: optionalString,
  birthDate: optionalString,
  addressLine: optionalString,
  postalCode: optionalString,
  city: optionalString,
  country: z.string().default("CH"),
  language: z.string().default("fr"),
  source: optionalString,
  status: z.string().default("prospect"),
  notes: optionalString,
  // Médical
  allergies: optionalString,
  medications: optionalString,
  skinType: optionalString,
  medicalNotes: optionalString,
  pregnant: z.coerce.boolean().default(false),
  keloidProne: z.coerce.boolean().default(false),
  imageConsent: z.coerce.boolean().default(false),
  marketingConsent: z.coerce.boolean().default(false),
});

export interface ClientFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

function readForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return {
    ...raw,
    pregnant: formData.get("pregnant") === "on",
    keloidProne: formData.get("keloidProne") === "on",
    imageConsent: formData.get("imageConsent") === "on",
    marketingConsent: formData.get("marketingConsent") === "on",
  };
}

function buildData(
  input: z.infer<typeof clientSchema>,
  conditions: string[],
) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    instagram: input.instagram?.replace(/^@/, "") ?? null,
    birthDate: input.birthDate ? new Date(input.birthDate) : null,
    addressLine: input.addressLine,
    postalCode: input.postalCode,
    city: input.city,
    country: input.country,
    language: input.language,
    source: input.source,
    status: input.status,
    notes: input.notes,
    allergies: input.allergies,
    medications: input.medications,
    skinType: input.skinType,
    medicalNotes: input.medicalNotes,
    pregnant: input.pregnant,
    keloidProne: input.keloidProne,
    conditions: JSON.stringify(conditions),
    imageConsent: input.imageConsent,
    marketingConsent: input.marketingConsent,
  };
}

export async function createClient(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  await requireSession();

  const parsed = clientSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Certains champs sont invalides.", fieldErrors };
  }

  const conditions = formData.getAll("conditions").map(String);
  const hasMedical =
    Boolean(parsed.data.allergies || parsed.data.medications || parsed.data.medicalNotes) ||
    conditions.length > 0;

  const client = await db.client.create({
    data: {
      ...buildData(parsed.data, conditions),
      medicalUpdatedAt: hasMedical ? new Date() : null,
      dataConsentAt: new Date(),
    },
  });

  await logActivity(
    "client.create",
    `Client créé : ${client.firstName} ${client.lastName}`,
    "client",
    client.id,
  );

  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function updateClient(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  await requireSession();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Client introuvable." };

  const parsed = clientSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Certains champs sont invalides.", fieldErrors };
  }

  const conditions = formData.getAll("conditions").map(String);

  await db.client.update({
    where: { id },
    data: { ...buildData(parsed.data, conditions), medicalUpdatedAt: new Date() },
  });

  await logActivity("client.update", `Client mis à jour`, "client", id);

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}

export async function deleteClient(id: string) {
  await requireSession();
  const client = await db.client.findUnique({ where: { id } });
  if (!client) return;

  await db.client.delete({ where: { id } });
  await logActivity(
    "client.delete",
    `Client supprimé : ${client.firstName} ${client.lastName}`,
    "client",
    id,
  );

  revalidatePath("/clients");
  redirect("/clients");
}

export async function verifyIdentity(id: string) {
  await requireSession();
  await db.client.update({
    where: { id },
    data: { identityVerifiedAt: new Date() },
  });
  await logActivity("client.identity", "Identité vérifiée", "client", id);
  revalidatePath(`/clients/${id}`);
}

export async function setClientStatus(id: string, status: string) {
  await requireSession();
  await db.client.update({ where: { id }, data: { status } });
  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
}

/** Export des données d'un client (droit d'accès nLPD / RGPD) */
export async function exportClientData(id: string) {
  await requireSession();
  const client = await db.client.findUnique({
    where: { id },
    include: {
      projects: { include: { images: true } },
      appointments: true,
      quotes: { include: { items: true } },
      invoices: { include: { items: true, payments: true } },
      messages: true,
    },
  });
  await logActivity("client.export", "Export des données (nLPD)", "client", id);
  return JSON.stringify(client, null, 2);
}
