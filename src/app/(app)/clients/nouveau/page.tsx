import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { ClientForm } from "../client-form";

export const metadata: Metadata = { title: "Nouveau client" };

export default function NewClientPage() {
  return (
    <>
      <PageHeader
        title="Nouveau client"
        description="Les champs d'adresse sont nécessaires pour émettre une facture."
        breadcrumb={
          <Link
            href="/clients"
            className="inline-flex items-center gap-1 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Clients
          </Link>
        }
      />
      <ClientForm />
    </>
  );
}
