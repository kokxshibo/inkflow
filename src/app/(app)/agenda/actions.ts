"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, getSettings, logActivity } from "@/lib/db";
import { getBillingSuggestions } from "@/lib/billing";
import { requireSession } from "@/lib/auth";
import { parseCHF } from "@/lib/money";

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable();

const appointmentSchema = z
  .object({
    clientId: optionalString,
    projectId: optionalString,
    title: optionalString,
    type: z.string().default("session"),
    startAt: z.string().min(1, "Date et heure de début requises"),
    endAt: z.string().min(1, "Date et heure de fin requises"),
    status: z.string().default("confirmed"),
    depositRequired: optionalString,
    depositPaid: z.coerce.boolean().default(false),
    notes: optionalString,
  })
  .refine((data) => new Date(data.endAt) > new Date(data.startAt), {
    message: "La fin doit être après le début",
    path: ["endAt"],
  });

export interface AppointmentState {
  error?: string;
  success?: boolean;
}

export async function saveAppointment(
  _prev: AppointmentState,
  formData: FormData,
): Promise<AppointmentState> {
  await requireSession();

  const id = String(formData.get("id") ?? "");
  const raw = {
    ...Object.fromEntries(formData.entries()),
    depositPaid: formData.get("depositPaid") === "on",
  };

  const parsed = appointmentSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }

  const input = parsed.data;
  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);

  // Détection de chevauchement (hors créneaux annulés et hors soi-même)
  const overlap = await db.appointment.findFirst({
    where: {
      id: id ? { not: id } : undefined,
      status: { notIn: ["cancelled"] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
  });
  if (overlap) {
    return {
      error: "Ce créneau chevauche un rendez-vous existant. Choisis un autre horaire.",
    };
  }

  let title = input.title;
  if (!title) {
    if (input.clientId) {
      const client = await db.client.findUnique({ where: { id: input.clientId } });
      title = client ? `${client.firstName} ${client.lastName}` : "Rendez-vous";
    } else {
      title = "Rendez-vous";
    }
  }

  const data = {
    clientId: input.clientId,
    projectId: input.projectId,
    title,
    type: input.type,
    startAt,
    endAt,
    status: input.status,
    depositRequired: input.depositRequired ? parseCHF(input.depositRequired) : null,
    depositPaid: input.depositPaid,
    notes: input.notes,
  };

  if (id) {
    await db.appointment.update({ where: { id }, data });
    await logActivity("appointment.update", `RDV mis à jour : ${title}`, "appointment", id);
  } else {
    const created = await db.appointment.create({ data });
    await logActivity(
      "appointment.create",
      `RDV créé : ${title}`,
      "appointment",
      created.id,
    );
  }

  revalidatePath("/agenda");
  revalidatePath("/tableau-de-bord");
  if (input.clientId) revalidatePath(`/clients/${input.clientId}`);
  if (input.projectId) revalidatePath(`/projets/${input.projectId}`);

  return { success: true };
}

export async function setAppointmentStatus(
  id: string,
  status: string,
): Promise<{ billable: boolean }> {
  await requireSession();

  const appointment = await db.appointment.update({
    where: { id },
    data: { status },
  });

  // Un no-show incrémente le compteur du client
  if (status === "no_show" && appointment.clientId) {
    await db.client.update({
      where: { id: appointment.clientId },
      data: { noShowCount: { increment: 1 } },
    });
  }

  await logActivity("appointment.status", `Statut : ${status}`, "appointment", id);

  revalidatePath("/agenda");
  revalidatePath("/tableau-de-bord");
  if (appointment.clientId) revalidatePath(`/clients/${appointment.clientId}`);
  if (appointment.projectId) revalidatePath(`/projets/${appointment.projectId}`);

  // Une séance effectuée et pas encore facturée peut l'être tout de suite.
  if (status !== "done" || appointment.type !== "session") return { billable: false };
  const suggestions = await getBillingSuggestions(await getSettings(), { key: `session:${id}` });
  return { billable: suggestions.length > 0 };
}

export async function deleteAppointment(id: string) {
  await requireSession();
  const appointment = await db.appointment.findUnique({ where: { id } });
  if (!appointment) return;

  await db.appointment.delete({ where: { id } });
  await logActivity("appointment.delete", "RDV supprimé", "appointment", id);

  revalidatePath("/agenda");
  revalidatePath("/tableau-de-bord");
  if (appointment.clientId) revalidatePath(`/clients/${appointment.clientId}`);
}

/** Déplacement rapide (glisser-déposer ou décalage) en conservant la durée */
export async function moveAppointment(id: string, newStart: string) {
  await requireSession();
  const appointment = await db.appointment.findUnique({ where: { id } });
  if (!appointment) return { error: "Rendez-vous introuvable" };

  const duration = appointment.endAt.getTime() - appointment.startAt.getTime();
  const startAt = new Date(newStart);
  const endAt = new Date(startAt.getTime() + duration);

  const overlap = await db.appointment.findFirst({
    where: {
      id: { not: id },
      status: { notIn: ["cancelled"] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
  });
  if (overlap) return { error: "Créneau déjà occupé" };

  await db.appointment.update({ where: { id }, data: { startAt, endAt } });
  revalidatePath("/agenda");
  return { success: true };
}
