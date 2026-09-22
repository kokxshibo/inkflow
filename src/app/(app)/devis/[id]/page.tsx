import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft, Clock, CheckCircle2, Send, Link2 } from "lucide-react";
import { db, getSettings } from "@/lib/db";
import { formatCHF } from "@/lib/money";
import { formatDate, formatDateTime, fullName, initials } from "@/lib/utils";
import { QUOTE_STATUS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar, DataRow, PageHeader } from "@/components/ui/misc";
import { DocumentPreview } from "@/components/document-preview";
import { QuoteActions } from "./quote-actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const quote = await db.quote.findUnique({ where: { id } });
  return { title: quote?.number ?? "Devis" };
}

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [quote, settings] = await Promise.all([
    db.quote.findUnique({
      where: { id },
      include: {
        client: true,
        project: true,
        items: { orderBy: { position: "asc" } },
        invoices: true,
      },
    }),
    getSettings(),
  ]);

  if (!quote) notFound();

  const expired = quote.status === "sent" && quote.validUntil < new Date();
  const publicUrl = `${process.env.APP_URL ?? ""}/devis-public/${quote.publicToken}`;

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            href="/devis"
            className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Devis
          </Link>
        }
        title={
          <span className="flex items-center gap-3 flex-wrap">
            <span className="tabular">{quote.number}</span>
            <StatusBadge
              options={QUOTE_STATUS}
              value={expired ? "expired" : quote.status}
              size="md"
            />
          </span>
        }
        description={`${formatCHF(quote.total)} · ${fullName(quote.client)}`}
        actions={<QuoteActions quote={quote} publicUrl={publicUrl} />}
      />

      {/* Fil d'avancement */}
      <Card className="mb-6">
        <CardContent className="pt-5">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
            <Step
              done
              label="Créé"
              detail={formatDate(quote.issuedAt)}
              icon={<CheckCircle2 />}
            />
            <Arrow />
            <Step
              done={Boolean(quote.sentAt)}
              label="Envoyé"
              detail={quote.sentAt ? formatDate(quote.sentAt) : "En attente"}
              icon={<Send />}
            />
            <Arrow />
            <Step
              done={quote.status === "accepted"}
              failed={quote.status === "refused"}
              label={quote.status === "refused" ? "Refusé" : "Accepté"}
              detail={
                quote.acceptedAt
                  ? formatDateTime(quote.acceptedAt)
                  : expired
                    ? `Expiré le ${formatDate(quote.validUntil)}`
                    : `Valable jusqu'au ${formatDate(quote.validUntil)}`
              }
              icon={<CheckCircle2 />}
            />
            <Arrow />
            <Step
              done={quote.invoices.length > 0}
              label="Facturé"
              detail={
                quote.invoices.length > 0
                  ? quote.invoices.map((i) => i.number).join(", ")
                  : "Pas encore"
              }
              icon={<Clock />}
            />
          </ol>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px] items-start">
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

        <div className="space-y-5 order-first xl:order-last">
          <Card>
            <CardHeader>
              <CardTitle>Client</CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href={`/clients/${quote.client.id}`}
                className="flex items-center gap-3 p-2 -mx-2 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-colors group"
              >
                <Avatar
                  initials={initials(quote.client.firstName, quote.client.lastName)}
                />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium truncate group-hover:text-[var(--accent)] transition-colors">
                    {fullName(quote.client)}
                  </p>
                  <p className="text-[11px] text-[var(--fg-subtle)] truncate">
                    {quote.client.email ?? "Sans e-mail"}
                  </p>
                </div>
              </Link>
              {!quote.client.email && (
                <p className="text-[11px] text-[var(--warning)] mt-2">
                  Sans adresse e-mail, le devis ne peut pas être envoyé depuis
                  l&apos;application.
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
                <DataRow label="Numéro">
                  <span className="tabular">{quote.number}</span>
                </DataRow>
                <DataRow label="Émis le">{formatDate(quote.issuedAt)}</DataRow>
                <DataRow label="Valable jusqu'au">
                  <span className={expired ? "text-[var(--warning)]" : undefined}>
                    {formatDate(quote.validUntil)}
                  </span>
                </DataRow>
                {quote.project && (
                  <DataRow label="Projet">
                    <Link
                      href={`/projets/${quote.project.id}`}
                      className="text-[var(--accent)] hover:underline"
                    >
                      {quote.project.title}
                    </Link>
                  </DataRow>
                )}
                <DataRow label="Total">
                  <span className="font-semibold">{formatCHF(quote.total)}</span>
                </DataRow>
                <DataRow label="Acompte">
                  <span className="text-[var(--accent)] font-medium">
                    {formatCHF(quote.depositAmount)}
                  </span>
                </DataRow>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="size-4 text-[var(--fg-subtle)]" />
                Lien client
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] text-[var(--fg-muted)] leading-relaxed mb-2.5">
                Page de consultation et d&apos;acceptation en ligne, sans compte
                nécessaire.
              </p>
              <code className="block p-2 rounded-[var(--radius-xs)] bg-[var(--bg-subtle)] border border-[var(--border)] text-[10px] text-[var(--fg-subtle)] break-all">
                /devis-public/{quote.publicToken}
              </code>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Step({
  done,
  failed,
  label,
  detail,
  icon,
}: {
  done?: boolean;
  failed?: boolean;
  label: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2.5 min-w-0">
      <span
        className={
          "grid place-items-center size-8 rounded-full shrink-0 [&_svg]:size-4 " +
          (failed
            ? "bg-[var(--danger-soft)] text-[var(--danger)]"
            : done
              ? "bg-[var(--success-soft)] text-[var(--success)]"
              : "bg-[var(--surface-2)] text-[var(--fg-subtle)]")
        }
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-medium">{label}</span>
        <span className="block text-[11px] text-[var(--fg-subtle)] truncate">
          {detail}
        </span>
      </span>
    </li>
  );
}

function Arrow() {
  return (
    <li aria-hidden className="hidden sm:block flex-1 h-px bg-[var(--border)] min-w-4" />
  );
}
