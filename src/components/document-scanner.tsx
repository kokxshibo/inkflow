"use client";

import * as React from "react";
import {
  Camera,
  Check,
  Crop,
  ImagePlus,
  Loader2,
  RotateCcw,
  ScanLine,
  X,
} from "lucide-react";
import {
  canvasToFile,
  decodeQr,
  defaultQuad,
  detectDocument,
  enhance,
  loadImage,
  warpPerspective,
  type Quad,
  type ScanFilter,
} from "@/lib/image-scan";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ScannedDocument {
  /** Scan final : image redressée (JPEG) ou PDF importé tel quel */
  file: File;
  previewUrl: string;
  /** Contenu brut de la QR-facture, si une a été lue */
  qrPayload: string | null;
}

type Step =
  | { name: "start" }
  | { name: "camera" }
  | { name: "crop"; source: HTMLCanvasElement; original: File; imageUrl: string }
  | { name: "working"; message: string };

/**
 * Scanner de factures : caméra en direct avec cadre de visée (ou appareil
 * photo du téléphone, ou import), détection de la feuille, coins ajustables,
 * redressement et amélioration de la lisibilité. Tout se passe sur l'appareil.
 */
export function DocumentScanner({ onScanned }: { onScanned: (document: ScannedDocument) => void }) {
  const [step, setStep] = React.useState<Step>({ name: "start" });
  const [error, setError] = React.useState<string | null>(null);
  const nativeCameraRef = React.useRef<HTMLInputElement>(null);
  const importRef = React.useRef<HTMLInputElement>(null);

  async function openImage(file: File | Blob, name = "facture.jpg") {
    setError(null);
    const original =
      file instanceof File ? file : new File([file], name, { type: file.type || "image/jpeg" });

    // Un PDF est gardé tel quel : l'IA le lit directement.
    if (original.type === "application/pdf") {
      onScanned({ file: original, previewUrl: URL.createObjectURL(original), qrPayload: null });
      return;
    }

    setStep({ name: "working", message: "Préparation de l'image…" });
    try {
      const source = await loadImage(original);
      setStep({
        name: "crop",
        source,
        original,
        imageUrl: source.toDataURL("image/jpeg", 0.85),
      });
    } catch {
      setStep({ name: "start" });
      setError("Image illisible. Essaie une autre photo (JPG, PNG, HEIC) ou un PDF.");
    }
  }

  async function finish(source: HTMLCanvasElement, original: File, quad: Quad | null, filter: ScanFilter) {
    setStep({ name: "working", message: "Redressement du scan…" });
    // Laisse le temps d'afficher le message avant le calcul.
    await new Promise((resolve) => setTimeout(resolve, 30));
    try {
      const result = quad ? warpPerspective(source, quad) : copyCanvas(source);
      enhance(result, filter);
      const file = await canvasToFile(result, scanName(original.name));
      setStep({ name: "working", message: "Recherche d'une QR-facture…" });
      // La QR se lit mieux sur le scan redressé ; sinon on tente la photo d'origine.
      const qrPayload = (await decodeQr(result)) ?? (await decodeQr(original));
      onScanned({ file, previewUrl: URL.createObjectURL(file), qrPayload });
    } catch {
      setStep({ name: "start" });
      setError("Le traitement de l'image a échoué. Réessaie avec une autre photo.");
    }
  }

  const hiddenInputs = (
    <>
      <input
        ref={nativeCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) openImage(file);
        }}
      />
      <input
        ref={importRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) openImage(file);
        }}
      />
    </>
  );

  if (step.name === "camera") {
    return (
      <>
        {hiddenInputs}
        <LiveCamera
          onCapture={(blob) => openImage(blob, `scan-${Date.now()}.jpg`)}
          onCancel={() => setStep({ name: "start" })}
          onUnavailable={() => {
            setStep({ name: "start" });
            nativeCameraRef.current?.click();
          }}
        />
      </>
    );
  }

  if (step.name === "crop") {
    return (
      <>
        {hiddenInputs}
        <CropEditor
          source={step.source}
          imageUrl={step.imageUrl}
          onCancel={() => setStep({ name: "start" })}
          onConfirm={(quad, filter) => finish(step.source, step.original, quad, filter)}
        />
      </>
    );
  }

  if (step.name === "working") {
    return (
      <div className="flex flex-col items-center justify-center py-16 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
        <Loader2 className="size-8 text-[var(--accent)] animate-spin" />
        <p className="text-[13px] font-medium mt-3">{step.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {hiddenInputs}
      {error && (
        <p role="alert" className="text-[13px] text-[var(--danger)] text-center">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => setStep({ name: "camera" })}
        className={cn(
          "relative w-full overflow-hidden flex flex-col items-center justify-center py-12 px-6",
          "rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--border-strong)]",
          "transition-all duration-200 active:scale-[0.99] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]",
        )}
      >
        <span className="relative grid place-items-center size-16 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] mb-4">
          <ScanLine className="size-7" />
          <span className="absolute inset-0 rounded-full animate-pulse-ring" />
        </span>
        <span className="text-[15px] font-semibold">Scanner une facture</span>
        <span className="text-[12px] text-[var(--fg-subtle)] mt-1.5 text-center max-w-xs leading-relaxed">
          Pose la feuille à plat, bien éclairée : les bords sont détectés, le scan est
          redressé et lu automatiquement.
        </span>
      </button>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <Button type="button" variant="secondary" size="lg" onClick={() => nativeCameraRef.current?.click()}>
          <Camera />
          Appareil photo du téléphone
        </Button>
        <Button type="button" variant="secondary" size="lg" onClick={() => importRef.current?.click()}>
          <ImagePlus />
          Importer une image ou un PDF
        </Button>
      </div>
    </div>
  );
}

function copyCanvas(source: HTMLCanvasElement) {
  const copy = document.createElement("canvas");
  copy.width = source.width;
  copy.height = source.height;
  copy.getContext("2d")!.drawImage(source, 0, 0);
  return copy;
}

function scanName(original: string) {
  const base = original.replace(/\.[^.]+$/, "") || "facture";
  return `${base}-scan.jpg`;
}

/* ─────────────────────────── Caméra en direct ─────────────────────────── */

function LiveCamera({
  onCapture,
  onCancel,
  onUnavailable,
}: {
  onCapture: (blob: Blob) => void;
  onCancel: () => void;
  /** Pas d'accès caméra dans le navigateur : on passe à l'appareil photo natif. */
  onUnavailable: () => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        onUnavailable();
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 3840 },
            height: { ideal: 2160 },
          },
        });
        if (cancelled) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setReady(true);
      } catch {
        if (!cancelled) onUnavailable();
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob((blob) => blob && onCapture(blob), "image/jpeg", 0.92);
  }

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-xl)] bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        className="block w-full max-h-[70vh] object-contain"
      />
      {/* Cadre de visée au format A4 */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
        <div className="relative h-[82%] aspect-[1/1.414] max-w-[88%] rounded-[var(--radius-md)] shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
          {["top-0 left-0 border-t-2 border-l-2", "top-0 right-0 border-t-2 border-r-2", "bottom-0 left-0 border-b-2 border-l-2", "bottom-0 right-0 border-b-2 border-r-2"].map(
            (corner) => (
              <span key={corner} className={cn("absolute size-6 border-white rounded-[4px]", corner)} />
            ),
          )}
        </div>
      </div>
      {!ready && (
        <div className="absolute inset-0 grid place-items-center">
          <Loader2 className="size-7 text-white animate-spin" />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-4 bg-gradient-to-t from-black/70 to-transparent">
        <button
          type="button"
          onClick={onCancel}
          className="grid place-items-center size-11 rounded-full bg-white/15 text-white backdrop-blur"
          aria-label="Annuler"
        >
          <X className="size-5" />
        </button>
        <button
          type="button"
          onClick={capture}
          disabled={!ready}
          className="size-[68px] rounded-full border-4 border-white bg-white/25 active:scale-95 transition-transform disabled:opacity-50"
          aria-label="Prendre la photo"
        />
        <span className="size-11" aria-hidden />
      </div>
    </div>
  );
}

/* ─────────────────────────── Recadrage ─────────────────────────── */

function CropEditor({
  source,
  imageUrl,
  onCancel,
  onConfirm,
}: {
  source: HTMLCanvasElement;
  imageUrl: string;
  onCancel: () => void;
  onConfirm: (quad: Quad | null, filter: ScanFilter) => void;
}) {
  const width = source.width;
  const height = source.height;
  const [quad, setQuad] = React.useState<Quad>(() => detectDocument(source));
  const [filter, setFilter] = React.useState<ScanFilter>("color");
  const [dragging, setDragging] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const ratio = width / height;
  const handle = Math.max(width, height) * 0.022;

  function toImage(event: React.PointerEvent) {
    const box = svgRef.current!.getBoundingClientRect();
    return {
      x: Math.min(width, Math.max(0, ((event.clientX - box.left) / box.width) * width)),
      y: Math.min(height, Math.max(0, ((event.clientY - box.top) / box.height) * height)),
    };
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-[var(--fg-muted)] text-center">
        Ajuste les quatre coins sur les bords de la facture.
      </p>
      <div
        className="relative mx-auto touch-none select-none rounded-[var(--radius-md)] overflow-hidden bg-black"
        style={{ aspectRatio: String(ratio), width: `min(100%, calc(62vh * ${ratio}))` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Photo à recadrer" className="absolute inset-0 size-full" draggable={false} />
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
          onPointerMove={(event) => {
            if (dragging === null) return;
            const point = toImage(event);
            setQuad((current) => current.map((corner, index) => (index === dragging ? point : corner)) as Quad);
          }}
          onPointerUp={() => setDragging(null)}
          onPointerCancel={() => setDragging(null)}
        >
          <path
            d={`M0,0 H${width} V${height} H0 Z M${quad.map((p) => `${p.x},${p.y}`).join(" L")} Z`}
            fill="rgba(0,0,0,0.45)"
            fillRule="evenodd"
          />
          <polygon
            points={quad.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={handle * 0.18}
          />
          {quad.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={handle}
              fill="var(--accent)"
              fillOpacity={0.35}
              stroke="#ffffff"
              strokeWidth={handle * 0.16}
              className="cursor-grab"
              onPointerDown={(event) => {
                event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
                setDragging(index);
              }}
            />
          ))}
        </svg>
      </div>

      <div className="flex justify-center">
        <div
          role="radiogroup"
          aria-label="Rendu du scan"
          className="inline-flex p-1 gap-1 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border)]"
        >
          {(
            [
              ["color", "Couleur"],
              ["bw", "Noir et blanc"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "h-8 px-3 rounded-[var(--radius-sm)] text-[13px] font-medium transition-colors",
                filter === value
                  ? "bg-[var(--surface)] text-[var(--fg)] shadow-[var(--shadow-sm)]"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3">
        <Button type="button" variant="ghost" onClick={onCancel}>
          <RotateCcw />
          Reprendre
        </Button>
        <Button type="button" variant="secondary" onClick={() => setQuad(defaultQuad(width, height, 0))}>
          <Crop />
          Photo entière
        </Button>
        <Button type="button" variant="primary" onClick={() => onConfirm(quad, filter)}>
          <Check />
          Valider le scan
        </Button>
      </div>
    </div>
  );
}
