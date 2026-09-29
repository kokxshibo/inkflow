import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft, Mail, MessagesSquare, Link2 } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate, formatRelative } from "@/lib/utils";
import { REQUEST_STATUS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { DataRow, PageHeader } from "@/components/ui/misc";
import { CopyLink } from "../../copy-link";
import {
  ChannelBadge,
  InstagramHandle,
  LeadAvatar,
  LeadConversation,
  LeadProgress,
  instagramProfileUrl,
  leadDisplayName,
} from "../../lead-ui";
import { LeadActions } from "./lead-actions";
import { LeadComposer, LiveRefresh } from "../../lead-composer";
import { composerPropsFor, markReadIfNeeded } from "../../lead-server";

export const metadata: Metadata = { title: "Contact" };
export const dynamic = "force-dynamic";

/** Personne arrivée par Instagram ou Gmail : identité, lien perso et conversation. */
export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await db.lead.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { sentAt: "asc" } },
      requests: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!lead) notFound();
  await markReadIfNeeded(lead);
  const composer = await composerPropsFor(lead);

  return (
    <>
      <LiveRefresh />
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
            <LeadAvatar lead={lead} size="lg" />
            <span className="min-w-0">
              <span className="block truncate">{leadDisplayName(lead)}</span>
              <span className="flex flex-wrap items-center gap-2 mt-1.5 text-[12px] font-normal">
                <ChannelBadge channel={lead.channel} />
                <LeadProgress lead={lead} hasRequest={lead.requests.length > 0} />
                <span className="text-[var(--fg-subtle)]">
                  premier message {formatRelative(lead.createdAt)}
                </span>
              </span>
            </span>
          </span>
        }
        actions={
          <LeadActions
            lead={{
              id: lead.id,
              channel: lead.channel,
              linkSent: Boolean(lead.autoRepliedAt),
            }}
            instagramUrl={lead.username ? instagramProfileUrl(lead.username) : null}
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px] items-start">
        {/* La conversation d'abord, y compris sur téléphone. */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessagesSquare className="size-4 text-[var(--fg-subtle)]" />
              Conversation {lead.channel === "instagram" ? "Instagram" : "Gmail"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <LeadConversation messages={lead.messages} channel={lead.channel} />
            <div className="pt-4 border-t border-[var(--border)]">
              <LeadComposer {...composer} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {lead.username && (
                <InstagramHandle
                  username={lead.username}
                  className="gap-2.5 text-[13px] text-[var(--fg-muted)] [&_svg]:size-4 [&_svg]:text-[var(--fg-subtle)]"
                />
              )}
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="flex items-center gap-2.5 text-[13px] text-[var(--fg-muted)] hover:text-[var(--accent)] transition-colors"
                >
                  <Mail className="size-4 shrink-0 text-[var(--fg-subtle)]" />
                  <span className="truncate">{lead.email}</span>
                </a>
              )}
              {lead.name && lead.username && (
                <p className="text-[12px] text-[var(--fg-subtle)]">Nom du profil : {lead.name}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="size-4 text-[var(--fg-subtle)]" />
                Son lien perso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <CopyLink path={`/d/${lead.token}`} />
              <dl>
                <DataRow label="Envoyé">
                  {lead.autoRepliedAt ? formatDate(lead.autoRepliedAt) : "Pas encore"}
                </DataRow>
                <DataRow label="Ouvert">
                  {lead.clicks > 0
                    ? `${lead.clicks} fois (dernière fois ${formatRelative(lead.lastClickAt)})`
                    : "Pas encore"}
                </DataRow>
              </dl>
            </CardContent>
          </Card>

          {lead.requests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Demande{lead.requests.length > 1 ? "s" : ""} envoyée{lead.requests.length > 1 ? "s" : ""}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {lead.requests.map((request) => (
                  <Link
                    key={request.id}
                    href={`/demandes/${request.id}`}
                    className="flex items-center justify-between gap-2 text-[13px] hover:text-[var(--accent)] transition-colors"
                  >
                    <span className="truncate">
                      {request.firstName} {request.lastName} · {formatDate(request.createdAt)}
                    </span>
                    <StatusBadge options={REQUEST_STATUS} value={request.status} />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
