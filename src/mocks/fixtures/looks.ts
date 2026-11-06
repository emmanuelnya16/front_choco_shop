import type { LookbookItem } from '@/types/domain';

const INITIAL_LOOKS: LookbookItem[] = [
  {
    id: 'look-1',
    title: 'Total black barbelé',
    subtitle: 'Hoodie 480 gsm + Cargo tactique',
    image: '/images/looks/look-1.webp',
    fallback: '/images/fallback/mood-portrait.svg',
    productSlugs: ['hoodie-barbele-noir', 'cargo-tactique-bitume'],
  },
  {
    id: 'look-2',
    title: 'Héritage Akwa',
    subtitle: 'T-shirt Oversize + Babouche Royale cuir',
    image: '/images/looks/look-2.webp',
    fallback: '/images/fallback/mood-portrait.svg',
    productSlugs: ['tshirt-lincompris-oversize', 'babouche-royale-akwa-cuir'],
  },
  {
    id: 'look-3',
    title: 'Silhouette Monolithe',
    subtitle: 'Pantalon Large Atelier + Sneaker V1',
    image: '/images/looks/look-3.webp',
    fallback: '/images/fallback/mood-portrait.svg',
    productSlugs: ['pantalon-large-atelier', 'sneaker-monolithe-v1'],
  },
  {
    id: 'look-4',
    title: 'Nocturne Croco',
    subtitle: 'Hoodie Zippé Armure + Babouche Croco',
    image: '/images/looks/look-4.webp',
    fallback: '/images/fallback/mood-portrait.svg',
    productSlugs: ['hoodie-zip-armure', 'babouche-croco-nocturne'],
  },
];

export function cloneLooks(source: LookbookItem[] = INITIAL_LOOKS): LookbookItem[] {
  return source.map((look) => ({
    ...look,
    productSlugs: [...look.productSlugs],
  }));
}

export const mockLooks: LookbookItem[] = cloneLooks();

export function resetMockLooks(): void {
  mockLooks.splice(0, mockLooks.length, ...cloneLooks());
}
