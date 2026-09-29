"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { db, logActivity } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { parseCHF } from "@/lib/money";
import { randomToken } from "@/lib/utils";

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  // Champ absent du formulaire (masqué car sans objet) : même chose qu'un champ vide.
  .default(null);

const projectSchema = z.object({
  clientId: z.string().min(1, "Sélectionne un client"),
  title: z.string().trim().min(1, "Le titre est requis"),
  description: optionalString,
  bodyZone: optionalString,
  widthCm: optionalString,
  heightCm: optionalString,
  style: optionalString,
  colorMode: z.string().default("blackgrey"),
  kind: z.string().default("new"),
  status: z.string().default("idea"),
  estimatedSessions: z.coerce.number().int().min(1).max(50).default(1),
  estimatedPrice: optionalString,
  finalPrice: optionalString,
});

export interface ProjectFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

function toData(input: z.infer<typeof projectSchema>) {
  return {
    clientId: input.clientId,
    title: input.title,
    description: input.description,
    bodyZone: input.bodyZone,
    widthCm: input.widthCm ? Number.parseFloat(input.widthCm.replace(",", ".")) : null,
    heightCm: input.heightCm ? Number.parseFloat(input.heightCm.replace(",", ".")) : null,
    style: input.style,
    colorMode: input.colorMode,
    kind: input.kind,
    status: input.status,
    estimatedSessions: input.estimatedSessions,
    estimatedPrice: input.estimatedPrice ? parseCHF(input.estimatedPrice) : null,
    finalPrice: input.finalPrice ? parseCHF(input.finalPrice) : null,
  };
}

function collectErrors(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]);
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

export async function createProject(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  await requireSession();

  const parsed = projectSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: "Certains champs sont invalides.", fieldErrors: collectErrors(parsed.error) };
  }

  const project = await db.project.create({ data: toData(parsed.data) });

  // Un client qui a un projet n'est plus un simple prospect
  await db.client.updateMany({
    where: { id: parsed.data.clientId, status: "prospect" },
    data: { status: "active" },
  });

  await logActivity("project.create", `Projet créé : ${project.title}`, "project", project.id);

  revalidatePath("/projets");
  revalidatePath(`/clients/${parsed.data.clientId}`);
  redirect(`/projets/${project.id}`);
}

export async function updateProject(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  await requireSession();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Projet introuvable." };

  const parsed = projectSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: "Certains champs sont invalides.", fieldErrors: collectErrors(parsed.error) };
  }

  await db.project.update({ where: { id }, data: toData(parsed.data) });
  await logActivity("project.update", "Projet mis à jour", "project", id);

  revalidatePath("/projets");
  revalidatePath(`/projets/${id}`);
  redirect(`/projets/${id}`);
}

export async function setProjectStatus(id: string, status: string) {
  await requireSession();
  const project = await db.project.update({ where: { id }, data: { status } });
  await logActivity("project.status", `Statut : ${status}`, "project", id);
  revalidatePath(`/projets/${id}`);
  revalidatePath("/projets");
  revalidatePath(`/clients/${project.clientId}`);
}

export async function deleteProject(id: string) {
  await requireSession();
  const project = await db.project.findUnique({ where: { id } });
  if (!project) return;

  await db.project.delete({ where: { id } });
  await logActivity("project.delete", `Projet supprimé : ${project.title}`, "project", id);

  revalidatePath("/projets");
  revalidatePath(`/clients/${project.clientId}`);
  redirect("/projets");
}

/* ─────────────────────────── Images ─────────────────────────── */

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_SIZE = 8 * 1024 * 1024; // 8 Mo

export async function uploadProjectImage(formData: FormData) {
  await requireSession();

  const projectId = String(formData.get("projectId") ?? "");
  const kind = String(formData.get("kind") ?? "reference");
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);

  if (!projectId || files.length === 0) {
    return { error: "Aucun fichier reçu." };
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", projectId);
  await mkdir(uploadDir, { recursive: true });

  let saved = 0;
  for (const file of files) {
    if (file.size === 0) continue;
    if (!ALLOWED_TYPES.includes(file.type)) continue;
    if (file.size > MAX_SIZE) continue;

    const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const filename = `${randomToken(16)}.${extension}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, filename), buffer);

    await db.projectImage.create({
      data: { projectId, kind, url: `/uploads/${projectId}/${filename}` },
    });
    saved++;
  }

  revalidatePath(`/projets/${projectId}`);

  if (saved === 0) {
    return { error: "Aucune image valide (JPG, PNG, WebP ou AVIF, 8 Mo maximum)." };
  }
  return { success: saved };
}

export async function deleteProjectImage(imageId: string) {
  await requireSession();
  const image = await db.projectImage.findUnique({ where: { id: imageId } });
  if (!image) return;

  await db.projectImage.delete({ where: { id: imageId } });
  revalidatePath(`/projets/${image.projectId}`);
}
