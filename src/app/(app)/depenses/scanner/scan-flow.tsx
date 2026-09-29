"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  RotateCcw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { DocumentScanner, type ScannedDocument } from "@/components/document-scanner";
import { ScanDigest } from "@/components/scan-digest";
import { parseSwissQr, SwissQrError, type SwissQrData } from "@/lib/swiss-qr";
import { mergePrefill, type ScanExtraction } from "@/lib/scan";
import { formatCHF } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyzeScan } from "../scan-actions";
import { ExpenseForm } from "../expense-form";

type Analysis =
  | { status: "off" }
  | { status: "running" }
  | { status: "done"; extraction: ScanExtraction }
  | { status: "error"; message: string };

/**
 * Scan → lecture (QR-facture sur l'appareil, puis IA) → validation.
 * Rien n'est enregistré avant « Valider et enregistrer » ; le scan est joint
 * à la dépense et la version numérisée gardée à côté.
 */
export function ScanFlow({
  vatEnabled,
  defaultVatRate,
  aiEnabled,
}: {
  vatEnabled: boolean;
  defaultVatRate: number;
  aiEnabled: boolean;
}) {
  const [scan, setScan] = React.useState<ScannedDocument | null>(null);
  const [qr, setQr] = React.useState<SwissQrData | null>(null);
  const [qrNote, setQrNote] = React.useState<string | null>(null);
  const [analysis, setAnalysis] = React.useState<Analysis>({ status: "off" });
  // Chaque nouveau scan repart d'un formulaire neuf.
  const [scanId, setScanId] = React.useState(0);

  // Libère l'aperçu quand on reprend un scan ou qu'on quitte la page.
  React.useEffect(() => {
    return () => {
      if (scan?.previewUrl) URL.revokeObjectURL(scan.previewUrl);
    };
  }, [scan?.previewUrl]);

  async function handleScanned(scanned: ScannedDocument) {
    setScan(scanned);
    setScanId((id) => id + 1);

    let decoded: SwissQrData | null = null;
    if (scanned.qrPayload) {
      try {
        decoded = parseSwissQr(scanned.qrPayload);
        setQrNote(null);
      } catch (error) {
        setQrNote(error instanceof SwissQrError ? error.message : "QR code illisible.");
      }
    }
    setQr(decoded);

    if (!aiEnabled) {
      setAnalysis({ status: "off" });
      return;
    }
    setAnalysis({ status: "running" });
    const data = new FormData();
    data.append("scan", scanned.file);
    try {
      const result = await analyzeScan(data);
      setAnalysis(
        result.extraction
          ? { status: "done", extraction: result.extraction }
          : { status: "error", message: result.error ?? "L'analyse a échoué." },
      );
    } catch {
      setAnalysis({ status: "error", message: "Connexion au serveur impossible : réessaie." });
    }
  }

  function restart() {
    if (scan?.previewUrl) URL.revokeObjectURL(scan.previewUrl);
    setScan(null);
    setQr(null);
    setQrNote(null);
    setAnalysis({ status: "off" });
  }

  if (!scan) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <DocumentScanner onScanned={handleScanned} />
        {!aiEnabled && (
          <p className="flex items-start gap-2 text-[12px] text-[var(--fg-subtle)] leading-relaxed">
            <Sparkles className="size-3.5 shrink-0 mt-0.5" />
            <span>
              Seule la QR-facture est lue pour l&apos;instant. Pour que toute la facture soit
              lue (fournisseur, dates, montants, lignes), active l&apos;analyse IA dans{" "}
              <Link href="/reglages/connexions" className="text-[var(--accent)] hover:underline">
                Réglages → Connexions
              </Link>
              .
            </span>
          </p>
        )}
      </div>
    );
  }

  const extraction = analysis.status === "done" ? analysis.extraction : null;
  const isPdf = scan.file.type === "application/pdf";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start">
      {/* Le scan reste sous les yeux pendant la vérification. */}
      <div className="space-y-4 lg:sticky lg:top-20">
        <Card className="overflow-hidden">
          <div className="relative bg-black/30">
            {isPdf ? (
              <object data={scan.previewUrl} type="application/pdf" className="w-full h-[50vh]">
                <p className="p-5 text-[13px]">{scan.file.name}</p>
              </object>
            ) : (
              <a href={scan.previewUrl} target="_blank" rel="noopener noreferrer" title="Voir en grand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={scan.previewUrl}
                  alt="Facture scannée"
                  className="w-full max-h-[55vh] object-contain"
                />
              </a>
            )}
          </div>
          <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-2">
            <a
              href={scan.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] text-[var(--accent)] hover:underline"
            >
              <ExternalLink className="size-3.5" />
              Voir le scan en grand
            </a>
            <Button type="button" variant="secondary" size="sm" onClick={restart}>
              <RotateCcw />
              Reprendre le scan
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Version numérisée</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {qr ? (
              <p className="flex items-start gap-2 text-[12px] leading-relaxed">
                <CheckCircle2 className="size-4 text-[var(--success)] shrink-0" />
                <span>
                  QR-facture suisse reconnue : <strong>{qr.creditorName}</strong>
                  {qr.amountCents != null && <> · {formatCHF(qr.amountCents)}</>}. IBAN, montant
                  et référence en sont repris tels quels.
                </span>
              </p>
            ) : qrNote ? (
              <p className="text-[12px] text-[var(--fg-muted)]">{qrNote}</p>
            ) : null}

            {analysis.status === "running" && (
              <p className="flex items-center gap-2 text-[13px]">
                <Loader2 className="size-4 animate-spin text-[var(--accent)]" />
                Lecture de la facture par l&apos;IA…
              </p>
            )}
            {analysis.status === "error" && (
              <p className="flex items-start gap-2 text-[12px] leading-relaxed">
                <TriangleAlert className="size-4 text-[var(--warning)] shrink-0" />
                <span>{analysis.message} Remplis ou corrige les champs à la main : le scan reste joint.</span>
              </p>
            )}
            {analysis.status === "off" && !qr && (
              <p className="text-[12px] text-[var(--fg-muted)] leading-relaxed">
                Aucune lecture automatique : remplis les champs en t&apos;aidant du scan, il sera
                joint à la dépense.
              </p>
            )}
            {extraction && <ScanDigest extraction={extraction} />}
          </CardContent>
        </Card>
      </div>

      <div className="min-w-0">
        {analysis.status === "running" ? (
          <Card className="p-10 flex flex-col items-center text-center">
            <Loader2 className="size-7 animate-spin text-[var(--accent)]" />
            <p className="text-[14px] font-medium mt-3">Lecture de la facture…</p>
            <p className="text-[12px] text-[var(--fg-subtle)] mt-1">
              Quelques secondes : les champs se rempliront tout seuls.
            </p>
          </Card>
        ) : (
          <motion.div
            key={scanId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            <div className="flex items-start gap-2.5 p-3.5 rounded-[var(--radius-md)] bg-[var(--info-soft)] border border-[var(--info)]/20">
              <Sparkles className="size-4 text-[var(--info)] shrink-0 mt-0.5" />
              <p className="text-[13px] leading-relaxed">
                Vérifie chaque champ en le comparant au scan, corrige si besoin, puis valide :
                rien n&apos;est enregistré avant.
              </p>
            </div>
            <ExpenseForm
              key={`${scanId}-${analysis.status}`}
              prefill={mergePrefill(qr, extraction)}
              scanData={extraction ? JSON.stringify(extraction) : null}
              attachmentFile={scan.file}
              vatEnabled={vatEnabled}
              defaultVatRate={defaultVatRate}
              cancelHref="/depenses"
              submitLabel="Valider et enregistrer"
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
