import Link from "next/link";
import type { Metadata } from "next";
import { Sparkles, Instagram, Copy, ExternalLink, ShieldAlert } from "lucide-react";
import { db } from "@/lib/db";
import { formatRelative, initials, truncate, isMinor } from "@/lib/utils";
import { BODY_ZONES, COLOR_MODE, REQUEST_STATUS, labelOf } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/misc";
import { ListToolbar } from "@/components/list-toolbar";
import { CopyLink } from "./copy-link";

export const metadata: Metadata = { title: "Demandes" };
export const dynamic = "force-dynamic";

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";

  const requests = await db.projectRequest.findMany({
    where: {
      ...(params.statut ? { status: params.statut } : { status: { not: "declined" } }),
      ...(query
        ? {
            OR: [
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  const newCount = await db.projectRequest.count({ where: { status: "new" } });

  return (
    <>
      <PageHeader
        title="Demandes reçues"
        description={
          newCount > 0
            ? `${newCount} nouvelle${newCount > 1 ? "s" : ""} demande${newCount > 1 ? "s" : ""} à traiter`
            : "Toutes les demandes sont traitées"
        }
      />

      {/* Lien à mettre dans la bio Instagram */}
      <Card className="mb-6 border-[var(--accent)]/25 bg-[var(--accent-soft)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Instagram className="size-4 text-[var(--accent)]" />
            Ton lien à mettre en bio Instagram
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[13px] text-[var(--fg-muted)] mb-3 leading-relaxed">
            Colle ce lien dans ta bio Instagram et réponds aux messages privés par
            « envoie ta demande ici 👉 ». Les demandes arrivent structurées, avec les
            photos de référence, et ne se perdent plus.
          </p>
          <CopyLink path="/demande" />
        </CardContent>
      </Card>

      <ListToolbar
        basePath="/demandes"
        searchPlaceholder="Nom, e-mail, description…"
        filters={[
          {
            param: "statut",
            label: "Statut",
            options: REQUEST_STATUS.map((o) => ({ value: o.value, label: o.label })),
          },
        ]}
      />

      {requests.length === 0 ? (
        <EmptyState
          icon={<Sparkles />}
          title={query ? "Aucun résultat" : "Aucune demande"}
          description={
            query
              ? "Essaie avec d'autres critères."
              : "Les demandes envoyées via le formulaire public apparaîtront ici."
          }
          action={
            <a
              href="/demande"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[13px] text-[var(--accent)] hover:underline"
            >
              <ExternalLink className="size-3.5" />
              Voir le formulaire public
            </a>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 stagger">
          {requests.map((request) => {
            const minor = !request.isAdult || isMinor(request.birthDate);
            return (
              <Link key={request.id} href={`/demandes/${request.id}`} className="group">
                <Card
                  interactive
                  className={
                    "p-4 h-full flex flex-col gap-3 " +
                    (request.status === "new"
                      ? "border-[var(--accent)]/30"
                      : "")
                  }
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      initials={initials(request.firstName, request.lastName)}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-semibold truncate group-hover:text-[var(--accent)] transition-colors">
                          {request.firstName} {request.lastName}
                        </p>
                        {minor && (
                          <ShieldAlert className="size-3.5 text-[var(--danger)] shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--fg-subtle)] mt-0.5">
                        {formatRelative(request.createdAt)}
                      </p>
                    </div>
                    <StatusBadge options={REQUEST_STATUS} value={request.status} />
                  </div>

                  <p className="text-[12px] text-[var(--fg-muted)] leading-relaxed line-clamp-3">
                    {truncate(request.description.replace(/\s+/g, " "), 160)}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mt-auto pt-2.5 border-t border-[var(--border)]">
                    {request.bodyZone && (
                      <Badge>{labelOf(BODY_ZONES, request.bodyZone)}</Badge>
                    )}
                    {request.sizeCm && <Badge>{request.sizeCm}</Badge>}
                    <Badge>{labelOf(COLOR_MODE, request.colorMode)}</Badge>
                    {request.budget && <Badge tone="accent">{request.budget}</Badge>}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
