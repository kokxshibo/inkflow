import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  cookieOptions,
  shouldRefresh,
  signSession,
  verifySession,
} from "@/lib/session";

/**
 * Garde d'accès + renouvellement automatique de la session.
 *
 * C'est ici que la connexion devient persistante : à chaque navigation, si le
 * jeton a plus de 24 h, il est réémis pour 90 jours. Tant que l'application est
 * ouverte de temps en temps, il n'y a plus jamais de reconnexion.
 */

/** Chemins accessibles sans session. */
const PUBLIC_PREFIXES = [
  "/login",
  "/installation",
  "/bienvenue",
  "/demande",
  "/d", // lien perso envoyé par Instagram / Gmail : /d/<jeton>
  "/devis-public",
  "/facture-publique",
  "/deconnexion",
];

/**
 * Derrière nginx (VPS), request.url porte « localhost » : l'adresse de
 * redirection est reconstruite à partir du domaine réellement demandé.
 */
function redirectTo(request: NextRequest, path: string) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ??
    request.nextUrl.protocol.replace(":", "");
  return NextResponse.redirect(new URL(path, host ? `${protocol}://${host}` : request.url));
}

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Les routes PDF gèrent elles-mêmes l'accès par jeton public.
  if (pathname.startsWith("/api/")) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  if (isPublic(pathname)) {
    // Déjà connecté : la page de connexion n'a plus de raison d'être.
    if (session && pathname === "/login") {
      return redirectTo(request, "/tableau-de-bord");
    }
    return NextResponse.next();
  }

  if (!session) {
    // Mémorise la page demandée pour y revenir après connexion.
    return redirectTo(
      request,
      pathname === "/" ? "/login" : `/login?${new URLSearchParams({ suite: pathname + search })}`,
    );
  }

  const response = NextResponse.next();

  if (shouldRefresh(session)) {
    const renewed = await signSession({
      userId: session.userId,
      email: session.email,
      name: session.name,
      persistent: session.persistent,
    });
    response.cookies.set(SESSION_COOKIE, renewed, cookieOptions(true));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Toutes les routes sauf les ressources statiques : fichiers Next, images
     * téléversées, et tout fichier reconnu à son extension (icônes, manifeste…).
     * Sans cela, un visiteur non connecté verrait ces fichiers redirigés vers
     * la page de connexion.
     */
    "/((?!_next/static|_next/image|uploads/|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|txt|xml|webmanifest|woff2?)$).*)",
  ],
};
