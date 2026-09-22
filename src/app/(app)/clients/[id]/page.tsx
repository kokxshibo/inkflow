import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ChevronLeft,
  Mail,
  Phone,
  Instagram,
  MapPin,
  Plus,
  Palette,
  CalendarDays,
  FileText,
  ReceiptText,
  HeartPulse,
  ShieldAlert,
  ShieldCheck,
  BadgeCheck,
  CircleAlert,
  Cake,
} from "lucide-react";
import { db } from "@/lib/db";
import { formatCHF } from "@/lib/money";
import {
  formatDate,
  formatDateTime,
  formatRelative,
  fullName,
  initials,
  isMinor,
  age,
  parseJsonArray,
} from "@/lib/utils";
import {
  APPOINTMENT_STATUS,
  APPOINTMENT_TYPE,
  CLIENT_SOURCE,
  CLIENT_STATUS,
  INVOICE_STATUS,
  LANGUAGES,
  MEDICAL_CONDITIONS,
  PROJECT_STATUS,
  QUOTE_STATUS,
  SKIN_TYPES,
  labelOf,
} from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  DataRow,
  EmptyState,
  PageHeader,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/misc";
import { ClientActions } from "./client-actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const client = await db.client.findUnique({ where: { id } });
  return { title: client ? fullName(client) : "Client" };
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const client = await db.client.findUnique({
    where: { id },
    include: {
      projects: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { images: true, appointments: true } } },
      },
      appointments: { orderBy: { startAt: "desc" }, take: 20 },
      quotes: { orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { createdAt: "desc" }, include: { payments: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!client) notFound();

  const minor = isMinor(client.birthDate);
  const years = age(client.birthDate);
  const conditions = parseJsonArray(client.conditions);

  const totalPaid = client.invoices.reduce((sum, i) => sum + i.amountPaid, 0);
  const totalDue = client.invoices
    .filter((i) => !["paid", "cancelled", "draft"].includes(i.status))
    .reduce((sum, i) => sum + (i.total - i.amountPaid), 0);

  const nextAppointment = client.appointments
    .filter((a) => a.startAt > new Date() && a.status !== "cancelled")
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())[0];

  const hasMedicalInfo =
    conditions.length > 0 ||
    Boolean(client.allergies || client.medications || client.medicalNotes) ||
    client.pregnant ||
    client.keloidProne;

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            href="/clients"
            className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Clients
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <Avatar initials={initials(client.firstName, client.lastName)} size="lg" />
            <span className="min-w-0">
              <span className="block truncate">{fullName(client)}</span>
              <span className="flex items-center gap-2 mt-1.5">
                <StatusBadge options={CLIENT_STATUS} value={client.status} size="md" />
                {minor && (
                  <Badge tone="danger" dot size="md">
                    Mineur — {years} ans
                  </Badge>
                )}
                {client.identityVerifiedAt && (
                  <Badge tone="success" size="md">
                    <BadgeCheck className="size-3" />
                    Identité vérifiée
                  </Badge>
                )}
              </span>
            </span>
          </span>
        }
        actions={<ClientActions client={client} />}
      />

      {/* Alertes prioritaires */}
      {(minor || client.noShowCount >= 2 || client.pregnant) && (
        <div className="space-y-2.5 mb-6">
          {minor && (
            <Alert tone="danger" icon={<ShieldAlert />} title={`Client mineur — ${years} ans`}>
              Autorisation parentale écrite et pièce d&apos;identité du représentant légal
              obligatoires avant toute séance.
            </Alert>
          )}
          {client.pregnant && (
            <Alert tone="warning" icon={<CircleAlert />} title="Grossesse ou allaitement déclaré">
              Contre-indication : la séance doit être reportée.
            </Alert>
          )}
          {client.noShowCount >= 2 && (
            <Alert
              tone="warning"
              icon={<CircleAlert />}
              title={`${client.noShowCount} absences non excusées`}
            >
              Exiger un acompte non remboursable avant de bloquer un créneau.
            </Alert>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6 stagger">
        <StatCard label="Total encaissé" value={formatCHF(totalPaid)} tone="success" />
        <StatCard
          label="Reste à payer"
          value={formatCHF(totalDue)}
          tone={totalDue > 0 ? "warning" : "neutral"}
        />
        <StatCard label="Projets" value={client.projects.length} tone="accent" />
        <StatCard
          label="Prochain rendez-vous"
          value={
            nextAppointment ? (
              <span className="text-base">{formatDate(nextAppointment.startAt)}</span>
            ) : (
              <span className="text-base text-[var(--fg-subtle)]">Aucun</span>
            )
          }
          sublabel={nextAppointment ? formatRelative(nextAppointment.startAt) : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr] items-start">
        {/* ─── Colonne fiche ─── */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Coordonnées</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {client.email ? (
                <a
                  href={`mailto:${client.email}`}
                  className="flex items-center gap-2.5 text-[13px] text-[var(--fg-muted)] hover:text-[var(--accent)] transition-colors group"
                >
                  <Mail className="size-4 shrink-0 text-[var(--fg-subtle)] group-hover:text-[var(--accent)] transition-colors" />
                  <span className="truncate">{client.email}</span>
                </a>
              ) : (
                <p className="flex items-center gap-2.5 text-[13px] text-[var(--fg-subtle)]">
                  <Mail className="size-4 shrink-0" />
                  Aucune adresse e-mail
                </p>
              )}

              {client.phone && (
                <a
                  href={`tel:${client.phone}`}
                  className="flex items-center gap-2.5 text-[13px] text-[var(--fg-muted)] hover:text-[var(--accent)] transition-colors group"
                >
                  <Phone className="size-4 shrink-0 text-[var(--fg-subtle)] group-hover:text-[var(--accent)] transition-colors" />
                  {client.phone}
                </a>
              )}

              {client.instagram && (
                <a
                  href={`https://instagram.com/${client.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-[13px] text-[var(--fg-muted)] hover:text-[var(--accent)] transition-colors group"
                >
                  <Instagram className="size-4 shrink-0 text-[var(--fg-subtle)] group-hover:text-[var(--accent)] transition-colors" />
                  @{client.instagram}
                </a>
              )}

              {client.addressLine && (
                <p className="flex items-start gap-2.5 text-[13px] text-[var(--fg-muted)]">
                  <MapPin className="size-4 shrink-0 text-[var(--fg-subtle)] mt-0.5" />
                  <span>
                    {client.addressLine}
                    <br />
                    {client.postalCode} {client.city}
                  </span>
                </p>
              )}

              {client.birthDate && (
                <p className="flex items-center gap-2.5 text-[13px] text-[var(--fg-muted)]">
                  <Cake className="size-4 shrink-0 text-[var(--fg-subtle)]" />
                  {formatDate(client.birthDate)} ({years} ans)
                </p>
              )}

              <Separator className="my-3.5" />

              <dl>
                <DataRow label="Source">
                  {labelOf(CLIENT_SOURCE, client.source)}
                </DataRow>
                <DataRow label="Langue">{labelOf(LANGUAGES, client.language)}</DataRow>
                <DataRow label="Client depuis">{formatDate(client.createdAt)}</DataRow>
                {client.noShowCount > 0 && (
                  <DataRow label="Absences">
                    <span className="text-[var(--danger)] font-medium">
                      {client.noShowCount}
                    </span>
                  </DataRow>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Médical */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HeartPulse className="size-4 text-[var(--fg-subtle)]" />
                Questionnaire médical
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!hasMedicalInfo ? (
                <p className="text-[13px] text-[var(--fg-subtle)] py-2">
                  Aucune information renseignée.{" "}
                  <Link
                    href={`/clients/${client.id}/modifier`}
                    className="text-[var(--accent)] hover:underline"
                  >
                    Compléter
                  </Link>
                </p>
              ) : (
                <div className="space-y-3">
                  {conditions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {conditions.map((condition) => (
                        <Badge key={condition} tone="warning">
                          {labelOf(MEDICAL_CONDITIONS, condition)}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <dl>
                    {client.allergies && (
                      <DataRow label="Allergies">{client.allergies}</DataRow>
                    )}
                    {client.medications && (
                      <DataRow label="Traitements">{client.medications}</DataRow>
                    )}
                    {client.skinType && (
                      <DataRow label="Phototype">
                        {labelOf(SKIN_TYPES, client.skinType)}
                      </DataRow>
                    )}
                    {client.keloidProne && (
                      <DataRow label="Chéloïdes">
                        <span className="text-[var(--warning)]">Terrain à risque</span>
                      </DataRow>
                    )}
                    {client.medicalNotes && (
                      <DataRow label="Remarques">{client.medicalNotes}</DataRow>
                    )}
                    {client.medicalUpdatedAt && (
                      <DataRow label="Mis à jour">
                        {formatDate(client.medicalUpdatedAt)}
                      </DataRow>
                    )}
                  </dl>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Consentements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-[var(--fg-subtle)]" />
                Consentements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <DataRow label="Droit à l'image">
                  {client.imageConsent ? (
                    <Badge tone="success" dot>Accordé</Badge>
                  ) : (
                    <Badge tone="danger" dot>Refusé</Badge>
                  )}
                </DataRow>
                <DataRow label="Communications">
                  {client.marketingConsent ? (
                    <Badge tone="success" dot>Accepté</Badge>
                  ) : (
                    <Badge tone="neutral" dot>Refusé</Badge>
                  )}
                </DataRow>
                <DataRow label="Identité">
                  {client.identityVerifiedAt ? (
                    <span className="text-[var(--success)]">
                      Vérifiée le {formatDate(client.identityVerifiedAt)}
                    </span>
                  ) : (
                    <span className="text-[var(--fg-subtle)]">Non vérifiée</span>
                  )}
                </DataRow>
              </dl>
              {!client.imageConsent && (
                <p className="mt-3 text-[11px] text-[var(--fg-subtle)] leading-relaxed">
                  Sans consentement, aucune photo de ce client ne doit être publiée.
                </p>
              )}
            </CardContent>
          </Card>

          {client.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes privées</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[13px] text-[var(--fg-muted)] whitespace-pre-wrap leading-relaxed">
                  {client.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ─── Onglets ─── */}
        <Tabs defaultValue="projects">
          <TabsList className="overflow-x-auto max-w-full">
            <TabsTrigger value="projects">
              <Palette />
              Projets ({client.projects.length})
            </TabsTrigger>
            <TabsTrigger value="appointments">
              <CalendarDays />
              Rendez-vous ({client.appointments.length})
            </TabsTrigger>
            <TabsTrigger value="quotes">
              <FileText />
              Devis ({client.quotes.length})
            </TabsTrigger>
            <TabsTrigger value="invoices">
              <ReceiptText />
              Factures ({client.invoices.length})
            </TabsTrigger>
          </TabsList>

          {/* Projets */}
          <TabsContent value="projects">
            {client.projects.length === 0 ? (
              <EmptyState
                icon={<Palette />}
                title="Aucun projet"
                description="Crée un projet pour suivre le tatouage, les maquettes et les séances."
                action={
                  <Button asChild variant="primary" size="sm">
                    <Link href={`/projets/nouveau?client=${client.id}`}>
                      <Plus />
                      Nouveau projet
                    </Link>
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2.5 stagger">
                {client.projects.map((project) => (
                  <Link key={project.id} href={`/projets/${project.id}`}>
                    <Card interactive className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{project.title}</p>
                          <p className="text-xs text-[var(--fg-muted)] mt-1">
                            {project.widthCm && project.heightCm
                              ? `${project.widthCm} × ${project.heightCm} cm · `
                              : ""}
                            {project.estimatedSessions} séance
                            {project.estimatedSessions > 1 ? "s" : ""} prévue
                            {project.estimatedSessions > 1 ? "s" : ""}
                            {project._count.appointments > 0 &&
                              ` · ${project._count.appointments} RDV`}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <StatusBadge options={PROJECT_STATUS} value={project.status} />
                          {(project.finalPrice ?? project.estimatedPrice) && (
                            <span className="text-[13px] font-semibold tabular">
                              {formatCHF(project.finalPrice ?? project.estimatedPrice ?? 0)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
                <Button asChild variant="secondary" size="sm" className="w-full">
                  <Link href={`/projets/nouveau?client=${client.id}`}>
                    <Plus />
                    Nouveau projet
                  </Link>
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Rendez-vous */}
          <TabsContent value="appointments">
            {client.appointments.length === 0 ? (
              <EmptyState
                icon={<CalendarDays />}
                title="Aucun rendez-vous"
                description="Planifie une consultation ou une séance."
                action={
                  <Button asChild variant="primary" size="sm">
                    <Link href={`/agenda?nouveau=1&client=${client.id}`}>
                      <Plus />
                      Planifier
                    </Link>
                  </Button>
                }
              />
            ) : (
              <Card>
                <ul className="divide-y divide-[var(--border)]">
                  {client.appointments.map((appointment) => (
                    <li
                      key={appointment.id}
                      className="flex items-center justify-between gap-4 px-5 py-3.5"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium truncate">
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
              </Card>
            )}
          </TabsContent>

          {/* Devis */}
          <TabsContent value="quotes">
            {client.quotes.length === 0 ? (
              <EmptyState
                icon={<FileText />}
                title="Aucun devis"
                action={
                  <Button asChild variant="primary" size="sm">
                    <Link href={`/devis/nouveau?client=${client.id}`}>
                      <Plus />
                      Créer un devis
                    </Link>
                  </Button>
                }
              />
            ) : (
              <Card>
                <ul className="divide-y divide-[var(--border)]">
                  {client.quotes.map((quote) => (
                    <li key={quote.id}>
                      <Link
                        href={`/devis/${quote.id}`}
                        className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-[var(--surface-2)] transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium tabular">{quote.number}</p>
                          <p className="text-[11px] text-[var(--fg-subtle)] mt-0.5">
                            Émis le {formatDate(quote.issuedAt)} · valable jusqu&apos;au{" "}
                            {formatDate(quote.validUntil)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[13px] font-semibold tabular">
                            {formatCHF(quote.total)}
                          </span>
                          <StatusBadge options={QUOTE_STATUS} value={quote.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </TabsContent>

          {/* Factures */}
          <TabsContent value="invoices">
            {client.invoices.length === 0 ? (
              <EmptyState
                icon={<ReceiptText />}
                title="Aucune facture"
                action={
                  <Button asChild variant="primary" size="sm">
                    <Link href={`/factures/nouvelle?client=${client.id}`}>
                      <Plus />
                      Créer une facture
                    </Link>
                  </Button>
                }
              />
            ) : (
              <Card>
                <ul className="divide-y divide-[var(--border)]">
                  {client.invoices.map((invoice) => (
                    <li key={invoice.id}>
                      <Link
                        href={`/factures/${invoice.id}`}
                        className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-[var(--surface-2)] transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium tabular">
                            {invoice.number}
                          </p>
                          <p className="text-[11px] text-[var(--fg-subtle)] mt-0.5">
                            Échéance {formatDate(invoice.dueAt)}
                            {invoice.amountPaid > 0 &&
                              invoice.amountPaid < invoice.total &&
                              ` · ${formatCHF(invoice.amountPaid)} reçus`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[13px] font-semibold tabular">
                            {formatCHF(invoice.total)}
                          </span>
                          <StatusBadge options={INVOICE_STATUS} value={invoice.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function Alert({
  tone,
  icon,
  title,
  children,
}: {
  tone: "danger" | "warning" | "info";
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const styles = {
    danger: "bg-[var(--danger-soft)] border-[var(--danger)]/30 text-[var(--danger)]",
    warning: "bg-[var(--warning-soft)] border-[var(--warning)]/30 text-[var(--warning)]",
    info: "bg-[var(--info-soft)] border-[var(--info)]/30 text-[var(--info)]",
  }[tone];

  return (
    <div
      className={`flex items-start gap-3 p-3.5 rounded-[var(--radius-md)] border ${styles}`}
    >
      <span className="shrink-0 mt-0.5 [&_svg]:size-4.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[var(--fg)]">{title}</p>
        <p className="text-[13px] text-[var(--fg-muted)] mt-0.5 leading-relaxed">
          {children}
        </p>
      </div>
    </div>
  );
}
