"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db, logActivity } from "@/lib/db";
import { requireSession } from "@/lib/auth";

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  // Champ absent du formulaire (masqué car sans objet) : même chose qu'un champ vide.
  .default(null);

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
    email: input.email?.toLowerCase() ?? null,
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
    conditions.length > 0 ||
    parsed.data.pregnant ||
    parsed.data.keloidProne;
  // Question posée et réponse « rien à signaler » : c'est aussi une information datée.
  const medicalReviewed = formData.get("medicalReviewed") === "on";

  const client = await db.client.create({
    data: {
      ...buildData(parsed.data, conditions),
      medicalUpdatedAt: hasMedical || medicalReviewed ? new Date() : null,
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

/* ─────────────────────────── Doublons ─────────────────────────── */

export interface SimilarClient {
  id: string;
  name: string;
  detail: string;
  reasons: string[];
}

/**
 * Cherche des fiches qui ressemblent au client en cours de saisie :
 * même e-mail, même nom complet ou même numéro de téléphone.
 * Appelée à la fin de la première étape de l'assistant de création.
 */
export async function findSimilarClients(input: {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}): Promise<SimilarClient[]> {
  await requireSession();

  const email = input.email?.trim().toLowerCase();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();

  const criteria: Prisma.ClientWhereInput[] = [];
  if (email) criteria.push({ email: { equals: email, mode: "insensitive" } });
  if (firstName && lastName) {
    criteria.push({
      AND: [
        { firstName: { equals: firstName, mode: "insensitive" } },
        { lastName: { equals: lastName, mode: "insensitive" } },
      ],
    });
  }

  const select = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    phone: true,
  } as const;

  const matches = criteria.length
    ? await db.client.findMany({ where: { OR: criteria }, select, take: 10 })
    : [];

  // Les numéros sont enregistrés avec espaces : on compare les chiffres seuls,
  // sur les 9 derniers pour ignorer l'indicatif (+41, 0041, 0…).
  const phoneTail = (input.phone ?? "").replace(/\D/g, "").slice(-9);
  const byPhone =
    phoneTail.length === 9
      ? (await db.client.findMany({ where: { phone: { not: null } }, select })).filter(
          (client) => (client.phone ?? "").replace(/\D/g, "").endsWith(phoneTail),
        )
      : [];

  const merged = new Map<string, SimilarClient>();
  for (const client of [...matches, ...byPhone]) {
    const reasons: string[] = [];
    if (email && client.email?.toLowerCase() === email) reasons.push("même e-mail");
    if (
      client.firstName.toLowerCase() === firstName.toLowerCase() &&
      client.lastName.toLowerCase() === lastName.toLowerCase()
    ) {
      reasons.push("même nom");
    }
    if (phoneTail.length === 9 && (client.phone ?? "").replace(/\D/g, "").endsWith(phoneTail)) {
      reasons.push("même téléphone");
    }
    if (reasons.length === 0) continue;

    merged.set(client.id, {
      id: client.id,
      name: `${client.firstName} ${client.lastName}`,
      detail: client.email ?? client.phone ?? "Sans coordonnées",
      reasons,
    });
  }

  return Array.from(merged.values()).slice(0, 5);
}
