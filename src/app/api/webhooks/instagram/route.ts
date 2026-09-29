import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { handleWebhook, isValidSignature, type WebhookPayload } from "@/lib/instagram";

export const dynamic = "force-dynamic";

/** Vérification de l'URL par Meta, lors de la configuration du webhook. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const integration = await db.integration.findUnique({ where: { channel: "instagram" } });

  if (
    params.get("hub.mode") === "subscribe" &&
    integration?.verifyToken &&
    params.get("hub.verify_token") === integration.verifyToken
  ) {
    return new NextResponse(params.get("hub.challenge") ?? "", {
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new NextResponse("Jeton de vérification invalide", { status: 403 });
}

/** Messages Instagram entrants (et copies des messages que tu envoies). */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const integration = await db.integration.findUnique({ where: { channel: "instagram" } });
  const appSecret = decryptSecret(integration?.appSecret);

  if (!appSecret || !isValidSignature(raw, request.headers.get("x-hub-signature-256"), appSecret)) {
    return new NextResponse("Signature invalide", { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(raw) as WebhookPayload;
  } catch {
    return new NextResponse("Contenu invalide", { status: 400 });
  }

  // Les erreurs sont consignées dans l'intégration : Meta reçoit toujours 200,
  // sinon il renverrait le même événement en boucle.
  await handleWebhook(payload);
  return NextResponse.json({ ok: true });
}
