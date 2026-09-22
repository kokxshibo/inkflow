"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, Plus, Trash2, GripVertical, Save, Info } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { computeTotals, computeDeposit, formatCHF, parseCHF } from "@/lib/money";
import { cn, toDateInput } from "@/lib/utils";
import { INVOICE_KIND } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface DocumentLine {
  label: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

export interface DocumentFormState {
  error?: string;
}

export interface DocumentDefaults {
  id?: string;
  clientId?: string;
  projectId?: string;
  issuedAt?: Date | string;
  validUntil?: Date | string;
  dueAt?: Date | string;
  discount?: number;
  depositPercent?: number;
  kind?: string;
  notes?: string | null;
  terms?: string | null;
  lines?: DocumentLine[];
}

const PRESETS = [
  { label: "Séance de tatouage", price: "450.00" },
  { label: "Acompte de réservation", price: "150.00" },
  { label: "Consultation et maquette", price: "80.00" },
  { label: "Retouche", price: "0.00" },
  { label: "Forfait journée", price: "1200.00" },
];

export function DocumentForm({
  mode,
  action,
  defaults,
  clients,
  projects,
  vatEnabled,
  vatRate,
  paymentTermDays,
  defaultDepositPercent,
  cancelHref,
}: {
  mode: "quote" | "invoice";
  action: (prev: DocumentFormState, formData: FormData) => Promise<DocumentFormState>;
  defaults?: DocumentDefaults;
  clients: { id: string; firstName: string; lastName: string }[];
  projects: { id: string; title: string; clientId: string }[];
  vatEnabled: boolean;
  vatRate: number;
  paymentTermDays: number;
  defaultDepositPercent: number;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<DocumentFormState, FormData>(
    action,
    {},
  );

  const [clientId, setClientId] = React.useState(defaults?.clientId ?? "");
  const [lines, setLines] = React.useState<DocumentLine[]>(
    defaults?.lines?.length
      ? defaults.lines
      : [{ label: "", description: "", quantity: "1", unitPrice: "" }],
  );
  const [discount, setDiscount] = React.useState(
    defaults?.discount ? formatCHF(defaults.discount, { showCurrency: false }) : "",
  );
  const [depositPercent, setDepositPercent] = React.useState(
    defaults?.depositPercent ?? defaultDepositPercent,
  );

  const effectiveVatRate = vatEnabled ? vatRate : 0;

  const totals = computeTotals(
    lines.map((line) => ({
      quantity: Number.parseFloat(line.quantity.replace(",", ".")) || 0,
      unitPrice: parseCHF(line.unitPrice),
    })),
    parseCHF(discount),
    effectiveVatRate,
  );
  const deposit = computeDeposit(totals.total, depositPercent);

  const clientProjects = projects.filter((project) => project.clientId === clientId);

  function updateLine(index: number, patch: Partial<DocumentLine>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function addLine(preset?: { label: string; price: string }) {
    setLines((current) => [
      ...current,
      {
        label: preset?.label ?? "",
        description: "",
        quantity: "1",
        unitPrice: preset?.price ?? "",
      },
    ]);
  }

  function removeLine(index: number) {
    setLines((current) =>
      current.length === 1
        ? [{ label: "", description: "", quantity: "1", unitPrice: "" }]
        : current.filter((_, i) => i !== index),
    );
  }

  const today = toDateInput(new Date());
  const defaultSecondDate = toDateInput(
    new Date(Date.now() + paymentTermDays * 86400000),
  );

  return (
    <form action={formAction} className="space-y-5">
      {defaults?.id && <input type="hidden" name="id" value={defaults.id} />}
      <input type="hidden" name="discount" value={discount} />
      <input type="hidden" name="depositPercent" value={depositPercent} />

      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-3.5 rounded-[var(--radius-md)] bg-[var(--danger-soft)] border border-[var(--danger)]/25 animate-slide-up"
        >
          <AlertCircle className="size-4 text-[var(--danger)] shrink-0 mt-0.5" />
          <p className="text-[13px] text-[var(--danger)]">{state.error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{mode === "quote" ? "Le devis" : "La facture"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Client" htmlFor="clientId" required>
            <Select
              id="clientId"
              name="clientId"
              required
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              placeholder="Sélectionner un client…"
              options={clients.map((client) => ({
                value: client.id,
                label: `${client.firstName} ${client.lastName}`,
              }))}
            />
          </Field>

          <Field label="Projet" htmlFor="projectId" hint="Facultatif">
            <Select
              id="projectId"
              name="projectId"
              defaultValue={defaults?.projectId ?? ""}
              placeholder="Aucun projet"
              disabled={!clientId || clientProjects.length === 0}
              options={clientProjects.map((project) => ({
                value: project.id,
                label: project.title,
              }))}
            />
          </Field>

          <Field label="Date d'émission" htmlFor="issuedAt" required>
            <Input
              id="issuedAt"
              name="issuedAt"
              type="date"
              required
              defaultValue={toDateInput(defaults?.issuedAt) || today}
            />
          </Field>

          {mode === "quote" ? (
            <Field
              label="Valable jusqu'au"
              htmlFor="validUntil"
              required
              hint="Au-delà, le devis expire automatiquement."
            >
              <Input
                id="validUntil"
                name="validUntil"
                type="date"
                required
                defaultValue={toDateInput(defaults?.validUntil) || defaultSecondDate}
              />
            </Field>
          ) : (
            <Field
              label="Échéance de paiement"
              htmlFor="dueAt"
              required
              hint={`Délai usuel en Suisse : ${paymentTermDays} jours.`}
            >
              <Input
                id="dueAt"
                name="dueAt"
                type="date"
                required
                defaultValue={toDateInput(defaults?.dueAt) || defaultSecondDate}
              />
            </Field>
          )}

          {mode === "invoice" && (
            <Field label="Type de document" htmlFor="kind" className="sm:col-span-2">
              <Select
                id="kind"
                name="kind"
                defaultValue={defaults?.kind ?? "full"}
                options={INVOICE_KIND.map((o) => ({ value: o.value, label: o.label }))}
              />
            </Field>
          )}
        </CardContent>
      </Card>

      {/* ─────────────── Lignes ─────────────── */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Prestations</CardTitle>
            <p className="text-[13px] text-[var(--fg-muted)] mt-0.5">
              Détaille ce qui est facturé — c&apos;est une mention obligatoire.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* En-têtes (desktop) */}
          <div className="hidden sm:grid grid-cols-[24px_1fr_88px_140px_36px] gap-2.5 px-1 pb-1">
            <span />
            <span className="text-[11px] font-medium text-[var(--fg-subtle)]">
              Désignation
            </span>
            <span className="text-[11px] font-medium text-[var(--fg-subtle)] text-center">
              Quantité
            </span>
            <span className="text-[11px] font-medium text-[var(--fg-subtle)] text-right">
              Prix unitaire
            </span>
            <span />
          </div>

          <AnimatePresence initial={false}>
            {lines.map((line, index) => {
              const lineTotal =
                (Number.parseFloat(line.quantity.replace(",", ".")) || 0) *
                parseCHF(line.unitPrice);

              return (
                <motion.div
                  key={index}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="grid sm:grid-cols-[24px_1fr_88px_140px_36px] gap-2.5 items-start p-3 sm:p-0 rounded-[var(--radius-md)] sm:rounded-none bg-[var(--bg-subtle)] sm:bg-transparent border sm:border-0 border-[var(--border)]">
                    <span className="hidden sm:grid place-items-center h-10 text-[var(--fg-subtle)]">
                      <GripVertical className="size-4" />
                    </span>

                    <div className="space-y-2">
                      <Input
                        name="lineLabel"
                        value={line.label}
                        onChange={(event) =>
                          updateLine(index, { label: event.target.value })
                        }
                        placeholder="Séance de tatouage — manchette, 1re séance"
                        aria-label={`Désignation ligne ${index + 1}`}
                      />
                      <Input
                        name="lineDescription"
                        value={line.description}
                        onChange={(event) =>
                          updateLine(index, { description: event.target.value })
                        }
                        placeholder="Détail (facultatif)"
                        className="h-9 text-[13px]"
                        aria-label={`Description ligne ${index + 1}`}
                      />
                    </div>

                    <Input
                      name="lineQuantity"
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(index, { quantity: event.target.value })
                      }
                      inputMode="decimal"
                      className="tabular text-center"
                      aria-label={`Quantité ligne ${index + 1}`}
                    />

                    <div className="space-y-1">
                      <MoneyInput
                        name="linePrice"
                        value={line.unitPrice}
                        onChange={(event) =>
                          updateLine(index, { unitPrice: event.target.value })
                        }
                        aria-label={`Prix unitaire ligne ${index + 1}`}
                      />
                      {lineTotal > 0 && (
                        <p className="text-[11px] text-[var(--fg-subtle)] text-right tabular">
                          = {formatCHF(lineTotal)}
                        </p>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLine(index)}
                      aria-label={`Supprimer la ligne ${index + 1}`}
                      className="text-[var(--fg-subtle)] hover:text-[var(--danger)]"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => addLine()}>
              <Plus />
              Ajouter une ligne
            </Button>
            <span className="text-[11px] text-[var(--fg-subtle)] mx-1">ou</span>
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => addLine(preset)}
                className="px-2.5 h-7 rounded-full text-[11px] font-medium bg-[var(--bg-subtle)] border border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─────────────── Totaux ─────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px] items-start">
        <Card>
          <CardHeader>
            <CardTitle>Notes et conditions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label="Note visible par le client"
              htmlFor="notes"
              hint="Apparaît sur le document."
            >
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={defaults?.notes ?? ""}
                placeholder="Prévoir 2 séances espacées de 4 semaines. Repas et boissons offerts."
              />
            </Field>
            <Field label="Conditions" htmlFor="terms">
              <Textarea
                id="terms"
                name="terms"
                rows={3}
                defaultValue={
                  defaults?.terms ??
                  (mode === "quote"
                    ? "Acompte non remboursable en cas d'annulation à moins de 72 heures du rendez-vous."
                    : "")
                }
              />
            </Field>
          </CardContent>
        </Card>

        <Card className="lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle>Total</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Sous-total">{formatCHF(totals.subtotal)}</Row>

            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-[var(--fg-muted)]">Remise</span>
              <MoneyInput
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                className="w-32 h-9"
                aria-label="Remise"
              />
            </div>

            {effectiveVatRate > 0 ? (
              <Row label={`TVA ${effectiveVatRate} %`}>{formatCHF(totals.vatAmount)}</Row>
            ) : (
              <div className="flex items-start gap-2 p-2.5 rounded-[var(--radius-sm)] bg-[var(--info-soft)] border border-[var(--info)]/20">
                <Info className="size-3.5 text-[var(--info)] shrink-0 mt-0.5" />
                <p className="text-[11px] text-[var(--fg-muted)] leading-relaxed">
                  Non assujetti à la TVA : aucune TVA n&apos;est calculée ni affichée.
                  Modifiable dans les réglages.
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-xl font-semibold tabular">
                {formatCHF(totals.total)}
              </span>
            </div>

            {mode === "quote" && (
              <div className="pt-3 border-t border-[var(--border)] space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-[var(--fg-muted)]">Acompte</span>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={depositPercent}
                      onChange={(event) =>
                        setDepositPercent(Number(event.target.value) || 0)
                      }
                      className="w-16 h-9 tabular text-center"
                      aria-label="Pourcentage d'acompte"
                    />
                    <span className="text-[13px] text-[var(--fg-muted)]">%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--fg-muted)]">
                    Montant à verser
                  </span>
                  <span className="text-sm font-semibold tabular text-[var(--accent)]">
                    {formatCHF(deposit)}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--fg-subtle)] leading-relaxed">
                  Arrondi à 0.05 CHF. Le créneau n&apos;est bloqué qu&apos;une fois
                  l&apos;acompte encaissé.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3.5 glass border-t border-[var(--border)] flex items-center justify-between gap-3 z-20">
        <span className="text-[13px] text-[var(--fg-muted)] hidden sm:block">
          Total :{" "}
          <span className="font-semibold text-[var(--fg)] tabular">
            {formatCHF(totals.total)}
          </span>
        </span>
        <div className="flex items-center gap-2.5 ml-auto">
          <Button asChild variant="ghost" type="button">
            <Link href={cancelHref}>Annuler</Link>
          </Button>
          <Button type="submit" variant="primary" loading={pending}>
            <Save />
            Enregistrer
          </Button>
        </div>
      </div>
    </form>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-[var(--fg-muted)]">{label}</span>
      <span className={cn("text-[13px] tabular")}>{children}</span>
    </div>
  );
}
