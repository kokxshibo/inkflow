"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, logActivity } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function setRequestStatus(id: string, status: string) {
  await requireSession();
  await db.projectRequest.update({
    where: { id },
    data: { status, handledAt: status === "new" ? null : new Date() },
  });
  revalidatePath("/demandes");
  revalidatePath(`/demandes/${id}`);
  revalidatePath("/tableau-de-bord");
}

export async function deleteRequest(id: string) {
  await requireSession();
  await db.projectRequest.delete({ where: { id } });
  revalidatePath("/demandes");
  redirect("/demandes");
}

/**
 * Transforme une demande en fiche client + projet.
 * Si un client existe déjà avec la même adresse e-mail, il est réutilisé.
 */
export async function convertRequest(id: string) {
  await requireSession();

  const request = await db.projectRequest.findUnique({ where: { id } });
  if (!request) throw new Error("Demande introuvable");
  if (request.clientId && request.projectId) {
    redirect(`/projets/${request.projectId}`);
  }

  const existing = await db.client.findFirst({
    where: { email: request.email },
  });

  const client =
    existing ??
    (await db.client.create({
      data: {
        firstName: request.firstName,
        lastName: request.lastName,
        email: request.email,
        phone: request.phone,
        instagram: request.instagram?.replace(/^@/, "") ?? null,
        birthDate: request.birthDate,
        source: "website",
        status: "prospect",
        medicalNotes: request.hasContraindications ? request.contraindications : null,
        medicalUpdatedAt: request.hasContraindications ? new Date() : null,
        dataConsentAt: request.consentGiven ? request.createdAt : null,
      },
    }));

  // La taille arrive sous forme de texte libre (« environ 15x20 »).
  const sizeMatch = request.sizeCm?.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/);

  const project = await db.project.create({
    data: {
      clientId: client.id,
      title: `Demande de ${request.firstName} ${request.lastName}`,
      description: [
        request.description,
        request.budget ? `\n\nBudget annoncé : ${request.budget}` : "",
        request.availability ? `\nDisponibilités : ${request.availability}` : "",
      ]
        .filter(Boolean)
        .join(""),
      bodyZone: request.bodyZone,
      widthCm: sizeMatch ? Number.parseFloat(sizeMatch[1].replace(",", ".")) : null,
      heightCm: sizeMatch ? Number.parseFloat(sizeMatch[2].replace(",", ".")) : null,
      style: request.style,
      colorMode: request.colorMode,
      status: "idea",
    },
  });

  // Les images de référence envoyées par le client suivent le projet.
  const referenceUrls: string[] = (() => {
    try {
      const parsed = JSON.parse(request.referenceUrls);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  })();

  if (referenceUrls.length > 0) {
    await db.projectImage.createMany({
      data: referenceUrls.map((url) => ({
        projectId: project.id,
        url,
        kind: "reference",
      })),
    });
  }

  await db.projectRequest.update({
    where: { id },
    data: {
      status: "converted",
      clientId: client.id,
      projectId: project.id,
      handledAt: new Date(),
    },
  });

  await logActivity(
    "request.convert",
    `Demande convertie : ${request.firstName} ${request.lastName}`,
    "project",
    project.id,
  );

  revalidatePath("/demandes");
  revalidatePath("/clients");
  revalidatePath("/projets");
  revalidatePath("/tableau-de-bord");

  redirect(`/projets/${project.id}`);
}
