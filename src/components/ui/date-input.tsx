"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, type InputProps } from "./field";

/**
 * Champ date qui ouvre le calendrier dès qu'on le touche ou qu'on clique
 * dessus, et pas seulement sur la petite icône du navigateur. Sur iPhone,
 * c'est le sélecteur de date natif qui s'ouvre.
 */
export const DateInput = React.forwardRef<HTMLInputElement, Omit<InputProps, "type">>(
  function DateInput({ className, onClick, ...props }, ref) {
    return (
      <Input
        ref={ref}
        type="date"
        icon={<CalendarDays />}
        className={cn("cursor-pointer tabular", className)}
        onClick={(event) => {
          onClick?.(event);
          try {
            // Navigateurs récents ; ailleurs le clic ouvre déjà le sélecteur.
            event.currentTarget.showPicker?.();
          } catch {
            // Déjà ouvert, ou champ en lecture seule : rien à faire.
          }
        }}
        {...props}
      />
    );
  },
);
