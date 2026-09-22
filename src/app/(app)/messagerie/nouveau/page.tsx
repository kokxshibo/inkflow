import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db, getSettings } from "@/lib/db";
import { isSmtpConfigured, buildSignature } from "@/lib/mail";
import { PageHeader } from "@/components/ui/misc";
import { ComposeForm } from "./compose-form";

export const metadata: Metadata = { title: "Écrire un message" };
export const dynamic = "force-dynamic";

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{
    client?: string;
    devis?: string;
    facture?: string;
    modele?: string;
  }>;
}) {
  const params = await searchParams;

  const [clients, templates, settings, quote, invoice] = await Promise.all([
    db.client.findMany({
      where: { email: { not: null }, status: { not: "archived" } },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: { lastName: "asc" },
    }),
    db.emailTemplate.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
    getSettings(),
    params.devis
      ? db.quote.findUnique({ where: { id: params.devis } })
      : null,
    params.facture
      ? db.invoice.findUnique({ where: { id: params.facture } })
      : null,
  ]);

  return (
    <>
      <PageHeader
        title="Écrire un message"
        description="Choisis un modèle, relis, puis envoie. Rien ne part sans ta validation."
        breadcrumb={
          <Link
            href="/messagerie"
            className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Messagerie
          </Link>
        }
      />
      <ComposeForm
        clients={clients}
        templates={templates.map((template) => ({
          id: template.id,
          key: template.key,
          name: template.name,
          category: template.category,
          subject: template.subject,
          body: template.body,
        }))}
        defaultClientId={params.client}
        quoteId={params.devis}
        invoiceId={params.facture}
        quoteNumber={quote?.number}
        invoiceNumber={invoice?.number}
        defaultTemplateKey={
          params.modele ?? (params.devis ? "quote_send" : params.facture ? "invoice_send" : undefined)
        }
        smtpConfigured={isSmtpConfigured()}
        signature={buildSignature(settings)}
      />
    </>
  );
}
