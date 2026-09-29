import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { INSTAGRAM_STATE_COOKIE, completeConnection } from "@/lib/instagram";

export const dynamic = "force-dynamic";

/** Retour d'Instagram après l'autorisation du compte. */
export async function GET(request: NextRequest) {
  const back = (query: string) =>
    new NextResponse(null, {
      status: 303,
      headers: { Location: `/reglages/connexions?${query}` },
    });

  if (!(await getSession())) {
    return new NextResponse(null, { status: 303, headers: { Location: "/login" } });
  }

  const params = request.nextUrl.searchParams;
  const expected = request.cookies.get(INSTAGRAM_STATE_COOKIE)?.value;
  const code = params.get("code");

  if (params.get("error")) {
    return back(
      `instagram_erreur=${encodeURIComponent(params.get("error_description") ?? "Autorisation refusée.")}`,
    );
  }
  if (!code || !expected || params.get("state") !== expected) {
    return back(
      `instagram_erreur=${encodeURIComponent("Lien de connexion expiré. Recommence depuis cette page.")}`,
    );
  }

  let response: NextResponse;
  try {
    // Instagram ajoute parfois « #_ » à la fin du code.
    await completeConnection(code.replace(/#_$/, ""));
    response = back("instagram=ok");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connexion impossible.";
    response = back(`instagram_erreur=${encodeURIComponent(message)}`);
  }
  response.cookies.delete(INSTAGRAM_STATE_COOKIE);
  return response;
}
