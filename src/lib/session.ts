import { SignJWT, jwtVerify } from "jose";

/**
 * Gestion du jeton de session — volontairement sans Prisma ni bcrypt pour
 * rester utilisable depuis le middleware (runtime Edge).
 *
 * La session est « glissante » : tant que l'application est utilisée, elle se
 * renouvelle toute seule et l'utilisateur ne se reconnecte jamais.
 */

export const SESSION_COOKIE = "inkflow_session";

/** Durée de vie du cookie : 90 jours, renouvelés à chaque passage. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 90;

/** Durée courte, quand « rester connecté » est décoché : la journée de travail. */
export const SESSION_SHORT_MAX_AGE = 60 * 60 * 12;

/**
 * Au-delà de ce délai depuis la dernière émission, le jeton est réémis.
 * Évite de réécrire le cookie à chaque requête tout en gardant la session vivante.
 */
export const SESSION_REFRESH_AFTER = 60 * 60 * 24; // 24 h

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  /** true = session longue (90 jours), renouvelée automatiquement */
  persistent: boolean;
  /** Horodatage d'émission, en secondes */
  iat?: number;
}

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "AUTH_SECRET manquant ou trop court (32 caractères minimum). Vérifie tes variables d'environnement.",
    );
  }
  return new TextEncoder().encode(value);
}

export function maxAgeFor(persistent: boolean) {
  return persistent ? SESSION_MAX_AGE : SESSION_SHORT_MAX_AGE;
}

export async function signSession(
  payload: Omit<SessionPayload, "iat">,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeFor(payload.persistent)}s`)
    .sign(secret());
}

export async function verifySession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      name: payload.name as string,
      persistent: payload.persistent !== false,
      iat: payload.iat,
    };
  } catch {
    return null;
  }
}

/** Le jeton mérite-t-il d'être réémis pour repousser son expiration ? */
export function shouldRefresh(session: SessionPayload): boolean {
  if (!session.persistent || !session.iat) return false;
  const ageSeconds = Math.floor(Date.now() / 1000) - session.iat;
  return ageSeconds > SESSION_REFRESH_AFTER;
}

export function cookieOptions(persistent: boolean) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: maxAgeFor(persistent),
    path: "/",
  };
}
