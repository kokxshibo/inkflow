"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Trash2,
  Stethoscope,
  AlertCircle,
  Paperclip,
} from "lucide-react";
import { saveHealthCost, deleteHealthCost, type PersonalState } from "../actions";
import { formatCHF } from "@/lib/money";
import { formatDate, toDateInput } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface HealthCost {
  id: string;
  date: string;
  provider: string;
  description: string | null;
  amount: number;
  reimbursed: number;
  appliedToFranchise: number;
  appliedToCoinsurance: number;
  attachmentUrl: string | null;
}

/**
 * Suivi des frais médicaux de l'année.
 * La répartition franchise / quote-part est calculée côté serveur à l'ajout,
 * dans l'ordre chronologique de saisie.
 */
export function HealthCosts({ costs }: { costs: HealthCost[] }) {
  const [addOpen, setAddOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<HealthCost | null>(null);
  const [, startTransition] = React.useTransition();

  const total = costs.reduce((sum, cost) => sum + cost.amount, 0);

  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Frais médicaux</CardTitle>
            <p className="text-[13px] text-[var(--fg-muted)] mt-0.5">
              {costs.length} facture{costs.length > 1 ? "s" : ""} ·{" "}
              {formatCHF(total)} cette année
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
            <Plus />
            <span className="hidden sm:inline">Ajouter</span>
          </Button>
        </CardHeader>

        <CardContent>
          {costs.length === 0 ? (
            <EmptyState
              icon={<Stethoscope />}
              title="Aucun frais médical"
              description="Enregistre tes factures de médecin ou de pharmacie : la franchise et la quote-part se calculent toutes seules."
              className="py-10 border-0"
            />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              <AnimatePresence initial={false}>
                {costs.map((cost) => (
                  <motion.li
                    key={cost.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-3 py-3 group overflow-hidden"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-medium truncate">
                          {cost.provider}
                        </p>
                        {cost.attachmentUrl && (
                          <a
                            href={cost.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--fg-subtle)] hover:text-[var(--accent)] transition-colors"
                            aria-label="Voir le justificatif"
                          >
                            <Paperclip className="size-3.5" />
                          </a>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--fg-subtle)] truncate mt-0.5">
                        {formatDate(cost.date)}
                        {cost.description && ` · ${cost.description}`}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {cost.appliedToFranchise > 0 && (
                          <Badge tone="info">
                            Franchise {formatCHF(cost.appliedToFranchise)}
                          </Badge>
                        )}
                        {cost.appliedToCoinsurance > 0 && (
                          <Badge tone="warning">
                            Quote-part {formatCHF(cost.appliedToCoinsurance)}
                          </Badge>
                        )}
                        {cost.reimbursed > 0 && (
                          <Badge tone="success">
                            Remboursé {formatCHF(cost.reimbursed)}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-semibold tabular">
                        {formatCHF(cost.amount)}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="iconSm"
                      onClick={() => setToDelete(cost)}
                      aria-label="Supprimer"
                      className="shrink-0 text-[var(--fg-subtle)] hover:text-[var(--danger)]"
                    >
                      <Trash2 />
                    </Button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </CardContent>
      </Card>

      <AddCostDialog open={addOpen} onOpenChange={setAddOpen} />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(value) => !value && setToDelete(null)}
        title="Supprimer ce frais ?"
        description="La franchise et la quote-part déjà calculées sur les autres lignes ne sont pas recalculées automatiquement."
        confirmLabel="Supprimer"
        destructive
        onConfirm={() => {
          if (!toDelete) return;
          startTransition(async () => {
            await deleteHealthCost(toDelete.id);
            toast.success("Frais supprimé");
            setToDelete(null);
          });
        }}
      />
    </>
  );
}

function AddCostDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState<PersonalState, FormData>(
    saveHealthCost,
    {},
  );

  React.useEffect(() => {
    if (state.success) {
      toast.success("Frais enregistré");
      onOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Nouveau frais médical</DialogTitle>
          <DialogDescription>
            La répartition entre franchise et quote-part est calculée automatiquement.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction}>
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

            <Field label="Prestataire" htmlFor="provider" required>
              <Input
                id="provider"
                name="provider"
                required
                autoFocus
                placeholder="Dr Müller, Pharmacie du Rhône…"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Montant" htmlFor="amount" required>
                <MoneyInput id="amount" name="amount" required />
              </Field>
              <Field label="Date" htmlFor="date" required>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  required
                  defaultValue={toDateInput(new Date())}
                />
              </Field>
            </div>

            <Field
              label="Déjà remboursé"
              htmlFor="reimbursed"
              hint="Laisse à zéro si le décompte n'est pas encore arrivé."
            >
              <MoneyInput id="reimbursed" name="reimbursed" defaultValue="0.00" />
            </Field>

            <Field label="Description" htmlFor="description">
              <Textarea
                id="description"
                name="description"
                rows={2}
                placeholder="Consultation, analyses, médicaments…"
              />
            </Field>

            <Field label="Justificatif" htmlFor="attachment" hint="Photo ou PDF">
              <input
                id="attachment"
                name="attachment"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                className="block w-full text-[13px] text-[var(--fg-muted)] file:mr-3 file:h-10 file:px-4 file:rounded-[var(--radius-sm)] file:border-0 file:bg-[var(--surface-2)] file:text-[var(--fg)] file:text-[13px] file:font-medium"
              />
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
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
