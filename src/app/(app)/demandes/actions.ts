"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, getSettings, logActivity } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { sendEmailToLead, sendLinkByEmail } from "@/lib/gmail";
import { refreshLeadProfile, sendInstagramToLead, sendLinkByInstagram } from "@/lib/instagram";
import { markLeadRead } from "@/lib/leads";
import { buildSignature } from "@/lib/mail";
import { removeFile } from "@/lib/storage";

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

  const request = await db.projectRequest.findUnique({ where: { id }, include: { lead: true } });
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
        // Le pseudo vu dans la conversation Instagram prime sur celui saisi à la main.
        instagram: request.lead?.username ?? request.instagram?.replace(/^@/, "") ?? null,
        birthDate: request.birthDate,
        source: request.source === "instagram" ? "instagram" : "website",
        language: request.language,
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

/* ─────────────────── Contacts Instagram / Gmail ─────────────────── */

export interface LeadActionResult {
  error?: string;
}

function revalidateLead(id: string) {
  revalidatePath("/demandes");
  revalidatePath(`/demandes/contacts/${id}`);
  // Les demandes rattachées affichent aussi la conversation.
  revalidatePath("/demandes/[id]", "page");
  revalidatePath("/", "layout");
}

const replySchema = z
  .string()
  .trim()
  .min(1, "Le message est vide.")
  .max(4000, "Message trop long (4000 caractères maximum).");

/**
 * Réponse écrite depuis l'app : elle part sur le canal où la personne a
 * écrit (message privé Instagram ou e-mail dans le même fil Gmail).
 */
export async function replyToLead(id: string, text: string): Promise<LeadActionResult> {
  await requireSession();
  const parsed = replySchema.safeParse(text);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Message invalide." };

  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return { error: "Contact introuvable." };

  try {
    if (lead.channel === "instagram") {
      if (parsed.data.length > 1000) {
        return { error: "Instagram limite un message à 1000 caractères." };
      }
      await sendInstagramToLead(id, parsed.data, "app");
    } else {
      // Comme dans Gmail : la signature est ajoutée sous le message.
      const signature = buildSignature(await getSettings()).trim();
      const body =
        signature && !parsed.data.endsWith(signature)
          ? `${parsed.data}\n\n${signature}`
          : parsed.data;
      await sendEmailToLead(id, { text: body }, "app");
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Envoi impossible." };
  }

  await markLeadRead(id);
  revalidateLead(id);
  return {};
}

/** Envoie (ou renvoie) le lien de demande perso au contact, sur son canal. */
export async function sendLeadLink(id: string): Promise<LeadActionResult> {
  await requireSession();
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return { error: "Contact introuvable." };
  try {
    if (lead.channel === "instagram") await sendLinkByInstagram(id);
    else await sendLinkByEmail(id);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Envoi impossible." };
  }
  revalidateLead(id);
  return {};
}

/** Relit le pseudo, le nom et la photo de profil Instagram. */
export async function refreshLeadProfileAction(id: string): Promise<LeadActionResult> {
  await requireSession();
  try {
    await refreshLeadProfile(id);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Actualisation impossible." };
  }
  revalidateLead(id);
  return {};
}

export async function deleteLead(id: string) {
  await requireSession();
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) redirect("/demandes");
  await db.lead.delete({ where: { id } });
  if (lead.avatarUrl) await removeFile(lead.avatarUrl);
  await logActivity("lead.delete", `Contact supprimé : ${lead.username ?? lead.email ?? lead.name ?? lead.externalId}`);
  revalidatePath("/demandes");
  redirect("/demandes");
}
