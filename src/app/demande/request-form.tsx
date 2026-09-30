"use client";

import * as React from "react";
import { startTransition, useActionState } from "react";
import { motion } from "motion/react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ImagePlus,
  Send,
  X,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { submitRequest, type RequestFormState } from "./actions";
import {
  BUDGET_LABELS,
  COLOR_LABELS,
  STYLE_LABELS,
  translatedOptions,
  type FormTexts,
  type Lang,
} from "./i18n";
import { shrinkPhoto } from "@/lib/photo";
import { cn, toDateInput } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CheckboxField, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** Sous la limite d'envoi du serveur (12 Mo), avec de la marge pour le texte. */
const MAX_TOTAL_BYTES = 11 * 1024 * 1024;
const MAX_BODY_PHOTOS = 3;
const MAX_REFERENCES = 6;

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
  const [bodyPhotos, setBodyPhotos] = React.useState<File[]>([]);
  const [references, setReferences] = React.useState<File[]>([]);
  // Photos en cours d'allègement : l'envoi attend qu'elles soient prêtes.
  const [preparing, setPreparing] = React.useState(0);
  const [sizeError, setSizeError] = React.useState<string | null>(null);
  const [hasContraindications, setHasContraindications] = React.useState(false);

  const onBusy = React.useCallback(
    (busy: boolean) => setPreparing((count) => Math.max(0, count + (busy ? 1 : -1))),
    [],
  );

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
        if (preparing > 0) return;
        const total = [...bodyPhotos, ...references].reduce((sum, file) => sum + file.size, 0);
        if (total > MAX_TOTAL_BYTES) {
          setSizeError(t.imagesTooHeavy);
          return;
        }
        setSizeError(null);
        // Les photos, déjà allégées, sont ajoutées ici plutôt que lues dans les champs.
        const data = new FormData(event.currentTarget);
        for (const file of bodyPhotos) data.append("bodyPhotos", file);
        for (const file of references) data.append("references", file);
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

      {/* ── Le projet : emplacement et sa photo, description, puis images ── */}
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
          <Field
            label={t.zoneQuestion}
            htmlFor="bodyZone"
            error={state.fieldErrors?.bodyZone}
            hint={t.zoneHint}
          >
            <Input
              id="bodyZone"
              name="bodyZone"
              maxLength={120}
              autoComplete="off"
              placeholder={t.zonePlaceholder}
            />
          </Field>

          <PhotoPicker
            id="bodyPhotos"
            label={t.bodyPhoto}
            hint={t.bodyPhotoHint}
            icon={Camera}
            addLabel={t.addBodyPhoto}
            addMoreLabel={t.addMoreBodyPhotos}
            formats={t.bodyPhotoFormats}
            max={MAX_BODY_PHOTOS}
            multiple
            files={bodyPhotos}
            onChange={setBodyPhotos}
            onBusy={onBusy}
            texts={t}
          />

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

          <PhotoPicker
            id="references"
            label={t.images}
            hint={t.imagesHint}
            icon={ImagePlus}
            addLabel={t.addImages}
            addMoreLabel={t.addMoreImages}
            formats={t.imageFormats}
            max={MAX_REFERENCES}
            multiple
            files={references}
            onChange={setReferences}
            onBusy={onBusy}
            texts={t}
          />
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

      {sizeError && (
        <p role="alert" className="flex items-start gap-2 text-[13px] text-[var(--danger)]">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          {sizeError}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={pending}
        disabled={preparing > 0}
        className="w-full"
      >
        <Send />
        {preparing > 0 ? t.preparingImages : t.submit}
      </Button>

      <p className="text-center text-[11px] text-[var(--fg-subtle)]">{t.afterSubmit}</p>
    </form>
  );
}

/**
 * Ajout de photos avec aperçu. Sur téléphone, le bouton propose l'appareil
 * photo ou la galerie. Les photos sont allégées avant d'être gardées.
 */
function PhotoPicker({
  id,
  label,
  hint,
  icon: Icon,
  addLabel,
  addMoreLabel,
  formats,
  max,
  multiple = false,
  files,
  onChange,
  onBusy,
  texts: t,
}: {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  addLabel: string;
  addMoreLabel: string;
  formats: string;
  max: number;
  multiple?: boolean;
  files: File[];
  onChange: React.Dispatch<React.SetStateAction<File[]>>;
  onBusy: (busy: boolean) => void;
  texts: FormTexts;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Aperçus locaux, libérés quand la sélection change.
  React.useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  async function add(list: FileList | null) {
    const chosen = Array.from(list ?? []);
    // Vidé pour pouvoir choisir à nouveau la même photo après l'avoir retirée.
    if (inputRef.current) inputRef.current.value = "";
    if (chosen.length === 0) return;

    const supported = chosen.filter((file) => ACCEPTED_TYPES.includes(file.type));
    let problem = supported.length < chosen.length ? t.unsupportedImage : null;
    onBusy(true);
    try {
      const light = await Promise.all(supported.map(shrinkPhoto));
      const fitting = light.filter((file) => file.size <= MAX_IMAGE_BYTES);
      if (fitting.length < light.length) problem = t.imageTooLarge;
      onChange((current) => [...current, ...fitting].slice(0, max));
    } finally {
      onBusy(false);
    }
    setError(problem);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-[13px] font-medium text-[var(--fg-muted)] leading-none">
        {label}
      </span>
      <p id={`${id}-hint`} className="text-xs text-[var(--fg-subtle)] leading-relaxed -mt-0.5 mb-1">
        {hint}
      </p>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => void add(event.target.files)}
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
                onClick={() => onChange((current) => current.filter((_, i) => i !== index))}
                className="absolute top-1 right-1 grid place-items-center size-6 rounded-full bg-black/70 text-white sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                aria-label={t.removeImage}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {files.length < max && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-labelledby={`${id}-label ${id}-action`}
          aria-describedby={`${id}-hint`}
          className={cn(
            "w-full flex flex-col items-center justify-center py-7 px-6",
            "rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)]",
            "transition-all duration-200 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
          )}
        >
          <Icon className="size-5 text-[var(--fg-subtle)]" />
          <span id={`${id}-action`} className="text-[13px] font-medium mt-2.5">
            {files.length > 0 ? addMoreLabel : addLabel}
          </span>
          <span className="text-[11px] text-[var(--fg-subtle)] mt-1">{formats}</span>
        </button>
      )}

      {error && (
        <p role="alert" className="text-xs text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
