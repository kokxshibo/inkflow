"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, ChevronDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/* ───────────────────────────── Label ───────────────────────────── */

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & { required?: boolean }
>(({ className, children, required, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-[13px] font-medium text-[var(--fg-muted)] leading-none select-none",
      className,
    )}
    {...props}
  >
    {children}
    {required && <span className="text-[var(--danger)] ml-0.5">*</span>}
  </LabelPrimitive.Root>
));
Label.displayName = "Label";

/* ───────────────────────────── Field ───────────────────────────── */

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-[var(--danger)] animate-fade-in">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[var(--fg-subtle)] leading-relaxed">{hint}</p>
      ) : null}
    </div>
  );
}

/* ───────────────────────────── Input ───────────────────────────── */

const inputBase = [
  "w-full bg-[var(--bg-subtle)] text-[var(--fg)] text-sm",
  "border border-[var(--border)] rounded-[var(--radius-sm)]",
  "placeholder:text-[var(--fg-subtle)]",
  "transition-[border-color,box-shadow,background-color] duration-200",
  "hover:border-[var(--border-strong)]",
  "focus:outline-none focus:border-[var(--accent)] focus:bg-[var(--surface)]",
  "focus:shadow-[0_0_0_3px_var(--accent-ring)]",
  "disabled:opacity-50 disabled:cursor-not-allowed",
  "aria-[invalid=true]:border-[var(--danger)]",
].join(" ");

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, suffix, ...props }, ref) => {
    if (icon || suffix) {
      return (
        <div className="relative flex items-center">
          {icon && (
            <span className="absolute left-3 text-[var(--fg-subtle)] pointer-events-none [&_svg]:size-4">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              inputBase,
              "h-10 px-3",
              icon && "pl-9",
              suffix && "pr-14",
              className,
            )}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 text-xs text-[var(--fg-subtle)] pointer-events-none tabular">
              {suffix}
            </span>
          )}
        </div>
      );
    }
    return (
      <input ref={ref} className={cn(inputBase, "h-10 px-3", className)} {...props} />
    );
  },
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 4, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={cn(inputBase, "px-3 py-2.5 resize-y min-h-[80px] leading-relaxed", className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

/* ───────────────────────── Select (natif) ───────────────────────── */

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, placeholder, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          inputBase,
          "h-10 pl-3 pr-9 appearance-none cursor-pointer",
          "[&>option]:bg-[var(--surface)] [&>option]:text-[var(--fg)]",
          className,
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-[var(--fg-subtle)] pointer-events-none" />
    </div>
  ),
);
Select.displayName = "Select";

/* ──────────────────────── Champ monétaire ──────────────────────── */

/**
 * Saisie d'un montant en CHF. La valeur DOM reste une chaîne libre
 * (« 1'250.50 »), la conversion en centimes se fait côté serveur via parseCHF.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <Input
      ref={ref}
      inputMode="decimal"
      placeholder="0.00"
      suffix="CHF"
      className={cn("tabular text-right pr-14", className)}
      {...props}
    />
  ),
);
MoneyInput.displayName = "MoneyInput";

/* ──────────────────────────── Checkbox ─────────────────────────── */

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer size-[18px] shrink-0 rounded-[5px] border border-[var(--border-strong)]",
      "bg-[var(--bg-subtle)] cursor-pointer",
      "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
      "hover:border-[var(--accent)]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
      "data-[state=checked]:bg-[var(--accent)] data-[state=checked]:border-[var(--accent)]",
      "data-[state=indeterminate]:bg-[var(--accent)] data-[state=indeterminate]:border-[var(--accent)]",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-[var(--accent-fg)] animate-scale-in">
      {props.checked === "indeterminate" ? (
        <Minus className="size-3 stroke-[3]" />
      ) : (
        <Check className="size-3 stroke-[3]" />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = "Checkbox";

/** Case à cocher + libellé, cliquable sur toute la ligne */
export function CheckboxField({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
  name,
  defaultChecked,
}: {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  name?: string;
  defaultChecked?: boolean;
}) {
  const [internal, setInternal] = React.useState(defaultChecked ?? false);
  const isControlled = checked !== undefined;
  const value = isControlled ? checked : internal;

  return (
    <div className="flex items-start gap-2.5">
      <Checkbox
        id={id}
        checked={value}
        onCheckedChange={(next) => {
          const bool = next === true;
          if (!isControlled) setInternal(bool);
          onCheckedChange?.(bool);
        }}
        className="mt-0.5"
      />
      {name && <input type="hidden" name={name} value={value ? "on" : ""} />}
      <div className="grid gap-0.5">
        <Label htmlFor={id} className="text-sm text-[var(--fg)] cursor-pointer">
          {label}
        </Label>
        {hint && <p className="text-xs text-[var(--fg-subtle)] leading-relaxed">{hint}</p>}
      </div>
    </div>
  );
}

/* ───────────────────────────── Switch ──────────────────────────── */

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-full",
      "border-2 border-transparent transition-colors duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-[var(--accent)] data-[state=unchecked]:bg-[var(--surface-hover)]",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block size-[18px] rounded-full bg-white shadow-lg ring-0",
        "transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        "data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";

/** Interrupteur avec libellé, pour les réglages */
export function SwitchField({
  id,
  name,
  label,
  hint,
  defaultChecked,
  checked,
  onCheckedChange,
}: {
  id: string;
  name?: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  defaultChecked?: boolean;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  const [internal, setInternal] = React.useState(defaultChecked ?? false);
  const isControlled = checked !== undefined;
  const value = isControlled ? checked : internal;

  return (
    <div className="flex items-center justify-between gap-6 py-1">
      <div className="grid gap-0.5">
        <Label htmlFor={id} className="text-sm text-[var(--fg)] cursor-pointer">
          {label}
        </Label>
        {hint && (
          <p className="text-xs text-[var(--fg-subtle)] leading-relaxed max-w-prose">{hint}</p>
        )}
      </div>
      {name && <input type="hidden" name={name} value={value ? "on" : ""} />}
      <Switch
        id={id}
        checked={value}
        onCheckedChange={(next) => {
          if (!isControlled) setInternal(next);
          onCheckedChange?.(next);
        }}
      />
    </div>
  );
}
