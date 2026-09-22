"use server";

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { db, getSettings, logActivity } from "@/lib/db";
import { randomToken } from "@/lib/utils";

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable();

const requestSchema = z.object({
  firstName: z.string().trim().min(1, "Ton prénom est requis"),
  lastName: z.string().trim().min(1, "Ton nom est requis"),
  email: z.string().trim().email("Adresse e-mail invalide"),
  phone: optionalString,
  instagram: optionalString,
  birthDate: optionalString,
  description: z
    .string()
    .trim()
    .min(20, "Décris ton projet en quelques phrases (20 caractères minimum)"),
  bodyZone: optionalString,
  sizeCm: optionalString,
  colorMode: z.string().default("blackgrey"),
  style: optionalString,
  budget: optionalString,
  availability: optionalString,
  isAdult: z.literal("on", {
    errorMap: () => ({ message: "Tu dois être majeur·e pour te faire tatouer" }),
  }),
  consentGiven: z.literal("on", {
    errorMap: () => ({ message: "Ton accord est nécessaire pour traiter ta demande" }),
  }),
  hasContraindications: z.coerce.boolean().default(false),
  contraindications: optionalString,
  // Champ piège anti-robot : doit rester vide
  website: z.string().max(0).optional().or(z.literal("")),
});

export interface RequestFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_SIZE = 8 * 1024 * 1024;
const MAX_FILES = 6;

export async function submitRequest(
  _prev: RequestFormState,
  formData: FormData,
): Promise<RequestFormState> {
  // Piège anti-robot : si le champ caché est rempli, on fait semblant d'accepter
  // pour ne pas révéler au robot que sa soumission a été écartée.
  const honeypot = formData.get("website");
  if (typeof honeypot === "string" && honeypot.length > 0) {
    return { success: true };
  }

  const raw = {
    ...Object.fromEntries(formData.entries()),
    hasContraindications: formData.get("hasContraindications") === "on",
  };

  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Certains champs doivent être corrigés.", fieldErrors };
  }

  const input = parsed.data;

  // Enregistrement des images de référence
  const files = formData
    .getAll("references")
    .filter((file): file is File => file instanceof File && file.size > 0)
    .slice(0, MAX_FILES);

  const referenceUrls: string[] = [];
  if (files.length > 0) {
    const folder = randomToken(12);
    const uploadDir = path.join(process.cwd(), "public", "uploads", "demandes", folder);
    await mkdir(uploadDir, { recursive: true });

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type) || file.size > MAX_SIZE) continue;
      const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
      const filename = `${randomToken(16)}.${extension}`;
      await writeFile(
        path.join(uploadDir, filename),
        Buffer.from(await file.arrayBuffer()),
      );
      referenceUrls.push(`/uploads/demandes/${folder}/${filename}`);
    }
  }

  await db.projectRequest.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email.toLowerCase(),
      phone: input.phone,
      instagram: input.instagram?.replace(/^@/, "") ?? null,
      birthDate: input.birthDate ? new Date(input.birthDate) : null,
      description: input.description,
      bodyZone: input.bodyZone,
      sizeCm: input.sizeCm,
      colorMode: input.colorMode,
      style: input.style,
      budget: input.budget,
      availability: input.availability,
      isAdult: true,
      hasContraindications: input.hasContraindications,
      contraindications: input.contraindications,
      referenceUrls: JSON.stringify(referenceUrls),
      consentGiven: true,
      status: "new",
    },
  });

  await logActivity(
    "request.received",
    `Nouvelle demande de ${input.firstName} ${input.lastName}`,
  );

  return { success: true };
}

export async function getStudioName() {
  const settings = await getSettings();
  return settings.studioName;
}
