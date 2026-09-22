import type { Metadata } from "next";
import { getSettings } from "@/lib/db";
import { RequestForm } from "./request-form";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: `Demander un tatouage — ${settings.studioName}`,
    description: `Décris ton projet de tatouage et envoie tes références à ${settings.studioName}.`,
    robots: { index: true, follow: true },
  };
}

export default async function PublicRequestPage() {
  const settings = await getSettings();

  return (
    <div className="min-h-dvh bg-[var(--bg)]">
      {/* Bandeau */}
      <header className="relative overflow-hidden border-b border-[var(--border)] bg-[var(--bg-subtle)]">
        <div className="absolute inset-0 grid-bg opacity-30" aria-hidden />
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 size-[600px] rounded-full blur-[130px] opacity-[0.1]"
          style={{ background: "var(--accent)" }}
          aria-hidden
        />
        <div className="relative max-w-2xl mx-auto px-6 py-14 sm:py-20 text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--accent)] mb-3">
            {settings.studioName}
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] leading-tight">
            Parle-moi de ton projet
          </h1>
          <p className="mt-4 text-[15px] text-[var(--fg-muted)] leading-relaxed max-w-lg mx-auto">
            Remplis ce formulaire plutôt que de m&apos;écrire en message privé : je reçois
            tout au même endroit, rien ne se perd, et je te réponds plus vite.
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 sm:py-14">
        <RequestForm studioName={settings.studioName} />
      </main>

      <footer className="border-t border-[var(--border)] py-8">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <p className="text-[12px] text-[var(--fg-subtle)] leading-relaxed">
            {settings.studioName}
            {settings.addressLine && ` · ${settings.addressLine}`}
            {settings.city && `, ${settings.postalCode} ${settings.city}`}
          </p>
          <p className="text-[11px] text-[var(--fg-subtle)] mt-2 leading-relaxed">
            Tes données sont utilisées uniquement pour traiter ta demande et ne sont
            jamais transmises à des tiers. Tu peux demander leur suppression à tout
            moment{settings.email ? ` en écrivant à ${settings.email}` : ""}.
          </p>
        </div>
      </footer>
    </div>
  );
}
