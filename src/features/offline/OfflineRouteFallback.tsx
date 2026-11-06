import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import { OfflineScreen } from './OfflineScreen';

/**
 * Repli plein écran du routeur quand une page ne peut pas se charger hors connexion (M6 §6.5).
 * Il remplace toute la coquille (en-tête et barre basse) : un lien ramène à l'accueil enregistré.
 */
export function OfflineRouteFallback() {
  return (
    <main id="contenu" className="min-h-dvh bg-white px-page pt-[calc(env(safe-area-inset-top)+16px)] pb-16 lg:pt-12">
      <div className="mx-auto w-full max-w-160">
        <Link
          to="/"
          className="-ml-2 inline-flex min-h-11 items-center gap-2 px-2 text-small font-semibold text-ink"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Revenir à l&rsquo;accueil
        </Link>
      </div>
      <OfflineScreen className="mt-6" />
    </main>
  );
}
