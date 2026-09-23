import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Plus, Users } from "lucide-react";
import { db, getSettings } from "@/lib/db";
import { getBillingSuggestions } from "@/lib/billing";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { InvoiceFormWrapper } from "../invoice-form-wrapper";
import { BillingHub } from "./billing-hub";

export const metadata: Metadata = { title: "Nouvelle facture" };
export const dynamic = "force-dynamic";

const backLink = (
  <Link
    href="/factures"
    className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
  >
    <ChevronLeft className="size-3.5" />
    Factures
  </Link>
);

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; projet?: string; facturer?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const [clients, settings] = await Promise.all([
    db.client.findMany({
      where: { status: { not: "archived" } },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    getSettings(),
  ]);

  if (clients.length === 0) {
    return (
      <>
        <PageHeader title="Nouvelle facture" breadcrumb={backLink} />
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
      </>
    );
  }

  /* ── Formulaire détaillé : plusieurs lignes, remise, échéance… ── */
  if (params.mode === "detaille") {
    const projects = await db.project.findMany({
      select: { id: true, title: true, clientId: true },
      orderBy: { updatedAt: "desc" },
    });
    return (
      <>
        <PageHeader
          title="Facture détaillée"
          description="Une fois émise, une facture ne peut plus être modifiée — seulement annulée par une note de crédit."
          breadcrumb={backLink}
        />
        <InvoiceFormWrapper
          clients={clients}
          projects={projects}
          defaults={{ clientId: params.client, projectId: params.projet }}
          vatEnabled={settings.vatEnabled}
          vatRate={settings.vatRate}
          paymentTermDays={settings.paymentTermDays}
          defaultDepositPercent={settings.depositPercent}
          cancelHref="/factures/nouvelle"
        />
      </>
    );
  }

  /* ── Facturation automatique ── */
  const scope = { clientId: params.client, projectId: params.projet };
  const suggestions = await getBillingSuggestions(settings, scope);

  // Suggestion demandée explicitement (bouton « Facturer » de l'agenda, d'un projet…)
  let requested = params.facturer
    ? suggestions.find((suggestion) => suggestion.key === params.facturer)
    : undefined;
  if (params.facturer && !requested) {
    [requested] = await getBillingSuggestions(settings, { key: params.facturer });
    if (requested) suggestions.unshift(requested);
  }

  const project = params.projet
    ? await db.project.findUnique({
        where: { id: params.projet },
        select: { title: true, clientId: true },
      })
    : null;
  const scopedClient = params.client
    ? clients.find((client) => client.id === params.client)
    : undefined;
  const scopeLabel =
    project?.title ??
    (scopedClient ? `${scopedClient.firstName} ${scopedClient.lastName}` : null);

  const detailedHref = `/factures/nouvelle?mode=detaille${params.client ? `&client=${params.client}` : ""}${params.projet ? `&projet=${params.projet}` : ""}`;

  return (
    <BillingHub
      suggestions={suggestions}
      clients={clients.map((client) => ({
        id: client.id,
        name: `${client.firstName} ${client.lastName}`,
      }))}
      scope={scopeLabel ? { label: scopeLabel, clearHref: "/factures/nouvelle" } : null}
      defaultClientId={params.client ?? project?.clientId ?? null}
      requestedKey={params.facturer ?? null}
      requestedMissing={Boolean(params.facturer && !requested)}
      detailedHref={detailedHref}
      vatRate={settings.vatEnabled ? settings.vatRate : 0}
      hourlyRate={settings.hourlyRate}
      minimumPrice={settings.minimumPrice}
      paymentTermDays={settings.paymentTermDays}
    />
  );
}
