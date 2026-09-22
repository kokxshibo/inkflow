/**
 * Lecture d'un Swiss QR Code (QR-facture).
 *
 * Le contenu du QR est un « Swiss Payment Code » : une suite de champs séparés
 * par des retours à la ligne, dans un ordre fixe défini par les normes SIX
 * (Implementation Guidelines QR-bill, version 2.x).
 *
 * Ce module ne fait que décoder et interpréter la charge utile ; la lecture de
 * l'image elle-même est faite côté navigateur avec jsQR.
 */

/** Indices des champs dans la charge utile SPC (version 0200). */
const FIELD = {
  qrType: 0,
  version: 1,
  codingType: 2,
  iban: 3,
  // Créancier
  crAddressType: 4,
  crName: 5,
  crStreetOrLine1: 6,
  crBuildingOrLine2: 7,
  crPostalCode: 8,
  crTown: 9,
  crCountry: 10,
  // Créancier final (7 champs, presque toujours vides)
  // 11 → 17
  amount: 18,
  currency: 19,
  // Débiteur final
  dbAddressType: 20,
  dbName: 21,
  dbStreetOrLine1: 22,
  dbBuildingOrLine2: 23,
  dbPostalCode: 24,
  dbTown: 25,
  dbCountry: 26,
  // Référence
  referenceType: 27,
  reference: 28,
  unstructuredMessage: 29,
  trailer: 30,
  billInformation: 31,
} as const;

export interface SwissQrData {
  iban: string;
  creditorName: string;
  creditorAddress: string | null;
  creditorPostalCode: string | null;
  creditorTown: string | null;
  /** Montant en CENTIMES. `null` si le QR ne porte pas de montant. */
  amountCents: number | null;
  currency: string;
  referenceType: "QRR" | "SCOR" | "NON" | string;
  reference: string | null;
  message: string | null;
  debtorName: string | null;
  /** Champs Swico décodés depuis l'information de facture, si présente */
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  vatRate: number | null;
}

export class SwissQrError extends Error {}

/**
 * Analyse la charge utile d'un Swiss QR Code.
 * Lève une `SwissQrError` si ce n'est pas un QR-facture suisse.
 */
export function parseSwissQr(payload: string): SwissQrData {
  const lines = payload.replace(/\r\n/g, "\n").split("\n");

  if (lines[FIELD.qrType]?.trim() !== "SPC") {
    throw new SwissQrError(
      "Ce QR code n'est pas une QR-facture suisse. Saisis les montants à la main.",
    );
  }

  const at = (index: number) => lines[index]?.trim() || null;

  const iban = at(FIELD.iban)?.replace(/\s/g, "") ?? "";
  if (!iban) {
    throw new SwissQrError("QR-facture illisible : IBAN manquant.");
  }

  // Le montant est optionnel : certaines QR-factures laissent le payeur le saisir.
  const rawAmount = at(FIELD.amount);
  const amountCents = rawAmount
    ? Math.round(Number.parseFloat(rawAmount) * 100)
    : null;

  const swico = parseSwico(at(FIELD.billInformation));

  return {
    iban,
    creditorName: at(FIELD.crName) ?? "Fournisseur inconnu",
    creditorAddress: joinAddress(
      at(FIELD.crStreetOrLine1),
      at(FIELD.crBuildingOrLine2),
      at(FIELD.crAddressType),
    ),
    creditorPostalCode: at(FIELD.crPostalCode),
    creditorTown: at(FIELD.crTown),
    amountCents:
      amountCents !== null && Number.isFinite(amountCents) ? amountCents : null,
    currency: at(FIELD.currency) ?? "CHF",
    referenceType: at(FIELD.referenceType) ?? "NON",
    reference: at(FIELD.reference),
    message: at(FIELD.unstructuredMessage),
    debtorName: at(FIELD.dbName),
    invoiceNumber: swico.invoiceNumber,
    invoiceDate: swico.date,
    vatRate: swico.vatRate,
  };
}

/**
 * Une adresse structurée (type "S") sépare rue et numéro ;
 * une adresse combinée (type "K") tient sur deux lignes libres.
 */
function joinAddress(
  line1: string | null,
  line2: string | null,
  addressType: string | null,
): string | null {
  if (!line1) return line2;
  if (addressType === "K") return line2 ? `${line1}, ${line2}` : line1;
  return line2 ? `${line1} ${line2}` : line1;
}

/**
 * Information de facture au format Swico S1.
 * Exemple : //S1/10/1234/11/260318/30/CHE-123.456.789/32/8.1/40/30:0
 *
 * Champs exploités : 10 = n° de facture, 11 = date (AAMMJJ), 32 = taux de TVA.
 */
function parseSwico(raw: string | null): {
  invoiceNumber: string | null;
  date: Date | null;
  vatRate: number | null;
} {
  const empty = { invoiceNumber: null, date: null, vatRate: null };
  if (!raw || !raw.startsWith("//S1/")) return empty;

  const parts = raw.slice(5).split("/");
  const fields = new Map<string, string>();
  for (let i = 0; i < parts.length - 1; i += 2) {
    fields.set(parts[i], parts[i + 1]);
  }

  const rawDate = fields.get("11");
  let date: Date | null = null;
  if (rawDate && /^\d{6}$/.test(rawDate)) {
    const year = 2000 + Number(rawDate.slice(0, 2));
    const month = Number(rawDate.slice(2, 4)) - 1;
    const day = Number(rawDate.slice(4, 6));
    const parsed = new Date(year, month, day);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }

  // Le champ 32 peut contenir plusieurs taux ("8.1:1000;2.6:500") : on garde le premier.
  const rawVat = fields.get("32");
  let vatRate: number | null = null;
  if (rawVat) {
    const first = Number.parseFloat(rawVat.split(";")[0].split(":")[0]);
    if (Number.isFinite(first)) vatRate = first;
  }

  return { invoiceNumber: fields.get("10") ?? null, date, vatRate };
}

/**
 * Décompose un montant TTC en base hors taxe et TVA.
 * Utile quand la QR-facture ne donne que le total.
 */
export function splitGrossAmount(gross: number, vatRate: number) {
  if (vatRate <= 0) return { net: gross, vat: 0 };
  const net = Math.round(gross / (1 + vatRate / 100));
  return { net, vat: gross - net };
}
