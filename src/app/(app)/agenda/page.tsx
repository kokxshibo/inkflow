import type { Metadata } from "next";
import { db } from "@/lib/db";
import { addDays, startOfWeek } from "@/lib/utils";
import { AgendaView } from "./agenda-view";

export const metadata: Metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{
    semaine?: string;
    nouveau?: string;
    client?: string;
    projet?: string;
  }>;
}) {
  const params = await searchParams;

  const anchor = params.semaine ? new Date(params.semaine) : new Date();
  const weekStart = startOfWeek(Number.isNaN(anchor.getTime()) ? new Date() : anchor);
  const weekEnd = addDays(weekStart, 7);

  const [appointments, clients, projects] = await Promise.all([
    db.appointment.findMany({
      where: { startAt: { gte: addDays(weekStart, -7) }, endAt: { lte: addDays(weekEnd, 7) } },
      include: { client: true, project: true },
      orderBy: { startAt: "asc" },
    }),
    db.client.findMany({
      where: { status: { not: "archived" } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
    }),
    db.project.findMany({
      where: { status: { notIn: ["done", "cancelled"] } },
      select: { id: true, title: true, clientId: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <AgendaView
      weekStart={weekStart.toISOString()}
      appointments={appointments.map((appointment) => ({
        id: appointment.id,
        title: appointment.title,
        type: appointment.type,
        status: appointment.status,
        startAt: appointment.startAt.toISOString(),
        endAt: appointment.endAt.toISOString(),
        notes: appointment.notes,
        depositRequired: appointment.depositRequired,
        depositPaid: appointment.depositPaid,
        clientId: appointment.clientId,
        projectId: appointment.projectId,
        clientName: appointment.client
          ? `${appointment.client.firstName} ${appointment.client.lastName}`
          : null,
        projectTitle: appointment.project?.title ?? null,
      }))}
      clients={clients}
      projects={projects}
      openNew={params.nouveau === "1"}
      presetClientId={params.client}
      presetProjectId={params.projet}
    />
  );
}
