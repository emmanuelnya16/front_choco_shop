import * as m from 'motion/react-m';
import { ArrowLeft, LayoutGrid, LifeBuoy, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { addRecentSearch } from '@/features/catalog/search/recentSearches';
import { useSeo } from '@/lib/seo/useSeo';
import { duration, ease } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';

const DESCRIPTION = 'Cette adresse ne mène à aucune page de la boutique DR Choco L’Incompris.';

/** Illustration en traits « loupe et point d'interrogation », même famille que les écrans d'erreur. */
function NotFoundIllustration() {
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
      {/* Loupe */}
      <circle cx="72" cy="54" r="30" />
      <path d="m94 76 22 22" strokeWidth="5" />
      {/* Point d'interrogation */}
      <path d="M63 46a9 9 0 1 1 13 8c-3 1.6-4 3.4-4 6.5" strokeWidth="3" />
      <path d="M72 70h.01" strokeWidth="4" />
      {/* Éclats décoratifs */}
      <path d="m124 26 6-6M128 40h8M30 26l-6-6M28 40h-8" opacity="0.35" />
    </svg>
  );
}

/**
 * Page introuvable (adresse inconnue de l'app) : titre, phrase courte, recherche, retour à
 * l'accueil, catalogue et centre d'aide. Jamais indexée par les moteurs de recherche.
 */
export function NotFoundPage() {
  useSeo({ title: 'Page introuvable', description: DESCRIPTION, noindex: true });
  const navigate = useNavigate();
  const reducedMotion = useReducedMotionPref();
  const [query, setQuery] = useState('');

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    addRecentSearch(trimmed);
    void navigate(`/explorer?q=${encodeURIComponent(trimmed)}`, { viewTransition: true });
  };

  return (
    <section
      aria-labelledby="introuvable-titre"
      className="flex w-full flex-col items-center px-page pt-10 pb-16 text-center lg:pt-16"
    >
      <m.div
        initial={reducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: duration.base, ease: ease.out }}
        className="flex w-full max-w-160 flex-col items-center"
      >
        <div className="text-silver">
          <NotFoundIllustration />
        </div>
        <h1 id="introuvable-titre" className="mt-5 text-h1 text-ink">
          Page introuvable
        </h1>
        <p className="mt-2 max-w-sm text-body text-text-2">
          Le lien est peut-être ancien ou incomplet. Cherchez un article ou revenez à l’accueil.
        </p>

        <form role="search" onSubmit={handleSearch} className="mt-6 flex w-full max-w-md gap-2">
          <label htmlFor="introuvable-recherche" className="sr-only">
            Rechercher un article
          </label>
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-text-2"
              aria-hidden="true"
            />
            <input
              id="introuvable-recherche"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="T-shirt, babouche…"
              enterKeyHint="search"
              className="h-12 w-full rounded-[var(--radius-md)] border border-silver bg-white pr-4 pl-10 text-body text-ink placeholder:text-text-2 focus:border-ink focus:outline-none"
            />
          </div>
          <Button type="submit" variant="dark" size="md" className="min-h-12">
            Rechercher
          </Button>
        </form>

        <div className="mt-4 flex w-full max-w-md flex-col gap-2.5 sm:flex-row">
          <Button
            variant="primary"
            size="lg"
            href="/"
            fullWidth
            iconLeft={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
          >
            Revenir à l’accueil
          </Button>
          <Button
            variant="outline"
            size="lg"
            href="/explorer"
            fullWidth
            iconLeft={<LayoutGrid className="h-4 w-4" aria-hidden="true" />}
          >
            Voir le catalogue
          </Button>
        </div>

        <Link
          to="/aide"
          className="mt-6 inline-flex min-h-11 items-center gap-2 text-small font-semibold text-ink underline underline-offset-4 [@media(hover:hover)]:hover:text-red"
        >
          <LifeBuoy className="h-4 w-4" aria-hidden="true" />
          Besoin d’aide&nbsp;? Centre d’aide
        </Link>
      </m.div>
    </section>
  );
}
