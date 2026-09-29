import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Palette, Images, CalendarDays } from "lucide-react";
import { db } from "@/lib/db";
import { formatCHF } from "@/lib/money";
import { formatRelative, fullName, initials } from "@/lib/utils";
import {
  COLOR_MODE,
  PROJECT_STATUS,
  PROJECT_STYLE,
  ALL_BODY_ZONES,
  labelOf,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/misc";
import { ListToolbar } from "@/components/list-toolbar";

export const metadata: Metadata = { title: "Projets" };
export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string; style?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";

  const projects = await db.project.findMany({
    where: {
      ...(params.statut ? { status: params.statut } : {}),
      ...(params.style ? { style: params.style } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
              { client: { firstName: { contains: query, mode: 'insensitive' } } },
              { client: { lastName: { contains: query, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: {
      client: true,
      images: { take: 1, orderBy: { createdAt: "desc" } },
      _count: { select: { images: true, appointments: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 120,
  });

  const total = await db.project.count();

  return (
    <>
      <PageHeader
        title="Projets"
        description={`${total} projet${total > 1 ? "s" : ""} au total`}
        actions={
          <Button asChild variant="primary" size="sm">
            <Link href="/projets/nouveau">
              <Plus />
              Nouveau projet
            </Link>
          </Button>
        }
      />

      <ListToolbar
        basePath="/projets"
        searchPlaceholder="Titre, description, client…"
        filters={[
          {
            param: "statut",
            label: "Statut",
            options: PROJECT_STATUS.map((o) => ({ value: o.value, label: o.label })),
          },
          {
            param: "style",
            label: "Style",
            options: PROJECT_STYLE.map((o) => ({ value: o.value, label: o.label })),
          },
        ]}
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={<Palette />}
          title={query ? "Aucun résultat" : "Aucun projet"}
          description={
            query
              ? "Essaie avec d'autres critères."
              : "Un projet regroupe les références, les maquettes, les séances et le prix d'un tatouage."
          }
          action={
            <Button asChild variant="primary" size="sm">
              <Link href="/projets/nouveau">
                <Plus />
                Créer un projet
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 stagger">
          {projects.map((project) => {
            const cover = project.images[0];
            return (
              <Link key={project.id} href={`/projets/${project.id}`} className="group">
                <Card interactive className="overflow-hidden h-full flex flex-col">
                  <div className="relative aspect-[16/10] bg-[var(--surface-2)] overflow-hidden">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover.url}
                        alt=""
                        className="size-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="size-full grid place-items-center text-[var(--fg-subtle)]">
                        <Palette className="size-7 opacity-40" />
                      </div>
                    )}
                    <div className="absolute top-2.5 right-2.5">
                      <StatusBadge options={PROJECT_STATUS} value={project.status} />
                    </div>
                    {project._count.images > 1 && (
                      <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-[10px] text-white">
                        <Images className="size-3" />
                        {project._count.images}
                      </span>
                    )}
                  </div>

                  <div className="p-4 flex flex-col gap-3 flex-1">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate group-hover:text-[var(--accent)] transition-colors">
                        {project.title}
                      </p>
                      <p className="text-[11px] text-[var(--fg-subtle)] mt-1 truncate">
                        {project.style ? labelOf(PROJECT_STYLE, project.style) : "Style libre"}
                        {" · "}
                        {labelOf(COLOR_MODE, project.colorMode)}
                        {project.bodyZone && ` · ${labelOf(ALL_BODY_ZONES, project.bodyZone)}`}
                      </p>
                    </div>

                    <div className="mt-auto pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <Avatar
                          size="xs"
                          initials={initials(project.client.firstName, project.client.lastName)}
                        />
                        <span className="text-[11px] text-[var(--fg-muted)] truncate">
                          {fullName(project.client)}
                        </span>
                      </span>
                      {(project.finalPrice ?? project.estimatedPrice) ? (
                        <span className="text-[12px] font-semibold tabular shrink-0">
                          {formatCHF(project.finalPrice ?? project.estimatedPrice ?? 0)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--fg-subtle)] shrink-0">
                          Sans prix
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-[var(--fg-subtle)]">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {project._count.appointments} RDV
                      </span>
                      <span>·</span>
                      <span>{formatRelative(project.updatedAt)}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
