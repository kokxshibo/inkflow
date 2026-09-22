import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Download, CheckCircle2, AlertTriangle } from "lucide-react";
import { db, getSettings } from "@/lib/db";
import { formatCHF } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { DocumentPreview } from "@/components/document-preview";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Ta facture",
  robots: { index: false, follow: false },
};

/** Page publique de consultation d'une facture, accessible par jeton. */
export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [invoice, settings] = await Promise.all([
    db.invoice.findUnique({
      where: { publicToken: token },
      include: { client: true, items: { orderBy: { position: "asc" } } },
    }),
    getSettings(),
  ]);

  if (!invoice) notFound();

  const remaining = invoice.total - invoice.amountPaid;
  const paid = invoice.status === "paid" || remaining <= 0;
  const overdue = !paid && invoice.dueAt < new Date();

  return (
    <div className="min-h-dvh bg-[var(--bg)]">
      <header className="border-b border-[var(--border)] bg-[var(--bg-subtle)]">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--accent)]">
            {settings.studioName}
          </p>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] mt-2">
            Facture {invoice.number}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {paid ? (
              <Badge tone="success" size="md" dot>
                Payée
              </Badge>
            ) : overdue ? (
              <Badge tone="danger" size="md" dot>
                Échue le {formatDate(invoice.dueAt)}
              </Badge>
            ) : (
              <Badge tone="info" size="md" dot>
                À régler avant le {formatDate(invoice.dueAt)}
              </Badge>
            )}
            <Badge size="md">{formatCHF(invoice.total)}</Badge>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {paid ? (
          <div className="flex items-start gap-3 p-4 rounded-[var(--radius-md)] bg-[var(--success-soft)] border border-[var(--success)]/30">
            <CheckCircle2 className="size-5 text-[var(--success)] shrink-0 mt-0.5" />
            <p className="text-[13px] text-[var(--fg-muted)]">
              <strong className="text-[var(--fg)]">Facture réglée.</strong> Merci !
            </p>
          </div>
        ) : (
          <div
            className={
              "flex items-start gap-3 p-4 rounded-[var(--radius-md)] border " +
              (overdue
                ? "bg-[var(--danger-soft)] border-[var(--danger)]/30"
                : "bg-[var(--info-soft)] border-[var(--info)]/25")
            }
          >
            <AlertTriangle
              className={
                "size-5 shrink-0 mt-0.5 " +
                (overdue ? "text-[var(--danger)]" : "text-[var(--info)]")
              }
            />
            <div>
              <p className="text-sm font-medium">
                Reste à payer : {formatCHF(remaining)}
              </p>
              <p className="text-[13px] text-[var(--fg-muted)] mt-1 leading-relaxed">
                Télécharge le PDF ci-dessous : il contient la QR-facture, que tu peux
                scanner directement depuis ton application bancaire.
              </p>
            </div>
          </div>
        )}

        <DocumentPreview
          kind="invoice"
          settings={settings}
          number={invoice.number}
          client={invoice.client}
          issuedAt={invoice.issuedAt}
          secondDate={invoice.dueAt}
          items={invoice.items}
          subtotal={invoice.subtotal}
          discount={invoice.discount}
          vatRate={invoice.vatRate}
          vatAmount={invoice.vatAmount}
          total={invoice.total}
          amountPaid={invoice.amountPaid}
          qrReference={invoice.qrReference}
          notes={invoice.notes}
          terms={invoice.terms}
        />

        <div className="flex justify-center">
          <a
            href={`/api/factures/${invoice.id}/pdf?token=${token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-sm)] bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium transition-colors hover:bg-[var(--accent-hover)]"
          >
            <Download className="size-4" />
            Télécharger le PDF avec la QR-facture
          </a>
        </div>
      </main>

      <footer className="border-t border-[var(--border)] py-8 mt-8">
        <p className="text-center text-[12px] text-[var(--fg-subtle)]">
          {settings.studioName}
          {settings.email && ` · ${settings.email}`}
          {settings.ide && ` · ${settings.ide}`}
        </p>
      </footer>
    </div>
  );
}
