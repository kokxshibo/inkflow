"use client";

import * as React from "react";
import { startTransition, useActionState } from "react";
import { motion } from "motion/react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ImagePlus,
  Send,
  X,
  Sparkles,
} from "lucide-react";
import { submitRequest, type RequestFormState } from "./actions";
import {
  BUDGET_LABELS,
  COLOR_LABELS,
  STYLE_LABELS,
  ZONE_LABELS,
  translatedOptions,
  type FormTexts,
  type Lang,
} from "./i18n";
import { cn, toDateInput } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CheckboxField, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface RequestPrefill {
  firstName?: string;
  lastName?: string;
  email?: string;
  instagram?: string;
}

export function RequestForm({
  lang,
  texts: t,
  refToken,
  prefill = {},
}: {
  lang: Lang;
  texts: FormTexts;
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
  // null : aucun emplacement choisi ; "" : « je ne sais pas encore ».
  const [zone, setZone] = React.useState<string | null>(null);
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
          <h2 className="text-xl font-semibold tracking-[-0.02em]">{t.successTitle}</h2>
          <p className="text-[14px] text-[var(--fg-muted)] mt-3 leading-relaxed max-w-md mx-auto">
            {t.successText}
          </p>
        </Card>
      </motion.div>
    );
  }

  return (
    <form
      // Envoi sans réinitialisation : en cas d'erreur, le texte et les photos
      // restent en place au lieu d'être effacés.
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="space-y-5"
    >
      <input type="hidden" name="lang" value={lang} />
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
          <CardTitle>{t.who}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label={t.firstName} htmlFor="firstName" required error={state.fieldErrors?.firstName}>
            <Input
              id="firstName"
              name="firstName"
              required
              autoComplete="given-name"
              placeholder="Léa"
              defaultValue={prefill.firstName}
            />
          </Field>
          <Field label={t.lastName} htmlFor="lastName" required error={state.fieldErrors?.lastName}>
            <Input
              id="lastName"
              name="lastName"
              required
              autoComplete="family-name"
              placeholder="Morand"
              defaultValue={prefill.lastName}
            />
          </Field>
          <Field label={t.email} htmlFor="email" required error={state.fieldErrors?.email}>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="lea.morand@example.ch"
              defaultValue={prefill.email}
            />
          </Field>
          <Field label={t.phone} htmlFor="phone" hint={t.optional}>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+41 79 123 45 67"
            />
          </Field>
          <Field label="Instagram" htmlFor="instagram" hint={t.instagramHint}>
            <Input
              id="instagram"
              name="instagram"
              placeholder="lea.morand"
              defaultValue={prefill.instagram}
            />
          </Field>
          <Field label={t.birthDate} htmlFor="birthDate" hint={t.optional}>
            <Input
              id="birthDate"
              name="birthDate"
              type="date"
              max={toDateInput(new Date())}
            />
          </Field>
        </CardContent>
      </Card>

      {/* ── Le projet : emplacement, description, puis images ── */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-[var(--accent)]" />
              {t.project}
            </CardTitle>
            <p className="text-[13px] text-[var(--fg-muted)] mt-0.5">{t.projectIntro}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-1.5">
            <span id="bodyZone-label" className="text-[13px] font-medium text-[var(--fg-muted)]">
              {t.zoneQuestion}
            </span>
            <input type="hidden" name="bodyZone" value={zone ?? ""} />
            <ZonePicker
              value={zone}
              onChange={setZone}
              options={[
                ...translatedOptions(ZONE_LABELS, lang),
                { value: "", label: t.zoneUnknown },
              ]}
            />
          </div>

          <Field
            label={t.description}
            htmlFor="description"
            required
            error={state.fieldErrors?.description}
            hint={t.descriptionHint}
          >
            <Textarea
              id="description"
              name="description"
              required
              rows={6}
              placeholder={t.descriptionPlaceholder}
            />
          </Field>

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--fg-muted)]">{t.images}</span>
            <p className="text-xs text-[var(--fg-subtle)] leading-relaxed -mt-0.5 mb-1">
              {t.imagesHint}
            </p>
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
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mb-1">
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
                      className="absolute top-1 right-1 grid place-items-center size-6 rounded-full bg-black/70 text-white sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      aria-label={t.removeImage}
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
                  "w-full flex flex-col items-center justify-center py-7 px-6",
                  "rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)]",
                  "transition-all duration-200 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]",
                )}
              >
                <ImagePlus className="size-5 text-[var(--fg-subtle)]" />
                <span className="text-[13px] font-medium mt-2.5">
                  {files.length > 0 ? t.addMoreImages : t.addImages}
                </span>
                <span className="text-[11px] text-[var(--fg-subtle)] mt-1">{t.imageFormats}</span>
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Précisions ── */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t.details}</CardTitle>
            <p className="text-[13px] text-[var(--fg-muted)] mt-0.5">{t.detailsIntro}</p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label={t.size} htmlFor="sizeCm" hint={t.sizeHint}>
            <Input id="sizeCm" name="sizeCm" placeholder="15 x 20 cm" />
          </Field>
          <Field label={t.colorMode} htmlFor="colorMode">
            <Select
              id="colorMode"
              name="colorMode"
              defaultValue="blackgrey"
              options={translatedOptions(COLOR_LABELS, lang)}
            />
          </Field>
          <Field label={t.style} htmlFor="style">
            <Select
              id="style"
              name="style"
              placeholder={t.stylePlaceholder}
              options={translatedOptions(STYLE_LABELS, lang)}
            />
          </Field>
          <Field label={t.budget} htmlFor="budget">
            <Select
              id="budget"
              name="budget"
              placeholder={t.budgetPlaceholder}
              options={translatedOptions(BUDGET_LABELS, lang)}
            />
          </Field>
          <Field label={t.availability} htmlFor="availability" className="sm:col-span-2">
            <Input id="availability" name="availability" placeholder={t.availabilityPlaceholder} />
          </Field>
        </CardContent>
      </Card>

      {/* ── Santé et accords ── */}
      <Card>
        <CardHeader>
          <CardTitle>{t.checks}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CheckboxField
            id="hasContraindications"
            name="hasContraindications"
            label={t.medical}
            hint={t.medicalHint}
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
              <Field label={t.medicalDetail} htmlFor="contraindications" hint={t.medicalDetailHint}>
                <Textarea
                  id="contraindications"
                  name="contraindications"
                  rows={3}
                  placeholder={t.medicalPlaceholder}
                />
              </Field>
            </motion.div>
          )}

          <div className="pt-4 border-t border-[var(--border)] space-y-3.5">
            <CheckboxField id="isAdult" name="isAdult" label={t.adult} hint={t.adultHint} />
            {state.fieldErrors?.isAdult && (
              <p className="text-xs text-[var(--danger)] ml-7">{state.fieldErrors.isAdult}</p>
            )}

            <CheckboxField
              id="consentGiven"
              name="consentGiven"
              label={t.consent}
              hint={t.consentHint}
            />
            {state.fieldErrors?.consentGiven && (
              <p className="text-xs text-[var(--danger)] ml-7">{state.fieldErrors.consentGiven}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Button type="submit" variant="primary" size="lg" loading={pending} className="w-full">
        <Send />
        {t.submit}
      </Button>

      <p className="text-center text-[11px] text-[var(--fg-subtle)]">{t.afterSubmit}</p>
    </form>
  );
}

/** Choix de l'emplacement : des cases à toucher, plus rapides qu'une liste au pouce. */
function ZonePicker({
  value,
  onChange,
  options,
}: {
  value: string | null;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div
      role="radiogroup"
      aria-labelledby="bodyZone-label"
      className="grid grid-cols-2 sm:grid-cols-3 gap-2"
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value || "unknown"}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex items-center justify-between gap-2 min-h-11 px-3 py-2 text-left",
              "rounded-[var(--radius-md)] border text-[13px] font-medium",
              "transition-all duration-200 active:scale-[0.985]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
              selected
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--fg)]"
                : "border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--fg-muted)] hover:border-[var(--border-strong)]",
              option.value === "" && "sm:col-span-2 justify-center",
            )}
          >
            <span>{option.label}</span>
            {selected && option.value !== "" && (
              <Check className="size-3.5 shrink-0 text-[var(--accent)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
