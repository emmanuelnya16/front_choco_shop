import * as m from 'motion/react-m';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { useEffect, useRef, type MouseEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';
import { duration, ease } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { pageReload } from './chunkReload';

/** Illustration en traits « sac fendu », même famille que les états vides et « hors connexion ». */
function ErrorIllustration() {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-28 w-36"
    >
      {/* Sac et anses */}
      <path d="M50 42h60l6 62H44l6-62Z" />
      <path d="M66 42v-7a14 14 0 0 1 28 0v7" />
      {/* Fente */}
      <path d="m82 54-7 13 10 7-8 15" strokeWidth="3" />
      {/* Éclats décoratifs */}
      <path d="m126 30 6-6M130 42h8M34 30l-6-6M30 42h-8" opacity="0.35" />
    </svg>
  );
}

// Même rendu que <Button variant="outline" size="lg"> : un vrai lien, utilisable sans routeur
const HOME_LINK_CLASSES =
  'inline-flex min-h-[52px] shrink-0 items-center justify-center gap-2.5 rounded-[var(--radius-md)] border-[1.5px] border-ink bg-transparent px-6 py-3 text-[15px] font-semibold whitespace-nowrap text-ink transition-colors select-none [@media(hover:hover)]:hover:bg-surface';

export interface GeneralErrorScreenProps {
  /** Plein écran (coquille, routeur) ou dans la page, sous l'en-tête. */
  fullScreen?: boolean;
  /** Retour à l'accueil sans recharger l'app ; sans lui, le lien charge l'accueil. */
  onGoHome?: () => void;
  /** Apparition douce : seulement sous le fournisseur d'animations de l'app. */
  animated?: boolean;
  /** Coquille hors connexion (page jamais enregistrée) : textes « hors connexion ». */
  offline?: boolean;
}

/**
 * Écran d'erreur générale (M7 §5.1) : titre, phrase rassurante, « Recharger » et
 * « Revenir à l'accueil ». Aucun détail technique n'est montré au client.
 */
export function GeneralErrorScreen({
  fullScreen = false,
  onGoHome,
  animated = false,
  offline = false,
}: GeneralErrorScreenProps) {
  const title = offline ? 'Vous êtes hors connexion' : 'Oups, quelque chose s’est mal passé';
  const description = offline
    ? 'Cette page n’a pas encore été enregistrée sur votre téléphone. Réessayez une fois connecté.'
    : 'Pas d’inquiétude : votre panier et vos réservations sont conservés. Rechargez la page pour continuer.';
  const reloadLabel = offline ? 'Réessayer' : 'Recharger';
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reducedMotion = useReducedMotionPref();
  const Wrapper = fullScreen ? 'main' : 'section';

  // Le lecteur d'écran annonce le problème : le titre reçoit le focus
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const handleHome = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!onGoHome) return;
    event.preventDefault();
    onGoHome();
  };

  const content = (
    <>
      <div className="text-silver">
        <ErrorIllustration />
      </div>
      <h1 ref={headingRef} tabIndex={-1} className="mt-5 text-h1 text-ink focus:outline-none">
        {title}
      </h1>
      <p className="mt-2 max-w-sm text-body text-text-2">{description}</p>
      <div className="mt-6 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
        <Button
          variant="dark"
          size="lg"
          iconLeft={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
          onClick={() => pageReload.reload()}
        >
          {reloadLabel}
        </Button>
        <a href="/" onClick={handleHome} className={HOME_LINK_CLASSES}>
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
          Revenir à l’accueil
        </a>
      </div>
    </>
  );

  return (
    <Wrapper
      {...(fullScreen ? { id: 'contenu' } : {})}
      className={cn(
        'flex w-full flex-col items-center justify-center px-page text-center',
        fullScreen ? 'min-h-dvh bg-white py-12' : 'pt-10 pb-16 lg:pt-16',
      )}
    >
      {animated ? (
        <m.div
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: duration.base, ease: ease.out }}
          className="flex w-full max-w-[640px] flex-col items-center"
        >
          {content}
        </m.div>
      ) : (
        <div className="flex w-full max-w-[640px] flex-col items-center">{content}</div>
      )}
    </Wrapper>
  );
}

/** Encart discret d'une section de l'accueil qui n'a pas pu s'afficher. */
export function SectionErrorNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto w-full max-w-content px-page py-6">
      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[var(--radius-md)] border border-silver bg-surface px-4 py-3"
      >
        <p className="flex items-center gap-2 text-small text-text-2">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Cette partie n’a pas pu s’afficher.
        </p>
        <Button
          variant="ghost"
          size="sm"
          iconLeft={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
          onClick={onRetry}
        >
          Réessayer
        </Button>
      </div>
    </div>
  );
}

export type ErrorScreensProps =
  | ({ kind?: 'general' } & GeneralErrorScreenProps)
  | { kind: 'section'; onRetry: () => void };

/**
 * Point d'entrée du module, chargé à la demande par `ErrorScreen` (ErrorBoundary.tsx) :
 * les écrans d'erreur n'alourdissent pas le JavaScript de démarrage.
 */
export default function ErrorScreens(props: ErrorScreensProps) {
  return props.kind === 'section' ? (
    <SectionErrorNotice onRetry={props.onRetry} />
  ) : (
    <GeneralErrorScreen {...props} />
  );
}
