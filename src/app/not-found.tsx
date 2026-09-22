import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-dvh grid place-items-center px-6 bg-[var(--bg)]">
      <div className="text-center max-w-sm animate-slide-up">
        <span className="inline-grid place-items-center size-14 rounded-full bg-[var(--surface-2)] text-[var(--fg-subtle)] mb-5">
          <FileQuestion className="size-6" />
        </span>
        <h1 className="text-xl font-semibold tracking-[-0.02em]">Page introuvable</h1>
        <p className="text-[13px] text-[var(--fg-muted)] mt-2.5 leading-relaxed">
          Cette page n&apos;existe pas, ou l&apos;élément que tu cherches a été supprimé.
        </p>
        <Link
          href="/tableau-de-bord"
          className="inline-flex items-center h-10 px-4 mt-6 rounded-[var(--radius-sm)] bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium transition-colors hover:bg-[var(--accent-hover)]"
        >
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
