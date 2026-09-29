import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession, needsSetup } from "@/lib/auth";
import { isDatabaseReady, areMigrationsApplied } from "@/lib/health";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>;
}) {
  // Base absente ou migrations non appliquees : on guide plutot que d'echouer.
  if (!(await isDatabaseReady()) || !(await areMigrationsApplied())) {
    redirect("/installation");
  }

  // Premiere utilisation : aucun compte n'existe encore.
  if (await needsSetup()) redirect("/bienvenue");

  const session = await getSession();
  if (session) redirect("/tableau-de-bord");

  const { suite } = await searchParams;

  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      {/* Volet gauche — identité */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-[var(--bg-subtle)] border-r border-[var(--border)] overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40" aria-hidden />
        <div
          className="absolute -top-32 -left-32 size-[500px] rounded-full blur-[120px] opacity-[0.12]"
          style={{ background: "var(--accent)" }}
          aria-hidden
        />

        <div className="relative flex items-center gap-3">
          <span className="grid place-items-center size-10 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-fg)] font-bold">
            IF
          </span>
          <span className="text-lg font-semibold tracking-[-0.02em]">InkFlow</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-[32px] leading-[1.15] font-semibold tracking-[-0.03em]">
            Toute ton activité,
            <br />
            <span className="text-[var(--accent)]">au même endroit.</span>
          </h2>
          <p className="mt-4 text-[15px] text-[var(--fg-muted)] leading-relaxed">
            Clients, projets, rendez-vous, devis et factures en CHF avec QR-facture
            suisse. Fini les demandes perdues dans les messages Instagram.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              "Devis et factures conformes, numérotés automatiquement",
              "QR-facture suisse scannable par toutes les banques",
              "Rendez-vous, acomptes et suivi de cicatrisation",
            ].map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-[13px] text-[var(--fg-muted)]">
                <span className="mt-1.5 size-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-[var(--fg-subtle)]">
          Données hébergées en Suisse · Conforme nLPD
        </p>
      </div>

      {/* Volet droit — formulaire */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <span className="grid place-items-center size-10 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-fg)] font-bold">
              IF
            </span>
            <span className="text-lg font-semibold tracking-[-0.02em]">InkFlow</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Connexion</h1>
          <p className="mt-2 text-[13px] text-[var(--fg-muted)]">
            Accède à ton espace.
          </p>

          <LoginForm suite={suite} />
        </div>
      </div>
    </div>
  );
}
