import type { Product } from '@/types/domain';

/**
 * Visuel de repli d'un article sans photo (format 4:5 des cartes et de la fiche).
 * Il fait partie de l'app (public/images/fallback) : contrairement aux fichiers de démonstration
 * de /mock, il est aussi servi en production.
 */
export const PRODUCT_IMAGE_FALLBACK = '/images/fallback/mood-portrait.svg';

/** Photo principale de l'article, sinon son visuel de repli, sinon celui de l'app. */
export function productPrimaryImage(product: Pick<Product, 'images' | 'fallbackImages'>): string {
  return product.images[0] ?? product.fallbackImages[0] ?? PRODUCT_IMAGE_FALLBACK;
}

/** Visuel de repli de l'article (affiché si sa photo ne se charge pas). */
export function productFallbackImage(product: Pick<Product, 'fallbackImages'>): string {
  return product.fallbackImages[0] ?? PRODUCT_IMAGE_FALLBACK;
}
