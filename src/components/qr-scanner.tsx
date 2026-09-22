"use client";

import * as React from "react";
import jsQR from "jsqr";
import { motion, AnimatePresence } from "motion/react";
import {
  Camera,
  ImagePlus,
  Loader2,
  ScanLine,
  CheckCircle2,
  TriangleAlert,
  X,
  RotateCcw,
} from "lucide-react";
import { parseSwissQr, SwissQrError, type SwissQrData } from "@/lib/swiss-qr";
import { formatCHF } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ScanResult {
  file: File;
  previewUrl: string;
  qr: SwissQrData | null;
  /** Message expliquant pourquoi aucune QR-facture n'a été lue */
  qrError: string | null;
}

/**
 * Scanner de QR-facture suisse.
 *
 * Sur iPhone, `capture="environment"` ouvre directement l'appareil photo arrière.
 * Le décodage se fait entièrement dans le navigateur : la photo n'est envoyée
 * au serveur qu'au moment de l'enregistrement.
 */
export function QrScanner({
  onResult,
  onReset,
  result,
}: {
  onResult: (result: ScanResult) => void;
  onReset: () => void;
  result: ScanResult | null;
}) {
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = React.useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setScanning(true);

    const previewUrl = URL.createObjectURL(file);

    // Un PDF ne peut pas être décodé ici : il est simplement joint tel quel.
    if (file.type === "application/pdf") {
      onResult({
        file,
        previewUrl,
        qr: null,
        qrError:
          "PDF joint. La lecture automatique du QR ne fonctionne que sur une photo — saisis les montants à la main.",
      });
      setScanning(false);
      return;
    }

    try {
      const payload = await decodeQrFromImage(file);
      if (!payload) {
        onResult({
          file,
          previewUrl,
          qr: null,
          qrError:
            "Aucun QR code détecté. Cadre bien la partie basse de la facture, ou saisis les montants à la main.",
        });
        return;
      }

      try {
        onResult({ file, previewUrl, qr: parseSwissQr(payload), qrError: null });
      } catch (error) {
        onResult({
          file,
          previewUrl,
          qr: null,
          qrError:
            error instanceof SwissQrError
              ? error.message
              : "QR code illisible. Saisis les montants à la main.",
        });
      }
    } finally {
      setScanning(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (result) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-3"
      >
        <div className="relative rounded-[var(--radius-lg)] overflow-hidden border border-[var(--border)] bg-[var(--surface-2)]">
          {result.file.type === "application/pdf" ? (
            <div className="flex items-center gap-3 p-5">
              <span className="grid place-items-center size-12 rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--border)] text-[10px] font-semibold text-[var(--fg-subtle)]">
                PDF
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-medium truncate">{result.file.name}</p>
                <p className="text-[11px] text-[var(--fg-subtle)]">
                  {(result.file.size / 1024).toFixed(0)} Ko
                </p>
              </div>
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={result.previewUrl}
              alt="Facture scannée"
              className="w-full max-h-72 object-contain bg-black/20"
            />
          )}

          <button
            type="button"
            onClick={onReset}
            className="absolute top-2.5 right-2.5 grid place-items-center size-9 rounded-full bg-black/70 text-white backdrop-blur-sm"
            aria-label="Reprendre"
          >
            <X className="size-4" />
          </button>
        </div>

        {result.qr ? (
          <div className="flex items-start gap-3 p-3.5 rounded-[var(--radius-md)] bg-[var(--success-soft)] border border-[var(--success)]/30">
            <CheckCircle2 className="size-5 text-[var(--success)] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[var(--fg)]">
                QR-facture suisse reconnue
              </p>
              <p className="text-[12px] text-[var(--fg-muted)] mt-1 leading-relaxed">
                <strong className="text-[var(--fg)]">{result.qr.creditorName}</strong>
                {result.qr.amountCents !== null && (
                  <> · {formatCHF(result.qr.amountCents)}</>
                )}
                {result.qr.invoiceNumber && <> · facture {result.qr.invoiceNumber}</>}
                <br />
                Les champs ci-dessous ont été remplis automatiquement. Vérifie-les.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-3.5 rounded-[var(--radius-md)] bg-[var(--warning-soft)] border border-[var(--warning)]/30">
            <TriangleAlert className="size-5 text-[var(--warning)] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[13px] text-[var(--fg-muted)] leading-relaxed">
                {result.qrError}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2.5"
                onClick={onReset}
              >
                <RotateCcw />
                Reprendre la photo
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
        className="sr-only"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />

      <button
        type="button"
        disabled={scanning}
        onClick={() => cameraRef.current?.click()}
        className={cn(
          "relative w-full overflow-hidden",
          "flex flex-col items-center justify-center py-12 px-6",
          "rounded-[var(--radius-xl)] border-2 border-dashed",
          "transition-all duration-200 active:scale-[0.99]",
          scanning
            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
            : "border-[var(--border-strong)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]",
        )}
      >
        <AnimatePresence mode="wait">
          {scanning ? (
            <motion.span
              key="scan"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <Loader2 className="size-8 text-[var(--accent)] animate-spin" />
              <span className="text-[13px] font-medium mt-3">Lecture du QR code…</span>
            </motion.span>
          ) : (
            <motion.span
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <span className="relative grid place-items-center size-16 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] mb-4">
                <Camera className="size-7" />
                <span className="absolute inset-0 rounded-full animate-pulse-ring" />
              </span>
              <span className="text-[15px] font-semibold">Photographier la facture</span>
              <span className="text-[12px] text-[var(--fg-subtle)] mt-1.5 text-center max-w-xs leading-relaxed">
                Cadre la QR-facture en bas du document : le fournisseur, le montant
                et la référence se remplissent tout seuls.
              </span>
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="w-full"
        disabled={scanning}
        onClick={() => fileRef.current?.click()}
      >
        <ImagePlus />
        Choisir une image ou un PDF
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--fg-subtle)] pt-1">
        <ScanLine className="size-3.5" />
        Lecture effectuée sur l&apos;appareil — rien n&apos;est envoyé avant
        l&apos;enregistrement.
      </p>
    </div>
  );
}

/**
 * Décode un QR code depuis un fichier image.
 *
 * Les photos de téléphone sont très grandes : on tente plusieurs échelles,
 * de la plus rapide à la plus fidèle, et on s'arrête au premier succès.
 */
async function decodeQrFromImage(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  try {
    for (const maxSide of [1400, 2000, 900]) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);

      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

      const found = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth",
      });
      if (found?.data) return found.data;
    }
    return null;
  } finally {
    bitmap.close();
  }
}
