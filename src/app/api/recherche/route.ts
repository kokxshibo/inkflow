import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { formatCHF } from "@/lib/money";
import { fullName } from "@/lib/utils";

export async function GET(request: Request) {
  await requireSession();

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json([]);

  const [clients, projects, quotes, invoices] = await Promise.all([
    db.client.findMany({
      where: {
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
          { instagram: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 6,
    }),
    db.project.findMany({
      where: { title: { contains: query, mode: 'insensitive' } },
      include: { client: true },
      take: 5,
    }),
    db.quote.findMany({
      where: { number: { contains: query, mode: 'insensitive' } },
      include: { client: true },
      take: 4,
    }),
    db.invoice.findMany({
      where: { number: { contains: query, mode: 'insensitive' } },
      include: { client: true },
      take: 4,
    }),
  ]);

  return NextResponse.json([
    ...clients.map((client) => ({
      id: client.id,
      type: "client" as const,
      title: fullName(client),
      subtitle: client.email ?? client.phone ?? undefined,
      href: `/clients/${client.id}`,
    })),
    ...projects.map((project) => ({
      id: project.id,
      type: "project" as const,
      title: project.title,
      subtitle: fullName(project.client),
      href: `/projets/${project.id}`,
    })),
    ...quotes.map((quote) => ({
      id: quote.id,
      type: "quote" as const,
      title: quote.number,
      subtitle: `${fullName(quote.client)} · ${formatCHF(quote.total)}`,
      href: `/devis/${quote.id}`,
    })),
    ...invoices.map((invoice) => ({
      id: invoice.id,
      type: "invoice" as const,
      title: invoice.number,
      subtitle: `${fullName(invoice.client)} · ${formatCHF(invoice.total)}`,
      href: `/factures/${invoice.id}`,
    })),
  ]);
}
