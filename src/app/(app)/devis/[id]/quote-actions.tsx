"use client";

import * as React from "react";
import Link from "next/link";
import type { Quote } from "@prisma/client";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Send,
  Download,
  CheckCircle2,
  XCircle,
  ReceiptText,
  Copy,
  Mail,
} from "lucide-react";
import { deleteQuote, sendQuote, setQuoteStatus, convertQuoteToInvoice } from "../actions";
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

export function QuoteActions({
  quote,
  publicUrl,
}: {
  quote: Quote;
  publicUrl: string;
}) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const locked = quote.status === "accepted";

  function run(fn: () => Promise<unknown>, message: string) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(message);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "L'opération a échoué",
        );
      }
    });
  }

  function copyLink() {
    navigator.clipboard.writeText(publicUrl).then(
      () => toast.success("Lien copié"),
      () => toast.error("Impossible de copier le lien"),
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button asChild variant="secondary" size="sm">
          <a href={`/api/devis/${quote.id}/pdf`} target="_blank" rel="noopener noreferrer">
            <Download />
            <span className="hidden sm:inline">PDF</span>
          </a>
        </Button>

        {quote.status === "draft" ? (
          <Button
            variant="primary"
            size="sm"
            loading={pending}
            onClick={() => run(() => sendQuote(quote.id), "Devis marqué comme envoyé")}
          >
            <Send />
            <span className="hidden sm:inline">Marquer envoyé</span>
          </Button>
        ) : quote.status === "accepted" ? (
          <Button
            variant="primary"
            size="sm"
            loading={pending}
            onClick={() => run(() => convertQuoteToInvoice(quote.id, "full"), "Facture créée")}
          >
            <ReceiptText />
            <span className="hidden sm:inline">Facturer</span>
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            loading={pending}
            onClick={() => run(() => setQuoteStatus(quote.id, "accepted"), "Devis accepté")}
          >
            <CheckCircle2 />
            <span className="hidden sm:inline">Accepté</span>
          </Button>
        )}

        <Dropdown>
          <DropdownTrigger asChild>
            <Button variant="secondary" size="icon" aria-label="Plus d'actions">
              <MoreHorizontal />
            </Button>
          </DropdownTrigger>
          <DropdownContent className="min-w-[230px]">
            {!locked && (
              <DropdownItem asChild>
                <Link href={`/devis/${quote.id}/modifier`}>
                  <Pencil /> Modifier
                </Link>
              </DropdownItem>
            )}
            <DropdownItem asChild>
              <Link href={`/messagerie/nouveau?client=${quote.clientId}&devis=${quote.id}`}>
                <Mail /> Envoyer par e-mail
              </Link>
            </DropdownItem>
            <DropdownItem onSelect={copyLink}>
              <Copy /> Copier le lien client
            </DropdownItem>

            <DropdownSeparator />
            <DropdownLabel>Statut</DropdownLabel>
            <DropdownItem
              onSelect={() => run(() => sendQuote(quote.id), "Marqué comme envoyé")}
              disabled={pending}
            >
              <Send /> Envoyé
            </DropdownItem>
            <DropdownItem
              onSelect={() => run(() => setQuoteStatus(quote.id, "accepted"), "Devis accepté")}
              disabled={pending}
            >
              <CheckCircle2 /> Accepté
            </DropdownItem>
            <DropdownItem
              onSelect={() => run(() => setQuoteStatus(quote.id, "refused"), "Devis refusé")}
              disabled={pending}
            >
              <XCircle /> Refusé
            </DropdownItem>

            <DropdownSeparator />
            <DropdownLabel>Facturer</DropdownLabel>
            <DropdownItem
              onSelect={() =>
                run(() => convertQuoteToInvoice(quote.id, "deposit"), "Facture d'acompte créée")
              }
              disabled={pending}
            >
              <ReceiptText /> Facture d&apos;acompte
            </DropdownItem>
            <DropdownItem
              onSelect={() =>
                run(() => convertQuoteToInvoice(quote.id, "full"), "Facture créée")
              }
              disabled={pending}
            >
              <ReceiptText /> Facture complète
            </DropdownItem>

            {!locked && (
              <>
                <DropdownSeparator />
                <DropdownItem destructive onSelect={() => setConfirmDelete(true)}>
                  <Trash2 /> Supprimer
                </DropdownItem>
              </>
            )}
          </DropdownContent>
        </Dropdown>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Supprimer le devis ${quote.number} ?`}
        description="Cette action est définitive. Le numéro ne sera pas réattribué — la numérotation reste séquentielle."
        confirmLabel="Supprimer"
        destructive
        loading={pending}
        onConfirm={() => run(() => deleteQuote(quote.id), "Devis supprimé")}
      />
    </>
  );
}
