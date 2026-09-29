"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, getSettings, logActivity, nextNumber } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { computeDeposit, formatCHF, fromGross, parseCHF } from "@/lib/money";
import { addDays, randomToken } from "@/lib/utils";

export interface QuickQuoteState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .default(null);

const schema = z
  .object({
    mode: z.enum(["project", "free"]),
    projectId: optionalText,
    clientId: optionalText,
    label: z.string().trim().min(1, "Indique ce que couvre le devis."),
    description: optionalText,
    price: z.string().min(1, "Le prix est requis."),
    depositPercent: z.coerce.number().int().min(0).max(100),
    sessions: z.coerce.number().int().min(1).max(50).default(1),
    hoursPerSession: z.coerce.number().min(0.5).max(12).default(3),
    validityDays: z.coerce
      .number({ invalid_type_error: "Indique un nombre de jours." })
      .int("Indique un nombre de jours entier.")
      .min(1, "Entre 1 et 365 jours.")
      .max(365, "Entre 1 et 365 jours."),
    terms: optionalText,
    intent: z.enum(["create", "send"]).default("create"),
  })
  .refine((data) => (data.mode === "project" ? Boolean(data.projectId) : Boolean(data.clientId)), {
    message: "Choisis le client.",
    path: ["clientId"],
  });

/**
 * Crée un devis d'une seule ligne à partir de la proposition automatique.
 * Le prix saisi est le prix final payé par le client ; la TVA en est extraite
 * si l'activité y est assujettie.
 */
export async function createQuickQuote(
  _prev: QuickQuoteState,
  formData: FormData,
): Promise<QuickQuoteState> {
  await requireSession();

  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Vérifie les champs signalés.", fieldErrors };
  }

  const input = parsed.data;
  const price = parseCHF(input.price);
  if (price <= 0) {
    return { error: "Vérifie le prix.", fieldErrors: { price: "Le prix doit être supérieur à zéro." } };
  }

  // Le client est toujours déduit du projet côté serveur, jamais du formulaire.
  const project = input.projectId
    ? await db.project.findUnique({ where: { id: input.projectId }, include: { client: true } })
    : null;
  if (input.mode === "project" && !project) {
    return { error: "Projet introuvable." };
  }
  const client = project?.client ?? (await db.client.findUnique({ where: { id: input.clientId! } }));
  if (!client) return { error: "Client introuvable.", fieldErrors: { clientId: "Client introuvable." } };

  if (input.intent === "send" && !client.email) {
    return {
      error: `${client.firstName} n'a pas d'adresse e-mail : crée le devis, puis transmets-lui le lien ou le PDF.`,
    };
  }

  const settings = await getSettings();
  const vatRate = settings.vatEnabled ? settings.vatRate : 0;
  const totals = fromGross(price, vatRate);
  const depositAmount = computeDeposit(totals.total, input.depositPercent);
  const now = new Date();

  const quote = await db.$transaction(async (tx) => {
    const number = await nextNumber("quote", settings.quotePrefix, tx);

    const created = await tx.quote.create({
      data: {
        number,
        clientId: client.id,
        projectId: project?.id ?? null,
        status: "draft",
        issuedAt: now,
        validUntil: addDays(now, input.validityDays),
        subtotal: totals.subtotal,
        discount: 0,
        vatRate,
        vatAmount: totals.vatAmount,
        total: totals.total,
        depositAmount,
        terms: input.terms,
        publicToken: randomToken(28),
        items: {
          create: [
            {
              label: input.label,
              description: input.description,
              quantity: 1,
              unitPrice: totals.subtotal,
              position: 0,
            },
          ],
        },
      },
    });

    // Le projet garde la trace de l'estimation qui a servi au devis.
    if (project) {
      await tx.project.update({
        where: { id: project.id },
        data: {
          estimatedPrice: price,
          estimatedSessions: input.sessions,
          estimatedMinutes: Math.round(input.sessions * input.hoursPerSession * 60),
        },
      });
    }

    return created;
  });

  await logActivity(
    "quote.create",
    `Devis ${quote.number} créé (${formatCHF(quote.total)})`,
    "quote",
    quote.id,
  );

  revalidatePath("/devis");
  revalidatePath(`/clients/${client.id}`);
  if (project) revalidatePath(`/projets/${project.id}`);

  // L'envoi passe par la messagerie : modèle prérempli, PDF joint, et le devis
  // passe automatiquement en « envoyé » une fois le message parti.
  redirect(
    input.intent === "send"
      ? `/messagerie/nouveau?client=${client.id}&devis=${quote.id}`
      : `/devis/${quote.id}?cree=1`,
  );
}
