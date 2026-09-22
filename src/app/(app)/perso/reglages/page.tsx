import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { getPersonalSettings } from "@/lib/db";
import { formatCHF } from "@/lib/money";
import { PageHeader } from "@/components/ui/misc";
import { PersonalSettingsForm } from "./personal-settings-form";

export const metadata: Metadata = { title: "Réglages personnels" };
export const dynamic = "force-dynamic";

export default async function PersonalSettingsPage() {
  const settings = await getPersonalSettings();

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Réglages personnels"
        description="Caisse de compensation, assurance maladie, canton et provisions."
        breadcrumb={
          <Link
            href="/perso"
            className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Gestion personnelle
          </Link>
        }
      />
      <PersonalSettingsForm
        settings={{
          ...settings,
          avsDeclaredIncomeFormatted: formatCHF(settings.avsDeclaredIncome, {
            showCurrency: false,
          }),
          lamalPremiumFormatted: formatCHF(settings.lamalPremium, {
            showCurrency: false,
          }),
          lamalSubsidyFormatted: formatCHF(settings.lamalSubsidy, {
            showCurrency: false,
          }),
          pillar3aCeilingFormatted: formatCHF(settings.pillar3aCeiling, {
            showCurrency: false,
          }),
        }}
      />
    </div>
  );
}
