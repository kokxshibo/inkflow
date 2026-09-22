import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft, AlertTriangle, Lock, QrCode } from "lucide-react";
import { db, getSettings } from "@/lib/db";
import { formatCHF, formatIban, formatQrReference } from "@/lib/money";
import { formatDate, fullName, initials } from "@/lib/utils";
import { INVOICE_KIND, INVOICE_STATUS, labelOf } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Avatar, DataRow, PageHeader, Progress } from "@/components/ui/misc";
import { DocumentPreview } from "@/components/document-preview";
import { InvoiceActions } from "./invoice-actions";
import { PaymentPanel } from "./payment-panel";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const invoice = await db.invoice.findUnique({ where: { id } });
  return { title: invoice?.number ?? "Facture" };
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [invoice, settings] = await Promise.all([
    db.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        project: true,
        quote: true,
        items: { orderBy: { position: "asc" } },
        payments: { orderBy: { paidAt: "desc" } },
      },
    }),
    getSettings(),
  ]);

  if (!invoice) notFound();

  const now = new Date();
  const isOverdue = ["sent", "partial"].includes(invoice.status) && invoice.dueAt < now;
  const remaining = invoice.total - invoice.amountPaid;
  const paidPercent = invoice.total !== 0 ? (invoice.amountPaid / invoice.total) * 100 : 0;
  const locked = invoice.status !== "draft";
  const iban = settings.qrIban || settings.iban;

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            href="/factures"
            className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Factures
          </Link>
        }
        title={
          <span className="flex items-center gap-3 flex-wrap">
            <span className="tabular">{invoice.number}</span>
            <StatusBadge
              options={INVOICE_STATUS}
              value={isOverdue ? "overdue" : invoice.status}
              size="md"
            />
            {invoice.kind !== "full" && (
              <Badge
                tone={invoice.kind === "credit_note" ? "danger" : "info"}
                size="md"
              >
                {labelOf(INVOICE_KIND, invoice.kind)}
              </Badge>
            )}
          </span>
        }
        description={`${formatCHF(invoice.total)} · ${fullName(invoice.client)}`}
        actions={<InvoiceActions invoice={invoice} />}
      />

      {/* Alertes */}
      <div className="space-y-2.5 mb-6">
        {isOverdue && (
          <div className="flex items-start gap-3 p-3.5 rounded-[var(--radius-md)] bg-[var(--danger-soft)] border border-[var(--danger)]/30">
            <AlertTriangle className="size-4.5 text-[var(--danger)] shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-medium text-[var(--fg)]">
                Paiement en retard
              </p>
              <p className="text-[13px] text-[var(--fg-muted)] mt-0.5">
                Échéance dépassée depuis le {formatDate(invoice.dueAt)}. Reste dû :{" "}
                {formatCHF(remaining)}.
              </p>
            </div>
          </div>
        )}

        {locked && invoice.status !== "cancelled" && (
          <div className="flex items-start gap-3 p-3.5 rounded-[var(--radius-md)] bg-[var(--info-soft)] border border-[var(--info)]/25">
            <Lock className="size-4.5 text-[var(--info)] shrink-0 mt-0.5" />
            <p className="text-[13px] text-[var(--fg-muted)]">
              <strong className="text-[var(--fg)]">Facture émise, donc figée.</strong>{" "}
              Pour la corriger, établis une note de crédit puis une nouvelle facture. Elle
              doit être conservée 10 ans (art. 958f CO).
            </p>
          </div>
        )}

        {!iban && (
          <div className="flex items-start gap-3 p-3.5 rounded-[var(--radius-md)] bg-[var(--warning-soft)] border border-[var(--warning)]/30">
            <QrCode className="size-4.5 text-[var(--warning)] shrink-0 mt-0.5" />
            <p className="text-[13px] text-[var(--fg-muted)]">
              <strong className="text-[var(--fg)]">Aucun IBAN configuré.</strong> La
              QR-facture ne peut pas être générée.{" "}
              <Link href="/reglages" className="text-[var(--accent)] hover:underline">
                Renseigner l&apos;IBAN
              </Link>
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px] items-start">
        <div className="space-y-6 order-2 xl:order-1">
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
        </div>

        <div className="space-y-5 order-1 xl:order-2">
          {/* Encaissement */}
          <Card>
            <CardHeader>
              <CardTitle>Encaissement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] text-[var(--fg-muted)]">Reçu</span>
                <span className="text-lg font-semibold tabular text-[var(--success)]">
                  {formatCHF(invoice.amountPaid)}
                </span>
              </div>
              <Progress
                value={Math.max(0, paidPercent)}
                tone={paidPercent >= 100 ? "success" : isOverdue ? "danger" : "accent"}
              />
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] text-[var(--fg-muted)]">Reste à payer</span>
                <span
                  className={
                    "text-[13px] font-semibold tabular " +
                    (remaining <= 0 ? "text-[var(--success)]" : "text-[var(--warning)]")
                  }
                >
                  {formatCHF(remaining)}
                </span>
              </div>
            </CardContent>
          </Card>

          <PaymentPanel
            invoiceId={invoice.id}
            remaining={remaining}
            payments={invoice.payments.map((payment) => ({
              id: payment.id,
              amount: payment.amount,
              method: payment.method,
              paidAt: payment.paidAt.toISOString(),
              reference: payment.reference,
              note: payment.note,
            }))}
          />

          <Card>
            <CardHeader>
              <CardTitle>Client</CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href={`/clients/${invoice.client.id}`}
                className="flex items-center gap-3 p-2 -mx-2 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-colors group"
              >
                <Avatar
                  initials={initials(invoice.client.firstName, invoice.client.lastName)}
                />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium truncate group-hover:text-[var(--accent)] transition-colors">
                    {fullName(invoice.client)}
                  </p>
                  <p className="text-[11px] text-[var(--fg-subtle)] truncate">
                    {invoice.client.email ?? "Sans e-mail"}
                  </p>
                </div>
              </Link>
              {!invoice.client.addressLine && (
                <p className="text-[11px] text-[var(--warning)] mt-2 leading-relaxed">
                  Adresse manquante : elle est obligatoire sur une facture et pour la
                  QR-facture.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Détails</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <DataRow label="Émise le">{formatDate(invoice.issuedAt)}</DataRow>
                <DataRow label="Échéance">
                  <span className={isOverdue ? "text-[var(--danger)]" : undefined}>
                    {formatDate(invoice.dueAt)}
                  </span>
                </DataRow>
                {invoice.quote && (
                  <DataRow label="Devis d'origine">
                    <Link
                      href={`/devis/${invoice.quote.id}`}
                      className="text-[var(--accent)] hover:underline tabular"
                    >
                      {invoice.quote.number}
                    </Link>
                  </DataRow>
                )}
                {invoice.project && (
                  <DataRow label="Projet">
                    <Link
                      href={`/projets/${invoice.project.id}`}
                      className="text-[var(--accent)] hover:underline"
                    >
                      {invoice.project.title}
                    </Link>
                  </DataRow>
                )}
                {iban && (
                  <DataRow label="IBAN">
                    <span className="tabular text-[11px]">{formatIban(iban)}</span>
                  </DataRow>
                )}
                {invoice.qrReference && (
                  <DataRow label="Référence QR">
                    <span className="tabular text-[11px]">
                      {formatQrReference(invoice.qrReference)}
                    </span>
                  </DataRow>
                )}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
