import { Camera, ImageOff, RotateCcw, WifiOff } from 'lucide-react';
import type { Variants } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useRef, useState } from 'react';
import type { ImageAspectRatio } from '@/components/ui/SmartImage';
import { formatPackedAt } from '@/features/tracking/format';
import { packagePhotoAlt, packagePhotoRatio } from '@/features/tracking/packagePhotos';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { cn } from '@/lib/utils/cn';
import { haptic } from '@/lib/utils/haptics';
import { delay, duration, ease, spring, staggerStep } from '@/motion/tokens';
import { prefersReducedMotion } from '@/motion/useReducedMotionPref';
import { isAppOnline, useNetworkStore } from '@/pwa/networkStore';
import type { PackagePhoto, ReceptionMode } from '@/types/domain';
import type { ReservationStatusCode } from '@/types/reservationStatus';

const ASPECT_CLASSES: Partial<Record<ImageAspectRatio, string>> = {
  '4/3': 'aspect-[4/3]',
  '1/1': 'aspect-square',
  '4/5': 'aspect-[4/5]',
};

/** Statuts où le colis vient d'être emballé : pastille « Colis prêt » au premier dévoilement. */
const READY_STATUSES: ReadonlySet<ReservationStatusCode> = new Set(['handed_to_agency', 'ready_for_pickup']);
/** Colis reçu : le conseil « Vérifiez votre colis » n'a plus lieu d'être. */
const RECEIVED_STATUSES: ReadonlySet<ReservationStatusCode> = new Set(['delivered', 'picked_up']);

// Dévoilement (transform et opacité uniquement) : fondu du bloc, cache qui se retire vers le haut
// (la photo apparaît de bas en haut) avec une échelle 1,08 → 1, pastille avec rebond, textes en cascade.
const SECTION_VARIANTS: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: duration.fast, ease: ease.out } },
};
const COVER_VARIANTS: Variants = {
  hidden: { scaleY: 1 },
  visible: { scaleY: 0, transition: { duration: duration.reveal, ease: ease.out, delay: delay.short } },
};
const IMAGE_VARIANTS: Variants = {
  hidden: { scale: 1.08 },
  visible: { scale: 1, transition: { duration: duration.reveal, ease: ease.out, delay: delay.short } },
};
const BADGE_VARIANTS: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: { ...spring.bounce, delay: duration.reveal } },
};
const TEXT_VARIANTS: Variants = {
  hidden: { y: 12, opacity: 0 },
  visible: (order: number) => ({
    y: 0,
    opacity: 1,
    transition: { duration: duration.base, ease: ease.out, delay: duration.reveal + order * staggerStep },
  }),
};

export interface PackagePhotosProps {
  photos: PackagePhoto[];
  packageReadyAt: string | null;
  /** Statut de la réservation : adapte la pastille et le conseil de vérification. */
  status: ReservationStatusCode;
  receptionMode: ReceptionMode;
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
  // « offline » : photo privée jamais enregistrée sur le téléphone, réseau absent (M6 §6.3)
  const [state, setState] = useState<'loading' | 'loaded' | 'error' | 'offline'>('loading');
  const [attempt, setAttempt] = useState(0);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Retour du réseau : la photo restée indisponible se recharge d'elle-même
  useEffect(
    () =>
      useNetworkStore.subscribe((network, previous) => {
        if (network.online && !previous.online && stateRef.current === 'offline') {
          setAttempt((n) => n + 1);
          setState('loading');
        }
      }),
    [],
  );

  return (
    <div className="relative h-full w-full bg-surface">
      {state === 'loading' && <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-surface" />}
      {state !== 'error' && state !== 'offline' && (
        <img
          key={attempt}
          src={photo.url}
          alt={alt}
          width={photo.width}
          height={photo.height}
          decoding="async"
          onLoad={() => setState('loaded')}
          onError={() => {
            // Hors connexion : message propre, sans relancer les liens signés
            if (!isAppOnline()) {
              setState('offline');
              return;
            }
            // Premier échec : liens probablement expirés, la réservation est rechargée (nouvelle URL = nouvelle image)
            onFailure();
            setState('error');
          }}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-slow',
            state === 'loaded' ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
      {state !== 'error' && state !== 'offline' && (
        <button
          type="button"
          onClick={onOpen}
          aria-label={openLabel}
          className="absolute inset-0 rounded-[var(--radius-md)]"
        />
      )}
      {state === 'offline' && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center">
          <WifiOff className="h-6 w-6 text-text-2" aria-hidden="true" />
          <p className="text-small font-semibold text-ink">Photo indisponible hors connexion</p>
          <p className="text-caption text-text-2">Elle s&rsquo;affichera au retour du réseau.</p>
        </div>
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
            className="inline-flex min-h-11 items-center gap-1.5 px-3 text-small font-semibold text-ink underline"
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
 * Bloc « Photos de votre colis » (§6.2 et §6.3 M5) avec dévoilement animé la première fois seulement,
 * quand le bloc entre à l'écran (souvent sous le bloc d'action sur mobile) ; vibration à la fin.
 * Le bloc reste dans le document et dans l'arbre d'accessibilité pendant l'attente (opacité seulement).
 * Animations réduites : affichage direct, le dévoilement est compté comme vu.
 */
export function PackagePhotos({
  photos,
  packageReadyAt,
  status,
  receptionMode,
  alreadyRevealed,
  onRevealed,
  onOpenViewer,
  onPhotoFailure,
}: PackagePhotosProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const online = useOnlineStatus();
  // Figés au montage : une mise à jour du `seenStore` en cours de route n'interrompt pas l'animation
  const [reveal] = useState(() => !alreadyRevealed);
  const [animated] = useState(() => !alreadyRevealed && !prefersReducedMotion());
  const onRevealedRef = useRef(onRevealed);
  const finishedRef = useRef(false);
  const active = photos[Math.min(activeIndex, photos.length - 1)] ?? photos[0];

  useEffect(() => {
    onRevealedRef.current = onRevealed;
  }, [onRevealed]);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    haptic('success');
    onRevealedRef.current();
  };

  // Animations réduites : rien à jouer, le dévoilement est enregistré tout de suite
  useEffect(() => {
    if (reveal && !animated) finish();
    // Montage uniquement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!active) return null;
  const ratio = packagePhotoRatio(active);
  const variants = (value: Variants) => (animated ? value : undefined);
  const showBadge = reveal && READY_STATUSES.has(status);
  const tip = RECEIVED_STATUSES.has(status)
    ? null
    : receptionMode === 'pickup'
      ? 'Vérifiez votre colis au retrait\u00A0: il doit correspondre à cette photo.'
      : 'Vérifiez votre colis à la réception\u00A0: il doit correspondre à cette photo.';

  return (
    <m.section
      id="colis"
      aria-labelledby="colis-titre"
      className="scroll-mt-28 rounded-[var(--radius-md)] border border-silver/70 bg-white p-5 sm:p-6"
      variants={variants(SECTION_VARIANTS)}
      initial={animated ? 'hidden' : false}
      whileInView={animated ? 'visible' : undefined}
      viewport={{ once: true, margin: '0px 0px -15% 0px' }}
    >
      <m.div data-reveal-text variants={variants(TEXT_VARIANTS)} custom={0}>
        <h2 id="colis-titre" className="flex items-center gap-2 text-h3 text-ink">
          <Camera className="h-5 w-5 shrink-0 text-red" aria-hidden="true" />
          <span>Photos de votre colis</span>
        </h2>
        {packageReadyAt && (
          <p className="mt-0.5 text-small text-text-2">Emballé le {formatPackedAt(packageReadyAt)}</p>
        )}
      </m.div>

      <div className="relative mt-4">
        <div
          className={cn(
            'relative overflow-hidden rounded-[var(--radius-md)]',
            // Portrait 4:5 : largeur limitée dès la tablette (480 x 600 au plus) pour garder la photo entière
            // à l'écran, y compris en paysage (1023 x 768)
            ratio === '4/5' && 'sm:max-w-120',
          )}
        >
          <m.div
            data-reveal-image
            variants={variants(IMAGE_VARIANTS)}
            className={ASPECT_CLASSES[ratio] ?? 'aspect-[4/3]'}
          >
            <PackagePhotoImage
              key={active.url}
              photo={active}
              alt={packagePhotoAlt(activeIndex, photos.length)}
              onFailure={onPhotoFailure}
              onOpen={() => onOpenViewer(activeIndex)}
              openLabel={`Agrandir la ${packagePhotoAlt(activeIndex, photos.length).toLowerCase()}`}
            />
          </m.div>
          {animated && (
            // Cache du dévoilement : se retire vers le haut, la photo apparaît de bas en haut
            <m.span
              data-reveal-mask
              aria-hidden="true"
              variants={COVER_VARIANTS}
              onAnimationComplete={(definition) => {
                if (definition === 'visible') finish();
              }}
              className="pointer-events-none absolute inset-0 origin-top bg-white"
            />
          )}
        </div>
        {showBadge && (
          <m.span
            data-reveal-badge
            variants={variants(BADGE_VARIANTS)}
            className="pointer-events-none absolute top-3 left-3 rounded-[var(--radius-full)] bg-red px-3 py-1 text-small font-bold text-white"
          >
            Colis prêt
          </m.span>
        )}
      </div>

      {photos.length > 1 && (
        <m.ul
          data-reveal-text
          variants={variants(TEXT_VARIANTS)}
          custom={1}
          className="mt-3 flex gap-2"
          aria-label="Choisir une photo"
        >
          {photos.map((photo, index) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-pressed={index === activeIndex}
                aria-label={packagePhotoAlt(index, photos.length)}
                className={cn(
                  'h-14 w-14 overflow-hidden rounded-[var(--radius-sm)] ring-offset-2',
                  index === activeIndex ? 'ring-2 ring-ink' : 'ring-1 ring-silver/70',
                )}
              >
                {online ? (
                  <img
                    src={photo.thumbnailUrl}
                    alt=""
                    width={56}
                    height={56}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  // Miniature privée non enregistrée : pas d'image cassée hors connexion
                  <span className="flex h-full w-full items-center justify-center bg-surface">
                    <ImageOff className="h-4 w-4 text-text-2" aria-hidden="true" />
                  </span>
                )}
              </button>
            </li>
          ))}
        </m.ul>
      )}

      {tip && (
        <m.p data-reveal-text variants={variants(TEXT_VARIANTS)} custom={2} className="mt-3 text-small text-text-2">
          {tip}
        </m.p>
      )}
    </m.section>
  );
}
