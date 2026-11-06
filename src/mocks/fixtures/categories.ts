import type { Category } from '@/types/domain';

const INITIAL_CATEGORIES: Category[] = [
  {
    id: 'cat-vetements',
    slug: 'vetements',
    name: 'Vêtements',
    description: 'Coupes lourdes, coton épais et sérigraphies brutes signées DR Choco.',
    image: '/images/categories/vetements.webp',
    coverImage: '/images/categories/vetements.webp',
    fallbackImage: '/images/fallback/mood-vetements.svg',
    productCount: 13,
    subCategories: [
      {
        id: 'sub-tshirts',
        slug: 't-shirts',
        name: 'T-shirts',
        coverImage: '/images/categories/t-shirts.webp',
        fallbackImage: '/images/fallback/mood-tshirts.svg',
        productCount: 6,
      },
      {
        id: 'sub-hoodies',
        slug: 'hoodies',
        name: 'Hoodies',
        coverImage: '/images/categories/hoodies.webp',
        fallbackImage: '/images/fallback/mood-hoodies.svg',
        productCount: 3,
      },
      {
        id: 'sub-pantalons',
        slug: 'pantalons',
        name: 'Pantalons',
        coverImage: '/images/categories/pantalons.webp',
        fallbackImage: '/images/fallback/mood-pantalons.svg',
        productCount: 4,
      },
    ],
  },
  {
    id: 'cat-chaussures',
    slug: 'chaussures',
    name: 'Chaussures',
    description: 'Sneakers urbaines, derbies revisitées et semelles massives tout-terrain.',
    image: '/images/categories/chaussures.webp',
    coverImage: '/images/categories/chaussures.webp',
    fallbackImage: '/images/fallback/mood-chaussures.svg',
    productCount: 5,
    subCategories: [
      {
        id: 'sub-sneakers',
        slug: 'sneakers',
        name: 'Sneakers',
        coverImage: '/images/categories/chaussures.webp',
        fallbackImage: '/images/fallback/mood-chaussures.svg',
        productCount: 3,
      },
      {
        id: 'sub-derbies',
        slug: 'derbies',
        name: 'Derbies & Boots',
        coverImage: '/images/categories/chaussures.webp',
        fallbackImage: '/images/fallback/mood-chaussures.svg',
        productCount: 2,
      },
    ],
  },
  {
    id: 'cat-babouches',
    slug: 'babouches',
    name: 'Babouches',
    description: 'Cuir véritable travaillé à la main, finitions contemporaines et confort royal.',
    image: '/images/categories/babouches.webp',
    coverImage: '/images/categories/babouches.webp',
    fallbackImage: '/images/fallback/mood-babouches.svg',
    productCount: 6,
    subCategories: [
      {
        id: 'sub-cuir-lisse',
        slug: 'cuir-lisse',
        name: 'Cuir lisse',
        coverImage: '/images/categories/babouches.webp',
        fallbackImage: '/images/fallback/mood-babouches.svg',
        productCount: 4,
      },
      {
        id: 'sub-croco',
        slug: 'croco-embosse',
        name: 'Croco embossé',
        coverImage: '/images/categories/babouches.webp',
        fallbackImage: '/images/fallback/mood-babouches.svg',
        productCount: 2,
      },
    ],
  },
];

export function cloneCategories(source: Category[] = INITIAL_CATEGORIES): Category[] {
  return source.map((cat) => ({
    ...cat,
    subCategories: cat.subCategories.map((sub) => ({ ...sub })),
  }));
}

export const mockCategories: Category[] = cloneCategories();

export function resetMockCategories(): void {
  mockCategories.splice(0, mockCategories.length, ...cloneCategories());
}
