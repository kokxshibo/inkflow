"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  Info,
  Pencil,
  RotateCcw,
  ShieldAlert,
  UserPlus,
  Users,
  Wand2,
} from "lucide-react";
import {
  createClient,
  findSimilarClients,
  type ClientFormState,
  type SimilarClient,
} from "../actions";
import {
  CLIENT_SOURCE,
  LANGUAGES,
  MEDICAL_CONDITIONS,
  SKIN_TYPES,
  labelOf,
} from "@/lib/constants";
import {
  ADDRESS_COUNTRIES,
  EMPTY_BIRTH,
  ageFromIso,
  birthPartsToIso,
  buildPhone,
  capitalizeName,
  isValidEmail,
  isValidInstagram,
  normalizeEmail,
  normalizeInstagram,
  suggestEmailFix,
  validateBirthParts,
  validatePhone,
  validatePostalCode,
  type BirthParts,
} from "@/lib/client-input";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { ChoiceGroup, ToggleChip, YesNo } from "@/components/ui/choice";
import { BirthDateInput } from "@/components/ui/birth-date-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { ConfirmDialog } from "@/components/ui/dialog";

/* ═════════════════════════════ Données ═════════════════════════════ */

interface Draft {
  firstName: string;
  lastName: string;
  birth: BirthParts;
  birthUnknown: boolean;
  email: string;
  phoneCountry: string;
  phoneLocal: string;

  addressLine: string;
  postalCode: string;
  city: string;
  country: string;
  addressSkipped: boolean;

  source: string;
  instagram: string;
  language: string;

  hasHealthIssues: boolean | null;
  conditions: string[];
  allergies: string;
  medications: string;
  pregnant: boolean;
  keloidProne: boolean;
  skinType: string;
  medicalNotes: string;

  imageConsent: boolean | null;
  marketingConsent: boolean | null;

  notes: string;
}

const INITIAL: Draft = {
  firstName: "",
  lastName: "",
  birth: EMPTY_BIRTH,
  birthUnknown: false,
  email: "",
  phoneCountry: "CH",
  phoneLocal: "",
  addressLine: "",
  postalCode: "",
  city: "",
  country: "CH",
  addressSkipped: false,
  source: "",
  instagram: "",
  language: "fr",
  hasHealthIssues: null,
  conditions: [],
  allergies: "",
  medications: "",
  pregnant: false,
  keloidProne: false,
  skinType: "",
  medicalNotes: "",
  imageConsent: null,
  marketingConsent: null,
  notes: "",
};

type Errors = Record<string, string>;

const STEPS = [
  {
    label: "Identité",
    question: "Qui est ton client ?",
    description:
      "Son nom, sa date de naissance et au moins un moyen de le joindre.",
  },
  {
    label: "Adresse",
    question: "Quelle est son adresse ?",
    description:
      "Elle figure obligatoirement sur ses factures et sur la QR-facture.",
  },
  {
    label: "Origine",
    question: "D'où vient ce contact ?",
    description:
      "Pour savoir, avec le temps, ce qui t'amène vraiment des clients.",
  },
  {
    label: "Santé",
    question: "Des points de santé à connaître ?",
    description:
      "Allergies, traitements, grossesse… Données sensibles : elles ne sont visibles que par toi.",
  },
  {
    label: "Accords",
    question: "Qu'est-ce que le client autorise ?",
    description:
      "Chaque accord doit être donné explicitement par le client. Il reste révocable à tout moment.",
  },
  {
    label: "Vérification",
    question: "Tout est correct ?",
    description:
      "Relis avant d'enregistrer. Chaque bloc peut encore être modifié.",
  },
] as const;

const REVIEW_STEP = STEPS.length - 1;

/** Étape à laquelle renvoyer si le serveur refuse un champ. */
const FIELD_STEP: Record<string, number> = {
  firstName: 0,
  lastName: 0,
  birthDate: 0,
  email: 0,
  phone: 0,
  addressLine: 1,
  postalCode: 1,
  city: 1,
  country: 1,
  source: 2,
  instagram: 2,
  language: 2,
  allergies: 3,
  medications: 3,
  skinType: 3,
  medicalNotes: 3,
  imageConsent: 4,
  marketingConsent: 4,
  notes: 5,
};

const STORAGE_KEY = "inkflow:nouveau-client";
const STORAGE_VERSION = 2;
/**
 * Un brouillon plus vieux que ça est abandonné : il peut contenir des données
 * de santé, qui n'ont pas à traîner sur l'appareil.
 */
const STORAGE_TTL_MS = 12 * 60 * 60 * 1000;

/* ═══════════════════════════ Validation ═══════════════════════════ */

function validateStep(step: number, draft: Draft): Errors {
  const errors: Errors = {};

  if (step === 0) {
    if (!draft.firstName.trim()) errors.firstName = "Le prénom est requis.";
    if (!draft.lastName.trim()) errors.lastName = "Le nom est requis.";

    if (!draft.birthUnknown) {
      const birthError = validateBirthParts(draft.birth);
      if (birthError) errors.birthDate = birthError;
    }

    const email = draft.email.trim();
    if (email && !isValidEmail(email)) {
      errors.email = "Adresse e-mail invalide — vérifie le @ et le domaine.";
    }

    const phoneError = validatePhone(draft.phoneCountry, draft.phoneLocal);
    if (phoneError) errors.phone = phoneError;

    if (!email && !draft.phoneLocal.trim()) {
      errors.contact =
        "Il faut au moins un e-mail ou un téléphone pour joindre le client.";
    }
  }

  if (step === 1 && !draft.addressSkipped) {
    const anyFilled = Boolean(
      draft.addressLine.trim() || draft.postalCode.trim() || draft.city.trim(),
    );
    if (!anyFilled) {
      errors.address = "Renseigne l'adresse, ou choisis « Plus tard ».";
    } else {
      // Une adresse partielle est inutilisable sur une facture : tout ou rien.
      if (!draft.addressLine.trim())
        errors.addressLine = "La rue et le numéro sont requis.";
      const postalError = validatePostalCode(draft.country, draft.postalCode);
      if (postalError) errors.postalCode = postalError;
      if (!draft.city.trim()) errors.city = "La localité est requise.";
    }
  }

  if (step === 2) {
    if (!draft.source) errors.source = "Choisis une réponse.";
    const instagram = normalizeInstagram(draft.instagram);
    if (instagram && !isValidInstagram(instagram)) {
      errors.instagram =
        "Nom d'utilisateur invalide : lettres, chiffres, points et _ uniquement.";
    }
  }

  if (step === 3) {
    if (draft.hasHealthIssues === null) {
      errors.hasHealthIssues = "Réponds par oui ou par non.";
    } else if (draft.hasHealthIssues) {
      const detailed =
        draft.conditions.length > 0 ||
        draft.pregnant ||
        draft.keloidProne ||
        Boolean(
          draft.allergies.trim() ||
          draft.medications.trim() ||
          draft.medicalNotes.trim(),
        );
      if (!detailed) {
        errors.healthDetails =
          "Précise au moins un point ci-dessous, ou réponds « Non ».";
      }
    }
  }

  if (step === 4) {
    if (draft.imageConsent === null)
      errors.imageConsent = "Réponds par oui ou par non.";
    if (draft.marketingConsent === null)
      errors.marketingConsent = "Réponds par oui ou par non.";
  }

  return errors;
}

/* ═════════════════════════════ Assistant ═════════════════════════════ */

export function ClientWizard() {
  const router = useRouter();
  const [state, formAction, submitting] = useActionState<
    ClientFormState,
    FormData
  >(createClient, {});

  const [draft, setDraftState] = React.useState<Draft>(INITIAL);
  const draftRef = React.useRef<Draft>(INITIAL);
  const [step, setStep] = React.useState(0);
  const [direction, setDirection] = React.useState(1);
  const [errors, setErrors] = React.useState<Errors>({});
  const [returnToReview, setReturnToReview] = React.useState(false);

  const [hydrated, setHydrated] = React.useState(false);
  const [restored, setRestored] = React.useState(false);
  const [confirmCancel, setConfirmCancel] = React.useState(false);

  const [checking, setChecking] = React.useState(false);
  const [duplicates, setDuplicates] = React.useState<SimilarClient[]>([]);
  const [duplicatesKey, setDuplicatesKey] = React.useState("");
  const [acknowledgedKey, setAcknowledgedKey] = React.useState("");

  const stepRef = React.useRef<HTMLDivElement>(null);

  /** Remplace le brouillon en gardant le miroir synchrone à jour. */
  const setDraft = React.useCallback(
    (next: Draft | ((current: Draft) => Draft)) => {
      const value = typeof next === "function" ? next(draftRef.current) : next;
      draftRef.current = value;
      setDraftState(value);
    },
    [],
  );

  const dirty = JSON.stringify(draft) !== JSON.stringify(INITIAL);
  const birthIso = draft.birthUnknown ? null : birthPartsToIso(draft.birth);
  const age = birthIso ? ageFromIso(birthIso) : null;
  const phone = buildPhone(draft.phoneCountry, draft.phoneLocal);
  const identityKey = [draft.firstName, draft.lastName, draft.email, phone]
    .map((part) => part.trim().toLowerCase())
    .join("|");

  /* ── Brouillon : survit à un rechargement ou à un passage dans une autre app ── */

  React.useEffect(() => {
    try {
      // localStorage plutôt que sessionStorage : si iOS ferme l'app en
      // arrière-plan pour libérer de la mémoire, la saisie est retrouvée.
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          version: number;
          step: number;
          draft: Draft;
          savedAt?: number;
        };
        const fresh = Date.now() - (saved.savedAt ?? 0) < STORAGE_TTL_MS;
        if (!fresh || saved.version !== STORAGE_VERSION) {
          localStorage.removeItem(STORAGE_KEY);
        } else {
          setDraft({ ...INITIAL, ...saved.draft });
          setStep(Math.min(Math.max(saved.step, 0), REVIEW_STEP));
          setRestored(true);
        }
      }
    } catch {
      // Stockage indisponible (navigation privée) : on repart simplement de zéro.
    }
    setHydrated(true);
  }, []);

  const saveDraft = React.useCallback(() => {
    try {
      if (dirty) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            version: STORAGE_VERSION,
            step,
            draft,
            savedAt: Date.now(),
          }),
        );
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [dirty, draft, step]);

  React.useEffect(() => {
    if (hydrated) saveDraft();
  }, [hydrated, saveDraft]);

  function clearDraft() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  /* ── Refus du serveur : retour à la bonne étape ── */

  React.useEffect(() => {
    if (!state.error) return;
    saveDraft();
    const fieldErrors = state.fieldErrors ?? {};
    const steps = Object.keys(fieldErrors)
      .map((key) => FIELD_STEP[key])
      .filter((value): value is number => value !== undefined);
    if (steps.length > 0) {
      setErrors(fieldErrors);
      setDirection(-1);
      setStep(Math.min(...steps));
      setReturnToReview(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  /* ── Changement d'étape : haut de page et premier champ ── */

  React.useEffect(() => {
    if (!hydrated) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Seules les étapes à saisie clavier reçoivent le focus automatiquement.
    if (step > 1) return;
    const timer = window.setTimeout(() => {
      stepRef.current
        ?.querySelector<HTMLInputElement>("input:not([type=hidden])")
        ?.focus({ preventScroll: true });
    }, 260);
    return () => window.clearTimeout(timer);
  }, [step, hydrated]);

  /* ── Mise à jour d'un champ : efface l'erreur correspondante ── */

  function update<K extends keyof Draft>(
    key: K,
    value: Draft[K] | ((previous: Draft[K]) => Draft[K]),
    ...alsoClear: string[]
  ) {
    const current = draftRef.current;
    const nextValue =
      typeof value === "function"
        ? (value as (previous: Draft[K]) => Draft[K])(current[key])
        : value;
    // Sortie d'un champ sans modification : l'erreur affichée doit rester.
    if (JSON.stringify(current[key]) === JSON.stringify(nextValue)) return;
    setDraft({ ...current, [key]: nextValue });
    setErrors((current) => {
      const keys = [key as string, ...alsoClear];
      if (!keys.some((k) => current[k])) return current;
      const next = { ...current };
      for (const k of keys) delete next[k];
      return next;
    });
  }

  function focusFirstError() {
    window.setTimeout(() => {
      const target = stepRef.current?.querySelector<HTMLElement>(
        "[aria-invalid='true'], [data-error='true']",
      );
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      if (target instanceof HTMLInputElement)
        target.focus({ preventScroll: true });
    }, 50);
  }

  /* ── Navigation ── */

  function goTo(target: number, fromReview = false) {
    setDirection(target > step ? 1 : -1);
    setErrors({});
    setReturnToReview(fromReview);
    setStep(target);
  }

  async function goNext() {
    const stepErrors = validateStep(step, draft);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      focusFirstError();
      return;
    }

    // Avant de quitter l'identité : ce client existe-t-il déjà ?
    if (step === 0 && acknowledgedKey !== identityKey) {
      setChecking(true);
      try {
        const matches = await findSimilarClients({
          firstName: draft.firstName,
          lastName: draft.lastName,
          email: draft.email,
          phone,
        });
        if (matches.length > 0) {
          setDuplicates(matches);
          setDuplicatesKey(identityKey);
          return;
        }
        setAcknowledgedKey(identityKey);
      } catch {
        // La vérification est un confort : un échec réseau ne doit pas bloquer la saisie.
      } finally {
        setChecking(false);
      }
    }

    setErrors({});
    setDirection(1);
    if (returnToReview) {
      setReturnToReview(false);
      setStep(REVIEW_STEP);
    } else {
      setStep((current) => Math.min(current + 1, REVIEW_STEP));
    }
  }

  function goBack() {
    if (step === 0) return;
    setDirection(-1);
    setErrors({});
    setReturnToReview(false);
    setStep((current) => current - 1);
  }

  function skipAddress() {
    setDraft((current) => ({
      ...current,
      addressSkipped: true,
      addressLine: "",
      postalCode: "",
      city: "",
    }));
    setErrors({});
    setDirection(1);
    setStep(returnToReview ? REVIEW_STEP : 2);
    setReturnToReview(false);
  }

  function continueDespiteDuplicates() {
    setAcknowledgedKey(identityKey);
    setDuplicates([]);
    setDirection(1);
    setStep(returnToReview ? REVIEW_STEP : 1);
    setReturnToReview(false);
  }

  function restart() {
    clearDraft();
    setDraft(INITIAL);
    setStep(0);
    setErrors({});
    setRestored(false);
    setAcknowledgedKey("");
    setDuplicates([]);
  }

  function cancel() {
    if (dirty) {
      setConfirmCancel(true);
    } else {
      router.push("/clients");
    }
  }

  /**
   * « Entrée » passe au champ suivant ; sur le dernier champ, valide l'étape.
   * C'est aussi ce que déclenche la touche « Suivant » du clavier iOS.
   */
  function onStepKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter") return;
    const target = event.target as HTMLElement;
    if (target.tagName !== "INPUT") return;

    const fields = Array.from(
      stepRef.current?.querySelectorAll<HTMLInputElement>(
        "input:not([type=hidden]):not([disabled])",
      ) ?? [],
    );
    const index = fields.indexOf(target as HTMLInputElement);
    if (index > -1 && index < fields.length - 1) {
      event.preventDefault();
      fields[index + 1].focus();
    }
  }

  const showDuplicates =
    step === 0 && duplicates.length > 0 && duplicatesKey === identityKey;

  /* ═══════════════════════════ Rendu ═══════════════════════════ */

  const current = STEPS[step];

  return (
    <>
      <div className="max-w-xl mx-auto">
        <Link
          href="/clients"
          onClick={(event) => {
            if (dirty) {
              event.preventDefault();
              setConfirmCancel(true);
            }
          }}
          className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors mb-4"
        >
          <ChevronLeft className="size-3.5" />
          Clients
        </Link>

        <StepIndicator
          step={step}
          onJump={(target) => goTo(target, step === REVIEW_STEP)}
        />

        {restored && dirty && (
          <div className="flex items-center gap-3 mt-4 p-3 rounded-[var(--radius-md)] bg-[var(--info-soft)] border border-[var(--info)]/25 animate-slide-up">
            <Info className="size-4 text-[var(--info)] shrink-0" />
            <p className="text-[12px] text-[var(--fg-muted)] flex-1">
              Saisie reprise là où tu l&apos;avais laissée.
            </p>
            <Button type="button" variant="ghost" size="xs" onClick={restart}>
              <RotateCcw />
              Recommencer
            </Button>
          </div>
        )}

        <div
          key={step}
          className={cn(
            "mt-7",
            direction > 0 ? "animate-step-forward" : "animate-step-back",
          )}
        >
          <header className="mb-6">
            <h1 className="text-[24px] sm:text-[28px] leading-tight font-semibold tracking-[-0.025em]">
              {current.question}
            </h1>
            <p className="text-[14px] text-[var(--fg-muted)] mt-2 leading-relaxed">
              {current.description}
            </p>
          </header>

          {step < REVIEW_STEP ? (
            <form
              noValidate
              onKeyDown={onStepKeyDown}
              onSubmit={(event) => {
                event.preventDefault();
                void goNext();
              }}
            >
              <div ref={stepRef} className="space-y-5">
                {step === 0 && (
                  <IdentityStep
                    draft={draft}
                    errors={errors}
                    update={update}
                    age={age}
                  />
                )}
                {step === 1 && (
                  <AddressStep draft={draft} errors={errors} update={update} />
                )}
                {step === 2 && (
                  <OriginStep draft={draft} errors={errors} update={update} />
                )}
                {step === 3 && (
                  <HealthStep draft={draft} errors={errors} update={update} />
                )}
                {step === 4 && (
                  <ConsentStep draft={draft} errors={errors} update={update} />
                )}

                {showDuplicates && (
                  <DuplicatesPanel
                    matches={duplicates}
                    onContinue={continueDespiteDuplicates}
                  />
                )}
              </div>

              <StepFooter>
                {step === 0 ? (
                  <Button type="button" variant="ghost" onClick={cancel}>
                    Annuler
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" onClick={goBack}>
                    <ArrowLeft />
                    Retour
                  </Button>
                )}
                <span className="flex-1" />
                {step === 1 && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={skipAddress}
                  >
                    Plus tard
                  </Button>
                )}
                {!showDuplicates && (
                  <Button type="submit" variant="primary" loading={checking}>
                    {returnToReview ? "Valider" : "Continuer"}
                    {!checking && <ArrowRight />}
                  </Button>
                )}
              </StepFooter>
            </form>
          ) : (
            <form action={formAction} onSubmit={() => clearDraft()}>
              <HiddenFields draft={draft} birthIso={birthIso} phone={phone} />

              <div ref={stepRef} className="space-y-4">
                {state.error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 p-3.5 rounded-[var(--radius-md)] bg-[var(--danger-soft)] border border-[var(--danger)]/25"
                  >
                    <AlertCircle className="size-4 text-[var(--danger)] shrink-0 mt-0.5" />
                    <p className="text-[13px] text-[var(--danger)]">
                      {state.error}
                    </p>
                  </div>
                )}

                <ReviewStep
                  draft={draft}
                  birthIso={birthIso}
                  age={age}
                  phone={phone}
                  onEdit={(target) => goTo(target, true)}
                  onNotesChange={(notes) => update("notes", notes)}
                />
              </div>

              <StepFooter>
                <Button type="button" variant="ghost" onClick={goBack}>
                  <ArrowLeft />
                  Retour
                </Button>
                <span className="flex-1" />
                <Button type="submit" variant="primary" loading={submitting}>
                  {!submitting && <UserPlus />}
                  Créer le client
                </Button>
              </StepFooter>
            </form>
          )}
        </div>

        <ConfirmDialog
          open={confirmCancel}
          onOpenChange={setConfirmCancel}
          title="Abandonner la saisie ?"
          description="Les informations déjà saisies pour ce client seront perdues."
          confirmLabel="Abandonner"
          cancelLabel="Continuer la saisie"
          destructive
          onConfirm={() => {
            clearDraft();
            setConfirmCancel(false);
            router.push("/clients");
          }}
        />
      </div>
    </>
  );
}

/* ═════════════════════════ Indicateur d'étapes ═════════════════════════ */

function StepIndicator({
  step,
  onJump,
}: {
  step: number;
  onJump: (step: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12px] mb-2">
        <span className="font-medium text-[var(--fg-muted)] tabular">
          Étape {step + 1} sur {STEPS.length}
        </span>
        <span className="text-[var(--fg-subtle)]">{STEPS[step].label}</span>
      </div>
      <Progress value={((step + 1) / STEPS.length) * 100} />

      {/* Sur écran large : les étapes nommées, les précédentes sont cliquables */}
      <ol className="hidden sm:grid grid-cols-6 gap-1 mt-3">
        {STEPS.map((item, index) => {
          const done = index < step;
          const active = index === step;
          return (
            <li key={item.label}>
              <button
                type="button"
                disabled={!done}
                onClick={() => onJump(index)}
                className={cn(
                  "compact-touch w-full flex items-center justify-center gap-1 py-1 rounded-[var(--radius-xs)]",
                  "text-[11px] transition-colors",
                  active && "text-[var(--accent)] font-medium",
                  done &&
                    "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)]",
                  !done && !active && "text-[var(--fg-subtle)] cursor-default",
                )}
              >
                {done && <Check className="size-3 text-[var(--success)]" />}
                {item.label}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky-actions sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-3.5 mt-8 glass border-t border-[var(--border)] z-20">
      <div className="max-w-xl mx-auto flex items-center gap-2">{children}</div>
    </div>
  );
}

/* ═══════════════════════════ Étapes ═══════════════════════════ */

type Update = <K extends keyof Draft>(
  key: K,
  value: Draft[K] | ((previous: Draft[K]) => Draft[K]),
  ...alsoClear: string[]
) => void;

interface StepProps {
  draft: Draft;
  errors: Errors;
  update: Update;
}

function StepError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      data-error="true"
      className="flex items-start gap-2 text-[13px] text-[var(--danger)] animate-fade-in"
    >
      <AlertCircle className="size-4 shrink-0 mt-px" />
      {message}
    </p>
  );
}

/* ── 1. Identité ── */

function IdentityStep({
  draft,
  errors,
  update,
  age,
}: StepProps & { age: number | null }) {
  const emailRef = React.useRef<HTMLInputElement>(null);
  const [emailFocused, setEmailFocused] = React.useState(false);
  const emailFix =
    draft.email && !emailFocused ? suggestEmailFix(draft.email) : null;

  return (
    <>
      <div className="grid gap-4 min-[420px]:grid-cols-2">
        <Field
          label="Prénom"
          htmlFor="firstName"
          required
          error={errors.firstName}
        >
          <Input
            id="firstName"
            value={draft.firstName}
            onChange={(event) => update("firstName", event.target.value)}
            onBlur={() => update("firstName", capitalizeName(draft.firstName))}
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="next"
            placeholder="Léa"
            aria-invalid={Boolean(errors.firstName) || undefined}
            className="h-12 text-[15px]"
          />
        </Field>
        <Field label="Nom" htmlFor="lastName" required error={errors.lastName}>
          <Input
            id="lastName"
            value={draft.lastName}
            onChange={(event) => update("lastName", event.target.value)}
            onBlur={() => update("lastName", capitalizeName(draft.lastName))}
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="next"
            placeholder="Morand"
            aria-invalid={Boolean(errors.lastName) || undefined}
            className="h-12 text-[15px]"
          />
        </Field>
      </div>

      <Field
        label="Date de naissance"
        htmlFor="birthDay"
        required={!draft.birthUnknown}
        error={errors.birthDate}
        hint={
          draft.birthUnknown
            ? undefined
            : age !== null && age >= 0
              ? `${age} ans`
              : "Sert à vérifier l'âge : le tatouage d'un mineur exige l'accord écrit de ses parents."
        }
      >
        {draft.birthUnknown ? (
          <div className="flex items-center justify-between gap-3 h-12 px-3 rounded-[var(--radius-sm)] border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)]">
            <span className="text-[13px] text-[var(--fg-muted)]">
              Inconnue pour l&apos;instant
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => update("birthUnknown", false)}
            >
              La saisir
            </Button>
          </div>
        ) : (
          <BirthDateInput
            id="birthDay"
            value={draft.birth}
            onChange={(patch) =>
              update(
                "birth",
                (previous) => ({ ...previous, ...patch }),
                "birthDate",
              )
            }
            onComplete={() => emailRef.current?.focus()}
            invalid={Boolean(errors.birthDate)}
          />
        )}
      </Field>

      {!draft.birthUnknown &&
        !draft.birth.day &&
        !draft.birth.month &&
        !draft.birth.year && (
          <button
            type="button"
            onClick={() => update("birthUnknown", true, "birthDate")}
            className="compact-touch -mt-3 text-[12px] text-[var(--fg-subtle)] underline underline-offset-2 hover:text-[var(--fg)]"
          >
            Je ne la connais pas encore
          </button>
        )}

      {age !== null && age >= 0 && age < 18 && (
        <div className="flex items-start gap-3 p-3.5 rounded-[var(--radius-md)] bg-[var(--danger-soft)] border border-[var(--danger)]/30 animate-slide-up">
          <ShieldAlert className="size-5 text-[var(--danger)] shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-medium text-[var(--fg)]">
              Client mineur — {age} ans
            </p>
            <p className="text-[12px] text-[var(--fg-muted)] mt-1 leading-relaxed">
              Tu peux créer la fiche, mais aucune séance sans autorisation
              écrite d&apos;un représentant légal et sa pièce d&apos;identité.
              Vérifie aussi les règles de ton canton.
            </p>
          </div>
        </div>
      )}

      <Field label="E-mail" htmlFor="email" error={errors.email}>
        <Input
          ref={emailRef}
          id="email"
          type="email"
          inputMode="email"
          value={draft.email}
          onChange={(event) => update("email", event.target.value, "contact")}
          onFocus={() => setEmailFocused(true)}
          onBlur={() => {
            setEmailFocused(false);
            update("email", normalizeEmail(draft.email), "contact");
          }}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          placeholder="lea.morand@bluewin.ch"
          aria-invalid={Boolean(errors.email) || undefined}
          className="h-12 text-[15px]"
        />
      </Field>

      {emailFix && (
        <button
          type="button"
          onClick={() => update("email", emailFix, "contact")}
          className="compact-touch -mt-3 flex items-center gap-1.5 text-[12px] text-[var(--accent)] hover:underline"
        >
          <Wand2 className="size-3.5" />
          Tu voulais dire <strong>{emailFix}</strong> ?
        </button>
      )}

      <Field
        label="Téléphone"
        htmlFor="phone"
        error={errors.phone}
        hint="Sélectionne l'indicatif si le numéro n'est pas suisse."
      >
        <PhoneInput
          id="phone"
          country={draft.phoneCountry}
          local={draft.phoneLocal}
          onCountryChange={(country) =>
            update("phoneCountry", country, "phone")
          }
          onLocalChange={(local) =>
            update("phoneLocal", local, "phone", "contact")
          }
          invalid={Boolean(errors.phone)}
          enterKeyHint="done"
        />
      </Field>

      <StepError message={errors.contact} />
    </>
  );
}

/* ── 2. Adresse ── */

function AddressStep({ draft, errors, update }: StepProps) {
  const isSwiss = draft.country === "CH" || draft.country === "LI";

  return (
    <>
      {draft.addressSkipped && (
        <div className="flex items-start gap-3 p-3.5 rounded-[var(--radius-md)] bg-[var(--warning-soft)] border border-[var(--warning)]/30">
          <Info className="size-4 text-[var(--warning)] shrink-0 mt-0.5" />
          <p className="text-[12px] text-[var(--fg-muted)] leading-relaxed">
            Adresse remise à plus tard : aucune facture ne pourra être établie
            tant qu&apos;elle manque. Tu peux la compléter maintenant.
          </p>
        </div>
      )}

      <Field label="Pays" htmlFor="country">
        <Select
          id="country"
          value={draft.country}
          onChange={(event) =>
            update("country", event.target.value, "postalCode")
          }
          options={ADDRESS_COUNTRIES}
          className="h-12 text-[15px]"
        />
      </Field>

      <Field
        label="Rue et numéro"
        htmlFor="addressLine"
        error={errors.addressLine}
      >
        <Input
          id="addressLine"
          value={draft.addressLine}
          onChange={(event) => {
            update("addressLine", event.target.value, "address");
            update("addressSkipped", false);
          }}
          onBlur={() =>
            update("addressLine", capitalizeName(draft.addressLine))
          }
          autoComplete="off"
          enterKeyHint="next"
          placeholder={isSwiss ? "Rue du Rhône 12" : "12 rue de la République"}
          aria-invalid={Boolean(errors.addressLine) || undefined}
          className="h-12 text-[15px]"
        />
      </Field>

      <div className="grid grid-cols-[112px_1fr] gap-3">
        <Field
          label={isSwiss ? "NPA" : "Code postal"}
          htmlFor="postalCode"
          error={errors.postalCode}
        >
          <Input
            id="postalCode"
            value={draft.postalCode}
            onChange={(event) => {
              update(
                "postalCode",
                event.target.value.replace(/\s/g, ""),
                "address",
              );
              update("addressSkipped", false);
            }}
            inputMode={draft.country === "other" ? "text" : "numeric"}
            autoComplete="off"
            enterKeyHint="next"
            maxLength={10}
            placeholder={isSwiss ? "1204" : "74100"}
            aria-invalid={Boolean(errors.postalCode) || undefined}
            className="h-12 text-[15px] tabular"
          />
        </Field>
        <Field label="Localité" htmlFor="city" error={errors.city}>
          <Input
            id="city"
            value={draft.city}
            onChange={(event) => {
              update("city", event.target.value, "address");
              update("addressSkipped", false);
            }}
            onBlur={() => update("city", capitalizeName(draft.city))}
            autoComplete="off"
            enterKeyHint="done"
            placeholder={isSwiss ? "Genève" : "Annemasse"}
            aria-invalid={Boolean(errors.city) || undefined}
            className="h-12 text-[15px]"
          />
        </Field>
      </div>

      <StepError message={errors.address} />
    </>
  );
}

/* ── 3. Origine ── */

function OriginStep({ draft, errors, update }: StepProps) {
  return (
    <>
      <div className="space-y-2.5">
        <p className="text-[13px] font-medium text-[var(--fg-muted)]">
          Comment t&apos;a-t-il connu ?
          <span className="text-[var(--danger)] ml-0.5">*</span>
        </p>
        <ChoiceGroup
          ariaLabel="Source du contact"
          value={draft.source}
          onChange={(value) => update("source", value)}
          invalid={Boolean(errors.source)}
          options={CLIENT_SOURCE.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
        />
        <StepError message={errors.source} />
      </div>

      <Field
        label="Instagram"
        htmlFor="instagram"
        error={errors.instagram}
        hint="Facultatif. Le pseudo, avec ou sans @, ou le lien du profil."
      >
        <Input
          id="instagram"
          value={draft.instagram}
          onChange={(event) => update("instagram", event.target.value)}
          onBlur={() =>
            update("instagram", normalizeInstagram(draft.instagram))
          }
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="lea.morand"
          aria-invalid={Boolean(errors.instagram) || undefined}
          className="h-12 text-[15px]"
        />
      </Field>

      <div className="space-y-2.5">
        <p className="text-[13px] font-medium text-[var(--fg-muted)]">
          Dans quelle langue lui écrire ?
        </p>
        <ChoiceGroup
          ariaLabel="Langue de correspondance"
          columns={3}
          value={draft.language}
          onChange={(value) => update("language", value)}
          options={LANGUAGES.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
        />
      </div>
    </>
  );
}

/* ── 4. Santé ── */

function HealthStep({ draft, errors, update }: StepProps) {
  function toggleCondition(value: string) {
    update(
      "conditions",
      (previous) =>
        previous.includes(value)
          ? previous.filter((item) => item !== value)
          : [...previous, value],
      "healthDetails",
    );
  }

  return (
    <>
      <div className="space-y-2.5">
        <YesNo
          ariaLabel="Le client a-t-il des problèmes de santé à signaler ?"
          value={draft.hasHealthIssues}
          onChange={(value) =>
            update("hasHealthIssues", value, "healthDetails")
          }
          invalid={Boolean(errors.hasHealthIssues)}
          yesLabel="Oui, il y a des choses à signaler"
          noLabel="Non, rien à signaler"
        />
        <StepError message={errors.hasHealthIssues} />
      </div>

      {draft.hasHealthIssues && (
        <div className="animate-slide-up">
          <div className="space-y-5 pt-1">
            <div className="space-y-2.5">
              <p className="text-[13px] font-medium text-[var(--fg-muted)]">
                Coche ce qui s&apos;applique
              </p>
              <div className="grid gap-2 min-[420px]:grid-cols-2">
                {MEDICAL_CONDITIONS.map((condition) => (
                  <ToggleChip
                    key={condition.value}
                    pressed={draft.conditions.includes(condition.value)}
                    onToggle={() => toggleCondition(condition.value)}
                  >
                    {condition.label}
                  </ToggleChip>
                ))}
                <ToggleChip
                  pressed={draft.pregnant}
                  onToggle={() =>
                    update("pregnant", (previous) => !previous, "healthDetails")
                  }
                >
                  Grossesse ou allaitement
                </ToggleChip>
                <ToggleChip
                  pressed={draft.keloidProne}
                  onToggle={() =>
                    update(
                      "keloidProne",
                      (previous) => !previous,
                      "healthDetails",
                    )
                  }
                >
                  Tendance aux chéloïdes
                </ToggleChip>
              </div>
            </div>

            <Field
              label="Allergies"
              htmlFor="allergies"
              hint="Latex, nickel, encres, anesthésiants, pansements…"
            >
              <Input
                id="allergies"
                value={draft.allergies}
                onChange={(event) =>
                  update("allergies", event.target.value, "healthDetails")
                }
                autoComplete="off"
                placeholder="Latex — gants nitrile obligatoires"
                className="h-12 text-[15px]"
              />
            </Field>

            <Field
              label="Traitements en cours"
              htmlFor="medications"
              hint="Anticoagulants, immunosuppresseurs, isotrétinoïne…"
            >
              <Input
                id="medications"
                value={draft.medications}
                onChange={(event) =>
                  update("medications", event.target.value, "healthDetails")
                }
                autoComplete="off"
                className="h-12 text-[15px]"
              />
            </Field>

            <Field label="Autre remarque" htmlFor="medicalNotes">
              <Textarea
                id="medicalNotes"
                rows={3}
                value={draft.medicalNotes}
                onChange={(event) =>
                  update("medicalNotes", event.target.value, "healthDetails")
                }
                placeholder="Malaise lors d'une séance précédente, prévoir des pauses…"
              />
            </Field>

            {draft.pregnant && (
              <div className="flex items-start gap-3 p-3.5 rounded-[var(--radius-md)] bg-[var(--warning-soft)] border border-[var(--warning)]/30">
                <ShieldAlert className="size-4 text-[var(--warning)] shrink-0 mt-0.5" />
                <p className="text-[12px] text-[var(--fg-muted)] leading-relaxed">
                  Grossesse ou allaitement : contre-indication, la séance devra
                  être reportée.
                </p>
              </div>
            )}

            <StepError message={errors.healthDetails} />
          </div>
        </div>
      )}

      <Field
        label="Phototype de peau"
        htmlFor="skinType"
        hint="Facultatif. Influence le rendu des couleurs et la cicatrisation."
      >
        <Select
          id="skinType"
          value={draft.skinType}
          onChange={(event) => update("skinType", event.target.value)}
          placeholder="Non déterminé"
          options={SKIN_TYPES.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          className="h-12 text-[15px]"
        />
      </Field>
    </>
  );
}

/* ── 5. Accords ── */

function ConsentStep({ draft, errors, update }: StepProps) {
  return (
    <>
      <div className="space-y-2.5">
        <p className="text-[15px] font-medium text-[var(--fg)]">
          Peut-on publier des photos de son tatouage ?
        </p>
        <p className="text-[12px] text-[var(--fg-subtle)] -mt-1.5">
          Sur ton Instagram, ton site et ton book.
        </p>
        <YesNo
          ariaLabel="Droit à l'image"
          value={draft.imageConsent}
          onChange={(value) => update("imageConsent", value)}
          invalid={Boolean(errors.imageConsent)}
          yesLabel="Oui, il autorise"
          noLabel="Non, aucune publication"
        />
        <StepError message={errors.imageConsent} />
      </div>

      <div className="space-y-2.5 pt-2">
        <p className="text-[15px] font-medium text-[var(--fg)]">
          Accepte-t-il de recevoir de tes nouvelles ?
        </p>
        <p className="text-[12px] text-[var(--fg-subtle)] -mt-1.5">
          Offres, créneaux libérés, message d&apos;anniversaire. Les e-mails de
          rendez-vous et de facture sont envoyés dans tous les cas.
        </p>
        <YesNo
          ariaLabel="Communications commerciales"
          value={draft.marketingConsent}
          onChange={(value) => update("marketingConsent", value)}
          invalid={Boolean(errors.marketingConsent)}
          yesLabel="Oui, il accepte"
          noLabel="Non merci"
        />
        <StepError message={errors.marketingConsent} />
      </div>

      <div className="flex items-start gap-2.5 p-3 rounded-[var(--radius-sm)] bg-[var(--info-soft)] border border-[var(--info)]/20">
        <Info className="size-4 text-[var(--info)] shrink-0 mt-0.5" />
        <p className="text-[12px] text-[var(--fg-muted)] leading-relaxed">
          Aucune réponse n&apos;est cochée d&apos;avance : la nLPD exige un
          accord explicite. Pose la question au client.
        </p>
      </div>
    </>
  );
}

/* ── Doublons ── */

function DuplicatesPanel({
  matches,
  onContinue,
}: {
  matches: SimilarClient[];
  onContinue: () => void;
}) {
  return (
    <div
      data-error="true"
      className="p-4 rounded-[var(--radius-lg)] bg-[var(--warning-soft)] border border-[var(--warning)]/35 animate-slide-up"
    >
      <div className="flex items-start gap-3">
        <Users className="size-5 text-[var(--warning)] shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-[var(--fg)]">
            {matches.length > 1
              ? "Des fiches ressemblent"
              : "Une fiche ressemble"}{" "}
            à ce client
          </p>
          <p className="text-[12px] text-[var(--fg-muted)] mt-0.5">
            Vérifie qu&apos;il ne s&apos;agit pas de la même personne avant de
            créer un doublon.
          </p>
        </div>
      </div>

      <ul className="mt-3.5 space-y-2">
        {matches.map((match) => (
          <li key={match.id}>
            <Link
              href={`/clients/${match.id}`}
              className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium truncate">{match.name}</p>
                <p className="text-[11px] text-[var(--fg-subtle)] truncate">
                  {match.detail}
                </p>
              </div>
              <span className="text-[11px] text-[var(--warning)] shrink-0 text-right">
                {match.reasons.join(", ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="secondary"
        className="w-full mt-3.5"
        onClick={onContinue}
      >
        C&apos;est bien un nouveau client — continuer
        <ArrowRight />
      </Button>
    </div>
  );
}

/* ── 6. Vérification ── */

function ReviewStep({
  draft,
  birthIso,
  age,
  phone,
  onEdit,
  onNotesChange,
}: {
  draft: Draft;
  birthIso: string | null;
  age: number | null;
  phone: string;
  onEdit: (step: number) => void;
  onNotesChange: (notes: string) => void;
}) {
  const hasAddress = !draft.addressSkipped && Boolean(draft.addressLine);
  const countryLabel =
    ADDRESS_COUNTRIES.find((country) => country.value === draft.country)
      ?.label ?? "";

  const healthItems = [
    ...draft.conditions.map((value) => labelOf(MEDICAL_CONDITIONS, value)),
    ...(draft.pregnant ? ["Grossesse ou allaitement"] : []),
    ...(draft.keloidProne ? ["Tendance aux chéloïdes"] : []),
  ];

  return (
    <>
      {(age !== null && age < 18) || !hasAddress || !birthIso ? (
        <div className="space-y-2">
          {age !== null && age < 18 && (
            <Notice tone="danger">
              Client mineur ({age} ans) : autorisation parentale écrite
              obligatoire avant toute séance.
            </Notice>
          )}
          {!hasAddress && (
            <Notice tone="warning">
              Sans adresse, aucune facture ne pourra être établie pour ce
              client.
            </Notice>
          )}
          {!birthIso && (
            <Notice tone="warning">
              Date de naissance inconnue : pense à vérifier l&apos;âge avant la
              séance.
            </Notice>
          )}
        </div>
      ) : null}

      <ReviewCard title="Identité" onEdit={() => onEdit(0)}>
        <Row label="Nom">
          {draft.firstName} {draft.lastName}
        </Row>
        <Row label="Naissance">
          {birthIso ? `${formatDate(birthIso)} · ${age} ans` : "Inconnue"}
        </Row>
        <Row label="E-mail">{draft.email || "—"}</Row>
        <Row label="Téléphone">{phone || "—"}</Row>
      </ReviewCard>

      <ReviewCard title="Adresse" onEdit={() => onEdit(1)}>
        {hasAddress ? (
          <p className="text-[13px] text-[var(--fg)] leading-relaxed">
            {draft.addressLine}
            <br />
            {draft.postalCode} {draft.city}
            {draft.country !== "CH" && countryLabel && (
              <>
                <br />
                {countryLabel}
              </>
            )}
          </p>
        ) : (
          <p className="text-[13px] text-[var(--fg-subtle)]">Plus tard</p>
        )}
      </ReviewCard>

      <ReviewCard title="Origine" onEdit={() => onEdit(2)}>
        <Row label="Source">{labelOf(CLIENT_SOURCE, draft.source)}</Row>
        <Row label="Instagram">
          {draft.instagram ? `@${draft.instagram}` : "—"}
        </Row>
        <Row label="Langue">{labelOf(LANGUAGES, draft.language)}</Row>
      </ReviewCard>

      <ReviewCard title="Santé" onEdit={() => onEdit(3)}>
        {draft.hasHealthIssues ? (
          <div className="space-y-2">
            {healthItems.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {healthItems.map((item) => (
                  <span
                    key={item}
                    className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--warning-soft)] text-[var(--warning)] border border-[var(--warning)]/25"
                  >
                    {item}
                  </span>
                ))}
              </div>
            )}
            {draft.allergies && <Row label="Allergies">{draft.allergies}</Row>}
            {draft.medications && (
              <Row label="Traitements">{draft.medications}</Row>
            )}
            {draft.medicalNotes && (
              <Row label="Remarque">{draft.medicalNotes}</Row>
            )}
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-[13px] text-[var(--success)]">
            <Check className="size-3.5" />
            Rien à signaler
          </p>
        )}
        {draft.skinType && (
          <Row label="Phototype">{labelOf(SKIN_TYPES, draft.skinType)}</Row>
        )}
      </ReviewCard>

      <ReviewCard title="Accords" onEdit={() => onEdit(4)}>
        <Row label="Photos publiables">
          <YesNoBadge value={draft.imageConsent} />
        </Row>
        <Row label="Reçoit tes nouvelles">
          <YesNoBadge value={draft.marketingConsent} />
        </Row>
      </ReviewCard>

      <Field
        label="Notes privées"
        htmlFor="notes"
        hint="Facultatif. Visibles par toi uniquement, jamais par le client."
      >
        <Textarea
          id="notes"
          rows={3}
          value={draft.notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="Préfère les rendez-vous le matin, projet de manchette à discuter…"
        />
      </Field>

      <p className="text-[12px] text-[var(--fg-subtle)] leading-relaxed">
        La fiche est créée avec le statut « Prospect ». Elle passe en « Client
        actif » dès que tu lui crées un projet.
      </p>
    </>
  );
}

function ReviewCard({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">
          {title}
        </p>
        <button
          type="button"
          onClick={onEdit}
          className="compact-touch inline-flex items-center gap-1 px-2 py-1 -mr-2 rounded-[var(--radius-xs)] text-[12px] text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
        >
          <Pencil className="size-3" />
          Modifier
        </button>
      </div>
      <div className="space-y-1.5">{children}</div>
    </Card>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[12px] text-[var(--fg-subtle)] shrink-0">
        {label}
      </span>
      <span className="text-[13px] text-[var(--fg)] text-right min-w-0 break-words">
        {children}
      </span>
    </div>
  );
}

function YesNoBadge({ value }: { value: boolean | null }) {
  return value ? (
    <span className="inline-flex items-center gap-1 text-[var(--success)]">
      <Check className="size-3.5" />
      Oui
    </span>
  ) : (
    <span className="text-[var(--fg-muted)]">Non</span>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "danger" | "warning";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 p-3 rounded-[var(--radius-md)] border",
        tone === "danger"
          ? "bg-[var(--danger-soft)] border-[var(--danger)]/30"
          : "bg-[var(--warning-soft)] border-[var(--warning)]/30",
      )}
    >
      <ShieldAlert
        className={cn(
          "size-4 shrink-0 mt-0.5",
          tone === "danger" ? "text-[var(--danger)]" : "text-[var(--warning)]",
        )}
      />
      <p className="text-[12px] text-[var(--fg-muted)] leading-relaxed">
        {children}
      </p>
    </div>
  );
}

/* ── Champs envoyés au serveur ── */

function HiddenFields({
  draft,
  birthIso,
  phone,
}: {
  draft: Draft;
  birthIso: string | null;
  phone: string;
}) {
  const withAddress = !draft.addressSkipped;
  const withHealth = draft.hasHealthIssues === true;
  const on = (value: boolean | null) => (value ? "on" : "");

  const fields: [string, string][] = [
    ["firstName", capitalizeName(draft.firstName)],
    ["lastName", capitalizeName(draft.lastName)],
    ["birthDate", birthIso ?? ""],
    ["email", normalizeEmail(draft.email)],
    ["phone", phone],
    ["addressLine", withAddress ? draft.addressLine.trim() : ""],
    ["postalCode", withAddress ? draft.postalCode.trim() : ""],
    ["city", withAddress ? draft.city.trim() : ""],
    ["country", draft.country === "other" ? "other" : draft.country],
    ["source", draft.source],
    ["instagram", normalizeInstagram(draft.instagram)],
    ["language", draft.language],
    ["status", "prospect"],
    ["notes", draft.notes.trim()],
    ["allergies", withHealth ? draft.allergies.trim() : ""],
    ["medications", withHealth ? draft.medications.trim() : ""],
    ["medicalNotes", withHealth ? draft.medicalNotes.trim() : ""],
    ["skinType", draft.skinType],
    ["pregnant", on(withHealth && draft.pregnant)],
    ["keloidProne", on(withHealth && draft.keloidProne)],
    ["imageConsent", on(draft.imageConsent)],
    ["marketingConsent", on(draft.marketingConsent)],
    ["medicalReviewed", "on"],
  ];

  return (
    <>
      {fields.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {withHealth &&
        draft.conditions.map((condition) => (
          <input
            key={condition}
            type="hidden"
            name="conditions"
            value={condition}
          />
        ))}
    </>
  );
}
