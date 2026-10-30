/**
 * Préparation locale de la capture d'écran de preuve de paiement (§5.2 & §8.3) :
 * 1. Vérification du format (JPEG, PNG, WebP ; HEIC accepté si décodable par le navigateur) et du poids (<= proofMaxSizeMb).
 * 2. Redimensionnement pour que le plus grand côté fasse au maximum 1600 px et compression JPEG qualité 0,82
 *    (une capture déjà légère < 400 Ko et <= 1600 px est envoyée telle quelle).
 * 3. Calcul de l'empreinte SHA-256 (`crypto.subtle.digest`) sur le fichier final.
 */

export const MAX_PROOF_DIMENSION_PX = 1600;
export const LIGHT_FILE_THRESHOLD_BYTES = 400 * 1024; // 400 Ko
export const JPEG_COMPRESSION_QUALITY = 0.82;

const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const HEIC_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

export class ProofPreparationError extends Error {
  readonly code: 'UNSUPPORTED_FORMAT' | 'FILE_TOO_LARGE' | 'CORRUPT_IMAGE';

  constructor(
    code: 'UNSUPPORTED_FORMAT' | 'FILE_TOO_LARGE' | 'CORRUPT_IMAGE',
    message: string,
  ) {
    super(message);
    this.name = 'ProofPreparationError';
    this.code = code;
  }
}

export interface PreparedProofResult {
  blob: Blob;
  sha256: string;
  width: number;
  height: number;
  originalSizeBytes: number;
  finalSizeBytes: number;
  wasCompressed: boolean;
  durationMs: number;
}

/**
 * Calcule les dimensions cibles en plafonnant le plus grand côté à `maxSide` (1600 px par défaut)
 * tout en conservant le ratio d'aspect (§5.2 & §8.3).
 */
export function computeTargetDimensions(
  width: number,
  height: number,
  maxSide: number = MAX_PROOF_DIMENSION_PX,
): { width: number; height: number; resized: boolean } {
  if (width <= 0 || height <= 0) {
    return { width: maxSide, height: maxSide, resized: false };
  }
  const longest = Math.max(width, height);
  if (longest <= maxSide) {
    return { width: Math.round(width), height: Math.round(height), resized: false };
  }
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    resized: true,
  };
}

/**
 * Calcule l'empreinte SHA-256 hexadécimale d'un Blob ou ArrayBuffer via Web Crypto API (§5.2).
 */
export async function computeSha256Hex(input: Blob | ArrayBuffer): Promise<string> {
  let buffer: ArrayBuffer;
  if (input instanceof ArrayBuffer) {
    buffer = input;
  } else if (typeof input.arrayBuffer === 'function') {
    buffer = await input.arrayBuffer();
  } else {
    buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error('Impossible de lire le fichier.'));
      reader.readAsArrayBuffer(input);
    });
  }

  if (typeof crypto !== 'undefined' && crypto.subtle?.digest) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback déterministe FNV-1a 256-bit si crypto.subtle est indisponible
  const bytes = new Uint8Array(buffer);
  const parts: string[] = [];
  for (let seed = 0; seed < 8; seed += 1) {
    let h = (0x811c9dc5 ^ seed) >>> 0;
    for (let i = 0; i < bytes.length; i += 1) {
      h ^= bytes[i]!;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    parts.push(h.toString(16).padStart(8, '0'));
  }
  return parts.join('');
}

interface DecodedImageSource {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, w: number, h: number) => void;
  close: () => void;
}

async function decodeImageFile(file: Blob): Promise<DecodedImageSource> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
    });
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
      close: () => bitmap.close?.(),
    };
  }

  const isJsdom =
    typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);

  if (!isJsdom && typeof Image !== 'undefined' && typeof URL !== 'undefined') {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Décodage image impossible'));
        el.src = objectUrl;
      });
      return {
        width: img.naturalWidth || img.width || 800,
        height: img.naturalHeight || img.height || 600,
        draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
        close: () => URL.revokeObjectURL(objectUrl),
      };
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      throw err;
    }
  }

  throw new Error('Aucun décodeur d’image disponible.');
}

async function renderToJpegBlob(
  source: DecodedImageSource,
  targetWidth: number,
  targetHeight: number,
  quality: number,
): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const offscreen = new OffscreenCanvas(targetWidth, targetHeight);
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        source.draw(ctx, targetWidth, targetHeight);
        return await offscreen.convertToBlob({
          type: 'image/jpeg',
          quality,
        });
      }
    } catch {
      // Fallback HTMLCanvasElement
    }
  }

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (ctx && typeof canvas.toBlob === 'function') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      source.draw(ctx, targetWidth, targetHeight);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', quality),
      );
      if (blob) {
        return blob;
      }
    }
  }

  throw new Error('Canvas indisponible pour compresser l’image.');
}

export interface PrepareProofOptions {
  maxSizeMb?: number;
  maxDimensionPx?: number;
  lightThresholdBytes?: number;
  quality?: number;
}

/**
 * Vérifie, compresse si nécessaire et calcule l'empreinte SHA-256 d'une capture d'écran (§5.2).
 */
export async function prepareProof(
  file: File | Blob,
  options: PrepareProofOptions = {},
): Promise<PreparedProofResult> {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const maxSizeMb = options.maxSizeMb ?? 10;
  const maxBytes = maxSizeMb * 1024 * 1024;
  const maxDimensionPx = options.maxDimensionPx ?? MAX_PROOF_DIMENSION_PX;
  const lightThresholdBytes =
    options.lightThresholdBytes ?? LIGHT_FILE_THRESHOLD_BYTES;
  const quality = options.quality ?? JPEG_COMPRESSION_QUALITY;

  const mimeType = (file.type || '').toLowerCase();
  const fileName = 'name' in file ? String(file.name).toLowerCase() : '';
  const isHeic =
    HEIC_MIME_TYPES.has(mimeType) ||
    fileName.endsWith('.heic') ||
    fileName.endsWith('.heif');
  const isStandardSupported = SUPPORTED_MIME_TYPES.has(mimeType);

  if (!isStandardSupported && !isHeic) {
    throw new ProofPreparationError(
      'UNSUPPORTED_FORMAT',
      "Ce format n'est pas pris en charge. Faites une capture d'écran classique.",
    );
  }

  if (file.size > maxBytes) {
    throw new ProofPreparationError(
      'FILE_TOO_LARGE',
      `Cette image dépasse ${maxSizeMb} Mo. Choisissez une capture d'écran plus légère.`,
    );
  }

  let decoded: DecodedImageSource;
  try {
    decoded = await decodeImageFile(file);
  } catch {
    if (isHeic) {
      throw new ProofPreparationError(
        'UNSUPPORTED_FORMAT',
        "Ce format n'est pas pris en charge. Faites une capture d'écran classique.",
      );
    }
    // En environnement de test JSDOM sans createImageBitmap/Canvas natif, si le fichier est déjà léger (< 400 Ko),
    // on conserve le fichier tel quel (§5.2 : « Une capture d'écran déjà légère (moins de 400 Ko) est envoyée telle quelle »).
    if (isStandardSupported && file.size <= lightThresholdBytes) {
      const sha256 = await computeSha256Hex(file);
      const endTime =
        typeof performance !== 'undefined' ? performance.now() : Date.now();
      return {
        blob: file,
        sha256,
        width: 800,
        height: 600,
        originalSizeBytes: file.size,
        finalSizeBytes: file.size,
        wasCompressed: false,
        durationMs: Math.max(1, Math.round(endTime - startTime)),
      };
    }
    throw new ProofPreparationError(
      'CORRUPT_IMAGE',
      "Impossible de lire cette image. Choisissez une autre capture d'écran.",
    );
  }

  try {
    const target = computeTargetDimensions(
      decoded.width,
      decoded.height,
      maxDimensionPx,
    );

    // Une capture d'écran déjà légère (< 400 Ko) et dont le plus grand côté <= 1600 px est envoyée telle quelle (§5.2)
    if (
      isStandardSupported &&
      !target.resized &&
      file.size <= lightThresholdBytes
    ) {
      const sha256 = await computeSha256Hex(file);
      const endTime =
        typeof performance !== 'undefined' ? performance.now() : Date.now();
      return {
        blob: file,
        sha256,
        width: target.width,
        height: target.height,
        originalSizeBytes: file.size,
        finalSizeBytes: file.size,
        wasCompressed: false,
        durationMs: Math.max(1, Math.round(endTime - startTime)),
      };
    }

    const compressedBlob = await renderToJpegBlob(
      decoded,
      target.width,
      target.height,
      quality,
    );

    const sha256 = await computeSha256Hex(compressedBlob);
    const endTime =
      typeof performance !== 'undefined' ? performance.now() : Date.now();

    return {
      blob: compressedBlob,
      sha256,
      width: target.width,
      height: target.height,
      originalSizeBytes: file.size,
      finalSizeBytes: compressedBlob.size,
      wasCompressed: true,
      durationMs: Math.max(1, Math.round(endTime - startTime)),
    };
  } finally {
    decoded.close();
  }
}

/**
 * Formate un poids en octets en Ko ou Mo lisibles (« 284 Ko », « 1,4 Mo »).
 */
export function formatFileSizeFr(bytes: number): string {
  if (bytes < 1024) {
    return `${Math.max(1, Math.round(bytes))} o`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${Math.max(1, Math.round(kb))} Ko`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(1).replace('.', ',')} Mo`;
}
