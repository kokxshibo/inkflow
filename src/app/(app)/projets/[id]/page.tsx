import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ChevronLeft,
  CalendarDays,
  FileText,
  ReceiptText,
  Plus,
  Ruler,
  MapPin,
  Layers,
  ShieldAlert,
} from "lucide-react";
import { db, getSettings } from "@/lib/db";
import { getBillingSuggestions } from "@/lib/billing";
import { formatCHF } from "@/lib/money";
import { formatDate, formatDateTime, fullName, initials, isMinor } from "@/lib/utils";
import {
  APPOINTMENT_STATUS,
  APPOINTMENT_TYPE,
  ALL_BODY_ZONES,
  COLOR_MODE,
  INVOICE_STATUS,
  PROJECT_KIND,
  PROJECT_STATUS,
  PROJECT_STYLE,
  QUOTE_STATUS,
  labelOf,
} from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, DataRow, PageHeader } from "@/components/ui/misc";
import { ProjectGallery } from "./project-gallery";
import { ProjectActions } from "./project-actions";
import { BillingCard } from "@/components/billing-card";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const project = await db.project.findUnique({ where: { id } });
  return { title: project?.title ?? "Projet" };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await db.project.findUnique({
    where: { id },
    include: {
      client: true,
      images: { orderBy: { createdAt: "desc" } },
      appointments: { orderBy: { startAt: "desc" } },
      quotes: { orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!project) notFound();

  const toBill = await getBillingSuggestions(await getSettings(), { projectId: project.id });

  const minor = isMinor(project.client.birthDate);
  const sessionsDone = project.appointments.filter((a) => a.status === "done").length;
  const totalInvoiced = project.invoices
    .filter((i) => i.status !== "cancelled" && i.status !== "draft")
    .reduce((sum, i) => sum + i.total, 0);
  const totalPaid = project.invoices.reduce((sum, i) => sum + i.amountPaid, 0);

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            href="/projets"
            className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Projets
          </Link>
        }
        title={project.title}
        description={
          <span className="flex flex-wrap items-center gap-2 mt-1.5">
            <StatusBadge options={PROJECT_STATUS} value={project.status} size="md" />
            <Badge size="md">{labelOf(PROJECT_KIND, project.kind)}</Badge>
            {project.style && (
              <Badge size="md">{labelOf(PROJECT_STYLE, project.style)}</Badge>
            )}
          </span>
        }
        actions={<ProjectActions project={project} />}
      />

      {minor && (
        <div className="flex items-start gap-3 p-3.5 mb-6 rounded-[var(--radius-md)] bg-[var(--danger-soft)] border border-[var(--danger)]/30">
          <ShieldAlert className="size-4.5 text-[var(--danger)] shrink-0 mt-0.5" />
          <p className="text-[13px] text-[var(--fg-muted)]">
            <strong className="text-[var(--fg)]">Client mineur.</strong> Autorisation
            parentale écrite obligatoire avant toute séance.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
        {/* ─── Colonne principale ─── */}
        <div className="space-y-6 order-2 lg:order-1">
          <ProjectGallery projectId={project.id} images={project.images} />

          {project.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[13px] text-[var(--fg-muted)] whitespace-pre-wrap leading-relaxed">
                  {project.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Séances */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Séances</CardTitle>
                <p className="text-[13px] text-[var(--fg-muted)] mt-0.5">
                  {sessionsDone} effectuée{sessionsDone > 1 ? "s" : ""} sur{" "}
                  {project.estimatedSessions} prévue{project.estimatedSessions > 1 ? "s" : ""}
                </p>
              </div>
              <Button asChild variant="secondary" size="sm">
                <Link href={`/agenda?nouveau=1&client=${project.clientId}&projet=${project.id}`}>
                  <Plus />
                  Planifier
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {project.appointments.length === 0 ? (
                <p className="text-[13px] text-[var(--fg-subtle)] py-3">
                  Aucune séance planifiée.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {project.appointments.map((appointment) => (
                    <li
                      key={appointment.id}
                      className="flex items-center justify-between gap-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium">
                          {labelOf(APPOINTMENT_TYPE, appointment.type)}
                        </p>
                        <p className="text-[11px] text-[var(--fg-subtle)] tabular mt-0.5">
                          {formatDateTime(appointment.startAt)}
                        </p>
                      </div>
                      <StatusBadge
                        options={APPOINTMENT_STATUS}
                        value={appointment.status}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <BillingCard suggestions={toBill} moreHref={`/factures/nouvelle?projet=${project.id}`} />

          {/* Documents */}
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="size-4 text-[var(--fg-subtle)]" />
                  Devis
                </CardTitle>
                <Button asChild variant="ghost" size="xs">
                  <Link href={`/devis/nouveau?client=${project.clientId}&projet=${project.id}`}>
                    <Plus />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {project.quotes.length === 0 ? (
                  <p className="text-[13px] text-[var(--fg-subtle)] py-2">Aucun devis</p>
                ) : (
                  <ul className="space-y-1.5">
                    {project.quotes.map((quote) => (
                      <li key={quote.id}>
                        <Link
                          href={`/devis/${quote.id}`}
                          className="flex items-center justify-between gap-2 p-2 -mx-2 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-colors"
                        >
                          <span className="text-[12px] tabular">{quote.number}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold tabular">
                              {formatCHF(quote.total)}
                            </span>
                            <StatusBadge options={QUOTE_STATUS} value={quote.status} dot={false} />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ReceiptText className="size-4 text-[var(--fg-subtle)]" />
                  Factures
                </CardTitle>
                <Button asChild variant="ghost" size="xs">
                  <Link
                    href={`/factures/nouvelle?client=${project.clientId}&projet=${project.id}`}
                  >
                    <Plus />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {project.invoices.length === 0 ? (
                  <p className="text-[13px] text-[var(--fg-subtle)] py-2">Aucune facture</p>
                ) : (
                  <ul className="space-y-1.5">
                    {project.invoices.map((invoice) => (
                      <li key={invoice.id}>
                        <Link
                          href={`/factures/${invoice.id}`}
                          className="flex items-center justify-between gap-2 p-2 -mx-2 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-colors"
                        >
                          <span className="text-[12px] tabular">{invoice.number}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold tabular">
                              {formatCHF(invoice.total)}
                            </span>
                            <StatusBadge
                              options={INVOICE_STATUS}
                              value={invoice.status}
                              dot={false}
                            />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ─── Colonne latérale ─── */}
        <div className="space-y-5 order-1 lg:order-2">
          <Card>
            <CardHeader>
              <CardTitle>Client</CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href={`/clients/${project.client.id}`}
                className="flex items-center gap-3 p-2 -mx-2 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-colors group"
              >
                <Avatar
                  initials={initials(project.client.firstName, project.client.lastName)}
                />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium truncate group-hover:text-[var(--accent)] transition-colors">
                    {fullName(project.client)}
                  </p>
                  <p className="text-[11px] text-[var(--fg-subtle)] truncate">
                    {project.client.email ?? project.client.phone ?? "Sans contact"}
                  </p>
                </div>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Caractéristiques</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <DataRow label={<span className="flex items-center gap-1.5"><MapPin className="size-3.5" />Emplacement</span>}>
                  {labelOf(ALL_BODY_ZONES, project.bodyZone)}
                </DataRow>
                <DataRow label={<span className="flex items-center gap-1.5"><Ruler className="size-3.5" />Taille</span>}>
                  {project.widthCm && project.heightCm
                    ? `${project.widthCm} × ${project.heightCm} cm`
                    : "—"}
                </DataRow>
                <DataRow label={<span className="flex items-center gap-1.5"><Layers className="size-3.5" />Rendu</span>}>
                  {labelOf(COLOR_MODE, project.colorMode)}
                </DataRow>
                <DataRow label="Style">{labelOf(PROJECT_STYLE, project.style)}</DataRow>
                <DataRow label={<span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />Séances</span>}>
                  {sessionsDone} / {project.estimatedSessions}
                </DataRow>
                <DataRow label="Créé le">{formatDate(project.createdAt)}</DataRow>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Argent</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <DataRow label="Prix estimé">
                  {project.estimatedPrice ? formatCHF(project.estimatedPrice) : "—"}
                </DataRow>
                <DataRow label="Prix final">
                  {project.finalPrice ? (
                    <span className="font-semibold">{formatCHF(project.finalPrice)}</span>
                  ) : (
                    "—"
                  )}
                </DataRow>
                <DataRow label="Facturé">{formatCHF(totalInvoiced)}</DataRow>
                <DataRow label="Encaissé">
                  <span className="text-[var(--success)] font-medium">
                    {formatCHF(totalPaid)}
                  </span>
                </DataRow>
                {totalInvoiced > totalPaid && (
                  <DataRow label="Reste dû">
                    <span className="text-[var(--warning)] font-medium">
                      {formatCHF(totalInvoiced - totalPaid)}
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
