import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Chiffrement des secrets stockés en base (mot de passe d'application Gmail,
 * jeton Instagram, secret de l'application Meta).
 *
 * AES-256-GCM, clé dérivée d'AUTH_SECRET : une copie de la base seule ne suffit
 * pas à se connecter aux comptes. Si AUTH_SECRET change, les secrets deviennent
 * illisibles et il faut simplement reconnecter les comptes.
 */

const VERSION = "v1";

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET manquant ou trop court (32 caractères minimum).");
  }
  return createHash("sha256").update(`${secret}:inkflow-integrations`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${Buffer.concat([iv, tag, encrypted]).toString("base64")}`;
}

/** Renvoie null si le secret est absent ou illisible (AUTH_SECRET changé). */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored?.startsWith(`${VERSION}:`)) return null;
  try {
    const raw = Buffer.from(stored.slice(VERSION.length + 1), "base64");
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
