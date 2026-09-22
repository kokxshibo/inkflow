import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { db, getSettings } from "@/lib/db";
import { PageHeader } from "@/components/ui/misc";
import { ExpenseForm } from "../../expense-form";

export const metadata: Metadata = { title: "Modifier la dépense" };
export const dynamic = "force-dynamic";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [expense, settings] = await Promise.all([
    db.expense.findUnique({ where: { id } }),
    getSettings(),
  ]);

  if (!expense) notFound();

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title={`Modifier — ${expense.supplier}`}
        breadcrumb={
          <Link
            href={`/depenses/${expense.id}`}
            className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Retour
          </Link>
        }
      />
      <ExpenseForm
        expense={expense}
        vatEnabled={settings.vatEnabled}
        defaultVatRate={settings.vatRate}
        cancelHref={`/depenses/${expense.id}`}
      />
    </div>
  );
}
