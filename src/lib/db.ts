import { PrismaClient, type Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** Réglages de l'activité (ligne unique). Créée à la volée si absente. */
export async function getSettings() {
  const existing = await db.settings.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return db.settings.create({ data: { id: 1 } });
}

/** Réglages personnels (AVS, LAMal, impôts) — ligne unique. */
export async function getPersonalSettings() {
  const existing = await db.personalSettings.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return db.personalSettings.create({ data: { id: 1 } });
}

/**
 * Numérotation séquentielle sans trou (obligation légale).
 * Format : PREFIX-ANNEE-0001
 */
export async function nextNumber(
  kind: "quote" | "invoice",
  prefix: string,
  /**
   * Passer la transaction en cours : si la création du document échoue, le
   * compteur est annulé avec elle et aucun numéro n'est perdu.
   */
  client: Prisma.TransactionClient | PrismaClient = db,
  /** Date du document : une facture datée d'une autre année prend le numéro de cette année-là. */
  documentDate: Date = new Date(),
) {
  const year = documentDate.getFullYear();
  const id = `${kind}-${year}`;

  const counter = await client.counter.upsert({
    where: { id },
    create: { id, value: 1 },
    update: { value: { increment: 1 } },
  });

  return `${prefix}-${year}-${String(counter.value).padStart(4, "0")}`;
}

export async function logActivity(
  type: string,
  message: string,
  entity?: string,
  entityId?: string,
) {
  try {
    await db.activityLog.create({ data: { type, message, entity, entityId } });
  } catch {
    // La journalisation ne doit jamais faire échouer une action métier.
  }
}
