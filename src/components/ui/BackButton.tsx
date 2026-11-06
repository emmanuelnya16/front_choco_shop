import { ArrowLeft } from 'lucide-react';
import { useBackNavigation, type BackNavigationOptions } from '@/lib/hooks/useBackNavigation';
import { cn } from '@/lib/utils/cn';

export interface BackButtonProps extends BackNavigationOptions {
  /** Parent logique quand aucun écran précédent de l'app n'existe. */
  fallback: string;
  /** Texte visible à côté de la flèche (« Retour » par défaut). */
  label?: string;
  className?: string;
}

/**
 * Flèche retour des pages de niveau 2 et plus (M6 §8), sur le modèle des liens « Mes
 * réservations » et « Profil » de M5 : flèche + texte, zone tactile de 44 px.
 */
export function BackButton({ fallback, label = 'Retour', className, parentOnly }: BackButtonProps) {
  const goBack = useBackNavigation(fallback, { parentOnly });

  return (
    <button
      type="button"
      onClick={goBack}
      className={cn(
        '-ml-2 inline-flex min-h-11 items-center gap-1.5 px-2 text-small font-semibold text-ink',
        className,
      )}
    >
      <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      {label}
    </button>
  );
}
