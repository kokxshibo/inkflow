"use client";

import * as React from "react";
import type { ProjectImage } from "@prisma/client";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ImagePlus, Trash2, X, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { uploadProjectImage, deleteProjectImage } from "../actions";
import { IMAGE_KIND, labelOf } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function ProjectGallery({
  projectId,
  images,
}: {
  projectId: string;
  images: ProjectImage[];
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [kind, setKind] = React.useState("reference");
  const [uploading, setUploading] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [lightbox, setLightbox] = React.useState<number | null>(null);
  const [, startTransition] = React.useTransition();

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("kind", kind);
    for (const file of list) formData.append("files", file);

    try {
      const result = await uploadProjectImage(formData);
      if (result?.error) toast.error(result.error);
      else
        toast.success(
          `${result?.success} image${(result?.success ?? 0) > 1 ? "s" : ""} ajoutée${(result?.success ?? 0) > 1 ? "s" : ""}`,
        );
    } catch {
      toast.error("L'envoi a échoué");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(imageId: string) {
    startTransition(async () => {
      await deleteProjectImage(imageId);
      toast.success("Image supprimée");
      setLightbox(null);
    });
  }

  // Navigation clavier dans la visionneuse
  React.useEffect(() => {
    if (lightbox === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") setLightbox((i) => ((i ?? 0) + 1) % images.length);
      if (event.key === "ArrowLeft")
        setLightbox((i) => ((i ?? 0) - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, images.length]);

  const grouped = IMAGE_KIND.map((option) => ({
    ...option,
    images: images.filter((image) => image.kind === option.value),
  })).filter((group) => group.images.length > 0);

  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Images</CardTitle>
            <p className="text-[13px] text-[var(--fg-muted)] mt-0.5">
              Références, maquettes, photos de séance et de cicatrisation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              options={IMAGE_KIND.map((o) => ({ value: o.value, label: o.label }))}
              className="h-9 text-[13px] w-auto min-w-[150px]"
              aria-label="Type d'image à ajouter"
            />
            <Button
              size="sm"
              variant="primary"
              onClick={() => inputRef.current?.click()}
              loading={uploading}
            >
              <ImagePlus />
              Ajouter
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            className="sr-only"
            onChange={(event) => event.target.files && upload(event.target.files)}
          />

          {images.length === 0 ? (
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                upload(event.dataTransfer.files);
              }}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center py-14 px-6 rounded-[var(--radius-lg)]",
                "border border-dashed cursor-pointer transition-all duration-200",
                dragging
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] scale-[1.01]"
                  : "border-[var(--border-strong)] hover:border-[var(--fg-subtle)] hover:bg-[var(--bg-subtle)]",
              )}
            >
              {uploading ? (
                <Loader2 className="size-6 text-[var(--accent)] animate-spin" />
              ) : (
                <ImagePlus className="size-6 text-[var(--fg-subtle)]" />
              )}
              <p className="text-[13px] font-medium mt-3">
                Glisse des images ici, ou clique pour parcourir
              </p>
              <p className="text-[11px] text-[var(--fg-subtle)] mt-1">
                JPG, PNG, WebP ou AVIF · 8 Mo maximum par fichier
              </p>
            </div>
          ) : (
            <div
              className="space-y-6"
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                upload(event.dataTransfer.files);
              }}
            >
              {grouped.map((group) => (
                <div key={group.value}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)] mb-2.5">
                    {group.label} · {group.images.length}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {group.images.map((image) => {
                      const index = images.findIndex((i) => i.id === image.id);
                      return (
                        <button
                          key={image.id}
                          type="button"
                          onClick={() => setLightbox(index)}
                          className="group relative aspect-square rounded-[var(--radius-md)] overflow-hidden border border-[var(--border)] bg-[var(--surface-2)]"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image.url}
                            alt={image.caption ?? ""}
                            loading="lazy"
                            className="size-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
                          />
                          <span className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {dragging && (
                <div className="py-8 rounded-[var(--radius-lg)] border border-dashed border-[var(--accent)] bg-[var(--accent-soft)] grid place-items-center animate-fade-in">
                  <p className="text-[13px] text-[var(--accent)]">
                    Relâche pour ajouter en tant que « {labelOf(IMAGE_KIND, kind)} »
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visionneuse */}
      <Dialog
        open={lightbox !== null}
        onOpenChange={(open) => !open && setLightbox(null)}
      >
        <DialogContent size="xl" hideClose className="p-0 bg-transparent border-0 shadow-none">
          {lightbox !== null && images[lightbox] && (
            <div className="relative">
              <AnimatePresence mode="wait">
                <motion.img
                  key={images[lightbox].id}
                  src={images[lightbox].url}
                  alt=""
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="w-full max-h-[75vh] object-contain rounded-[var(--radius-lg)]"
                />
              </AnimatePresence>

              <div className="absolute top-3 left-3">
                <Badge tone="neutral" size="md" className="bg-black/70 text-white border-white/20">
                  {labelOf(IMAGE_KIND, images[lightbox].kind)}
                </Badge>
              </div>

              <div className="absolute top-3 right-3 flex items-center gap-2">
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => remove(images[lightbox].id)}
                  className="bg-black/70 border-white/20 text-white hover:bg-[var(--danger)]"
                  aria-label="Supprimer l'image"
                >
                  <Trash2 />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => setLightbox(null)}
                  className="bg-black/70 border-white/20 text-white"
                  aria-label="Fermer"
                >
                  <X />
                </Button>
              </div>

              {images.length > 1 && (
                <>
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={() =>
                      setLightbox((i) => ((i ?? 0) - 1 + images.length) % images.length)
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/70 border-white/20 text-white"
                    aria-label="Image précédente"
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => setLightbox((i) => ((i ?? 0) + 1) % images.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/70 border-white/20 text-white"
                    aria-label="Image suivante"
                  >
                    <ChevronRight />
                  </Button>
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/70 text-white text-[11px] tabular">
                    {lightbox + 1} / {images.length}
                  </span>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
