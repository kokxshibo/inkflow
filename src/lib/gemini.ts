import "server-only";
import { z } from "zod";
import { db } from "./db";
import { decryptSecret } from "./crypto";
import { EXPENSE_CATEGORY } from "./constants";
import { parseCHF } from "./money";
import type { ScanExtraction } from "./scan";

/**
 * Lecture des factures fournisseurs par Gemini Flash (API Gemini de Google).
 *
 * La clé API est saisie dans Réglages → Connexions et chiffrée en base. Le
 * modèle est `gemini-3.8-flash` (stable), remplaçable par GEMINI_MODEL.
 */

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
/** Adresse de l'API (remplaçable par GEMINI_API_BASE, par exemple pour un proxy). */
const API = process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com/v1beta";

export class GeminiError extends Error {}

export async function getGeminiKey() {
  const row = await db.integration.findUnique({ where: { channel: "gemini" } });
  return decryptSecret(row?.secret);
}

/** Traduit les erreurs de l'API en message compréhensible. */
function explain(status: number, body: { error?: { message?: string; status?: string } }) {
  const message = body.error?.message ?? "";
  if (/API key not valid|API_KEY_INVALID/i.test(message) || status === 401) {
    return "Clé Gemini refusée : vérifie-la dans Réglages → Connexions.";
  }
  if (status === 403) {
    return "Cette clé Gemini n'a pas accès à l'API (restrictions de la clé ou API non activée).";
  }
  if (status === 429) {
    return "Quota Gemini atteint pour le moment : réessaie dans une minute.";
  }
  if (status === 404) {
    return `Modèle ${GEMINI_MODEL} introuvable pour cette clé.`;
  }
  if (status >= 500) {
    return "Gemini est momentanément indisponible : réessaie dans quelques instants.";
  }
  return `Gemini : ${message || `erreur ${status}`}`;
}

/** Vérifie qu'une clé donne accès au modèle (appel gratuit, sans analyse). */
export async function testGeminiKey(key: string) {
  const response = await fetch(`${API}/models/${GEMINI_MODEL}`, {
    headers: { "x-goog-api-key": key },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new GeminiError(explain(response.status, await response.json().catch(() => ({}))));
  }
}

const CATEGORY_VALUES = EXPENSE_CATEGORY.map((category) => category.value);

/** Schéma de la réponse attendue (JSON Schema). */
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    documentType: {
      type: "string",
      enum: ["facture", "ticket", "recu", "autre"],
      description: "facture, ticket de caisse, reçu, ou autre document",
    },
    supplier: { type: "string", description: "Nom du fournisseur ou du créancier, tel qu'imprimé" },
    supplierAddress: { type: "string", description: "Adresse du fournisseur, sur une ligne" },
    invoiceNumber: { type: "string", description: "Numéro de facture ou de ticket" },
    invoiceDate: { type: "string", description: "Date du document, format AAAA-MM-JJ" },
    dueDate: { type: "string", description: "Date d'échéance, format AAAA-MM-JJ" },
    currency: { type: "string", description: "Devise du total, code ISO (CHF, EUR…)" },
    totalAmount: { type: "number", description: "Montant total à payer, TVA comprise" },
    vatRate: { type: "number", description: "Taux de TVA principal en pour cent (0 si aucune TVA)" },
    vatAmount: { type: "number", description: "Montant total de la TVA" },
    iban: { type: "string", description: "IBAN ou QR-IBAN du créancier, sans espaces" },
    reference: { type: "string", description: "Référence de paiement (QRR ou SCOR)" },
    category: { type: "string", enum: CATEGORY_VALUES, description: "Catégorie de la dépense" },
    description: {
      type: "string",
      description: "Résumé en français de ce qui a été acheté, 80 caractères maximum",
    },
    paid: {
      type: "boolean",
      description: "Vrai si le document indique que c'est déjà payé (ticket de caisse, « payé »)",
    },
    lineItems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          unitPrice: { type: "number" },
          amount: { type: "number" },
        },
        required: ["description", "quantity", "unitPrice", "amount"],
      },
    },
    warnings: {
      type: "array",
      items: { type: "string" },
      description: "En français : ce qui est illisible, incertain ou à vérifier",
    },
    confidence: { type: "string", enum: ["haute", "moyenne", "basse"] },
  },
  required: [
    "documentType",
    "supplier",
    "invoiceNumber",
    "invoiceDate",
    "dueDate",
    "currency",
    "totalAmount",
    "vatRate",
    "vatAmount",
    "iban",
    "reference",
    "category",
    "description",
    "paid",
    "lineItems",
    "warnings",
    "confidence",
  ],
};

const PROMPT = `Tu lis une facture, un ticket de caisse ou un reçu reçu par un tatoueur indépendant en Suisse.
Extrais les informations exactement comme elles sont imprimées, sans rien inventer.
- Montants : nombres en francs avec un point décimal (ex. 1250.50), jamais de séparateur de milliers.
- Dates : format AAAA-MM-JJ.
- Information absente ou illisible : chaîne vide, ou 0 pour un nombre, et explique-le dans "warnings".
- "vatRate" : 8.1, 2.6, 3.8 (taux suisses) ou le taux imprimé ; 0 si le document n'indique pas de TVA.
- "category", au choix : ${EXPENSE_CATEGORY.map((category) => `${category.value} (${category.label})`).join(", ")}.
- "lineItems" : les lignes du document (désignation, quantité, prix unitaire, montant de la ligne).
- "confidence" : ta confiance globale dans la lecture.
Réponds uniquement avec l'objet JSON demandé.`;

const numberField = z.coerce.number().catch(0);
const stringField = z.coerce.string().catch("").transform((value) => value.trim());
const dayField = stringField.transform((value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime()) ? value : "",
);

const resultSchema = z.object({
  documentType: z.enum(["facture", "ticket", "recu", "autre"]).catch("autre"),
  supplier: stringField,
  supplierAddress: stringField.optional().default(""),
  invoiceNumber: stringField,
  invoiceDate: dayField,
  dueDate: dayField,
  currency: stringField.transform((value) => value.toUpperCase() || "CHF"),
  totalAmount: numberField,
  vatRate: numberField,
  vatAmount: numberField,
  iban: stringField.transform((value) => value.replace(/\s+/g, "").toUpperCase()),
  reference: stringField.transform((value) => value.replace(/\s+/g, "")),
  category: z.enum(CATEGORY_VALUES as [string, ...string[]]).catch("other"),
  description: stringField.transform((value) => value.slice(0, 160)),
  paid: z.coerce.boolean().catch(false),
  lineItems: z
    .array(
      z.object({
        description: stringField,
        quantity: numberField,
        unitPrice: numberField,
        amount: numberField,
      }),
    )
    .catch([]),
  warnings: z.array(stringField).catch([]),
  confidence: z.enum(["haute", "moyenne", "basse"]).catch("moyenne"),
});

const toCents = (francs: number) => parseCHF(Math.round(francs * 100) / 100);

interface GeminiPart {
  text?: string;
  thought?: boolean;
}
interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
}

async function generate(key: string, body: object) {
  const response = await fetch(`${API}/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  const data = (await response.json().catch(() => ({}))) as GeminiResponse;
  return { response, data };
}

/**
 * Analyse une photo ou un PDF de facture et renvoie sa version numérisée.
 * Les montants sont convertis en centimes.
 */
export async function analyzeInvoice(file: { data: Buffer; mimeType: string }): Promise<ScanExtraction> {
  const key = await getGeminiKey();
  if (!key) {
    throw new GeminiError("Analyse IA non configurée : ajoute ta clé Gemini dans Réglages → Connexions.");
  }

  const contents = [
    {
      role: "user",
      parts: [
        { inlineData: { mimeType: file.mimeType, data: file.data.toString("base64") } },
        { text: PROMPT },
      ],
    },
  ];

  // Format actuel de la réponse JSON (responseFormat) ; si la clé tombe sur une
  // version de l'API qui ne le connaît pas, on repasse à l'ancien format.
  let { response, data } = await generate(key, {
    contents,
    generationConfig: {
      responseFormat: { text: { mimeType: "application/json", schema: RESPONSE_SCHEMA } },
    },
  });
  if (response.status === 400 && /responseFormat|Unknown name|Invalid JSON payload/i.test(data.error?.message ?? "")) {
    ({ response, data } = await generate(key, {
      contents,
      generationConfig: { responseMimeType: "application/json", responseJsonSchema: RESPONSE_SCHEMA },
    }));
  }
  if (!response.ok) throw new GeminiError(explain(response.status, data));

  if (data.promptFeedback?.blockReason) {
    throw new GeminiError("Gemini a refusé d'analyser ce document.");
  }
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((part) => part.text && !part.thought)
    .map((part) => part.text)
    .join("")
    .trim()
    // Au cas où la réponse serait entourée d'un bloc de code.
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  if (!text) throw new GeminiError("Gemini n'a rien pu lire sur ce document.");

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new GeminiError("Réponse de Gemini illisible : réessaie avec une photo plus nette.");
  }
  const result = resultSchema.parse(raw);

  const warnings = [...result.warnings.filter(Boolean)];
  if (result.currency && result.currency !== "CHF") {
    warnings.unshift(
      `Montant en ${result.currency} : convertis-le en francs avant d'enregistrer.`,
    );
  }

  return {
    documentType: result.documentType,
    supplier: result.supplier,
    supplierAddress: result.supplierAddress,
    invoiceNumber: result.invoiceNumber,
    invoiceDate: result.invoiceDate,
    dueDate: result.dueDate,
    currency: result.currency,
    total: result.totalAmount > 0 ? toCents(result.totalAmount) : null,
    vatRate: result.vatRate >= 0 ? result.vatRate : null,
    vatAmount: result.vatAmount > 0 ? toCents(result.vatAmount) : null,
    iban: result.iban,
    reference: result.reference,
    category: result.category,
    description: result.description,
    paid: result.paid,
    lines: result.lineItems
      .filter((line) => line.description || line.amount)
      .slice(0, 60)
      .map((line) => ({
        description: line.description.slice(0, 200),
        quantity: line.quantity,
        unitPrice: toCents(line.unitPrice),
        amount: toCents(line.amount),
      })),
    warnings: warnings.slice(0, 10),
    confidence: result.confidence,
    model: GEMINI_MODEL,
    analyzedAt: new Date().toISOString(),
  };
}
