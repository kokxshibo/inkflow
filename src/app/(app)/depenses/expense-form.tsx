"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import type { Expense } from "@prisma/client";
import { AlertCircle, Save, Paperclip, Info } from "lucide-react";
import { saveExpense, type ExpenseState } from "./actions";
import {
  EXPENSE_CATEGORY,
  EXPENSE_PAYMENT_METHOD,
  EXPENSE_STATUS,
  VAT_INFO,
} from "@/lib/constants";
import { formatCHF, parseCHF, formatIban } from "@/lib/money";
import { splitGrossAmount } from "@/lib/swiss-qr";
import type { ExpensePrefill } from "@/lib/scan";
import { toDateInput } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CheckboxField,
  Field,
  Input,
  MoneyInput,
  Select,
  Textarea,
} from "@/components/ui/field";
import { DateInput } from "@/components/ui/date-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ExpenseForm({
  expense,
  prefill,
  scanData,
  attachmentFile,
  vatEnabled,
  defaultVatRate,
  cancelHref,
  submitLabel = "Enregistrer",
}: {
  expense?: Expense;
  /** Données lues par le scanner (QR-facture et/ou IA), à vérifier avant d'enregistrer */
  prefill?: ExpensePrefill | null;
  /** Version numérisée par l'IA (JSON), gardée avec la dépense */
  scanData?: string | null;
  /** Fichier issu du scanner, réinjecté dans l'envoi du formulaire */
  attachmentFile?: File | null;
  vatEnabled: boolean;
  defaultVatRate: number;
  cancelHref: string;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<ExpenseState, FormData>(
    saveExpense,
    {},
  );

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [amountGross, setAmountGross] = React.useState(
    expense
      ? formatCHF(expense.amountGross, { showCurrency: false })
      : prefill?.amountCents != null
        ? formatCHF(prefill.amountCents, { showCurrency: false })
        : "",
  );
  const [vatRate, setVatRate] = React.useState<number>(
    expense?.vatRate ?? prefill?.vatRate ?? (vatEnabled ? defaultVatRate : 0),
  );
  const [recurring, setRecurring] = React.useState(
    Boolean(expense?.recurrenceMonths),
  );

  // Le fichier photographié n'est pas attaché nativement à l'<input file> :
  // on l'y réinjecte pour qu'il parte avec le formulaire.
  React.useEffect(() => {
    if (!attachmentFile || !fileInputRef.current) return;
    const transfer = new DataTransfer();
    transfer.items.add(attachmentFile);
    fileInputRef.current.files = transfer.files;
  }, [attachmentFile]);

  const gross = parseCHF(amountGross);
  const { net, vat } = splitGrossAmount(gross, vatRate);

  return (
    <form action={formAction} className="space-y-5">
      {expense && <input type="hidden" name="id" value={expense.id} />}
      {prefill?.fromQr && <input type="hidden" name="scannedFromQr" value="on" />}
      {scanData && <input type="hidden" name="scanData" value={scanData} />}
      <input type="hidden" name="vatRate" value={vatRate} />

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
          <CardTitle>Le fournisseur</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Fournisseur"
            htmlFor="supplier"
            required
            error={state.fieldErrors?.supplier}
            className="sm:col-span-2"
          >
            <Input
              id="supplier"
              name="supplier"
              required
              autoFocus={!prefill}
              defaultValue={expense?.supplier ?? prefill?.supplier ?? ""}
              placeholder="Killer Ink, Eternal Ink, régie immobilière…"
            />
          </Field>

          <Field label="Catégorie" htmlFor="category">
            <Select
              id="category"
              name="category"
              defaultValue={expense?.category ?? prefill?.category ?? "inks"}
              options={EXPENSE_CATEGORY.map((o) => ({ value: o.value, label: o.label }))}
            />
          </Field>

          <Field
            label="N° de facture"
            htmlFor="invoiceNumber"
            hint="Celui du fournisseur"
          >
            <Input
              id="invoiceNumber"
              name="invoiceNumber"
              defaultValue={expense?.invoiceNumber ?? prefill?.invoiceNumber ?? ""}
              className="tabular"
            />
          </Field>

          <Field
            label="Description"
            htmlFor="label"
            className="sm:col-span-2"
            hint="Ce qui a été acheté."
          >
            <Input
              id="label"
              name="label"
              defaultValue={expense?.label ?? prefill?.label ?? ""}
              placeholder="Encres noires 6 × 120 ml + cartouches"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Montant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Montant total payé"
              htmlFor="amountGross"
              required
              error={state.fieldErrors?.amountGross}
              hint="TTC, tel qu'il figure sur la facture."
            >
              <MoneyInput
                id="amountGross"
                name="amountGross"
                required
                value={amountGross}
                onChange={(event) => setAmountGross(event.target.value)}
              />
            </Field>

            <Field
              label="Taux de TVA"
              htmlFor="vatRateSelect"
              hint="Celui appliqué par le fournisseur."
            >
              <Select
                id="vatRateSelect"
                value={String(vatRate)}
                onChange={(event) => setVatRate(Number(event.target.value))}
                options={[
                  { value: "0", label: "Sans TVA" },
                  { value: String(VAT_INFO.standardRate), label: `${VAT_INFO.standardRate} % — taux normal` },
                  { value: String(VAT_INFO.reducedRate), label: `${VAT_INFO.reducedRate} % — taux réduit` },
                  { value: String(VAT_INFO.lodgingRate), label: `${VAT_INFO.lodgingRate} % — hébergement` },
                ]}
              />
            </Field>
          </div>

          {gross > 0 && (
            <div className="grid grid-cols-3 gap-3 p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border)]">
              <Split label="Hors taxe" value={formatCHF(net)} />
              <Split label={`TVA ${vatRate > 0 ? `${vatRate} %` : ""}`} value={formatCHF(vat)} />
              <Split label="Total payé" value={formatCHF(gross)} strong />
            </div>
          )}

          {vatEnabled ? (
            <CheckboxField
              id="vatDeductible"
              name="vatDeductible"
              label="Récupérer la TVA (impôt préalable)"
              hint="À cocher si cette dépense est liée à l'activité et déductible dans ton décompte AFC."
              defaultChecked={expense?.vatDeductible ?? vatRate > 0}
            />
          ) : (
            <div className="flex items-start gap-2.5 p-3 rounded-[var(--radius-sm)] bg-[var(--info-soft)] border border-[var(--info)]/20">
              <Info className="size-4 text-[var(--info)] shrink-0 mt-0.5" />
              <p className="text-[12px] text-[var(--fg-muted)] leading-relaxed">
                Tu n&apos;es pas assujetti à la TVA : l&apos;impôt préalable n&apos;est
                pas récupérable. La TVA payée fait simplement partie de la charge.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dates et paiement</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Date de la facture" htmlFor="issuedAt" required>
            <DateInput
              id="issuedAt"
              name="issuedAt"
              required
              defaultValue={
                expense ? toDateInput(expense.issuedAt) : prefill?.invoiceDate ?? toDateInput(new Date())
              }
            />
          </Field>

          <Field label="Échéance" htmlFor="dueAt" hint="Facultatif">
            <DateInput
              id="dueAt"
              name="dueAt"
              defaultValue={expense ? toDateInput(expense.dueAt) : prefill?.dueDate ?? ""}
            />
          </Field>

          <Field label="Statut" htmlFor="status">
            <Select
              id="status"
              name="status"
              defaultValue={expense?.status ?? "to_pay"}
              options={EXPENSE_STATUS.map((o) => ({ value: o.value, label: o.label }))}
            />
          </Field>

          <Field label="Moyen de paiement" htmlFor="paymentMethod">
            <Select
              id="paymentMethod"
              name="paymentMethod"
              defaultValue={expense?.paymentMethod ?? prefill?.paymentMethod ?? ""}
              placeholder="Non précisé"
              options={EXPENSE_PAYMENT_METHOD.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
            />
          </Field>

          <Field
            label="Date de paiement"
            htmlFor="paidAt"
            className="sm:col-span-2"
            hint="Remplir une date passe automatiquement la dépense en « payée »."
          >
            <DateInput
              id="paidAt"
              name="paidAt"
              defaultValue={expense ? toDateInput(expense.paidAt) : prefill?.paidDate ?? ""}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Coordonnées de paiement lues par le scanner */}
      {(prefill?.iban || prefill?.reference || expense?.creditorIban) && (
        <Card>
          <CardHeader>
            <CardTitle>Coordonnées de paiement</CardTitle>
            <p className="text-[13px] text-[var(--fg-muted)]">
              {prefill?.fromQr
                ? "Extraites de la QR-facture."
                : prefill
                  ? "Lues sur le document : vérifie-les avant de payer."
                  : "Pour retrouver le paiement dans tes relevés."}
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="IBAN du créancier" htmlFor="creditorIban">
              <Input
                id="creditorIban"
                name="creditorIban"
                defaultValue={
                  expense?.creditorIban
                    ? formatIban(expense.creditorIban)
                    : prefill?.iban
                      ? formatIban(prefill.iban)
                      : ""
                }
                className="tabular text-[12px]"
              />
            </Field>
            <Field label="Nom du créancier" htmlFor="creditorName">
              <Input
                id="creditorName"
                name="creditorName"
                defaultValue={expense?.creditorName ?? prefill?.creditorName ?? ""}
              />
            </Field>
            <Field
              label="Référence"
              htmlFor="qrReference"
              className="sm:col-span-2"
              hint={
                prefill?.referenceType === "QRR"
                  ? "Référence QRR — à reprendre telle quelle lors du paiement."
                  : undefined
              }
            >
              <Input
                id="qrReference"
                name="qrReference"
                defaultValue={expense?.qrReference ?? prefill?.reference ?? ""}
                className="tabular text-[12px]"
              />
            </Field>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="size-4 text-[var(--fg-subtle)]" />
            Justificatif
          </CardTitle>
          <p className="text-[13px] text-[var(--fg-muted)]">
            À conserver 10 ans (art. 958f CO).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            id="attachment"
            name="attachment"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            className="block w-full text-[13px] text-[var(--fg-muted)] file:mr-3 file:h-10 file:px-4 file:rounded-[var(--radius-sm)] file:border-0 file:bg-[var(--surface-2)] file:text-[var(--fg)] file:text-[13px] file:font-medium"
          />

          {expense?.attachmentUrl && !attachmentFile && (
            <p className="text-[12px] text-[var(--fg-muted)]">
              Justificatif actuel :{" "}
              <a
                href={expense.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline"
              >
                {expense.attachmentName ?? "voir le fichier"}
              </a>
              . En choisir un nouveau remplacera celui-ci.
            </p>
          )}

          <div className="pt-1 space-y-3 border-t border-[var(--border)]">
            <div className="pt-3">
              <CheckboxField
                id="recurringToggle"
                label="Charge récurrente"
                hint="Loyer, abonnement, assurance… Un bouton permettra de dupliquer la dépense sur l'échéance suivante."
                checked={recurring}
                onCheckedChange={setRecurring}
              />
            </div>
            {recurring && (
              <Field label="Tous les" htmlFor="recurrenceMonths" className="max-w-[200px]">
                <Select
                  id="recurrenceMonths"
                  name="recurrenceMonths"
                  defaultValue={String(expense?.recurrenceMonths ?? 1)}
                  options={[
                    { value: "1", label: "Mois" },
                    { value: "3", label: "Trimestre" },
                    { value: "6", label: "Semestre" },
                    { value: "12", label: "An" },
                  ]}
                />
              </Field>
            )}
          </div>

          <Field label="Notes" htmlFor="notes">
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={expense?.notes ?? ""}
              placeholder="N° de lot des encres, garantie, remarque pour la fiduciaire…"
            />
          </Field>
        </CardContent>
      </Card>

      <div className="sticky-actions sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-3.5 glass border-t border-[var(--border)] flex items-center justify-between gap-3 z-20">
        <span className="hidden sm:block text-[13px] text-[var(--fg-muted)]">
          Total :{" "}
          <span className="font-semibold text-[var(--fg)] tabular">
            {formatCHF(gross)}
          </span>
        </span>
        <div className="flex items-center gap-2.5 ml-auto">
          <Button asChild variant="ghost" type="button">
            <Link href={cancelHref}>Annuler</Link>
          </Button>
          <Button type="submit" variant="primary" loading={pending}>
            <Save />
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Split({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-[var(--fg-subtle)] truncate">
        {label}
      </p>
      <p
        className={
          "tabular truncate mt-0.5 " +
          (strong ? "text-[14px] font-semibold" : "text-[13px] text-[var(--fg-muted)]")
        }
      >
        {value}
      </p>
    </div>
  );
}
