"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PHONE_COUNTRIES,
  PHONE_OTHER,
  findPhoneCountry,
  formatNationalPhone,
} from "@/lib/client-input";

/**
 * Téléphone avec indicatif pays.
 *
 * L'indicatif lève l'ambiguïté des numéros nationaux : « 06… » n'a pas le
 * même sens en Suisse et en France, ce qui compte à Genève ou à Bâle.
 * La liste d'indicatifs est un <select> natif invisible posé sur l'étiquette,
 * ce qui ouvre la roue de sélection d'iOS au toucher.
 */
export const PhoneInput = React.forwardRef<
  HTMLInputElement,
  {
    id?: string;
    country: string;
    local: string;
    onCountryChange: (country: string) => void;
    onLocalChange: (local: string) => void;
    invalid?: boolean;
    enterKeyHint?: React.InputHTMLAttributes<HTMLInputElement>["enterKeyHint"];
  }
>(function PhoneInput(
  { id, country, local, onCountryChange, onLocalChange, invalid, enterKeyHint },
  ref,
) {
  const current = findPhoneCountry(country);

  const border = invalid
    ? "border-[var(--danger)]"
    : "border-[var(--border)] hover:border-[var(--border-strong)]";

  return (
    <div className="flex gap-2">
      <div className="relative shrink-0">
        <select
          value={country}
          onChange={(event) => onCountryChange(event.target.value)}
          aria-label="Indicatif du pays"
          className="peer absolute inset-0 z-10 w-full opacity-0 cursor-pointer"
        >
          {PHONE_COUNTRIES.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label} (+{option.dial})
            </option>
          ))}
          <option value={PHONE_OTHER}>Autre pays</option>
        </select>
        <span
          className={cn(
            "flex items-center gap-1.5 h-12 pl-3 pr-2.5 rounded-[var(--radius-sm)] border",
            "bg-[var(--bg-subtle)] text-[14px] font-medium tabular text-[var(--fg)]",
            "transition-[border-color,box-shadow] duration-200",
            "peer-focus-visible:border-[var(--accent)] peer-focus-visible:shadow-[0_0_0_3px_var(--accent-ring)]",
            border,
          )}
          aria-hidden
        >
          {current ? `+${current.dial}` : "Autre"}
          <ChevronDown className="size-3.5 text-[var(--fg-subtle)]" />
        </span>
      </div>

      <input
        ref={ref}
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        enterKeyHint={enterKeyHint}
        value={local}
        onChange={(event) => onLocalChange(event.target.value)}
        onBlur={() => onLocalChange(formatNationalPhone(country, local))}
        placeholder={current?.placeholder ?? "+44 20 7946 0958"}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex-1 min-w-0 h-12 px-3 rounded-[var(--radius-sm)] border bg-[var(--bg-subtle)]",
          "text-[15px] tabular text-[var(--fg)] placeholder:text-[var(--fg-subtle)]",
          "transition-[border-color,box-shadow,background-color] duration-200",
          "focus:outline-none focus:border-[var(--accent)] focus:bg-[var(--surface)]",
          "focus:shadow-[0_0_0_3px_var(--accent-ring)]",
          border,
        )}
      />
    </div>
  );
});
