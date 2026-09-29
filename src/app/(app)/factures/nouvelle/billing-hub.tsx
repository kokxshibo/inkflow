"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  FileText,
  Flag,
  Info,
  ListPlus,
  Lock,
  Plus,
  RotateCcw,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import type { BillingSuggestion, SuggestionKind } from "@/lib/billing";
import {
  createInvoiceFromSuggestion,
  createQuickInvoice,
  type QuickBillingState,
} from "../billing-actions";
import { formatCHF, fromGross, parseCHF, roundTo5Cents } from "@/lib/money";
import { addDays, cn, initials, toDateInput } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, MoneyInput, Select } from "@/components/ui/field";
import { DateInput } from "@/components/ui/date-input";
import { Avatar } from "@/components/ui/misc";
import { useFirstError } from "@/components/use-first-error";

/* ───────────────────────────── Présentation ───────────────────────────── */

const KIND: Record<
  SuggestionKind,
  { label: string; icon: React.ReactNode; tone: string }
> = {
  deposit: {
    label: "Acompte",
    icon: <Wallet />,
    tone: "text-[var(--info)] bg-[var(--info-soft)]",
  },
  session: {
    label: "Séance effectuée",
    icon: <CalendarCheck />,
    tone: "text-[var(--accent)] bg-[var(--accent-soft)]",
  },
  balance: {
    label: "Solde",
    icon: <Flag />,
    tone: "text-[var(--success)] bg-[var(--success-soft)]",
  },
  quote: {
    label: "Devis accepté",
    icon: <FileText />,
    tone: "text-[var(--warning)] bg-[var(--warning-soft)]",
  },
};

const KIND_ORDER: Record<SuggestionKind, number> = {
  deposit: 0,
  session: 1,
  quote: 2,
  balance: 3,
};

const METHODS = [
  { value: "twint", label: "TWINT" },
  { value: "cash", label: "Espèces" },
  { value: "card", label: "Carte" },
  { value: "bank_transfer", label: "Virement" },
] as const;

type Method = (typeof METHODS)[number]["value"];

/** Montant en centimes → texte éditable (« 1'260.00 »). */
function toInput(cents: number) {
  return formatCHF(cents, { showCurrency: false });
}

/** « Léa Martin » → « LM » */
function nameInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return initials(parts[0], parts.length > 1 ? parts[parts.length - 1] : "");
}

/**
 * À l'ouverture, le focus va sur la fenêtre elle-même plutôt que sur le premier
 * champ : sur iPhone, le clavier ne recouvre pas le récapitulatif à relire.
 */
function focusDialog(event: Event) {
  event.preventDefault();
  (event.currentTarget as HTMLElement | null)?.focus();
}

interface ClientOption {
  id: string;
  name: string;
}

/* ──────────────────────────────── Page ──────────────────────────────── */

export function BillingHub({
  suggestions,
  clients,
  scope,
  defaultClientId,
  requestedKey,
  requestedMissing,
  detailedHref,
  vatRate,
  hourlyRate,
  minimumPrice,
  paymentTermDays,
}: {
  suggestions: BillingSuggestion[];
  clients: ClientOption[];
  scope: { label: string; clearHref: string } | null;
  defaultClientId: string | null;
  requestedKey: string | null;
  requestedMissing: boolean;
  detailedHref: string;
  vatRate: number;
  hourlyRate: number;
  minimumPrice: number;
  paymentTermDays: number;
}) {
  const [active, setActive] = React.useState<BillingSuggestion | null>(
    () => suggestions.find((suggestion) => suggestion.key === requestedKey) ?? null,
  );
  const [quickOpen, setQuickOpen] = React.useState(false);

  // Regroupement par client, dans l'ordre des suggestions (les plus récentes d'abord).
  const groups = React.useMemo(() => {
    const map = new Map<string, { clientId: string; clientName: string; items: BillingSuggestion[] }>();
    for (const suggestion of suggestions) {
      const group = map.get(suggestion.clientId) ?? {
        clientId: suggestion.clientId,
        clientName: suggestion.clientName,
        items: [],
      };
      group.items.push(suggestion);
      map.set(suggestion.clientId, group);
    }
    // Dans un groupe : acompte, séances, devis, puis le solde qui les englobe.
    for (const group of map.values()) {
      group.items.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
    }
    return [...map.values()];
  }, [suggestions]);

  const projectsWithSessions = React.useMemo(
    () =>
      new Set(
        suggestions
          .filter((suggestion) => suggestion.kind === "session" && suggestion.projectId)
          .map((suggestion) => suggestion.projectId),
      ),
    [suggestions],
  );

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/factures"
        className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors mb-4"
      >
        <ChevronLeft className="size-3.5" />
        Factures
      </Link>

      <header className="mb-6">
        <h1 className="text-[24px] sm:text-[28px] leading-tight font-semibold tracking-[-0.025em]">
          Que veux-tu facturer ?
        </h1>
        <p className="text-[14px] text-[var(--fg-muted)] mt-2 leading-relaxed">
          Les montants sont calculés à partir de tes devis acceptés et des séances effectuées.
          Vérifie, confirme : la facture est émise avec sa QR-facture.
        </p>
        {scope && (
          <div className="inline-flex items-center gap-1.5 mt-3 pl-3 pr-1 h-8 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[13px]">
            <span className="text-[var(--fg-muted)]">Pour</span>
            <span className="font-medium text-[var(--fg)] truncate max-w-[220px]">{scope.label}</span>
            <Link
              href={scope.clearHref}
              aria-label="Afficher tous les clients"
              className="compact-touch grid place-items-center size-6 rounded-full text-[var(--fg-subtle)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] transition-colors"
            >
              <X className="size-3.5" />
            </Link>
          </div>
        )}
      </header>

      {requestedMissing && (
        <div className="flex items-start gap-2.5 p-3.5 mb-5 rounded-[var(--radius-md)] bg-[var(--info-soft)] border border-[var(--info)]/25 animate-slide-up">
          <Info className="size-4 text-[var(--info)] shrink-0 mt-0.5" />
          <p className="text-[13px] text-[var(--fg-muted)] leading-relaxed">
            Cette prestation est déjà facturée : elle n&apos;apparaît plus dans la liste.
          </p>
        </div>
      )}

      {groups.length > 0 ? (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.clientId} className="animate-fade-in">
              <div className="flex items-center gap-2.5 mb-2.5">
                <Avatar size="sm" initials={nameInitials(group.clientName)} />
                <Link
                  href={`/clients/${group.clientId}`}
                  className="text-[14px] font-semibold text-[var(--fg)] hover:underline underline-offset-2"
                >
                  {group.clientName}
                </Link>
              </div>
              <ul className="space-y-2">
                {group.items.map((suggestion) => (
                  <li key={suggestion.key}>
                    <SuggestionCard
                      suggestion={suggestion}
                      coversSessions={
                        suggestion.kind === "balance" &&
                        projectsWithSessions.has(suggestion.projectId)
                      }
                      onSelect={() => setActive(suggestion)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center text-center py-12 px-6 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] animate-fade-in">
          <div className="grid place-items-center size-12 rounded-full bg-[var(--success-soft)] text-[var(--success)] mb-4 [&_svg]:size-5">
            <Sparkles />
          </div>
          <h2 className="text-[15px] font-semibold">Tout est facturé</h2>
          <p className="text-[13px] text-[var(--fg-muted)] mt-1.5 max-w-sm leading-relaxed">
            Dès qu&apos;un devis est accepté ou qu&apos;une séance est marquée « Effectuée » dans
            l&apos;agenda, elle apparaît ici avec son montant.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setQuickOpen(true)}
        className={cn(
          "group w-full flex items-center gap-3.5 mt-6 p-4 text-left",
          "rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)]",
          "transition-all duration-200 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]",
          "active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
        )}
      >
        <span className="grid place-items-center size-10 shrink-0 rounded-full bg-[var(--surface-2)] text-[var(--fg-muted)] group-hover:text-[var(--accent)] transition-colors [&_svg]:size-[18px]">
          <Plus />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium text-[var(--fg)]">
            Facturer autre chose
          </span>
          <span className="block text-[12px] text-[var(--fg-subtle)] mt-0.5">
            Un flash, une retouche, un bon cadeau… Un client, un montant, c&apos;est tout.
          </span>
        </span>
        <ChevronRight className="size-4 text-[var(--fg-subtle)] shrink-0" />
      </button>

      <p className="mt-6 mb-2 text-center text-[12px] text-[var(--fg-subtle)]">
        Plusieurs lignes, une remise ?{" "}
        <Link
          href={detailedHref}
          className="inline-flex items-center gap-1 text-[var(--fg-muted)] underline underline-offset-2 hover:text-[var(--fg)]"
        >
          <ListPlus className="size-3.5" />
          Formulaire détaillé
        </Link>
      </p>

      <Dialog open={active !== null} onOpenChange={(open) => !open && setActive(null)}>
        {active && (
          <SuggestionDialog
            key={active.key}
            suggestion={active}
            vatRate={vatRate}
            paymentTermDays={paymentTermDays}
          />
        )}
      </Dialog>

      <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
        {quickOpen && (
          <QuickInvoiceDialog
            clients={clients}
            defaultClientId={defaultClientId}
            vatRate={vatRate}
            hourlyRate={hourlyRate}
            minimumPrice={minimumPrice}
            paymentTermDays={paymentTermDays}
          />
        )}
      </Dialog>
    </div>
  );
}

/* ──────────────────────────── Suggestion ──────────────────────────── */

function SuggestionCard({
  suggestion,
  coversSessions,
  onSelect,
}: {
  suggestion: BillingSuggestion;
  coversSessions: boolean;
  onSelect: () => void;
}) {
  const kind = KIND[suggestion.kind];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group w-full flex items-center gap-3.5 p-4 text-left",
        "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]",
        "transition-all duration-200 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)]",
        "active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
      )}
    >
      <span
        className={cn(
          "grid place-items-center size-10 shrink-0 rounded-full [&_svg]:size-[18px]",
          kind.tone,
        )}
      >
        {kind.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] text-[var(--fg-subtle)] truncate">
          {kind.label}
          {suggestion.projectTitle &&
            !suggestion.label.includes(suggestion.projectTitle) &&
            ` · ${suggestion.projectTitle}`}
        </span>
        <span className="block text-[14px] font-medium text-[var(--fg)] leading-snug mt-0.5">
          {suggestion.label}
        </span>
        <span className="block text-[12px] text-[var(--fg-muted)] mt-1 leading-snug">
          {suggestion.explanation}
        </span>
        {coversSessions && (
          <span className="block text-[12px] text-[var(--fg-subtle)] mt-1 leading-snug">
            Inclut les séances ci-dessus : facture l&apos;un ou l&apos;autre.
          </span>
        )}
      </span>
      <span className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[15px] font-semibold tabular text-[var(--fg)]">
          {formatCHF(suggestion.amount)}
        </span>
        <span className="inline-flex items-center gap-0.5 text-[12px] font-medium text-[var(--accent)]">
          Facturer
          <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </span>
    </button>
  );
}

/* ─────────────────────────── Paiement reçu ─────────────────────────── */

function PaymentQuestion({
  paid,
  onPaidChange,
  method,
  onMethodChange,
  paymentTermDays,
}: {
  paid: "yes" | "no";
  onPaidChange: (value: "yes" | "no") => void;
  method: Method;
  onMethodChange: (value: Method) => void;
  paymentTermDays: number;
}) {
  return (
    <div className="space-y-2.5">
      <p className="text-[13px] font-medium text-[var(--fg-muted)]">Le client a déjà payé ?</p>
      <ChoiceGroup
        ariaLabel="Le client a déjà payé ?"
        columns={1}
        value={paid}
        onChange={onPaidChange}
        options={[
          {
            value: "no",
            label: "Pas encore",
            hint: `Payable par QR-facture sous ${paymentTermDays} jours`,
          },
          { value: "yes", label: "Oui, c'est encaissé", hint: "La facture est marquée payée" },
        ]}
      />
      {paid === "yes" && (
        <div className="animate-slide-up pt-1">
          <p className="text-[12px] text-[var(--fg-subtle)] mb-2">Comment ?</p>
          <div className="grid grid-cols-2 min-[420px]:grid-cols-4 gap-2" role="radiogroup" aria-label="Moyen de paiement">
            {METHODS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={method === option.value}
                onClick={() => onMethodChange(option.value)}
                className={cn(
                  "h-11 rounded-[var(--radius-md)] border text-[13px] font-medium transition-all duration-200",
                  "active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
                  method === option.value
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--fg)]"
                    : "border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--fg-muted)] hover:border-[var(--border-strong)]",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────── Dates ─────────────────────────────── */

/** « AAAA-MM-JJ » + n jours, en date locale. */
function shiftDay(day: string, days: number) {
  const [year, month, date] = day.split("-").map(Number);
  return toDateInput(addDays(new Date(year, month - 1, date), days));
}

/**
 * Date de la facture et échéance, choisies dans le calendrier. L'échéance suit
 * la date de la facture (délai des réglages) tant qu'on ne l'a pas changée.
 */
function InvoiceDates({
  paid,
  paymentTermDays,
  errors,
}: {
  paid: "yes" | "no";
  paymentTermDays: number;
  errors?: Record<string, string>;
}) {
  const [issuedAt, setIssuedAt] = React.useState(() => toDateInput(new Date()));
  const [dueAt, setDueAt] = React.useState(() =>
    shiftDay(toDateInput(new Date()), paymentTermDays),
  );
  const [dueEdited, setDueEdited] = React.useState(false);

  function changeIssuedAt(value: string) {
    setIssuedAt(value);
    if (value && !dueEdited) setDueAt(shiftDay(value, paymentTermDays));
  }

  return (
    <div className="grid gap-4 grid-cols-1 min-[420px]:grid-cols-2">
      <Field
        label={paid === "yes" ? "Date de la facture et du paiement" : "Date de la facture"}
        htmlFor="issuedAt"
        error={errors?.issuedAt}
      >
        <DateInput
          id="issuedAt"
          name="issuedAt"
          required
          value={issuedAt}
          onChange={(event) => changeIssuedAt(event.target.value)}
          aria-invalid={Boolean(errors?.issuedAt) || undefined}
        />
      </Field>
      {paid === "no" && (
        <Field
          label="Échéance"
          htmlFor="dueAt"
          error={errors?.dueAt}
          hint={dueEdited ? undefined : `${paymentTermDays} jours après la facture`}
        >
          <DateInput
            id="dueAt"
            name="dueAt"
            required
            min={issuedAt || undefined}
            value={dueAt}
            onChange={(event) => {
              setDueAt(event.target.value);
              setDueEdited(true);
            }}
            aria-invalid={Boolean(errors?.dueAt) || undefined}
          />
        </Field>
      )}
    </div>
  );
}

/* ─────────────────────── Récapitulatif et envoi ─────────────────────── */

function IssueFooter({
  amount,
  vatRate,
  pending,
  error,
}: {
  amount: number;
  vatRate: number;
  pending: boolean;
  error?: string;
}) {
  const vat = vatRate > 0 && amount > 0 ? fromGross(amount, vatRate).vatAmount : 0;
  return (
    <div className="sticky bottom-0 px-6 pt-4 pb-5 mt-5 border-t border-[var(--border)] bg-[var(--surface)] rounded-b-[var(--radius-xl)] space-y-3">
      {error && (
        <p className="flex items-start gap-2 text-[13px] text-[var(--danger)] animate-fade-in" role="alert">
          <AlertCircle className="size-4 shrink-0 mt-px" />
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending} disabled={amount <= 0}>
        Émettre la facture{amount > 0 && ` · ${formatCHF(amount)}`}
      </Button>
      <p className="flex items-start justify-center gap-1.5 text-[11px] text-[var(--fg-subtle)] text-center leading-relaxed">
        <Lock className="size-3 shrink-0 mt-0.5" />
        <span>
          {vat > 0 ? `TVA ${vatRate} % incluse (${formatCHF(vat)}). ` : ""}
          Une facture émise n&apos;est plus modifiable : une erreur se corrige par une note de crédit.
        </span>
      </p>
    </div>
  );
}

/* ───────────────────────── Depuis une suggestion ───────────────────────── */

function SuggestionDialog({
  suggestion,
  vatRate,
  paymentTermDays,
}: {
  suggestion: BillingSuggestion;
  vatRate: number;
  paymentTermDays: number;
}) {
  const [state, formAction, pending] = useActionState<QuickBillingState, FormData>(
    createInvoiceFromSuggestion,
    {},
  );
  const formRef = React.useRef<HTMLFormElement>(null);
  useFirstError(formRef, state);
  const [amountText, setAmountText] = React.useState(() => toInput(suggestion.amount));
  const [label, setLabel] = React.useState(suggestion.label);
  const [paid, setPaid] = React.useState<"yes" | "no">("no");
  const [method, setMethod] = React.useState<Method>("twint");

  const amount = parseCHF(amountText);
  const edited = amount !== suggestion.amount;
  const kind = KIND[suggestion.kind];

  return (
    <DialogContent size="sm" className="p-0" onOpenAutoFocus={focusDialog}>
      <form ref={formRef} action={formAction} noValidate>
        <input type="hidden" name="key" value={suggestion.key} />
        <input type="hidden" name="description" value={suggestion.description ?? ""} />
        <input type="hidden" name="paid" value={paid} />
        <input type="hidden" name="method" value={method} />

        <div className="px-6 pt-6 pr-14">
          <p className="flex items-center gap-2 text-[12px] text-[var(--fg-subtle)]">
            <span className={cn("grid place-items-center size-5 rounded-full [&_svg]:size-3", kind.tone)}>
              {kind.icon}
            </span>
            {kind.label}
          </p>
          <DialogTitle className="mt-2">{suggestion.clientName}</DialogTitle>
          <DialogDescription>
            {suggestion.projectTitle ?? "Sans projet"}
            {suggestion.clientEmail ? "" : " · pas d'e-mail enregistré"}
          </DialogDescription>
        </div>

        <div className="px-6 pt-5 space-y-5">
          <Field label="Montant" htmlFor="amount" error={state.fieldErrors?.amount}>
            <MoneyInput
              id="amount"
              name="amount"
              value={amountText}
              onChange={(event) => setAmountText(event.target.value)}
              onBlur={() => amount > 0 && setAmountText(toInput(amount))}
              className="h-14 text-[22px] font-semibold"
              aria-invalid={Boolean(state.fieldErrors?.amount) || undefined}
            />
          </Field>
          <div className="-mt-3 flex items-start gap-2 text-[12px] leading-relaxed">
            {edited ? (
              <>
                <span className="text-[var(--warning)] flex-1">
                  Montant modifié (calcul : {formatCHF(suggestion.amount)})
                </span>
                <button
                  type="button"
                  onClick={() => setAmountText(toInput(suggestion.amount))}
                  className="compact-touch inline-flex items-center gap-1 text-[var(--accent)] hover:underline shrink-0"
                >
                  <RotateCcw className="size-3" />
                  Rétablir
                </button>
              </>
            ) : (
              <span className="text-[var(--fg-subtle)]">{suggestion.explanation}</span>
            )}
          </div>

          <Field label="Sur la facture" htmlFor="label" error={state.fieldErrors?.label}>
            <Input
              id="label"
              name="label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={160}
              aria-invalid={Boolean(state.fieldErrors?.label) || undefined}
            />
          </Field>

          <PaymentQuestion
            paid={paid}
            onPaidChange={setPaid}
            method={method}
            onMethodChange={setMethod}
            paymentTermDays={paymentTermDays}
          />

          <InvoiceDates paid={paid} paymentTermDays={paymentTermDays} errors={state.fieldErrors} />
        </div>

        <IssueFooter amount={amount} vatRate={vatRate} pending={pending} error={state.error} />
      </form>
    </DialogContent>
  );
}

/* ─────────────────────────── Montant libre ─────────────────────────── */

const PRESETS = ["Séance de tatouage", "Flash", "Retouche", "Bon cadeau"];
const DURATIONS = [1, 2, 3, 4, 6];

function QuickInvoiceDialog({
  clients,
  defaultClientId,
  vatRate,
  hourlyRate,
  minimumPrice,
  paymentTermDays,
}: {
  clients: ClientOption[];
  defaultClientId: string | null;
  vatRate: number;
  hourlyRate: number;
  minimumPrice: number;
  paymentTermDays: number;
}) {
  const [state, formAction, pending] = useActionState<QuickBillingState, FormData>(
    createQuickInvoice,
    {},
  );
  const formRef = React.useRef<HTMLFormElement>(null);
  useFirstError(formRef, state);
  const [clientId, setClientId] = React.useState(
    defaultClientId && clients.some((client) => client.id === defaultClientId) ? defaultClientId : "",
  );
  const [label, setLabel] = React.useState("");
  const [amountText, setAmountText] = React.useState("");
  const [hours, setHours] = React.useState<number | null>(null);
  const [paid, setPaid] = React.useState<"yes" | "no">("no");
  const [method, setMethod] = React.useState<Method>("twint");

  const amount = parseCHF(amountText);

  function pickDuration(value: number) {
    setHours(value);
    const computed = roundTo5Cents(Math.round(hourlyRate * value));
    setAmountText(toInput(Math.max(computed, minimumPrice)));
    if (!label.trim()) setLabel("Séance de tatouage");
  }

  return (
    <DialogContent size="sm" className="p-0" onOpenAutoFocus={focusDialog}>
      <form ref={formRef} action={formAction} noValidate>
        <input type="hidden" name="paid" value={paid} />
        <input type="hidden" name="method" value={method} />
        <input type="hidden" name="description" value={hours ? `Durée : ${String(hours).replace(".", ",")} h` : ""} />

        <div className="px-6 pt-6 pr-14">
          <DialogTitle>Facturer autre chose</DialogTitle>
          <DialogDescription>Trois informations, et la facture est prête.</DialogDescription>
        </div>

        <div className="px-6 pt-5 space-y-5">
          <Field label="Client" htmlFor="clientId" error={state.fieldErrors?.clientId}>
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

          <Field label="Quoi ?" htmlFor="label" error={state.fieldErrors?.label}>
            <Input
              id="label"
              name="label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Flash « Hirondelle »"
              maxLength={160}
              className="h-12 text-[15px]"
              aria-invalid={Boolean(state.fieldErrors?.label) || undefined}
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setLabel(preset)}
                  className={cn(
                    "compact-touch h-8 px-3 rounded-full border text-[12px] font-medium transition-colors",
                    label === preset
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--fg)]"
                      : "border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]",
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Montant" htmlFor="amount" error={state.fieldErrors?.amount}>
            <MoneyInput
              id="amount"
              name="amount"
              value={amountText}
              onChange={(event) => {
                setAmountText(event.target.value);
                setHours(null);
              }}
              onBlur={() => amount > 0 && setAmountText(toInput(amount))}
              className="h-14 text-[22px] font-semibold"
              aria-invalid={Boolean(state.fieldErrors?.amount) || undefined}
            />
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[12px] text-[var(--fg-subtle)] mr-1">
                Au tarif horaire ({formatCHF(hourlyRate)}) :
              </span>
              {DURATIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => pickDuration(value)}
                  className={cn(
                    "compact-touch h-8 min-w-11 px-2.5 rounded-full border text-[12px] font-medium tabular transition-colors",
                    hours === value
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--fg)]"
                      : "border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]",
                  )}
                >
                  {value} h
                </button>
              ))}
            </div>
          </Field>

          <PaymentQuestion
            paid={paid}
            onPaidChange={setPaid}
            method={method}
            onMethodChange={setMethod}
            paymentTermDays={paymentTermDays}
          />

          <InvoiceDates paid={paid} paymentTermDays={paymentTermDays} errors={state.fieldErrors} />
        </div>

        <IssueFooter amount={amount} vatRate={vatRate} pending={pending} error={state.error} />
      </form>
    </DialogContent>
  );
}
