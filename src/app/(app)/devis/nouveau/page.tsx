import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Plus, Users } from "lucide-react";
import { db, getSettings } from "@/lib/db";
import { getQuoteProposals } from "@/lib/billing";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { QuoteFormWrapper } from "../quote-form-wrapper";
import { QuickQuote } from "./quick-quote";

export const metadata: Metadata = { title: "Nouveau devis" };
export const dynamic = "force-dynamic";

const backLink = (
  <Link
    href="/devis"
    className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
  >
    <ChevronLeft className="size-3.5" />
    Devis
  </Link>
);

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; projet?: string; mode?: string }>;
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
        <PageHeader title="Nouveau devis" breadcrumb={backLink} />
        <EmptyState
          icon={<Users />}
          title="Crée d'abord un client"
          description="Un devis est toujours adressé à un client identifié."
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

  /* ── Formulaire détaillé : plusieurs lignes, remise… ── */
  if (params.mode === "detaille") {
    const projects = await db.project.findMany({
      select: { id: true, title: true, clientId: true },
      orderBy: { updatedAt: "desc" },
    });
    return (
      <>
        <PageHeader
          title="Devis détaillé"
          description="Le numéro est attribué automatiquement à l'enregistrement."
          breadcrumb={backLink}
        />
        <QuoteFormWrapper
          clients={clients}
          projects={projects}
          defaults={{ clientId: params.client, projectId: params.projet }}
          vatEnabled={settings.vatEnabled}
          vatRate={settings.vatRate}
          paymentTermDays={settings.quoteValidityDays}
          defaultDepositPercent={settings.depositPercent}
          cancelHref="/devis/nouveau"
        />
      </>
    );
  }

  /* ── Devis express, prérempli depuis le projet ── */
  const proposals = await getQuoteProposals({ clientId: params.client });
  // Le projet demandé peut être à un stade où il n'est plus proposé d'office
  // (acompte payé, en cours…) : on l'ajoute pour qu'il reste sélectionné.
  if (params.projet && !proposals.some((proposal) => proposal.projectId === params.projet)) {
    proposals.unshift(...(await getQuoteProposals({ projectId: params.projet })));
  }

  const detailedHref = `/devis/nouveau?mode=detaille${params.client ? `&client=${params.client}` : ""}${params.projet ? `&projet=${params.projet}` : ""}`;

  return (
    <QuickQuote
      proposals={proposals}
      clients={clients.map((client) => ({
        id: client.id,
        name: `${client.firstName} ${client.lastName}`,
        email: client.email,
      }))}
      initialProjectId={
        proposals.some((proposal) => proposal.projectId === params.projet)
          ? (params.projet ?? null)
          : null
      }
      defaultClientId={params.client ?? null}
      detailedHref={detailedHref}
      settings={{
        hourlyRate: settings.hourlyRate,
        minimumPrice: settings.minimumPrice,
        depositPercent: settings.depositPercent,
        validityDays: settings.quoteValidityDays,
        vatRate: settings.vatEnabled ? settings.vatRate : 0,
      }}
    />
  );
}
