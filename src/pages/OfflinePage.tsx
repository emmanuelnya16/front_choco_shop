import { OfflineScreen } from '@/features/offline/OfflineScreen';
import { useDocumentTitle } from '@/lib/utils/useDocumentTitle';

/**
 * Page `/hors-ligne` (M6 §6.5) : affichée quand une page n'a jamais été enregistrée sur le
 * téléphone et que le réseau manque. Le même contenu sert de repli dans la fiche produit,
 * le catalogue et les écrans de réservation.
 */
export function OfflinePage() {
  useDocumentTitle('Hors connexion');

  return (
    <div className="px-page pt-10 pb-16 lg:pt-16">
      <OfflineScreen />
    </div>
  );
}
