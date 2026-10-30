import { useCallback, useRef } from 'react';
import type { ImageAspectRatio } from '@/components/ui/SmartImage';
import type { LightboxImage } from '@/features/catalog/product/ProductLightbox';
import type { PackagePhoto } from '@/types/domain';

/** Format d'affichage au plus proche de la photo d'origine (au maximum 4:5, §6.2 M5). */
export function packagePhotoRatio(photo: Pick<PackagePhoto, 'width' | 'height'>): ImageAspectRatio {
  if (!photo.width || !photo.height) return '4/3';
  const ratio = photo.width / photo.height;
  if (ratio >= 1.15) return '4/3';
  if (ratio >= 0.9) return '1/1';
  return '4/5';
}

export function packagePhotoAlt(index: number, total: number): string {
  return `Photo de votre colis emballé, ${index + 1} sur ${total}`;
}

export function toLightboxImages(photos: PackagePhoto[]): LightboxImage[] {
  return photos.map((photo, index) => ({
    url: photo.url,
    fallbackUrl: photo.url,
    alt: packagePhotoAlt(index, photos.length),
    ratio: packagePhotoRatio(photo),
  }));
}

/**
 * Liens signés et temporaires (§3.1 et §6.4 M5) : au premier échec de chargement d'une photo,
 * la réservation est rechargée une seule fois pour obtenir des liens neufs.
 * HYPOTHÈSE: une balise <img> ne donne pas le code HTTP ; tout échec est traité comme un lien expiré (403).
 */
export function useSignedUrlRefresh(refetch: () => unknown): () => boolean {
  const refreshedRef = useRef(false);
  return useCallback(() => {
    if (refreshedRef.current) return false;
    refreshedRef.current = true;
    void refetch();
    return true;
  }, [refetch]);
}

export type SavePhotoOutcome = 'shared' | 'downloaded' | 'opened' | 'cancelled';

function extensionFor(type: string): string {
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  if (type.includes('svg')) return 'svg';
  return 'jpg';
}

/**
 * « Enregistrer la photo » (§6.2 M5) : partage natif d'un fichier sur mobile si `navigator.canShare({ files })`
 * le permet, sinon téléchargement. En dernier recours (lien inaccessible), la photo s'ouvre dans un onglet.
 * Le fichier ne transite qu'en mémoire : rien n'est écrit dans le stockage du navigateur (§6.4 M5).
 */
export async function savePackagePhoto(url: string, baseName: string): Promise<SavePhotoOutcome> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const file = new File([blob], `${baseName}.${extensionFor(blob.type)}`, {
      type: blob.type || 'image/jpeg',
    });

    const isTouchDevice =
      typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
    if (isTouchDevice && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Photo de mon colis DR Choco' });
        return 'shared';
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
        // Partage refusé : on retombe sur le téléchargement
      }
    }

    const objectUrl = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return 'downloaded';
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
    return 'opened';
  }
}
