/**
 * Allège une photo dans le navigateur avant l'envoi : une photo de téléphone
 * pèse souvent 3 à 8 Mo, alors que 2000 px de côté suffisent pour la voir en
 * détail. Si le navigateur ne sait pas lire l'image, elle part telle quelle.
 */
const MAX_SIDE = 2000;
/** En dessous, la photo est déjà assez légère : on n'y touche pas. */
const LIGHT_ENOUGH = 800 * 1024;

export async function shrinkPhoto(file: File): Promise<File> {
  if (file.size <= LIGHT_ENOUGH) return file;
  try {
    // L'orientation de l'appareil photo (EXIF) est appliquée au décodage.
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    // Fond blanc : la transparence d'un PNG deviendrait noire en JPEG.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob || blob.size >= file.size) return file;
    const name = `${file.name.replace(/\.[^.]+$/, "") || "photo"}.jpg`;
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
