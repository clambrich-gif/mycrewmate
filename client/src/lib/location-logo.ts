export const MAX_LOCATION_LOGO_BYTES = 3_000_000;
export const MAX_LOCATION_LOGO_DIMENSION = 800;

export const LOCATION_LOGO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
] as const;

export type LocationLogoMimeType = (typeof LOCATION_LOGO_MIME_TYPES)[number];

export function locationLogoMimeType(file: File): LocationLogoMimeType | null {
  if (
    LOCATION_LOGO_MIME_TYPES.includes(
      file.type as LocationLogoMimeType
    )
  ) {
    return file.type as LocationLogoMimeType;
  }
  if (/\.png$/i.test(file.name)) return "image/png";
  if (/\.jpe?g$/i.test(file.name)) return "image/jpeg";
  if (/\.svg$/i.test(file.name)) return "image/svg+xml";
  return null;
}

export function locationLogoDimensions(
  width: number,
  height: number,
  maxDimension = MAX_LOCATION_LOGO_DIMENSION
) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error("Die Bildabmessungen sind ungültig.");
  }
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasBlob(canvas: HTMLCanvasElement, mimeType: LocationLogoMimeType) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) resolve(blob);
        else reject(new Error("Das Standort-Logo konnte nicht komprimiert werden."));
      },
      mimeType,
      mimeType === "image/jpeg" ? 0.88 : undefined
    );
  });
}

async function loadRasterImage(file: File) {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap as CanvasImageSource,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const next = new Image();
      next.onload = () => resolve(next);
      next.onerror = () => reject(new Error("Die Bilddatei konnte nicht geladen werden."));
      next.src = objectUrl;
    });
    return {
      source: image as CanvasImageSource,
      width: image.naturalWidth,
      height: image.naturalHeight,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

/**
 * Skaliert Rasterlogos vor dem Upload auf höchstens 800 px Kantenlänge.
 * SVG-Dateien bleiben unverändert, damit ihre Vektorqualität erhalten bleibt.
 */
export async function optimizeLocationLogo(
  file: File,
  mimeType: LocationLogoMimeType
): Promise<File> {
  if (mimeType === "image/svg+xml") return file;

  const image = await loadRasterImage(file);
  try {
    const { width, height } = locationLogoDimensions(image.width, image.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: mimeType === "image/png" });
    if (!context) throw new Error("Die Bildkomprimierung ist im Browser nicht verfügbar.");
    context.drawImage(image.source, 0, 0, width, height);
    const blob = await canvasBlob(canvas, mimeType);
    return new File([blob], file.name, {
      type: mimeType,
      lastModified: file.lastModified,
    });
  } finally {
    image.cleanup();
  }
}

export function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",", 2)[1] : result);
    };
    reader.readAsDataURL(file);
  });
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Bilddatei konnte nicht gelesen werden"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}
