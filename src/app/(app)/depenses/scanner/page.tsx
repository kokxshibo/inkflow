import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getSettings } from "@/lib/db";
import { PageHeader } from "@/components/ui/misc";
import { ScanFlow } from "./scan-flow";

export const metadata: Metadata = { title: "Scanner une facture" };
export const dynamic = "force-dynamic";

export default async function ScanExpensePage() {
  const settings = await getSettings();

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="Scanner une facture"
        description="Photographie la QR-facture : fournisseur, montant et référence se remplissent automatiquement."
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
      <ScanFlow vatEnabled={settings.vatEnabled} defaultVatRate={settings.vatRate} />
    </div>
  );
}
