"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PERIOD_KINDS, PERIOD_LABELS, type PeriodKind } from "@/lib/periods";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";

export interface PeriodPickerProps {
  kind: PeriodKind;
  label: string;
  /** Adresse de chaque type de période (les autres filtres sont conservés) */
  kindHrefs: Record<PeriodKind, string>;
  previousHref: string | null;
  nextHref: string | null;
  todayHref: string;
  /** Dates choisies : adresse de base à compléter par du / au */
  customBase: string;
  from: string;
  to: string;
}

/** Choix de la période suivie : semaine, mois, trimestre, année, tout ou dates. */
export function PeriodPicker({
  kind,
  label,
  kindHrefs,
  previousHref,
  nextHref,
  todayHref,
  customBase,
  from,
  to,
}: PeriodPickerProps) {
  const router = useRouter();
  const [range, setRange] = React.useState({ from, to });

  React.useEffect(() => setRange({ from, to }), [from, to]);

  function applyRange(event: React.FormEvent) {
    event.preventDefault();
    if (!range.from || !range.to) return;
    const separator = customBase.includes("?") ? "&" : "?";
    router.push(`${customBase}${separator}du=${range.from}&au=${range.to}`, { scroll: false });
  }

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <nav
          aria-label="Type de période"
          className="inline-flex max-w-full overflow-x-auto p-1 gap-1 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border)]"
        >
          {PERIOD_KINDS.map((option) => (
            <Link
              key={option}
              href={kindHrefs[option]}
              scroll={false}
              aria-current={option === kind ? "page" : undefined}
              className={cn(
                "inline-flex items-center h-8 px-3 rounded-[var(--radius-sm)] text-[13px] font-medium whitespace-nowrap transition-colors",
                option === kind
                  ? "bg-[var(--surface)] text-[var(--fg)] shadow-[var(--shadow-sm)]"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg)]",
              )}
            >
              {PERIOD_LABELS[option]}
            </Link>
          ))}
        </nav>

        {kind !== "perso" && kind !== "tout" && (
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="icon" aria-label="Période précédente">
              <Link href={previousHref ?? "#"} scroll={false}>
                <ChevronLeft />
              </Link>
            </Button>
            <span className="min-w-[10rem] text-center text-[14px] font-semibold">{label}</span>
            <Button asChild variant="ghost" size="icon" aria-label="Période suivante">
              <Link href={nextHref ?? "#"} scroll={false}>
                <ChevronRight />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="xs" className="ml-1">
              <Link href={todayHref} scroll={false}>
                Aujourd&apos;hui
              </Link>
            </Button>
          </div>
        )}
        {kind === "tout" && <span className="text-[14px] font-semibold">{label}</span>}
      </div>

      {kind === "perso" && (
        <form onSubmit={applyRange} className="flex flex-wrap items-end gap-2.5">
          <label className="flex flex-col gap-1 text-[12px] text-[var(--fg-muted)]">
            Du
            <DateInput
              value={range.from}
              onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))}
              className="w-44"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-[var(--fg-muted)]">
            Au
            <DateInput
              value={range.to}
              min={range.from || undefined}
              onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))}
              className="w-44"
              required
            />
          </label>
          <Button type="submit" variant="primary" size="md">
            Afficher
          </Button>
        </form>
      )}
    </div>
  );
}
