"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { BirthParts } from "@/lib/client-input";

/**
 * Date de naissance en trois cases JJ / MM / AAAA.
 *
 * Sur iPhone, le sélecteur natif oblige à faire défiler des décennies :
 * trois petits champs numériques sont bien plus rapides. Le curseur saute
 * seul d'une case à l'autre, et un collage « 18.04.1996 » remplit tout.
 */
export function BirthDateInput({
  id,
  value,
  onChange,
  onComplete,
  invalid,
}: {
  id?: string;
  value: BirthParts;
  /** Reçoit uniquement les parties modifiées, à fusionner avec la dernière valeur. */
  onChange: (patch: Partial<BirthParts>) => void;
  /** Appelé quand l'année est complète, pour passer au champ suivant */
  onComplete?: () => void;
  invalid?: boolean;
}) {
  const dayRef = React.useRef<HTMLInputElement>(null);
  const monthRef = React.useRef<HTMLInputElement>(null);
  const yearRef = React.useRef<HTMLInputElement>(null);

  const digits = (text: string, max: number) => text.replace(/\D/g, "").slice(0, max);

  /** Place le curseur sur la première case encore incomplète. */
  function focusNext(month: string, year: string) {
    if (year.length === 4) onComplete?.();
    else if (month.length === 2) yearRef.current?.focus();
    else monthRef.current?.focus();
  }

  function handleDay(text: string) {
    const all = digits(text, 8);
    // Plus de deux chiffres d'un coup (collage, dictée, clavier rapide, ou
    // simple poursuite de la frappe) : on répartit sur mois et année.
    if (all.length > 2) {
      const month = all.slice(2, 4);
      const year = all.slice(4, 8);
      onChange({ day: all.slice(0, 2), month, year });
      focusNext(month, year);
      return;
    }
    let day = all;
    // Un premier chiffre de 4 à 9 ne peut être qu'un jour à un chiffre.
    if (day.length === 1 && Number(day) > 3) day = `0${day}`;
    onChange({ day });
    if (day.length === 2) monthRef.current?.focus();
  }

  function handleMonth(text: string) {
    const all = digits(text, 6);
    if (all.length > 2) {
      const year = all.slice(2, 6);
      onChange({ month: all.slice(0, 2), year });
      if (year.length === 4) onComplete?.();
      else yearRef.current?.focus();
      return;
    }
    let month = all;
    if (month.length === 1 && Number(month) > 1) month = `0${month}`;
    onChange({ month });
    if (month.length === 2) yearRef.current?.focus();
  }

  function handleYear(text: string) {
    const year = digits(text, 4);
    onChange({ year });
    if (year.length === 4) onComplete?.();
  }

  /** « 96 » → « 1996 », « 05 » → « 2005 » à la sortie du champ. */
  function expandYear() {
    if (value.year.length !== 2) return;
    const short = Number(value.year);
    const currentShort = new Date().getFullYear() % 100;
    const century = short > currentShort ? 1900 : 2000;
    onChange({ year: String(century + short) });
  }

  function padOnBlur(field: "day" | "month") {
    const current = value[field];
    if (current.length === 1 && current !== "0") {
      onChange({ [field]: `0${current}` });
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text");
    const match = text.match(/(\d{1,2})\D+(\d{1,2})\D+(\d{2,4})/);
    if (!match) return;
    event.preventDefault();
    onChange({
      day: match[1].padStart(2, "0"),
      month: match[2].padStart(2, "0"),
      year: match[3],
    });
    yearRef.current?.focus();
  }

  function backspaceTo(
    event: React.KeyboardEvent<HTMLInputElement>,
    current: string,
    previous: React.RefObject<HTMLInputElement | null>,
  ) {
    if (event.key === "Backspace" && current === "") {
      event.preventDefault();
      previous.current?.focus();
    }
  }

  const cell = cn(
    // Le cadre commun porte déjà l'anneau de focus : pas de contour par case.
    "bg-transparent text-center tabular text-[15px] text-[var(--fg)] outline-none focus:outline-none",
    "placeholder:text-[var(--fg-subtle)] h-full",
  );

  return (
    <div
      className={cn(
        "flex items-center h-12 px-3 rounded-[var(--radius-sm)] border bg-[var(--bg-subtle)]",
        "transition-[border-color,box-shadow,background-color] duration-200",
        "focus-within:border-[var(--accent)] focus-within:bg-[var(--surface)]",
        "focus-within:shadow-[0_0_0_3px_var(--accent-ring)]",
        invalid
          ? "border-[var(--danger)]"
          : "border-[var(--border)] hover:border-[var(--border-strong)]",
      )}
    >
      <input
        ref={dayRef}
        id={id}
        value={value.day}
        onChange={(event) => handleDay(event.target.value)}
        onBlur={() => padOnBlur("day")}
        onPaste={handlePaste}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        enterKeyHint="next"
        placeholder="JJ"
        aria-label="Jour de naissance"
        aria-invalid={invalid || undefined}
        className={cn(cell, "w-9")}
      />
      <span className="text-[var(--fg-subtle)] px-1" aria-hidden>
        /
      </span>
      <input
        ref={monthRef}
        value={value.month}
        onChange={(event) => handleMonth(event.target.value)}
        onBlur={() => padOnBlur("month")}
        onKeyDown={(event) => backspaceTo(event, value.month, dayRef)}
        onPaste={handlePaste}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        enterKeyHint="next"
        placeholder="MM"
        aria-label="Mois de naissance"
        aria-invalid={invalid || undefined}
        className={cn(cell, "w-9")}
      />
      <span className="text-[var(--fg-subtle)] px-1" aria-hidden>
        /
      </span>
      <input
        ref={yearRef}
        value={value.year}
        onChange={(event) => handleYear(event.target.value)}
        onBlur={expandYear}
        onKeyDown={(event) => backspaceTo(event, value.year, monthRef)}
        onPaste={handlePaste}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        enterKeyHint="next"
        placeholder="AAAA"
        aria-label="Année de naissance"
        aria-invalid={invalid || undefined}
        className={cn(cell, "w-14")}
      />
    </div>
  );
}
