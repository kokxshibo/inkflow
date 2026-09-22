import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ScanLine } from "lucide-react";
import { getSettings } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { ExpenseForm } from "../expense-form";

export const metadata: Metadata = { title: "Nouvelle dépense" };
export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  const settings = await getSettings();

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="Nouvelle dépense"
        description="Saisie manuelle. Pour aller plus vite, scanne la QR-facture."
        breadcrumb={
          <Link
            href="/depenses"
            className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Dépenses
          </Link>
        }
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/depenses/scanner">
              <ScanLine />
              Scanner
            </Link>
          </Button>
        }
      />
      <ExpenseForm
        vatEnabled={settings.vatEnabled}
        defaultVatRate={settings.vatRate}
        cancelHref="/depenses"
      />
    </div>
  );
}
