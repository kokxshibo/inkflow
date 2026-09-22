import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, Landmark, Info } from "lucide-react";
import { db, getPersonalSettings } from "@/lib/db";
import { formatCHF } from "@/lib/money";
import { SWISS_REFERENCE } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataRow, PageHeader } from "@/components/ui/misc";
import { ObligationPanel } from "../obligation-panel";

export const metadata: Metadata = { title: "AVS / AI / APG" };
export const dynamic = "force-dynamic";

export default async function AvsPage() {
  const settings = await getPersonalSettings();
  const obligations = await db.obligation.findMany({
    where: { kind: "avs" },
    orderBy: { dueAt: "asc" },
  });

  const income = settings.avsDeclaredIncome;
  const contributions = Math.round((income * settings.avsRate) / 100);
  const adminFees = Math.round((contributions * settings.avsAdminRate) / 100);
  const total = contributions + adminFees;

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
        title="AVS / AI / APG"
        description="Cotisations sociales d'indépendant, versées à ta caisse de compensation."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/perso/reglages">Réglages</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6 stagger">
        <StatCard
          label="Revenu annoncé"
          value={formatCHF(income)}
          tone="neutral"
          sublabel="Base de calcul de la caisse"
        />
        <StatCard
          label="Cotisations"
          value={formatCHF(contributions)}
          tone="accent"
          sublabel={`${settings.avsRate} % du revenu`}
        />
        <StatCard
          label="Frais administratifs"
          value={formatCHF(adminFees)}
          tone="neutral"
          sublabel={`${settings.avsAdminRate} % des cotisations`}
        />
        <StatCard
          label="Total annuel estimé"
          value={formatCHF(total)}
          tone="warning"
          sublabel="À répartir en acomptes"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
        <div className="order-2 lg:order-1">
          <ObligationPanel
            kind="avs"
            title="Acomptes AVS"
            scheduleLabel="Générer l&rsquo;année"
            scheduleInstallments={4}
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
                <Landmark className="size-4 text-[var(--fg-subtle)]" />
                Ma caisse
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <DataRow label="Caisse">
                  {settings.avsCaisse ?? (
                    <span className="text-[var(--fg-subtle)]">Non renseignée</span>
                  )}
                </DataRow>
                <DataRow label="N° d'affilié">
                  <span className="tabular">{settings.avsMemberNo ?? "—"}</span>
                </DataRow>
                <DataRow label="N° AVS">
                  <span className="tabular text-[11px]">{settings.avsNumber ?? "—"}</span>
                </DataRow>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comment ça marche</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[12px] text-[var(--fg-muted)] leading-relaxed">
              <p>
                En tant qu&apos;indépendant, tu cotises à l&apos;AVS, à l&apos;AI et aux
                APG. Le taux maximal est de{" "}
                <strong className="text-[var(--fg)]">
                  {SWISS_REFERENCE.avsMaxRate} %
                </strong>{" "}
                du revenu ({SWISS_REFERENCE.avsComponents.avs} % AVS +{" "}
                {SWISS_REFERENCE.avsComponents.ai} % AI +{" "}
                {SWISS_REFERENCE.avsComponents.apg} % APG), auxquels s&apos;ajoutent les
                frais d&apos;administration de la caisse.
              </p>
              <p>
                Un barème dégressif s&apos;applique aux revenus modestes, avec une
                cotisation minimale annuelle. La caisse fixe des acomptes sur la base du
                revenu annoncé, puis établit un décompte définitif une fois la taxation
                fiscale reçue — d&apos;où des régularisations parfois tardives.
              </p>
              <div className="flex items-start gap-2 p-2.5 rounded-[var(--radius-sm)] bg-[var(--info-soft)] border border-[var(--info)]/20">
                <Info className="size-3.5 text-[var(--info)] shrink-0 mt-0.5" />
                <p className="text-[11px]">
                  Annonce un revenu réaliste : sous-estimer les acomptes expose à un
                  rattrapage important, avec intérêts.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
