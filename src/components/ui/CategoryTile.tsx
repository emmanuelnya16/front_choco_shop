import * as m from 'motion/react-m';
import { Link } from 'react-router';
import { cn } from '@/lib/utils/cn';
import { pressable } from '@/motion/presets';
import { SmartImage, type ImageAspectRatio } from './SmartImage';

export interface CategoryTileProps {
  name: string;
  slug: string;
  count: number;
  coverImage: string;
  fallbackImage: string;
  ratio?: ImageAspectRatio;
  className?: string;
}

/**
 * CategoryTile (§5.7) :
 * Reproduit les tuiles sombres de la maquette Bralder (« Hoodies », « Caps »…).
 * Survol : zoom 1,06 de la photo, voile de 55 % à 40 %, titre qui monte de 4 px.
 */
export function CategoryTile({
  name,
  slug,
  count,
  coverImage,
  fallbackImage,
  ratio = '2/1',
  className,
}: CategoryTileProps) {
  return (
    <m.div {...pressable} className={cn('group/tile relative overflow-hidden rounded-[var(--radius-md)]', className)}>
      <Link
        to={`/explorer/${slug}`}
        className="relative block h-full w-full overflow-hidden rounded-[var(--radius-md)]"
      >
        <div className="h-full w-full transition-transform duration-reveal ease-brand-out [@media(hover:hover)]:group-hover/tile:scale-106">
          <SmartImage
            src={coverImage}
            fallback={fallbackImage}
            alt=""
            tone="mood"
            ratio={ratio}
            className="h-full w-full"
          />
        </div>

        {/* Voile ink à 55 % qui passe à 40 % au survol (opacité du calque : 0,73 × 55 % ≈ 40 %) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[var(--color-scrim-55)] transition-opacity duration-slow ease-brand-out [@media(hover:hover)]:group-hover/tile:opacity-73"
        />

        {/* Contenu centré */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
          <span className="text-h3 font-semibold text-white transition-transform duration-base ease-brand-out [@media(hover:hover)]:group-hover/tile:-translate-y-1">
            {name}
          </span>
          <span className="mt-1 text-label text-silver">
            {count} {count > 1 ? 'articles' : 'article'}
          </span>
        </div>
      </Link>
    </m.div>
  );
}
