import Link from "next/link";
import type { Metadata } from "next";
import {
  PiggyBank,
  HeartPulse,
  Landmark,
  Receipt,
  ArrowRight,
  AlertTriangle,
  CalendarClock,
  Info,
} from "lucide-react";
import { db, getPersonalSettings } from "@/lib/db";
import { formatCHF } from "@/lib/money";
import { formatDate, formatRelative } from "@/lib/utils";
import { OBLIGATION_KIND, OBLIGATION_STATUS, SWISS_REFERENCE, labelOf } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Progress } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Gestion personnelle" };
export const dynamic = "force-dynamic";

export default async function PersonalPage() {
  const settings = await getPersonalSettings();
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [revenue, obligations, paidThisYear, healthCosts] = await Promise.all([
    // Le chiffre d'affaires réellement encaissé sert de base aux provisions.
    db.payment.aggregate({
      _sum: { amount: true },
      where: { paidAt: { gte: yearStart } },
    }),
    db.obligation.findMany({
      where: { status: { in: ["planned", "due", "late"] } },
      orderBy: { dueAt: "asc" },
      take: 8,
    }),
    db.obligation.groupBy({
      by: ["kind"],
      _sum: { paidAmount: true },
      where: { paidAt: { gte: yearStart } },
    }),
    db.healthCost.aggregate({
      _sum: { appliedToFranchise: true, appliedToCoinsurance: true },
      where: { date: { gte: yearStart } },
    }),
  ]);

  const cashIn = revenue._sum.amount ?? 0;

  // Provisions : ce qu'il faudrait avoir mis de côté à ce stade de l'année.
  const avsProvision = Math.round((cashIn * settings.provisionAvsPercent) / 100);
  const taxProvision = Math.round((cashIn * settings.provisionTaxPercent) / 100);
  const totalProvision = avsProvision + taxProvision;

  const paidByKind = new Map(paidThisYear.map((r) => [r.kind, r._sum.paidAmount ?? 0]));
  const avsPaid = paidByKind.get("avs") ?? 0;
  const taxPaid = paidByKind.get("tax") ?? 0;

  const franchiseUsed = healthCosts._sum.appliedToFranchise ?? 0;
  const coinsuranceUsed = healthCosts._sum.appliedToCoinsurance ?? 0;

  const overdue = obligations.filter((o) => o.dueAt < now);
  const nextObligation = obligations[0];

  return (
    <>
      <PageHeader
        title="Gestion personnelle"
        description="AVS, assurance maladie et impôts — tout au même endroit que le salon."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/perso/reglages">Réglages</Link>
          </Button>
        }
      />

      {overdue.length > 0 && (
        <Card className="mb-6 border-[var(--danger)]/35 bg-[var(--danger-soft)]">
          <CardContent className="pt-5 flex items-start gap-3.5">
            <AlertTriangle className="size-5 text-[var(--danger)] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--fg)]">
                {overdue.length} échéance{overdue.length > 1 ? "s" : ""} dépassée
                {overdue.length > 1 ? "s" : ""}
              </p>
              <p className="text-[13px] text-[var(--fg-muted)] mt-1">
                Total :{" "}
                {formatCHF(overdue.reduce((sum, o) => sum + o.amount, 0))}. Les
                cotisations AVS et les impôts génèrent des intérêts de retard.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Provisions */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6 stagger">
        <StatCard
          label="Encaissé cette année"
          value={formatCHF(cashIn)}
          icon={<Receipt />}
          tone="accent"
          sublabel="Base de calcul des provisions"
        />
        <StatCard
          label="À provisionner"
          value={formatCHF(totalProvision)}
          icon={<PiggyBank />}
          tone="warning"
          sublabel={`AVS ${settings.provisionAvsPercent} % + impôts ${settings.provisionTaxPercent} %`}
        />
        <StatCard
          label="AVS déjà versée"
          value={formatCHF(avsPaid)}
          tone={avsPaid >= avsProvision ? "success" : "neutral"}
          sublabel={
            avsProvision > 0
              ? `sur ${formatCHF(avsProvision)} estimés`
              : "Aucune provision calculée"
          }
        />
        <StatCard
          label="Impôts déjà versés"
          value={formatCHF(taxPaid)}
          tone={taxPaid >= taxProvision ? "success" : "neutral"}
          sublabel={
            taxProvision > 0
              ? `sur ${formatCHF(taxProvision)} estimés`
              : "Aucune provision calculée"
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Échéances */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Prochaines échéances</CardTitle>
              <p className="text-[13px] text-[var(--fg-muted)] mt-0.5">
                {nextObligation
                  ? `La prochaine ${formatRelative(nextObligation.dueAt)}`
                  : "Aucune échéance planifiée"}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {obligations.length === 0 ? (
              <EmptyState
                icon={<CalendarClock />}
                title="Aucune échéance"
                description="Génère ton échéancier annuel depuis les pages AVS, assurance ou impôts."
                className="py-10 border-0"
              />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {obligations.map((obligation) => {
                  const late = obligation.dueAt < now;
                  return (
                    <li
                      key={obligation.id}
                      className="flex items-center gap-3.5 py-3"
                    >
                      <span
                        className={
                          "grid place-items-center size-9 shrink-0 rounded-[var(--radius-sm)] [&_svg]:size-4 " +
                          (obligation.kind === "avs"
                            ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                            : obligation.kind === "lamal"
                              ? "bg-[var(--info-soft)] text-[var(--info)]"
                              : "bg-[var(--warning-soft)] text-[var(--warning)]")
                        }
                      >
                        {obligation.kind === "avs" ? (
                          <Landmark />
                        ) : obligation.kind === "lamal" ? (
                          <HeartPulse />
                        ) : (
                          <Receipt />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium truncate">
                          {obligation.label}
                        </p>
                        <p className="text-[11px] text-[var(--fg-subtle)] mt-0.5">
                          {labelOf(OBLIGATION_KIND, obligation.kind)} · échéance{" "}
                          <span className={late ? "text-[var(--danger)]" : undefined}>
                            {formatDate(obligation.dueAt)}
                          </span>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-semibold tabular">
                          {formatCHF(obligation.amount)}
                        </p>
                        <StatusBadge
                          options={OBLIGATION_STATUS}
                          value={late ? "late" : obligation.status}
                          dot={false}
                          className="mt-0.5"
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Raccourcis */}
        <div className="space-y-4">
          <SectionLink
            href="/perso/avs"
            icon={<Landmark />}
            tone="accent"
            title="AVS / AI / APG"
            subtitle={
              settings.avsCaisse
                ? settings.avsCaisse
                : "Caisse de compensation non renseignée"
            }
            detail={`Taux ${settings.avsRate} % + ${settings.avsAdminRate} % de frais`}
          />

          <SectionLink
            href="/perso/assurance"
            icon={<HeartPulse />}
            tone="info"
            title="Assurance maladie"
            subtitle={settings.lamalInsurer ?? "Assureur non renseigné"}
            detail={
              settings.lamalPremium > 0
                ? `${formatCHF(settings.lamalPremium)} par mois`
                : "Prime non renseignée"
            }
          >
            {settings.lamalFranchise > 0 && (
              <div className="mt-3 pt-3 border-t border-[var(--border)]">
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="text-[var(--fg-muted)]">Franchise consommée</span>
                  <span className="tabular">
                    {formatCHF(franchiseUsed)} / {formatCHF(settings.lamalFranchise)}
                  </span>
                </div>
                <Progress
                  value={(franchiseUsed / settings.lamalFranchise) * 100}
                  tone={franchiseUsed >= settings.lamalFranchise ? "success" : "info"}
                />
                {franchiseUsed >= settings.lamalFranchise && (
                  <p className="text-[10px] text-[var(--fg-subtle)] mt-2">
                    Franchise atteinte · quote-part {formatCHF(coinsuranceUsed)} sur{" "}
                    {formatCHF(SWISS_REFERENCE.lamalCoinsuranceCapCents)}
                  </p>
                )}
              </div>
            )}
          </SectionLink>

          <SectionLink
            href="/perso/impots"
            icon={<Receipt />}
            tone="warning"
            title="Impôts"
            subtitle={
              settings.taxCanton
                ? `${settings.taxCanton}${settings.taxCommune ? ` · ${settings.taxCommune}` : ""}`
                : "Canton non renseigné"
            }
            detail={`Taux estimé ${settings.taxRate} %`}
          />
        </div>
      </div>

      <Card className="mt-6 border-dashed">
        <CardContent className="pt-5 flex items-start gap-3.5">
          <Info className="size-5 text-[var(--fg-subtle)] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Ces chiffres sont des estimations</p>
            <p className="text-[13px] text-[var(--fg-muted)] mt-1 leading-relaxed">
              Les taux et plafonds changent chaque année et dépendent de ta caisse de
              compensation, de ton canton et de ta situation. L&apos;application
              t&apos;aide à provisionner et à ne rien oublier, mais elle ne remplace ni
              ta caisse, ni ta fiduciaire. Fais confirmer les montants avant de
              t&apos;engager.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function SectionLink({
  href,
  icon,
  tone,
  title,
  subtitle,
  detail,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  tone: "accent" | "info" | "warning";
  title: string;
  subtitle: string;
  detail: string;
  children?: React.ReactNode;
}) {
  const toneClass = {
    accent: "bg-[var(--accent-soft)] text-[var(--accent)]",
    info: "bg-[var(--info-soft)] text-[var(--info)]",
    warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
  }[tone];

  return (
    <Card interactive className="p-4">
      <Link href={href} className="group block">
        <div className="flex items-start gap-3">
          <span
            className={`grid place-items-center size-10 shrink-0 rounded-[var(--radius-md)] [&_svg]:size-5 ${toneClass}`}
          >
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold group-hover:text-[var(--accent)] transition-colors">
              {title}
            </p>
            <p className="text-[12px] text-[var(--fg-muted)] truncate mt-0.5">
              {subtitle}
            </p>
            <p className="text-[11px] text-[var(--fg-subtle)] mt-0.5">{detail}</p>
          </div>
          <ArrowRight className="size-4 text-[var(--fg-subtle)] shrink-0 mt-1 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0" />
        </div>
        {children}
      </Link>
    </Card>
  );
}
