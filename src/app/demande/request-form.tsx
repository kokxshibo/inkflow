"use client";

import * as React from "react";
import { useActionState } from "react";
import { motion } from "motion/react";
import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  Send,
  X,
  Sparkles,
} from "lucide-react";
import { submitRequest, type RequestFormState } from "./actions";
import { BODY_ZONES, COLOR_MODE, PROJECT_STYLE } from "@/lib/constants";
import { cn, toDateInput } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CheckboxField, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BUDGETS = [
  "Moins de 300 CHF",
  "300 – 600 CHF",
  "600 – 1'000 CHF",
  "1'000 – 2'000 CHF",
  "Plus de 2'000 CHF",
  "Je ne sais pas encore",
];

export interface RequestPrefill {
  firstName?: string;
  lastName?: string;
  email?: string;
  instagram?: string;
}

export function RequestForm({
  studioName,
  refToken,
  prefill = {},
}: {
  studioName: string;
  /** Jeton du lien perso : rattache la demande à la conversation Instagram / Gmail. */
  refToken?: string;
  prefill?: RequestPrefill;
}) {
  const [state, formAction, pending] = useActionState<RequestFormState, FormData>(
    submitRequest,
    {},
  );
  const [files, setFiles] = React.useState<File[]>([]);
  const [previews, setPreviews] = React.useState<string[]>([]);
  const [hasContraindications, setHasContraindications] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Prévisualisation locale des images choisies
  React.useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((current) => [...current, ...Array.from(list)].slice(0, 6));
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, i) => i !== index));
  }

  // Synchronise la sélection locale avec l'input du formulaire
  React.useEffect(() => {
    if (!inputRef.current) return;
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    inputRef.current.files = transfer.files;
  }, [files]);

  if (state.success) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card className="p-10 text-center">
          <span className="inline-grid place-items-center size-14 rounded-full bg-[var(--success-soft)] text-[var(--success)] mb-5">
            <CheckCircle2 className="size-7" />
          </span>
          <h2 className="text-xl font-semibold tracking-[-0.02em]">Demande envoyée</h2>
          <p className="text-[14px] text-[var(--fg-muted)] mt-3 leading-relaxed max-w-md mx-auto">
            Merci ! Ta demande est bien arrivée chez {studioName}. Tu recevras une
            réponse par e-mail — en général sous quelques jours. Pense à vérifier tes
            indésirables.
          </p>
        </Card>
      </motion.div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {refToken && <input type="hidden" name="ref" value={refToken} />}

      {/* Piège anti-robot : invisible pour les humains */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute opacity-0 pointer-events-none size-0"
      />

      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-3.5 rounded-[var(--radius-md)] bg-[var(--danger-soft)] border border-[var(--danger)]/25 animate-slide-up"
        >
          <AlertCircle className="size-4 text-[var(--danger)] shrink-0 mt-0.5" />
          <p className="text-[13px] text-[var(--danger)]">{state.error}</p>
        </div>
      )}

      {/* ── Qui es-tu ── */}
      <Card>
        <CardHeader>
          <CardTitle>Qui es-tu ?</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom" htmlFor="firstName" required error={state.fieldErrors?.firstName}>
            <Input
              id="firstName"
              name="firstName"
              required
              placeholder="Léa"
              defaultValue={prefill.firstName}
            />
          </Field>
          <Field label="Nom" htmlFor="lastName" required error={state.fieldErrors?.lastName}>
            <Input
              id="lastName"
              name="lastName"
              required
              placeholder="Morand"
              defaultValue={prefill.lastName}
            />
          </Field>
          <Field label="E-mail" htmlFor="email" required error={state.fieldErrors?.email}>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="lea.morand@example.ch"
              defaultValue={prefill.email}
            />
          </Field>
          <Field label="Téléphone" htmlFor="phone" hint="Facultatif">
            <Input id="phone" name="phone" type="tel" placeholder="+41 79 123 45 67" />
          </Field>
          <Field label="Instagram" htmlFor="instagram" hint="Facultatif, sans le @">
            <Input
              id="instagram"
              name="instagram"
              placeholder="lea.morand"
              defaultValue={prefill.instagram}
            />
          </Field>
          <Field label="Date de naissance" htmlFor="birthDate" hint="Facultatif">
            <Input
              id="birthDate"
              name="birthDate"
              type="date"
              max={toDateInput(new Date())}
            />
          </Field>
        </CardContent>
      </Card>

      {/* ── Le projet ── */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-[var(--accent)]" />
              Ton projet
            </CardTitle>
            <p className="text-[13px] text-[var(--fg-muted)] mt-0.5">
              Plus tu es précis·e, plus la réponse sera rapide.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            label="Décris ton idée"
            htmlFor="description"
            required
            error={state.fieldErrors?.description}
            hint="Le motif, l'ambiance, ce que ça représente pour toi, ce que tu veux éviter…"
          >
            <Textarea
              id="description"
              name="description"
              required
              rows={6}
              placeholder="J'aimerais une carpe koï qui remonte le bras, avec des vagues en fond et des feuilles d'érable. Plutôt dans un style japonais traditionnel. J'aimerais éviter le rouge vif."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Emplacement sur le corps" htmlFor="bodyZone">
              <Select
                id="bodyZone"
                name="bodyZone"
                placeholder="Je ne sais pas encore"
                options={BODY_ZONES.map((o) => ({ value: o.value, label: o.label }))}
              />
            </Field>
            <Field label="Taille approximative" htmlFor="sizeCm" hint="Par exemple : 15 x 20 cm">
              <Input id="sizeCm" name="sizeCm" placeholder="15 x 20 cm" />
            </Field>
            <Field label="Rendu souhaité" htmlFor="colorMode">
              <Select
                id="colorMode"
                name="colorMode"
                defaultValue="blackgrey"
                options={COLOR_MODE.map((o) => ({ value: o.value, label: o.label }))}
              />
            </Field>
            <Field label="Style" htmlFor="style">
              <Select
                id="style"
                name="style"
                placeholder="Je fais confiance"
                options={PROJECT_STYLE.map((o) => ({ value: o.value, label: o.label }))}
              />
            </Field>
            <Field label="Budget envisagé" htmlFor="budget">
              <Select
                id="budget"
                name="budget"
                placeholder="Non précisé"
                options={BUDGETS.map((b) => ({ value: b, label: b }))}
              />
            </Field>
            <Field label="Tes disponibilités" htmlFor="availability">
              <Input
                id="availability"
                name="availability"
                placeholder="Plutôt en semaine, après 16 h"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* ── Références ── */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Images de référence</CardTitle>
            <p className="text-[13px] text-[var(--fg-muted)] mt-0.5">
              Jusqu&apos;à 6 images — inspirations, photos de la zone, croquis.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <input
            ref={inputRef}
            type="file"
            name="references"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            className="sr-only"
            onChange={(event) => addFiles(event.target.files)}
          />

          {previews.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mb-3">
              {previews.map((preview, index) => (
                <div
                  key={preview}
                  className="relative aspect-square rounded-[var(--radius-md)] overflow-hidden border border-[var(--border)] group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="" className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="absolute top-1 right-1 grid place-items-center size-6 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Retirer cette image"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {files.length < 6 && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={cn(
                "w-full flex flex-col items-center justify-center py-8 px-6",
                "rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)]",
                "transition-all duration-200 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]",
              )}
            >
              <ImagePlus className="size-5 text-[var(--fg-subtle)]" />
              <span className="text-[13px] font-medium mt-2.5">
                Ajouter des images
              </span>
              <span className="text-[11px] text-[var(--fg-subtle)] mt-1">
                JPG, PNG ou WebP · 8 Mo maximum
              </span>
            </button>
          )}
        </CardContent>
      </Card>

      {/* ── Santé et accords ── */}
      <Card>
        <CardHeader>
          <CardTitle>Quelques vérifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CheckboxField
            id="hasContraindications"
            name="hasContraindications"
            label="J'ai une condition médicale à signaler"
            hint="Allergie, traitement en cours, grossesse, problème de peau, trouble de la coagulation…"
            checked={hasContraindications}
            onCheckedChange={setHasContraindications}
          />

          {hasContraindications && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <Field
                label="Précise"
                htmlFor="contraindications"
                hint="Cette information reste confidentielle et sert uniquement à la sécurité de la séance."
              >
                <Textarea
                  id="contraindications"
                  name="contraindications"
                  rows={3}
                  placeholder="Allergie au latex, traitement anticoagulant…"
                />
              </Field>
            </motion.div>
          )}

          <div className="pt-4 border-t border-[var(--border)] space-y-3.5">
            <CheckboxField
              id="isAdult"
              name="isAdult"
              label="Je certifie être majeur·e (18 ans révolus)"
              hint="Une pièce d'identité pourra être demandée au salon."
            />
            {state.fieldErrors?.isAdult && (
              <p className="text-xs text-[var(--danger)] ml-7">
                {state.fieldErrors.isAdult}
              </p>
            )}

            <CheckboxField
              id="consentGiven"
              name="consentGiven"
              label="J'accepte que mes données soient utilisées pour traiter ma demande"
              hint="Elles ne servent qu'à ça, ne sont jamais transmises à des tiers, et je peux demander leur suppression à tout moment."
            />
            {state.fieldErrors?.consentGiven && (
              <p className="text-xs text-[var(--danger)] ml-7">
                {state.fieldErrors.consentGiven}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={pending}
        className="w-full"
      >
        <Send />
        Envoyer ma demande
      </Button>

      <p className="text-center text-[11px] text-[var(--fg-subtle)]">
        Tu recevras une réponse par e-mail.
      </p>
    </form>
  );
}
