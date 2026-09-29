"use client";

import * as React from "react";
import { useActionState } from "react";
import type { PersonalSettings } from "@prisma/client";
import { toast } from "sonner";
import {
  AlertCircle,
  Save,
  Landmark,
  HeartPulse,
  Receipt,
  PiggyBank,
  Info,
} from "lucide-react";
import { savePersonalSettings, type PersonalState } from "../actions";
import {
  CANTONS,
  LAMAL_FRANCHISES,
  SWISS_REFERENCE,
} from "@/lib/constants";
import { formatCHF } from "@/lib/money";
import { Button } from "@/components/ui/button";
import {
  Field,
  Input,
  Select,
  SwitchField,
} from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { useFormTabs } from "@/components/use-form-tabs";

type SettingsWithFormatted = PersonalSettings & {
  avsDeclaredIncomeFormatted: string;
  lamalPremiumFormatted: string;
  lamalSubsidyFormatted: string;
  pillar3aCeilingFormatted: string;
};

export function PersonalSettingsForm({
  settings,
}: {
  settings: SettingsWithFormatted;
}) {
  const [state, formAction, pending] = useActionState<PersonalState, FormData>(
    savePersonalSettings,
    {},
  );
  const formRef = React.useRef<HTMLFormElement>(null);
  const { tab, setTab } = useFormTabs("avs", formRef);

  const [income, setIncome] = React.useState(settings.avsDeclaredIncomeFormatted);
  const [avsRate, setAvsRate] = React.useState(settings.avsRate);
  const [adminRate, setAdminRate] = React.useState(settings.avsAdminRate);

  React.useEffect(() => {
    if (state.success) toast.success("Réglages enregistrés");
  }, [state.success]);

  const incomeCents = Math.round(
    Number.parseFloat(income.replace(/['\s]/g, "").replace(",", ".") || "0") * 100,
  );
  const contributions = Math.round((incomeCents * avsRate) / 100);
  const adminFees = Math.round((contributions * adminRate) / 100);

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-3.5 rounded-[var(--radius-md)] bg-[var(--danger-soft)] border border-[var(--danger)]/25 animate-slide-up"
        >
          <AlertCircle className="size-4 text-[var(--danger)] shrink-0 mt-0.5" />
          <p className="text-[13px] text-[var(--danger)]">{state.error}</p>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full sm:w-auto overflow-x-auto">
          <TabsTrigger value="avs">
            <Landmark />
            AVS
          </TabsTrigger>
          <TabsTrigger value="lamal">
            <HeartPulse />
            Santé
          </TabsTrigger>
          <TabsTrigger value="tax">
            <Receipt />
            Impôts
          </TabsTrigger>
          <TabsTrigger value="provisions">
            <PiggyBank />
            Provisions
          </TabsTrigger>
        </TabsList>

        {/* ─────────────── AVS ─────────────── */}
        <TabsContent value="avs" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Caisse de compensation</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Numéro AVS"
                htmlFor="avsNumber"
                hint="Format : 756.1234.5678.90"
              >
                <Input
                  id="avsNumber"
                  name="avsNumber"
                  defaultValue={settings.avsNumber ?? ""}
                  placeholder="756.1234.5678.90"
                  className="tabular"
                  inputMode="numeric"
                />
              </Field>
              <Field label="Caisse" htmlFor="avsCaisse">
                <Input
                  id="avsCaisse"
                  name="avsCaisse"
                  defaultValue={settings.avsCaisse ?? ""}
                  placeholder="Caisse cantonale, FER, OCAS…"
                />
              </Field>
              <Field label="N° d'affilié" htmlFor="avsMemberNo" className="sm:col-span-2">
                <Input
                  id="avsMemberNo"
                  name="avsMemberNo"
                  defaultValue={settings.avsMemberNo ?? ""}
                  className="tabular"
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cotisations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                label="Revenu annuel annoncé"
                htmlFor="avsDeclaredIncome"
                hint="Le revenu net d'indépendant communiqué à ta caisse."
              >
                <Input
                  id="avsDeclaredIncome"
                  name="avsDeclaredIncome"
                  value={income}
                  onChange={(event) => setIncome(event.target.value)}
                  suffix="CHF"
                  inputMode="decimal"
                  className="tabular text-right pr-14"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Taux de cotisation"
                  htmlFor="avsRate"
                  hint={`Maximum ${SWISS_REFERENCE.avsMaxRate} % (AVS ${SWISS_REFERENCE.avsComponents.avs} + AI ${SWISS_REFERENCE.avsComponents.ai} + APG ${SWISS_REFERENCE.avsComponents.apg}).`}
                >
                  <Input
                    id="avsRate"
                    name="avsRate"
                    type="number"
                    step="0.01"
                    min={0}
                    max={30}
                    value={avsRate}
                    onChange={(event) => setAvsRate(Number(event.target.value) || 0)}
                    suffix="%"
                    className="tabular"
                  />
                </Field>
                <Field
                  label="Frais d'administration"
                  htmlFor="avsAdminRate"
                  hint="En % des cotisations. Varie selon la caisse."
                >
                  <Input
                    id="avsAdminRate"
                    name="avsAdminRate"
                    type="number"
                    step="0.1"
                    min={0}
                    max={10}
                    value={adminRate}
                    onChange={(event) => setAdminRate(Number(event.target.value) || 0)}
                    suffix="%"
                    className="tabular"
                  />
                </Field>
              </div>

              {incomeCents > 0 && (
                <div className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border)] space-y-2">
                  <Row label="Cotisations" value={formatCHF(contributions)} />
                  <Row label="Frais administratifs" value={formatCHF(adminFees)} />
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                    <span className="text-[13px] font-medium">Total annuel</span>
                    <span className="text-[15px] font-semibold tabular">
                      {formatCHF(contributions + adminFees)}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--fg-subtle)] pt-1 leading-relaxed">
                    Soit environ {formatCHF(Math.round((contributions + adminFees) / 4))}{" "}
                    par acompte trimestriel.
                  </p>
                </div>
              )}

              <Note>
                Un barème dégressif s&apos;applique aux revenus modestes et une
                cotisation minimale annuelle existe. Confirme le taux exact auprès de ta
                caisse : ces montants servent à provisionner, pas à déclarer.
              </Note>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────────── LAMal ─────────────── */}
        <TabsContent value="lamal" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Assurance de base</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Assureur" htmlFor="lamalInsurer">
                <Input
                  id="lamalInsurer"
                  name="lamalInsurer"
                  defaultValue={settings.lamalInsurer ?? ""}
                  placeholder="Assura, CSS, Helsana, Groupe Mutuel…"
                />
              </Field>
              <Field label="N° de police" htmlFor="lamalPolicyNo">
                <Input
                  id="lamalPolicyNo"
                  name="lamalPolicyNo"
                  defaultValue={settings.lamalPolicyNo ?? ""}
                  className="tabular"
                />
              </Field>

              <Field label="Prime mensuelle" htmlFor="lamalPremium">
                <Input
                  id="lamalPremium"
                  name="lamalPremium"
                  defaultValue={settings.lamalPremiumFormatted}
                  suffix="CHF"
                  inputMode="decimal"
                  className="tabular text-right pr-14"
                />
              </Field>
              <Field
                label="Subside mensuel"
                htmlFor="lamalSubsidy"
                hint="Réduction cantonale, si tu en bénéficies."
              >
                <Input
                  id="lamalSubsidy"
                  name="lamalSubsidy"
                  defaultValue={settings.lamalSubsidyFormatted}
                  suffix="CHF"
                  inputMode="decimal"
                  className="tabular text-right pr-14"
                />
              </Field>

              <Field
                label="Franchise annuelle"
                htmlFor="lamalFranchise"
                hint="Plus elle est haute, plus la prime est basse."
              >
                <Select
                  id="lamalFranchise"
                  name="lamalFranchise"
                  defaultValue={String(settings.lamalFranchise)}
                  options={LAMAL_FRANCHISES.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                />
              </Field>

              <div className="flex items-end pb-1">
                <SwitchField
                  id="lamalAccident"
                  name="lamalAccident"
                  label="Couverture accident incluse"
                  hint="En principe nécessaire pour un indépendant sans employeur."
                  defaultChecked={settings.lamalAccident}
                />
              </div>
            </CardContent>
          </Card>

          <Note>
            La quote-part est de {SWISS_REFERENCE.lamalCoinsuranceRate} % des frais
            au-delà de la franchise, plafonnée à{" "}
            {formatCHF(SWISS_REFERENCE.lamalCoinsuranceCapCents)} par an pour un adulte.
            Les primes varient chaque année et selon le canton.
          </Note>
        </TabsContent>

        {/* ─────────────── Impôts ─────────────── */}
        <TabsContent value="tax" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Situation fiscale</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Canton" htmlFor="taxCanton">
                <Select
                  id="taxCanton"
                  name="taxCanton"
                  defaultValue={settings.taxCanton ?? ""}
                  placeholder="Non précisé"
                  options={CANTONS.map((c) => ({ value: c.value, label: c.label }))}
                />
              </Field>
              <Field label="Commune" htmlFor="taxCommune">
                <Input
                  id="taxCommune"
                  name="taxCommune"
                  defaultValue={settings.taxCommune ?? ""}
                  placeholder="Genève"
                />
              </Field>
              <Field label="N° de contribuable" htmlFor="taxNumber">
                <Input
                  id="taxNumber"
                  name="taxNumber"
                  defaultValue={settings.taxNumber ?? ""}
                  className="tabular"
                />
              </Field>
              <Field
                label="Taux d'imposition estimé"
                htmlFor="taxRate"
                hint="Fédéral + cantonal + communal, pour provisionner."
              >
                <Input
                  id="taxRate"
                  name="taxRate"
                  type="number"
                  step="0.5"
                  min={0}
                  max={60}
                  defaultValue={settings.taxRate}
                  suffix="%"
                  className="tabular"
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3e pilier</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Établissement" htmlFor="pillar3aInsurer">
                <Input
                  id="pillar3aInsurer"
                  name="pillar3aInsurer"
                  defaultValue={settings.pillar3aInsurer ?? ""}
                  placeholder="Banque ou assurance"
                />
              </Field>
              <Field
                label="Plafond annuel déductible"
                htmlFor="pillar3aCeiling"
                hint="Différent selon que tu as ou non une LPP. Revu chaque année."
              >
                <Input
                  id="pillar3aCeiling"
                  name="pillar3aCeiling"
                  defaultValue={settings.pillar3aCeilingFormatted}
                  suffix="CHF"
                  inputMode="decimal"
                  className="tabular text-right pr-14"
                />
              </Field>
            </CardContent>
          </Card>

          <Note>
            Le barème fiscal suisse est progressif et varie fortement d&apos;une commune
            à l&apos;autre. Le taux saisi ici ne sert qu&apos;à estimer la provision.
          </Note>
        </TabsContent>

        {/* ─────────────── Provisions ─────────────── */}
        <TabsContent value="provisions" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Mise de côté automatique</CardTitle>
              <p className="text-[13px] text-[var(--fg-muted)]">
                Calculée sur le chiffre d&apos;affaires réellement encaissé.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Provision AVS"
                htmlFor="provisionAvsPercent"
                hint="En % de chaque encaissement."
              >
                <Input
                  id="provisionAvsPercent"
                  name="provisionAvsPercent"
                  type="number"
                  step="0.5"
                  min={0}
                  max={50}
                  defaultValue={settings.provisionAvsPercent}
                  suffix="%"
                  className="tabular"
                />
              </Field>
              <Field
                label="Provision impôts"
                htmlFor="provisionTaxPercent"
                hint="En % de chaque encaissement."
              >
                <Input
                  id="provisionTaxPercent"
                  name="provisionTaxPercent"
                  type="number"
                  step="0.5"
                  min={0}
                  max={60}
                  defaultValue={settings.provisionTaxPercent}
                  suffix="%"
                  className="tabular"
                />
              </Field>
            </CardContent>
          </Card>

          <Note>
            Le réflexe qui sauve : dès qu&apos;un client paie, cette part n&apos;est
            plus à toi. Vire-la sur un compte séparé et ne la touche plus jusqu&apos;aux
            échéances.
          </Note>
        </TabsContent>
      </Tabs>

      <div className="sticky-actions sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-3.5 glass border-t border-[var(--border)] flex items-center justify-end gap-2.5 z-20">
        <Button type="submit" variant="primary" loading={pending}>
          <Save />
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-[var(--fg-muted)]">{label}</span>
      <span className="text-[13px] tabular">{value}</span>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 p-3.5 rounded-[var(--radius-md)] bg-[var(--info-soft)] border border-[var(--info)]/25">
      <Info className="size-4 text-[var(--info)] shrink-0 mt-0.5" />
      <p className="text-[12px] text-[var(--fg-muted)] leading-relaxed">{children}</p>
    </div>
  );
}
