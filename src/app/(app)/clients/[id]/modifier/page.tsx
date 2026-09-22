import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { fullName } from "@/lib/utils";
import { PageHeader } from "@/components/ui/misc";
import { ClientForm } from "../../client-form";

export const metadata: Metadata = { title: "Modifier le client" };

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await db.client.findUnique({ where: { id } });
  if (!client) notFound();

  return (
    <>
      <PageHeader
        title={`Modifier ${fullName(client)}`}
        breadcrumb={
          <Link
            href={`/clients/${client.id}`}
            className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            {fullName(client)}
          </Link>
        }
      />
      <ClientForm client={client} />
    </>
  );
}
