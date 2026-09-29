import Link from "next/link";
import type { Metadata } from "next";
import { Sparkles, Instagram, ExternalLink, ShieldAlert, Plug, MessagesSquare, Mail } from "lucide-react";
import { db } from "@/lib/db";
import { formatRelative, initials, truncate, isMinor } from "@/lib/utils";
import { ALL_BODY_ZONES, COLOR_MODE, REQUEST_STATUS, labelOf } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/misc";
import { ListToolbar } from "@/components/list-toolbar";
import { CopyLink } from "./copy-link";
import { LiveRefresh } from "./lead-composer";
import {
  ChannelBadge,
  InstagramHandle,
  LeadAvatar,
  LeadProgress,
  leadDisplayName,
} from "./lead-ui";

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
              { lead: { username: { contains: query, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: {
      lead: {
        select: { channel: true, username: true, avatarUrl: true },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  const newCount = await db.projectRequest.count({ where: { status: "new" } });

  // Conversations Instagram / Gmail, la plus récente en premier.
  const conversations = params.statut
    ? []
    : await db.lead.findMany({
        where: query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { username: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
              ],
            }
          : {},
        include: {
          messages: {
            orderBy: { sentAt: "desc" },
            take: 1,
            select: { body: true, direction: true, auto: true },
          },
          _count: { select: { requests: true } },
        },
        orderBy: { lastMessageAt: { sort: "desc", nulls: "last" } },
        take: 30,
      });
  const isUnread = (lead: (typeof conversations)[number]) =>
    Boolean(lead.lastIncomingAt && (!lead.lastReadAt || lead.lastReadAt < lead.lastIncomingAt));
  const unreadCount = conversations.filter(isUnread).length;

  return (
    <>
      <LiveRefresh every={30_000} />
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
          <Button asChild variant="secondary" size="xs">
            <Link href="/reglages/connexions">
              <Plug />
              Réponses automatiques
            </Link>
          </Button>
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

      {conversations.length > 0 && (
        <section className="mb-8">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold mb-3">
            <MessagesSquare className="size-4 text-[var(--fg-subtle)]" />
            Conversations Instagram &amp; Gmail
            {unreadCount > 0 && (
              <Badge tone="accent">
                {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
              </Badge>
            )}
          </h2>
          <Card className="divide-y divide-[var(--border)] overflow-hidden">
            {conversations.map((lead) => {
              const last = lead.messages[0];
              const unread = isUnread(lead);
              const toAnswer = last?.direction === "in";
              return (
                <div
                  key={lead.id}
                  className="group relative flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-hover)] transition-colors"
                >
                  {/* Lien couvrant toute la ligne ; le @pseudo reste cliquable au-dessus. */}
                  <Link
                    href={`/demandes/contacts/${lead.id}`}
                    className="absolute inset-0 z-0"
                    aria-label={`Conversation avec ${leadDisplayName(lead)}`}
                  />
                  <span className="relative shrink-0">
                    <LeadAvatar lead={lead} size="sm" />
                    {unread && (
                      <span
                        className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-[var(--accent)] ring-2 ring-[var(--surface)]"
                        aria-label="Non lu"
                      />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <p
                        className={
                          "text-[13px] truncate group-hover:text-[var(--accent)] transition-colors " +
                          (unread ? "font-semibold" : "font-medium")
                        }
                      >
                        {leadDisplayName(lead)}
                      </p>
                      {lead.channel === "instagram" ? (
                        <Instagram className="size-3.5 shrink-0 text-[var(--fg-subtle)]" aria-label="Instagram" />
                      ) : (
                        <Mail className="size-3.5 shrink-0 text-[var(--fg-subtle)]" aria-label="Gmail" />
                      )}
                      {lead.username && lead.name && (
                        <InstagramHandle
                          username={lead.username}
                          className="relative z-10 hidden sm:inline-flex text-[11px] text-[var(--fg-subtle)] [&_svg]:hidden"
                        />
                      )}
                    </div>
                    {last && (
                      <p
                        className={
                          "text-[12px] truncate mt-0.5 " +
                          (unread ? "text-[var(--fg)]" : "text-[var(--fg-muted)]")
                        }
                      >
                        {last.direction === "out" && (
                          <span className="text-[var(--fg-subtle)]">
                            {last.auto ? "Réponse auto : " : "Toi : "}
                          </span>
                        )}
                        {truncate(last.body.replace(/\s+/g, " "), 120)}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className="text-[11px] text-[var(--fg-subtle)]">
                      {formatRelative(lead.lastMessageAt ?? lead.createdAt)}
                    </span>
                    {toAnswer ? (
                      <Badge tone="warning">À répondre</Badge>
                    ) : (
                      <LeadProgress lead={lead} hasRequest={lead._count.requests > 0} />
                    )}
                  </div>
                </div>
              );
            })}
          </Card>
        </section>
      )}

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
            const username = request.lead?.username ?? request.instagram?.replace(/^@/, "");
            return (
              <div key={request.id} className="group relative">
                <Card
                  interactive
                  className={
                    "p-4 h-full flex flex-col gap-3 " +
                    (request.status === "new"
                      ? "border-[var(--accent)]/30"
                      : "")
                  }
                >
                  {/* Lien couvrant toute la carte ; le @pseudo reste cliquable au-dessus. */}
                  <Link
                    href={`/demandes/${request.id}`}
                    className="absolute inset-0 z-0 rounded-[inherit]"
                    aria-label={`Demande de ${request.firstName} ${request.lastName}`}
                  />
                  <div className="flex items-start gap-3">
                    <Avatar
                      src={request.lead?.avatarUrl}
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
                      <p className="text-[11px] text-[var(--fg-subtle)] mt-0.5 flex flex-wrap items-center gap-x-2">
                        {formatRelative(request.createdAt)}
                        {username && (
                          <InstagramHandle
                            username={username}
                            className="relative z-10 text-[var(--fg-muted)]"
                          />
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge options={REQUEST_STATUS} value={request.status} />
                      {request.lead && <ChannelBadge channel={request.lead.channel} />}
                    </div>
                  </div>

                  <p className="text-[12px] text-[var(--fg-muted)] leading-relaxed line-clamp-3">
                    {truncate(request.description.replace(/\s+/g, " "), 160)}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mt-auto pt-2.5 border-t border-[var(--border)]">
                    {request.bodyZone && (
                      <Badge>{labelOf(ALL_BODY_ZONES, request.bodyZone)}</Badge>
                    )}
                    {request.sizeCm && <Badge>{request.sizeCm}</Badge>}
                    <Badge>{labelOf(COLOR_MODE, request.colorMode)}</Badge>
                    {request.budget && <Badge tone="accent">{request.budget}</Badge>}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
