import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { db, getSettings } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { buildSignature } from "@/lib/mail";
import { redirectUri, webhookUrl } from "@/lib/instagram";
import { GEMINI_MODEL } from "@/lib/gemini";
import { appUrl, getIntegration } from "@/lib/leads";
import { formatDate, formatRelative } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { ConnexionsView, type ChannelView } from "./connexions-view";

export const metadata: Metadata = { title: "Connexions" };
export const dynamic = "force-dynamic";

export default async function ConnexionsPage({
  searchParams,
}: {
  searchParams: Promise<{ instagram?: string; instagram_erreur?: string }>;
}) {
  const params = await searchParams;
  const [gmail, instagram, settings, gmailLeads, instagramLeads, gemini] = await Promise.all([
    getIntegration("gmail"),
    getIntegration("instagram"),
    getSettings(),
    db.lead.count({ where: { channel: "email" } }),
    db.lead.count({ where: { channel: "instagram" } }),
    db.integration.findUnique({ where: { channel: "gemini" } }),
  ]);

  // Aucun secret ne quitte le serveur : seulement l'état de la connexion.
  const view = (integration: typeof gmail, leads: number): ChannelView => ({
    connected: Boolean(integration.account && decryptSecret(integration.secret)),
    account: integration.account,
    accountName: integration.accountName,
    accountAvatar: integration.accountAvatar,
    autoReply: integration.autoReply,
    keywords: integration.keywords,
    subject: integration.subject,
    message: integration.message,
    lastError: integration.lastError,
    lastSyncLabel: integration.lastSyncAt ? formatRelative(integration.lastSyncAt) : null,
    tokenExpiryLabel: integration.tokenExpiresAt ? formatDate(integration.tokenExpiresAt) : null,
    leads,
  });

  const baseUrl = appUrl();

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            href="/reglages"
            className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Réglages
          </Link>
        }
        title="Connexions"
        description="Instagram et Gmail pour répondre aux demandes, Gemini pour lire les factures scannées."
      />
      <ConnexionsView
        gmail={view(gmail, gmailLeads)}
        instagram={{
          ...view(instagram, instagramLeads),
          appId: instagram.appId,
          hasAppSecret: Boolean(decryptSecret(instagram.appSecret)),
          verifyToken: instagram.verifyToken,
        }}
        urls={{
          app: baseUrl,
          redirect: redirectUri(),
          webhook: webhookUrl(),
          configured: /^https:\/\//.test(baseUrl),
        }}
        preview={{
          tatoueur: settings.ownerName,
          signature: buildSignature(settings),
          lien: `${baseUrl || "https://ton-adresse"}/d/exemple123`,
        }}
        flash={{
          instagramOk: params.instagram === "ok",
          instagramError: params.instagram_erreur ?? null,
        }}
        gemini={{
          connected: Boolean(decryptSecret(gemini?.secret)),
          since: gemini?.connectedAt ? formatDate(gemini.connectedAt) : null,
          model: GEMINI_MODEL,
        }}
      />
    </>
  );
}
