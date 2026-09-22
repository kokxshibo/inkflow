import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { db, getSettings } from "@/lib/db";
import { PageHeader } from "@/components/ui/misc";
import { ProjectForm } from "../../project-form";

export const metadata: Metadata = { title: "Modifier le projet" };
export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, clients, settings] = await Promise.all([
    db.project.findUnique({ where: { id } }),
    db.client.findMany({
      select: { id: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
    }),
    getSettings(),
  ]);

  if (!project) notFound();

  return (
    <>
      <PageHeader
        title={`Modifier « ${project.title} »`}
        breadcrumb={
          <Link
            href={`/projets/${project.id}`}
            className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            {project.title}
          </Link>
        }
      />
      <ProjectForm project={project} clients={clients} hourlyRate={settings.hourlyRate} />
    </>
  );
}
