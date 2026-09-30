"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { db, logActivity } from "@/lib/db";
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
    // Emplacement écrit librement par le client (« intérieur du poignet gauche »).
    bodyZone: z
      .string()
      .trim()
      .max(120, errors.bodyZone)
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .default(null),
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
const MAX_BODY_PHOTOS = 3;
const MAX_REFERENCES = 6;

/** Enregistre les images valides d'un champ du formulaire et renvoie leurs adresses. */
async function storeImages(entries: FormDataEntryValue[], max: number, folder: string) {
  const files = entries
    .filter((file): file is File => file instanceof File && file.size > 0)
    .filter((file) => ALLOWED_TYPES.includes(file.type) && file.size <= MAX_SIZE)
    .slice(0, max);

  const urls: string[] = [];
  for (const file of files) {
    const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    urls.push(
      await storeBuffer(Buffer.from(await file.arrayBuffer()), folder, `${randomToken(16)}.${extension}`),
    );
  }
  return urls;
}

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

  // Photos de la zone à tatouer, puis images d'inspiration, dans un même dossier.
  const folder = `demandes/${randomToken(12)}`;
  const bodyPhotoUrls = await storeImages(formData.getAll("bodyPhotos"), MAX_BODY_PHOTOS, folder);
  const referenceUrls = await storeImages(formData.getAll("references"), MAX_REFERENCES, folder);

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
      bodyPhotoUrls: JSON.stringify(bodyPhotoUrls),
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
