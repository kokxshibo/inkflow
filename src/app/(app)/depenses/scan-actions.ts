"use server";

import { requireSession } from "@/lib/auth";
import { GeminiError, analyzeInvoice } from "@/lib/gemini";
import type { ScanExtraction } from "@/lib/scan";

export interface ScanAnalysis {
  extraction?: ScanExtraction;
  error?: string;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
const MAX_SIZE = 10 * 1024 * 1024;

/** Envoie le scan à Gemini et renvoie sa version numérisée, à valider. */
export async function analyzeScan(formData: FormData): Promise<ScanAnalysis> {
  await requireSession();

  const file = formData.get("scan");
  if (!(file instanceof File) || file.size === 0) return { error: "Aucun document reçu." };
  if (file.size > MAX_SIZE) return { error: "Document trop lourd pour l'analyse (10 Mo maximum)." };
  if (!ACCEPTED.includes(file.type)) return { error: "Format non pris en charge : photo ou PDF." };

  try {
    const extraction = await analyzeInvoice({
      data: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
    });
    return { extraction };
  } catch (error) {
    if (error instanceof GeminiError) return { error: error.message };
    console.error("[gemini]", error);
    return { error: "L'analyse a échoué. Tu peux remplir la dépense à la main, le scan reste joint." };
  }
}
