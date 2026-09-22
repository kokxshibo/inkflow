import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  interactive,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "card-sheen rounded-[var(--radius-lg)] border border-[var(--border)]",
        "bg-[var(--surface)] shadow-[var(--shadow-sm)]",
        interactive && [
          "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)]",
          "hover:-translate-y-0.5",
        ],
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-start justify-between gap-4 px-5 pt-5 pb-3", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-[15px] font-semibold tracking-[-0.01em] text-[var(--fg)]", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-[13px] text-[var(--fg-muted)] mt-0.5", className)} {...props} />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-5 py-3.5 border-t border-[var(--border)] bg-[var(--bg-subtle)]/40 rounded-b-[var(--radius-lg)]",
        className,
      )}
      {...props}
    />
  );
}

/* ─────────────────────── Tuile de statistique ─────────────────────── */

export function StatCard({
  label,
  value,
  sublabel,
  icon,
  trend,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  icon?: React.ReactNode;
  trend?: { value: number; label?: string };
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
  className?: string;
}) {
  const toneRing = {
    neutral: "text-[var(--fg-muted)] bg-[var(--surface-2)]",
    accent: "text-[var(--accent)] bg-[var(--accent-soft)]",
    success: "text-[var(--success)] bg-[var(--success-soft)]",
    warning: "text-[var(--warning)] bg-[var(--warning-soft)]",
    danger: "text-[var(--danger)] bg-[var(--danger-soft)]",
  }[tone];

  return (
    <Card className={cn("p-5 flex flex-col gap-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] font-medium text-[var(--fg-muted)]">{label}</span>
        {icon && (
          <span
            className={cn(
              "grid place-items-center size-8 rounded-[var(--radius-sm)] [&_svg]:size-4",
              toneRing,
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl font-semibold tracking-[-0.02em] tabular text-[var(--fg)]">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "text-xs font-medium tabular",
              trend.value > 0
                ? "text-[var(--success)]"
                : trend.value < 0
                  ? "text-[var(--danger)]"
                  : "text-[var(--fg-subtle)]",
            )}
          >
            {trend.value > 0 ? "+" : ""}
            {trend.value}% {trend.label}
          </span>
        )}
      </div>
      {sublabel && <p className="text-xs text-[var(--fg-subtle)] -mt-1">{sublabel}</p>}
    </Card>
  );
}
