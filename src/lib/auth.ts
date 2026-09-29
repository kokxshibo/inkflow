import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";
import {
  SESSION_COOKIE,
  cookieOptions,
  signSession,
  verifySession,
  type SessionPayload,
} from "./session";

export type { SessionPayload };

export async function createSession(
  payload: Omit<SessionPayload, "iat">,
): Promise<void> {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions(payload.persistent));
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/**
 * À appeler dans toute page ou action protégée.
 * Le middleware filtre déjà les accès ; cette fonction reste la garde de
 * dernier recours côté serveur, notamment pour les Server Actions.
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function verifyCredentials(email: string, password: string) {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  if (!user) {
    // Comparaison factice : évite de révéler l'existence d'un compte
    // par la différence de temps de réponse.
    await bcrypt.compare(
      password,
      "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv",
    );
    return null;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  return valid ? user : null;
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

/** Aucun compte en base : l'application n'a pas encore été configurée. */
export async function needsSetup(): Promise<boolean> {
  return (await db.user.count()) === 0;
}

/**
 * Clé d'installation. Sur un serveur public, SETUP_TOKEN empêche un inconnu
 * de créer le compte propriétaire avant toi : /bienvenue exige alors ?cle=….
 * Sans SETUP_TOKEN (Vercel, local), la page reste ouverte comme avant.
 */
export function setupKeyMatches(key: unknown): boolean {
  const expected = process.env.SETUP_TOKEN;
  if (!expected) return true;
  if (typeof key !== "string" || key.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(key), Buffer.from(expected));
}
