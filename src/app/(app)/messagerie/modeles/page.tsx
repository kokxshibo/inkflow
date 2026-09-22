import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/misc";
import { TemplateManager } from "./template-manager";

export const metadata: Metadata = { title: "Modèles d'e-mails" };
export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const templates = await db.emailTemplate.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return (
    <>
      <PageHeader
        title="Modèles d'e-mails"
        description="Les {{variables}} sont remplacées automatiquement par les données du client au moment de la rédaction."
        breadcrumb={
          <Link
            href="/messagerie"
            className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Messagerie
          </Link>
        }
      />
      <TemplateManager
        templates={templates.map((template) => ({
          id: template.id,
          key: template.key,
          name: template.name,
          category: template.category,
          subject: template.subject,
          body: template.body,
          isSystem: template.isSystem,
        }))}
      />
    </>
  );
}
