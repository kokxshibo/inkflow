"use client";

import * as React from "react";
import { motion } from "motion/react";
import { QrScanner, type ScanResult } from "@/components/qr-scanner";
import { ExpenseForm } from "../expense-form";

/**
 * Enchaînement scan → formulaire.
 * Le fichier photographié reste côté navigateur jusqu'à l'enregistrement,
 * puis part en pièce jointe avec le reste du formulaire.
 */
export function ScanFlow({
  vatEnabled,
  defaultVatRate,
}: {
  vatEnabled: boolean;
  defaultVatRate: number;
}) {
  const [result, setResult] = React.useState<ScanResult | null>(null);

  // Libère l'aperçu quand on reprend une photo ou qu'on quitte la page.
  React.useEffect(() => {
    return () => {
      if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl);
    };
  }, [result?.previewUrl]);

  return (
    <div className="space-y-6">
      <QrScanner
        result={result}
        onResult={setResult}
        onReset={() => {
          if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl);
          setResult(null);
        }}
      />

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        >
          <ExpenseForm
            scanned={result.qr}
            attachmentFile={result.file}
            vatEnabled={vatEnabled}
            defaultVatRate={defaultVatRate}
            cancelHref="/depenses"
          />
        </motion.div>
      )}
    </div>
  );
}
