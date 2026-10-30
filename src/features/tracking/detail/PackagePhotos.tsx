import { Camera, ImageOff, RotateCcw } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ImageAspectRatio } from '@/components/ui/SmartImage';
import { formatPackedAt } from '@/features/tracking/format';
import { packagePhotoAlt, packagePhotoRatio } from '@/features/tracking/packagePhotos';
import { gsap, useGSAP } from '@/lib/gsap';
import { cn } from '@/lib/utils/cn';
import { haptic } from '@/lib/utils/haptics';
import { prefersReducedMotion } from '@/motion/useReducedMotionPref';
import type { PackagePhoto } from '@/types/domain';

const ASPECT_CLASSES: Partial<Record<ImageAspectRatio, string>> = {
  '4/3': 'aspect-[4/3]',
  '1/1': 'aspect-square',
  '4/5': 'aspect-[4/5]',
};

export interface PackagePhotosProps {
  photos: PackagePhoto[];
  packageReadyAt: string | null;
  /** Le dévoilement animé a déjà été joué sur ce téléphone (`seenStore`). */
  alreadyRevealed: boolean;
  onRevealed: () => void;
  onOpenViewer: (index: number) => void;
  /** Échec de chargement : renvoie `true` si un rechargement des liens signés a été lancé. */
  onPhotoFailure: () => boolean;
}

/**
 * Photo d'un colis : squelette pendant le chargement, image de remplacement en cas d'échec avec
 * « Photo indisponible · Réessayer » (§6.2 M5). Les URL signées ne sont jamais copiées hors de la mémoire.
 */
function PackagePhotoImage({
  photo,
  alt,
  onFailure,
  onOpen,
  openLabel,
}: {
  photo: PackagePhoto;
  alt: string;
  onFailure: () => boolean;
  onOpen: () => void;
  openLabel: string;
}) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  return (
    <div className="relative h-full w-full bg-surface">
      {state === 'loading' && <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-surface" />}
      {state !== 'error' && (
        <img
          key={attempt}
          src={photo.url}
          alt={alt}
          width={photo.width}
          height={photo.height}
          decoding="async"
          onLoad={() => setState('loaded')}
          onError={() => {
            // Premier échec : liens probablement expirés, la réservation est rechargée (nouvelle URL = nouvelle image)
            onFailure();
            setState('error');
          }}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-400',
            state === 'loaded' ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
      {state !== 'error' && (
        <button
          type="button"
          onClick={onOpen}
          aria-label={openLabel}
          className="absolute inset-0 rounded-[var(--radius-md)]"
        />
      )}
      {state === 'error' && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center">
          <ImageOff className="h-6 w-6 text-text-2" aria-hidden="true" />
          <p className="text-small font-semibold text-ink">Photo indisponible</p>
          <button
            type="button"
            onClick={() => {
              setAttempt((n) => n + 1);
              setState('loading');
            }}
            className="inline-flex min-h-[44px] items-center gap-1.5 px-3 text-small font-semibold text-ink underline"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Réessayer
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Bloc « Votre colis est prêt » (§6.2 et §6.3 M5) avec dévoilement animé la première fois seulement :
 * fondu du bloc, photo dévoilée de bas en haut (`clipPath`) avec une échelle 1,08 → 1,
 * badge « Colis prêt » avec rebond, puis texte et miniatures en cascade ; vibration à la fin.
 */
export function PackagePhotos({
  photos,
  packageReadyAt,
  alreadyRevealed,
  onRevealed,
  onOpenViewer,
  onPhotoFailure,
}: PackagePhotosProps) {
  const scopeRef = useRef<HTMLElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // Figé au montage : une mise à jour du `seenStore` en cours de route n'interrompt pas l'animation
  const [reveal] = useState(() => !alreadyRevealed);
  const active = photos[Math.min(activeIndex, photos.length - 1)] ?? photos[0];

  useGSAP(
    () => {
      if (!reveal) return;
      const finish = () => {
        haptic('success');
        onRevealed();
      };
      if (prefersReducedMotion()) {
        finish();
        return;
      }

      const q = gsap.utils.selector(scopeRef);
      // Sur mobile, le bloc est souvent sous le bloc d'action : le dévoilement part quand il entre à l'écran
      const tl = gsap.timeline({
        onComplete: finish,
        scrollTrigger: { trigger: scopeRef.current, start: 'top 85%', once: true },
      });
      tl.from(scopeRef.current, { autoAlpha: 0, duration: 0.3, ease: 'power2.out' }, 0)
        .fromTo(
          q('[data-reveal-mask]'),
          { clipPath: 'inset(100% 0% 0% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8, ease: 'power3.out' },
          0.1,
        )
        .fromTo(q('[data-reveal-image]'), { scale: 1.08 }, { scale: 1, duration: 0.8, ease: 'power3.out' }, 0.1)
        .from(q('[data-reveal-badge]'), { scale: 0, autoAlpha: 0, duration: 0.45, ease: 'back.out(3)' }, 0.7)
        .from(q('[data-reveal-text]'), { y: 12, autoAlpha: 0, duration: 0.4, stagger: 0.06, ease: 'power3.out' }, 0.9);
    },
    { scope: scopeRef, dependencies: [] },
  );

  if (!active) return null;
  const ratio = packagePhotoRatio(active);

  return (
    <section
      id="colis"
      ref={scopeRef}
      aria-labelledby="colis-titre"
      className="scroll-mt-28 rounded-[var(--radius-md)] border border-silver/70 bg-white p-5 sm:p-6"
    >
      <div data-reveal-text>
        <h2 id="colis-titre" className="flex items-center gap-2 text-h3 text-ink">
          <Camera className="h-5 w-5 shrink-0 text-red" aria-hidden="true" />
          <span>
            Votre colis est prêt{' '}
            {/* Distingue ce titre de celui du bloc d'action « Votre colis est prêt » pour les lecteurs d'écran */}
            <span className="sr-only">: photos du colis</span>
          </span>
        </h2>
        {packageReadyAt && (
          <p className="mt-0.5 text-small text-text-2">Emballé le {formatPackedAt(packageReadyAt)}</p>
        )}
      </div>

      <div className="relative mt-4">
        <div
          data-reveal-mask
          className={cn(
            'overflow-hidden rounded-[var(--radius-md)]',
            // Portrait 4:5 : largeur limitée sur ordinateur pour garder la photo entière à l'écran
            ratio === '4/5' && 'lg:max-w-[480px]',
          )}
        >
          <div data-reveal-image className={ASPECT_CLASSES[ratio] ?? 'aspect-[4/3]'}>
            <PackagePhotoImage
              key={active.url}
              photo={active}
              alt={packagePhotoAlt(activeIndex, photos.length)}
              onFailure={onPhotoFailure}
              onOpen={() => onOpenViewer(activeIndex)}
              openLabel={`Agrandir : ${packagePhotoAlt(activeIndex, photos.length).toLowerCase()}`}
            />
          </div>
        </div>
        {reveal && (
          <span
            data-reveal-badge
            className="pointer-events-none absolute top-3 left-3 rounded-[var(--radius-full)] bg-red px-3 py-1 text-[13px] font-bold text-white"
          >
            Colis prêt
          </span>
        )}
      </div>

      {photos.length > 1 && (
        <ul data-reveal-text className="mt-3 flex gap-2" aria-label="Choisir une photo">
          {photos.map((photo, index) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-pressed={index === activeIndex}
                aria-label={packagePhotoAlt(index, photos.length)}
                className={cn(
                  'h-14 w-14 overflow-hidden rounded-[var(--radius-sm)] ring-offset-2 transition-shadow',
                  index === activeIndex ? 'ring-2 ring-ink' : 'ring-1 ring-silver/70',
                )}
              >
                <img
                  src={photo.thumbnailUrl}
                  alt=""
                  width={56}
                  height={56}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p data-reveal-text className="mt-3 text-small text-text-2">
        Vérifiez votre colis à la réception : il doit correspondre à cette photo.
      </p>
    </section>
  );
}
