import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, HeartPulse, Info, ShieldCheck } from "lucide-react";
import { db, getPersonalSettings } from "@/lib/db";
import { formatCHF } from "@/lib/money";
import { LAMAL_FRANCHISES, SWISS_REFERENCE, labelOf } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataRow, PageHeader, Progress } from "@/components/ui/misc";
import { ObligationPanel } from "../obligation-panel";
import { HealthCosts } from "./health-costs";

export const metadata: Metadata = { title: "Assurance maladie" };
export const dynamic = "force-dynamic";

export default async function InsurancePage() {
  const settings = await getPersonalSettings();
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [obligations, costs, totals] = await Promise.all([
    db.obligation.findMany({ where: { kind: "lamal" }, orderBy: { dueAt: "asc" } }),
    db.healthCost.findMany({
      where: { date: { gte: yearStart } },
      orderBy: { date: "desc" },
      take: 50,
    }),
    db.healthCost.aggregate({
      _sum: {
        amount: true,
        reimbursed: true,
        appliedToFranchise: true,
        appliedToCoinsurance: true,
      },
      where: { date: { gte: yearStart } },
    }),
  ]);

  const franchiseUsed = totals._sum.appliedToFranchise ?? 0;
  const coinsuranceUsed = totals._sum.appliedToCoinsurance ?? 0;
  const franchiseLeft = Math.max(0, settings.lamalFranchise - franchiseUsed);

  const netPremium = Math.max(0, settings.lamalPremium - settings.lamalSubsidy);
  const annualPremium = netPremium * 12;
  // Ce que l'année peut coûter au maximum : primes + franchise + quote-part plafonnée.
  const worstCase =
    annualPremium + settings.lamalFranchise + SWISS_REFERENCE.lamalCoinsuranceCapCents;

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
        title="Assurance maladie"
        description="LAMal — primes, franchise et quote-part."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/perso/reglages">Réglages</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6 stagger">
        <StatCard
          label="Prime mensuelle nette"
          value={formatCHF(netPremium)}
          tone="info"
          sublabel={
            settings.lamalSubsidy > 0
              ? `${formatCHF(settings.lamalPremium)} moins ${formatCHF(settings.lamalSubsidy)} de subside`
              : "Sans subside"
          }
        />
        <StatCard
          label="Primes sur l'année"
          value={formatCHF(annualPremium)}
          tone="neutral"
        />
        <StatCard
          label="Frais médicaux"
          value={formatCHF(totals._sum.amount ?? 0)}
          tone="neutral"
          sublabel={`${formatCHF(totals._sum.reimbursed ?? 0)} remboursés`}
        />
        <StatCard
          label="Coût maximal théorique"
          value={formatCHF(worstCase)}
          tone="warning"
          sublabel="Primes + franchise + quote-part"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
        <div className="space-y-6 order-2 lg:order-1">
          {/* Franchise et quote-part */}
          <Card>
            <CardHeader>
              <CardTitle>Où en est ma franchise ?</CardTitle>
              <span className="text-[12px] text-[var(--fg-muted)]">
                Année {now.getFullYear()}
              </span>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[13px] text-[var(--fg-muted)]">
                    Franchise consommée
                  </span>
                  <span className="text-[13px] tabular">
                    {formatCHF(franchiseUsed)} /{" "}
                    <span className="text-[var(--fg-muted)]">
                      {formatCHF(settings.lamalFranchise)}
                    </span>
                  </span>
                </div>
                <Progress
                  value={
                    settings.lamalFranchise > 0
                      ? (franchiseUsed / settings.lamalFranchise) * 100
                      : 0
                  }
                  tone={franchiseLeft === 0 ? "success" : "info"}
                />
                <p className="text-[11px] text-[var(--fg-subtle)] mt-2 leading-relaxed">
                  {franchiseLeft > 0 ? (
                    <>
                      Il reste <strong>{formatCHF(franchiseLeft)}</strong> entièrement à
                      ta charge avant que l&apos;assurance ne commence à rembourser.
                    </>
                  ) : (
                    <>
                      Franchise atteinte : l&apos;assurance prend en charge 90 % des
                      frais, les 10 % restants étant la quote-part.
                    </>
                  )}
                </p>
              </div>

              <div className="pt-4 border-t border-[var(--border)]">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[13px] text-[var(--fg-muted)]">
                    Quote-part ({SWISS_REFERENCE.lamalCoinsuranceRate} %)
                  </span>
                  <span className="text-[13px] tabular">
                    {formatCHF(coinsuranceUsed)} /{" "}
                    <span className="text-[var(--fg-muted)]">
                      {formatCHF(SWISS_REFERENCE.lamalCoinsuranceCapCents)}
                    </span>
                  </span>
                </div>
                <Progress
                  value={
                    (coinsuranceUsed / SWISS_REFERENCE.lamalCoinsuranceCapCents) * 100
                  }
                  tone="warning"
                />
                <p className="text-[11px] text-[var(--fg-subtle)] mt-2 leading-relaxed">
                  Plafonnée à {formatCHF(SWISS_REFERENCE.lamalCoinsuranceCapCents)} par
                  an pour un adulte. Au-delà, tout est pris en charge.
                </p>
              </div>
            </CardContent>
          </Card>

          <HealthCosts
            costs={costs.map((cost) => ({
              id: cost.id,
              date: cost.date.toISOString(),
              provider: cost.provider,
              description: cost.description,
              amount: cost.amount,
              reimbursed: cost.reimbursed,
              appliedToFranchise: cost.appliedToFranchise,
              appliedToCoinsurance: cost.appliedToCoinsurance,
              attachmentUrl: cost.attachmentUrl,
            }))}
          />

          <ObligationPanel
            kind="lamal"
            title="Primes mensuelles"
            scheduleLabel="Générer l&rsquo;année"
            scheduleInstallments={12}
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
                <HeartPulse className="size-4 text-[var(--fg-subtle)]" />
                Mon contrat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <DataRow label="Assureur">
                  {settings.lamalInsurer ?? (
                    <span className="text-[var(--fg-subtle)]">Non renseigné</span>
                  )}
                </DataRow>
                <DataRow label="N° de police">
                  <span className="tabular text-[11px]">
                    {settings.lamalPolicyNo ?? "—"}
                  </span>
                </DataRow>
                <DataRow label="Franchise">
                  {labelOf(LAMAL_FRANCHISES, String(settings.lamalFranchise))}
                </DataRow>
                <DataRow label="Couverture accident">
                  {settings.lamalAccident ? (
                    <span className="inline-flex items-center gap-1.5 text-[var(--success)]">
                      <ShieldCheck className="size-3.5" />
                      Incluse
                    </span>
                  ) : (
                    <span className="text-[var(--warning)]">Non incluse</span>
                  )}
                </DataRow>
                {settings.lamalSubsidy > 0 && (
                  <DataRow label="Subside">{formatCHF(settings.lamalSubsidy)} / mois</DataRow>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bon à savoir</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[12px] text-[var(--fg-muted)] leading-relaxed">
              <p>
                L&apos;assurance de base est obligatoire et les prestations couvertes
                sont identiques partout : seule la prime change d&apos;un assureur à
                l&apos;autre.
              </p>
              <p>
                Une franchise haute réduit la prime mais coûte cher en cas de pépin.
                Le coût maximal d&apos;une année reste connu à l&apos;avance : primes +
                franchise + quote-part plafonnée.
              </p>
              <p>
                En tant qu&apos;indépendant sans employeur, la couverture accident doit
                en principe être incluse dans ton assurance de base.
              </p>
              <div className="flex items-start gap-2 p-2.5 rounded-[var(--radius-sm)] bg-[var(--info-soft)] border border-[var(--info)]/20">
                <Info className="size-3.5 text-[var(--info)] shrink-0 mt-0.5" />
                <p className="text-[11px]">
                  Le changement d&apos;assureur pour l&apos;assurance de base se fait en
                  fin d&apos;année civile, avec un préavis à respecter — note-toi
                  l&apos;échéance en novembre.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
