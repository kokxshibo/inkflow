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
  "/bienvenue",
  "/demande",
  "/devis-public",
  "/facture-publique",
  "/deconnexion",
];

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
      return NextResponse.redirect(new URL("/tableau-de-bord", request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const target = new URL("/login", request.url);
    // Mémorise la page demandée pour y revenir après connexion.
    if (pathname !== "/") target.searchParams.set("suite", pathname + search);
    return NextResponse.redirect(target);
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
     * Toutes les routes sauf les fichiers statiques, les images optimisées,
     * les icônes générées et les fichiers téléversés.
     */
    "/((?!_next/static|_next/image|uploads|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt).*)",
  ],
};
