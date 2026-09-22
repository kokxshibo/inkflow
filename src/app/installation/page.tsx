import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Database, HardDrive, RefreshCw, CheckCircle2, Circle } from "lucide-react";
import { isDatabaseReady, areMigrationsApplied } from "@/lib/health";
import { isBlobConfigured } from "@/lib/storage";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Installation",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Page d'installation affichée tant que la base n'est pas branchée.
 * Évite une erreur 500 opaque au premier accès après déploiement.
 */
export default async function InstallPage() {
  const dbReady = await isDatabaseReady();
  const migrated = dbReady ? await areMigrationsApplied() : false;

  // Tout est en place : plus rien à faire ici.
  if (dbReady && migrated) redirect("/login");

  const blobReady = isBlobConfigured();

  return (
    <div className="min-h-dvh bg-[var(--bg)] flex flex-col">
      <header className="relative overflow-hidden border-b border-[var(--border)] bg-[var(--bg-subtle)]">
        <div className="absolute inset-0 grid-bg opacity-30" aria-hidden />
        <div className="relative max-w-xl mx-auto px-6 py-12 text-center">
          <span className="inline-grid place-items-center size-12 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-fg)] font-bold text-lg mb-5">
            IF
          </span>
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">
            Plus qu&apos;une étape
          </h1>
          <p className="mt-3 text-[14px] text-[var(--fg-muted)] leading-relaxed">
            L&apos;application est déployée. Il reste à brancher la base de données
            depuis le tableau de bord Vercel — deux minutes.
          </p>
        </div>
      </header>

      <main className="flex-1 max-w-xl w-full mx-auto px-6 py-10 space-y-4">
        <Step
          done={dbReady && migrated}
          number={1}
          icon={<Database />}
          title="Créer la base de données"
          status={
            !dbReady
              ? "Non connectée"
              : !migrated
                ? "Connectée, migrations à appliquer"
                : "Prête"
          }
        >
          <p>
            Vercel → projet <strong>inkflow</strong> → onglet{" "}
            <strong>Storage</strong> → <strong>Create Database</strong> →{" "}
            <strong>Neon</strong> (Postgres).
          </p>
          <p>
            Choisis une région européenne (Frankfurt ou Paris), puis{" "}
            <strong>Connect to Project</strong>.
          </p>
          <p className="text-[var(--fg-subtle)]">
            Vercel ajoute automatiquement <code>DATABASE_URL</code>. Les tables
            sont créées toutes seules au déploiement suivant.
          </p>
        </Step>

        <Step
          done={blobReady}
          number={2}
          icon={<HardDrive />}
          title="Activer le stockage des fichiers"
          status={blobReady ? "Prêt" : "Non connecté — facultatif pour démarrer"}
        >
          <p>
            Vercel → <strong>Storage</strong> → <strong>Create</strong> →{" "}
            <strong>Blob</strong> → <strong>Connect to Project</strong>.
          </p>
          <p className="text-[var(--fg-subtle)]">
            Nécessaire pour les photos de factures fournisseurs et les images de
            projets. Tout le reste fonctionne sans.
          </p>
        </Step>

        <Step
          done={false}
          number={3}
          icon={<RefreshCw />}
          title="Redéployer"
          status="À faire après les étapes précédentes"
        >
          <p>
            Vercel → onglet <strong>Deployments</strong> → menu <strong>···</strong>{" "}
            du dernier déploiement → <strong>Redeploy</strong>.
          </p>
          <p className="text-[var(--fg-subtle)]">
            Recharge ensuite cette page : elle basculera automatiquement sur la
            création de ton compte.
          </p>
        </Step>

        <Card className="border-dashed">
          <CardContent className="pt-5">
            <p className="text-[12px] text-[var(--fg-subtle)] leading-relaxed">
              Cette page disparaît dès que la base répond. Elle ne montre aucune
              donnée et ne permet aucune action.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function Step({
  done,
  number,
  icon,
  title,
  status,
  children,
}: {
  done: boolean;
  number: number;
  icon: React.ReactNode;
  title: string;
  status: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={done ? "border-[var(--success)]/30" : undefined}>
      <CardContent className="pt-5 flex gap-4">
        <span
          className={
            "grid place-items-center size-10 shrink-0 rounded-[var(--radius-md)] [&_svg]:size-5 " +
            (done
              ? "bg-[var(--success-soft)] text-[var(--success)]"
              : "bg-[var(--surface-2)] text-[var(--fg-subtle)]")
          }
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-[var(--fg-subtle)] tabular">
              ÉTAPE {number}
            </span>
            {done ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-[var(--success)]">
                <CheckCircle2 className="size-3" />
                {status}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] text-[var(--fg-subtle)]">
                <Circle className="size-3" />
                {status}
              </span>
            )}
          </div>
          <p className="text-[15px] font-semibold mt-1">{title}</p>
          <div className="text-[13px] text-[var(--fg-muted)] mt-2 space-y-1.5 leading-relaxed [&_code]:text-[11px] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-[var(--surface-2)]">
            {children}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
