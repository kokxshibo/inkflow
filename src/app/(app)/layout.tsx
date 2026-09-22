import { requireSession } from "@/lib/auth";
import { db, getSettings } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { endOfDay, startOfDay } from "@/lib/utils";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const settings = await getSettings();

  const now = new Date();
  const [requests, unreadMessages, todayAppointments] = await Promise.all([
    db.projectRequest.count({ where: { status: "new" } }),
    db.message.count({ where: { direction: "in", readAt: null } }),
    db.appointment.count({
      where: {
        startAt: { gte: startOfDay(now), lte: endOfDay(now) },
        status: { in: ["confirmed", "draft"] },
      },
    }),
  ]);

  return (
    <AppShell
      user={{ name: session.name, email: session.email }}
      studioName={settings.studioName}
      counts={{ requests, unreadMessages, todayAppointments }}
    >
      {children}
    </AppShell>
  );
}
