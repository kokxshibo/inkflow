"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-dvh grid place-items-center px-6 bg-[var(--bg)]">
      <div className="text-center max-w-md animate-slide-up">
        <span className="inline-grid place-items-center size-14 rounded-full bg-[var(--danger-soft)] text-[var(--danger)] mb-5">
          <TriangleAlert className="size-6" />
        </span>
        <h1 className="text-xl font-semibold tracking-[-0.02em]">Une erreur est survenue</h1>
        <p className="text-[13px] text-[var(--fg-muted)] mt-2.5 leading-relaxed">
          {error.message || "Quelque chose s'est mal passé."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center h-10 px-4 mt-6 rounded-[var(--radius-sm)] bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium transition-colors hover:bg-[var(--accent-hover)]"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
