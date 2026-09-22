import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { db, getSettings } from "@/lib/db";
import { formatCHF } from "@/lib/money";
import { PageHeader } from "@/components/ui/misc";
import { QuoteFormWrapper } from "../../quote-form-wrapper";

export const metadata: Metadata = { title: "Modifier le devis" };
export const dynamic = "force-dynamic";

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [quote, clients, projects, settings] = await Promise.all([
    db.quote.findUnique({
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

  if (!quote) notFound();
  // Un devis accepté est figé : il fait foi vis-à-vis du client.
  if (quote.status === "accepted") redirect(`/devis/${id}`);

  const depositPercent =
    quote.total > 0 ? Math.round((quote.depositAmount / quote.total) * 100) : settings.depositPercent;

  return (
    <>
      <PageHeader
        title={`Modifier ${quote.number}`}
        breadcrumb={
          <Link
            href={`/devis/${quote.id}`}
            className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            {quote.number}
          </Link>
        }
      />
      <QuoteFormWrapper
        clients={clients}
        projects={projects}
        defaults={{
          id: quote.id,
          clientId: quote.clientId,
          projectId: quote.projectId ?? undefined,
          issuedAt: quote.issuedAt,
          validUntil: quote.validUntil,
          discount: quote.discount,
          depositPercent,
          notes: quote.notes,
          terms: quote.terms,
          lines: quote.items.map((item) => ({
            label: item.label,
            description: item.description ?? "",
            quantity: String(item.quantity),
            unitPrice: formatCHF(item.unitPrice, { showCurrency: false }),
          })),
        }}
        vatEnabled={settings.vatEnabled}
        vatRate={settings.vatRate}
        paymentTermDays={settings.quoteValidityDays}
        defaultDepositPercent={settings.depositPercent}
        cancelHref={`/devis/${quote.id}`}
      />
    </>
  );
}
