import Link from "next/link";
import type { Metadata } from "next";
import {
  Plus,
  ScanLine,
  Wallet,
  TrendingDown,
  AlertTriangle,
  Paperclip,
  Repeat,
  Receipt,
} from "lucide-react";
import { db, getSettings } from "@/lib/db";
import { formatCHF } from "@/lib/money";
import { formatDate, startOfMonth, truncate } from "@/lib/utils";
import { EXPENSE_CATEGORY, EXPENSE_STATUS, labelOf } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { ListToolbar } from "@/components/list-toolbar";

export const metadata: Metadata = { title: "Dépenses" };
export const dynamic = "force-dynamic";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string; categorie?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [expenses, settings, monthTotal, yearTotal, openExpenses, deductibleVat] =
    await Promise.all([
      db.expense.findMany({
        where: {
          ...(params.statut ? { status: params.statut } : {}),
          ...(params.categorie ? { category: params.categorie } : {}),
          ...(query
            ? {
                OR: [
                  { supplier: { contains: query, mode: "insensitive" } },
                  { label: { contains: query, mode: "insensitive" } },
                  { invoiceNumber: { contains: query, mode: "insensitive" } },
                  { notes: { contains: query, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: [{ issuedAt: "desc" }],
        take: 150,
      }),
      getSettings(),
      db.expense.aggregate({
        _sum: { amountGross: true },
        where: { issuedAt: { gte: startOfMonth(now) } },
      }),
      db.expense.aggregate({
        _sum: { amountGross: true },
        where: { issuedAt: { gte: yearStart } },
      }),
      db.expense.findMany({
        where: { status: { in: ["to_pay", "overdue"] } },
        select: { amountGross: true, dueAt: true },
      }),
      db.expense.aggregate({
        _sum: { vatAmount: true },
        where: { vatDeductible: true, issuedAt: { gte: yearStart } },
      }),
    ]);

  const toPay = openExpenses.reduce((sum, e) => sum + e.amountGross, 0);
  const overdue = openExpenses
    .filter((e) => e.dueAt && e.dueAt < now)
    .reduce((sum, e) => sum + e.amountGross, 0);

  return (
    <>
      <PageHeader
        title="Dépenses"
        description="Factures fournisseurs, charges et justificatifs — conservation 10 ans."
        actions={
          <>
            <Button asChild variant="secondary" size="sm" className="hidden sm:inline-flex">
              <Link href="/depenses/nouvelle">
                <Plus />
                Saisir
              </Link>
            </Button>
            <Button asChild variant="primary" size="sm">
              <Link href="/depenses/scanner">
                <ScanLine />
                Scanner
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6 stagger">
        <StatCard
          label="Dépenses ce mois"
          value={formatCHF(monthTotal._sum.amountGross ?? 0)}
          icon={<TrendingDown />}
          tone="neutral"
        />
        <StatCard
          label="Dépenses cette année"
          value={formatCHF(yearTotal._sum.amountGross ?? 0)}
          icon={<Wallet />}
          tone="accent"
        />
        <StatCard
          label="À payer"
          value={formatCHF(toPay)}
          tone={toPay > 0 ? "warning" : "neutral"}
          sublabel={`${openExpenses.length} facture${openExpenses.length > 1 ? "s" : ""} ouverte${openExpenses.length > 1 ? "s" : ""}`}
        />
        {settings.vatEnabled ? (
          <StatCard
            label="TVA récupérable"
            value={formatCHF(deductibleVat._sum.vatAmount ?? 0)}
            tone="success"
            sublabel="Impôt préalable de l'année"
          />
        ) : (
          <StatCard
            label="En retard"
            value={formatCHF(overdue)}
            tone={overdue > 0 ? "danger" : "neutral"}
            icon={overdue > 0 ? <AlertTriangle /> : undefined}
          />
        )}
      </div>

      {/* Raccourci scan, bien visible sur téléphone */}
      <Card className="mb-6 sm:hidden border-[var(--accent)]/25 bg-[var(--accent-soft)]">
        <CardContent className="pt-5">
          <Link
            href="/depenses/scanner"
            className="flex items-center gap-3.5"
          >
            <span className="grid place-items-center size-11 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-fg)] shrink-0">
              <ScanLine className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">
                Photographier une facture
              </span>
              <span className="block text-[12px] text-[var(--fg-muted)] mt-0.5 leading-relaxed">
                La QR-facture suisse remplit tout automatiquement.
              </span>
            </span>
          </Link>
        </CardContent>
      </Card>

      <ListToolbar
        basePath="/depenses"
        searchPlaceholder="Fournisseur, description, n° de facture…"
        filters={[
          {
            param: "statut",
            label: "Statut",
            options: EXPENSE_STATUS.map((o) => ({ value: o.value, label: o.label })),
          },
          {
            param: "categorie",
            label: "Catégorie",
            options: EXPENSE_CATEGORY.map((o) => ({ value: o.value, label: o.label })),
          },
        ]}
      />

      {expenses.length === 0 ? (
        <EmptyState
          icon={<Receipt />}
          title={query ? "Aucun résultat" : "Aucune dépense"}
          description={
            query
              ? "Essaie avec d'autres critères."
              : "Scanne tes factures d'encre, de matériel ou de loyer : elles nourrissent directement ta comptabilité."
          }
          action={
            <Button asChild variant="primary" size="sm">
              <Link href="/depenses/scanner">
                <ScanLine />
                Scanner une facture
              </Link>
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--border)]">
            {expenses.map((expense) => {
              const isOverdue =
                expense.status === "to_pay" && expense.dueAt && expense.dueAt < now;
              return (
                <li key={expense.id}>
                  <Link
                    href={`/depenses/${expense.id}`}
                    className="flex items-center gap-3.5 px-4 sm:px-5 py-3.5 hover:bg-[var(--surface-2)] transition-colors group"
                  >
                    <span className="grid place-items-center size-9 shrink-0 rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--border)]">
                      {expense.attachmentUrl ? (
                        <Paperclip className="size-4 text-[var(--fg-subtle)]" />
                      ) : (
                        <Receipt className="size-4 text-[var(--fg-subtle)]" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-medium truncate group-hover:text-[var(--accent)] transition-colors">
                          {expense.supplier}
                        </span>
                        {expense.scannedFromQr && (
                          <Badge tone="info">
                            <ScanLine className="size-2.5" />
                            Scanné
                          </Badge>
                        )}
                        {expense.recurrenceMonths && (
                          <Repeat className="size-3 text-[var(--fg-subtle)]" />
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--fg-subtle)] truncate mt-0.5">
                        {labelOf(EXPENSE_CATEGORY, expense.category)}
                        {expense.label && ` · ${truncate(expense.label, 46)}`}
                      </p>
                    </div>

                    <div className="hidden sm:block text-right shrink-0">
                      <p className="text-[11px] text-[var(--fg-subtle)]">Date</p>
                      <p className="text-[12px] tabular">{formatDate(expense.issuedAt)}</p>
                    </div>

                    <div className="text-right shrink-0 w-24 sm:w-28">
                      <p className="text-[14px] font-semibold tabular">
                        {formatCHF(expense.amountGross)}
                      </p>
                      {expense.vatDeductible && expense.vatAmount > 0 && (
                        <p className="text-[10px] text-[var(--success)] tabular">
                          TVA {formatCHF(expense.vatAmount, { showCurrency: false })}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 hidden sm:flex w-28 justify-end">
                      <StatusBadge
                        options={EXPENSE_STATUS}
                        value={isOverdue ? "overdue" : expense.status}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Répartition par catégorie */}
      {expenses.length > 0 && <CategoryBreakdown />}
    </>
  );
}

async function CategoryBreakdown() {
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const grouped = await db.expense.groupBy({
    by: ["category"],
    _sum: { amountGross: true },
    where: { issuedAt: { gte: yearStart } },
    orderBy: { _sum: { amountGross: "desc" } },
    take: 8,
  });

  const total = grouped.reduce((sum, row) => sum + (row._sum.amountGross ?? 0), 0);
  if (total === 0) return null;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Répartition de l&apos;année</CardTitle>
        <span className="text-[13px] font-semibold tabular">{formatCHF(total)}</span>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {grouped.map((row) => {
          const amount = row._sum.amountGross ?? 0;
          const percent = Math.round((amount / total) * 100);
          return (
            <div key={row.category}>
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="text-[12px] text-[var(--fg-muted)] truncate">
                  {labelOf(EXPENSE_CATEGORY, row.category)}
                </span>
                <span className="text-[12px] tabular shrink-0">
                  {formatCHF(amount)}
                  <span className="text-[var(--fg-subtle)] ml-1.5">{percent} %</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-700"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
