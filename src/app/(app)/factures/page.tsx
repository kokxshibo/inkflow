import Link from "next/link";
import type { Metadata } from "next";
import { Plus, ReceiptText, Wallet, AlertTriangle, TrendingUp } from "lucide-react";
import { db } from "@/lib/db";
import { formatCHF } from "@/lib/money";
import { formatDate, fullName, initials } from "@/lib/utils";
import { bucketsFor, periodLinks, periodWhere, resolvePeriod, sumByBucket } from "@/lib/periods";
import { INVOICE_STATUS, INVOICE_KIND, labelOf } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, StatCard } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/misc";
import { ListToolbar } from "@/components/list-toolbar";
import { PeriodChart } from "@/components/period-chart";
import { PeriodPicker } from "@/components/period-picker";

export const metadata: Metadata = { title: "Factures" };
export const dynamic = "force-dynamic";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    statut?: string;
    periode?: string;
    date?: string;
    du?: string;
    au?: string;
  }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const now = new Date();
  const period = resolvePeriod(params, now);
  const inPeriod = periodWhere(period);

  const invoices = await db.invoice.findMany({
    where: {
      // Une recherche porte sur toutes les périodes : on retrouve toujours une facture.
      ...(inPeriod && !query ? { issuedAt: inPeriod } : {}),
      ...(params.statut ? { status: params.statut } : {}),
      ...(query
        ? {
            OR: [
              { number: { contains: query, mode: 'insensitive' } },
              { client: { firstName: { contains: query, mode: 'insensitive' } } },
              { client: { lastName: { contains: query, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: { client: true, project: true },
    orderBy: { issuedAt: "desc" },
    take: 300,
  });

  // Chiffres de la période : facturé (brouillons exclus ; une note de crédit
  // compte en négatif et annule la facture d'origine) et encaissé.
  const [issued, payments, openInvoices, first] = await Promise.all([
    db.invoice.findMany({
      where: { status: { not: "draft" }, ...(inPeriod ? { issuedAt: inPeriod } : {}) },
      select: { issuedAt: true, total: true },
    }),
    db.payment.findMany({
      where: inPeriod ? { paidAt: inPeriod } : {},
      select: { paidAt: true, amount: true },
    }),
    db.invoice.findMany({
      where: { status: { in: ["sent", "partial", "overdue"] } },
      select: { total: true, amountPaid: true, dueAt: true },
    }),
    db.invoice.findFirst({ orderBy: { issuedAt: "asc" }, select: { issuedAt: true } }),
  ]);

  const invoiced = issued.reduce((sum, invoice) => sum + invoice.total, 0);
  const cashed = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const buckets = bucketsFor(period, first?.issuedAt ?? null, now);
  const chartSeries = [
    {
      name: "Facturé",
      color: "var(--series-1)",
      values: sumByBucket(buckets, issued, (row) => row.issuedAt, (row) => row.total),
    },
    {
      name: "Encaissé",
      color: "var(--series-2)",
      values: sumByBucket(buckets, payments, (row) => row.paidAt, (row) => row.amount),
    },
  ];

  const outstanding = openInvoices.reduce((sum, i) => sum + (i.total - i.amountPaid), 0);
  const overdue = openInvoices
    .filter((i) => i.dueAt < now)
    .reduce((sum, i) => sum + (i.total - i.amountPaid), 0);

  return (
    <>
      <PageHeader
        title="Factures"
        description="Numérotation séquentielle · conservation 10 ans (art. 958f CO)"
        actions={
          <Button asChild variant="primary" size="sm">
            <Link href="/factures/nouvelle">
              <Plus />
              Nouvelle facture
            </Link>
          </Button>
        }
      />

      <PeriodPicker {...periodLinks("/factures", params, period)} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6 stagger">
        <StatCard
          label="Facturé"
          value={formatCHF(invoiced)}
          tone="accent"
          icon={<TrendingUp />}
          sublabel={`${issued.length} facture${issued.length > 1 ? "s" : ""} · ${period.label}`}
        />
        <StatCard
          label="Encaissé"
          value={formatCHF(cashed)}
          tone="success"
          icon={<Wallet />}
          sublabel={`${payments.length} paiement${payments.length > 1 ? "s" : ""} · ${period.label}`}
        />
        <StatCard
          label="En attente"
          value={formatCHF(outstanding)}
          tone="warning"
          sublabel={`${openInvoices.length} facture${openInvoices.length > 1 ? "s" : ""} ouverte${openInvoices.length > 1 ? "s" : ""}, toutes périodes`}
        />
        <StatCard
          label="En retard"
          value={formatCHF(overdue)}
          tone={overdue > 0 ? "danger" : "neutral"}
          icon={overdue > 0 ? <AlertTriangle /> : undefined}
          sublabel="Toutes périodes"
        />
      </div>

      <Card className="mb-6">
        <CardContent className="pt-5">
          <PeriodChart title={`Évolution · ${period.label}`} buckets={buckets} series={chartSeries} />
        </CardContent>
      </Card>

      <ListToolbar
        basePath="/factures"
        searchPlaceholder="Numéro, client…"
        filters={[
          {
            param: "statut",
            label: "Statut",
            options: INVOICE_STATUS.map((o) => ({ value: o.value, label: o.label })),
          },
        ]}
      />

      {invoices.length === 0 ? (
        <EmptyState
          icon={<ReceiptText />}
          title={query ? "Aucun résultat" : "Aucune facture sur cette période"}
          description={
            query
              ? "Essaie avec d'autres critères."
              : "Change de période, crée une facture, ou convertis un devis accepté en un clic."
          }
          action={
            <Button asChild variant="primary" size="sm">
              <Link href="/factures/nouvelle">
                <Plus />
                Créer une facture
              </Link>
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          {query && (
            <p className="px-4 sm:px-5 py-2.5 text-[12px] text-[var(--fg-subtle)] border-b border-[var(--border)]">
              Recherche sur toutes les périodes.
            </p>
          )}
          <ul className="divide-y divide-[var(--border)]">
            {invoices.map((invoice) => {
              const isOverdue =
                ["sent", "partial"].includes(invoice.status) && invoice.dueAt < now;
              const remaining = invoice.total - invoice.amountPaid;

              return (
                <li key={invoice.id}>
                  <Link
                    href={`/factures/${invoice.id}`}
                    className="flex items-center gap-4 px-4 sm:px-5 py-3.5 hover:bg-[var(--surface-2)] transition-colors group"
                  >
                    <Avatar
                      size="sm"
                      initials={initials(
                        invoice.client.firstName,
                        invoice.client.lastName,
                      )}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold tabular group-hover:text-[var(--accent)] transition-colors">
                          {invoice.number}
                        </span>
                        {invoice.kind !== "full" && (
                          <Badge tone={invoice.kind === "credit_note" ? "danger" : "info"}>
                            {labelOf(INVOICE_KIND, invoice.kind)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[12px] text-[var(--fg-muted)] truncate mt-0.5">
                        {fullName(invoice.client)}
                        {invoice.project && ` · ${invoice.project.title}`}
                      </p>
                    </div>

                    <div className="hidden md:block text-right shrink-0">
                      <p className="text-[11px] text-[var(--fg-subtle)]">Échéance</p>
                      <p
                        className={
                          "text-[12px] tabular " +
                          (isOverdue ? "text-[var(--danger)]" : "")
                        }
                      >
                        {formatDate(invoice.dueAt)}
                      </p>
                    </div>

                    <div className="hidden lg:block text-right shrink-0 w-24">
                      {remaining > 0 && invoice.amountPaid > 0 && (
                        <>
                          <p className="text-[11px] text-[var(--fg-subtle)]">Reste</p>
                          <p className="text-[12px] tabular text-[var(--warning)]">
                            {formatCHF(remaining)}
                          </p>
                        </>
                      )}
                    </div>

                    <div className="text-right shrink-0 w-28">
                      <p className="text-[14px] font-semibold tabular">
                        {formatCHF(invoice.total)}
                      </p>
                    </div>

                    <div className="shrink-0 w-36 flex justify-end">
                      <StatusBadge
                        options={INVOICE_STATUS}
                        value={isOverdue ? "overdue" : invoice.status}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
