import { NextResponse } from "next/server";
import { db, getSettings } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generateDocumentPdf } from "@/lib/pdf";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  const quote = await db.quote.findUnique({
    where: { id },
    include: { client: true, items: { orderBy: { position: "asc" } } },
  });

  if (!quote) {
    return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });
  }

  // Accès autorisé soit par session, soit par le jeton public du document.
  const session = await getSession();
  if (!session && token !== quote.publicToken) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const settings = await getSettings();
  const pdf = await generateDocumentPdf(
    {
      kind: "quote",
      number: quote.number,
      issuedAt: quote.issuedAt,
      secondDate: quote.validUntil,
      client: quote.client,
      items: quote.items,
      subtotal: quote.subtotal,
      discount: quote.discount,
      vatRate: quote.vatRate,
      vatAmount: quote.vatAmount,
      total: quote.total,
      depositAmount: quote.depositAmount,
      notes: quote.notes,
      terms: quote.terms,
    },
    settings,
  );

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quote.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
