import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db, getSettings } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { PageHeader } from "@/components/ui/misc";
import { ScanFlow } from "./scan-flow";

export const metadata: Metadata = { title: "Scanner une facture" };
export const dynamic = "force-dynamic";

export default async function ScanExpensePage() {
  const [settings, gemini] = await Promise.all([
    getSettings(),
    db.integration.findUnique({ where: { channel: "gemini" } }),
  ]);
  const aiEnabled = Boolean(decryptSecret(gemini?.secret));

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Scanner une facture"
        description={
          aiEnabled
            ? "Scanne la facture : elle est redressée, lue par l'IA, et tu valides avant d'enregistrer."
            : "Scanne la facture : elle est redressée et la QR-facture est lue ; tu valides avant d'enregistrer."
        }
        breadcrumb={
          <Link
            href="/depenses"
            className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Dépenses
          </Link>
        }
      />
      <ScanFlow
        vatEnabled={settings.vatEnabled}
        defaultVatRate={settings.vatRate}
        aiEnabled={aiEnabled}
      />
    </div>
  );
}
