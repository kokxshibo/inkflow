import Link from "next/link";
import type { Metadata } from "next";
import { Plus, ReceiptText, Wallet, AlertTriangle, TrendingUp } from "lucide-react";
import { db } from "@/lib/db";
import { formatCHF } from "@/lib/money";
import { formatDate, fullName, initials, startOfMonth } from "@/lib/utils";
import { INVOICE_STATUS, INVOICE_KIND, labelOf } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/misc";
import { ListToolbar } from "@/components/list-toolbar";

export const metadata: Metadata = { title: "Factures" };
export const dynamic = "force-dynamic";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const now = new Date();

  const invoices = await db.invoice.findMany({
    where: {
      ...(params.statut ? { status: params.statut } : {}),
      ...(query
        ? {
            OR: [
              { number: { contains: query } },
              { client: { firstName: { contains: query } } },
              { client: { lastName: { contains: query } } },
            ],
          }
        : {}),
    },
    include: { client: true, project: true },
    orderBy: { issuedAt: "desc" },
    take: 150,
  });

  const [monthPaid, openInvoices, yearPaid] = await Promise.all([
    db.payment.aggregate({
      _sum: { amount: true },
      where: { paidAt: { gte: startOfMonth(now) } },
    }),
    db.invoice.findMany({
      where: { status: { in: ["sent", "partial", "overdue"] } },
      select: { total: true, amountPaid: true, dueAt: true },
    }),
    db.payment.aggregate({
      _sum: { amount: true },
      where: { paidAt: { gte: new Date(now.getFullYear(), 0, 1) } },
    }),
  ]);

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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6 stagger">
        <StatCard
          label="Encaissé ce mois"
          value={formatCHF(monthPaid._sum.amount ?? 0)}
          tone="success"
          icon={<Wallet />}
        />
        <StatCard
          label="Encaissé cette année"
          value={formatCHF(yearPaid._sum.amount ?? 0)}
          tone="accent"
          icon={<TrendingUp />}
        />
        <StatCard
          label="En attente"
          value={formatCHF(outstanding)}
          tone="warning"
          sublabel={`${openInvoices.length} facture${openInvoices.length > 1 ? "s" : ""} ouverte${openInvoices.length > 1 ? "s" : ""}`}
        />
        <StatCard
          label="En retard"
          value={formatCHF(overdue)}
          tone={overdue > 0 ? "danger" : "neutral"}
          icon={overdue > 0 ? <AlertTriangle /> : undefined}
        />
      </div>

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
          title={query ? "Aucun résultat" : "Aucune facture"}
          description={
            query
              ? "Essaie avec d'autres critères."
              : "Crée une facture, ou convertis un devis accepté en un clic."
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
