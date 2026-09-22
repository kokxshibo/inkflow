import "server-only";
import { db } from "./db";

/**
 * Vérifie que la base de données répond.
 *
 * Utilisé sur les pages d'entrée : tant que PostgreSQL n'est pas branché,
 * l'application affiche une page d'installation plutôt qu'une erreur 500.
 */
export async function isDatabaseReady(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/** Les migrations ont-elles été appliquées ? (table User présente) */
export async function areMigrationsApplied(): Promise<boolean> {
  try {
    await db.user.count();
    return true;
  } catch {
    return false;
  }
}
