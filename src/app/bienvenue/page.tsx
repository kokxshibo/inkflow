import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { needsSetup } from "@/lib/auth";
import { isDatabaseReady, areMigrationsApplied } from "@/lib/health";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = {
  title: "Première configuration",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  if (!(await isDatabaseReady()) || !(await areMigrationsApplied())) {
    redirect("/installation");
  }

  // Route fermée dès qu'un compte existe.
  if (!(await needsSetup())) redirect("/login");

  return (
    <div className="min-h-dvh bg-[var(--bg)] flex flex-col">
      <header className="relative overflow-hidden border-b border-[var(--border)] bg-[var(--bg-subtle)]">
        <div className="absolute inset-0 grid-bg opacity-30" aria-hidden />
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 size-[520px] rounded-full blur-[130px] opacity-[0.12]"
          style={{ background: "var(--accent)" }}
          aria-hidden
        />
        <div className="relative max-w-lg mx-auto px-6 py-12 sm:py-16 text-center">
          <span className="inline-grid place-items-center size-12 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-fg)] font-bold text-lg mb-5">
            IF
          </span>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.03em]">
            Bienvenue sur InkFlow
          </h1>
          <p className="mt-3 text-[14px] text-[var(--fg-muted)] leading-relaxed">
            Deux minutes pour créer ton compte, et tout le reste se règle ensuite
            depuis l&apos;application.
          </p>
        </div>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-6 py-10">
        <SetupForm />
      </main>

      <footer className="border-t border-[var(--border)] py-6">
        <p className="text-center text-[11px] text-[var(--fg-subtle)]">
          🇨🇭 Application suisse · montants en CHF · conforme nLPD
        </p>
      </footer>
    </div>
  );
}
