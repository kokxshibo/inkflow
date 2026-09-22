import { requireSession } from "@/lib/auth";
import { db, getSettings } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { endOfDay, startOfDay } from "@/lib/utils";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const settings = await getSettings();

  const now = new Date();
  const inTenDays = new Date(now);
  inTenDays.setDate(inTenDays.getDate() + 10);

  const [
    requests,
    unreadMessages,
    todayAppointments,
    expensesToPay,
    obligationsDue,
  ] = await Promise.all([
    db.projectRequest.count({ where: { status: "new" } }),
    db.message.count({ where: { direction: "in", readAt: null } }),
    db.appointment.count({
      where: {
        startAt: { gte: startOfDay(now), lte: endOfDay(now) },
        status: { in: ["confirmed", "draft"] },
      },
    }),
    db.expense.count({ where: { status: { in: ["to_pay", "overdue"] } } }),
    // Échéances personnelles à moins de dix jours, ou déjà en retard
    db.obligation.count({
      where: {
        status: { in: ["planned", "due", "late"] },
        dueAt: { lte: inTenDays },
      },
    }),
  ]);

  return (
    <AppShell
      user={{ name: session.name, email: session.email }}
      studioName={settings.studioName}
      counts={{
        requests,
        unreadMessages,
        todayAppointments,
        expensesToPay,
        obligationsDue,
      }}
    >
      {children}
    </AppShell>
  );
}
