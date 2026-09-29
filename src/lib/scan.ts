/**
 * Facture scannée : ce que l'IA a lu (version numérisée) et la fusion avec la
 * QR-facture suisse éventuellement décodée sur l'appareil.
 *
 * La QR-facture est exacte (IBAN, montant, référence) : elle a priorité. L'IA
 * complète le reste (fournisseur, date, numéro, TVA, lignes, catégorie).
 * Module partagé entre le navigateur et le serveur.
 */
import type { SwissQrData } from "./swiss-qr";
import { toDateInput } from "./utils";

export interface ScanLine {
  description: string;
  quantity: number;
  /** Centimes */
  unitPrice: number;
  /** Centimes */
  amount: number;
}

export interface ScanExtraction {
  documentType: "facture" | "ticket" | "recu" | "autre";
  supplier: string;
  supplierAddress: string;
  invoiceNumber: string;
  /** AAAA-MM-JJ, vide si absente */
  invoiceDate: string;
  dueDate: string;
  currency: string;
  /** Centimes, null si illisible */
  total: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  iban: string;
  reference: string;
  category: string;
  description: string;
  /** Ticket de caisse ou mention « payé » : déjà réglé */
  paid: boolean;
  lines: ScanLine[];
  warnings: string[];
  confidence: "haute" | "moyenne" | "basse";
  model: string;
  analyzedAt: string;
}

export interface ExpensePrefill {
  supplier?: string;
  label?: string;
  invoiceNumber?: string;
  amountCents?: number;
  vatRate?: number;
  invoiceDate?: string;
  dueDate?: string;
  iban?: string;
  creditorName?: string;
  reference?: string;
  referenceType?: string;
  category?: string;
  paymentMethod?: string;
  paidDate?: string;
  fromQr: boolean;
  fromAi: boolean;
}

/** Taux proposés dans le formulaire ; un autre taux lu est ramené au plus proche. */
export const VAT_CHOICES = [0, 2.6, 3.8, 8.1];

export function snapVatRate(rate: number | null | undefined) {
  if (rate == null || !Number.isFinite(rate)) return undefined;
  return VAT_CHOICES.reduce((best, choice) =>
    Math.abs(choice - rate) < Math.abs(best - rate) ? choice : best,
  );
}

export function mergePrefill(qr: SwissQrData | null, ai: ScanExtraction | null): ExpensePrefill {
  const prefill: ExpensePrefill = { fromQr: Boolean(qr), fromAi: Boolean(ai) };

  if (ai) {
    prefill.supplier = ai.supplier || undefined;
    prefill.label = ai.description || undefined;
    prefill.invoiceNumber = ai.invoiceNumber || undefined;
    prefill.amountCents = ai.total ?? undefined;
    prefill.vatRate = snapVatRate(ai.vatRate);
    prefill.invoiceDate = ai.invoiceDate || undefined;
    prefill.dueDate = ai.dueDate || undefined;
    prefill.iban = ai.iban || undefined;
    prefill.creditorName = ai.supplier || undefined;
    prefill.reference = ai.reference || undefined;
    prefill.category = ai.category || undefined;
    if (ai.paid) {
      prefill.paidDate = ai.invoiceDate || undefined;
    } else if (ai.iban) {
      prefill.paymentMethod = "bank_transfer";
    }
  }

  if (qr) {
    prefill.supplier = qr.creditorName || prefill.supplier;
    prefill.creditorName = qr.creditorName || prefill.creditorName;
    prefill.iban = qr.iban || prefill.iban;
    if (qr.amountCents != null) prefill.amountCents = qr.amountCents;
    prefill.reference = qr.reference ?? prefill.reference;
    prefill.referenceType = qr.referenceType;
    prefill.invoiceNumber = qr.invoiceNumber ?? prefill.invoiceNumber;
    if (qr.invoiceDate) prefill.invoiceDate = toDateInput(qr.invoiceDate);
    if (qr.vatRate != null) prefill.vatRate = snapVatRate(qr.vatRate);
    if (!prefill.label && qr.message) prefill.label = qr.message;
    if (!prefill.paidDate) prefill.paymentMethod = "qr_bill";
  }

  return prefill;
}
