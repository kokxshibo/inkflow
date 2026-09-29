/**
 * Traitement d'image du scanner, entièrement dans le navigateur :
 * détection de la feuille, redressement de la perspective, amélioration de
 * la lisibilité et lecture de la QR-facture.
 */
import jsQR from "jsqr";

export interface Point {
  x: number;
  y: number;
}
/** Coins dans l'ordre : haut gauche, haut droite, bas droite, bas gauche. */
export type Quad = [Point, Point, Point, Point];

/** Plus grand côté de travail : au-delà, le traitement serait lent sur téléphone. */
const WORK_SIZE = 2400;
/** Plus grand côté du scan final. */
const OUTPUT_SIZE = 2000;

export async function loadImage(file: Blob) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, WORK_SIZE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

export function defaultQuad(width: number, height: number, inset = 0.04): Quad {
  const dx = width * inset;
  const dy = height * inset;
  return [
    { x: dx, y: dy },
    { x: width - dx, y: dy },
    { x: width - dx, y: height - dy },
    { x: dx, y: height - dy },
  ];
}

/**
 * Cherche la feuille : la plus grande zone claire d'un seul tenant (seuil
 * d'Otsu), dont on prend les quatre coins extrêmes. Si la feuille ne se
 * détache pas du fond, on propose un cadre légèrement rentré.
 */
export function detectDocument(source: HTMLCanvasElement): Quad {
  const scale = Math.min(1, 320 / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const small = document.createElement("canvas");
  small.width = width;
  small.height = height;
  const context = small.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(source, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);

  const gray = new Uint8Array(width * height);
  const histogram = new Array<number>(256).fill(0);
  for (let i = 0; i < gray.length; i++) {
    const value = Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
    gray[i] = value;
    histogram[value]++;
  }

  // Seuil d'Otsu
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];
  let sumBackground = 0;
  let weightBackground = 0;
  let best = 0;
  let threshold = 128;
  for (let i = 0; i < 256; i++) {
    weightBackground += histogram[i];
    if (!weightBackground) continue;
    const weightForeground = total - weightBackground;
    if (!weightForeground) break;
    sumBackground += i * histogram[i];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const between = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
    if (between > best) {
      best = between;
      threshold = i;
    }
  }

  // Plus grande composante claire (4-connexité)
  const labels = new Int32Array(width * height).fill(-1);
  let bestSize = 0;
  let bestLabel = -1;
  const stack: number[] = [];
  let label = 0;
  for (let start = 0; start < gray.length; start++) {
    if (labels[start] !== -1 || gray[start] <= threshold) continue;
    let size = 0;
    stack.push(start);
    labels[start] = label;
    while (stack.length) {
      const index = stack.pop()!;
      size++;
      const x = index % width;
      const neighbours = [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        index - width,
        index + width,
      ];
      for (const next of neighbours) {
        if (next < 0 || next >= gray.length || labels[next] !== -1 || gray[next] <= threshold) continue;
        labels[next] = label;
        stack.push(next);
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestLabel = label;
    }
    label++;
  }

  const ratio = bestSize / total;
  if (bestLabel < 0 || ratio < 0.12 || ratio > 0.97) {
    return defaultQuad(source.width, source.height);
  }

  let topLeft = { x: 0, y: 0, score: Infinity };
  let bottomRight = { x: 0, y: 0, score: -Infinity };
  let topRight = { x: 0, y: 0, score: -Infinity };
  let bottomLeft = { x: 0, y: 0, score: Infinity };
  for (let index = 0; index < labels.length; index++) {
    if (labels[index] !== bestLabel) continue;
    const x = index % width;
    const y = (index - x) / width;
    if (x + y < topLeft.score) topLeft = { x, y, score: x + y };
    if (x + y > bottomRight.score) bottomRight = { x, y, score: x + y };
    if (x - y > topRight.score) topRight = { x, y, score: x - y };
    if (x - y < bottomLeft.score) bottomLeft = { x, y, score: x - y };
  }
  const up = (point: { x: number; y: number }) => ({ x: point.x / scale, y: point.y / scale });
  return [up(topLeft), up(topRight), up(bottomRight), up(bottomLeft)];
}

/** Résout le système linéaire de l'homographie (élimination de Gauss). */
function solve(matrix: number[][], vector: number[]) {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let column = 0; column < n; column++) {
    let pivot = column;
    for (let row = column + 1; row < n; row++) {
      if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row;
    }
    [a[column], a[pivot]] = [a[pivot], a[column]];
    for (let row = 0; row < n; row++) {
      if (row === column) continue;
      const factor = a[row][column] / a[column][column];
      for (let k = column; k <= n; k++) a[row][k] -= factor * a[column][k];
    }
  }
  return a.map((row, i) => row[n] / row[i]);
}

/** Homographie qui envoie le rectangle de sortie sur le quadrilatère source. */
function homography(width: number, height: number, quad: Quad) {
  const destination = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  const matrix: number[][] = [];
  const vector: number[] = [];
  destination.forEach((point, i) => {
    const { x, y } = quad[i];
    matrix.push([point.x, point.y, 1, 0, 0, 0, -point.x * x, -point.y * x]);
    vector.push(x);
    matrix.push([0, 0, 0, point.x, point.y, 1, -point.x * y, -point.y * y]);
    vector.push(y);
  });
  return solve(matrix, vector);
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Redresse la feuille : le quadrilatère devient un rectangle bien droit. */
export function warpPerspective(source: HTMLCanvasElement, quad: Quad) {
  let width = Math.max(distance(quad[0], quad[1]), distance(quad[3], quad[2]));
  let height = Math.max(distance(quad[0], quad[3]), distance(quad[1], quad[2]));
  const scale = Math.min(1, OUTPUT_SIZE / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const sourceData = source.getContext("2d", { willReadFrequently: true })!.getImageData(
    0,
    0,
    source.width,
    source.height,
  );
  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const context = output.getContext("2d")!;
  const target = context.createImageData(width, height);
  const [h0, h1, h2, h3, h4, h5, h6, h7] = homography(width, height, quad);
  const sw = source.width;
  const sh = source.height;
  const src = sourceData.data;
  const dst = target.data;

  for (let v = 0; v < height; v++) {
    for (let u = 0; u < width; u++) {
      const w = h6 * u + h7 * v + 1;
      const x = (h0 * u + h1 * v + h2) / w;
      const y = (h3 * u + h4 * v + h5) / w;
      const x0 = Math.min(sw - 2, Math.max(0, Math.floor(x)));
      const y0 = Math.min(sh - 2, Math.max(0, Math.floor(y)));
      const fx = Math.min(1, Math.max(0, x - x0));
      const fy = Math.min(1, Math.max(0, y - y0));
      const i00 = (y0 * sw + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + sw * 4;
      const i11 = i01 + 4;
      const o = (v * width + u) * 4;
      for (let c = 0; c < 3; c++) {
        const top = src[i00 + c] * (1 - fx) + src[i10 + c] * fx;
        const bottom = src[i01 + c] * (1 - fx) + src[i11 + c] * fx;
        dst[o + c] = top * (1 - fy) + bottom * fy;
      }
      dst[o + 3] = 255;
    }
  }
  context.putImageData(target, 0, 0);
  return output;
}

export type ScanFilter = "color" | "bw";

/**
 * Améliore la lisibilité : étirement des niveaux (le papier devient blanc,
 * l'encre bien noire). En noir et blanc, rendu « photocopie ».
 */
export function enhance(canvas: HTMLCanvasElement, filter: ScanFilter) {
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const histogram = new Array<number>(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    histogram[Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])]++;
  }
  const pixels = data.length / 4;
  const percentile = (share: number) => {
    let count = 0;
    for (let value = 0; value < 256; value++) {
      count += histogram[value];
      if (count >= pixels * share) return value;
    }
    return 255;
  };
  const low = percentile(0.02);
  const high = Math.max(low + 1, percentile(0.9));
  const stretch = (value: number) => Math.min(255, Math.max(0, ((value - low) * 255) / (high - low)));

  for (let i = 0; i < data.length; i += 4) {
    if (filter === "bw") {
      const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      // Légère courbe : fond franchement blanc, texte bien contrasté.
      const value = 255 * Math.pow(stretch(luminance) / 255, 1.35);
      data[i] = data[i + 1] = data[i + 2] = value;
    } else {
      data[i] = stretch(data[i]);
      data[i + 1] = stretch(data[i + 1]);
      data[i + 2] = stretch(data[i + 2]);
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

export function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(new File([blob], name, { type: "image/jpeg", lastModified: Date.now() }))
          : reject(new Error("Image impossible à enregistrer")),
      "image/jpeg",
      0.88,
    );
  });
}

/**
 * Lit un QR code sur une image. Les photos de téléphone sont très grandes :
 * on tente plusieurs échelles, de la plus rapide à la plus fidèle.
 */
export async function decodeQr(source: Blob | HTMLCanvasElement): Promise<string | null> {
  const bitmap = source instanceof HTMLCanvasElement ? source : await createImageBitmap(source);
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
    if (!(source instanceof HTMLCanvasElement)) (bitmap as ImageBitmap).close();
  }
}
