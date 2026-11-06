import { BackButton } from '@/components/ui/BackButton';
import { OfflineScreen } from '@/features/offline/OfflineScreen';
import { useDocumentTitle } from '@/lib/utils/useDocumentTitle';

/**
 * Page `/hors-ligne` (M6 §6.5) : affichée quand une page n'a jamais été enregistrée sur le
 * téléphone et que le réseau manque. Le même contenu sert de repli dans la fiche produit,
 * le catalogue et les écrans de réservation.
 */
export function OfflinePage() {
  useDocumentTitle('Hors connexion', {
    description: 'Cette page n’est pas encore enregistrée sur votre téléphone. Réessayez une fois connecté.',
  });

  return (
    <div className="px-page pt-4 pb-16 lg:pt-16">
      {/* Mode application : pas de bouton retour du navigateur (M6 §8) */}
      <BackButton fallback="/" className="lg:hidden" />
      <OfflineScreen className="mt-6" />
    </div>
  );
}
