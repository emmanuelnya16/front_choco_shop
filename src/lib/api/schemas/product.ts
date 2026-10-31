import { z } from 'zod';
import { isoDate, paginated } from './common';

/** Produits : `Product`, `ProductsResponse` et `ProductDetailResponse` (src/types). */

const productColorSchema = z.looseObject({
  code: z.string(),
  name: z.string(),
  hex: z.string(),
});

const productVariantSchema = z.looseObject({
  id: z.string(),
  size: z.string(),
  colorCode: z.string(),
  stock: z.number(),
});

const productImageSchema = z.looseObject({
  url: z.string(),
  fallbackUrl: z.string(),
  colorCode: z.string().optional(),
  alt: z.string().optional(),
});

const sizeGuideSchema = z.looseObject({
  type: z.enum(['clothing', 'footwear', 'one-size']),
  title: z.string(),
  tip: z.string(),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

/**
 * Produit tel qu'affiché dans les listes (cartes, carrousels, articles associés, feuille des tailles).
 * HYPOTHÈSE: les listes peuvent un jour renvoyer une version allégée du produit : seuls les champs
 * lus par les cartes et la feuille des tailles sont requis ici.
 */
export const productCardSchema = z.looseObject({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  price: z.number(),
  categorySlug: z.string(),
  subCategorySlug: z.string().optional(),
  images: z.array(z.string()),
  fallbackImages: z.array(z.string()),
  colors: z.array(productColorSchema),
  sizes: z.array(z.string()),
  variants: z.array(productVariantSchema),
  badges: z.array(z.enum(['new', 'low-stock', 'sold-out'])),
  isNew: z.boolean(),
  description: z.string().optional(),
  mediaGallery: z.array(productImageSchema).optional(),
  reservationsCount: z.number().optional(),
  createdAt: isoDate.optional(),
});

/** `GET /products/:slug` : fiche produit complète. */
export const productDetailSchema = productCardSchema.extend({
  description: z.string(),
  composition: z.string(),
  careInstructions: z.array(z.string()),
  sizeGuide: sizeGuideSchema,
  mediaGallery: z.array(productImageSchema),
  // La fiche se contente d'une liste vide si le champ manque (ProductPage)
  related: z.array(productCardSchema).optional(),
});

const facetsSchema = z.looseObject({
  sizes: z.array(z.looseObject({ value: z.string(), count: z.number() })),
  priceRanges: z.array(z.looseObject({ value: z.string(), label: z.string(), count: z.number() })),
  subCategories: z.array(z.looseObject({ slug: z.string(), name: z.string(), count: z.number() })),
});

/** `GET /products` : liste paginée et filtres disponibles. */
export const productsPageSchema = paginated(productCardSchema).extend({
  facets: facetsSchema.optional(),
});
