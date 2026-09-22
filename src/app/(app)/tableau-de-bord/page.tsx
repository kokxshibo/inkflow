import Link from "next/link";
import type { Metadata } from "next";
import {
  Wallet,
  Clock3,
  CalendarDays,
  Sparkles,
  TrendingUp,
  ArrowRight,
  AlertTriangle,
  Users,
  Plus,
  CircleCheck,
  Inbox,
} from "lucide-react";
import { db, getSettings } from "@/lib/db";
import { formatCHF } from "@/lib/money";
import {
  formatDate,
  formatRelative,
  formatTime,
  fullName,
  initials,
  startOfDay,
  endOfDay,
  startOfMonth,
  addDays,
} from "@/lib/utils";
import {
  APPOINTMENT_TYPE,
  INVOICE_STATUS,
  VAT_INFO,
  labelOf,
} from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, EmptyState, PageHeader, Progress } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Tableau de bord" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const settings = await getSettings();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(addDays(monthStart, -1));
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [
    todayAppointments,
    upcomingAppointments,
    monthPayments,
    lastMonthPayments,
    yearPayments,
    outstandingInvoices,
    overdueInvoices,
    newRequests,
    activeProjects,
    recentClients,
    clientCount,
  ] = await Promise.all([
    db.appointment.findMany({
      where: {
        startAt: { gte: startOfDay(now), lte: endOfDay(now) },
        status: { notIn: ["cancelled"] },
      },
      include: { client: true, project: true },
      orderBy: { startAt: "asc" },
    }),
    db.appointment.findMany({
      where: {
        startAt: { gt: endOfDay(now), lte: addDays(now, 14) },
        status: { in: ["confirmed", "draft"] },
      },
      include: { client: true },
      orderBy: { startAt: "asc" },
      take: 5,
    }),
    db.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: monthStart } } }),
    db.payment.aggregate({
      _sum: { amount: true },
      where: { paidAt: { gte: lastMonthStart, lt: monthStart } },
    }),
    db.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: yearStart } } }),
    db.invoice.findMany({
      where: { status: { in: ["sent", "partial", "overdue"] } },
      include: { client: true },
      orderBy: { dueAt: "asc" },
      take: 6,
    }),
    db.invoice.count({ where: { status: { in: ["sent", "partial"] }, dueAt: { lt: now } } }),
    db.projectRequest.findMany({
      where: { status: "new" },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    db.project.count({
      where: { status: { in: ["deposit_paid", "in_progress", "accepted"] } },
    }),
    db.client.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { _count: { select: { projects: true } } },
    }),
    db.client.count(),
  ]);

  const monthRevenue = monthPayments._sum.amount ?? 0;
  const lastMonthRevenue = lastMonthPayments._sum.amount ?? 0;
  const yearRevenue = yearPayments._sum.amount ?? 0;
  const trend =
    lastMonthRevenue > 0
      ? Math.round(((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : null;

  const outstandingTotal = outstandingInvoices.reduce(
    (sum, invoice) => sum + (invoice.total - invoice.amountPaid),
    0,
  );

  const vatProgress = Math.min(100, (yearRevenue / VAT_INFO.thresholdCents) * 100);
  const nearVatThreshold = !settings.vatEnabled && vatProgress >= 75;

  const firstName = settings.ownerName.split(" ")[0] || "";
  const hour = now.getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <>
      <PageHeader
        title={`${greeting}${firstName ? `, ${firstName}` : ""}`}
        description={
          todayAppointments.length > 0
            ? `${todayAppointments.length} rendez-vous aujourd'hui · ${formatDate(now)}`
            : `Aucun rendez-vous aujourd'hui · ${formatDate(now)}`
        }
        actions={
          <Button asChild variant="primary" size="sm">
            <Link href="/clients/nouveau">
              <Plus />
              Nouveau client
            </Link>
          </Button>
        }
      />

      {/* Alerte seuil TVA */}
      {nearVatThreshold && (
        <Card className="mb-6 border-[var(--warning)]/35 bg-[var(--warning-soft)]">
          <CardContent className="pt-5 flex items-start gap-3.5">
            <AlertTriangle className="size-5 text-[var(--warning)] shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--fg)]">
                Tu approches du seuil d&apos;assujettissement à la TVA
              </p>
              <p className="text-[13px] text-[var(--fg-muted)] mt-1 leading-relaxed">
                {formatCHF(yearRevenue)} encaissés cette année sur un seuil de{" "}
                {formatCHF(VAT_INFO.thresholdCents)}. Au-delà, il faut t&apos;annoncer à
                l&apos;AFC et facturer la TVA à {VAT_INFO.standardRate} %.
              </p>
              <Progress value={vatProgress} tone="warning" className="mt-3 max-w-md" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistiques */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6 stagger">
        <StatCard
          label="Encaissé ce mois"
          value={formatCHF(monthRevenue)}
          icon={<Wallet />}
          tone="success"
          trend={trend !== null ? { value: trend, label: "vs mois dernier" } : undefined}
          sublabel={trend === null ? "Pas d'historique de comparaison" : undefined}
        />
        <StatCard
          label="En attente de paiement"
          value={formatCHF(outstandingTotal)}
          icon={<Clock3 />}
          tone={overdueInvoices > 0 ? "danger" : "warning"}
          sublabel={
            overdueInvoices > 0
              ? `${overdueInvoices} facture${overdueInvoices > 1 ? "s" : ""} en retard`
              : `${outstandingInvoices.length} facture${outstandingInvoices.length > 1 ? "s" : ""} ouverte${outstandingInvoices.length > 1 ? "s" : ""}`
          }
        />
        <StatCard
          label="Projets en cours"
          value={activeProjects}
          icon={<TrendingUp />}
          tone="accent"
          sublabel={`${clientCount} client${clientCount > 1 ? "s" : ""} au total`}
        />
        <StatCard
          label="Demandes à traiter"
          value={newRequests.length}
          icon={<Sparkles />}
          tone={newRequests.length > 0 ? "accent" : "neutral"}
          sublabel={
            newRequests.length > 0 ? "Reçues via le formulaire" : "Tout est à jour"
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Journée */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Aujourd&apos;hui</CardTitle>
              <p className="text-[13px] text-[var(--fg-muted)] mt-0.5">
                {todayAppointments.length} rendez-vous programmé
                {todayAppointments.length > 1 ? "s" : ""}
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/agenda">
                Agenda <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {todayAppointments.length === 0 ? (
              <EmptyState
                icon={<CalendarDays />}
                title="Journée libre"
                description="Aucun rendez-vous aujourd'hui. L'occasion de rattraper les devis en attente."
                action={
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/agenda?nouveau=1">
                      <Plus />
                      Ajouter un rendez-vous
                    </Link>
                  </Button>
                }
                className="py-10"
              />
            ) : (
              <ul className="space-y-2 stagger">
                {todayAppointments.map((appointment) => (
                  <li key={appointment.id}>
                    <Link
                      href={
                        appointment.clientId
                          ? `/clients/${appointment.clientId}`
                          : "/agenda"
                      }
                      className="group flex items-center gap-3.5 p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-subtle)] transition-all duration-200 hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
                    >
                      <div className="flex flex-col items-center justify-center shrink-0 w-14 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--border)]">
                        <span className="text-[15px] font-semibold tabular leading-none">
                          {formatTime(appointment.startAt)}
                        </span>
                        <span className="text-[10px] text-[var(--fg-subtle)] mt-1 tabular">
                          {formatTime(appointment.endAt)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--fg)] truncate">
                          {appointment.client
                            ? fullName(appointment.client)
                            : appointment.title}
                        </p>
                        <p className="text-xs text-[var(--fg-muted)] truncate mt-0.5">
                          {labelOf(APPOINTMENT_TYPE, appointment.type)}
                          {appointment.project && ` · ${appointment.project.title}`}
                        </p>
                      </div>
                      {appointment.status === "draft" && (
                        <Badge tone="warning" dot>
                          Acompte en attente
                        </Badge>
                      )}
                      <ArrowRight className="size-4 text-[var(--fg-subtle)] shrink-0 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {upcomingAppointments.length > 0 && (
              <div className="mt-5 pt-5 border-t border-[var(--border)]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)] mb-2.5">
                  Les jours suivants
                </p>
                <ul className="space-y-1">
                  {upcomingAppointments.map((appointment) => (
                    <li
                      key={appointment.id}
                      className="flex items-center gap-3 py-1.5 text-[13px]"
                    >
                      <span className="text-[var(--fg-subtle)] tabular w-24 shrink-0">
                        {formatDate(appointment.startAt)}
                      </span>
                      <span className="text-[var(--fg-subtle)] tabular w-11 shrink-0">
                        {formatTime(appointment.startAt)}
                      </span>
                      <span className="text-[var(--fg-muted)] truncate">
                        {appointment.client
                          ? fullName(appointment.client)
                          : appointment.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Colonne latérale */}
        <div className="space-y-6">
          {/* Demandes */}
          <Card>
            <CardHeader>
              <CardTitle>Demandes reçues</CardTitle>
              {newRequests.length > 0 && (
                <Badge tone="accent">{newRequests.length} nouvelle{newRequests.length > 1 ? "s" : ""}</Badge>
              )}
            </CardHeader>
            <CardContent>
              {newRequests.length === 0 ? (
                <div className="flex items-center gap-3 py-3 text-[13px] text-[var(--fg-muted)]">
                  <CircleCheck className="size-4 text-[var(--success)] shrink-0" />
                  Aucune demande en attente.
                </div>
              ) : (
                <ul className="space-y-2">
                  {newRequests.map((request) => (
                    <li key={request.id}>
                      <Link
                        href={`/demandes/${request.id}`}
                        className="group block p-2.5 rounded-[var(--radius-sm)] transition-colors hover:bg-[var(--surface-2)]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium truncate">
                            {request.firstName} {request.lastName}
                          </span>
                          <span className="text-[10px] text-[var(--fg-subtle)] shrink-0">
                            {formatRelative(request.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--fg-muted)] line-clamp-2 mt-0.5 leading-relaxed">
                          {request.description}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
            {newRequests.length > 0 && (
              <div className="px-5 pb-4">
                <Button asChild variant="secondary" size="sm" className="w-full">
                  <Link href="/demandes">
                    <Inbox />
                    Voir toutes les demandes
                  </Link>
                </Button>
              </div>
            )}
          </Card>

          {/* Impayés */}
          <Card>
            <CardHeader>
              <CardTitle>Factures ouvertes</CardTitle>
              <Button asChild variant="ghost" size="xs">
                <Link href="/factures">Tout voir</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {outstandingInvoices.length === 0 ? (
                <div className="flex items-center gap-3 py-3 text-[13px] text-[var(--fg-muted)]">
                  <CircleCheck className="size-4 text-[var(--success)] shrink-0" />
                  Tout est encaissé.
                </div>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {outstandingInvoices.map((invoice) => {
                    const overdue = invoice.dueAt < now && invoice.status !== "paid";
                    return (
                      <li key={invoice.id}>
                        <Link
                          href={`/factures/${invoice.id}`}
                          className="flex items-center justify-between gap-3 py-2.5 group"
                        >
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium truncate group-hover:text-[var(--accent)] transition-colors">
                              {fullName(invoice.client)}
                            </p>
                            <p className="text-[11px] text-[var(--fg-subtle)] tabular mt-0.5">
                              {invoice.number} · échéance {formatDate(invoice.dueAt)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[13px] font-semibold tabular">
                              {formatCHF(invoice.total - invoice.amountPaid)}
                            </p>
                            <StatusBadge
                              options={INVOICE_STATUS}
                              value={overdue ? "overdue" : invoice.status}
                              dot={false}
                              className="mt-0.5"
                            />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Derniers clients */}
          <Card>
            <CardHeader>
              <CardTitle>Derniers clients</CardTitle>
              <Button asChild variant="ghost" size="xs">
                <Link href="/clients">Tout voir</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentClients.length === 0 ? (
                <EmptyState
                  icon={<Users />}
                  title="Aucun client"
                  description="Crée ta première fiche client pour démarrer."
                  action={
                    <Button asChild size="sm" variant="primary">
                      <Link href="/clients/nouveau">
                        <Plus />
                        Nouveau client
                      </Link>
                    </Button>
                  }
                  className="py-8 border-0"
                />
              ) : (
                <ul className="space-y-1">
                  {recentClients.map((client) => (
                    <li key={client.id}>
                      <Link
                        href={`/clients/${client.id}`}
                        className="flex items-center gap-3 p-2 rounded-[var(--radius-sm)] transition-colors hover:bg-[var(--surface-2)] group"
                      >
                        <Avatar
                          size="sm"
                          initials={initials(client.firstName, client.lastName)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium truncate group-hover:text-[var(--accent)] transition-colors">
                            {fullName(client)}
                          </p>
                          <p className="text-[11px] text-[var(--fg-subtle)] truncate">
                            {client._count.projects} projet
                            {client._count.projects > 1 ? "s" : ""}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
