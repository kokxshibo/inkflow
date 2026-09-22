import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Users, Instagram, Mail, Phone, ShieldAlert } from "lucide-react";
import { db } from "@/lib/db";
import { formatCHF } from "@/lib/money";
import { formatRelative, fullName, initials, isMinor, age } from "@/lib/utils";
import { CLIENT_STATUS, CLIENT_SOURCE, labelOf } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Avatar, EmptyState, PageHeader, Tooltip } from "@/components/ui/misc";
import { ListToolbar } from "@/components/list-toolbar";

export const metadata: Metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const status = params.statut ?? "";

  const clients = await db.client.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(query
        ? {
            OR: [
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
              { phone: { contains: query, mode: 'insensitive' } },
              { instagram: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { projects: true, appointments: true } },
      invoices: { select: { total: true, amountPaid: true } },
    },
    orderBy: [{ status: "asc" }, { lastName: "asc" }],
    take: 200,
  });

  const total = await db.client.count();

  return (
    <>
      <PageHeader
        title="Clients"
        description={`${total} fiche${total > 1 ? "s" : ""} au total`}
        actions={
          <Button asChild variant="primary" size="sm">
            <Link href="/clients/nouveau">
              <Plus />
              Nouveau client
            </Link>
          </Button>
        }
      />

      <ListToolbar
        basePath="/clients"
        searchPlaceholder="Nom, e-mail, téléphone, Instagram…"
        filters={[
          {
            param: "statut",
            label: "Statut",
            options: CLIENT_STATUS.map((option) => ({
              value: option.value,
              label: option.label,
            })),
          },
        ]}
      />

      {clients.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={query || status ? "Aucun résultat" : "Aucun client pour l'instant"}
          description={
            query || status
              ? "Essaie avec d'autres critères de recherche."
              : "Crée ta première fiche client, ou attends les demandes du formulaire public."
          }
          action={
            !query && !status ? (
              <Button asChild variant="primary" size="sm">
                <Link href="/clients/nouveau">
                  <Plus />
                  Créer un client
                </Link>
              </Button>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link href="/clients">Réinitialiser les filtres</Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 stagger">
          {clients.map((client) => {
            const spent = client.invoices.reduce((sum, i) => sum + i.amountPaid, 0);
            const minor = isMinor(client.birthDate);
            const clientAge = age(client.birthDate);

            return (
              <Link key={client.id} href={`/clients/${client.id}`} className="group">
                <Card interactive className="p-4 h-full flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <Avatar initials={initials(client.firstName, client.lastName)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold truncate group-hover:text-[var(--accent)] transition-colors">
                          {fullName(client)}
                        </p>
                        {minor && (
                          <Tooltip content={`Mineur — ${clientAge} ans. Autorisation parentale obligatoire.`}>
                            <ShieldAlert className="size-3.5 text-[var(--danger)] shrink-0" />
                          </Tooltip>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--fg-subtle)] mt-0.5">
                        {client.source
                          ? labelOf(CLIENT_SOURCE, client.source)
                          : "Source inconnue"}{" "}
                        · {formatRelative(client.createdAt)}
                      </p>
                    </div>
                    <StatusBadge options={CLIENT_STATUS} value={client.status} />
                  </div>

                  <div className="space-y-1 text-[12px] text-[var(--fg-muted)]">
                    {client.email && (
                      <p className="flex items-center gap-2 truncate">
                        <Mail className="size-3.5 shrink-0 text-[var(--fg-subtle)]" />
                        <span className="truncate">{client.email}</span>
                      </p>
                    )}
                    {client.phone && (
                      <p className="flex items-center gap-2 truncate">
                        <Phone className="size-3.5 shrink-0 text-[var(--fg-subtle)]" />
                        {client.phone}
                      </p>
                    )}
                    {client.instagram && (
                      <p className="flex items-center gap-2 truncate">
                        <Instagram className="size-3.5 shrink-0 text-[var(--fg-subtle)]" />@
                        {client.instagram}
                      </p>
                    )}
                  </div>

                  <div className="mt-auto pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 text-[11px] text-[var(--fg-subtle)]">
                      <span>
                        {client._count.projects} projet
                        {client._count.projects > 1 ? "s" : ""}
                      </span>
                      <span className="text-[var(--border-strong)]">·</span>
                      <span>
                        {client._count.appointments} RDV
                      </span>
                    </div>
                    {spent > 0 && (
                      <span className="text-[12px] font-semibold tabular text-[var(--fg)]">
                        {formatCHF(spent)}
                      </span>
                    )}
                  </div>

                  {client.noShowCount > 0 && (
                    <Badge tone="danger" dot className="self-start">
                      {client.noShowCount} absence{client.noShowCount > 1 ? "s" : ""}
                    </Badge>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
