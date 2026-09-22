import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Plus, Users } from "lucide-react";
import { db, getSettings } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { ProjectForm } from "../project-form";

export const metadata: Metadata = { title: "Nouveau projet" };
export const dynamic = "force-dynamic";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  const [clients, settings] = await Promise.all([
    db.client.findMany({
      where: { status: { not: "archived" } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
    }),
    getSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Nouveau projet"
        breadcrumb={
          <Link
            href="/projets"
            className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Projets
          </Link>
        }
      />
      {clients.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="Crée d'abord un client"
          description="Un projet est toujours rattaché à un client."
          action={
            <Button asChild variant="primary" size="sm">
              <Link href="/clients/nouveau">
                <Plus />
                Nouveau client
              </Link>
            </Button>
          }
        />
      ) : (
        <ProjectForm
          clients={clients}
          defaultClientId={client}
          hourlyRate={settings.hourlyRate}
        />
      )}
    </>
  );
}
