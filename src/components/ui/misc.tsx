"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "@/lib/utils";

/* ──────────────────────────── Skeleton ─────────────────────────── */

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton rounded-[var(--radius-sm)]", className)}
      aria-hidden
      {...props}
    />
  );
}

/* ───────────────────────────── Avatar ──────────────────────────── */

export function Avatar({
  initials,
  src,
  size = "md",
  className,
}: {
  initials: string;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    xs: "size-6 text-[10px]",
    sm: "size-8 text-xs",
    md: "size-10 text-sm",
    lg: "size-14 text-lg",
  }[size];

  return (
    <span
      className={cn(
        "relative grid place-items-center shrink-0 rounded-full overflow-hidden select-none",
        "bg-gradient-to-br from-[var(--surface-2)] to-[var(--surface-hover)]",
        "border border-[var(--border)] font-semibold text-[var(--fg-muted)]",
        sizes,
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

/* ──────────────────────────── Separator ────────────────────────── */

export const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      "shrink-0 bg-[var(--border)]",
      orientation === "horizontal" ? "h-px w-full" : "w-px h-full",
      className,
    )}
    {...props}
  />
));
Separator.displayName = "Separator";

/* ──────────────────────────── Tooltip ──────────────────────────── */

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({
  content,
  children,
  side = "top",
  delay = 250,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  delay?: number;
}) {
  if (!content) return <>{children}</>;
  return (
    <TooltipPrimitive.Root delayDuration={delay}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-[80] max-w-xs rounded-[var(--radius-sm)] px-2.5 py-1.5",
            "bg-[var(--surface-2)] border border-[var(--border-strong)]",
            "text-xs text-[var(--fg)] shadow-[var(--shadow-lg)]",
            "animate-scale-in origin-[var(--radix-tooltip-content-transform-origin)]",
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/* ────────────────────────────── Tabs ───────────────────────────── */

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex items-center gap-1 p-1 rounded-[var(--radius-md)]",
      "bg-[var(--bg-subtle)] border border-[var(--border)]",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center gap-1.5 px-3 h-8 rounded-[var(--radius-sm)]",
      "text-[13px] font-medium text-[var(--fg-muted)] whitespace-nowrap",
      "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
      "hover:text-[var(--fg)]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
      "data-[state=active]:bg-[var(--surface)] data-[state=active]:text-[var(--fg)]",
      "data-[state=active]:shadow-[var(--shadow-sm)]",
      "[&_svg]:size-4",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("mt-5 focus-visible:outline-none animate-fade-in", className)}
    {...props}
  />
));
TabsContent.displayName = "TabsContent";

/* ───────────────────────────── État vide ───────────────────────── */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        "py-16 px-6 rounded-[var(--radius-lg)]",
        "border border-dashed border-[var(--border-strong)]",
        "animate-fade-in",
        className,
      )}
    >
      {icon && (
        <div className="grid place-items-center size-12 rounded-full bg-[var(--surface-2)] text-[var(--fg-subtle)] mb-4 [&_svg]:size-5">
          {icon}
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-[var(--fg)]">{title}</h3>
      {description && (
        <p className="text-[13px] text-[var(--fg-muted)] mt-1.5 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ──────────────────────── Barre de progression ─────────────────── */

export function Progress({
  value,
  max = 100,
  tone = "accent",
  className,
}: {
  value: number;
  max?: number;
  tone?: "accent" | "success" | "warning" | "danger";
  className?: string;
}) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  const colors = {
    accent: "bg-[var(--accent)]",
    success: "bg-[var(--success)]",
    warning: "bg-[var(--warning)]",
    danger: "bg-[var(--danger)]",
  }[tone];

  return (
    <div
      className={cn(
        "h-1.5 w-full rounded-full bg-[var(--surface-2)] overflow-hidden",
        className,
      )}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
          colors,
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/* ─────────────────────── En-tête de page ───────────────────────── */

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6",
        className,
      )}
    >
      <div className="min-w-0">
        {breadcrumb && <div className="mb-2">{breadcrumb}</div>}
        <h1 className="text-[22px] sm:text-2xl font-semibold tracking-[-0.02em] text-[var(--fg)] truncate">
          {title}
        </h1>
        {description && (
          <p className="text-[13px] text-[var(--fg-muted)] mt-1 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}

/* ───────────────────── Ligne clé / valeur ──────────────────────── */

export function DataRow({
  label,
  children,
  className,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 py-2.5 border-b border-[var(--border)] last:border-0",
        className,
      )}
    >
      <dt className="text-[13px] text-[var(--fg-muted)] shrink-0">{label}</dt>
      <dd className="text-[13px] text-[var(--fg)] text-right min-w-0 break-words">
        {children}
      </dd>
    </div>
  );
}
