"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Project } from "@prisma/client";
import { AlertCircle, Save, Calculator } from "lucide-react";
import { createProject, updateProject, type ProjectFormState } from "./actions";
import {
  BODY_ZONES,
  normalizeBodyZone,
  COLOR_MODE,
  PROJECT_KIND,
  PROJECT_STATUS,
  PROJECT_STYLE,
} from "@/lib/constants";
import { formatCHF, parseCHF } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ClientOption {
  id: string;
  firstName: string;
  lastName: string;
}

export function ProjectForm({
  project,
  clients,
  defaultClientId,
  hourlyRate,
}: {
  project?: Project;
  clients: ClientOption[];
  defaultClientId?: string;
  hourlyRate: number;
}) {
  const action = project ? updateProject : createProject;
  const [state, formAction, pending] = useActionState<ProjectFormState, FormData>(
    action,
    {},
  );

  const [sessions, setSessions] = useState(project?.estimatedSessions ?? 1);
  const [hoursPerSession, setHoursPerSession] = useState(3);
  const [estimatedPrice, setEstimatedPrice] = useState(
    project?.estimatedPrice ? formatCHF(project.estimatedPrice, { showCurrency: false }) : "",
  );

  const suggestion = sessions * hoursPerSession * hourlyRate;
  const bodyZone = normalizeBodyZone(project?.bodyZone);

  return (
    <form action={formAction} className="space-y-5">
      {project && <input type="hidden" name="id" value={project.id} />}

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
          <CardTitle>Le projet</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Client"
            htmlFor="clientId"
            required
            error={state.fieldErrors?.clientId}
            className="sm:col-span-2"
          >
            <Select
              id="clientId"
              name="clientId"
              required
              defaultValue={project?.clientId ?? defaultClientId ?? ""}
              placeholder="Sélectionner un client…"
              options={clients.map((client) => ({
                value: client.id,
                label: `${client.firstName} ${client.lastName}`,
              }))}
            />
          </Field>

          <Field
            label="Titre du projet"
            htmlFor="title"
            required
            error={state.fieldErrors?.title}
            className="sm:col-span-2"
          >
            <Input
              id="title"
              name="title"
              required
              autoFocus={!project}
              defaultValue={project?.title}
              placeholder="Manchette japonaise — carpe et vagues"
            />
          </Field>

          <Field
            label="Description"
            htmlFor="description"
            className="sm:col-span-2"
            hint="Ce que le client veut, les contraintes, les détails à ne pas oublier."
          >
            <Textarea
              id="description"
              name="description"
              defaultValue={project?.description ?? ""}
              placeholder="Carpe koï remontant le bras, vagues en fond, feuilles d'érable. Le client veut éviter le rouge."
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Caractéristiques</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Emplacement" htmlFor="bodyZone">
            <Select
              id="bodyZone"
              name="bodyZone"
              defaultValue={bodyZone}
              placeholder="Non défini"
              options={[
                // Emplacement écrit par le client : proposé en premier pour ne pas le perdre.
                ...(bodyZone && !BODY_ZONES.some((zone) => zone.value === bodyZone)
                  ? [{ value: bodyZone, label: bodyZone }]
                  : []),
                ...BODY_ZONES.map((o) => ({ value: o.value, label: o.label })),
              ]}
            />
          </Field>

          <Field label="Largeur" htmlFor="widthCm">
            <Input
              id="widthCm"
              name="widthCm"
              inputMode="decimal"
              suffix="cm"
              defaultValue={project?.widthCm ?? ""}
              placeholder="12"
              className="tabular"
            />
          </Field>

          <Field label="Hauteur" htmlFor="heightCm">
            <Input
              id="heightCm"
              name="heightCm"
              inputMode="decimal"
              suffix="cm"
              defaultValue={project?.heightCm ?? ""}
              placeholder="18"
              className="tabular"
            />
          </Field>

          <Field label="Style" htmlFor="style">
            <Select
              id="style"
              name="style"
              defaultValue={project?.style ?? ""}
              placeholder="Non défini"
              options={PROJECT_STYLE.map((o) => ({ value: o.value, label: o.label }))}
            />
          </Field>

          <Field label="Rendu" htmlFor="colorMode">
            <Select
              id="colorMode"
              name="colorMode"
              defaultValue={project?.colorMode ?? "blackgrey"}
              options={COLOR_MODE.map((o) => ({ value: o.value, label: o.label }))}
            />
          </Field>

          <Field label="Type" htmlFor="kind">
            <Select
              id="kind"
              name="kind"
              defaultValue={project?.kind ?? "new"}
              options={PROJECT_KIND.map((o) => ({ value: o.value, label: o.label }))}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Séances et prix</CardTitle>
          <p className="text-[13px] text-[var(--fg-muted)]">
            Une estimation, ajustable à tout moment.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Statut" htmlFor="status">
            <Select
              id="status"
              name="status"
              defaultValue={project?.status ?? "idea"}
              options={PROJECT_STATUS.map((o) => ({ value: o.value, label: o.label }))}
            />
          </Field>

          <Field label="Nombre de séances estimé" htmlFor="estimatedSessions">
            <Input
              id="estimatedSessions"
              name="estimatedSessions"
              type="number"
              min={1}
              max={50}
              value={sessions}
              onChange={(event) => setSessions(Number(event.target.value) || 1)}
              className="tabular"
            />
          </Field>

          <Field
            label="Prix estimé"
            htmlFor="estimatedPrice"
            hint="Montant total du projet, toutes séances confondues."
          >
            <MoneyInput
              id="estimatedPrice"
              name="estimatedPrice"
              value={estimatedPrice}
              onChange={(event) => setEstimatedPrice(event.target.value)}
            />
          </Field>

          <Field
            label="Prix final"
            htmlFor="finalPrice"
            hint="À remplir une fois le projet terminé."
          >
            <MoneyInput
              id="finalPrice"
              name="finalPrice"
              defaultValue={
                project?.finalPrice
                  ? formatCHF(project.finalPrice, { showCurrency: false })
                  : ""
              }
            />
          </Field>

          {/* Assistant de calcul */}
          <div className="sm:col-span-2 p-4 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border)]">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="size-4 text-[var(--accent)]" />
              <span className="text-[13px] font-medium">Aide au chiffrage</span>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[var(--fg-muted)]">
                  {sessions} séance{sessions > 1 ? "s" : ""} de
                </span>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  step={0.5}
                  value={hoursPerSession}
                  onChange={(event) =>
                    setHoursPerSession(Number(event.target.value) || 1)
                  }
                  className="w-20 h-9 tabular text-center"
                  aria-label="Heures par séance"
                />
                <span className="text-[13px] text-[var(--fg-muted)]">
                  h à {formatCHF(hourlyRate)}/h
                </span>
              </div>
              <div className="flex items-center gap-3 ml-auto">
                <span className="text-lg font-semibold tabular">
                  {formatCHF(suggestion)}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setEstimatedPrice(formatCHF(suggestion, { showCurrency: false }))
                  }
                >
                  Utiliser
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-[var(--fg-subtle)] mt-3">
              Tarif horaire modifiable dans les réglages. Le montant saisi actuellement
              vaut {formatCHF(parseCHF(estimatedPrice))}.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="sticky-actions sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-3.5 glass border-t border-[var(--border)] flex items-center justify-end gap-2.5 z-20">
        <Button asChild variant="ghost" type="button">
          <Link href={project ? `/projets/${project.id}` : "/projets"}>Annuler</Link>
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          <Save />
          {project ? "Enregistrer" : "Créer le projet"}
        </Button>
      </div>
    </form>
  );
}
