"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Instagram, Link2, Mail, Send, TriangleAlert } from "lucide-react";
import { replyToLead } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";

/**
 * Réponse écrite depuis l'app : elle part sur Instagram ou par e-mail, selon
 * l'endroit où la personne a écrit, et s'ajoute à la conversation.
 */
export function LeadComposer({
  leadId,
  channel,
  connected,
  link,
  instagramWindow,
}: {
  leadId: string;
  channel: string;
  /** Le canal est-il relié dans Réglages → Connexions ? */
  connected: boolean;
  /** Lien de demande perso, à glisser dans le message. */
  link: string;
  /** Instagram : réponse possible jusqu'à cette date (libellé), ou fenêtre fermée. */
  instagramWindow?: { open: boolean; until: string | null };
}) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const instagram = channel === "instagram";
  const windowClosed = instagram && instagramWindow?.open === false;
  const tooLong = instagram && text.trim().length > 1000;
  const disabled = !connected || windowClosed || pending || !text.trim() || tooLong;

  function send() {
    if (disabled) return;
    startTransition(async () => {
      const result = await replyToLead(leadId, text);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setText("");
      toast.success(instagram ? "Message envoyé sur Instagram" : "E-mail envoyé");
      router.refresh();
    });
  }

  function insertLink() {
    const field = textareaRef.current;
    const start = field?.selectionStart ?? text.length;
    const end = field?.selectionEnd ?? text.length;
    const before = text.slice(0, start);
    const spacer = before && !/\s$/.test(before) ? " " : "";
    setText(`${before}${spacer}${link}${text.slice(end)}`);
    requestAnimationFrame(() => field?.focus());
  }

  if (!connected) {
    return (
      <Notice>
        {instagram ? "Instagram" : "Gmail"} n&apos;est pas connecté : relie-le dans{" "}
        <Link href="/reglages/connexions" className="text-[var(--accent)] hover:underline">
          Réglages → Connexions
        </Link>{" "}
        pour répondre depuis l&apos;app.
      </Notice>
    );
  }

  if (windowClosed) {
    return (
      <Notice>
        Plus de 24 h depuis son dernier message : Instagram n&apos;accepte plus de réponse
        envoyée par une app. Réponds-lui depuis Instagram ; ta réponse apparaîtra ici
        automatiquement.
      </Notice>
    );
  }

  return (
    <div className="space-y-2">
      <Textarea
        ref={textareaRef}
        rows={3}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            send();
          }
        }}
        placeholder={instagram ? "Ta réponse sur Instagram…" : "Ta réponse par e-mail…"}
        aria-label="Ta réponse"
        className="min-h-[88px]"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="xs" onClick={insertLink}>
          <Link2 />
          Insérer son lien de demande
        </Button>
        <span className="text-[11px] text-[var(--fg-subtle)] mr-auto">
          {instagram
            ? `${text.trim().length} / 1000${instagramWindow?.until ? ` · réponse possible jusqu'au ${instagramWindow.until}` : ""}`
            : "Ta signature est ajoutée automatiquement."}
        </span>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={send}
          loading={pending}
          disabled={disabled}
        >
          {instagram ? <Instagram /> : <Mail />}
          {instagram ? "Envoyer sur Instagram" : "Envoyer par e-mail"}
          <Send className="hidden sm:block" />
        </Button>
      </div>
      {tooLong && (
        <p className="text-[12px] text-[var(--danger)]">
          Instagram limite un message à 1000 caractères.
        </p>
      )}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-[var(--radius-sm)] bg-[var(--warning-soft)] border border-[var(--warning)]/25">
      <TriangleAlert className="size-4 text-[var(--warning)] shrink-0 mt-0.5" />
      <p className="text-[13px] text-[var(--fg)] leading-relaxed">{children}</p>
    </div>
  );
}

/**
 * Actualise la page à intervalle régulier tant qu'elle est affichée : les
 * nouveaux messages (webhook Instagram, relève Gmail) apparaissent seuls.
 */
export function LiveRefresh({ every = 15_000 }: { every?: number }) {
  const router = useRouter();
  React.useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, every);
    return () => clearInterval(timer);
  }, [router, every]);
  return null;
}
