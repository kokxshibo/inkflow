import Link from "next/link";
import type { Metadata } from "next";
import { Plug } from "lucide-react";
import { db, getSettings } from "@/lib/db";
import { isSmtpConfigured } from "@/lib/mail";
import { formatCHF } from "@/lib/money";
import { PageHeader } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Réglages" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();

  // Chiffre d'affaires glissant sur 12 mois, pour le suivi du seuil TVA
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  const rolling = await db.payment.aggregate({
    _sum: { amount: true },
    where: { paidAt: { gte: twelveMonthsAgo } },
  });

  return (
    <>
      <PageHeader
        title="Réglages"
        description="Ton profil, TVA, coordonnées bancaires et facturation."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/reglages/connexions">
              <Plug />
              Connexions (Instagram, Gmail, IA)
            </Link>
          </Button>
        }
      />
      <SettingsForm
        settings={{
          ...settings,
          hourlyRateFormatted: formatCHF(settings.hourlyRate, { showCurrency: false }),
          minimumPriceFormatted: formatCHF(settings.minimumPrice, {
            showCurrency: false,
          }),
        }}
        rollingRevenue={rolling._sum.amount ?? 0}
        smtpConfigured={isSmtpConfigured()}
      />
    </>
  );
}
