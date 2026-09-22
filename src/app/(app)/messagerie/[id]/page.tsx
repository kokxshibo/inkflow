import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft, Paperclip, CornerUpLeft } from "lucide-react";
import { db } from "@/lib/db";
import { formatDateTime, fullName, initials, parseJsonArray } from "@/lib/utils";
import { MESSAGE_STATUS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, DataRow, PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Message" };
export const dynamic = "force-dynamic";

export default async function MessageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const message = await db.message.findUnique({
    where: { id },
    include: { client: true },
  });

  if (!message) notFound();

  const attachments = parseJsonArray(message.attachments);

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            href="/messagerie"
            className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Messagerie
          </Link>
        }
        title={message.subject}
        description={formatDateTime(message.createdAt)}
        actions={
          message.client && (
            <Button asChild variant="primary" size="sm">
              <Link href={`/messagerie/nouveau?client=${message.client.id}`}>
                <CornerUpLeft />
                Écrire à nouveau
              </Link>
            </Button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px] items-start">
        <Card>
          <CardContent className="pt-6">
            <pre className="text-[13px] text-[var(--fg)] whitespace-pre-wrap font-sans leading-relaxed">
              {message.body}
            </pre>

            {attachments.length > 0 && (
              <div className="mt-6 pt-5 border-t border-[var(--border)]">
                <p className="text-[11px] uppercase tracking-wider text-[var(--fg-subtle)] mb-2.5">
                  Pièces jointes
                </p>
                <ul className="space-y-1.5">
                  {attachments.map((name) => (
                    <li
                      key={name}
                      className="flex items-center gap-2 text-[13px] text-[var(--fg-muted)]"
                    >
                      <Paperclip className="size-3.5 text-[var(--fg-subtle)]" />
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {message.error && (
              <div className="mt-6 p-3 rounded-[var(--radius-sm)] bg-[var(--danger-soft)] border border-[var(--danger)]/25">
                <p className="text-[12px] text-[var(--danger)]">{message.error}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          {message.client && (
            <Card>
              <CardHeader>
                <CardTitle>Client</CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/clients/${message.client.id}`}
                  className="flex items-center gap-3 p-2 -mx-2 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-colors group"
                >
                  <Avatar
                    initials={initials(
                      message.client.firstName,
                      message.client.lastName,
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium truncate group-hover:text-[var(--accent)] transition-colors">
                      {fullName(message.client)}
                    </p>
                    <p className="text-[11px] text-[var(--fg-subtle)] truncate">
                      {message.client.email}
                    </p>
                  </div>
                </Link>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Détails</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <DataRow label="Statut">
                  <StatusBadge options={MESSAGE_STATUS} value={message.status} />
                </DataRow>
                <DataRow label="De">
                  <span className="text-[11px] break-all">{message.fromAddr}</span>
                </DataRow>
                <DataRow label="À">
                  <span className="text-[11px] break-all">{message.toAddr}</span>
                </DataRow>
                <DataRow label="Créé le">{formatDateTime(message.createdAt)}</DataRow>
                {message.sentAt && (
                  <DataRow label="Envoyé le">{formatDateTime(message.sentAt)}</DataRow>
                )}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
