import { Sparkles, TriangleAlert } from "lucide-react";
import { formatCHF } from "@/lib/money";
import type { ScanExtraction } from "@/lib/scan";
import { Badge } from "@/components/ui/badge";

/** Libellés complets : l'accord change selon le document (« facture lue », « reçu lu »). */
const DOCUMENT_TYPES: Record<ScanExtraction["documentType"], string> = {
  facture: "Facture lue par l'IA",
  ticket: "Ticket de caisse lu par l'IA",
  recu: "Reçu lu par l'IA",
  autre: "Document lu par l'IA",
};

const CONFIDENCE: Record<ScanExtraction["confidence"], { label: string; tone: "success" | "warning" | "danger" }> = {
  haute: { label: "Lecture sûre", tone: "success" },
  moyenne: { label: "Lecture à vérifier", tone: "warning" },
  basse: { label: "Lecture incertaine", tone: "danger" },
};

/** Quantité sans formatage régional : rendu identique sur le serveur et le navigateur. */
const formatQuantity = (value: number) => String(Math.round(value * 1000) / 1000);

/** Version numérisée d'une facture scannée : ce que l'IA a lu, ligne par ligne. */
export function ScanDigest({ extraction }: { extraction: ScanExtraction }) {
  const confidence = CONFIDENCE[extraction.confidence];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info" className="gap-1">
          <Sparkles className="size-3" />
          {DOCUMENT_TYPES[extraction.documentType]}
        </Badge>
        <Badge tone={confidence.tone}>{confidence.label}</Badge>
      </div>

      {(extraction.supplier || extraction.supplierAddress) && (
        <p className="text-[13px] leading-relaxed">
          <strong className="font-semibold">{extraction.supplier || "Fournisseur illisible"}</strong>
          {extraction.supplierAddress && (
            <span className="block text-[12px] text-[var(--fg-muted)]">{extraction.supplierAddress}</span>
          )}
        </p>
      )}

      {extraction.warnings.length > 0 && (
        <ul className="space-y-1.5 p-3 rounded-[var(--radius-sm)] bg-[var(--warning-soft)] border border-[var(--warning)]/25">
          {extraction.warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-2 text-[12px] leading-relaxed">
              <TriangleAlert className="size-3.5 text-[var(--warning)] shrink-0 mt-0.5" />
              {warning}
            </li>
          ))}
        </ul>
      )}

      {extraction.lines.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--border)]">
          <table className="w-full text-[12px]">
            <thead className="bg-[var(--bg-subtle)] text-[var(--fg-subtle)]">
              <tr>
                <th scope="col" className="text-left font-medium px-3 py-2">Désignation</th>
                <th scope="col" className="text-right font-medium px-2 py-2">Qté</th>
                <th scope="col" className="text-right font-medium px-3 py-2">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {extraction.lines.map((line, index) => (
                <tr key={`${index}-${line.description}`}>
                  <td className="px-3 py-2 align-top">
                    {line.description || "—"}
                    {line.quantity > 1 && line.unitPrice > 0 && (
                      <span className="block text-[11px] text-[var(--fg-subtle)] tabular">
                        {formatQuantity(line.quantity)} × {formatCHF(line.unitPrice)}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right tabular align-top">
                    {line.quantity ? formatQuantity(line.quantity) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular align-top whitespace-nowrap">
                    {formatCHF(line.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
        {extraction.invoiceNumber && (
          <>
            <dt className="text-[var(--fg-subtle)]">N° de facture</dt>
            <dd className="text-right tabular">{extraction.invoiceNumber}</dd>
          </>
        )}
        {extraction.vatAmount != null && (
          <>
            <dt className="text-[var(--fg-subtle)]">
              TVA{extraction.vatRate ? ` ${extraction.vatRate} %` : ""}
            </dt>
            <dd className="text-right tabular">{formatCHF(extraction.vatAmount)}</dd>
          </>
        )}
        <dt className="text-[var(--fg-subtle)] font-medium">Total lu</dt>
        <dd className="text-right tabular font-semibold">
          {extraction.total != null ? formatCHF(extraction.total) : "Illisible"}
          {extraction.currency && extraction.currency !== "CHF" ? ` (${extraction.currency})` : ""}
        </dd>
      </dl>
    </div>
  );
}
