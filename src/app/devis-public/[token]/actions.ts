"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { db, logActivity } from "@/lib/db";

const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(2, "Indique ton nom complet"),
  agreed: z.literal("on", {
    errorMap: () => ({ message: "Tu dois accepter les conditions" }),
  }),
});

export interface AcceptState {
  error?: string;
  success?: boolean;
}

/**
 * Acceptation en ligne d'un devis par le client, sans compte.
 * On horodate et on conserve le nom saisi ainsi que l'adresse IP : c'est ce qui
 * fait foi en cas de contestation.
 */
export async function acceptQuote(
  _prev: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  const parsed = acceptSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }

  const quote = await db.quote.findUnique({
    where: { publicToken: parsed.data.token },
  });

  if (!quote) return { error: "Devis introuvable." };
  if (quote.status === "accepted") return { success: true };
  if (quote.validUntil < new Date()) {
    return { error: "Ce devis a expiré. Contacte ton tatoueur pour en obtenir un nouveau." };
  }

  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerList.get("x-real-ip") ??
    null;

  await db.quote.update({
    where: { id: quote.id },
    data: {
      status: "accepted",
      acceptedAt: new Date(),
      acceptanceName: parsed.data.name,
      acceptanceIp: ip,
    },
  });

  if (quote.projectId) {
    await db.project.update({
      where: { id: quote.projectId },
      data: { status: "accepted" },
    });
  }

  await logActivity(
    "quote.accepted_online",
    `Devis ${quote.number} accepté en ligne par ${parsed.data.name}`,
    "quote",
    quote.id,
  );

  revalidatePath(`/devis/${quote.id}`);
  revalidatePath("/devis");
  revalidatePath("/tableau-de-bord");

  return { success: true };
}
