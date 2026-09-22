import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Download, CheckCircle2, Clock } from "lucide-react";
import { db, getSettings } from "@/lib/db";
import { formatCHF } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { DocumentPreview } from "@/components/document-preview";
import { Badge } from "@/components/ui/badge";
import { AcceptQuote } from "./accept-quote";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Ton devis",
  robots: { index: false, follow: false },
};

/**
 * Page publique de consultation d'un devis, accessible par jeton.
 * Aucun compte n'est nécessaire — c'est le lien envoyé au client.
 */
export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [quote, settings] = await Promise.all([
    db.quote.findUnique({
      where: { publicToken: token },
      include: { client: true, items: { orderBy: { position: "asc" } } },
    }),
    getSettings(),
  ]);

  if (!quote) notFound();

  const expired = quote.validUntil < new Date();
  const accepted = quote.status === "accepted";

  return (
    <div className="min-h-dvh bg-[var(--bg)]">
      <header className="border-b border-[var(--border)] bg-[var(--bg-subtle)]">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--accent)]">
            {settings.studioName}
          </p>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] mt-2">
            Ton devis {quote.number}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {accepted ? (
              <Badge tone="success" size="md" dot>
                Accepté le {formatDate(quote.acceptedAt ?? new Date())}
              </Badge>
            ) : expired ? (
              <Badge tone="warning" size="md" dot>
                Expiré le {formatDate(quote.validUntil)}
              </Badge>
            ) : (
              <Badge tone="info" size="md" dot>
                <Clock className="size-3" />
                Valable jusqu&apos;au {formatDate(quote.validUntil)}
              </Badge>
            )}
            <Badge size="md">{formatCHF(quote.total)}</Badge>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {accepted ? (
          <div className="flex items-start gap-3 p-4 rounded-[var(--radius-md)] bg-[var(--success-soft)] border border-[var(--success)]/30">
            <CheckCircle2 className="size-5 text-[var(--success)] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Devis accepté — merci !</p>
              <p className="text-[13px] text-[var(--fg-muted)] mt-1 leading-relaxed">
                {settings.ownerName || settings.studioName} revient vers toi pour fixer la
                première séance
                {quote.depositAmount > 0 &&
                  ` et l'acompte de ${formatCHF(quote.depositAmount)}`}
                .
              </p>
            </div>
          </div>
        ) : expired ? (
          <div className="p-4 rounded-[var(--radius-md)] bg-[var(--warning-soft)] border border-[var(--warning)]/30">
            <p className="text-[13px] text-[var(--fg-muted)]">
              Ce devis a expiré. Contacte
              {settings.email ? ` ${settings.studioName} à ${settings.email}` : " le salon"}{" "}
              pour en obtenir un nouveau.
            </p>
          </div>
        ) : (
          <AcceptQuote
            token={token}
            total={formatCHF(quote.total)}
            deposit={quote.depositAmount > 0 ? formatCHF(quote.depositAmount) : null}
          />
        )}

        <DocumentPreview
          kind="quote"
          settings={settings}
          number={quote.number}
          client={quote.client}
          issuedAt={quote.issuedAt}
          secondDate={quote.validUntil}
          items={quote.items}
          subtotal={quote.subtotal}
          discount={quote.discount}
          vatRate={quote.vatRate}
          vatAmount={quote.vatAmount}
          total={quote.total}
          depositAmount={quote.depositAmount}
          notes={quote.notes}
          terms={quote.terms}
        />

        <div className="flex justify-center">
          <a
            href={`/api/devis/${quote.id}/pdf?token=${token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-sm)] border border-[var(--border-strong)] text-sm font-medium transition-colors hover:bg-[var(--surface-2)]"
          >
            <Download className="size-4" />
            Télécharger le PDF
          </a>
        </div>
      </main>

      <footer className="border-t border-[var(--border)] py-8 mt-8">
        <p className="text-center text-[12px] text-[var(--fg-subtle)]">
          {settings.studioName}
          {settings.email && ` · ${settings.email}`}
          {settings.phone && ` · ${settings.phone}`}
        </p>
      </footer>
    </div>
  );
}
