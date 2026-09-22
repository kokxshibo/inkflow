"use client";

import * as React from "react";
import Link from "next/link";
import type { Invoice } from "@prisma/client";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Send,
  Download,
  Mail,
  FileMinus,
  XCircle,
  Copy,
} from "lucide-react";
import {
  deleteInvoice,
  sendInvoice,
  setInvoiceStatus,
  createCreditNote,
} from "../actions";
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

export function InvoiceActions({ invoice }: { invoice: Invoice }) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [confirmCredit, setConfirmCredit] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const isDraft = invoice.status === "draft";

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

  function copyLink() {
    const url = `${window.location.origin}/facture-publique/${invoice.publicToken}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Lien copié"),
      () => toast.error("Impossible de copier le lien"),
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button asChild variant="secondary" size="sm">
          <a
            href={`/api/factures/${invoice.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Download />
            <span className="hidden sm:inline">PDF</span>
          </a>
        </Button>

        {isDraft ? (
          <Button
            variant="primary"
            size="sm"
            loading={pending}
            onClick={() => run(() => sendInvoice(invoice.id), "Facture émise")}
          >
            <Send />
            <span className="hidden sm:inline">Émettre</span>
          </Button>
        ) : (
          <Button asChild variant="primary" size="sm">
            <Link
              href={`/messagerie/nouveau?client=${invoice.clientId}&facture=${invoice.id}`}
            >
              <Mail />
              <span className="hidden sm:inline">Envoyer</span>
            </Link>
          </Button>
        )}

        <Dropdown>
          <DropdownTrigger asChild>
            <Button variant="secondary" size="icon" aria-label="Plus d'actions">
              <MoreHorizontal />
            </Button>
          </DropdownTrigger>
          <DropdownContent className="min-w-[230px]">
            {isDraft && (
              <DropdownItem asChild>
                <Link href={`/factures/${invoice.id}/modifier`}>
                  <Pencil /> Modifier
                </Link>
              </DropdownItem>
            )}
            <DropdownItem asChild>
              <Link
                href={`/messagerie/nouveau?client=${invoice.clientId}&facture=${invoice.id}`}
              >
                <Mail /> Envoyer par e-mail
              </Link>
            </DropdownItem>
            <DropdownItem onSelect={copyLink}>
              <Copy /> Copier le lien client
            </DropdownItem>

            {!isDraft && invoice.status !== "cancelled" && (
              <>
                <DropdownSeparator />
                <DropdownLabel>Correction</DropdownLabel>
                <DropdownItem onSelect={() => setConfirmCredit(true)}>
                  <FileMinus /> Établir une note de crédit
                </DropdownItem>
                <DropdownItem
                  onSelect={() =>
                    run(
                      () => setInvoiceStatus(invoice.id, "cancelled"),
                      "Facture marquée annulée",
                    )
                  }
                  disabled={pending}
                >
                  <XCircle /> Marquer annulée
                </DropdownItem>
              </>
            )}

            {isDraft && (
              <>
                <DropdownSeparator />
                <DropdownItem destructive onSelect={() => setConfirmDelete(true)}>
                  <Trash2 /> Supprimer le brouillon
                </DropdownItem>
              </>
            )}
          </DropdownContent>
        </Dropdown>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Supprimer le brouillon ${invoice.number} ?`}
        description="Seuls les brouillons peuvent être supprimés. Le numéro ne sera pas réattribué."
        confirmLabel="Supprimer"
        destructive
        loading={pending}
        onConfirm={() => run(() => deleteInvoice(invoice.id), "Brouillon supprimé")}
      />

      <ConfirmDialog
        open={confirmCredit}
        onOpenChange={setConfirmCredit}
        title="Établir une note de crédit ?"
        description={
          <>
            Une note de crédit reprenant les montants en négatif sera créée, et la facture{" "}
            {invoice.number} passera en « Annulée ». C&apos;est la procédure correcte pour
            corriger une facture déjà émise : les deux documents restent archivés.
          </>
        }
        confirmLabel="Créer la note de crédit"
        loading={pending}
        onConfirm={() => run(() => createCreditNote(invoice.id), "Note de crédit créée")}
      />
    </>
  );
}
