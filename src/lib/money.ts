/**
 * Gestion monétaire suisse.
 *
 * Règle absolue : les montants sont TOUJOURS manipulés en centimes (entiers).
 * Aucun `float` ne touche un montant — avec l'arrondi à 0.05 CHF les erreurs
 * de virgule flottante deviendraient visibles sur les factures.
 */

export const CURRENCY = "CHF";

/** Formate des centimes en CHF au format suisse : CHF 1'250.00 */
export function formatCHF(cents: number, opts: { showCurrency?: boolean } = {}): string {
  const { showCurrency = true } = opts;
  const value = cents / 100;
  const formatted = new Intl.NumberFormat("de-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return showCurrency ? `CHF ${formatted}` : formatted;
}

/** Version compacte pour les tuiles de statistiques : CHF 12.4k */
export function formatCHFCompact(cents: number): string {
  const value = cents / 100;
  if (Math.abs(value) >= 1000) {
    return `CHF ${new Intl.NumberFormat("de-CH", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value)}`;
  }
  return formatCHF(cents);
}

/**
 * Convertit une saisie utilisateur en centimes.
 * Accepte « 1'250.50 », « 1250,50 », « 1 250.5 », « CHF 1250 ».
 */
export function parseCHF(input: string | number | null | undefined): number {
  if (input === null || input === undefined || input === "") return 0;
  if (typeof input === "number") return Math.round(input * 100);

  const cleaned = input
    .replace(/chf/gi, "")
    // Séparateurs de milliers : apostrophe droite ou typographique (’, selon le
    // navigateur), espaces insécables.
    .replace(/['\u2018\u2019\u02BC\s\u00A0\u202F]/g, "")
    .replace(",", ".")
    .trim();

  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

/**
 * Arrondi suisse à 0.05 CHF (5 centimes).
 * Obligatoire pour les paiements en espèces — les pièces de 1 et 2 centimes
 * n'ont plus cours en Suisse.
 */
export function roundTo5Cents(cents: number): number {
  return Math.round(cents / 5) * 5;
}

/** Écart introduit par l'arrondi espèces (peut être négatif) */
export function cashRoundingDelta(cents: number): number {
  return roundTo5Cents(cents) - cents;
}

/**
 * Calcule les totaux d'un document.
 *
 * Important : si le salon n'est pas assujetti à la TVA (CA < CHF 100'000),
 * `vatRate` vaut 0 et AUCUNE TVA n'est calculée ni affichée. Facturer une TVA
 * sans être inscrit au registre de l'AFC est une faute.
 */
export interface LineInput {
  quantity: number;
  unitPrice: number; // centimes
}

export interface Totals {
  subtotal: number;
  discount: number;
  taxableBase: number;
  vatRate: number;
  vatAmount: number;
  total: number;
}

export function computeTotals(
  lines: LineInput[],
  discount = 0,
  vatRate = 0,
): Totals {
  const subtotal = lines.reduce(
    (sum, line) => sum + Math.round(line.quantity * line.unitPrice),
    0,
  );
  const safeDiscount = Math.min(Math.max(discount, 0), subtotal);
  const taxableBase = subtotal - safeDiscount;
  const vatAmount = vatRate > 0 ? Math.round((taxableBase * vatRate) / 100) : 0;

  return {
    subtotal,
    discount: safeDiscount,
    taxableBase,
    vatRate,
    vatAmount,
    total: taxableBase + vatAmount,
  };
}

/**
 * Décompose un prix payé par le client (TTC) en base et TVA, de sorte que le
 * total retombe exactement sur le montant saisi — au centime près.
 *
 * C'est le sens naturel pour un tatoueur : il annonce un prix final, pas un
 * prix hors taxe auquel s'ajouterait la TVA.
 */
export function fromGross(amount: number, vatRate: number) {
  if (vatRate <= 0) {
    return { subtotal: amount, vatAmount: 0, total: amount };
  }
  const subtotal = Math.round(amount / (1 + vatRate / 100));
  return { subtotal, vatAmount: amount - subtotal, total: amount };
}

/** Montant de l'acompte à partir d'un pourcentage, arrondi à 5 centimes */
export function computeDeposit(total: number, percent: number): number {
  return roundTo5Cents(Math.round((total * percent) / 100));
}

/**
 * Référence QRR pour la QR-facture (27 chiffres + clé de contrôle mod 10 récursif).
 * Utilisée uniquement avec un QR-IBAN.
 */
const MOD10_TABLE = [
  [0, 9, 4, 6, 8, 2, 7, 1, 3, 5],
  [9, 4, 6, 8, 2, 7, 1, 3, 5, 0],
  [4, 6, 8, 2, 7, 1, 3, 5, 0, 9],
  [6, 8, 2, 7, 1, 3, 5, 0, 9, 4],
  [8, 2, 7, 1, 3, 5, 0, 9, 4, 6],
  [2, 7, 1, 3, 5, 0, 9, 4, 6, 8],
  [7, 1, 3, 5, 0, 9, 4, 6, 8, 2],
  [1, 3, 5, 0, 9, 4, 6, 8, 2, 7],
  [3, 5, 0, 9, 4, 6, 8, 2, 7, 1],
  [5, 0, 9, 4, 6, 8, 2, 7, 1, 3],
];

export function mod10Recursive(digits: string): number {
  let carry = 0;
  for (const char of digits.replace(/\D/g, "")) {
    carry = MOD10_TABLE[carry][Number(char)];
  }
  return (10 - carry) % 10;
}

/**
 * Construit une référence QRR de 27 chiffres à partir d'un identifiant libre
 * (typiquement le numéro de facture).
 */
export function buildQrReference(seed: string): string {
  const digits = seed.replace(/\D/g, "").slice(-26).padStart(26, "0");
  return digits + String(mod10Recursive(digits));
}

/** Découpe une référence QRR en blocs de 5 pour l'affichage */
export function formatQrReference(reference: string): string {
  const clean = reference.replace(/\s/g, "");
  const head = clean.length % 5;
  const blocks: string[] = [];
  if (head) blocks.push(clean.slice(0, head));
  for (let i = head; i < clean.length; i += 5) blocks.push(clean.slice(i, i + 5));
  return blocks.join(" ");
}

/** Vérifie qu'un IBAN est un QR-IBAN (IID entre 30000 et 31999) */
export function isQrIban(iban: string): boolean {
  const clean = iban.replace(/\s/g, "").toUpperCase();
  if (!/^CH\d{2}\d{5}/.test(clean)) return false;
  const iid = Number(clean.slice(4, 9));
  return iid >= 30000 && iid <= 31999;
}

/** Validation IBAN (mod 97) */
export function isValidIban(iban: string): boolean {
  const clean = iban.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(clean)) return false;
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** Formate un IBAN par blocs de 4 : CH44 3199 9123 0008 8901 2 */
export function formatIban(iban: string): string {
  return iban.replace(/[\s-]/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim();
}
