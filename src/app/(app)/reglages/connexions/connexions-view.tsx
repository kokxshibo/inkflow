"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Instagram,
  LogOut,
  Mail,
  RefreshCw,
  Save,
  TriangleAlert,
} from "lucide-react";
import {
  connectGmailAction,
  disconnectGmailAction,
  disconnectInstagramAction,
  saveAutoReplyAction,
  saveInstagramAppAction,
  startInstagramAction,
  syncGmailAction,
  type ConnexionState,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, SwitchField, Textarea } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";

export interface ChannelView {
  connected: boolean;
  account: string | null;
  accountName: string | null;
  accountAvatar: string | null;
  autoReply: boolean;
  keywords: string;
  subject: string | null;
  message: string;
  lastError: string | null;
  /** Libellés calculés sur le serveur (fuseau suisse, pas d'écart à l'hydratation). */
  lastSyncLabel: string | null;
  tokenExpiryLabel: string | null;
  leads: number;
}

interface Preview {
  artiste: string;
  tatoueur: string;
  signature: string;
  lien: string;
}

export function ConnexionsView({
  gmail,
  instagram,
  urls,
  preview,
  flash,
}: {
  gmail: ChannelView;
  instagram: ChannelView & { appId: string | null; hasAppSecret: boolean; verifyToken: string | null };
  urls: { app: string; redirect: string; webhook: string; configured: boolean };
  preview: Preview;
  flash: { instagramOk: boolean; instagramError: string | null };
}) {
  const router = useRouter();
  const [instagramError] = React.useState(flash.instagramError);

  // Retour d'Instagram : message affiché une fois, puis adresse nettoyée.
  React.useEffect(() => {
    if (flash.instagramOk) toast.success("Instagram est connecté");
    if (flash.instagramOk || flash.instagramError) {
      router.replace("/reglages/connexions", { scroll: false });
    }
  }, [flash.instagramOk, flash.instagramError, router]);

  return (
    <div className="space-y-6">
      {!urls.configured && (
        <Notice tone="warning">
          L&apos;adresse publique de l&apos;application (APP_URL) n&apos;est pas une adresse
          https. Les liens envoyés aux clients ne fonctionneraient pas : c&apos;est réglé
          automatiquement une fois l&apos;app installée sur le VPS.
        </Notice>
      )}

      <Card>
        <CardContent className="pt-5">
          <p className="text-[13px] text-[var(--fg-muted)] leading-relaxed">
            Quand une <strong className="text-[var(--fg)]">nouvelle personne</strong> t&apos;écrit
            au sujet d&apos;un tatouage (un des mots-clés ci-dessous) et que tu ne lui as encore
            jamais répondu, elle reçoit une seule fois ton message avec un{" "}
            <strong className="text-[var(--fg)]">lien de demande à son nom</strong>. Tu vois
            ensuite dans <em>Demandes</em> qui a cliqué, d&apos;où la personne vient, sa photo
            et son pseudo Instagram, et toute la conversation. Les newsletters, les
            notifications et tes clients existants sont ignorés.
          </p>
        </CardContent>
      </Card>

      <GmailCard gmail={gmail} preview={preview} />
      <InstagramCard
        instagram={instagram}
        urls={urls}
        preview={preview}
        error={instagramError}
      />
    </div>
  );
}

/* ─────────────────────────── Gmail ─────────────────────────── */

function GmailCard({ gmail, preview }: { gmail: ChannelView; preview: Preview }) {
  const [state, formAction, pending] = useActionState<ConnexionState, FormData>(
    connectGmailAction,
    {},
  );
  const [busy, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (state.success) toast.success(state.success);
  }, [state]);

  function sync() {
    startTransition(async () => {
      const result = await syncGmailAction();
      if (result.error) toast.error(result.error);
      else toast.success(result.success ?? "Relève terminée");
    });
  }

  function disconnect() {
    startTransition(async () => {
      await disconnectGmailAction();
      toast.success("Gmail déconnecté");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4 text-[var(--fg-subtle)]" />
          Gmail
        </CardTitle>
        <StatusBadge connected={gmail.connected} />
      </CardHeader>
      <CardContent className="space-y-5">
        {gmail.connected ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{gmail.account}</p>
                <p className="text-[12px] text-[var(--fg-subtle)] mt-0.5">
                  {gmail.lastSyncLabel
                    ? `Dernière relève ${gmail.lastSyncLabel}`
                    : "Première relève dans la minute"}
                  {" · "}
                  {gmail.leads} contact{gmail.leads > 1 ? "s" : ""} Gmail
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={sync} loading={busy}>
                  <RefreshCw />
                  Relever maintenant
                </Button>
                <Button variant="dangerGhost" size="sm" onClick={disconnect} disabled={busy}>
                  <LogOut />
                  Déconnecter
                </Button>
              </div>
            </div>
            {gmail.lastError && <Notice tone="danger">{gmail.lastError}</Notice>}
          </>
        ) : (
          <form action={formAction} className="space-y-4">
            <ol className="text-[13px] text-[var(--fg-muted)] leading-relaxed list-decimal pl-5 space-y-1">
              <li>
                Active la <strong className="text-[var(--fg)]">validation en deux étapes</strong>{" "}
                sur ton compte Google (obligatoire pour l&apos;étape suivante).
              </li>
              <li>
                Crée un{" "}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] hover:underline inline-flex items-center gap-1"
                >
                  mot de passe d&apos;application
                  <ExternalLink className="size-3" />
                </a>{" "}
                nommé « InkFlow ». Google affiche 16 lettres.
              </li>
              <li>Colle ton adresse et ces 16 lettres ci-dessous.</li>
            </ol>
            <p className="text-[12px] text-[var(--fg-subtle)] leading-relaxed">
              Ton mot de passe habituel n&apos;est jamais demandé. Le mot de passe
              d&apos;application est chiffré sur le serveur et tu peux le révoquer à tout moment
              depuis ton compte Google.
            </p>
            {state.error && <Notice tone="danger">{state.error}</Notice>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Adresse Gmail" htmlFor="gmail-email" required>
                <Input
                  id="gmail-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="off"
                  placeholder="tonnom@gmail.com"
                />
              </Field>
              <Field label="Mot de passe d'application" htmlFor="gmail-password" required>
                <Input
                  id="gmail-password"
                  name="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="abcd efgh ijkl mnop"
                />
              </Field>
            </div>
            <Button type="submit" variant="primary" loading={pending}>
              <Mail />
              Connecter Gmail
            </Button>
          </form>
        )}

        <AutoReplyForm channel="gmail" config={gmail} preview={preview} />
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────── Instagram ─────────────────────────── */

function InstagramCard({
  instagram,
  urls,
  preview,
  error,
}: {
  instagram: ChannelView & { appId: string | null; hasAppSecret: boolean; verifyToken: string | null };
  urls: { redirect: string; webhook: string };
  preview: Preview;
  error: string | null;
}) {
  const [state, formAction, pending] = useActionState<ConnexionState, FormData>(
    saveInstagramAppAction,
    {},
  );
  const [busy, startTransition] = React.useTransition();
  const [showSetup, setShowSetup] = React.useState(!instagram.connected);
  const appReady = Boolean(instagram.appId && instagram.hasAppSecret);

  React.useEffect(() => {
    if (state.success) toast.success(state.success);
  }, [state]);

  function disconnect() {
    startTransition(async () => {
      await disconnectInstagramAction();
      toast.success("Instagram déconnecté");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Instagram className="size-4 text-[var(--fg-subtle)]" />
          Instagram
        </CardTitle>
        <StatusBadge connected={instagram.connected} />
      </CardHeader>
      <CardContent className="space-y-5">
        {error && <Notice tone="danger">{error}</Notice>}

        {instagram.connected && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar
                  src={instagram.accountAvatar}
                  initials={(instagram.account ?? "IG").slice(0, 2).toUpperCase()}
                />
                <div className="min-w-0">
                  <a
                    href={`https://www.instagram.com/${instagram.account}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:text-[var(--accent)] transition-colors"
                  >
                    @{instagram.account}
                  </a>
                  <p className="text-[12px] text-[var(--fg-subtle)] mt-0.5">
                    {instagram.tokenExpiryLabel &&
                      `Autorisation valable jusqu'au ${instagram.tokenExpiryLabel}, prolongée automatiquement · `}
                    {instagram.leads} contact{instagram.leads > 1 ? "s" : ""} Instagram
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowSetup((open) => !open)}>
                  {showSetup ? "Masquer la configuration" : "Configuration Meta"}
                </Button>
                <Button variant="dangerGhost" size="sm" onClick={disconnect} loading={busy}>
                  <LogOut />
                  Déconnecter
                </Button>
              </div>
            </div>
            {instagram.lastError && <Notice tone="danger">{instagram.lastError}</Notice>}
          </>
        )}

        {showSetup && (
          <div className="space-y-4">
            <ol className="text-[13px] text-[var(--fg-muted)] leading-relaxed list-decimal pl-5 space-y-2">
              <li>
                Ton compte Instagram doit être un{" "}
                <strong className="text-[var(--fg)]">compte professionnel</strong> (Créateur ou
                Entreprise) : Instagram → Paramètres → Type de compte. C&apos;est gratuit.
              </li>
              <li>
                Sur{" "}
                <a
                  href="https://developers.facebook.com/apps/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] hover:underline inline-flex items-center gap-1"
                >
                  developers.facebook.com
                  <ExternalLink className="size-3" />
                </a>
                , crée une application (cas d&apos;usage « Gérer les messages et le contenu sur
                Instagram »), puis ouvre{" "}
                <em>Instagram → Configuration de l&apos;API avec connexion Instagram</em>.
              </li>
              <li>
                Copie l&apos;<strong className="text-[var(--fg)]">ID de l&apos;app Instagram</strong>{" "}
                et la <strong className="text-[var(--fg)]">clé secrète de l&apos;app Instagram</strong>{" "}
                dans le formulaire ci-dessous et enregistre.
              </li>
              <li>
                Section « Configurer la connexion d&apos;entreprise Instagram », URL de
                redirection :
                <CopyValue value={urls.redirect} />
              </li>
              <li>
                Section « Configurer les webhooks » : URL de rappel et jeton de vérification,
                puis « Vérifier et enregistrer » et abonne-toi au champ{" "}
                <code className="text-[var(--fg)]">messages</code>.
                <CopyValue value={urls.webhook} />
                {instagram.verifyToken ? (
                  <CopyValue value={instagram.verifyToken} />
                ) : (
                  <span className="block text-[12px] text-[var(--fg-subtle)] mt-1">
                    Le jeton apparaît ici après l&apos;enregistrement de l&apos;étape 3.
                  </span>
                )}
              </li>
              <li>
                Clique sur <strong className="text-[var(--fg)]">Connecter Instagram</strong> et
                autorise ton compte.
              </li>
              <li>
                Pour répondre à <em>tout le monde</em> (pas seulement aux comptes testeurs de
                l&apos;app), passe l&apos;application en mode « Live » et demande
                l&apos;accès avancé à <code>instagram_business_manage_messages</code> dans
                « Examen de l&apos;app ». Meta valide en général sous quelques jours.
              </li>
            </ol>

            <form action={formAction} className="space-y-4">
              {state.error && <Notice tone="danger">{state.error}</Notice>}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="ID de l'app Instagram" htmlFor="ig-app-id" required>
                  <Input
                    id="ig-app-id"
                    name="appId"
                    required
                    inputMode="numeric"
                    autoComplete="off"
                    defaultValue={instagram.appId ?? ""}
                    placeholder="1234567890123456"
                    className="tabular"
                  />
                </Field>
                <Field
                  label="Clé secrète de l'app Instagram"
                  htmlFor="ig-app-secret"
                  hint={instagram.hasAppSecret ? "Enregistrée. Laisse vide pour la garder." : undefined}
                >
                  <Input
                    id="ig-app-secret"
                    name="appSecret"
                    type="password"
                    autoComplete="new-password"
                    placeholder={instagram.hasAppSecret ? "••••••••••••••••" : "32 caractères"}
                  />
                </Field>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="secondary" loading={pending}>
                  <Save />
                  Enregistrer l&apos;application
                </Button>
              </div>
            </form>

            <form action={startInstagramAction}>
              <Button type="submit" variant="primary" disabled={!appReady}>
                <Instagram />
                {instagram.connected ? "Reconnecter Instagram" : "Connecter Instagram"}
              </Button>
            </form>
          </div>
        )}

        <AutoReplyForm channel="instagram" config={instagram} preview={preview} />
      </CardContent>
    </Card>
  );
}

/* ─────────────────────── Réponse automatique ─────────────────────── */

function AutoReplyForm({
  channel,
  config,
  preview,
}: {
  channel: "gmail" | "instagram";
  config: ChannelView;
  preview: Preview;
}) {
  const [state, formAction, pending] = useActionState<ConnexionState, FormData>(
    saveAutoReplyAction,
    {},
  );
  const [message, setMessage] = React.useState(config.message);

  React.useEffect(() => {
    if (state.success) toast.success(state.success);
  }, [state]);

  const rendered = message
    .replace(/[ \t]*\{\{\s*prenom\s*\}\}/g, " Léa")
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
      const values: Record<string, string> = {
        lien: preview.lien,
        artiste: preview.artiste,
        // Ancien nom de {{artiste}}.
        salon: preview.artiste,
        tatoueur: preview.tatoueur,
        signature: preview.signature,
      };
      return values[key] ?? "";
    });

  return (
    <form
      action={formAction}
      className="space-y-4 pt-5 border-t border-[var(--border)]"
    >
      <input type="hidden" name="channel" value={channel} />
      <SwitchField
        id={`${channel}-autoReply`}
        name="autoReply"
        label="Répondre automatiquement"
        hint="Désactivé, les contacts sont quand même enregistrés : tu envoies le lien toi-même depuis leur fiche."
        defaultChecked={config.autoReply}
      />

      {state.error && <Notice tone="danger">{state.error}</Notice>}

      <Field
        label="Mots-clés déclencheurs"
        htmlFor={`${channel}-keywords`}
        hint="Séparés par des virgules. Majuscules et accents ignorés ; « dispo » trouve aussi « disponible »."
      >
        <Textarea
          id={`${channel}-keywords`}
          name="keywords"
          rows={2}
          defaultValue={config.keywords}
        />
      </Field>

      {channel === "gmail" && (
        <Field
          label="Objet"
          htmlFor="gmail-subject"
          hint="Vide : « Re: » suivi de l'objet de son e-mail, pour rester dans le même fil."
        >
          <Input id="gmail-subject" name="subject" defaultValue={config.subject ?? ""} />
        </Field>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Field
          label="Message"
          htmlFor={`${channel}-message`}
          hint="Variables : {{prenom}} {{lien}} {{artiste}} {{tatoueur}} {{signature}}. {{lien}} est obligatoire."
        >
          <Textarea
            id={`${channel}-message`}
            name="message"
            rows={channel === "gmail" ? 10 : 6}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-[var(--fg-muted)]">Aperçu</span>
          <div
            className={
              channel === "instagram"
                ? "rounded-2xl rounded-bl-md bg-[var(--surface-2)] border border-[var(--border)] px-3.5 py-2.5 text-[13px] whitespace-pre-wrap leading-relaxed"
                : "rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border)] p-3.5 text-[13px] whitespace-pre-wrap leading-relaxed"
            }
          >
            {rendered}
          </div>
          {channel === "instagram" && (
            <p className="text-[11px] text-[var(--fg-subtle)] tabular">
              {rendered.length} / 1000 caractères
            </p>
          )}
        </div>
      </div>

      <Button type="submit" variant="secondary" loading={pending}>
        <Save />
        Enregistrer la réponse {channel === "gmail" ? "Gmail" : "Instagram"}
      </Button>
    </form>
  );
}

/* ─────────────────────────── Divers ─────────────────────────── */

function StatusBadge({ connected }: { connected: boolean }) {
  return connected ? (
    <Badge tone="success" dot>
      Connecté
    </Badge>
  ) : (
    <Badge>Non connecté</Badge>
  );
}

function Notice({ tone, children }: { tone: "danger" | "warning"; children: React.ReactNode }) {
  const Icon = tone === "danger" ? AlertCircle : TriangleAlert;
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={
        "flex items-start gap-2.5 p-3 rounded-[var(--radius-sm)] border " +
        (tone === "danger"
          ? "bg-[var(--danger-soft)] border-[var(--danger)]/25"
          : "bg-[var(--warning-soft)] border-[var(--warning)]/25")
      }
    >
      <Icon
        className={
          "size-4 shrink-0 mt-0.5 " +
          (tone === "danger" ? "text-[var(--danger)]" : "text-[var(--warning)]")
        }
      />
      <p className="text-[13px] text-[var(--fg)] leading-relaxed">{children}</p>
    </div>
  );
}

/** Valeur à copier dans la console Meta. */
function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);

  function copy() {
    navigator.clipboard.writeText(value).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => toast.error("Impossible de copier"),
    );
  }

  return (
    <span className="flex items-center gap-2 mt-1.5">
      <code className="flex-1 min-w-0 px-2.5 h-8 flex items-center rounded-[var(--radius-xs)] bg-[var(--bg-subtle)] border border-[var(--border)] text-[12px] text-[var(--fg)] truncate tabular">
        {value}
      </code>
      <Button type="button" variant="secondary" size="iconSm" onClick={copy} aria-label="Copier">
        {copied ? <Check className="text-[var(--success)]" /> : <Copy />}
      </Button>
    </span>
  );
}

