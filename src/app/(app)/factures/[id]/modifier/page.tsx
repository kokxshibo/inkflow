import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { db, getSettings } from "@/lib/db";
import { formatCHF } from "@/lib/money";
import { PageHeader } from "@/components/ui/misc";
import { InvoiceFormWrapper } from "../../invoice-form-wrapper";

export const metadata: Metadata = { title: "Modifier la facture" };
export const dynamic = "force-dynamic";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [invoice, clients, projects, settings] = await Promise.all([
    db.invoice.findUnique({
      where: { id },
      include: { items: { orderBy: { position: "asc" } } },
    }),
    db.client.findMany({
      select: { id: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
    }),
    db.project.findMany({
      select: { id: true, title: true, clientId: true },
      orderBy: { updatedAt: "desc" },
    }),
    getSettings(),
  ]);

  if (!invoice) notFound();
  // Seul un brouillon est modifiable : une facture émise est figée.
  if (invoice.status !== "draft") redirect(`/factures/${id}`);

  return (
    <>
      <PageHeader
        title={`Modifier ${invoice.number}`}
        breadcrumb={
          <Link
            href={`/factures/${invoice.id}`}
            className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            {invoice.number}
          </Link>
        }
      />
      <InvoiceFormWrapper
        clients={clients}
        projects={projects}
        defaults={{
          id: invoice.id,
          clientId: invoice.clientId,
          projectId: invoice.projectId ?? undefined,
          issuedAt: invoice.issuedAt,
          dueAt: invoice.dueAt,
          kind: invoice.kind,
          discount: invoice.discount,
          notes: invoice.notes,
          terms: invoice.terms,
          lines: invoice.items.map((item) => ({
            label: item.label,
            description: item.description ?? "",
            quantity: String(item.quantity),
            unitPrice: formatCHF(item.unitPrice, { showCurrency: false }),
          })),
        }}
        vatEnabled={settings.vatEnabled}
        vatRate={settings.vatRate}
        paymentTermDays={settings.paymentTermDays}
        defaultDepositPercent={settings.depositPercent}
        cancelHref={`/factures/${invoice.id}`}
      />
    </>
  );
}
