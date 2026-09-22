import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ChevronLeft,
  Mail,
  Phone,
  Instagram,
  ShieldAlert,
  HeartPulse,
  Images,
} from "lucide-react";
import { db } from "@/lib/db";
import { formatDate, formatRelative, initials, isMinor, age, parseJsonArray } from "@/lib/utils";
import {
  BODY_ZONES,
  COLOR_MODE,
  PROJECT_STYLE,
  REQUEST_STATUS,
  labelOf,
} from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar, DataRow, PageHeader } from "@/components/ui/misc";
import { RequestActions } from "./request-actions";

export const metadata: Metadata = { title: "Demande" };
export const dynamic = "force-dynamic";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = await db.projectRequest.findUnique({
    where: { id },
    include: { client: true },
  });

  if (!request) notFound();

  const references = parseJsonArray(request.referenceUrls);
  const minor = !request.isAdult || isMinor(request.birthDate);
  const years = age(request.birthDate);

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            href="/demandes"
            className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Demandes
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <Avatar initials={initials(request.firstName, request.lastName)} size="lg" />
            <span className="min-w-0">
              <span className="block truncate">
                {request.firstName} {request.lastName}
              </span>
              <span className="flex items-center gap-2 mt-1.5">
                <StatusBadge options={REQUEST_STATUS} value={request.status} size="md" />
                <span className="text-[12px] text-[var(--fg-subtle)] font-normal">
                  reçue {formatRelative(request.createdAt)}
                </span>
              </span>
            </span>
          </span>
        }
        actions={<RequestActions request={request} />}
      />

      {minor && (
        <div className="flex items-start gap-3 p-3.5 mb-6 rounded-[var(--radius-md)] bg-[var(--danger-soft)] border border-[var(--danger)]/30">
          <ShieldAlert className="size-4.5 text-[var(--danger)] shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-medium text-[var(--fg)]">
              {request.isAdult
                ? `Client possiblement mineur${years !== null ? ` — ${years} ans` : ""}`
                : "La personne a déclaré ne pas être majeure"}
            </p>
            <p className="text-[13px] text-[var(--fg-muted)] mt-0.5 leading-relaxed">
              Vérifie l&apos;âge avant toute suite. Une autorisation parentale écrite et
              la pièce d&apos;identité du représentant légal sont nécessaires.
            </p>
          </div>
        </div>
      )}

      {request.hasContraindications && (
        <div className="flex items-start gap-3 p-3.5 mb-6 rounded-[var(--radius-md)] bg-[var(--warning-soft)] border border-[var(--warning)]/30">
          <HeartPulse className="size-4.5 text-[var(--warning)] shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-medium text-[var(--fg)]">
              Contre-indication signalée
            </p>
            <p className="text-[13px] text-[var(--fg-muted)] mt-0.5 leading-relaxed">
              {request.contraindications || "Aucun détail fourni — à clarifier."}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px] items-start">
        <div className="space-y-5 order-2 lg:order-1">
          <Card>
            <CardHeader>
              <CardTitle>Le projet souhaité</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[13px] text-[var(--fg)] whitespace-pre-wrap leading-relaxed">
                {request.description}
              </p>
            </CardContent>
          </Card>

          {references.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Images className="size-4 text-[var(--fg-subtle)]" />
                  Références envoyées ({references.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {references.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square rounded-[var(--radius-md)] overflow-hidden border border-[var(--border)] bg-[var(--surface-2)] group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </a>
                  ))}
                </div>
                <p className="text-[11px] text-[var(--fg-subtle)] mt-3">
                  Ces images suivront automatiquement le projet à la conversion.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5 order-1 lg:order-2">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <a
                href={`mailto:${request.email}`}
                className="flex items-center gap-2.5 text-[13px] text-[var(--fg-muted)] hover:text-[var(--accent)] transition-colors"
              >
                <Mail className="size-4 shrink-0 text-[var(--fg-subtle)]" />
                <span className="truncate">{request.email}</span>
              </a>
              {request.phone && (
                <a
                  href={`tel:${request.phone}`}
                  className="flex items-center gap-2.5 text-[13px] text-[var(--fg-muted)] hover:text-[var(--accent)] transition-colors"
                >
                  <Phone className="size-4 shrink-0 text-[var(--fg-subtle)]" />
                  {request.phone}
                </a>
              )}
              {request.instagram && (
                <a
                  href={`https://instagram.com/${request.instagram.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-[13px] text-[var(--fg-muted)] hover:text-[var(--accent)] transition-colors"
                >
                  <Instagram className="size-4 shrink-0 text-[var(--fg-subtle)]" />@
                  {request.instagram.replace(/^@/, "")}
                </a>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Caractéristiques</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <DataRow label="Emplacement">
                  {labelOf(BODY_ZONES, request.bodyZone)}
                </DataRow>
                <DataRow label="Taille">{request.sizeCm ?? "—"}</DataRow>
                <DataRow label="Rendu">{labelOf(COLOR_MODE, request.colorMode)}</DataRow>
                <DataRow label="Style">{labelOf(PROJECT_STYLE, request.style)}</DataRow>
                <DataRow label="Budget">{request.budget ?? "Non précisé"}</DataRow>
                <DataRow label="Disponibilités">
                  {request.availability ?? "Non précisées"}
                </DataRow>
                {request.birthDate && (
                  <DataRow label="Naissance">
                    {formatDate(request.birthDate)}
                    {years !== null && ` (${years} ans)`}
                  </DataRow>
                )}
                <DataRow label="Majeur">
                  {request.isAdult ? (
                    <span className="text-[var(--success)]">Déclaré majeur</span>
                  ) : (
                    <span className="text-[var(--danger)]">Non déclaré majeur</span>
                  )}
                </DataRow>
                <DataRow label="Reçue le">{formatDate(request.createdAt)}</DataRow>
              </dl>
            </CardContent>
          </Card>

          {request.client && (
            <Card>
              <CardHeader>
                <CardTitle>Client lié</CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/clients/${request.client.id}`}
                  className="text-[13px] text-[var(--accent)] hover:underline"
                >
                  {request.client.firstName} {request.client.lastName}
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
