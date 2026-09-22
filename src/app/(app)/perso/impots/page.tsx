import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, Receipt, Info } from "lucide-react";
import { db, getPersonalSettings } from "@/lib/db";
import { formatCHF } from "@/lib/money";
import { CANTONS, labelOf } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataRow, PageHeader } from "@/components/ui/misc";
import { ObligationPanel } from "../obligation-panel";

export const metadata: Metadata = { title: "Impôts" };
export const dynamic = "force-dynamic";

export default async function TaxPage() {
  const settings = await getPersonalSettings();
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [obligations, revenue, expenses] = await Promise.all([
    db.obligation.findMany({ where: { kind: "tax" }, orderBy: { dueAt: "asc" } }),
    db.payment.aggregate({
      _sum: { amount: true },
      where: { paidAt: { gte: yearStart } },
    }),
    db.expense.aggregate({
      _sum: { amountGross: true },
      where: { issuedAt: { gte: yearStart } },
    }),
  ]);

  const cashIn = revenue._sum.amount ?? 0;
  const charges = expenses._sum.amountGross ?? 0;
  const result = cashIn - charges;
  const estimated = Math.max(0, Math.round((result * settings.taxRate) / 100));
  const paid = obligations.reduce((sum, o) => sum + o.paidAmount, 0);

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            href="/perso"
            className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Gestion personnelle
          </Link>
        }
        title="Impôts"
        description="Impôt fédéral direct, cantonal et communal — acomptes et suivi."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/perso/reglages">Réglages</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6 stagger">
        <StatCard label="Encaissé cette année" value={formatCHF(cashIn)} tone="accent" />
        <StatCard label="Charges déduites" value={formatCHF(charges)} tone="neutral" />
        <StatCard
          label="Résultat estimé"
          value={formatCHF(result)}
          tone={result > 0 ? "success" : "danger"}
          sublabel="Encaissé moins les dépenses"
        />
        <StatCard
          label="Impôt estimé"
          value={formatCHF(estimated)}
          tone="warning"
          sublabel={`${settings.taxRate} % · ${formatCHF(paid)} déjà versés`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
        <div className="order-2 lg:order-1">
          <ObligationPanel
            kind="tax"
            title="Acomptes d'impôts"
            scheduleLabel="Générer l&rsquo;année"
            scheduleInstallments={10}
            obligations={obligations.map((o) => ({
              id: o.id,
              label: o.label,
              period: o.period,
              amount: o.amount,
              paidAmount: o.paidAmount,
              dueAt: o.dueAt.toISOString(),
              paidAt: o.paidAt?.toISOString() ?? null,
              status: o.status,
              reference: o.reference,
            }))}
          />
        </div>

        <div className="space-y-5 order-1 lg:order-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="size-4 text-[var(--fg-subtle)]" />
                Ma situation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <DataRow label="Canton">
                  {settings.taxCanton ? (
                    labelOf(CANTONS, settings.taxCanton)
                  ) : (
                    <span className="text-[var(--fg-subtle)]">Non renseigné</span>
                  )}
                </DataRow>
                <DataRow label="Commune">{settings.taxCommune ?? "—"}</DataRow>
                <DataRow label="N° de contribuable">
                  <span className="tabular text-[11px]">{settings.taxNumber ?? "—"}</span>
                </DataRow>
                <DataRow label="Taux estimé">{settings.taxRate} %</DataRow>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>À retenir</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[12px] text-[var(--fg-muted)] leading-relaxed">
              <p>
                Un indépendant est imposé sur son{" "}
                <strong className="text-[var(--fg)]">bénéfice</strong> : les recettes
                encaissées moins les charges professionnelles justifiées. D&apos;où
                l&apos;importance de scanner chaque facture fournisseur.
              </p>
              <p>
                Le nombre de tranches d&apos;acomptes et les échéances varient selon le
                canton. Les cotisations AVS et les versements au 3e pilier sont en
                principe déductibles.
              </p>
              <div className="flex items-start gap-2 p-2.5 rounded-[var(--radius-sm)] bg-[var(--info-soft)] border border-[var(--info)]/20">
                <Info className="size-3.5 text-[var(--info)] shrink-0 mt-0.5" />
                <p className="text-[11px]">
                  Le taux indiqué ici sert uniquement à provisionner. Le barème réel est
                  progressif et dépend du canton, de la commune et de ta situation
                  familiale — fais-le confirmer par ta fiduciaire.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
