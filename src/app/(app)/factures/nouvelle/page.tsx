import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Plus, Users } from "lucide-react";
import { db, getSettings } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { InvoiceFormWrapper } from "../invoice-form-wrapper";

export const metadata: Metadata = { title: "Nouvelle facture" };
export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; projet?: string }>;
}) {
  const params = await searchParams;
  const [clients, projects, settings] = await Promise.all([
    db.client.findMany({
      where: { status: { not: "archived" } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
    }),
    db.project.findMany({
      select: { id: true, title: true, clientId: true },
      orderBy: { updatedAt: "desc" },
    }),
    getSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Nouvelle facture"
        description="Une fois émise, une facture ne peut plus être modifiée — seulement annulée par une note de crédit."
        breadcrumb={
          <Link
            href="/factures"
            className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Factures
          </Link>
        }
      />
      {clients.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="Crée d'abord un client"
          description="L'adresse complète du client est obligatoire sur une facture."
          action={
            <Button asChild variant="primary" size="sm">
              <Link href="/clients/nouveau">
                <Plus />
                Nouveau client
              </Link>
            </Button>
          }
        />
      ) : (
        <InvoiceFormWrapper
          clients={clients}
          projects={projects}
          defaults={{ clientId: params.client, projectId: params.projet }}
          vatEnabled={settings.vatEnabled}
          vatRate={settings.vatRate}
          paymentTermDays={settings.paymentTermDays}
          defaultDepositPercent={settings.depositPercent}
          cancelHref="/factures"
        />
      )}
    </>
  );
}
