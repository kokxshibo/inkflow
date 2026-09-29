import "server-only";
import { put, del } from "@vercel/blob";
import { writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { randomToken } from "./utils";

/**
 * Stockage des fichiers téléversés.
 *
 * Sur Vercel, le système de fichiers est en lecture seule : les fichiers vont
 * dans Vercel Blob. Sinon ils vont sur le disque, dans UPLOAD_DIR (sur le VPS,
 * servi directement par nginx sous /uploads/) ou à défaut dans public/uploads/.
 * L'appelant n'a pas à savoir lequel des deux est utilisé.
 */

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic"];
const DOCUMENT_TYPES = [...IMAGE_TYPES, "application/pdf"];
const MAX_SIZE = 12 * 1024 * 1024; // 12 Mo

export function isBlobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Dossier disque correspondant à l'URL /uploads/. En production, Next ne sert
 * pas les fichiers ajoutés à public/ après le build : sur le VPS, UPLOAD_DIR
 * pointe vers un dossier que nginx sert lui-même.
 */
export function uploadRoot() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
}

/** Écrit un contenu déjà en mémoire sur le disque et renvoie son URL /uploads/… */
export async function storeBuffer(
  content: Buffer,
  folder: string,
  filename: string,
): Promise<string> {
  const directory = path.join(uploadRoot(), folder);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), content);
  return `/uploads/${folder}/${filename}`;
}

export interface StoredFile {
  url: string;
  name: string;
  contentType: string;
  size: number;
}

export class UploadError extends Error {}

function extensionFor(type: string) {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/heic": "heic",
    "application/pdf": "pdf",
  };
  return map[type] ?? "bin";
}

/**
 * Enregistre un fichier et renvoie son URL publique.
 * `folder` sert à ranger les fichiers (ex. "depenses", "projets/<id>").
 */
export async function storeFile(
  file: File,
  folder: string,
  options: { allowPdf?: boolean } = {},
): Promise<StoredFile> {
  const allowed = options.allowPdf ? DOCUMENT_TYPES : IMAGE_TYPES;

  if (file.size === 0) {
    throw new UploadError("Le fichier est vide.");
  }
  if (file.size > MAX_SIZE) {
    throw new UploadError("Fichier trop lourd — 12 Mo maximum.");
  }
  if (!allowed.includes(file.type)) {
    throw new UploadError(
      options.allowPdf
        ? "Format accepté : JPG, PNG, WebP, HEIC ou PDF."
        : "Format accepté : JPG, PNG, WebP ou HEIC.",
    );
  }

  const filename = `${randomToken(20)}.${extensionFor(file.type)}`;
  const key = `${folder}/${filename}`;

  if (isBlobConfigured()) {
    const blob = await put(key, file, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
    });
    return {
      url: blob.url,
      name: file.name,
      contentType: file.type,
      size: file.size,
    };
  }

  // Sur Vercel, le disque est en lecture seule : sans Blob, rien ne peut être écrit.
  if (process.env.VERCEL) {
    throw new UploadError(
      "Le stockage de fichiers n'est pas encore activé. Dans Vercel : Storage → Blob → connecter au projet, puis redéployer.",
    );
  }

  // Disque : <uploadRoot>/<folder>/<filename>
  const url = await storeBuffer(Buffer.from(await file.arrayBuffer()), folder, filename);

  return {
    url,
    name: file.name,
    contentType: file.type,
    size: file.size,
  };
}

/** Supprime un fichier. Une erreur de suppression n'est jamais bloquante. */
export async function removeFile(url: string): Promise<void> {
  try {
    if (url.startsWith("http")) {
      if (isBlobConfigured()) await del(url);
      return;
    }
    const relative = url.replace(/^\/uploads\//, "");
    await unlink(path.join(uploadRoot(), relative));
  } catch {
    // Fichier déjà absent ou stockage indisponible : sans conséquence.
  }
}
