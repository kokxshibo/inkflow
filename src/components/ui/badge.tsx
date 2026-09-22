import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { type Option, type Tone, labelOf, toneOf } from "@/lib/constants";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap border transition-colors duration-200",
  {
    variants: {
      tone: {
        neutral:
          "bg-[var(--surface-2)] text-[var(--fg-muted)] border-[var(--border)]",
        accent:
          "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/25",
        success:
          "bg-[var(--success-soft)] text-[var(--success)] border-[var(--success)]/25",
        warning:
          "bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning)]/25",
        danger:
          "bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/25",
        info: "bg-[var(--info-soft)] text-[var(--info)] border-[var(--info)]/25",
      },
      size: {
        sm: "text-[11px] px-2 py-0.5",
        md: "text-xs px-2.5 py-1",
      },
    },
    defaultVariants: { tone: "neutral", size: "sm" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, tone, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current shrink-0" />}
      {children}
    </span>
  );
}

/** Badge dérivé d'une liste d'options : libellé et couleur automatiques. */
export function StatusBadge({
  options,
  value,
  size,
  dot = true,
  className,
}: {
  options: Option[];
  value: string | null | undefined;
  size?: "sm" | "md";
  dot?: boolean;
  className?: string;
}) {
  return (
    <Badge
      tone={toneOf(options, value) as Tone}
      size={size}
      dot={dot}
      className={className}
    >
      {labelOf(options, value)}
    </Badge>
  );
}
