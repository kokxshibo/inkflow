"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, AlertCircle, Banknote } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { recordPayment, deletePayment, type InvoiceState } from "../actions";
import { formatCHF } from "@/lib/money";
import { formatDate, toDateInput } from "@/lib/utils";
import { PAYMENT_METHOD, labelOf } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, Select } from "@/components/ui/field";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Payment {
  id: string;
  amount: number;
  method: string;
  paidAt: string;
  reference: string | null;
  note: string | null;
}

export function PaymentPanel({
  invoiceId,
  remaining,
  payments,
}: {
  invoiceId: string;
  remaining: number;
  payments: Payment[];
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = useActionState<
    InvoiceState & { success?: boolean },
    FormData
  >(recordPayment, {});
  const [, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (state.success) {
      toast.success("Paiement enregistré");
      setOpen(false);
    }
  }, [state.success]);

  function remove(paymentId: string) {
    startTransition(async () => {
      await deletePayment(paymentId);
      toast.success("Paiement supprimé");
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Paiements</CardTitle>
          {remaining > 0 && (
            <Button variant="primary" size="xs" onClick={() => setOpen(true)}>
              <Plus />
              Encaisser
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="flex flex-col items-center py-4 text-center">
              <Banknote className="size-5 text-[var(--fg-subtle)] mb-2" />
              <p className="text-[13px] text-[var(--fg-subtle)]">
                Aucun paiement enregistré.
              </p>
              {remaining > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => setOpen(true)}
                >
                  <Plus />
                  Enregistrer un paiement
                </Button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              <AnimatePresence initial={false}>
                {payments.map((payment) => (
                  <motion.li
                    key={payment.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2 py-2.5 group overflow-hidden"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold tabular">
                        {formatCHF(payment.amount)}
                      </p>
                      <p className="text-[11px] text-[var(--fg-subtle)] truncate">
                        {labelOf(PAYMENT_METHOD, payment.method)} ·{" "}
                        {formatDate(payment.paidAt)}
                        {payment.reference && ` · ${payment.reference}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(payment.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded text-[var(--fg-subtle)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                      aria-label="Supprimer ce paiement"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Enregistrer un paiement</DialogTitle>
            <DialogDescription>
              Reste à payer : <strong>{formatCHF(remaining)}</strong>
            </DialogDescription>
          </DialogHeader>

          <form action={formAction}>
            <input type="hidden" name="invoiceId" value={invoiceId} />

            <DialogBody className="space-y-4">
              {state.error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 p-3 rounded-[var(--radius-sm)] bg-[var(--danger-soft)] border border-[var(--danger)]/25"
                >
                  <AlertCircle className="size-4 text-[var(--danger)] shrink-0 mt-px" />
                  <p className="text-[13px] text-[var(--danger)]">{state.error}</p>
                </div>
              )}

              <Field label="Montant" htmlFor="amount" required>
                <MoneyInput
                  id="amount"
                  name="amount"
                  required
                  autoFocus
                  defaultValue={formatCHF(Math.max(0, remaining), { showCurrency: false })}
                />
              </Field>

              <Field
                label="Moyen de paiement"
                htmlFor="method"
                hint="TWINT est le moyen le plus courant en Suisse."
              >
                <Select
                  id="method"
                  name="method"
                  defaultValue="twint"
                  options={PAYMENT_METHOD.map((o) => ({ value: o.value, label: o.label }))}
                />
              </Field>

              <Field label="Date du paiement" htmlFor="paidAt" required>
                <Input
                  id="paidAt"
                  name="paidAt"
                  type="date"
                  required
                  defaultValue={toDateInput(new Date())}
                />
              </Field>

              <Field label="Référence" htmlFor="reference" hint="Facultatif">
                <Input
                  id="reference"
                  name="reference"
                  placeholder="N° de transaction, bordereau…"
                />
              </Field>
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={pending}>
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
