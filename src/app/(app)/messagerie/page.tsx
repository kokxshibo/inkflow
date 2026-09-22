import Link from "next/link";
import type { Metadata } from "next";
import {
  Plus,
  Inbox,
  MailWarning,
  FileText,
  Send,
  AlertTriangle,
  Paperclip,
} from "lucide-react";
import { db } from "@/lib/db";
import { isSmtpConfigured } from "@/lib/mail";
import { formatRelative, fullName, initials, parseJsonArray, truncate } from "@/lib/utils";
import { MESSAGE_STATUS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/misc";
import { ListToolbar } from "@/components/list-toolbar";
import { MailFlash } from "./mail-flash";

export const metadata: Metadata = { title: "Messagerie" };
export const dynamic = "force-dynamic";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string; envoye?: string; simule?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";

  const messages = await db.message.findMany({
    where: {
      ...(params.statut ? { status: params.statut } : {}),
      ...(query
        ? {
            OR: [
              { subject: { contains: query, mode: 'insensitive' } },
              { body: { contains: query, mode: 'insensitive' } },
              { toAddr: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: { client: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const smtpOk = isSmtpConfigured();
  const awaitingReply = messages.filter(
    (m) => m.direction === "out" && m.needsReply,
  ).length;

  return (
    <>
      <MailFlash sent={params.envoye === "1"} simulated={params.simule === "1"} />

      <PageHeader
        title="Messagerie"
        description={`${messages.length} message${messages.length > 1 ? "s" : ""}${awaitingReply > 0 ? ` · ${awaitingReply} en attente de réponse` : ""}`}
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              <Link href="/messagerie/modeles">
                <FileText />
                <span className="hidden sm:inline">Modèles</span>
              </Link>
            </Button>
            <Button asChild variant="primary" size="sm">
              <Link href="/messagerie/nouveau">
                <Plus />
                <span className="hidden sm:inline">Écrire</span>
              </Link>
            </Button>
          </>
        }
      />

      {!smtpOk && (
        <Card className="mb-6 border-[var(--warning)]/35 bg-[var(--warning-soft)]">
          <CardContent className="pt-5 flex items-start gap-3.5">
            <AlertTriangle className="size-5 text-[var(--warning)] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--fg)]">
                SMTP non configuré — aucun e-mail ne part réellement
              </p>
              <p className="text-[13px] text-[var(--fg-muted)] mt-1 leading-relaxed">
                Les messages sont rédigés et archivés, mais marqués « non envoyés ».
                C&apos;est volontaire : impossible d&apos;écrire par erreur à un vrai
                client tant que la configuration n&apos;est pas faite.
                <br />
                Renseigne <code className="text-[11px]">SMTP_HOST</code>,{" "}
                <code className="text-[11px]">SMTP_USER</code>,{" "}
                <code className="text-[11px]">SMTP_PASS</code> et{" "}
                <code className="text-[11px]">SMTP_FROM</code> dans le fichier{" "}
                <code className="text-[11px]">.env</code>. Passe par un relais
                transactionnel (Infomaniak, Postmark, Brevo), jamais directement depuis le
                VPS.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <ListToolbar
        basePath="/messagerie"
        searchPlaceholder="Objet, contenu, destinataire…"
        filters={[
          {
            param: "statut",
            label: "Statut",
            options: MESSAGE_STATUS.map((o) => ({ value: o.value, label: o.label })),
          },
        ]}
      />

      {messages.length === 0 ? (
        <EmptyState
          icon={<Inbox />}
          title={query ? "Aucun résultat" : "Aucun message"}
          description={
            query
              ? "Essaie avec d'autres critères."
              : "Écris à un client depuis sa fiche, ou envoie un devis directement par e-mail."
          }
          action={
            <Button asChild variant="primary" size="sm">
              <Link href="/messagerie/nouveau">
                <Plus />
                Écrire un message
              </Link>
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--border)]">
            {messages.map((message) => {
              const attachments = parseJsonArray(message.attachments);
              return (
                <li key={message.id}>
                  <Link
                    href={`/messagerie/${message.id}`}
                    className="flex items-start gap-3.5 px-4 sm:px-5 py-3.5 hover:bg-[var(--surface-2)] transition-colors group"
                  >
                    <span className="mt-0.5 shrink-0">
                      {message.client ? (
                        <Avatar
                          size="sm"
                          initials={initials(
                            message.client.firstName,
                            message.client.lastName,
                          )}
                        />
                      ) : (
                        <span className="grid place-items-center size-8 rounded-full bg-[var(--surface-2)] border border-[var(--border)]">
                          <Send className="size-3.5 text-[var(--fg-subtle)]" />
                        </span>
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-medium truncate group-hover:text-[var(--accent)] transition-colors">
                          {message.client
                            ? fullName(message.client)
                            : message.toAddr}
                        </span>
                        {message.direction === "out" && message.needsReply && (
                          <Badge tone="info" dot>
                            En attente de réponse
                          </Badge>
                        )}
                        {attachments.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-[var(--fg-subtle)]">
                            <Paperclip className="size-3" />
                            {attachments.length}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-[var(--fg)] truncate mt-0.5">
                        {message.subject}
                      </p>
                      <p className="text-[12px] text-[var(--fg-subtle)] truncate mt-0.5">
                        {truncate(message.body.replace(/\s+/g, " "), 110)}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-[10px] text-[var(--fg-subtle)]">
                        {formatRelative(message.createdAt)}
                      </span>
                      <StatusBadge options={MESSAGE_STATUS} value={message.status} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Réception IMAP : prévue au lot 2 */}
      <Card className="mt-6 border-dashed">
        <CardContent className="pt-5 flex items-start gap-3.5">
          <MailWarning className="size-5 text-[var(--fg-subtle)] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Réception des e-mails (lot 2)</p>
            <p className="text-[13px] text-[var(--fg-muted)] mt-1 leading-relaxed">
              Cette version couvre l&apos;envoi, l&apos;archivage et les modèles. La
              réception IMAP, le rattachement automatique des réponses aux fiches clients
              et la détection « le client a répondu » constituent le lot suivant — ils
              nécessitent le nom de domaine et la boîte mail.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
