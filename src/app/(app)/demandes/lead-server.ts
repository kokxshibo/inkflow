import "server-only";
import type { Lead } from "@prisma/client";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { instagramReplyDeadline, leadLink, markLeadRead } from "@/lib/leads";
import { formatDateTime } from "@/lib/utils";

/** Données du bloc de réponse d'un contact (calculées côté serveur). */
export async function composerPropsFor(lead: Lead) {
  const integration = await db.integration.findUnique({
    where: { channel: lead.channel === "instagram" ? "instagram" : "gmail" },
  });
  const deadline = instagramReplyDeadline(lead.lastIncomingAt);
  return {
    leadId: lead.id,
    channel: lead.channel,
    connected: Boolean(integration?.account && decryptSecret(integration.secret)),
    link: leadLink(lead.token),
    instagramWindow:
      lead.channel === "instagram"
        ? {
            open: deadline !== null && deadline.getTime() > Date.now(),
            until: deadline ? formatDateTime(deadline) : null,
          }
        : undefined,
  };
}

/** La conversation affichée est lue : le contact sort des non-lus. */
export async function markReadIfNeeded(lead: Pick<Lead, "id" | "lastIncomingAt" | "lastReadAt">) {
  if (lead.lastIncomingAt && (!lead.lastReadAt || lead.lastReadAt < lead.lastIncomingAt)) {
    await markLeadRead(lead.id);
  }
}
