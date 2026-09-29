"use client";

import * as React from "react";
import { useActionState } from "react";
import type { Settings } from "@prisma/client";
import { toast } from "sonner";
import {
  AlertCircle,
  Save,
  Building2,
  Percent,
  Landmark,
  ReceiptText,
  Mail,
  KeyRound,
  Info,
  TriangleAlert,
  CheckCircle2,
} from "lucide-react";
import { saveSettings, changePassword, type SettingsState } from "./actions";
import { formatCHF, isQrIban, isValidIban } from "@/lib/money";
import { VAT_INFO } from "@/lib/constants";
import { useFormTabs } from "@/components/use-form-tabs";
import { Button } from "@/components/ui/button";
import {
  Field,
  Input,
  Select,
  SwitchField,
  Textarea,
} from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Progress,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/misc";

type SettingsWithFormatted = Settings & {
  hourlyRateFormatted: string;
  minimumPriceFormatted: string;
};

export function SettingsForm({
  settings,
  rollingRevenue,
  smtpConfigured,
}: {
  settings: SettingsWithFormatted;
  rollingRevenue: number;
  smtpConfigured: boolean;
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    saveSettings,
    {},
  );
  const formRef = React.useRef<HTMLFormElement>(null);
  const { tab, setTab } = useFormTabs("studio", formRef, state);
  const [vatEnabled, setVatEnabled] = React.useState(settings.vatEnabled);
  const [iban, setIban] = React.useState(settings.iban ?? "");
  const [qrIban, setQrIban] = React.useState(settings.qrIban ?? "");

  React.useEffect(() => {
    if (state.success) toast.success("Réglages enregistrés");
  }, [state.success]);

  const vatProgress = Math.min(100, (rollingRevenue / VAT_INFO.thresholdCents) * 100);
  const overThreshold = rollingRevenue >= VAT_INFO.thresholdCents;

  const ibanValid = iban ? isValidIban(iban) : null;
  const qrIbanValid = qrIban ? isValidIban(qrIban) && isQrIban(qrIban) : null;

  return (
    <div className="space-y-6">
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
            <TabsTrigger value="studio">
              <Building2 />
              Salon
            </TabsTrigger>
            <TabsTrigger value="vat">
              <Percent />
              TVA
            </TabsTrigger>
            <TabsTrigger value="bank">
              <Landmark />
              Banque
            </TabsTrigger>
            <TabsTrigger value="billing">
              <ReceiptText />
              Facturation
            </TabsTrigger>
            <TabsTrigger value="mail">
              <Mail />
              E-mail
            </TabsTrigger>
          </TabsList>

          {/* ─────────────── Salon ─────────────── */}
          <TabsContent value="studio" className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Identité</CardTitle>
                <p className="text-[13px] text-[var(--fg-muted)]">
                  Ces informations apparaissent sur les devis, les factures et la
                  QR-facture.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Nom du salon" htmlFor="studioName" required>
                  <Input
                    id="studioName"
                    name="studioName"
                    required
                    defaultValue={settings.studioName}
                    placeholder="Encre Noire Tattoo"
                  />
                </Field>
                <Field label="Nom du tatoueur" htmlFor="ownerName">
                  <Input
                    id="ownerName"
                    name="ownerName"
                    defaultValue={settings.ownerName}
                    placeholder="Marc Ducrey"
                  />
                </Field>
                <Field label="Forme juridique" htmlFor="legalForm">
                  <Select
                    id="legalForm"
                    name="legalForm"
                    defaultValue={settings.legalForm}
                    options={[
                      { value: "individual", label: "Entreprise individuelle" },
                      { value: "sarl", label: "Sàrl" },
                      { value: "sa", label: "SA" },
                    ]}
                  />
                </Field>
                <Field
                  label="Numéro IDE"
                  htmlFor="ide"
                  hint="Format : CHE-123.456.789"
                  error={state.fieldErrors?.ide}
                >
                  <Input
                    id="ide"
                    name="ide"
                    defaultValue={settings.ide ?? ""}
                    placeholder="CHE-123.456.789"
                    className="tabular"
                  />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Adresse et contact</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-6">
                <Field label="Rue et numéro" htmlFor="addressLine" className="sm:col-span-6">
                  <Input
                    id="addressLine"
                    name="addressLine"
                    defaultValue={settings.addressLine}
                    placeholder="Rue du Rhône 12"
                  />
                </Field>
                <Field label="NPA" htmlFor="postalCode" className="sm:col-span-2">
                  <Input
                    id="postalCode"
                    name="postalCode"
                    defaultValue={settings.postalCode}
                    placeholder="1204"
                    inputMode="numeric"
                  />
                </Field>
                <Field label="Localité" htmlFor="city" className="sm:col-span-2">
                  <Input
                    id="city"
                    name="city"
                    defaultValue={settings.city}
                    placeholder="Genève"
                  />
                </Field>
                <Field label="Canton" htmlFor="canton" className="sm:col-span-2">
                  <Input
                    id="canton"
                    name="canton"
                    defaultValue={settings.canton ?? ""}
                    placeholder="GE"
                    maxLength={2}
                  />
                </Field>
                <Field label="E-mail" htmlFor="email" className="sm:col-span-3">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={settings.email}
                    placeholder="contact@monsalon.ch"
                  />
                </Field>
                <Field label="Téléphone" htmlFor="phone" className="sm:col-span-3">
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    defaultValue={settings.phone ?? ""}
                    placeholder="+41 22 123 45 67"
                  />
                </Field>
                <Field label="Site web" htmlFor="website" className="sm:col-span-3">
                  <Input
                    id="website"
                    name="website"
                    defaultValue={settings.website ?? ""}
                    placeholder="https://monsalon.ch"
                  />
                </Field>
                <Field
                  label="Instagram"
                  htmlFor="instagram"
                  className="sm:col-span-3"
                  hint="Sans le @"
                >
                  <Input
                    id="instagram"
                    name="instagram"
                    defaultValue={settings.instagram ?? ""}
                    placeholder="monsalon.tattoo"
                  />
                </Field>
                <input type="hidden" name="country" value={settings.country} />
                <input type="hidden" name="tagline" value={settings.tagline ?? ""} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────── TVA ─────────────── */}
          <TabsContent value="vat" className="space-y-5">
            <Card
              className={
                overThreshold && !vatEnabled
                  ? "border-[var(--danger)]/35 bg-[var(--danger-soft)]"
                  : vatProgress >= 75 && !vatEnabled
                    ? "border-[var(--warning)]/35 bg-[var(--warning-soft)]"
                    : undefined
              }
            >
              <CardHeader>
                <CardTitle>Seuil d&apos;assujettissement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-[var(--fg-muted)]">
                    Encaissé sur 12 mois glissants
                  </span>
                  <span className="text-lg font-semibold tabular">
                    {formatCHF(rollingRevenue)}
                  </span>
                </div>
                <Progress
                  value={vatProgress}
                  tone={overThreshold ? "danger" : vatProgress >= 75 ? "warning" : "accent"}
                />
                <p className="text-[12px] text-[var(--fg-subtle)] leading-relaxed">
                  Seuil suisse : {formatCHF(VAT_INFO.thresholdCents)} de chiffre
                  d&apos;affaires annuel.{" "}
                  {overThreshold && !vatEnabled ? (
                    <strong className="text-[var(--danger)]">
                      Seuil dépassé — tu dois t&apos;annoncer à l&apos;AFC et activer la
                      TVA ci-dessous.
                    </strong>
                  ) : vatProgress >= 75 && !vatEnabled ? (
                    <strong className="text-[var(--warning)]">
                      Tu approches du seuil : anticipe avec ta fiduciaire.
                    </strong>
                  ) : (
                    "En dessous, tu n'es pas assujetti et aucune TVA ne doit figurer sur tes factures."
                  )}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configuration TVA</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <SwitchField
                  id="vatEnabled"
                  name="vatEnabled"
                  label="Je suis assujetti à la TVA"
                  hint="Active uniquement si tu es inscrit au registre TVA de l'AFC. Facturer une TVA sans être inscrit est une faute."
                  checked={vatEnabled}
                  onCheckedChange={setVatEnabled}
                />

                {vatEnabled ? (
                  <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t border-[var(--border)]">
                    <Field
                      label="Taux applicable"
                      htmlFor="vatRate"
                      hint={`Taux normal suisse : ${VAT_INFO.standardRate} % (le tatouage y est soumis).`}
                    >
                      <Select
                        id="vatRate"
                        name="vatRate"
                        defaultValue={String(settings.vatRate)}
                        options={[
                          { value: String(VAT_INFO.standardRate), label: `${VAT_INFO.standardRate} % — taux normal` },
                          { value: String(VAT_INFO.reducedRate), label: `${VAT_INFO.reducedRate} % — taux réduit` },
                          { value: String(VAT_INFO.lodgingRate), label: `${VAT_INFO.lodgingRate} % — hébergement` },
                        ]}
                      />
                    </Field>
                    <Field
                      label="Méthode de décompte"
                      htmlFor="vatMethod"
                      hint="À confirmer avec ta fiduciaire."
                    >
                      <Select
                        id="vatMethod"
                        name="vatMethod"
                        defaultValue={settings.vatMethod}
                        options={[
                          { value: "effective", label: "Méthode effective" },
                          { value: "tdfn", label: "Taux de la dette fiscale nette" },
                        ]}
                      />
                    </Field>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5 p-3 rounded-[var(--radius-sm)] bg-[var(--info-soft)] border border-[var(--info)]/20">
                    <Info className="size-4 text-[var(--info)] shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[var(--fg-muted)] leading-relaxed">
                      Tes devis et factures affichent la mention « Non assujetti à la TVA
                      au sens de la LTVA » et aucun montant de TVA n&apos;est calculé.
                    </p>
                  </div>
                )}
                {/* Le taux et la méthode restent transmis même quand la TVA est
                    désactivée, pour les retrouver tels quels en cas de réactivation. */}
                {!vatEnabled && (
                  <>
                    <input type="hidden" name="vatRate" value={String(settings.vatRate)} />
                    <input type="hidden" name="vatMethod" value={settings.vatMethod} />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────── Banque ─────────────── */}
          <TabsContent value="bank" className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Coordonnées bancaires</CardTitle>
                <p className="text-[13px] text-[var(--fg-muted)]">
                  Indispensables pour générer la QR-facture suisse sur tes PDF.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Banque" htmlFor="bankName">
                  <Input
                    id="bankName"
                    name="bankName"
                    defaultValue={settings.bankName ?? ""}
                    placeholder="PostFinance, UBS, Raiffeisen…"
                  />
                </Field>

                <Field
                  label="IBAN"
                  htmlFor="iban"
                  hint="IBAN standard. La QR-facture sera générée sans référence structurée."
                  error={state.fieldErrors?.iban}
                >
                  <Input
                    id="iban"
                    name="iban"
                    value={iban}
                    onChange={(event) => setIban(event.target.value)}
                    placeholder="CH93 0076 2011 6238 5295 7"
                    className="tabular"
                  />
                </Field>
                {iban && (
                  <Indicator
                    ok={ibanValid === true}
                    okText="IBAN valide"
                    koText="IBAN invalide — la clé de contrôle ne correspond pas"
                  />
                )}

                <Field
                  label="QR-IBAN"
                  htmlFor="qrIban"
                  hint="Si ta banque t'en a fourni un, il est prioritaire : il permet d'ajouter une référence QRR sur chaque facture, ce qui automatise le rapprochement des paiements."
                  error={state.fieldErrors?.qrIban}
                >
                  <Input
                    id="qrIban"
                    name="qrIban"
                    value={qrIban}
                    onChange={(event) => setQrIban(event.target.value)}
                    placeholder="CH44 3199 9123 0008 8901 2"
                    className="tabular"
                  />
                </Field>
                {qrIban && (
                  <Indicator
                    ok={qrIbanValid === true}
                    okText="QR-IBAN valide — les références QRR seront générées"
                    koText="Ce n'est pas un QR-IBAN valide (identifiant d'institution 30000–31999)"
                  />
                )}

                <div className="flex items-start gap-2.5 p-3 rounded-[var(--radius-sm)] bg-[var(--warning-soft)] border border-[var(--warning)]/25">
                  <TriangleAlert className="size-4 text-[var(--warning)] shrink-0 mt-0.5" />
                  <p className="text-[12px] text-[var(--fg-muted)] leading-relaxed">
                    <strong className="text-[var(--fg)]">À tester avant la mise en
                    production :</strong> génère une facture, puis scanne le PDF avec une
                    vraie application bancaire suisse. Une QR-facture mal formée est
                    rejetée par la banque.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────── Facturation ─────────────── */}
          <TabsContent value="billing" className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Numérotation</CardTitle>
                <p className="text-[13px] text-[var(--fg-muted)]">
                  Les numéros sont séquentiels et sans trou, par année.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Préfixe des devis"
                  htmlFor="quotePrefix"
                  hint="Exemple : DEV-2026-0001"
                >
                  <Input
                    id="quotePrefix"
                    name="quotePrefix"
                    defaultValue={settings.quotePrefix}
                    maxLength={8}
                  />
                </Field>
                <Field
                  label="Préfixe des factures"
                  htmlFor="invoicePrefix"
                  hint="Exemple : FAC-2026-0001"
                >
                  <Input
                    id="invoicePrefix"
                    name="invoicePrefix"
                    defaultValue={settings.invoicePrefix}
                    maxLength={8}
                  />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Délais et tarifs</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Validité des devis"
                  htmlFor="quoteValidityDays"
                  hint="En jours"
                >
                  <Input
                    id="quoteValidityDays"
                    name="quoteValidityDays"
                    type="number"
                    min={1}
                    max={365}
                    defaultValue={settings.quoteValidityDays}
                    className="tabular"
                  />
                </Field>
                <Field
                  label="Délai de paiement"
                  htmlFor="paymentTermDays"
                  hint="30 jours est l'usage en Suisse."
                >
                  <Input
                    id="paymentTermDays"
                    name="paymentTermDays"
                    type="number"
                    min={0}
                    max={365}
                    defaultValue={settings.paymentTermDays}
                    className="tabular"
                  />
                </Field>
                <Field
                  label="Acompte par défaut"
                  htmlFor="depositPercent"
                  hint="En pourcentage du total."
                >
                  <Input
                    id="depositPercent"
                    name="depositPercent"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={settings.depositPercent}
                    className="tabular"
                    suffix="%"
                  />
                </Field>
                <Field
                  label="Tarif horaire"
                  htmlFor="hourlyRate"
                  hint="Sert à l'aide au chiffrage des projets."
                >
                  <Input
                    id="hourlyRate"
                    name="hourlyRate"
                    defaultValue={settings.hourlyRateFormatted}
                    suffix="CHF"
                    className="tabular text-right pr-14"
                    inputMode="decimal"
                  />
                </Field>
                <Field label="Prix minimum" htmlFor="minimumPrice">
                  <Input
                    id="minimumPrice"
                    name="minimumPrice"
                    defaultValue={settings.minimumPriceFormatted}
                    suffix="CHF"
                    className="tabular text-right pr-14"
                    inputMode="decimal"
                  />
                </Field>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─────────────── E-mail ─────────────── */}
          <TabsContent value="mail" className="space-y-5">
            <Card
              className={
                smtpConfigured
                  ? "border-[var(--success)]/30 bg-[var(--success-soft)]"
                  : "border-[var(--warning)]/35 bg-[var(--warning-soft)]"
              }
            >
              <CardContent className="pt-5 flex items-start gap-3.5">
                {smtpConfigured ? (
                  <CheckCircle2 className="size-5 text-[var(--success)] shrink-0 mt-0.5" />
                ) : (
                  <TriangleAlert className="size-5 text-[var(--warning)] shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-medium text-[var(--fg)]">
                    {smtpConfigured
                      ? "SMTP configuré — les e-mails partent réellement"
                      : "SMTP non configuré — aucun e-mail n'est expédié"}
                  </p>
                  <p className="text-[13px] text-[var(--fg-muted)] mt-1 leading-relaxed">
                    {smtpConfigured
                      ? "Vérifie que SPF, DKIM et DMARC sont bien en place sur ton domaine, sinon les messages finiront en indésirables."
                      : "Renseigne SMTP_HOST, SMTP_USER, SMTP_PASS et SMTP_FROM dans le fichier .env, puis redémarre l'application. Passe par un relais transactionnel (Infomaniak, Postmark, Brevo) — jamais directement depuis le VPS, dont l'IP serait rapidement blacklistée."}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Signature</CardTitle>
                <p className="text-[13px] text-[var(--fg-muted)]">
                  Insérée via la variable {"{{signature}}"} dans tes modèles.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Signature d'e-mail" htmlFor="emailSignature">
                  <Textarea
                    id="emailSignature"
                    name="emailSignature"
                    rows={5}
                    defaultValue={settings.emailSignature ?? ""}
                    placeholder={"Marc\nEncre Noire Tattoo\nRue du Rhône 12, 1204 Genève\n+41 22 123 45 67"}
                  />
                </Field>
                <Field
                  label="Lien pour les avis Google"
                  htmlFor="googleReviewUrl"
                  hint="Utilisé dans le modèle de demande d'avis."
                >
                  <Input
                    id="googleReviewUrl"
                    name="googleReviewUrl"
                    defaultValue={settings.googleReviewUrl ?? ""}
                    placeholder="https://g.page/r/…/review"
                  />
                </Field>
                <Field
                  label="Page de conseils de cicatrisation"
                  htmlFor="aftercareUrl"
                  hint="Lien envoyé après chaque séance."
                >
                  <Input
                    id="aftercareUrl"
                    name="aftercareUrl"
                    defaultValue={settings.aftercareUrl ?? ""}
                    placeholder="https://monsalon.ch/soins"
                  />
                </Field>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="sticky-actions sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-3.5 glass border-t border-[var(--border)] flex items-center justify-end gap-2.5 z-20">
          <Button type="submit" variant="primary" loading={pending}>
            <Save />
            Enregistrer les réglages
          </Button>
        </div>
      </form>

      <PasswordSection />
    </div>
  );
}

function Indicator({
  ok,
  okText,
  koText,
}: {
  ok: boolean;
  okText: string;
  koText: string;
}) {
  return (
    <p
      className={
        "flex items-center gap-1.5 text-[12px] -mt-2 " +
        (ok ? "text-[var(--success)]" : "text-[var(--danger)]")
      }
    >
      {ok ? (
        <CheckCircle2 className="size-3.5 shrink-0" />
      ) : (
        <AlertCircle className="size-3.5 shrink-0" />
      )}
      {ok ? okText : koText}
    </p>
  );
}

function PasswordSection() {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    changePassword,
    {},
  );

  React.useEffect(() => {
    if (state.success) toast.success("Mot de passe modifié");
  }, [state.success]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-[var(--fg-subtle)]" />
          Mot de passe
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4 sm:grid-cols-3 sm:items-end">
          <Field label="Mot de passe actuel" htmlFor="current">
            <Input id="current" name="current" type="password" autoComplete="current-password" />
          </Field>
          <Field label="Nouveau mot de passe" htmlFor="next" hint="10 caractères minimum">
            <Input id="next" name="next" type="password" autoComplete="new-password" />
          </Field>
          <Field label="Confirmation" htmlFor="confirm">
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" />
          </Field>

          {state.error && (
            <p className="sm:col-span-3 text-[13px] text-[var(--danger)]">{state.error}</p>
          )}

          <div className="sm:col-span-3">
            <Button type="submit" variant="secondary" loading={pending}>
              Changer le mot de passe
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
