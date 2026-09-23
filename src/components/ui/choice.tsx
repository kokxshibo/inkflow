"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
}

/**
 * Choix unique sous forme de grandes cases à toucher.
 * Plus rapide qu'une liste déroulante au pouce, et navigable aux flèches.
 */
export function ChoiceGroup<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
  ariaLabel,
  invalid,
  id,
}: {
  options: ChoiceOption<T>[];
  value: T | "";
  onChange: (value: T) => void;
  columns?: 1 | 2 | 3;
  ariaLabel: string;
  invalid?: boolean;
  id?: string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    const next = (index + step + options.length) % options.length;
    refs.current[next]?.focus();
    onChange(options[next].value);
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      className={cn(
        "grid gap-2",
        columns === 1 && "grid-cols-1",
        columns === 2 && "grid-cols-1 min-[340px]:grid-cols-2",
        columns === 3 && "grid-cols-3",
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        // Un seul élément du groupe est atteignable à la tabulation.
        const tabbable = selectedIndex === -1 ? index === 0 : selected;
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={tabbable ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "group relative flex items-center gap-3 min-h-12 px-3.5 py-2.5 text-left",
              "rounded-[var(--radius-md)] border transition-all duration-200",
              "active:scale-[0.985] focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
              selected
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : cn(
                    "bg-[var(--bg-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--surface)]",
                    invalid ? "border-[var(--danger)]/50" : "border-[var(--border)]",
                  ),
            )}
          >
            {option.icon && (
              <span
                className={cn(
                  "shrink-0 [&_svg]:size-[18px] transition-colors",
                  selected ? "text-[var(--accent)]" : "text-[var(--fg-subtle)]",
                )}
              >
                {option.icon}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium text-[var(--fg)] leading-snug">
                {option.label}
              </span>
              {option.hint && (
                <span className="block text-[12px] text-[var(--fg-subtle)] mt-0.5 leading-snug">
                  {option.hint}
                </span>
              )}
            </span>
            <span
              className={cn(
                "grid place-items-center size-5 shrink-0 rounded-full border transition-all duration-200",
                selected
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)] scale-100"
                  : "border-[var(--border-strong)] scale-90",
              )}
              aria-hidden
            >
              {selected && <Check className="size-3 stroke-[3]" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Question fermée : Oui / Non, sans réponse par défaut. */
export function YesNo({
  value,
  onChange,
  ariaLabel,
  yesLabel = "Oui",
  noLabel = "Non",
  yesHint,
  noHint,
  invalid,
  id,
}: {
  value: boolean | null;
  onChange: (value: boolean) => void;
  ariaLabel: string;
  yesLabel?: string;
  noLabel?: string;
  yesHint?: string;
  noHint?: string;
  invalid?: boolean;
  id?: string;
}) {
  return (
    <ChoiceGroup
      id={id}
      ariaLabel={ariaLabel}
      invalid={invalid}
      // Une réponse par ligne : les libellés sont des phrases, pas des mots.
      columns={1}
      value={value === null ? "" : value ? "yes" : "no"}
      onChange={(next) => onChange(next === "yes")}
      options={[
        { value: "yes", label: yesLabel, hint: yesHint, icon: <Check /> },
        { value: "no", label: noLabel, hint: noHint, icon: <X /> },
      ]}
    />
  );
}

/** Case à cocher sous forme de pastille, pour les choix multiples. */
export function ToggleChip({
  pressed,
  onToggle,
  children,
}: {
  pressed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2.5 min-h-11 px-3 py-2 text-left rounded-[var(--radius-md)] border",
        "text-[13px] font-medium transition-all duration-200 active:scale-[0.985]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
        pressed
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--fg)]"
          : "border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--fg-muted)] hover:border-[var(--border-strong)]",
      )}
    >
      <span
        className={cn(
          "grid place-items-center size-[18px] shrink-0 rounded-[5px] border transition-colors",
          pressed
            ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]"
            : "border-[var(--border-strong)]",
        )}
        aria-hidden
      >
        {pressed && <Check className="size-3 stroke-[3]" />}
      </span>
      <span className="min-w-0">{children}</span>
    </button>
  );
}
