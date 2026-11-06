import { useState, type ReactNode } from 'react';
import { cloudinaryResponsive } from '@/lib/utils/cloudinary';
import { cn } from '@/lib/utils/cn';

export type ImageAspectRatio = '4/5' | '4/3' | '16/9' | '2/1' | '1/1' | '16/10' | '3/4' | 'auto';

/** Variante choisie par le navigateur avant `src` (élément <source> d'un <picture>). */
export interface SmartImageSource {
  srcSet: string;
  /** Ex. « (min-width: 64rem) » pour le cadrage ordinateur. */
  media?: string;
  type?: string;
  sizes?: string;
}

export interface SmartImageProps {
  src: string;
  fallback?: string | ReactNode;
  alt: string;
  ratio?: ImageAspectRatio;
  /** Image visible au premier affichage (hero) : chargée tout de suite et en priorité. */
  priority?: boolean;
  sizes?: string;
  /** Largeurs disponibles ; calculé automatiquement pour une photo Cloudinary. */
  srcSet?: string;
  /** Variantes par taille d'écran : une seule est téléchargée (contrairement à deux <img> masquées). */
  sources?: readonly SmartImageSource[];
  className?: string;
  imgClassName?: string;
  tone?: 'product' | 'mood';
  colorRevealOnGroupHover?: boolean;
  onLoadComplete?: () => void;
}

/** <picture> sans boîte propre (display: contents) quand il y a des variantes, sinon l'image seule. */
function ImageElement({ sources, children }: { sources: readonly SmartImageSource[] | null; children: ReactNode }) {
  if (!sources) return children;
  return (
    <picture className="contents">
      {sources.map((source) => (
        <source
          key={`${source.media ?? ''}|${source.srcSet}`}
          srcSet={source.srcSet}
          media={source.media}
          type={source.type}
          sizes={source.sizes}
        />
      ))}
      {children}
    </picture>
  );
}

const RATIO_CLASSES: Record<ImageAspectRatio, string> = {
  '4/5': 'aspect-[4/5]',
  '4/3': 'aspect-[4/3]',
  '16/9': 'aspect-video',
  '2/1': 'aspect-[2/1]',
  '1/1': 'aspect-square',
  '16/10': 'aspect-[16/10]',
  '3/4': 'aspect-[3/4]',
  auto: '',
};

/**
 * SmartImage (§4.2) :
 * - Réserve l'espace avec `aspect-ratio` (aucun saut CLS).
 * - Bascule automatiquement vers `fallback` si la photo principale est absente, sans erreur console.
 * - Applique le traitement noir et blanc granuleux de la maquette lorsque `tone="mood"`.
 * - Photo Cloudinary : plusieurs largeurs au format le plus léger (M7 §7), le téléphone prend la
 *   plus petite suffisante selon `sizes` ; jamais la photo d'origine.
 */
export function SmartImage({
  src,
  fallback = '/images/fallback/mood-portrait.svg',
  alt,
  ratio = '4/5',
  priority = false,
  sizes,
  srcSet,
  sources,
  className,
  imgClassName,
  tone = 'product',
  colorRevealOnGroupHover = false,
  onLoadComplete,
}: SmartImageProps) {
  const [failedPrimary, setFailedPrimary] = useState(false);
  const [failedFallback, setFailedFallback] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const fallbackUrl = typeof fallback === 'string' ? fallback : undefined;
  const responsive = !failedPrimary && !srcSet ? cloudinaryResponsive(src) : null;
  const activeSrc = !failedPrimary ? (responsive?.src ?? src) : fallbackUrl;
  const activeSrcSet = !failedPrimary ? (srcSet ?? responsive?.srcSet) : undefined;
  // Le visuel de repli remplace toutes les variantes
  const activeSources = !failedPrimary && sources?.length ? sources : null;

  const handleLoad = () => {
    setIsLoaded(true);
    onLoadComplete?.();
  };

  const handleError = () => {
    if (!failedPrimary && fallbackUrl && fallbackUrl !== src) {
      setFailedPrimary(true);
      return;
    }
    setFailedFallback(true);
    setIsLoaded(true);
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        RATIO_CLASSES[ratio],
        tone === 'mood' ? 'bg-ink-2 mood-grain' : 'bg-surface',
        className,
      )}
    >
      {/* Miroitement pendant le chargement */}
      {!isLoaded && (
        <div
          aria-hidden="true"
          className={cn(
            'absolute inset-0 animate-pulse',
            tone === 'mood' ? 'bg-ink-2' : 'bg-surface',
          )}
        />
      )}

      {!failedFallback && activeSrc ? (
        <ImageElement sources={activeSources}>
          <img
            src={activeSrc}
            srcSet={activeSrcSet}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            sizes={sizes}
            onLoad={handleLoad}
            onError={handleError}
            className={cn(
              'h-full w-full object-cover transition-opacity duration-slow',
              isLoaded ? 'opacity-100' : 'opacity-0',
              tone === 'mood' && 'mood-image',
              tone === 'mood' && colorRevealOnGroupHover && 'mood-image-color-reveal',
              imgClassName,
            )}
          />
        </ImageElement>
      ) : typeof fallback !== 'string' && fallback ? (
        <div className="flex h-full w-full items-center justify-center">{fallback}</div>
      ) : (
        <div
          aria-hidden="true"
          className={cn(
            'flex h-full w-full items-center justify-center',
            tone === 'mood' ? 'bg-ink-2 text-silver' : 'bg-surface text-text-2',
          )}
        />
      )}
    </div>
  );
}
