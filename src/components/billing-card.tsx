import Link from "next/link";
import { ChevronRight, ReceiptText } from "lucide-react";
import type { BillingSuggestion } from "@/lib/billing";
import { formatCHF } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Ce qui reste à facturer, avec le montant déjà calculé.
 * Chaque ligne ouvre directement la confirmation de facture.
 */
export function BillingCard({
  suggestions,
  limit = 4,
  moreHref = "/factures/nouvelle",
  showClient = false,
}: {
  suggestions: BillingSuggestion[];
  limit?: number;
  moreHref?: string;
  showClient?: boolean;
}) {
  if (suggestions.length === 0) return null;
  const visible = suggestions.slice(0, limit);
  const hidden = suggestions.length - visible.length;

  return (
    <Card className="border-[var(--accent)]/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ReceiptText className="size-4 text-[var(--accent)]" />
          À facturer
        </CardTitle>
        <Link
          href={moreHref}
          className="text-[12px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
        >
          {hidden > 0 ? `Tout voir (${suggestions.length})` : "Tout voir"}
        </Link>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1">
          {visible.map((suggestion) => (
            <li key={suggestion.key}>
              <Link
                href={`/factures/nouvelle?facturer=${suggestion.key}`}
                className="group flex items-center gap-3 p-2.5 -mx-2.5 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-colors"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-[var(--fg)] truncate">
                    {showClient ? `${suggestion.clientName} · ` : ""}
                    {suggestion.label}
                  </span>
                  <span className="block text-[11px] text-[var(--fg-subtle)] truncate mt-0.5">
                    {suggestion.explanation}
                  </span>
                </span>
                <span className="text-[13px] font-semibold tabular shrink-0">
                  {formatCHF(suggestion.amount)}
                </span>
                <ChevronRight className="size-4 text-[var(--fg-subtle)] shrink-0 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
