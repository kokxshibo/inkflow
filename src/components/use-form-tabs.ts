"use client";

import * as React from "react";

/**
 * Onglet actif d'un formulaire à onglets. Quand un champ est refusé dans un
 * onglet masqué, que ce soit par le navigateur (champ requis, e-mail mal formé)
 * ou par le serveur (fieldErrors), bascule sur cet onglet et amène le champ à
 * l'écran : sinon l'enregistrement échoue sans que l'erreur soit visible.
 */
export function useFormTabs(
  defaultTab: string,
  formRef: React.RefObject<HTMLFormElement | null>,
  state?: { fieldErrors?: Record<string, string> },
) {
  const [tab, setTab] = React.useState(defaultTab);

  const reveal = React.useCallback((field: HTMLElement, then: () => void) => {
    const panel = field.closest<HTMLElement>("[data-tab]");
    if (panel?.dataset.tab && panel.dataset.state !== "active") {
      setTab(panel.dataset.tab);
      // Le panneau n'est visible qu'après le rendu suivant.
      requestAnimationFrame(then);
    } else {
      then();
    }
  }, []);

  // Validation du navigateur : seul le premier champ invalide compte.
  React.useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    let handled = false;
    function onInvalid(event: Event) {
      if (handled) return;
      handled = true;
      setTimeout(() => {
        handled = false;
      });

      const field = event.target as HTMLInputElement;
      const panel = field.closest<HTMLElement>("[data-tab]");
      if (panel?.dataset.state === "active") return;
      reveal(field, () => field.reportValidity());
    }

    form.addEventListener("invalid", onInvalid, true);
    return () => form.removeEventListener("invalid", onInvalid, true);
  }, [formRef, reveal]);

  // Erreurs renvoyées par le serveur.
  React.useEffect(() => {
    const names = Object.keys(state?.fieldErrors ?? {});
    const field = names
      .map((name) => formRef.current?.querySelector<HTMLElement>(`[name="${CSS.escape(name)}"]`))
      .find((element): element is HTMLElement => element != null);
    if (!field) return;
    reveal(field, () => {
      field.scrollIntoView({ block: "center", behavior: "smooth" });
      field.focus({ preventScroll: true });
    });
  }, [formRef, state, reveal]);

  return { tab, setTab };
}
