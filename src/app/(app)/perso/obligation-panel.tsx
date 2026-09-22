"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  CheckCircle2,
  Trash2,
  CalendarPlus,
  AlertCircle,
  CalendarClock,
} from "lucide-react";
import {
  saveObligation,
  payObligation,
  deleteObligation,
  generateSchedule,
  type PersonalState,
} from "./actions";
import { OBLIGATION_STATUS } from "@/lib/constants";
import { formatCHF } from "@/lib/money";
import { formatDate, toDateInput } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { Field, Input, MoneyInput, Textarea } from "@/components/ui/field";
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ObligationRow {
  id: string;
  label: string;
  period: string | null;
  amount: number;
  paidAmount: number;
  dueAt: string;
  paidAt: string | null;
  status: string;
  reference: string | null;
}

/**
 * Liste et gestion des échéances d'une catégorie (AVS, LAMal, impôts).
 * Partagée par les trois pages pour garder un comportement identique.
 */
export function ObligationPanel({
  kind,
  title,
  obligations,
  scheduleLabel,
  scheduleInstallments,
}: {
  kind: "avs" | "lamal" | "tax";
  title: string;
  obligations: ObligationRow[];
  scheduleLabel: string;
  scheduleInstallments: number;
}) {
  const [addOpen, setAddOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<ObligationRow | null>(null);
  const [pending, startTransition] = React.useTransition();

  const now = new Date();
  const year = now.getFullYear();

  const totalPlanned = obligations.reduce((sum, o) => sum + o.amount, 0);
  const totalPaid = obligations.reduce((sum, o) => sum + o.paidAmount, 0);

  function pay(obligation: ObligationRow) {
    startTransition(async () => {
      await payObligation(obligation.id);
      toast.success(`${obligation.label} — marquée payée`);
    });
  }

  function generate() {
    startTransition(async () => {
      const result = await generateSchedule(kind, year, scheduleInstallments);
      if (result?.error) toast.error(result.error);
      else toast.success(`${result?.count} échéance(s) créée(s) pour ${year}`);
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="text-[13px] text-[var(--fg-muted)] mt-0.5">
              {formatCHF(totalPaid)} versés sur {formatCHF(totalPlanned)} planifiés
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={pending}
              onClick={generate}
              title={`Créer les échéances de ${year}`}
            >
              <CalendarPlus />
              <span className="hidden sm:inline">{scheduleLabel}</span>
            </Button>
            <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
              <Plus />
              <span className="hidden sm:inline">Ajouter</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {obligations.length === 0 ? (
            <EmptyState
              icon={<CalendarClock />}
              title="Aucune échéance"
              description={`Génère l'échéancier ${year} en un clic, ou ajoute une échéance manuellement.`}
              action={
                <Button variant="secondary" size="sm" loading={pending} onClick={generate}>
                  <CalendarPlus />
                  {scheduleLabel}
                </Button>
              }
              className="py-10 border-0"
            />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              <AnimatePresence initial={false}>
                {obligations.map((obligation) => {
                  const late =
                    obligation.status !== "paid" && new Date(obligation.dueAt) < now;
                  const paid = obligation.status === "paid";

                  return (
                    <motion.li
                      key={obligation.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-3 py-3 group overflow-hidden"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium truncate">
                          {obligation.label}
                        </p>
                        <p className="text-[11px] text-[var(--fg-subtle)] mt-0.5">
                          Échéance{" "}
                          <span className={late ? "text-[var(--danger)]" : undefined}>
                            {formatDate(obligation.dueAt)}
                          </span>
                          {obligation.paidAt && ` · payée le ${formatDate(obligation.paidAt)}`}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-semibold tabular">
                          {formatCHF(obligation.amount)}
                        </p>
                        <StatusBadge
                          options={OBLIGATION_STATUS}
                          value={late ? "late" : obligation.status}
                          dot={false}
                          className="mt-0.5"
                        />
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {!paid && (
                          <Button
                            variant="ghost"
                            size="iconSm"
                            disabled={pending}
                            onClick={() => pay(obligation)}
                            aria-label="Marquer payée"
                            className="text-[var(--fg-subtle)] hover:text-[var(--success)]"
                          >
                            <CheckCircle2 />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="iconSm"
                          onClick={() => setToDelete(obligation)}
                          aria-label="Supprimer"
                          className="text-[var(--fg-subtle)] hover:text-[var(--danger)]"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </CardContent>
      </Card>

      <AddObligationDialog
        kind={kind}
        open={addOpen}
        onOpenChange={setAddOpen}
        year={year}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(value) => !value && setToDelete(null)}
        title={`Supprimer « ${toDelete?.label} » ?`}
        description="L'échéance disparaîtra de ton suivi. Cela ne change rien auprès de l'organisme concerné."
        confirmLabel="Supprimer"
        destructive
        onConfirm={() => {
          if (!toDelete) return;
          startTransition(async () => {
            await deleteObligation(toDelete.id);
            toast.success("Échéance supprimée");
            setToDelete(null);
          });
        }}
      />
    </>
  );
}

function AddObligationDialog({
  kind,
  open,
  onOpenChange,
  year,
}: {
  kind: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
}) {
  const [state, formAction, pending] = useActionState<PersonalState, FormData>(
    saveObligation,
    {},
  );

  React.useEffect(() => {
    if (state.success) {
      toast.success("Échéance ajoutée");
      onOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Nouvelle échéance</DialogTitle>
          <DialogDescription>
            Un acompte, une prime, un rappel — tout ce qu&apos;il ne faut pas oublier de
            payer.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction}>
          <input type="hidden" name="kind" value={kind} />

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

            <Field label="Libellé" htmlFor="label" required>
              <Input
                id="label"
                name="label"
                required
                autoFocus
                placeholder={`Acompte ${year}`}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Montant" htmlFor="amount" required>
                <MoneyInput id="amount" name="amount" required />
              </Field>
              <Field label="Échéance" htmlFor="dueAt" required>
                <Input
                  id="dueAt"
                  name="dueAt"
                  type="date"
                  required
                  defaultValue={toDateInput(new Date())}
                />
              </Field>
            </div>

            <Field label="Période" htmlFor="period" hint={`Ex. ${year}-T1, ${year}-03`}>
              <Input id="period" name="period" placeholder={`${year}-T1`} />
            </Field>

            <Field label="Référence" htmlFor="reference" hint="Référence de paiement">
              <Input id="reference" name="reference" className="tabular" />
            </Field>

            <Field label="Notes" htmlFor="notes">
              <Textarea id="notes" name="notes" rows={2} />
            </Field>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={pending}>
              Ajouter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
