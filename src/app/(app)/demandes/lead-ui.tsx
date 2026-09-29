import { Instagram, Mail, MousePointerClick, Send, Bot } from "lucide-react";
import type { Lead, LeadMessage } from "@prisma/client";
import { cn, formatDateTime, initials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";

/**
 * Éléments d'affichage des contacts arrivés par Instagram ou Gmail, partagés
 * entre la liste des demandes, la fiche demande et la fiche contact.
 */

export function instagramProfileUrl(username: string) {
  return `https://www.instagram.com/${encodeURIComponent(username.replace(/^@/, ""))}/`;
}

/** Nom à afficher : nom du profil, sinon @pseudo, sinon adresse. */
export function leadDisplayName(lead: Pick<Lead, "name" | "username" | "email" | "externalId">) {
  return lead.name?.trim() || (lead.username ? `@${lead.username}` : lead.email ?? lead.externalId);
}

export function LeadAvatar({
  lead,
  size = "md",
}: {
  lead: Pick<Lead, "name" | "username" | "email" | "externalId" | "avatarUrl">;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const [first, second] = leadDisplayName(lead).replace(/^@/, "").split(/[\s._-]+/);
  return <Avatar src={lead.avatarUrl} initials={initials(first, second)} size={size} />;
}

export function ChannelBadge({ channel }: { channel: string }) {
  if (channel === "instagram") {
    return (
      <Badge tone="accent" className="gap-1">
        <Instagram className="size-3" />
        Instagram
      </Badge>
    );
  }
  if (channel === "email") {
    return (
      <Badge tone="info" className="gap-1">
        <Mail className="size-3" />
        Gmail
      </Badge>
    );
  }
  return null;
}

/** @pseudo cliquable, ouvre le profil Instagram dans un nouvel onglet. */
export function InstagramHandle({
  username,
  className,
}: {
  username: string;
  className?: string;
}) {
  return (
    <a
      href={instagramProfileUrl(username)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 hover:text-[var(--accent)] transition-colors",
        className,
      )}
    >
      <Instagram className="size-3.5 shrink-0" />@{username.replace(/^@/, "")}
    </a>
  );
}

/** Où en est le contact : lien envoyé, cliqué, formulaire rempli. */
export function LeadProgress({
  lead,
  hasRequest,
}: {
  lead: Pick<Lead, "autoRepliedAt" | "clicks" | "lastClickAt">;
  hasRequest: boolean;
}) {
  if (hasRequest) return <Badge tone="success">Formulaire rempli</Badge>;
  if (lead.clicks > 0) {
    return (
      <Badge tone="warning" className="gap-1">
        <MousePointerClick className="size-3" />
        Lien ouvert{lead.clicks > 1 ? ` ×${lead.clicks}` : ""}
      </Badge>
    );
  }
  if (lead.autoRepliedAt) {
    return (
      <Badge className="gap-1">
        <Send className="size-3" />
        Lien envoyé
      </Badge>
    );
  }
  return <Badge tone="danger">Lien pas encore envoyé</Badge>;
}

/** Fil de la conversation, du plus ancien au plus récent. */
export function LeadConversation({
  messages,
  channel,
}: {
  messages: Pick<LeadMessage, "id" | "direction" | "body" | "subject" | "auto" | "sentAt">[];
  channel: string;
}) {
  if (messages.length === 0) {
    return <p className="text-[13px] text-[var(--fg-subtle)]">Aucun message enregistré.</p>;
  }
  return (
    <ol className="space-y-3">
      {messages.map((message) => {
        const outgoing = message.direction === "out";
        return (
          <li key={message.id} className={cn("flex", outgoing ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] min-w-0", outgoing && "text-right")}>
              <div
                className={cn(
                  "inline-block text-left px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap break-words",
                  channel === "instagram" ? "rounded-2xl" : "rounded-[var(--radius-md)]",
                  outgoing
                    ? "bg-[var(--accent-soft)] border border-[var(--accent)]/20 rounded-br-md"
                    : "bg-[var(--surface-2)] border border-[var(--border)] rounded-bl-md",
                )}
              >
                {message.subject && channel === "email" && (
                  <span className="block text-[12px] font-semibold text-[var(--fg)] mb-1">
                    {message.subject}
                  </span>
                )}
                {message.body}
              </div>
              <p
                className={cn(
                  "text-[11px] text-[var(--fg-subtle)] mt-1 flex items-center gap-1",
                  outgoing ? "justify-end" : "justify-start",
                )}
              >
                {message.auto && (
                  <>
                    <Bot className="size-3" />
                    <span>Réponse automatique</span>
                    <span aria-hidden>·</span>
                  </>
                )}
                {formatDateTime(message.sentAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
