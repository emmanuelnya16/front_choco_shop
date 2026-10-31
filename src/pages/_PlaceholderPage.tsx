import { ArrowLeft, ArrowUpRight, Compass, Terminal } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';
import { BackButton } from '@/components/ui/BackButton';
import { env } from '@/lib/env';
import { useDocumentTitle } from '@/lib/utils/useDocumentTitle';

export interface PlaceholderPageProps {
  title: string;
  documentTitle?: string;
  sectionNumber: string;
  moduleRef: string;
  description: string;
}

const ROUTE_DIRECTORY = [
  { path: '/', label: 'Accueil', section: '5.2' },
  { path: '/explorer', label: 'Catalogue', section: '5.3' },
  { path: '/explorer/vetements', label: 'Catégorie Vêtements', section: '5.3' },
  { path: '/recherche', label: 'Recherche', section: '5.4' },
  { path: '/produit/hoodie-barbele-noir', label: 'Fiche produit', section: '5.6' },
  { path: '/favoris', label: 'Favoris', section: '5.15' },
  { path: '/panier', label: 'Panier', section: '5.7' },
  { path: '/reservation', label: 'Réservation', section: '5.9' },
  { path: '/reservation/RES-000102/paiement', label: 'Paiement Mobile Money', section: '5.10' },
  { path: '/reservation/RES-000102/preuve', label: 'Envoi de la preuve', section: '5.11' },
  { path: '/reservation/RES-000102/merci', label: 'Succès réservation', section: '5.12' },
  { path: '/reservations', label: 'Mes réservations', section: '5.13' },
  { path: '/reservations/RES-000102', label: 'Détail réservation (Colis)', section: '5.14' },
  { path: '/profil', label: 'Profil client', section: '5.16' },
  { path: '/pages/cgv', label: 'Pages légales', section: '5.17' },
  { path: '/hors-ligne', label: 'Hors-ligne', section: '5.17' },
] as const;

export function PlaceholderPage({
  title,
  documentTitle,
  sectionNumber,
  moduleRef,
  description,
}: PlaceholderPageProps) {
  useDocumentTitle(documentTitle ?? title);
  const params = useParams();
  const location = useLocation();
  const paramEntries = Object.entries(params).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0,
  );

  return (
    <main className="mx-auto min-h-dvh max-w-content px-page py-8">
      {/* Retour (M6 §8) : pages légales, aide et page introuvable */}
      {location.pathname !== '/' && <BackButton fallback="/" className="mb-4 lg:hidden" />}
      {/* Bandeau d'accès rapide au socle M0 */}
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-silver pb-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-ink text-body font-extrabold text-white">
            C
          </span>
          <div>
            <p className="text-label text-text-2">DR CHOCO L&apos;INCOMPRIS · SOCLE M0</p>
            <p className="text-small font-semibold text-ink">
              Module M0 « Fondations » · Écran provisoire ({moduleRef})
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {location.pathname !== '/' && (
            <Link
              to="/"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] border border-silver bg-white px-4 py-2 text-small font-semibold text-ink transition-colors hover:bg-surface"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Revenir à l&apos;accueil
            </Link>
          )}
          {env.enableDevPage && (
            <Link
              to="/_dev"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] bg-red px-4 py-2 text-small font-bold text-white transition-opacity hover:opacity-95"
            >
              <Terminal className="h-4 w-4" aria-hidden="true" />
              Ouvrir la page de contrôle /_dev
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </header>

      {/* Carte principale de l'écran provisoire */}
      <section className="rounded-[var(--radius-md)] border border-silver bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-label text-text-2">
          <span>SECTION {sectionNumber}</span>
          <span aria-hidden="true">·</span>
          <span>LIVRABLE {moduleRef}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono text-ink">{location.pathname}</span>
        </div>

        <h1 className="mt-3 text-h1 text-ink">{title}</h1>
        <p className="mt-3 max-w-2xl text-body text-text-2">{description}</p>

        {paramEntries.length > 0 && (
          <div className="mt-6 rounded-[var(--radius-md)] border border-silver bg-white p-4">
            <p className="text-label text-text-2">PARAMÈTRES D&apos;URL DÉTECTÉS</p>
            <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {paramEntries.map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-2 text-small">
                  <dt className="font-mono text-text-2">:{key}</dt>
                  <dd className="font-mono font-bold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] bg-ink px-5 py-2.5 text-small font-bold text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Revenir à l&apos;accueil
          </Link>
          {env.enableDevPage && (
            <Link
              to="/_dev"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] border border-ink bg-white px-5 py-2.5 text-small font-bold text-ink hover:bg-surface"
            >
              Inspecter les fondations M0 (/_dev)
            </Link>
          )}
        </div>
      </section>

      {/* Répertoire de vérification rapide de toutes les routes de la section 9.2 */}
      <section className="mt-10" aria-labelledby="routes-directory-heading">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-ink" aria-hidden="true" />
            <h2 id="routes-directory-heading" className="text-h2 text-ink">
              Toutes les routes client (Section 9.2)
            </h2>
          </div>
          <span className="text-small text-text-2">Chargement à la demande (lazy)</span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {ROUTE_DIRECTORY.map((route) => {
            const isActive = location.pathname === route.path;
            return (
              <Link
                key={route.path}
                to={route.path}
                className={`flex min-h-[48px] items-center justify-between gap-3 rounded-[var(--radius-md)] border px-3.5 py-2.5 transition-colors ${
                  isActive
                    ? 'border-ink bg-ink text-white'
                    : 'border-silver bg-white text-ink hover:bg-surface'
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-small font-bold">{route.label}</p>
                  <p
                    className={`truncate font-mono text-xs ${
                      isActive ? 'text-silver' : 'text-text-2'
                    }`}
                  >
                    {route.path}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-label ${isActive ? 'text-silver' : 'text-text-2'}`}
                >
                  §{route.section}
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
