"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { AlertCircle, Save, Trash2, CheckCircle2, UserX } from "lucide-react";
import {
  saveAppointment,
  deleteAppointment,
  setAppointmentStatus,
  type AppointmentState,
} from "./actions";
import { APPOINTMENT_STATUS, APPOINTMENT_TYPE } from "@/lib/constants";
import { formatCHF } from "@/lib/money";
import { formatDuration, minutesBetween } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CheckboxField,
  Field,
  Input,
  MoneyInput,
  Select,
  Textarea,
} from "@/components/ui/field";
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

export interface AppointmentData {
  id?: string;
  clientId?: string;
  projectId?: string;
  title?: string;
  type?: string;
  status?: string;
  startAt: string;
  endAt: string;
  notes?: string;
  depositRequired?: number | null;
  depositPaid?: boolean;
}

const DURATIONS = [60, 90, 120, 180, 240, 300, 360];

export function AppointmentDialog({
  open,
  onOpenChange,
  appointment,
  clients,
  projects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentData | null;
  clients: { id: string; firstName: string; lastName: string }[];
  projects: { id: string; title: string; clientId: string }[];
}) {
  const [state, formAction, pending] = useActionState<AppointmentState, FormData>(
    saveAppointment,
    {},
  );
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [, startTransition] = React.useTransition();

  const [clientId, setClientId] = React.useState(appointment?.clientId ?? "");
  const [startAt, setStartAt] = React.useState(appointment?.startAt ?? "");
  const [endAt, setEndAt] = React.useState(appointment?.endAt ?? "");

  // Resynchronise quand on ouvre un autre rendez-vous
  React.useEffect(() => {
    setClientId(appointment?.clientId ?? "");
    setStartAt(appointment?.startAt ?? "");
    setEndAt(appointment?.endAt ?? "");
  }, [appointment]);

  // Ferme la fenêtre après un enregistrement réussi
  React.useEffect(() => {
    if (state.success) {
      toast.success(appointment?.id ? "Rendez-vous mis à jour" : "Rendez-vous créé");
      onOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const isEdit = Boolean(appointment?.id);
  const clientProjects = projects.filter((project) => project.clientId === clientId);
  const duration =
    startAt && endAt ? minutesBetween(new Date(startAt), new Date(endAt)) : 0;

  function setDuration(minutes: number) {
    if (!startAt) return;
    const end = new Date(new Date(startAt).getTime() + minutes * 60000);
    const offset = end.getTimezoneOffset();
    setEndAt(new Date(end.getTime() - offset * 60000).toISOString().slice(0, 16));
  }

  function quickStatus(status: string) {
    if (!appointment?.id) return;
    startTransition(async () => {
      await setAppointmentStatus(appointment.id!, status);
      toast.success(
        status === "no_show"
          ? "Marqué absent — le compteur du client a été incrémenté"
          : "Rendez-vous marqué comme effectué",
      );
      onOpenChange(false);
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}
            </DialogTitle>
            <DialogDescription>
              {duration > 0
                ? `Durée : ${formatDuration(duration)}`
                : "Choisis un créneau, un client et un type de séance."}
            </DialogDescription>
          </DialogHeader>

          <form action={formAction}>
            {appointment?.id && <input type="hidden" name="id" value={appointment.id} />}

            <DialogBody className="space-y-4">
              {state.error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 p-3 rounded-[var(--radius-sm)] bg-[var(--danger-soft)] border border-[var(--danger)]/25 animate-slide-up"
                >
                  <AlertCircle className="size-4 text-[var(--danger)] shrink-0 mt-px" />
                  <p className="text-[13px] text-[var(--danger)]">{state.error}</p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Client" htmlFor="clientId">
                  <Select
                    id="clientId"
                    name="clientId"
                    value={clientId}
                    onChange={(event) => setClientId(event.target.value)}
                    placeholder="Sans client (créneau bloqué)"
                    options={clients.map((client) => ({
                      value: client.id,
                      label: `${client.firstName} ${client.lastName}`,
                    }))}
                  />
                </Field>

                <Field
                  label="Projet"
                  htmlFor="projectId"
                  hint={
                    clientId && clientProjects.length === 0
                      ? "Ce client n'a pas encore de projet"
                      : undefined
                  }
                >
                  <Select
                    id="projectId"
                    name="projectId"
                    defaultValue={appointment?.projectId ?? ""}
                    placeholder="Aucun projet"
                    disabled={!clientId || clientProjects.length === 0}
                    options={clientProjects.map((project) => ({
                      value: project.id,
                      label: project.title,
                    }))}
                  />
                </Field>

                <Field label="Type" htmlFor="type">
                  <Select
                    id="type"
                    name="type"
                    defaultValue={appointment?.type ?? "session"}
                    options={APPOINTMENT_TYPE.map((o) => ({
                      value: o.value,
                      label: o.label,
                    }))}
                  />
                </Field>

                <Field label="Statut" htmlFor="status">
                  <Select
                    id="status"
                    name="status"
                    defaultValue={appointment?.status ?? "confirmed"}
                    options={APPOINTMENT_STATUS.map((o) => ({
                      value: o.value,
                      label: o.label,
                    }))}
                  />
                </Field>

                <Field label="Début" htmlFor="startAt" required>
                  <Input
                    id="startAt"
                    name="startAt"
                    type="datetime-local"
                    required
                    value={startAt}
                    onChange={(event) => setStartAt(event.target.value)}
                  />
                </Field>

                <Field label="Fin" htmlFor="endAt" required>
                  <Input
                    id="endAt"
                    name="endAt"
                    type="datetime-local"
                    required
                    value={endAt}
                    onChange={(event) => setEndAt(event.target.value)}
                  />
                </Field>
              </div>

              {/* Durées rapides */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-[var(--fg-subtle)] mr-1">
                  Durée rapide :
                </span>
                {DURATIONS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => setDuration(minutes)}
                    className={
                      "px-2.5 h-7 rounded-full text-[11px] font-medium border transition-colors " +
                      (duration === minutes
                        ? "bg-[var(--accent-soft)] border-[var(--accent)]/40 text-[var(--accent)]"
                        : "bg-[var(--bg-subtle)] border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--border-strong)]")
                    }
                  >
                    {formatDuration(minutes)}
                  </button>
                ))}
              </div>

              <Field
                label="Titre personnalisé"
                htmlFor="title"
                hint="Laisse vide pour utiliser le nom du client."
              >
                <Input
                  id="title"
                  name="title"
                  defaultValue={appointment?.title ?? ""}
                  placeholder="Ex. « Bloqué — formation »"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2 p-4 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border)]">
                <Field
                  label="Acompte demandé"
                  htmlFor="depositRequired"
                  hint="Tant qu'il n'est pas payé, garde le statut « Provisoire »."
                >
                  <MoneyInput
                    id="depositRequired"
                    name="depositRequired"
                    defaultValue={
                      appointment?.depositRequired
                        ? formatCHF(appointment.depositRequired, { showCurrency: false })
                        : ""
                    }
                  />
                </Field>
                <div className="flex items-end pb-2.5">
                  <CheckboxField
                    id="depositPaid"
                    name="depositPaid"
                    label="Acompte encaissé"
                    defaultChecked={appointment?.depositPaid}
                  />
                </div>
              </div>

              <Field label="Notes" htmlFor="notes">
                <Textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  defaultValue={appointment?.notes ?? ""}
                  placeholder="Apporter les références imprimées, prévoir une pause à mi-séance…"
                />
              </Field>
            </DialogBody>

            <DialogFooter className="justify-between sm:justify-between">
              <div className="flex items-center gap-1.5">
                {isEdit && (
                  <>
                    <Button
                      type="button"
                      variant="dangerGhost"
                      size="sm"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 />
                      <span className="hidden sm:inline">Supprimer</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => quickStatus("done")}
                    >
                      <CheckCircle2 />
                      <span className="hidden sm:inline">Effectué</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => quickStatus("no_show")}
                    >
                      <UserX />
                      <span className="hidden sm:inline">Absent</span>
                    </Button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" variant="primary" size="sm" loading={pending}>
                  <Save />
                  {isEdit ? "Enregistrer" : "Créer"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Supprimer ce rendez-vous ?"
        description="Le créneau sera libéré. Cette action est définitive."
        confirmLabel="Supprimer"
        destructive
        onConfirm={() => {
          if (!appointment?.id) return;
          startTransition(async () => {
            await deleteAppointment(appointment.id!);
            toast.success("Rendez-vous supprimé");
            setConfirmDelete(false);
            onOpenChange(false);
          });
        }}
      />
    </>
  );
}
