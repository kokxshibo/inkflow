"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  Info,
  ListPlus,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import type { QuoteProposal } from "@/lib/billing";
import { createQuickQuote, type QuickQuoteState } from "../quick-actions";
import { computeDeposit, formatCHF, fromGross, parseCHF, roundTo5Cents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/field";
import { useFirstError } from "@/components/use-first-error";

interface ClientOption {
  id: string;
  name: string;
  email: string | null;
}

interface QuoteSettings {
  hourlyRate: number;
  minimumPrice: number;
  depositPercent: number;
  validityDays: number;
  vatRate: number;
}

type Selection = { type: "project"; projectId: string } | { type: "free" } | null;

const DEFAULT_TERMS =
  "Acompte non remboursable en cas d'annulation à moins de 72 heures du rendez-vous.";

/** Montant en centimes → texte éditable (« 1'260.00 »). */
function toInput(cents: number) {
  return formatCHF(cents, { showCurrency: false });
}

function formatHours(hours: number) {
  return `${String(hours).replace(".", ",")} h`;
}

/** Recherche insensible à la casse et aux accents. */
function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function QuickQuote({
  proposals,
  clients,
  initialProjectId,
  defaultClientId,
  detailedHref,
  settings,
}: {
  proposals: QuoteProposal[];
  clients: ClientOption[];
  initialProjectId: string | null;
  defaultClientId: string | null;
  detailedHref: string;
  settings: QuoteSettings;
}) {
  const [state, formAction, pending] = useActionState<QuickQuoteState, FormData>(
    createQuickQuote,
    {},
  );
  const formRef = React.useRef<HTMLFormElement>(null);
  useFirstError(formRef, state);

  const compute = React.useCallback(
    (sessions: number, hours: number) =>
      Math.max(
        roundTo5Cents(Math.round(settings.hourlyRate * sessions * hours)),
        settings.minimumPrice,
      ),
    [settings.hourlyRate, settings.minimumPrice],
  );

  const initial = proposals.find((proposal) => proposal.projectId === initialProjectId) ?? null;

  const [selection, setSelection] = React.useState<Selection>(
    initial ? { type: "project", projectId: initial.projectId } : null,
  );
  const [query, setQuery] = React.useState("");
  const [sessions, setSessions] = React.useState(initial?.sessions ?? 1);
  const [hours, setHours] = React.useState(initial?.hoursPerSession ?? 3);
  const [priceText, setPriceText] = React.useState(() =>
    initial ? toInput(initial.presetPrice ?? compute(initial.sessions, initial.hoursPerSession)) : "",
  );
  const [depositPercent, setDepositPercent] = React.useState(settings.depositPercent);
  const [label, setLabel] = React.useState(initial?.label ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [clientId, setClientId] = React.useState(
    defaultClientId && clients.some((client) => client.id === defaultClientId) ? defaultClientId : "",
  );
  const [showConditions, setShowConditions] = React.useState(false);
  const [validityDays, setValidityDays] = React.useState(String(settings.validityDays));
  const [terms, setTerms] = React.useState(DEFAULT_TERMS);
  // Uniquement pour afficher le chargement sur le bouton cliqué.
  const [intent, setIntent] = React.useState<"create" | "send">("create");

  // Une erreur sur les conditions les déplie, pour que le champ fautif soit visible.
  const conditionsOpen = showConditions || Boolean(state.fieldErrors?.validityDays);

  const project =
    selection?.type === "project"
      ? (proposals.find((proposal) => proposal.projectId === selection.projectId) ?? null)
      : null;

  const computed = compute(sessions, hours);
  const price = parseCHF(priceText);
  const deposit = computeDeposit(price, depositPercent);
  const vat = settings.vatRate > 0 && price > 0 ? fromGross(price, settings.vatRate).vatAmount : 0;
  const minimumApplied = computed === settings.minimumPrice &&
    roundTo5Cents(Math.round(settings.hourlyRate * sessions * hours)) < settings.minimumPrice;

  const recipientEmail = project
    ? project.clientEmail
    : (clients.find((client) => client.id === clientId)?.email ?? null);

  const depositChoices = [...new Set([0, 20, 30, 50, settings.depositPercent])].sort((a, b) => a - b);

  const filtered = React.useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return proposals;
    return proposals.filter((proposal) =>
      normalize(`${proposal.projectTitle} ${proposal.clientName} ${proposal.description}`).includes(
        needle,
      ),
    );
  }, [proposals, query]);

  function selectProject(proposal: QuoteProposal) {
    setSelection({ type: "project", projectId: proposal.projectId });
    setSessions(proposal.sessions);
    setHours(proposal.hoursPerSession);
    setPriceText(
      toInput(proposal.presetPrice ?? compute(proposal.sessions, proposal.hoursPerSession)),
    );
    setLabel(proposal.label);
    setDescription(proposal.description);
  }

  function selectFree() {
    setSelection({ type: "free" });
    setSessions(1);
    setHours(2);
    setPriceText(toInput(compute(1, 2)));
    setLabel("");
    setDescription("");
  }

  function changeEstimate(nextSessions: number, nextHours: number) {
    setSessions(nextSessions);
    setHours(nextHours);
    setPriceText(toInput(compute(nextSessions, nextHours)));
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/devis"
        className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors mb-4"
      >
        <ChevronLeft className="size-3.5" />
        Devis
      </Link>

      <header className="mb-6">
        <h1 className="text-[24px] sm:text-[28px] leading-tight font-semibold tracking-[-0.025em]">
          Nouveau devis
        </h1>
        <p className="text-[14px] text-[var(--fg-muted)] mt-2 leading-relaxed">
          Choisis le projet : le prix est calculé avec ton tarif horaire (
          {formatCHF(settings.hourlyRate)}). Ajuste si besoin, c&apos;est prêt.
        </p>
      </header>

      <form ref={formRef} action={formAction} noValidate>
        <input type="hidden" name="mode" value={selection?.type === "free" ? "free" : "project"} />
        <input type="hidden" name="projectId" value={project?.projectId ?? ""} />
        <input type="hidden" name="sessions" value={sessions} />
        <input type="hidden" name="hoursPerSession" value={hours} />
        <input type="hidden" name="depositPercent" value={depositPercent} />

        {/* ── 1. Projet ── */}
        <section className="mb-6">
          <h2 className="text-[13px] font-medium text-[var(--fg-muted)] mb-2.5">
            Pour quel projet ?
          </h2>

          {selection ? (
            <div className="flex items-center gap-3.5 p-4 rounded-[var(--radius-lg)] border border-[var(--accent)] bg-[var(--accent-soft)] animate-fade-in">
              <span className="grid place-items-center size-9 shrink-0 rounded-full bg-[var(--accent)] text-[var(--accent-fg)]">
                <Check className="size-4 stroke-[3]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-[var(--fg)] truncate">
                  {project ? project.projectTitle : "Sans projet"}
                </span>
                <span className="block text-[12px] text-[var(--fg-muted)] mt-0.5 truncate">
                  {project ? project.clientName : "Flash, retouche, pièce unique…"}
                </span>
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelection(null)}>
                Changer
              </Button>
            </div>
          ) : (
            <div className="space-y-2 animate-fade-in">
              {proposals.length > 5 && (
                <Input
                  icon={<Search />}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Projet ou client…"
                  aria-label="Rechercher un projet"
                  className="h-11"
                />
              )}

              {proposals.length > 0 && (
                <ul className="space-y-2 max-h-[min(420px,55dvh)] overflow-y-auto overscroll-contain -mx-1 px-1 py-1">
                  {filtered.map((proposal) => (
                    <li key={proposal.projectId}>
                      <button
                        type="button"
                        onClick={() => selectProject(proposal)}
                        className={cn(
                          "group w-full flex items-center gap-3 p-3.5 text-left",
                          "rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]",
                          "transition-all duration-200 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-sm)]",
                          "active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-medium text-[var(--fg)] truncate">
                            {proposal.projectTitle}
                          </span>
                          <span className="block text-[12px] text-[var(--fg-muted)] mt-0.5 truncate">
                            {proposal.clientName} · {proposal.description}
                          </span>
                        </span>
                        {proposal.hasAcceptedQuote && (
                          <span className="text-[11px] text-[var(--success)] shrink-0">
                            Devis accepté
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                  {filtered.length === 0 && (
                    <li className="py-6 text-center text-[13px] text-[var(--fg-subtle)]">
                      Aucun projet ne correspond.
                    </li>
                  )}
                </ul>
              )}

              {proposals.length === 0 && (
                <p className="text-[13px] text-[var(--fg-subtle)] py-2">
                  Aucun projet en cours{defaultClientId ? " pour ce client" : ""}.
                </p>
              )}

              <div className="grid gap-2 min-[420px]:grid-cols-2 pt-1">
                <button
                  type="button"
                  onClick={selectFree}
                  className={cn(
                    "flex items-center gap-3 p-3.5 text-left rounded-[var(--radius-md)]",
                    "border border-dashed border-[var(--border-strong)] transition-all duration-200",
                    "hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] active:scale-[0.99]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
                  )}
                >
                  <Sparkles className="size-4 text-[var(--fg-subtle)] shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-[var(--fg)]">Sans projet</span>
                    <span className="block text-[12px] text-[var(--fg-subtle)]">Flash, retouche…</span>
                  </span>
                </button>
                <Link
                  href={`/projets/nouveau${defaultClientId ? `?client=${defaultClientId}` : ""}`}
                  className={cn(
                    "flex items-center gap-3 p-3.5 rounded-[var(--radius-md)]",
                    "border border-dashed border-[var(--border-strong)] transition-all duration-200",
                    "hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] active:scale-[0.99]",
                  )}
                >
                  <Plus className="size-4 text-[var(--fg-subtle)] shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-[var(--fg)]">Nouveau projet</span>
                    <span className="block text-[12px] text-[var(--fg-subtle)]">
                      Le créer, puis revenir ici
                    </span>
                  </span>
                </Link>
              </div>
            </div>
          )}
        </section>

        {selection && (
          <div key={selection.type === "project" ? selection.projectId : "free"} className="space-y-6 animate-slide-up">
            {project?.hasAcceptedQuote && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-[var(--radius-md)] bg-[var(--info-soft)] border border-[var(--info)]/25">
                <Info className="size-4 text-[var(--info)] shrink-0 mt-0.5" />
                <p className="text-[13px] text-[var(--fg-muted)] leading-relaxed">
                  Ce projet a déjà un devis accepté. Si ce nouveau devis est accepté à son tour,
                  c&apos;est lui qui servira de référence pour la facturation.
                </p>
              </div>
            )}

            {/* ── 2. Prix ── */}
            <section className="p-5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] space-y-5">
              <h2 className="text-[15px] font-semibold">Prix</h2>

              <div className="grid gap-3 min-[400px]:grid-cols-2">
                <Stepper
                  label="Séances"
                  value={sessions}
                  display={String(sessions)}
                  canDecrease={sessions > 1}
                  canIncrease={sessions < 30}
                  onDecrease={() => changeEstimate(sessions - 1, hours)}
                  onIncrease={() => changeEstimate(sessions + 1, hours)}
                />
                <Stepper
                  label="Heures par séance"
                  value={hours}
                  display={formatHours(hours)}
                  canDecrease={hours > 0.5}
                  canIncrease={hours < 10}
                  onDecrease={() => changeEstimate(sessions, hours - 0.5)}
                  onIncrease={() => changeEstimate(sessions, hours + 0.5)}
                />
              </div>

              <div>
                <Field label="Prix total" htmlFor="price" error={state.fieldErrors?.price}>
                  <MoneyInput
                    id="price"
                    name="price"
                    value={priceText}
                    onChange={(event) => setPriceText(event.target.value)}
                    onBlur={() => price > 0 && setPriceText(toInput(price))}
                    className="h-14 text-[22px] font-semibold"
                    aria-invalid={Boolean(state.fieldErrors?.price) || undefined}
                  />
                </Field>
                <div className="flex items-start gap-2 mt-1.5 text-[12px] leading-relaxed">
                  {price === computed ? (
                    <span className="text-[var(--fg-subtle)]">
                      {minimumApplied
                        ? `Prix minimum du salon (${sessions} × ${formatHours(hours)} × ${formatCHF(settings.hourlyRate)} = ${formatCHF(roundTo5Cents(Math.round(settings.hourlyRate * sessions * hours)))})`
                        : `${sessions} séance${sessions > 1 ? "s" : ""} × ${formatHours(hours)} × ${formatCHF(settings.hourlyRate)} de l'heure`}
                    </span>
                  ) : (
                    <>
                      <span className="text-[var(--fg-muted)] flex-1">
                        {project?.presetPrice === price
                          ? "Prix déjà estimé sur le projet."
                          : "Prix ajusté à la main."}{" "}
                        Calcul au tarif horaire : {formatCHF(computed)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPriceText(toInput(computed))}
                        className="compact-touch inline-flex items-center gap-1 text-[var(--accent)] hover:underline shrink-0"
                      >
                        <RotateCcw className="size-3" />
                        Utiliser
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2.5">
                <p className="text-[13px] font-medium text-[var(--fg-muted)]">
                  Acompte à la réservation
                </p>
                <div
                  className="grid grid-cols-4 gap-2"
                  role="radiogroup"
                  aria-label="Acompte à la réservation"
                >
                  {depositChoices.map((percent) => (
                    <button
                      key={percent}
                      type="button"
                      role="radio"
                      aria-checked={depositPercent === percent}
                      onClick={() => setDepositPercent(percent)}
                      className={cn(
                        "h-11 rounded-[var(--radius-md)] border text-[13px] font-medium tabular transition-all duration-200",
                        "active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
                        depositPercent === percent
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--fg)]"
                          : "border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--fg-muted)] hover:border-[var(--border-strong)]",
                      )}
                    >
                      {percent === 0 ? "Aucun" : `${percent} %`}
                    </button>
                  ))}
                </div>
                <p className="text-[12px] text-[var(--fg-subtle)]">
                  {depositPercent === 0 || price <= 0
                    ? "Pas d'acompte demandé."
                    : `Le client verse ${formatCHF(deposit)} pour réserver ses dates.`}
                </p>
              </div>
            </section>

            {/* ── 3. Sur le devis ── */}
            <section className="p-5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] space-y-4">
              <h2 className="text-[15px] font-semibold">Sur le devis</h2>

              {selection.type === "free" && (
                <Field label="Client" htmlFor="clientId" required error={state.fieldErrors?.clientId}>
                  <Select
                    id="clientId"
                    name="clientId"
                    value={clientId}
                    onChange={(event) => setClientId(event.target.value)}
                    placeholder="Choisir un client…"
                    options={clients.map((client) => ({ value: client.id, label: client.name }))}
                    className="h-12 text-[15px]"
                    aria-invalid={Boolean(state.fieldErrors?.clientId) || undefined}
                  />
                </Field>
              )}

              <Field label="Prestation" htmlFor="label" required error={state.fieldErrors?.label}>
                <Input
                  id="label"
                  name="label"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Flash « Hirondelle », avant-bras"
                  maxLength={160}
                  className="h-12 text-[15px]"
                  aria-invalid={Boolean(state.fieldErrors?.label) || undefined}
                />
              </Field>

              <Field label="Détails" htmlFor="description" hint="Facultatif — apparaît sous la prestation.">
                <Input
                  id="description"
                  name="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Style, zone, taille…"
                  maxLength={300}
                />
              </Field>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowConditions(!conditionsOpen)}
                  aria-expanded={conditionsOpen}
                  className="compact-touch inline-flex items-center gap-1.5 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
                >
                  <ChevronDown
                    className={cn("size-4 transition-transform duration-200", conditionsOpen && "rotate-180")}
                  />
                  Validité et conditions
                  {!conditionsOpen && (
                    <span className="text-[var(--fg-subtle)]">· {validityDays || settings.validityDays} jours</span>
                  )}
                </button>
                {/* Les champs restent dans le formulaire même repliés. */}
                <div className={cn("space-y-4 pt-4", !conditionsOpen && "hidden")}>
                  <Field label="Valable" htmlFor="validityDays" error={state.fieldErrors?.validityDays}>
                    <Input
                      id="validityDays"
                      name="validityDays"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={365}
                      value={validityDays}
                      onChange={(event) => setValidityDays(event.target.value)}
                      aria-invalid={Boolean(state.fieldErrors?.validityDays) || undefined}
                      suffix="jours"
                      className="tabular"
                    />
                  </Field>
                  <Field label="Conditions" htmlFor="terms">
                    <Textarea
                      id="terms"
                      name="terms"
                      rows={3}
                      value={terms}
                      onChange={(event) => setTerms(event.target.value)}
                    />
                  </Field>
                </div>
              </div>
            </section>

            <p className="text-center text-[12px] text-[var(--fg-subtle)]">
              Plusieurs lignes, une remise ?{" "}
              <Link
                href={detailedHref}
                className="inline-flex items-center gap-1 text-[var(--fg-muted)] underline underline-offset-2 hover:text-[var(--fg)]"
              >
                <ListPlus className="size-3.5" />
                Devis détaillé
              </Link>
            </p>

            {/* ── Validation ── */}
            <div className="sticky-actions sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-3.5 glass border-t border-[var(--border)] z-20">
              <div className="max-w-2xl mx-auto space-y-2.5">
                {state.error && (
                  <p className="flex items-start gap-2 text-[13px] text-[var(--danger)] animate-fade-in" role="alert">
                    <AlertCircle className="size-4 shrink-0 mt-px" />
                    {state.error}
                  </p>
                )}
                {!state.error &&
                  !recipientEmail &&
                  (selection.type === "project" || Boolean(clientId)) && (
                    <p className="text-[12px] text-[var(--fg-subtle)]">
                      Pas d&apos;e-mail pour ce client : crée le devis, puis partage le PDF ou le lien.
                    </p>
                  )}
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[17px] font-semibold tabular leading-tight whitespace-nowrap">
                      {price > 0 ? formatCHF(price) : "—"}
                    </p>
                    <p className="text-[11px] text-[var(--fg-subtle)] truncate">
                      {depositPercent > 0 && price > 0 ? `Acompte ${formatCHF(deposit)}` : "Sans acompte"}
                      {vat > 0 && ` · TVA ${settings.vatRate} % incluse`}
                    </p>
                  </div>
                  <Button
                    type="submit"
                    name="intent"
                    value="create"
                    variant="secondary"
                    size="lg"
                    className="max-[400px]:px-3.5"
                    onClick={() => setIntent("create")}
                    loading={pending && intent === "create"}
                    disabled={pending}
                  >
                    Créer
                  </Button>
                  <Button
                    type="submit"
                    name="intent"
                    value="send"
                    variant="primary"
                    size="lg"
                    className="max-[400px]:px-3.5"
                    onClick={() => setIntent("send")}
                    loading={pending && intent === "send"}
                    disabled={
                      pending ||
                      (!recipientEmail && (selection.type === "project" || Boolean(clientId)))
                    }
                    title={recipientEmail ? undefined : "Aucune adresse e-mail pour ce client"}
                  >
                    <Send className="max-[400px]:hidden" />
                    <span className="max-[380px]:hidden">Créer et envoyer</span>
                    <span className="min-[381px]:hidden">Envoyer</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

/* ───────────────────────────── Compteur ───────────────────────────── */

function Stepper({
  label,
  value,
  display,
  canDecrease,
  canIncrease,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: number;
  display: string;
  canDecrease: boolean;
  canIncrease: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  const buttonClass = cn(
    "grid place-items-center size-11 shrink-0 rounded-[var(--radius-sm)] text-[var(--fg-muted)]",
    "transition-all duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] active:scale-[0.92]",
    "disabled:opacity-35 disabled:pointer-events-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
  );
  return (
    <div className="space-y-2">
      <p className="text-[13px] font-medium text-[var(--fg-muted)]">{label}</p>
      <div
        className="flex items-center justify-between p-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-subtle)]"
        role="group"
        aria-label={label}
      >
        <button type="button" onClick={onDecrease} disabled={!canDecrease} className={buttonClass} aria-label={`Moins de ${label.toLowerCase()}`}>
          <Minus className="size-4" />
        </button>
        <span className="text-[17px] font-semibold tabular" aria-live="polite" data-value={value}>
          {display}
        </span>
        <button type="button" onClick={onIncrease} disabled={!canIncrease} className={buttonClass} aria-label={`Plus de ${label.toLowerCase()}`}>
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}
