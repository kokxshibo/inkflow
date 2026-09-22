"use client";

import * as React from "react";
import Link from "next/link";
import type { Expense } from "@prisma/client";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle2,
  Copy,
  CircleAlert,
} from "lucide-react";
import {
  deleteExpense,
  duplicateExpense,
  markExpensePaid,
  setExpenseStatus,
} from "../actions";
import { EXPENSE_PAYMENT_METHOD } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  ConfirmDialog,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dialog";

export function ExpenseActions({ expense }: { expense: Expense }) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function run(fn: () => Promise<unknown>, message: string) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(message);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "L'opération a échoué");
      }
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {expense.status !== "paid" && (
          <Button
            variant="primary"
            size="sm"
            loading={pending}
            onClick={() =>
              run(
                () => markExpensePaid(expense.id, expense.paymentMethod ?? "bank_transfer"),
                "Dépense marquée payée",
              )
            }
          >
            <CheckCircle2 />
            <span className="hidden sm:inline">Marquer payée</span>
            <span className="sm:hidden">Payée</span>
          </Button>
        )}

        <Button asChild variant="secondary" size="sm">
          <Link href={`/depenses/${expense.id}/modifier`}>
            <Pencil />
            <span className="hidden sm:inline">Modifier</span>
          </Link>
        </Button>

        <Dropdown>
          <DropdownTrigger asChild>
            <Button variant="secondary" size="icon" aria-label="Plus d'actions">
              <MoreHorizontal />
            </Button>
          </DropdownTrigger>
          <DropdownContent className="min-w-[230px]">
            {expense.status !== "paid" && (
              <>
                <DropdownLabel>Marquer payée par</DropdownLabel>
                {EXPENSE_PAYMENT_METHOD.map((method) => (
                  <DropdownItem
                    key={method.value}
                    disabled={pending}
                    onSelect={() =>
                      run(
                        () => markExpensePaid(expense.id, method.value),
                        `Payée par ${method.label.toLowerCase()}`,
                      )
                    }
                  >
                    <CheckCircle2 /> {method.label}
                  </DropdownItem>
                ))}
                <DropdownSeparator />
              </>
            )}

            {expense.status === "paid" && (
              <DropdownItem
                disabled={pending}
                onSelect={() =>
                  run(() => setExpenseStatus(expense.id, "to_pay"), "Remise à payer")
                }
              >
                <CircleAlert /> Remettre « à payer »
              </DropdownItem>
            )}

            <DropdownItem
              disabled={pending}
              onSelect={() =>
                run(() => setExpenseStatus(expense.id, "disputed"), "Dépense contestée")
              }
            >
              <CircleAlert /> Contester
            </DropdownItem>

            <DropdownSeparator />
            <DropdownItem
              disabled={pending}
              onSelect={() =>
                run(() => duplicateExpense(expense.id), "Échéance suivante créée")
              }
            >
              <Copy /> Dupliquer sur l&apos;échéance suivante
            </DropdownItem>

            <DropdownSeparator />
            <DropdownItem destructive onSelect={() => setConfirmDelete(true)}>
              <Trash2 /> Supprimer
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Supprimer la dépense « ${expense.supplier} » ?`}
        description="Le justificatif joint sera supprimé lui aussi. Rappel : les pièces comptables doivent être conservées 10 ans (art. 958f CO)."
        confirmLabel="Supprimer"
        destructive
        loading={pending}
        onConfirm={() => run(() => deleteExpense(expense.id), "Dépense supprimée")}
      />
    </>
  );
}
