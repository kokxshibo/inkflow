"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium",
    "select-none outline-none",
    "transition-[background-color,border-color,color,box-shadow,transform,opacity]",
    "duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
    "active:scale-[0.975]",
    "disabled:pointer-events-none disabled:opacity-45",
    "focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
    "[&_svg]:shrink-0 [&_svg]:pointer-events-none",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--accent)] text-[var(--accent-fg)] shadow-[var(--shadow-sm)] hover:bg-[var(--accent-hover)] hover:shadow-[0_4px_20px_-4px_var(--accent-ring)]",
        secondary:
          "bg-[var(--surface-2)] text-[var(--fg)] border border-[var(--border)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)]",
        outline:
          "border border-[var(--border-strong)] text-[var(--fg)] hover:bg-[var(--surface-2)] hover:border-[var(--fg-subtle)]",
        ghost:
          "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
        danger:
          "bg-[var(--danger)] text-white hover:brightness-110 shadow-[var(--shadow-sm)]",
        dangerGhost:
          "text-[var(--danger)] hover:bg-[var(--danger-soft)]",
        success:
          "bg-[var(--success)] text-[oklch(0.16_0.04_158)] hover:brightness-110 shadow-[var(--shadow-sm)]",
        link:
          "text-[var(--accent)] underline-offset-4 hover:underline active:scale-100 p-0 h-auto",
      },
      size: {
        xs: "h-7 rounded-[var(--radius-xs)] px-2.5 text-xs [&_svg]:size-3.5",
        sm: "h-8.5 rounded-[var(--radius-sm)] px-3 text-[13px] [&_svg]:size-4",
        md: "h-10 rounded-[var(--radius-sm)] px-4 text-sm [&_svg]:size-4",
        lg: "h-11.5 rounded-[var(--radius-md)] px-5 text-[15px] [&_svg]:size-[18px]",
        icon: "size-9 rounded-[var(--radius-sm)] [&_svg]:size-4",
        iconSm: "size-7.5 rounded-[var(--radius-xs)] [&_svg]:size-3.5",
        iconLg: "size-11 rounded-[var(--radius-md)] [&_svg]:size-5",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    if (asChild) {
      return (
        <Comp
          ref={ref}
          className={cn(buttonVariants({ variant, size }), className)}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" aria-hidden />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
