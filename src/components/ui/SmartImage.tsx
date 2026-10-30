import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type ImageAspectRatio = '4/5' | '4/3' | '16/9' | '2/1' | '1/1' | '16/10' | '3/4' | 'auto';

export interface SmartImageProps {
  src: string;
  fallback?: string | ReactNode;
  alt: string;
  ratio?: ImageAspectRatio;
  priority?: boolean;
  sizes?: string;
  className?: string;
  imgClassName?: string;
  tone?: 'product' | 'mood';
  colorRevealOnGroupHover?: boolean;
  onLoadComplete?: () => void;
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
 */
export function SmartImage({
  src,
  fallback = '/images/fallback/mood-portrait.svg',
  alt,
  ratio = '4/5',
  priority = false,
  sizes,
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
  const activeSrc = !failedPrimary ? src : fallbackUrl;

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
        <img
          src={activeSrc}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          sizes={sizes}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-400',
            isLoaded ? 'opacity-100' : 'opacity-0',
            tone === 'mood' && 'mood-image',
            tone === 'mood' && colorRevealOnGroupHover && 'mood-image-color-reveal',
            imgClassName,
          )}
        />
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
