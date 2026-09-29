import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { REF_COOKIE } from "@/lib/leads";

export const dynamic = "force-dynamic";

/**
 * Robots qui ouvrent les liens pour en afficher l'aperçu (Instagram, WhatsApp,
 * antivirus des messageries…) : ils ne comptent pas comme un clic.
 * Le navigateur intégré d'Instagram, lui, est un vrai visiteur.
 */
const BOTS =
  /bot\b|crawl|spider|facebookexternalhit|facebot|meta-external|whatsapp|telegram|slack|discord|skypeuri|preview|embedly|curl|wget|python|headless|lighthouse/i;

/** Lien perso envoyé à un contact : compte le clic puis ouvre le formulaire. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lead = /^[a-z0-9]{6,32}$/.test(token)
    ? await db.lead.findUnique({ where: { token }, select: { id: true, firstClickAt: true } })
    : null;

  // Adresse relative : correcte quel que soit le domaine derrière nginx.
  const response = new NextResponse(null, {
    status: 302,
    headers: { Location: lead ? `/demande?ref=${token}` : "/demande" },
  });
  if (!lead) return response;

  const agent = request.headers.get("user-agent") ?? "";
  if (!BOTS.test(agent)) {
    const now = new Date();
    await db.lead.update({
      where: { id: lead.id },
      data: { clicks: { increment: 1 }, lastClickAt: now, firstClickAt: lead.firstClickAt ?? now },
    });
  }

  // Garde la trace si la personne revient plus tard sans le lien.
  response.cookies.set(REF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 60,
    path: "/",
  });
  return response;
}
