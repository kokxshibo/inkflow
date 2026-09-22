"use client";

import { saveQuote } from "./actions";
import {
  DocumentForm,
  type DocumentDefaults,
} from "@/components/document-form";

/**
 * Passe l'action serveur au formulaire partagé.
 * Un composant client ne peut pas importer directement une action dans une prop
 * depuis un composant serveur sans cette indirection.
 */
export function QuoteFormWrapper(props: {
  clients: { id: string; firstName: string; lastName: string }[];
  projects: { id: string; title: string; clientId: string }[];
  defaults?: DocumentDefaults;
  vatEnabled: boolean;
  vatRate: number;
  paymentTermDays: number;
  defaultDepositPercent: number;
  cancelHref: string;
}) {
  return <DocumentForm mode="quote" action={saveQuote} {...props} />;
}
