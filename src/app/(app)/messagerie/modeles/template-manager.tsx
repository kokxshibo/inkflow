"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, AlertCircle, Lock, Variable } from "lucide-react";
import { saveTemplate, deleteTemplate, type MessageState } from "../actions";
import { TEMPLATE_CATEGORY, TEMPLATE_VARIABLES } from "@/lib/constants";

import { slugify, truncate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/misc";
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Template {
  id: string;
  key: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  isSystem: boolean;
}

export function TemplateManager({ templates }: { templates: Template[] }) {
  const [editing, setEditing] = React.useState<Template | null>(null);
  const [open, setOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<Template | null>(null);
  const [, startTransition] = React.useTransition();

  const grouped = TEMPLATE_CATEGORY.map((category) => ({
    ...category,
    templates: templates.filter((template) => template.category === category.value),
  })).filter((group) => group.templates.length > 0);

  return (
    <>
      <div className="flex justify-end mb-5">
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus />
          Nouveau modèle
        </Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={<Variable />}
          title="Aucun modèle"
          description="Crée des modèles pour les envois récurrents : devis, rappel de rendez-vous, soins, relance."
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus />
              Créer un modèle
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.value}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)] mb-2.5">
                {group.label}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 stagger">
                {group.templates.map((template) => (
                  <Card key={template.id} className="p-4 flex flex-col gap-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold truncate">
                          {template.name}
                        </p>
                        <p className="text-[11px] text-[var(--fg-subtle)] truncate mt-0.5">
                          {template.subject}
                        </p>
                      </div>
                      {template.isSystem && (
                        <Badge tone="neutral">
                          <Lock className="size-2.5" />
                          Système
                        </Badge>
                      )}
                    </div>

                    <p className="text-[12px] text-[var(--fg-muted)] leading-relaxed line-clamp-3">
                      {truncate(template.body.replace(/\s+/g, " "), 140)}
                    </p>

                    <div className="flex items-center gap-1.5 mt-auto pt-2.5 border-t border-[var(--border)]">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          setEditing(template);
                          setOpen(true);
                        }}
                      >
                        <Pencil />
                        Modifier
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="ml-auto text-[var(--fg-subtle)] hover:text-[var(--danger)]"
                        onClick={() => setToDelete(template)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <TemplateDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={setOpen}
        template={editing}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(value) => !value && setToDelete(null)}
        title={`Supprimer « ${toDelete?.name} » ?`}
        description="Le modèle sera définitivement supprimé. Les e-mails déjà envoyés ne sont pas affectés."
        confirmLabel="Supprimer"
        destructive
        onConfirm={() => {
          if (!toDelete) return;
          startTransition(async () => {
            await deleteTemplate(toDelete.id);
            toast.success("Modèle supprimé");
            setToDelete(null);
          });
        }}
      />
    </>
  );
}

function TemplateDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
}) {
  const [state, formAction, pending] = useActionState<MessageState, FormData>(
    saveTemplate,
    {},
  );
  const [name, setName] = React.useState(template?.name ?? "");
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (state.success) {
      toast.success(template ? "Modèle mis à jour" : "Modèle créé");
      onOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  /** Insère une variable à la position du curseur. */
  function insertVariable(key: string) {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const token = `{{${key}}}`;
    textarea.value =
      textarea.value.slice(0, start) + token + textarea.value.slice(end);
    textarea.focus();
    textarea.setSelectionRange(start + token.length, start + token.length);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{template ? "Modifier le modèle" : "Nouveau modèle"}</DialogTitle>
          <DialogDescription>
            Utilise des {"{{variables}}"} : elles seront remplacées par les données du
            client au moment de la rédaction.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction}>
          {template && <input type="hidden" name="id" value={template.id} />}
          <input
            type="hidden"
            name="key"
            value={template?.key ?? (slugify(name) || "modele")}
          />

          <DialogBody className="space-y-4">
            {state.error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3 rounded-[var(--radius-sm)] bg-[var(--danger-soft)] border border-[var(--danger)]/25"
              >
                <AlertCircle className="size-4 text-[var(--danger)] shrink-0 mt-px" />
                <p className="text-[13px] text-[var(--danger)]">{state.error}</p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom du modèle" htmlFor="name" required>
                <Input
                  id="name"
                  name="name"
                  required
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Envoi de devis"
                />
              </Field>
              <Field label="Catégorie" htmlFor="category">
                <Select
                  id="category"
                  name="category"
                  defaultValue={template?.category ?? "general"}
                  options={TEMPLATE_CATEGORY.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                />
              </Field>
            </div>

            <Field label="Objet" htmlFor="subject" required>
              <Input
                id="subject"
                name="subject"
                required
                defaultValue={template?.subject ?? ""}
                placeholder="Ton devis {{numero}} — {{tatoueur}}"
              />
            </Field>

            <Field label="Message" htmlFor="body" required>
              <Textarea
                id="body"
                name="body"
                ref={bodyRef}
                required
                rows={12}
                defaultValue={template?.body ?? ""}
                placeholder={"Salut {{prenom}},\n\nVoici ton devis…"}
              />
            </Field>

            <div>
              <p className="text-[11px] font-medium text-[var(--fg-muted)] mb-2">
                Insérer une variable
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_VARIABLES.map((variable) => (
                  <button
                    key={variable.key}
                    type="button"
                    onClick={() => insertVariable(variable.key)}
                    title={variable.label}
                    className="px-2 h-6 rounded-full text-[10px] font-medium bg-[var(--bg-subtle)] border border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors tabular"
                  >
                    {`{{${variable.key}}}`}
                  </button>
                ))}
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={pending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
