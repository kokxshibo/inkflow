"use client";

import { saveInvoice } from "./actions";
import { DocumentForm, type DocumentDefaults } from "@/components/document-form";

export function InvoiceFormWrapper(props: {
  clients: { id: string; firstName: string; lastName: string }[];
  projects: { id: string; title: string; clientId: string }[];
  defaults?: DocumentDefaults;
  vatEnabled: boolean;
  vatRate: number;
  paymentTermDays: number;
  defaultDepositPercent: number;
  cancelHref: string;
}) {
  return <DocumentForm mode="invoice" action={saveInvoice} {...props} />;
}
