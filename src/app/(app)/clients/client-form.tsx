"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Client } from "@prisma/client";
import {
  AlertCircle,
  Save,
  User,
  HeartPulse,
  ShieldCheck,
  MapPin,
  ShieldAlert,
} from "lucide-react";
import { createClient, updateClient, type ClientFormState } from "./actions";
import {
  CLIENT_SOURCE,
  CLIENT_STATUS,
  LANGUAGES,
  MEDICAL_CONDITIONS,
  SKIN_TYPES,
} from "@/lib/constants";
import { parseJsonArray, toDateInput, isMinor, age } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Checkbox,
  CheckboxField,
  Field,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";

export function ClientForm({ client }: { client?: Client }) {
  const action = client ? updateClient : createClient;
  const [state, formAction, pending] = useActionState<ClientFormState, FormData>(
    action,
    {},
  );

  const [conditions, setConditions] = useState<string[]>(
    parseJsonArray(client?.conditions),
  );
  const [birthDate, setBirthDate] = useState(toDateInput(client?.birthDate));

  const minor = birthDate ? isMinor(birthDate) : false;
  const years = birthDate ? age(birthDate) : null;

  function toggleCondition(value: string, checked: boolean) {
    setConditions((current) =>
      checked ? [...current, value] : current.filter((item) => item !== value),
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      {client && <input type="hidden" name="id" value={client.id} />}
      {conditions.map((condition) => (
        <input key={condition} type="hidden" name="conditions" value={condition} />
      ))}

      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-3.5 rounded-[var(--radius-md)] bg-[var(--danger-soft)] border border-[var(--danger)]/25 animate-slide-up"
        >
          <AlertCircle className="size-4 text-[var(--danger)] shrink-0 mt-0.5" />
          <p className="text-[13px] text-[var(--danger)]">{state.error}</p>
        </div>
      )}

      <Tabs defaultValue="identity">
        <TabsList className="w-full sm:w-auto overflow-x-auto">
          <TabsTrigger value="identity">
            <User />
            Identité
          </TabsTrigger>
          <TabsTrigger value="medical">
            <HeartPulse />
            Questionnaire médical
          </TabsTrigger>
          <TabsTrigger value="consent">
            <ShieldCheck />
            Consentements
          </TabsTrigger>
        </TabsList>

        {/* ─────────────── Identité ─────────────── */}
        <TabsContent value="identity" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Coordonnées</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Prénom"
                htmlFor="firstName"
                required
                error={state.fieldErrors?.firstName}
              >
                <Input
                  id="firstName"
                  name="firstName"
                  defaultValue={client?.firstName}
                  required
                  autoFocus={!client}
                  placeholder="Léa"
                />
              </Field>

              <Field
                label="Nom"
                htmlFor="lastName"
                required
                error={state.fieldErrors?.lastName}
              >
                <Input
                  id="lastName"
                  name="lastName"
                  defaultValue={client?.lastName}
                  required
                  placeholder="Morand"
                />
              </Field>

              <Field label="E-mail" htmlFor="email" error={state.fieldErrors?.email}>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={client?.email ?? ""}
                  placeholder="lea.morand@example.ch"
                />
              </Field>

              <Field label="Téléphone" htmlFor="phone">
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={client?.phone ?? ""}
                  placeholder="+41 79 123 45 67"
                />
              </Field>

              <Field label="Instagram" htmlFor="instagram" hint="Sans le @">
                <Input
                  id="instagram"
                  name="instagram"
                  defaultValue={client?.instagram ?? ""}
                  placeholder="lea.morand"
                />
              </Field>

              <Field
                label="Date de naissance"
                htmlFor="birthDate"
                hint={
                  years !== null
                    ? `${years} ans`
                    : "Détermine automatiquement si le client est mineur"
                }
              >
                <Input
                  id="birthDate"
                  name="birthDate"
                  type="date"
                  value={birthDate}
                  onChange={(event) => setBirthDate(event.target.value)}
                  max={toDateInput(new Date())}
                />
              </Field>
            </CardContent>
          </Card>

          {minor && (
            <div className="flex items-start gap-3 p-4 rounded-[var(--radius-md)] bg-[var(--danger-soft)] border border-[var(--danger)]/30 animate-slide-up">
              <ShieldAlert className="size-5 text-[var(--danger)] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[var(--fg)]">
                  Client mineur ({years} ans)
                </p>
                <p className="text-[13px] text-[var(--fg-muted)] mt-1 leading-relaxed">
                  Une autorisation parentale écrite et la pièce d&apos;identité du
                  représentant légal sont obligatoires avant toute séance. Vérifie
                  aussi les règles de ton canton.
                </p>
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="size-4 text-[var(--fg-subtle)]" />
                Adresse
              </CardTitle>
              <p className="text-[13px] text-[var(--fg-muted)]">
                Obligatoire pour établir une facture.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-6">
              <Field label="Rue et numéro" htmlFor="addressLine" className="sm:col-span-6">
                <Input
                  id="addressLine"
                  name="addressLine"
                  defaultValue={client?.addressLine ?? ""}
                  placeholder="Rue du Rhône 12"
                />
              </Field>
              <Field label="NPA" htmlFor="postalCode" className="sm:col-span-2">
                <Input
                  id="postalCode"
                  name="postalCode"
                  defaultValue={client?.postalCode ?? ""}
                  placeholder="1204"
                  inputMode="numeric"
                />
              </Field>
              <Field label="Localité" htmlFor="city" className="sm:col-span-2">
                <Input
                  id="city"
                  name="city"
                  defaultValue={client?.city ?? ""}
                  placeholder="Genève"
                />
              </Field>
              <Field label="Pays" htmlFor="country" className="sm:col-span-2">
                <Select
                  id="country"
                  name="country"
                  defaultValue={client?.country ?? "CH"}
                  options={[
                    { value: "CH", label: "Suisse" },
                    { value: "FR", label: "France" },
                    { value: "DE", label: "Allemagne" },
                    { value: "IT", label: "Italie" },
                    { value: "AT", label: "Autriche" },
                    { value: "other", label: "Autre" },
                  ]}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Suivi</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <Field label="Statut" htmlFor="status">
                <Select
                  id="status"
                  name="status"
                  defaultValue={client?.status ?? "prospect"}
                  options={CLIENT_STATUS.map((o) => ({ value: o.value, label: o.label }))}
                />
              </Field>
              <Field label="Source" htmlFor="source">
                <Select
                  id="source"
                  name="source"
                  defaultValue={client?.source ?? ""}
                  placeholder="Non renseignée"
                  options={CLIENT_SOURCE.map((o) => ({ value: o.value, label: o.label }))}
                />
              </Field>
              <Field
                label="Langue"
                htmlFor="language"
                hint="Langue des e-mails et documents"
              >
                <Select
                  id="language"
                  name="language"
                  defaultValue={client?.language ?? "fr"}
                  options={LANGUAGES.map((o) => ({ value: o.value, label: o.label }))}
                />
              </Field>
              <Field
                label="Notes privées"
                htmlFor="notes"
                className="sm:col-span-3"
                hint="Visibles uniquement par toi, jamais par le client."
              >
                <Textarea
                  id="notes"
                  name="notes"
                  defaultValue={client?.notes ?? ""}
                  placeholder="Préfère les rendez-vous le matin, supporte mal les longues séances…"
                />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────────── Médical ─────────────── */}
        <TabsContent value="medical" className="space-y-5">
          <div className="flex items-start gap-3 p-4 rounded-[var(--radius-md)] bg-[var(--info-soft)] border border-[var(--info)]/25">
            <ShieldCheck className="size-5 text-[var(--info)] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[var(--fg)]">Données sensibles</p>
              <p className="text-[13px] text-[var(--fg-muted)] mt-1 leading-relaxed">
                Ces informations sont des données de santé au sens de la nLPD. Elles ne
                sont visibles que par toi, ne doivent servir qu&apos;à la sécurité de la
                séance, et doivent être revalidées à chaque nouvelle séance.
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Antécédents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label className="mb-2.5 block">Conditions connues</Label>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {MEDICAL_CONDITIONS.map((condition) => (
                    <label
                      key={condition.value}
                      className="flex items-center gap-2.5 p-2.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-subtle)] cursor-pointer transition-colors hover:border-[var(--border-strong)]"
                    >
                      <Checkbox
                        checked={conditions.includes(condition.value)}
                        onCheckedChange={(checked) =>
                          toggleCondition(condition.value, checked === true)
                        }
                      />
                      <span className="text-[13px]">{condition.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Allergies"
                  htmlFor="allergies"
                  hint="Latex, nickel, encres, anesthésiants, pansements…"
                >
                  <Textarea
                    id="allergies"
                    name="allergies"
                    rows={3}
                    defaultValue={client?.allergies ?? ""}
                    placeholder="Aucune connue"
                  />
                </Field>
                <Field
                  label="Traitements en cours"
                  htmlFor="medications"
                  hint="Anticoagulants, immunosuppresseurs, isotrétinoïne…"
                >
                  <Textarea
                    id="medications"
                    name="medications"
                    rows={3}
                    defaultValue={client?.medications ?? ""}
                    placeholder="Aucun"
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Phototype de peau"
                  htmlFor="skinType"
                  hint="Influence le rendu et la cicatrisation"
                >
                  <Select
                    id="skinType"
                    name="skinType"
                    defaultValue={client?.skinType ?? ""}
                    placeholder="Non déterminé"
                    options={SKIN_TYPES.map((o) => ({ value: o.value, label: o.label }))}
                  />
                </Field>
                <div className="space-y-3 pt-6">
                  <CheckboxField
                    id="pregnant"
                    name="pregnant"
                    label="Grossesse ou allaitement"
                    hint="Contre-indication à reporter la séance"
                    defaultChecked={client?.pregnant}
                  />
                  <CheckboxField
                    id="keloidProne"
                    name="keloidProne"
                    label="Tendance aux chéloïdes"
                    hint="Cicatrisation à surveiller de près"
                    defaultChecked={client?.keloidProne}
                  />
                </div>
              </div>

              <Field label="Remarques médicales" htmlFor="medicalNotes">
                <Textarea
                  id="medicalNotes"
                  name="medicalNotes"
                  defaultValue={client?.medicalNotes ?? ""}
                  placeholder="Malaise lors d'une séance précédente, faire des pauses régulières…"
                />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────────── Consentements ─────────────── */}
        <TabsContent value="consent" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Consentements</CardTitle>
              <p className="text-[13px] text-[var(--fg-muted)]">
                Chaque consentement doit être donné séparément et reste révocable.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 divide-y divide-[var(--border)]">
              <div className="pt-0">
                <CheckboxField
                  id="imageConsent"
                  name="imageConsent"
                  label="Droit à l'image"
                  hint="Autorise la publication des photos du tatouage sur Instagram, le site et le book. Sans cette case, aucune photo ne doit être publiée."
                  defaultChecked={client?.imageConsent}
                />
              </div>
              <div className="pt-4">
                <CheckboxField
                  id="marketingConsent"
                  name="marketingConsent"
                  label="Communications commerciales"
                  hint="Autorise l'envoi d'offres, de nouveautés et de messages d'anniversaire. N'affecte pas les e-mails liés aux rendez-vous et aux factures."
                  defaultChecked={client?.marketingConsent}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Barre d'action collante */}
      <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3.5 glass border-t border-[var(--border)] flex items-center justify-end gap-2.5 z-20">
        <Button asChild variant="ghost" size="md" type="button">
          <Link href={client ? `/clients/${client.id}` : "/clients"}>Annuler</Link>
        </Button>
        <Button type="submit" variant="primary" size="md" loading={pending}>
          <Save />
          {client ? "Enregistrer" : "Créer le client"}
        </Button>
      </div>
    </form>
  );
}
