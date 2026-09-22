"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─────────────────────────── Dialog ─────────────────────────── */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    size?: "sm" | "md" | "lg" | "xl";
    hideClose?: boolean;
  }
>(({ className, children, size = "md", hideClose, ...props }, ref) => {
  const widths = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }[size];

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]",
          "data-[state=open]:animate-fade-in",
        )}
      />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
          "w-[calc(100vw-2rem)]",
          widths,
          "max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain",
          "rounded-[var(--radius-xl)] border border-[var(--border-strong)]",
          "bg-[var(--surface)] shadow-[var(--shadow-lg)]",
          "focus:outline-none",
          "data-[state=open]:animate-scale-in",
          className,
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close
            className={cn(
              "absolute right-4 top-4 grid place-items-center size-8 rounded-[var(--radius-sm)]",
              "text-[var(--fg-subtle)] transition-colors duration-200",
              "hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
            )}
          >
            <X className="size-4" />
            <span className="sr-only">Fermer</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
DialogContent.displayName = "DialogContent";

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 pt-6 pb-4 pr-14", className)} {...props} />;
}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-[17px] font-semibold tracking-[-0.01em] text-[var(--fg)]", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-[13px] text-[var(--fg-muted)] mt-1.5 leading-relaxed", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 pb-2", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 mt-4",
        "border-t border-[var(--border)] bg-[var(--bg-subtle)]/50 rounded-b-[var(--radius-xl)]",
        "sticky bottom-0",
        className,
      )}
      {...props}
    />
  );
}

/* ────────────────────────── Dropdown ────────────────────────── */

export const Dropdown = DropdownPrimitive.Root;
export const DropdownTrigger = DropdownPrimitive.Trigger;

export const DropdownContent = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>
>(({ className, sideOffset = 6, align = "end", ...props }, ref) => (
  <DropdownPrimitive.Portal>
    <DropdownPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      align={align}
      className={cn(
        "z-50 min-w-[190px] overflow-hidden p-1.5",
        "rounded-[var(--radius-md)] border border-[var(--border-strong)]",
        "bg-[var(--surface)] shadow-[var(--shadow-lg)]",
        "animate-scale-in origin-[var(--radix-dropdown-menu-content-transform-origin)]",
        className,
      )}
      {...props}
    />
  </DropdownPrimitive.Portal>
));
DropdownContent.displayName = "DropdownContent";

export const DropdownItem = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> & { destructive?: boolean }
>(({ className, destructive, ...props }, ref) => (
  <DropdownPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-xs)]",
      "text-[13px] cursor-pointer select-none outline-none",
      "transition-colors duration-150",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
      "[&_svg]:size-4 [&_svg]:shrink-0",
      destructive
        ? "text-[var(--danger)] data-[highlighted]:bg-[var(--danger-soft)]"
        : "text-[var(--fg-muted)] data-[highlighted]:bg-[var(--surface-2)] data-[highlighted]:text-[var(--fg)]",
      className,
    )}
    {...props}
  />
));
DropdownItem.displayName = "DropdownItem";

export function DropdownSeparator({ className }: { className?: string }) {
  return (
    <DropdownPrimitive.Separator
      className={cn("my-1.5 h-px bg-[var(--border)] -mx-1.5", className)}
    />
  );
}

export function DropdownLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <DropdownPrimitive.Label
      className={cn(
        "px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)]",
        className,
      )}
      {...props}
    />
  );
}

/* ─────────────────── Dialogue de confirmation ────────────────── */

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  destructive,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-10 px-4 rounded-[var(--radius-sm)] text-sm font-medium text-[var(--fg-muted)] hover:bg-[var(--surface-2)] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "h-10 px-4 rounded-[var(--radius-sm)] text-sm font-medium transition-all active:scale-[0.975] disabled:opacity-50",
              destructive
                ? "bg-[var(--danger)] text-white hover:brightness-110"
                : "bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]",
            )}
          >
            {loading ? "…" : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
