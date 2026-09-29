"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { db, getSettings, logActivity } from "@/lib/db";
import { REF_COOKIE } from "@/lib/leads";
import { storeBuffer } from "@/lib/storage";
import { randomToken } from "@/lib/utils";
import { dictionary, parseLang, type Lang } from "./i18n";

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  // Champ absent du formulaire (masqué car sans objet) : même chose qu'un champ vide.
  .default(null);

/** Messages d'erreur dans la langue choisie sur le formulaire. */
function requestSchema(lang: Lang) {
  const errors = dictionary(lang).errors;
  return z.object({
    firstName: z.string().trim().min(1, errors.firstName),
    lastName: z.string().trim().min(1, errors.lastName),
    email: z.string().trim().email(errors.email),
    phone: optionalString,
    instagram: optionalString,
    birthDate: optionalString,
    description: z.string().trim().min(20, errors.description),
    bodyZone: optionalString,
    sizeCm: optionalString,
    colorMode: z.string().default("blackgrey"),
    style: optionalString,
    budget: optionalString,
    availability: optionalString,
    isAdult: z.literal("on", { errorMap: () => ({ message: errors.isAdult }) }),
    consentGiven: z.literal("on", { errorMap: () => ({ message: errors.consentGiven }) }),
    hasContraindications: z.coerce.boolean().default(false),
    contraindications: optionalString,
    // Champ piège anti-robot : doit rester vide
    website: z.string().max(0).optional().or(z.literal("")),
  });
}

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

  const lang = parseLang(formData.get("lang"));
  const parsed = requestSchema(lang).safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: dictionary(lang).errors.general, fieldErrors };
  }

  const input = parsed.data;

  // Enregistrement des images de référence
  const files = formData
    .getAll("references")
    .filter((file): file is File => file instanceof File && file.size > 0)
    .slice(0, MAX_FILES);

  const referenceUrls: string[] = [];
  if (files.length > 0) {
    const folder = `demandes/${randomToken(12)}`;
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type) || file.size > MAX_SIZE) continue;
      const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
      referenceUrls.push(
        await storeBuffer(
          Buffer.from(await file.arrayBuffer()),
          folder,
          `${randomToken(16)}.${extension}`,
        ),
      );
    }
  }

  // Arrivé par un lien perso (Instagram / Gmail) : la demande rejoint le contact.
  const refToken = String(formData.get("ref") ?? "") || (await cookies()).get(REF_COOKIE)?.value;
  const lead =
    refToken && /^[a-z0-9]{6,32}$/.test(refToken)
      ? await db.lead.findUnique({ where: { token: refToken } })
      : null;

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
      source: lead ? lead.channel : "direct",
      language: lang,
      leadId: lead?.id ?? null,
    },
  });

  // Un contact Instagram n'avait pas encore d'adresse e-mail : on la retient.
  if (lead && !lead.email) {
    await db.lead.update({ where: { id: lead.id }, data: { email: input.email.toLowerCase() } });
  }

  await logActivity(
    "request.received",
    `Nouvelle demande de ${input.firstName} ${input.lastName}${
      lead ? (lead.channel === "instagram" ? " (via Instagram)" : " (via Gmail)") : ""
    }`,
  );

  return { success: true };
}

export async function getStudioName() {
  const settings = await getSettings();
  return settings.studioName;
}
