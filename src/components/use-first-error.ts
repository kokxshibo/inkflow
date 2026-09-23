"use client";

import * as React from "react";

/**
 * Après un envoi refusé, amène le premier champ en erreur à l'écran et y place
 * le focus : sur téléphone, le message ne reste pas caché hors de la vue.
 */
export function useFirstError(
  formRef: React.RefObject<HTMLFormElement | null>,
  state: { fieldErrors?: Record<string, string> },
) {
  React.useEffect(() => {
    if (!state.fieldErrors || Object.keys(state.fieldErrors).length === 0) return;
    const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!field) return;
    field.scrollIntoView({ block: "center", behavior: "smooth" });
    field.focus({ preventScroll: true });
  }, [formRef, state]);
}
