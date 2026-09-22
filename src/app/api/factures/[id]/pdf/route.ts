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

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { client: true, items: { orderBy: { position: "asc" } } },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  }

  const session = await getSession();
  if (!session && token !== invoice.publicToken) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const settings = await getSettings();
  const pdf = await generateDocumentPdf(
    {
      kind: "invoice",
      number: invoice.number,
      issuedAt: invoice.issuedAt,
      secondDate: invoice.dueAt,
      client: invoice.client,
      items: invoice.items,
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      vatRate: invoice.vatRate,
      vatAmount: invoice.vatAmount,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      qrReference: invoice.qrReference,
      notes: invoice.notes,
      terms: invoice.terms,
    },
    settings,
  );

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
