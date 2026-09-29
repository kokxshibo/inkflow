import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { syncGmail } from "@/lib/gmail";
import { refreshInstagramToken } from "@/lib/instagram";

export const dynamic = "force-dynamic";

/**
 * Relève périodique, appelée chaque minute par le minuteur systemd du VPS
 * (inkflow-sync.timer) avec le jeton CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (
    !secret ||
    given.length !== secret.length ||
    !timingSafeEqual(Buffer.from(given), Buffer.from(secret))
  ) {
    return new NextResponse("Non autorisé", { status: 401 });
  }

  await syncGmail();
  await refreshInstagramToken();
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
