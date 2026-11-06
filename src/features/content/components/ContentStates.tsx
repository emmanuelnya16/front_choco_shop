import { FileQuestion, Home, LifeBuoy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Primitives';
import { HELP_CENTER_PATH } from '../registry';

/** Gabarit de la page pendant le chargement : titre, date, paragraphes (pas de saut de mise en page). */
export function ContentSkeleton() {
  return (
    <div role="status" aria-label="Chargement de la page" className="max-w-170">
      <Skeleton className="h-9 w-4/5" />
      <Skeleton className="mt-3 h-4 w-48" />
      <div className="mt-8 space-y-3">
        {['w-full', 'w-11/12', 'w-full', 'w-3/4'].map((width, index) => (
          <Skeleton key={index} className={`h-4 ${width}`} />
        ))}
      </div>
      <Skeleton className="mt-10 h-6 w-2/3" />
      <div className="mt-4 space-y-3">
        {['w-full', 'w-10/12', 'w-full'].map((width, index) => (
          <Skeleton key={index} className={`h-4 ${width}`} />
        ))}
      </div>
    </div>
  );
}

/** Adresse inconnue (404 PAGE_NOT_FOUND) : renvoi vers le centre d'aide. */
export function ContentNotFound() {
  return (
    <section aria-labelledby="page-introuvable-titre" className="mx-auto flex max-w-170 flex-col items-start py-6">
      <span className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-full)] bg-surface text-ink">
        <FileQuestion className="h-7 w-7" aria-hidden="true" />
      </span>
      <h1 id="page-introuvable-titre" className="mt-5 text-h1 text-ink">
        Page introuvable
      </h1>
      <p className="mt-3 text-body text-text-2">
        Cette page n’existe pas ou a été déplacée. Le centre d’aide répond à la plupart des questions.
      </p>
      <div className="mt-6 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
        <Button variant="dark" size="lg" href={HELP_CENTER_PATH} iconLeft={<LifeBuoy className="h-4 w-4" aria-hidden="true" />}>
          Aller au centre d’aide
        </Button>
        <Button variant="outline" size="lg" href="/" iconLeft={<Home className="h-4 w-4" aria-hidden="true" />}>
          Revenir à l’accueil
        </Button>
      </div>
    </section>
  );
}

/** Erreur du serveur : la page n'a pas pu être chargée. */
export function ContentLoadError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <section role="alert" className="mx-auto flex max-w-170 flex-col items-start py-6">
      <h1 className="text-h1 text-ink">Page indisponible</h1>
      <p className="mt-3 text-body text-text-2">
        Cette page n’a pas pu être chargée. Réessayez dans un instant.
      </p>
      <Button
        variant="dark"
        size="lg"
        className="mt-6"
        loading={retrying}
        onClick={onRetry}
        iconLeft={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
      >
        Réessayer
      </Button>
    </section>
  );
}
