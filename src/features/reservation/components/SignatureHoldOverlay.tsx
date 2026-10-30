import { useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { gsap, SplitText, useGSAP } from '@/lib/gsap';
import { haptic } from '@/lib/utils/haptics';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import type { SourceRect } from '@/stores/uiStore';

export interface SignatureHoldOverlayProps {
  reservationRef: string;
  buttonRect?: SourceRect | null;
  onComplete: () => void;
}

/**
 * Moment signature « Vos articles sont mis de côté » (GSAP, §7.2) :
 * - 0 s : Calque `ink` partant de la forme du bouton « Confirmer » (`clipPath: inset(...)`) jusqu'à couvrir l'écran (`0,6 s`, `power3.inOut`).
 * - 0,45 s : Cercle `silver` à 20 % se dessine (`DrawSVG`, `0,6 s`), puis coche blanche se dessine dedans (`0,35 s`) + `haptic('success')`.
 * - 0,9 s : Titre « ARTICLES MIS DE CÔTÉ » monte de derrière son masque (`text-h1`, blanc).
 * - 1,1 s : Numéro `RES-000124` apparaît caractère par caractère (`SplitText chars`, décalage `0,03 s`), en `text-display` réduit, blanc.
 * - 1,35 s : Phrase « Réservés pour vous pendant 24 h. Payez maintenant par Mobile Money. » en fondu.
 * - 2,2 s : Transition automatique vers `/reservation/:ref/paiement`.
 * - Un appui n'importe où passe directement à la page de paiement.
 * - Animations réduites : affichage direct + bouton « Payer maintenant » (pas de transition automatique).
 */
export function SignatureHoldOverlay({
  reservationRef,
  buttonRect,
  onComplete,
}: SignatureHoldOverlayProps) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotionPref();
  const completedRef = useRef(false);

  const triggerComplete = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  };

  useGSAP(
    () => {
      if (reducedMotion) {
        haptic('success');
        return;
      }

      const vw = window.innerWidth || 390;
      const vh = window.innerHeight || 844;

      const topInset = buttonRect
        ? Math.max(0, Math.round(buttonRect.y))
        : Math.round(vh * 0.85);
      const leftInset = buttonRect
        ? Math.max(0, Math.round(buttonRect.x))
        : Math.round(vw * 0.1);
      const rightInset = buttonRect
        ? Math.max(0, Math.round(vw - (buttonRect.x + buttonRect.width)))
        : Math.round(vw * 0.1);
      const bottomInset = buttonRect
        ? Math.max(0, Math.round(vh - (buttonRect.y + buttonRect.height)))
        : Math.round(vh * 0.05);

      const initialClip = `inset(${topInset}px ${rightInset}px ${bottomInset}px ${leftInset}px round 8px)`;
      const finalClip = 'inset(0px 0px 0px 0px round 0px)';

      const splitRef = new SplitText('.sig-ref-code', { type: 'chars' });

      const tl = gsap.timeline({
        onComplete: () => {
          triggerComplete();
        },
      });

      // 0 s : expansion du calque ink depuis le bouton
      tl.fromTo(
        '.sig-backdrop',
        { clipPath: initialClip },
        { clipPath: finalClip, duration: 0.6, ease: 'power3.inOut' },
        0,
      );

      // 0,45 s : cercle silver/20 (DrawSVG 0,6 s) puis coche blanche (0,35 s)
      tl.fromTo(
        '.sig-circle',
        { drawSVG: '0%' },
        { drawSVG: '100%', duration: 0.6, ease: 'power2.out' },
        0.45,
      );

      tl.fromTo(
        '.sig-check',
        { drawSVG: '0%' },
        {
          drawSVG: '100%',
          duration: 0.35,
          ease: 'power2.out',
          onStart: () => {
            haptic('success');
          },
        },
        0.75,
      );

      // 0,9 s : titre « ARTICLES MIS DE CÔTÉ » monte de derrière son masque
      tl.fromTo(
        '.sig-title-inner',
        { yPercent: 110, autoAlpha: 0 },
        { yPercent: 0, autoAlpha: 1, duration: 0.45, ease: 'power3.out' },
        0.9,
      );

      // 1,1 s : numéro RES-000124 caractère par caractère
      tl.fromTo(
        splitRef.chars,
        { yPercent: 60, autoAlpha: 0 },
        {
          yPercent: 0,
          autoAlpha: 1,
          duration: 0.32,
          stagger: 0.03,
          ease: 'power3.out',
        },
        1.1,
      );

      // 1,35 s : phrase d'accompagnement en fondu
      tl.fromTo(
        '.sig-subtitle',
        { autoAlpha: 0, y: 8 },
        { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out' },
        1.35,
      );

      // 2,2 s : maintien jusqu'à 2,2 s avant passage automatique au paiement
      tl.to({}, { duration: 0.45 }, 1.75);

      return () => {
        splitRef.revert();
      };
    },
    { scope: scopeRef, dependencies: [reducedMotion, reservationRef] },
  );

  return (
    <div
      ref={scopeRef}
      role="dialog"
      aria-modal="true"
      aria-label="Vos articles sont mis de côté"
      onClick={!reducedMotion ? triggerComplete : undefined}
      className="sig-backdrop fixed inset-0 z-[80] flex cursor-pointer flex-col items-center justify-center bg-ink px-6 text-center text-white"
    >
      <div className="mx-auto flex max-w-md flex-col items-center">
        {/* Cercle silver 20 % + coche blanche */}
        <svg
          viewBox="0 0 88 88"
          fill="none"
          className="h-22 w-22"
          aria-hidden="true"
        >
          <circle
            cx="44"
            cy="44"
            r="38"
            className="sig-circle stroke-silver/20"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M28 45.5L39 56.5L61 33.5"
            className="sig-check stroke-white"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Titre masqué */}
        <div className="mt-6 overflow-hidden">
          <h1 className="sig-title-inner text-h1 text-white">
            ARTICLES MIS DE CÔTÉ
          </h1>
        </div>

        {/* Référence RES-000124 */}
        <p className="sig-ref-code mt-3 font-mono text-[clamp(2rem,6vw,3.25rem)] font-black tracking-tight text-white">
          {reservationRef}
        </p>

        {/* Phrase d'accompagnement */}
        <p className="sig-subtitle mt-3 max-w-sm text-body text-silver">
          Réservés pour vous pendant 24 h. Payez maintenant par Mobile Money.
        </p>

        {reducedMotion ? (
          <div className="mt-8">
            <Button variant="primary" size="lg" onClick={triggerComplete}>
              Payer maintenant
            </Button>
          </div>
        ) : (
          <span className="mt-8 text-xs font-semibold uppercase tracking-widest text-grey">
            Touchez l&rsquo;écran pour continuer →
          </span>
        )}
      </div>
    </div>
  );
}
