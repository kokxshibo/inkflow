import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ChevronLeft,
  Paperclip,
  ScanLine,
  Repeat,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { db, getSettings } from "@/lib/db";
import { formatCHF, formatIban, formatQrReference } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import {
  EXPENSE_CATEGORY,
  EXPENSE_PAYMENT_METHOD,
  EXPENSE_STATUS,
  labelOf,
} from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { DataRow, PageHeader } from "@/components/ui/misc";
import { ScanDigest } from "@/components/scan-digest";
import type { ScanExtraction } from "@/lib/scan";
import { ExpenseActions } from "./expense-actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const expense = await db.expense.findUnique({ where: { id } });
  return { title: expense ? `Dépense — ${expense.supplier}` : "Dépense" };
}

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [expense, settings] = await Promise.all([
    db.expense.findUnique({ where: { id } }),
    getSettings(),
  ]);

  if (!expense) notFound();

  const now = new Date();
  const isOverdue =
    expense.status === "to_pay" && expense.dueAt !== null && expense.dueAt < now;
  const isImage = expense.attachmentType?.startsWith("image/");
  // Version numérisée par l'IA, si la dépense vient du scanner.
  const scan: ScanExtraction | null = (() => {
    if (!expense.scanData) return null;
    try {
      return JSON.parse(expense.scanData) as ScanExtraction;
    } catch {
      return null;
    }
  })();

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        breadcrumb={
          <Link
            href="/depenses"
            className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Dépenses
          </Link>
        }
        title={
          <span className="flex items-center gap-3 flex-wrap">
            <span>{expense.supplier}</span>
            <StatusBadge
              options={EXPENSE_STATUS}
              value={isOverdue ? "overdue" : expense.status}
              size="md"
            />
            {expense.scannedFromQr && (
              <Badge tone="info" size="md">
                <ScanLine className="size-3" />
                Scannée
              </Badge>
            )}
          </span>
        }
        description={`${formatCHF(expense.amountGross)} · ${labelOf(EXPENSE_CATEGORY, expense.category)}`}
        actions={<ExpenseActions expense={expense} />}
      />

      {isOverdue && (
        <div className="flex items-start gap-3 p-3.5 mb-6 rounded-[var(--radius-md)] bg-[var(--danger-soft)] border border-[var(--danger)]/30">
          <AlertTriangle className="size-4.5 text-[var(--danger)] shrink-0 mt-0.5" />
          <p className="text-[13px] text-[var(--fg-muted)]">
            <strong className="text-[var(--fg)]">Échéance dépassée</strong> depuis le{" "}
            {formatDate(expense.dueAt!)}. Pense à régler pour éviter les frais de rappel.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
        <div className="space-y-5 order-2 lg:order-1">
          {/* Justificatif */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="size-4 text-[var(--fg-subtle)]" />
                Justificatif
              </CardTitle>
              {expense.attachmentUrl && (
                <a
                  href={expense.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] text-[var(--accent)] hover:underline"
                >
                  <ExternalLink className="size-3.5" />
                  Ouvrir
                </a>
              )}
            </CardHeader>
            <CardContent>
              {!expense.attachmentUrl ? (
                <p className="text-[13px] text-[var(--fg-subtle)] py-2">
                  Aucun justificatif joint.{" "}
                  <Link
                    href={`/depenses/${expense.id}/modifier`}
                    className="text-[var(--accent)] hover:underline"
                  >
                    En ajouter un
                  </Link>{" "}
                  — la pièce doit être conservée 10 ans.
                </p>
              ) : isImage ? (
                <a
                  href={expense.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-[var(--radius-md)] overflow-hidden border border-[var(--border)] bg-[var(--surface-2)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={expense.attachmentUrl}
                    alt={expense.attachmentName ?? "Justificatif"}
                    className="w-full max-h-[480px] object-contain"
                  />
                </a>
              ) : (
                <a
                  href={expense.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-subtle)] hover:border-[var(--border-strong)] transition-colors"
                >
                  <span className="grid place-items-center size-11 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--border)] text-[10px] font-semibold text-[var(--fg-subtle)]">
                    PDF
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium truncate">
                      {expense.attachmentName ?? "Justificatif"}
                    </span>
                    <span className="block text-[11px] text-[var(--fg-subtle)]">
                      Ouvrir dans un nouvel onglet
                    </span>
                  </span>
                </a>
              )}
            </CardContent>
          </Card>

          {scan && (
            <Card>
              <CardHeader>
                <CardTitle>Version numérisée</CardTitle>
                <span className="text-[11px] text-[var(--fg-subtle)]">
                  Lue le {formatDate(scan.analyzedAt)}
                </span>
              </CardHeader>
              <CardContent>
                <ScanDigest extraction={scan} />
              </CardContent>
            </Card>
          )}

          {expense.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[13px] text-[var(--fg-muted)] whitespace-pre-wrap leading-relaxed">
                  {expense.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5 order-1 lg:order-2">
          <Card>
            <CardHeader>
              <CardTitle>Montant</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <DataRow label="Hors taxe">{formatCHF(expense.amountNet)}</DataRow>
                <DataRow
                  label={expense.vatRate > 0 ? `TVA ${expense.vatRate} %` : "TVA"}
                >
                  {formatCHF(expense.vatAmount)}
                </DataRow>
                <DataRow label="Total payé">
                  <span className="text-[15px] font-semibold">
                    {formatCHF(expense.amountGross)}
                  </span>
                </DataRow>
                {settings.vatEnabled && (
                  <DataRow label="Impôt préalable">
                    {expense.vatDeductible ? (
                      <span className="text-[var(--success)]">
                        Récupérable — {formatCHF(expense.vatAmount)}
                      </span>
                    ) : (
                      <span className="text-[var(--fg-subtle)]">Non récupérable</span>
                    )}
                  </DataRow>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Détails</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <DataRow label="Catégorie">
                  {labelOf(EXPENSE_CATEGORY, expense.category)}
                </DataRow>
                {expense.invoiceNumber && (
                  <DataRow label="N° de facture">
                    <span className="tabular">{expense.invoiceNumber}</span>
                  </DataRow>
                )}
                <DataRow label="Date">{formatDate(expense.issuedAt)}</DataRow>
                {expense.dueAt && (
                  <DataRow label="Échéance">
                    <span className={isOverdue ? "text-[var(--danger)]" : undefined}>
                      {formatDate(expense.dueAt)}
                    </span>
                  </DataRow>
                )}
                {expense.paidAt && (
                  <DataRow label="Payée le">{formatDate(expense.paidAt)}</DataRow>
                )}
                {expense.paymentMethod && (
                  <DataRow label="Moyen de paiement">
                    {labelOf(EXPENSE_PAYMENT_METHOD, expense.paymentMethod)}
                  </DataRow>
                )}
                {expense.recurrenceMonths && (
                  <DataRow label="Récurrence">
                    <span className="inline-flex items-center gap-1.5">
                      <Repeat className="size-3" />
                      {expense.recurrenceMonths === 1
                        ? "Mensuelle"
                        : expense.recurrenceMonths === 3
                          ? "Trimestrielle"
                          : expense.recurrenceMonths === 6
                            ? "Semestrielle"
                            : "Annuelle"}
                    </span>
                  </DataRow>
                )}
              </dl>
            </CardContent>
          </Card>

          {expense.creditorIban && (
            <Card>
              <CardHeader>
                <CardTitle>Coordonnées de paiement</CardTitle>
              </CardHeader>
              <CardContent>
                <dl>
                  <DataRow label="IBAN">
                    <span className="tabular text-[11px]">
                      {formatIban(expense.creditorIban)}
                    </span>
                  </DataRow>
                  {expense.creditorName && (
                    <DataRow label="Créancier">{expense.creditorName}</DataRow>
                  )}
                  {expense.qrReference && (
                    <DataRow label="Référence">
                      <span className="tabular text-[11px]">
                        {formatQrReference(expense.qrReference)}
                      </span>
                    </DataRow>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
