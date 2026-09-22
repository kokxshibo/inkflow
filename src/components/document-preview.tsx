import type { Client, Settings } from "@prisma/client";
import { formatCHF, formatIban, formatQrReference } from "@/lib/money";
import { formatDate, fullName } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface Item {
  id: string;
  label: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
}

/**
 * Aperçu à l'écran du document tel qu'il sortira en PDF.
 * Le PDF réel est généré côté serveur (lib/pdf.ts) avec la QR-facture suisse.
 */
export function DocumentPreview({
  kind,
  settings,
  number,
  client,
  issuedAt,
  secondDate,
  items,
  subtotal,
  discount,
  vatRate,
  vatAmount,
  total,
  depositAmount,
  amountPaid,
  qrReference,
  notes,
  terms,
}: {
  kind: "quote" | "invoice";
  settings: Settings;
  number: string;
  client: Client;
  issuedAt: Date;
  secondDate: Date;
  items: Item[];
  subtotal: number;
  discount: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  depositAmount?: number;
  amountPaid?: number;
  qrReference?: string | null;
  notes?: string | null;
  terms?: string | null;
}) {
  const isQuote = kind === "quote";
  const iban = settings.qrIban || settings.iban;

  return (
    <Card className="p-5 sm:p-8">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-6 pb-6 border-b border-[var(--border)]">
        <div>
          <p className="text-lg font-semibold tracking-[-0.02em]">
            {settings.studioName}
          </p>
          <div className="text-[12px] text-[var(--fg-muted)] mt-1.5 leading-relaxed">
            {settings.ownerName && <p>{settings.ownerName}</p>}
            {settings.addressLine && <p>{settings.addressLine}</p>}
            {(settings.postalCode || settings.city) && (
              <p>
                {settings.postalCode} {settings.city}
              </p>
            )}
            {settings.email && <p>{settings.email}</p>}
            {settings.phone && <p>{settings.phone}</p>}
            {settings.ide && (
              <p className="mt-1.5 tabular">
                {settings.ide}
                {settings.vatEnabled ? " TVA" : ""}
              </p>
            )}
          </div>
        </div>

        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-[var(--fg-subtle)]">
            {isQuote ? "Devis" : "Facture"}
          </p>
          <p className="text-xl font-semibold tabular mt-0.5">{number}</p>
          <div className="text-[12px] text-[var(--fg-muted)] mt-2.5 space-y-0.5">
            <p>
              Date : <span className="tabular">{formatDate(issuedAt)}</span>
            </p>
            <p>
              {isQuote ? "Valable jusqu'au" : "Échéance"} :{" "}
              <span className="tabular">{formatDate(secondDate)}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Destinataire */}
      <div className="py-6">
        <p className="text-[11px] uppercase tracking-wider text-[var(--fg-subtle)] mb-1.5">
          {isQuote ? "Établi pour" : "Facturé à"}
        </p>
        <p className="text-sm font-medium">{fullName(client)}</p>
        <div className="text-[12px] text-[var(--fg-muted)] mt-0.5 leading-relaxed">
          {client.addressLine && <p>{client.addressLine}</p>}
          {(client.postalCode || client.city) && (
            <p>
              {client.postalCode} {client.city}
            </p>
          )}
          {client.email && <p className="mt-1">{client.email}</p>}
        </div>
        {!client.addressLine && (
          <p className="text-[11px] text-[var(--warning)] mt-2">
            Adresse manquante — elle est obligatoire sur une facture.
          </p>
        )}
      </div>

      {/* Lignes */}
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-[13px] min-w-[420px]">
          <thead>
            <tr className="border-y border-[var(--border)]">
              <th className="text-left font-medium text-[var(--fg-subtle)] text-[11px] uppercase tracking-wider py-2.5">
                Désignation
              </th>
              <th className="text-center font-medium text-[var(--fg-subtle)] text-[11px] uppercase tracking-wider py-2.5 w-12">
                Qté
              </th>
              <th className="text-right font-medium text-[var(--fg-subtle)] text-[11px] uppercase tracking-wider py-2.5 w-20">
                Prix unit.
              </th>
              <th className="text-right font-medium text-[var(--fg-subtle)] text-[11px] uppercase tracking-wider py-2.5 w-24">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="py-3 pr-3 align-top">
                  <p className="font-medium">{item.label}</p>
                  {item.description && (
                    <p className="text-[12px] text-[var(--fg-muted)] mt-0.5">
                      {item.description}
                    </p>
                  )}
                </td>
                <td className="py-3 text-center tabular text-[var(--fg-muted)] align-top">
                  {item.quantity}
                </td>
                <td className="py-3 text-right tabular text-[var(--fg-muted)] align-top">
                  {formatCHF(item.unitPrice, { showCurrency: false })}
                </td>
                <td className="py-3 text-right tabular font-medium align-top">
                  {formatCHF(Math.round(item.quantity * item.unitPrice), {
                    showCurrency: false,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totaux */}
      <div className="flex justify-end pt-5">
        <dl className="w-full sm:w-72 space-y-2 text-[13px]">
          <Row label="Sous-total">{formatCHF(subtotal)}</Row>
          {discount > 0 && (
            <Row label="Remise">
              <span className="text-[var(--success)]">− {formatCHF(discount)}</span>
            </Row>
          )}
          {vatRate > 0 ? (
            <Row label={`TVA ${vatRate} %`}>{formatCHF(vatAmount)}</Row>
          ) : (
            <p className="text-[11px] text-[var(--fg-subtle)] py-1">
              Non assujetti à la TVA au sens de la LTVA.
            </p>
          )}
          <div className="flex items-center justify-between pt-2.5 border-t border-[var(--border-strong)]">
            <dt className="font-semibold">Total</dt>
            <dd className="text-lg font-semibold tabular">{formatCHF(total)}</dd>
          </div>

          {isQuote && depositAmount !== undefined && depositAmount > 0 && (
            <div className="flex items-center justify-between pt-2 text-[var(--accent)]">
              <dt className="text-[12px] font-medium">Acompte à verser</dt>
              <dd className="text-[13px] font-semibold tabular">
                {formatCHF(depositAmount)}
              </dd>
            </div>
          )}

          {!isQuote && amountPaid !== undefined && amountPaid > 0 && (
            <>
              <Row label="Déjà reçu">
                <span className="text-[var(--success)]">− {formatCHF(amountPaid)}</span>
              </Row>
              <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                <dt className="text-[12px] font-medium">Reste à payer</dt>
                <dd className="text-[13px] font-semibold tabular">
                  {formatCHF(total - amountPaid)}
                </dd>
              </div>
            </>
          )}
        </dl>
      </div>

      {/* Notes */}
      {(notes || terms) && (
        <div className="mt-8 pt-5 border-t border-[var(--border)] space-y-3">
          {notes && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[var(--fg-subtle)] mb-1">
                Note
              </p>
              <p className="text-[12px] text-[var(--fg-muted)] whitespace-pre-wrap leading-relaxed">
                {notes}
              </p>
            </div>
          )}
          {terms && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[var(--fg-subtle)] mb-1">
                Conditions
              </p>
              <p className="text-[12px] text-[var(--fg-muted)] whitespace-pre-wrap leading-relaxed">
                {terms}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Bloc de paiement — aperçu de la QR-facture */}
      {!isQuote && (
        <div className="mt-8 pt-5 border-t border-dashed border-[var(--border-strong)]">
          <div className="flex items-start gap-4">
            <div className="grid place-items-center size-20 rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--border)] shrink-0">
              <span className="text-[10px] text-[var(--fg-subtle)] text-center leading-tight px-1">
                QR
                <br />
                suisse
              </span>
            </div>
            <div className="min-w-0 text-[12px] text-[var(--fg-muted)] space-y-1">
              <p className="font-medium text-[var(--fg)]">Section de paiement</p>
              {iban ? (
                <>
                  <p className="tabular">IBAN {formatIban(iban)}</p>
                  {qrReference && (
                    <p className="tabular">
                      Référence {formatQrReference(qrReference)}
                    </p>
                  )}
                  <p className="tabular">Montant {formatCHF(total)}</p>
                  <p className="text-[11px] text-[var(--fg-subtle)] pt-1">
                    La QR-facture complète et scannable figure sur le PDF.
                  </p>
                </>
              ) : (
                <p className="text-[var(--warning)]">
                  Aucun IBAN configuré — renseigne-le dans les réglages pour générer la
                  QR-facture.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[var(--fg-muted)]">{label}</dt>
      <dd className="tabular">{children}</dd>
    </div>
  );
}
