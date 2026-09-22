"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Send,
  Sparkles,
  Paperclip,
  Eye,
  Pencil,
  TriangleAlert,
} from "lucide-react";
import { sendMessage, prepareFromTemplate, type MessageState } from "../actions";
import { TEMPLATE_CATEGORY } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CheckboxField, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ClientOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
}

interface TemplateOption {
  id: string;
  key: string;
  name: string;
  category: string;
  subject: string;
  body: string;
}

export function ComposeForm({
  clients,
  templates,
  defaultClientId,
  quoteId,
  invoiceId,
  quoteNumber,
  invoiceNumber,
  defaultTemplateKey,
  smtpConfigured,
  signature,
}: {
  clients: ClientOption[];
  templates: TemplateOption[];
  defaultClientId?: string;
  quoteId?: string;
  invoiceId?: string;
  quoteNumber?: string;
  invoiceNumber?: string;
  defaultTemplateKey?: string;
  smtpConfigured: boolean;
  signature: string;
}) {
  const [state, formAction, pending] = useActionState<MessageState, FormData>(
    sendMessage,
    {},
  );

  const [clientId, setClientId] = React.useState(defaultClientId ?? "");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [preview, setPreview] = React.useState(false);
  const [loadingTemplate, setLoadingTemplate] = React.useState(false);
  const [usedTemplate, setUsedTemplate] = React.useState<string | null>(null);

  const client = clients.find((c) => c.id === clientId);
  const hasAttachment = Boolean(quoteId || invoiceId);

  const applyTemplate = React.useCallback(
    async (key: string) => {
      if (!key || !clientId) return;
      setLoadingTemplate(true);
      try {
        const result = await prepareFromTemplate(key, clientId, { quoteId, invoiceId });
        if (result) {
          setSubject(result.subject);
          setBody(result.body);
          setUsedTemplate(key);
        }
      } finally {
        setLoadingTemplate(false);
      }
    },
    [clientId, quoteId, invoiceId],
  );

  // Pré-remplit automatiquement quand on arrive depuis un devis ou une facture
  const autoApplied = React.useRef(false);
  React.useEffect(() => {
    if (autoApplied.current) return;
    if (defaultTemplateKey && clientId && templates.some((t) => t.key === defaultTemplateKey)) {
      autoApplied.current = true;
      void applyTemplate(defaultTemplateKey);
    }
  }, [defaultTemplateKey, clientId, templates, applyTemplate]);

  const grouped = TEMPLATE_CATEGORY.map((category) => ({
    ...category,
    templates: templates.filter((template) => template.category === category.value),
  })).filter((group) => group.templates.length > 0);

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1fr_300px] items-start">
      <input type="hidden" name="clientId" value={clientId} />
      {quoteId && <input type="hidden" name="quoteId" value={quoteId} />}
      {invoiceId && <input type="hidden" name="invoiceId" value={invoiceId} />}

      <div className="space-y-5 order-2 lg:order-1">
        {state.error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 rounded-[var(--radius-md)] bg-[var(--danger-soft)] border border-[var(--danger)]/25 animate-slide-up"
          >
            <AlertCircle className="size-4 text-[var(--danger)] shrink-0 mt-0.5" />
            <p className="text-[13px] text-[var(--danger)]">{state.error}</p>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Destinataire</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Client"
              htmlFor="clientSelect"
              hint={
                clients.length === 0
                  ? "Aucun client n'a d'adresse e-mail enregistrée."
                  : undefined
              }
            >
              <Select
                id="clientSelect"
                value={clientId}
                onChange={(event) => {
                  setClientId(event.target.value);
                  setUsedTemplate(null);
                }}
                placeholder="Adresse libre"
                options={clients.map((c) => ({
                  value: c.id,
                  label: `${c.firstName} ${c.lastName}`,
                }))}
              />
            </Field>

            <Field label="Adresse e-mail" htmlFor="to" required>
              <Input
                id="to"
                name="to"
                type="email"
                required
                key={client?.email ?? "libre"}
                defaultValue={client?.email ?? ""}
                placeholder="client@example.ch"
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Message</CardTitle>
              {usedTemplate && (
                <p className="text-[12px] text-[var(--fg-muted)] mt-0.5">
                  Généré depuis un modèle — relis et ajuste avant d&apos;envoyer.
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 p-0.5 rounded-[var(--radius-sm)] bg-[var(--bg-subtle)] border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setPreview(false)}
                className={cn(
                  "flex items-center gap-1.5 h-7 px-2.5 rounded-[var(--radius-xs)] text-[12px] font-medium transition-colors",
                  !preview
                    ? "bg-[var(--surface)] text-[var(--fg)] shadow-[var(--shadow-sm)]"
                    : "text-[var(--fg-muted)]",
                )}
              >
                <Pencil className="size-3" />
                Éditer
              </button>
              <button
                type="button"
                onClick={() => setPreview(true)}
                className={cn(
                  "flex items-center gap-1.5 h-7 px-2.5 rounded-[var(--radius-xs)] text-[12px] font-medium transition-colors",
                  preview
                    ? "bg-[var(--surface)] text-[var(--fg)] shadow-[var(--shadow-sm)]"
                    : "text-[var(--fg-muted)]",
                )}
              >
                <Eye className="size-3" />
                Aperçu
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Objet" htmlFor="subject" required>
              <Input
                id="subject"
                name="subject"
                required
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Ton devis pour la manchette japonaise"
              />
            </Field>

            {preview ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-5 min-h-[320px]">
                <p className="text-[15px] font-semibold text-[#18181b] mb-3">
                  {subject || "(sans objet)"}
                </p>
                <pre className="text-[13px] text-[#3f3f46] whitespace-pre-wrap font-sans leading-relaxed">
                  {body || "(message vide)"}
                </pre>
              </div>
            ) : (
              <Field label="Message" htmlFor="body" required>
                <Textarea
                  id="body"
                  name="body"
                  required
                  rows={16}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Salut {prénom}, voici le devis dont on a parlé…"
                  className="font-sans leading-relaxed"
                />
              </Field>
            )}
            {preview && <input type="hidden" name="body" value={body} />}

            {!body && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setBody(`\n\n${signature}`)}
              >
                Insérer ma signature
              </Button>
            )}
          </CardContent>
        </Card>

        {hasAttachment && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="size-4 text-[var(--fg-subtle)]" />
                Pièce jointe
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CheckboxField
                id="attachPdf"
                name="attachPdf"
                defaultChecked
                label={`Joindre le PDF ${quoteNumber ?? invoiceNumber}`}
                hint={
                  invoiceNumber
                    ? "La QR-facture suisse est incluse dans le PDF."
                    : "Le devis est joint tel qu'il apparaît à l'écran."
                }
              />
            </CardContent>
          </Card>
        )}

        <div className="sticky-actions sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-3.5 glass border-t border-[var(--border)] flex items-center justify-between gap-3 z-20">
          {!smtpConfigured ? (
            <span className="flex items-center gap-2 text-[12px] text-[var(--warning)]">
              <TriangleAlert className="size-3.5 shrink-0" />
              <span className="hidden sm:inline">
                SMTP absent — le message sera archivé sans être expédié
              </span>
              <span className="sm:hidden">Non expédié</span>
            </span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2.5 ml-auto">
            <Button asChild variant="ghost" type="button">
              <Link href="/messagerie">Annuler</Link>
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              <Send />
              Envoyer
            </Button>
          </div>
        </div>
      </div>

      {/* Modèles */}
      <div className="order-1 lg:order-2 lg:sticky lg:top-20">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-[var(--accent)]" />
              Modèles
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!clientId ? (
              <p className="text-[13px] text-[var(--fg-subtle)] py-2 leading-relaxed">
                Choisis d&apos;abord un client : les modèles se remplissent avec son
                prénom, ses montants et ses dates.
              </p>
            ) : grouped.length === 0 ? (
              <p className="text-[13px] text-[var(--fg-subtle)] py-2">
                Aucun modèle.{" "}
                <Link href="/messagerie/modeles" className="text-[var(--accent)] hover:underline">
                  En créer un
                </Link>
              </p>
            ) : (
              <div className="space-y-4">
                {grouped.map((group) => (
                  <div key={group.value}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)] mb-1.5">
                      {group.label}
                    </p>
                    <div className="space-y-1">
                      {group.templates.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          disabled={loadingTemplate}
                          onClick={() => applyTemplate(template.key)}
                          className={cn(
                            "w-full text-left px-2.5 py-2 rounded-[var(--radius-sm)]",
                            "text-[13px] transition-colors disabled:opacity-50",
                            usedTemplate === template.key
                              ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                              : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
                          )}
                        >
                          {template.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <Button asChild variant="secondary" size="sm" className="w-full">
                <Link href="/messagerie/modeles">Gérer les modèles</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {client && (
          <Card className="mt-5">
            <CardHeader>
              <CardTitle>Contexte</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[12px] text-[var(--fg-muted)]">
              <p>
                Les variables du modèle sont remplacées automatiquement par les données
                de <strong className="text-[var(--fg)]">{client.firstName}</strong>.
              </p>
              {quoteNumber && (
                <Badge tone="info" size="md">
                  Devis {quoteNumber}
                </Badge>
              )}
              {invoiceNumber && (
                <Badge tone="info" size="md">
                  Facture {invoiceNumber}
                </Badge>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </form>
  );
}
