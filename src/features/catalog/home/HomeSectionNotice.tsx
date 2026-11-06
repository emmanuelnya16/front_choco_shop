import { AlertCircle, CloudOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface HomeSectionNoticeText {
  error: string;
  offline: string;
}

const DEFAULT_TEXT: HomeSectionNoticeText = {
  error: 'Ces articles n’ont pas pu s’afficher.',
  offline: 'Vous êtes hors connexion\u00A0: ces articles s’afficheront dès le retour du réseau.',
};

/**
 * Encart discret à la place du contenu d'une section de l'accueil (erreur ou hors connexion sans
 * données enregistrées), même gabarit que l'encart des zones d'erreur.
 * - erreur : « Réessayer » relance la requête de la section ;
 * - hors connexion : pas de bouton (le bandeau global « Hors connexion » propose déjà « Réessayer » et
 *   les sections se rechargent seules au retour du réseau) : 5 boutons identiques alourdiraient la page.
 */
export function HomeSectionNotice({
  status,
  onRetry,
  text = DEFAULT_TEXT,
}: {
  status: 'error' | 'offline';
  onRetry: () => void;
  text?: HomeSectionNoticeText;
}) {
  const Icon = status === 'offline' ? CloudOff : AlertCircle;

  return (
    <div
      role="status"
      className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[var(--radius-md)] border border-silver bg-surface px-4 py-3"
    >
      <p className="flex items-center gap-2 text-small text-text-2">
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {text[status]}
      </p>
      {status === 'error' && (
        <Button
          variant="ghost"
          size="md"
          iconLeft={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
          onClick={onRetry}
        >
          Réessayer
        </Button>
      )}
    </div>
  );
}
