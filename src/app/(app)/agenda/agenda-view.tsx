"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  CalendarRange,
  List,
  CircleDot,
} from "lucide-react";
import {
  addDays,
  cn,
  formatDate,
  formatDuration,
  formatTime,
  isSameDay,
  minutesBetween,
  startOfDay,
  startOfWeek,
  toDateTimeLocal,
} from "@/lib/utils";
import { APPOINTMENT_STATUS, APPOINTMENT_TYPE, labelOf } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState, PageHeader, Tooltip } from "@/components/ui/misc";
import { AppointmentDialog, type AppointmentData } from "./appointment-dialog";

export interface AgendaAppointment {
  id: string;
  title: string;
  type: string;
  status: string;
  startAt: string;
  endAt: string;
  notes: string | null;
  depositRequired: number | null;
  depositPaid: boolean;
  clientId: string | null;
  projectId: string | null;
  clientName: string | null;
  projectTitle: string | null;
}

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 22;
const HOUR_HEIGHT = 56;
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/** Couleur de l'événement selon son type */
const TYPE_STYLES: Record<string, string> = {
  consultation: "bg-[var(--info-soft)] border-[var(--info)]/40 text-[var(--info)]",
  session: "bg-[var(--accent-soft)] border-[var(--accent)]/40 text-[var(--accent)]",
  touchup: "bg-[var(--warning-soft)] border-[var(--warning)]/40 text-[var(--warning)]",
  stencil: "bg-[var(--surface-2)] border-[var(--border-strong)] text-[var(--fg-muted)]",
  blocked:
    "bg-[var(--surface-2)] border-[var(--border-strong)] text-[var(--fg-subtle)] [background-image:repeating-linear-gradient(45deg,transparent,transparent_5px,var(--border)_5px,var(--border)_10px)]",
  other: "bg-[var(--surface-2)] border-[var(--border-strong)] text-[var(--fg-muted)]",
};

export function AgendaView({
  weekStart,
  appointments,
  clients,
  projects,
  openNew,
  presetClientId,
  presetProjectId,
}: {
  weekStart: string;
  appointments: AgendaAppointment[];
  clients: { id: string; firstName: string; lastName: string }[];
  projects: { id: string; title: string; clientId: string }[];
  openNew?: boolean;
  presetClientId?: string;
  presetProjectId?: string;
}) {
  const router = useRouter();
  const [view, setView] = React.useState<"week" | "day" | "list">("week");
  const [cursor, setCursor] = React.useState(() => new Date(weekStart));
  const [selectedDay, setSelectedDay] = React.useState(() => startOfDay(new Date()));
  const [dialogOpen, setDialogOpen] = React.useState(Boolean(openNew));
  const [editing, setEditing] = React.useState<AppointmentData | null>(
    openNew
      ? {
          clientId: presetClientId ?? "",
          projectId: presetProjectId ?? "",
          startAt: toDateTimeLocal(defaultStart()),
          endAt: toDateTimeLocal(new Date(defaultStart().getTime() + 3 * 3600_000)),
        }
      : null,
  );

  // Sur petit écran, la vue jour est plus lisible
  React.useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) setView("day");
  }, []);

  const weekDays = React.useMemo(() => {
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [cursor]);

  function navigate(direction: -1 | 0 | 1) {
    if (direction === 0) {
      const today = new Date();
      setCursor(today);
      setSelectedDay(startOfDay(today));
      return;
    }
    if (view === "day") {
      const next = addDays(selectedDay, direction);
      setSelectedDay(next);
      setCursor(next);
    } else {
      setCursor((current) => addDays(current, direction * 7));
    }
  }

  function openCreate(at?: Date) {
    const start = at ?? defaultStart();
    setEditing({
      clientId: presetClientId ?? "",
      projectId: presetProjectId ?? "",
      startAt: toDateTimeLocal(start),
      endAt: toDateTimeLocal(new Date(start.getTime() + 3 * 3600_000)),
    });
    setDialogOpen(true);
  }

  function openEdit(appointment: AgendaAppointment) {
    setEditing({
      id: appointment.id,
      clientId: appointment.clientId ?? "",
      projectId: appointment.projectId ?? "",
      title: appointment.title,
      type: appointment.type,
      status: appointment.status,
      startAt: toDateTimeLocal(appointment.startAt),
      endAt: toDateTimeLocal(appointment.endAt),
      notes: appointment.notes ?? "",
      depositRequired: appointment.depositRequired,
      depositPaid: appointment.depositPaid,
    });
    setDialogOpen(true);
  }

  const visibleAppointments = appointments.filter((a) => a.status !== "cancelled");

  const rangeLabel =
    view === "day"
      ? formatDate(selectedDay)
      : `${formatDate(weekDays[0])} — ${formatDate(weekDays[6])}`;

  return (
    <>
      <PageHeader
        title="Agenda"
        description={rangeLabel}
        actions={
          <Button variant="primary" size="sm" onClick={() => openCreate()}>
            <Plus />
            <span className="hidden sm:inline">Rendez-vous</span>
          </Button>
        }
      />

      {/* Barre de navigation */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex items-center gap-1 p-1 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border)]">
          <Button variant="ghost" size="iconSm" onClick={() => navigate(-1)} aria-label="Précédent">
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate(0)}>
            Aujourd&apos;hui
          </Button>
          <Button variant="ghost" size="iconSm" onClick={() => navigate(1)} aria-label="Suivant">
            <ChevronRight />
          </Button>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border)] ml-auto">
          {(
            [
              { key: "day", label: "Jour", icon: CalendarDays },
              { key: "week", label: "Semaine", icon: CalendarRange },
              { key: "list", label: "Liste", icon: List },
            ] as const
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setView(option.key)}
              className={cn(
                "relative flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)]",
                "text-[13px] font-medium transition-colors duration-200",
                view === option.key
                  ? "text-[var(--fg)]"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg)]",
              )}
            >
              {view === option.key && (
                <motion.span
                  layoutId="agenda-view"
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 rounded-[var(--radius-sm)] bg-[var(--surface)] shadow-[var(--shadow-sm)]"
                />
              )}
              <option.icon className="relative size-3.5" />
              <span className="relative hidden sm:inline">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─────────── Vue semaine ─────────── */}
      {view === "week" && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[820px]">
              {/* En-tête des jours */}
              <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-[var(--border)] sticky top-14 bg-[var(--surface)] z-10">
                <div />
                {weekDays.map((day, index) => {
                  const today = isSameDay(day, new Date());
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => {
                        setSelectedDay(startOfDay(day));
                        setView("day");
                      }}
                      className={cn(
                        "flex flex-col items-center py-2.5 border-l border-[var(--border)]",
                        "transition-colors hover:bg-[var(--surface-2)]",
                      )}
                    >
                      <span className="text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">
                        {WEEKDAYS[index]}
                      </span>
                      <span
                        className={cn(
                          "grid place-items-center size-7 rounded-full mt-1 text-[13px] font-semibold tabular",
                          today
                            ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                            : "text-[var(--fg)]",
                        )}
                      >
                        {day.getDate()}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Grille horaire */}
              <div className="relative grid grid-cols-[56px_repeat(7,1fr)] pt-2.5">
                {/* Colonne des heures */}
                <div>
                  {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => (
                    <div
                      key={i}
                      style={{ height: HOUR_HEIGHT }}
                      className="relative border-b border-[var(--border)]"
                    >
                      <span className="absolute -top-2 right-2 text-[10px] text-[var(--fg-subtle)] tabular">
                        {String(DAY_START_HOUR + i).padStart(2, "0")}:00
                      </span>
                    </div>
                  ))}
                </div>

                {/* Colonnes des jours */}
                {weekDays.map((day) => (
                  <DayColumn
                    key={day.toISOString()}
                    day={day}
                    appointments={visibleAppointments}
                    onCreate={openCreate}
                    onEdit={openEdit}
                  />
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ─────────── Vue jour ─────────── */}
      {view === "day" && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <div>
              <p className="text-sm font-semibold capitalize">
                {new Intl.DateTimeFormat("fr-CH", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }).format(selectedDay)}
              </p>
              <p className="text-[11px] text-[var(--fg-subtle)] mt-0.5">
                {
                  visibleAppointments.filter((a) =>
                    isSameDay(new Date(a.startAt), selectedDay),
                  ).length
                }{" "}
                rendez-vous
              </p>
            </div>
            {isSameDay(selectedDay, new Date()) && (
              <span className="flex items-center gap-1.5 text-[11px] text-[var(--accent)]">
                <CircleDot className="size-3" />
                Aujourd&apos;hui
              </span>
            )}
          </div>

          <div className="relative grid grid-cols-[56px_1fr] pt-2.5">
            <div>
              {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => (
                <div
                  key={i}
                  style={{ height: HOUR_HEIGHT }}
                  className="relative border-b border-[var(--border)]"
                >
                  <span className="absolute -top-2 right-2 text-[10px] text-[var(--fg-subtle)] tabular">
                    {String(DAY_START_HOUR + i).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>
            <DayColumn
              day={selectedDay}
              appointments={visibleAppointments}
              onCreate={openCreate}
              onEdit={openEdit}
              wide
            />
          </div>
        </Card>
      )}

      {/* ─────────── Vue liste ─────────── */}
      {view === "list" && (
        <ListView appointments={appointments} onEdit={openEdit} onCreate={() => openCreate()} />
      )}

      <AppointmentDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditing(null);
            if (openNew) router.replace("/agenda");
          }
        }}
        appointment={editing}
        clients={clients}
        projects={projects}
      />
    </>
  );
}

/* ──────────────────────── Colonne d'un jour ──────────────────────── */

function DayColumn({
  day,
  appointments,
  onCreate,
  onEdit,
  wide,
}: {
  day: Date;
  appointments: AgendaAppointment[];
  onCreate: (at: Date) => void;
  onEdit: (appointment: AgendaAppointment) => void;
  wide?: boolean;
}) {
  const dayAppointments = appointments.filter((appointment) =>
    isSameDay(new Date(appointment.startAt), day),
  );
  const laidOut = layoutAppointments(dayAppointments);
  const today = isSameDay(day, new Date());
  const nowOffset = today ? minutesSinceStart(new Date()) : null;

  return (
    <div className="relative border-l border-[var(--border)]">
      {/* Cases horaires cliquables */}
      {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, index) => {
        const hour = DAY_START_HOUR + index;
        return (
          <button
            key={hour}
            type="button"
            onClick={() => {
              const at = new Date(day);
              at.setHours(hour, 0, 0, 0);
              onCreate(at);
            }}
            style={{ height: HOUR_HEIGHT }}
            className="w-full border-b border-[var(--border)] transition-colors hover:bg-[var(--surface-2)] group"
            aria-label={`Créer un rendez-vous à ${hour}:00`}
          >
            <Plus className="size-3.5 mx-auto text-[var(--fg-subtle)] opacity-0 group-hover:opacity-60 transition-opacity" />
          </button>
        );
      })}

      {/* Trait de l'heure actuelle */}
      {nowOffset !== null && nowOffset >= 0 && (
        <div
          className="absolute left-0 right-0 z-20 pointer-events-none"
          style={{ top: (nowOffset / 60) * HOUR_HEIGHT }}
        >
          <div className="relative h-px bg-[var(--danger)]">
            <span className="absolute -left-1 -top-[3px] size-[7px] rounded-full bg-[var(--danger)]" />
          </div>
        </div>
      )}

      {/* Rendez-vous */}
      <AnimatePresence>
        {laidOut.map(({ appointment, column, columns }) => {
          const start = new Date(appointment.startAt);
          const end = new Date(appointment.endAt);
          const top = (minutesSinceStart(start) / 60) * HOUR_HEIGHT;
          const height = Math.max(
            22,
            (minutesBetween(start, end) / 60) * HOUR_HEIGHT - 2,
          );
          const width = 100 / columns;

          return (
            <motion.button
              key={appointment.id}
              type="button"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              onClick={() => onEdit(appointment)}
              style={{
                top,
                height,
                left: `calc(${column * width}% + 2px)`,
                width: `calc(${width}% - 4px)`,
              }}
              className={cn(
                "absolute z-10 rounded-[var(--radius-sm)] border px-1.5 py-1 text-left overflow-hidden",
                "transition-all duration-200 hover:z-20 hover:shadow-[var(--shadow-md)] hover:-translate-y-px",
                TYPE_STYLES[appointment.type] ?? TYPE_STYLES.other,
                appointment.status === "draft" && "border-dashed",
                appointment.status === "done" && "opacity-60",
              )}
            >
              <p className="text-[10px] font-semibold tabular leading-tight opacity-80">
                {formatTime(start)}
              </p>
              <p
                className={cn(
                  "text-[11px] font-medium text-[var(--fg)] leading-tight truncate",
                  wide && "text-[13px]",
                )}
              >
                {appointment.clientName ?? appointment.title}
              </p>
              {height > 48 && (
                <p className="text-[10px] opacity-75 truncate mt-0.5">
                  {appointment.projectTitle ?? labelOf(APPOINTMENT_TYPE, appointment.type)}
                </p>
              )}
              {appointment.status === "draft" && height > 66 && (
                <p className="text-[9px] mt-0.5 opacity-90">Acompte en attente</p>
              )}
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ──────────────────────────── Vue liste ──────────────────────────── */

function ListView({
  appointments,
  onEdit,
  onCreate,
}: {
  appointments: AgendaAppointment[];
  onEdit: (appointment: AgendaAppointment) => void;
  onCreate: () => void;
}) {
  const upcoming = appointments
    .filter((a) => new Date(a.endAt) >= new Date())
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  if (upcoming.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays />}
        title="Aucun rendez-vous à venir"
        description="Les rendez-vous des deux prochaines semaines apparaissent ici."
        action={
          <Button variant="primary" size="sm" onClick={onCreate}>
            <Plus />
            Planifier un rendez-vous
          </Button>
        }
      />
    );
  }

  // Regroupement par jour
  const groups = new Map<string, AgendaAppointment[]>();
  for (const appointment of upcoming) {
    const key = startOfDay(new Date(appointment.startAt)).toISOString();
    groups.set(key, [...(groups.get(key) ?? []), appointment]);
  }

  return (
    <div className="space-y-5 stagger">
      {Array.from(groups.entries()).map(([key, items]) => {
        const day = new Date(key);
        const today = isSameDay(day, new Date());
        return (
          <div key={key}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)] mb-2 flex items-center gap-2">
              {new Intl.DateTimeFormat("fr-CH", {
                weekday: "long",
                day: "numeric",
                month: "long",
              }).format(day)}
              {today && (
                <span className="text-[var(--accent)] normal-case tracking-normal">
                  · aujourd&apos;hui
                </span>
              )}
            </p>
            <Card>
              <ul className="divide-y divide-[var(--border)]">
                {items.map((appointment) => (
                  <li key={appointment.id}>
                    <button
                      type="button"
                      onClick={() => onEdit(appointment)}
                      className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-[var(--surface-2)] transition-colors"
                    >
                      <div className="flex flex-col items-center shrink-0 w-14">
                        <span className="text-sm font-semibold tabular">
                          {formatTime(appointment.startAt)}
                        </span>
                        <span className="text-[10px] text-[var(--fg-subtle)]">
                          {formatDuration(
                            minutesBetween(appointment.startAt, appointment.endAt),
                          )}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "w-1 self-stretch rounded-full shrink-0",
                          appointment.type === "session"
                            ? "bg-[var(--accent)]"
                            : appointment.type === "consultation"
                              ? "bg-[var(--info)]"
                              : appointment.type === "touchup"
                                ? "bg-[var(--warning)]"
                                : "bg-[var(--border-strong)]",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium truncate">
                          {appointment.clientName ?? appointment.title}
                        </p>
                        <p className="text-[11px] text-[var(--fg-subtle)] truncate mt-0.5">
                          {labelOf(APPOINTMENT_TYPE, appointment.type)}
                          {appointment.projectTitle && ` · ${appointment.projectTitle}`}
                        </p>
                      </div>
                      <StatusBadge options={APPOINTMENT_STATUS} value={appointment.status} />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────── Utilitaires ─────────────────────────── */

function defaultStart() {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(Math.max(DAY_START_HOUR, Math.min(date.getHours() + 1, DAY_END_HOUR - 3)));
  return date;
}

function minutesSinceStart(date: Date) {
  return (date.getHours() - DAY_START_HOUR) * 60 + date.getMinutes();
}

/**
 * Répartit les rendez-vous qui se chevauchent en colonnes côte à côte.
 * Algorithme simple : on assigne chaque rendez-vous à la première colonne libre.
 */
function layoutAppointments(appointments: AgendaAppointment[]) {
  const sorted = [...appointments].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const columnEnds: number[] = [];
  const assignments: { appointment: AgendaAppointment; column: number }[] = [];

  for (const appointment of sorted) {
    const start = new Date(appointment.startAt).getTime();
    const end = new Date(appointment.endAt).getTime();

    let column = columnEnds.findIndex((columnEnd) => columnEnd <= start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(end);
    } else {
      columnEnds[column] = end;
    }
    assignments.push({ appointment, column });
  }

  const columns = Math.max(1, columnEnds.length);
  return assignments.map((assignment) => ({ ...assignment, columns }));
}
