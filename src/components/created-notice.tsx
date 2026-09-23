"use client";

import * as React from "react";
import { toast } from "sonner";

/**
 * Confirme une création arrivée par redirection (« ?cree=1 »), une seule fois,
 * puis retire le paramètre de l'adresse pour qu'un rechargement ne la répète pas.
 */
export function CreatedNotice({ message, description }: { message: string; description?: string }) {
  const shown = React.useRef(false);

  React.useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    toast.success(message, description ? { description } : undefined);
    window.history.replaceState(window.history.state, "", window.location.pathname);
    // Après une redirection depuis un long formulaire, on repart du haut du document.
    window.scrollTo({ top: 0 });
  }, [message, description]);

  return null;
}
