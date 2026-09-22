import Link from "next/link";
import type { Metadata } from "next";
import { Plus, FileText, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { formatCHF } from "@/lib/money";
import { formatDate, fullName, initials } from "@/lib/utils";
import { QUOTE_STATUS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/misc";
import { ListToolbar } from "@/components/list-toolbar";

export const metadata: Metadata = { title: "Devis" };
export const dynamic = "force-dynamic";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const now = new Date();

  const quotes = await db.quote.findMany({
    where: {
      ...(params.statut ? { status: params.statut } : {}),
      ...(query
        ? {
            OR: [
              { number: { contains: query, mode: 'insensitive' } },
              { client: { firstName: { contains: query, mode: 'insensitive' } } },
              { client: { lastName: { contains: query, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: { client: true, project: true },
    orderBy: { issuedAt: "desc" },
    take: 150,
  });

  const [pendingSum, acceptedSum, draftCount] = await Promise.all([
    db.quote.aggregate({ _sum: { total: true }, where: { status: "sent" } }),
    db.quote.aggregate({ _sum: { total: true }, where: { status: "accepted" } }),
    db.quote.count({ where: { status: "draft" } }),
  ]);

  const sentCount = quotes.filter((q) => q.status === "sent").length;
  const acceptedCount = quotes.filter((q) => q.status === "accepted").length;
  const conversionRate =
    sentCount + acceptedCount > 0
      ? Math.round((acceptedCount / (sentCount + acceptedCount)) * 100)
      : 0;

  return (
    <>
      <PageHeader
        title="Devis"
        description="Numérotation séquentielle automatique, sans trou."
        actions={
          <Button asChild variant="primary" size="sm">
            <Link href="/devis/nouveau">
              <Plus />
              Nouveau devis
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6 stagger">
        <StatCard
          label="En attente de réponse"
          value={formatCHF(pendingSum._sum.total ?? 0)}
          tone="warning"
          icon={<Clock />}
        />
        <StatCard
          label="Devis acceptés"
          value={formatCHF(acceptedSum._sum.total ?? 0)}
          tone="success"
        />
        <StatCard
          label="Taux d'acceptation"
          value={`${conversionRate} %`}
          tone="accent"
          sublabel={`${acceptedCount} accepté${acceptedCount > 1 ? "s" : ""} sur ${sentCount + acceptedCount} envoyé${sentCount + acceptedCount > 1 ? "s" : ""}`}
        />
        <StatCard label="Brouillons" value={draftCount} />
      </div>

      <ListToolbar
        basePath="/devis"
        searchPlaceholder="Numéro, client…"
        filters={[
          {
            param: "statut",
            label: "Statut",
            options: QUOTE_STATUS.map((o) => ({ value: o.value, label: o.label })),
          },
        ]}
      />

      {quotes.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title={query ? "Aucun résultat" : "Aucun devis"}
          description={
            query
              ? "Essaie avec d'autres critères."
              : "Crée un devis : il pourra ensuite être converti en facture en un clic."
          }
          action={
            <Button asChild variant="primary" size="sm">
              <Link href="/devis/nouveau">
                <Plus />
                Créer un devis
              </Link>
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--border)]">
            {quotes.map((quote) => {
              const expired =
                quote.status === "sent" && quote.validUntil < now;
              return (
                <li key={quote.id}>
                  <Link
                    href={`/devis/${quote.id}`}
                    className="flex items-center gap-4 px-4 sm:px-5 py-3.5 hover:bg-[var(--surface-2)] transition-colors group"
                  >
                    <Avatar
                      size="sm"
                      initials={initials(quote.client.firstName, quote.client.lastName)}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold tabular group-hover:text-[var(--accent)] transition-colors">
                          {quote.number}
                        </span>
                        {expired && (
                          <Badge tone="warning" dot>
                            Expiré
                          </Badge>
                        )}
                      </div>
                      <p className="text-[12px] text-[var(--fg-muted)] truncate mt-0.5">
                        {fullName(quote.client)}
                        {quote.project && ` · ${quote.project.title}`}
                      </p>
                    </div>

                    <div className="hidden md:block text-right shrink-0">
                      <p className="text-[11px] text-[var(--fg-subtle)]">Émis le</p>
                      <p className="text-[12px] tabular">{formatDate(quote.issuedAt)}</p>
                    </div>

                    <div className="hidden lg:block text-right shrink-0">
                      <p className="text-[11px] text-[var(--fg-subtle)]">Acompte</p>
                      <p className="text-[12px] tabular">
                        {formatCHF(quote.depositAmount)}
                      </p>
                    </div>

                    <div className="text-right shrink-0 w-28">
                      <p className="text-[14px] font-semibold tabular">
                        {formatCHF(quote.total)}
                      </p>
                    </div>

                    <div className="shrink-0 w-32 flex justify-end">
                      <StatusBadge
                        options={QUOTE_STATUS}
                        value={expired ? "expired" : quote.status}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
