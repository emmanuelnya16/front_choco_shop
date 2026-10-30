import { env } from '@/lib/env';

export interface CloudinaryTransformOptions {
  w?: number;
  h?: number;
  crop?: 'fill' | 'fit' | 'limit' | ' scale' | 'thumb';
  blur?: boolean;
}

function isDirectUrlOrLocalPath(publicId: string): boolean {
  return (
    publicId.startsWith('http://') ||
    publicId.startsWith('https://') ||
    publicId.startsWith('/') ||
    publicId.startsWith('data:')
  );
}

/**
 * Construit l'URL Cloudinary optimisée (f_auto,q_auto) ou renvoie l'URL telle quelle
 * s'il s'agit déjà d'une URL complète ou d'un chemin de mock local (/mock/...).
 */
export function cloudinaryUrl(
  publicId: string,
  options: CloudinaryTransformOptions = {},
): string {
  if (!publicId) {
    return '';
  }

  if (isDirectUrlOrLocalPath(publicId)) {
    return publicId;
  }

  const transforms: string[] = ['f_auto', 'q_auto'];

  if (options.blur) {
    transforms.push('w_24', 'e_blur:1000');
  } else {
    const crop = options.crop ? options.crop.trim() : 'fill';
    transforms.push(`c_${crop}`);
    if (options.w) {
      transforms.push(`w_${options.w}`);
    }
    if (options.h) {
      transforms.push(`h_${options.h}`);
    }
  }

  const cleanId = publicId.replace(/^\/+/, '');
  return `https://res.cloudinary.com/${env.cloudinaryCloudName}/image/upload/${transforms.join(',')}/${cleanId}`;
}

export interface CloudinaryResponsiveSet {
  src: string;
  srcSet: string;
  sizes: string;
  placeholderUrl: string;
}

/**
 * Génère srcSet et sizes pour les cartes produits (2 colonnes sur mobile, 4 sur grand écran).
 */
export function cloudinarySrcSet(
  publicId: string,
  widths: number[] = [320, 480, 640, 960],
): CloudinaryResponsiveSet {
  if (isDirectUrlOrLocalPath(publicId)) {
    return {
      src: publicId,
      srcSet: widths.map((w) => `${publicId} ${w}w`).join(', '),
      sizes: '(max-width: 640px) 48vw, (max-width: 1024px) 32vw, 280px',
      placeholderUrl: publicId,
    };
  }

  const sortedWidths = [...widths].sort((a, b) => a - b);
  const defaultWidth = sortedWidths[1] ?? sortedWidths[0] ?? 480;

  return {
    src: cloudinaryUrl(publicId, { w: defaultWidth, crop: 'fill' }),
    srcSet: sortedWidths
      .map((w) => `${cloudinaryUrl(publicId, { w, crop: 'fill' })} ${w}w`)
      .join(', '),
    sizes: '(max-width: 640px) 48vw, (max-width: 1024px) 32vw, 280px',
    placeholderUrl: cloudinaryUrl(publicId, { blur: true }),
  };
}
