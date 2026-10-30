import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Package,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TimerOff,
  XCircle,
} from 'lucide-react';
import * as m from 'motion/react-m';
import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router';
import { api, ApiError } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { qk } from '@/lib/api/queryKeys';
import { env } from '@/lib/env';
import { calculateWcagContrast } from '@/lib/utils/contrast';
import { formatCountdown, formatDate } from '@/lib/utils/date';
import { haptic } from '@/lib/utils/haptics';
import { formatCmPhone, isValidCmPhone, normalizeCmPhone } from '@/lib/utils/phone';
import { formatPrice } from '@/lib/utils/price';
import { useDocumentTitle } from '@/lib/utils/useDocumentTitle';
import { DESIGN_COLOR_SWATCHES } from '@/mocks/fixtures/settings';
import { lineReveal, pressable, staggerContainer } from '@/motion/presets';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { useReservationStore } from '@/stores/reservationStore';
import type { ProductsResponse, ReservationDetailResponse } from '@/types/api';
import { hasPackagePhotos } from '@/types/domain';
import {
  isFinalStatus,
  STATUS_META,
  TIMELINE_ORDER,
  type ReservationStatusCode,
  type StatusTone,
} from '@/types/reservationStatus';

import { M1KitShowcase } from './M1KitShowcase';
import { ShopSimulatorM5 } from './ShopSimulatorM5';

const LazyGsapSandbox = lazy(() => import('./GsapTestSandbox'));

const TONE_STYLES: Record<StatusTone, string> = {
  neutral: 'border-silver bg-surface text-ink',
  warning: 'border-warning bg-warning text-white',
  danger: 'border-danger bg-danger text-white',
  success: 'border-success bg-success text-white',
};

const HERO_LINES = ["L'INCOMPRIS", 'NE SE PLIE', 'À PERSONNE.'] as const;

export function DevPage() {
  useDocumentTitle('Contrôle M0–M5 (/_dev)');
  const reducedMotion = useReducedMotionPref();
  const queryClient = useQueryClient();
  const activeReservation = useReservationStore((s) => s.activeReservation);
  const setActiveReservation = useReservationStore((s) => s.setActiveReservation);
  const clearActiveReservation = useReservationStore((s) => s.clearActiveReservation);

  const [heroReplayKey, setHeroReplayKey] = useState(0);
  const [simulateApiError, setSimulateApiError] = useState(false);
  const [hapticTriggered, setHapticTriggered] = useState<string | null>(null);
  const [selectedReservationRef, setSelectedReservationRef] = useState<
    'RES-000102' | 'RES-000101' | 'RES-000103'
  >('RES-000102');
  const [simulatorRef, setSimulatorRef] = useState<string>(
    () => activeReservation?.ref ?? 'RES-000101',
  );
  const [simulatorFeedback, setSimulatorFeedback] = useState<string | null>(null);
  const [simulatorBusy, setSimulatorBusy] = useState(false);

  const runShopSimulation = async (
    label: string,
    action: () => Promise<ReservationDetailResponse>,
  ) => {
    const cleanRef = simulatorRef.trim().toUpperCase();
    if (!cleanRef) return;
    setSimulatorBusy(true);
    setSimulatorFeedback(null);
    try {
      const updated = await action();
      queryClient.setQueryData(qk.reservation(cleanRef), updated);
      await queryClient.invalidateQueries({ queryKey: qk.reservation(cleanRef) });
      await queryClient.invalidateQueries({ queryKey: qk.pendingReservations() });
      if (updated.status === 'reserved' || updated.status === 'payment_rejected') {
        setActiveReservation(updated, updated.serverTime);
      } else if (activeReservation?.ref === updated.ref) {
        clearActiveReservation();
      }
      setSimulatorFeedback(
        `${label} appliqué sur ${updated.ref} → statut « ${STATUS_META[updated.status].label} »`,
      );
      haptic('success');
    } catch (err) {
      setSimulatorFeedback(
        err instanceof ApiError
          ? `Erreur (${err.status}) : ${err.message}`
          : 'Erreur lors de la simulation.',
      );
    } finally {
      setSimulatorBusy(false);
    }
  };

  // 6. Requête catalogue réelle vers MSW via TanStack Query
  const productsFilters = simulateApiError ? { page: 1, q: '__error__' } : { page: 1 };
  const productsQuery = useQuery({
    queryKey: qk.products(productsFilters),
    queryFn: () => api.get<ProductsResponse>(endpoints.catalog.products(productsFilters)),
  });

  // 8 bis. Requête réservation RES-000102 (photo du colis) via MSW
  const reservationQuery = useQuery({
    queryKey: qk.reservation(selectedReservationRef),
    queryFn: () =>
      api.get<ReservationDetailResponse>(endpoints.reservations.detail(selectedReservationRef)),
  });

  const handleTestHaptic = () => {
    const didVibrate = haptic('success');
    setHapticTriggered(
      didVibrate
        ? 'Vibration envoyée ([10, 40, 10] ms)'
        : 'API navigator.vibrate ignorée (navigateur non compatible ou animations réduites)',
    );
  };

  return (
    <div className="min-h-dvh bg-white text-ink">
      {/* Barre supérieure du laboratoire M0 */}
      <header className="sticky top-0 z-header border-b border-silver bg-ink text-white">
        <div className="mx-auto flex h-[var(--header-h)] max-w-content items-center justify-between gap-4 px-page">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-red text-small font-extrabold text-white">
              M0
            </span>
            <div className="min-w-0">
              <p className="truncate text-small font-extrabold uppercase tracking-tight">
                DR Choco L&apos;Incompris · Laboratoire /_dev
              </p>
            </div>
          </div>

          <Link
            to="/"
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] bg-ink-2 px-3 py-1.5 text-small font-semibold text-silver transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Accueil
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-content space-y-12 px-page py-8">
        {/* Bandeau d'introduction */}
        <section className="rounded-[var(--radius-md)] border border-silver bg-surface p-5 sm:p-6">
          <p className="text-label text-text-2">MODULE M0 « FONDATIONS » · RECETTE TECHNIQUE</p>
          <h1 className="mt-2 text-h1 text-ink">Socle Design, Mouvement &amp; API Mock</h1>
          <p className="mt-2 max-w-3xl text-body text-text-2">
            Cette page vérifie en direct les 9 piliers du module M0 : jetons de couleurs et
            contrastes WCAG, police locale Archivo Variable (axes graisse + largeur), Motion
            strict, GSAP isolé à la demande, états réduits, mocks MSW avec latence mobile,
            utilitaires Cameroun (+237 / FCFA) et photos de colis prêt.
          </p>
        </section>

        {/* 1. COULEURS */}
        <section aria-labelledby="dev-colors">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-silver pb-3">
            <h2 id="dev-colors" className="text-h2 text-ink">
              1. Couleurs &amp; Contrastes WCAG en direct
            </h2>
            <span className="text-small text-text-2">
              11 jetons CSS (@theme) · Zéro couleur en dur dans les composants
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DESIGN_COLOR_SWATCHES.map((swatch) => {
              const contrastWithSample = calculateWcagContrast(swatch.hex, swatch.sampleTextHex);
              const contrastOnWhite = calculateWcagContrast(swatch.hex, DESIGN_COLOR_SWATCHES[4].hex);

              return (
                <article
                  key={swatch.token}
                  className="flex flex-col justify-between rounded-[var(--radius-md)] border border-silver bg-white p-4"
                >
                  <div>
                    <div
                      className={`flex h-24 items-end justify-between rounded-[var(--radius-sm)] border border-silver p-3 ${swatch.bgClass} ${swatch.textClass}`}
                    >
                      <span className="font-mono text-small font-bold">{swatch.token}</span>
                      <span className="font-mono text-label">{swatch.hex}</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-label text-text-2">
                        {swatch.group === 'brand' ? 'CHARTE CLIENT' : 'NUANCE TECHNIQUE'}
                      </span>
                      <span className="font-mono text-small font-bold tabular-nums text-ink">
                        Contraste : {contrastWithSample}:1
                      </span>
                    </div>

                    <p className="mt-1.5 text-small text-ink">{swatch.role}</p>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-surface pt-2 text-xs text-text-2">
                    <span>{swatch.sampleTextLabel}</span>
                    <span className="font-mono tabular-nums">Sur blanc : {contrastOnWhite}:1</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* 2. TYPOGRAPHIE */}
        <section aria-labelledby="dev-typography">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-silver pb-3">
            <h2 id="dev-typography" className="text-h2 text-ink">
              2. Typographie Fluide · Archivo Variable
            </h2>
            <span className="text-small text-text-2">
              Servie en local (@fontsource-variable/archivo/wdth.css)
            </span>
          </div>

          <div className="mt-5 space-y-4 rounded-[var(--radius-md)] border border-silver bg-surface p-5">
            <div className="border-b border-silver pb-4">
              <p className="text-label text-text-2">
                text-display · 800 · capitales · line-height 0.92 · stretch 75%
              </p>
              <p className="mt-2 text-display text-ink">NOUVELLE COLLECTION</p>
            </div>

            <div className="border-b border-silver pb-4">
              <p className="text-label text-text-2">
                text-h1 · 800 · capitales · line-height 1.0 · stretch 75%
              </p>
              <p className="mt-2 text-h1 text-ink">VESTIAIRE STREETWEAR DOUALA</p>
            </div>

            <div className="border-b border-silver pb-4">
              <p className="text-label text-text-2">text-h2 · 700 · capitales · line-height 1.1</p>
              <p className="mt-2 text-h2 text-ink">BABOUCHES CUIR PLEINE FLEUR</p>
            </div>

            <div className="border-b border-silver pb-4">
              <p className="text-label text-text-2">text-h3 · 600 · line-height 1.3</p>
              <p className="mt-1 text-h3 text-ink">Hoodie Barbelé Noir</p>
            </div>

            <div className="grid grid-cols-1 gap-4 border-b border-silver pb-4 sm:grid-cols-3">
              <div>
                <p className="text-label text-text-2">text-body · 16 px (400)</p>
                <p className="mt-1 text-body text-ink">
                  Réservez vos pièces en ligne, stock bloqué pendant 24 heures.
                </p>
              </div>
              <div>
                <p className="text-label text-text-2">text-small · 14 px (400)</p>
                <p className="mt-1 text-small text-text-2">
                  Paiement par Orange Money ou MTN MoMo avec capture d&apos;écran.
                </p>
              </div>
              <div>
                <p className="text-label text-text-2">text-label &amp; text-price (tabular-nums)</p>
                <p className="mt-1 text-label text-ink">PRIX BOUTIQUE</p>
                <p className="mt-1 text-h2 text-price text-ink">{formatPrice(45000)}</p>
              </div>
            </div>

            {/* Démonstration de l'axe de largeur wdth (75 %, 100 %, 125 %) */}
            <div>
              <p className="text-label text-text-2">
                DÉMONSTRATION DE L&apos;AXE DE LARGEUR VARIABLE (WDTH : 75 % · 100 % · 125 %)
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-[var(--radius-sm)] border border-silver bg-white p-3">
                  <span className="text-label text-text-2">Condensé · 75 %</span>
                  <p
                    className="mt-1 text-xl font-extrabold uppercase text-ink"
                    style={{ fontStretch: '75%', fontVariationSettings: "'wdth' 75" }}
                  >
                    DR CHOCO 237
                  </p>
                </div>
                <div className="rounded-[var(--radius-sm)] border border-silver bg-white p-3">
                  <span className="text-label text-text-2">Normal · 100 %</span>
                  <p
                    className="mt-1 text-xl font-extrabold uppercase text-ink"
                    style={{ fontStretch: '100%', fontVariationSettings: "'wdth' 100" }}
                  >
                    DR CHOCO 237
                  </p>
                </div>
                <div className="rounded-[var(--radius-sm)] border border-silver bg-white p-3">
                  <span className="text-label text-text-2">Étendu · 125 %</span>
                  <p
                    className="mt-1 text-xl font-extrabold uppercase text-ink"
                    style={{ fontStretch: '125%', fontVariationSettings: "'wdth' 125" }}
                  >
                    DR CHOCO 237
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. BLOC HÉROS DE TEST (MOTION) */}
        <section aria-labelledby="dev-hero-motion">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-silver pb-3">
            <h2 id="dev-hero-motion" className="text-h2 text-ink">
              3. Bloc Héros de Test · Motion (strict m.*)
            </h2>
            <button
              type="button"
              onClick={() => setHeroReplayKey((k) => k + 1)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] border border-ink bg-white px-4 py-2 text-small font-bold text-ink hover:bg-surface"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Rejouer
            </button>
          </div>

          <div className="mt-5 overflow-hidden rounded-[var(--radius-md)] bg-ink p-6 text-white sm:p-10">
            <p className="text-label text-silver">
              STAGGERCONTAINER + LINEREVEAL + .MASK-LINE + PRESSABLE
            </p>

            <m.div
              key={heroReplayKey}
              variants={staggerContainer(0.08)}
              initial={reducedMotion ? 'visible' : 'hidden'}
              animate="visible"
              className="mt-4 space-y-1"
            >
              {HERO_LINES.map((line) => (
                <span key={line} className="mask-line">
                  <m.span variants={lineReveal} className="block text-display text-white">
                    {line}
                  </m.span>
                </span>
              ))}
            </m.div>

            <p className="mt-5 max-w-xl text-body text-silver">
              Révélation ligne par ligne sans couper les jambages grâce à{' '}
              <code className="font-mono text-white">.mask-line</code>. Le bouton rouge ci-dessous
              utilise le preset <code className="font-mono text-white">pressable</code> (scale 0.97
              en 120 ms).
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <m.button
                type="button"
                {...pressable}
                onClick={() => haptic('light')}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-[var(--radius-md)] bg-red px-6 py-3 text-body font-bold text-white"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Réserver maintenant
              </m.button>

              <button
                type="button"
                onClick={() => setHeroReplayKey((k) => k + 1)}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-[var(--radius-md)] bg-ink-2 px-5 py-3 text-small font-semibold text-silver hover:text-white"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Rejouer l&apos;animation
              </button>
            </div>
          </div>
        </section>

        {/* 4. TEST GSAP (LAZY) */}
        <section aria-labelledby="dev-gsap">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-silver pb-3">
            <h2 id="dev-gsap" className="text-h2 text-ink">
              4. Test GSAP · Isolé du chargement initial
            </h2>
            <span className="text-small text-text-2">
              React.lazy() → chunk dédié gsap.js
            </span>
          </div>

          <div className="mt-5">
            <Suspense
              fallback={
                <div className="rounded-[var(--radius-md)] border border-silver bg-surface p-6 text-small text-text-2">
                  Chargement du module GSAP à la demande…
                </div>
              }
            >
              <LazyGsapSandbox />
            </Suspense>
          </div>
        </section>

        {/* 5. ANIMATIONS RÉDUITES */}
        <section aria-labelledby="dev-reduced-motion">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-silver pb-3">
            <h2 id="dev-reduced-motion" className="text-h2 text-ink">
              5. Préférence « Réduire les animations »
            </h2>
            <span className="text-small text-text-2">prefers-reduced-motion: reduce</span>
          </div>

          <div className="mt-5 rounded-[var(--radius-md)] border border-silver bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-h3 text-ink">
                  Réglage « réduire les animations » :{' '}
                  <span className={reducedMotion ? 'text-warning' : 'text-success'}>
                    {reducedMotion ? 'activé' : 'désactivé'}
                  </span>
                </p>
                <p className="mt-1 text-small text-text-2">
                  {reducedMotion
                    ? 'Toutes les animations Motion et GSAP affichent directement leur état final et les vibrations sont coupées.'
                    : 'Les animations 60 fps (transform & opacity) et le retour haptique sont actifs.'}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-1.5 text-label ${
                  reducedMotion ? 'bg-warning text-white' : 'bg-ink text-white'
                }`}
              >
                {reducedMotion ? 'MODE RÉDUIT ACTIF' : 'MODE STANDARD 60 FPS'}
              </span>
            </div>

            <div className="mt-4 rounded-[var(--radius-sm)] border border-silver bg-white p-3.5 text-small text-text-2">
              <strong className="text-ink">Astuce Chrome DevTools :</strong> ouvrez les Outils de
              développement (<code className="font-mono text-ink">F12</code>) → menu{' '}
              <code className="font-mono text-ink">Rendering</code> →{' '}
              <code className="font-mono text-ink">Emulate CSS media feature prefers-reduced-motion: reduce</code>{' '}
              pour observer le basculement en direct sans recharger la page.
            </div>
          </div>
        </section>

        {/* 6. DONNÉES (MOCKS MSW + TANSTACK QUERY) */}
        <section aria-labelledby="dev-mocks">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-silver pb-3">
            <div>
              <h2 id="dev-mocks" className="text-h2 text-ink">
                6. Données Catalogue · Mocks MSW &amp; TanStack Query
              </h2>
              <p className="text-small text-text-2">
                Appel réel à <code className="font-mono text-ink">GET /products?page=1</code> (latence mobile simulée 300–900 ms)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSimulateApiError(false);
                  void productsQuery.refetch();
                }}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] bg-ink px-4 py-2 text-small font-bold text-white"
              >
                <RefreshCw
                  className={`h-4 w-4 ${productsQuery.isFetching ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                Recharger (200 OK)
              </button>
              <button
                type="button"
                onClick={() => setSimulateApiError((prev) => !prev)}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] border px-4 py-2 text-small font-bold ${
                  simulateApiError
                    ? 'border-danger bg-danger text-white'
                    : 'border-silver bg-white text-ink hover:bg-surface'
                }`}
              >
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                {simulateApiError ? 'Quitter le mode erreur' : 'Tester l’état d’erreur (500)'}
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-[var(--radius-md)] border border-silver bg-surface p-5">
            {productsQuery.isLoading || productsQuery.isFetching ? (
              <div className="space-y-3" aria-live="polite">
                <p className="text-small font-semibold text-ink">
                  Chargement réseau mobile 3G/4G simulé (MSW 300–900 ms)…
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[1, 2, 3, 4].map((skeleton) => (
                    <div
                      key={skeleton}
                      className="h-28 animate-pulse rounded-[var(--radius-md)] bg-silver/50"
                    />
                  ))}
                </div>
              </div>
            ) : productsQuery.isError ? (
              <div
                role="alert"
                className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-danger bg-white p-4 text-ink"
              >
                <div className="flex items-center gap-2 text-danger">
                  <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <p className="text-h3 font-bold">Erreur interceptée par ApiError</p>
                </div>
                <p className="text-small text-text-2">
                  {productsQuery.error instanceof ApiError
                    ? `${productsQuery.error.message} (Code: ${productsQuery.error.code}, HTTP ${productsQuery.error.status})`
                    : 'Erreur inattendue'}
                </p>
              </div>
            ) : productsQuery.data ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-small font-semibold text-ink">
                    Total catalogue :{' '}
                    <span className="font-mono font-bold tabular-nums">
                      {productsQuery.data.total}
                    </span>{' '}
                    produits ({productsQuery.data.items.length} sur la page{' '}
                    {productsQuery.data.page}/{productsQuery.data.totalPages})
                  </p>
                  <span className="text-label text-success">RÉPONSE MSW VALIDÉE ✓</span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {productsQuery.data.items.slice(0, 4).map((product) => (
                    <article
                      key={product.id}
                      className="flex items-center gap-3 rounded-[var(--radius-md)] border border-silver bg-white p-3"
                    >
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="h-16 w-14 shrink-0 rounded-[var(--radius-sm)] bg-surface object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-small font-bold text-ink">{product.name}</p>
                        <p className="mt-0.5 text-small text-price text-ink">
                          {formatPrice(product.price)}
                        </p>
                        <p className="mt-0.5 text-xs text-text-2">
                          {product.variants.reduce((acc, v) => acc + v.stock, 0)} en stock
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* 7. UTILITAIRES */}
        <section aria-labelledby="dev-utils">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-silver pb-3">
            <h2 id="dev-utils" className="text-h2 text-ink">
              7. Utilitaires Métier (FCFA, +237, Compte à rebours, Haptique)
            </h2>
            <span className="text-small text-text-2">src/lib/utils/*</span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[var(--radius-md)] border border-silver bg-surface p-4">
              <p className="text-label text-text-2">formatPrice()</p>
              <p className="mt-2 font-mono text-small text-text-2">45000 →</p>
              <p className="text-h2 text-price text-ink">{formatPrice(45000)}</p>
              <p className="mt-1 font-mono text-small text-text-2">8000 → {formatPrice(8000)}</p>
            </div>

            <div className="rounded-[var(--radius-md)] border border-silver bg-surface p-4">
              <p className="text-label text-text-2">phone.ts (+237)</p>
              <p className="mt-2 font-mono text-small text-ink">
                Normalisé : {normalizeCmPhone('691 23 45 67')}
              </p>
              <p className="mt-1 font-mono text-small text-ink">
                Affiché : {formatCmPhone('+237691234567')}
              </p>
              <p className="mt-1 text-xs text-text-2">
                Valide (&quot;691234567&quot;) : {isValidCmPhone('691234567') ? 'Oui' : 'Non'}
              </p>
            </div>

            <div className="rounded-[var(--radius-md)] border border-silver bg-surface p-4">
              <p className="text-label text-text-2">formatCountdown(ms)</p>
              <p className="mt-2 font-mono text-h2 tabular-nums text-ink">
                {formatCountdown((23 * 60 + 58) * 60_000)}
              </p>
              <p className="mt-1 text-xs text-text-2">
                Blocage du stock pendant 24 h max après réservation
              </p>
            </div>

            <div className="flex flex-col justify-between rounded-[var(--radius-md)] border border-silver bg-surface p-4">
              <div>
                <p className="text-label text-text-2">haptic(&apos;success&apos;)</p>
                <p className="mt-1 text-small text-text-2">
                  Vibration Android respectant prefers-reduced-motion.
                </p>
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleTestHaptic}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-ink px-4 py-2 text-small font-bold text-white"
                >
                  <Smartphone className="h-4 w-4" aria-hidden="true" />
                  Tester la vibration
                </button>
                {hapticTriggered && (
                  <p className="mt-1.5 text-xs text-text-2">{hapticTriggered}</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 8. STATUTS DE RÉSERVATION */}
        <section aria-labelledby="dev-statuses">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-silver pb-3">
            <h2 id="dev-statuses" className="text-h2 text-ink">
              8. Statuts de Réservation (STATUS_META)
            </h2>
            <span className="text-small text-text-2">
              Toujours Couleur + Icône Lucide + Libellé explicite
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(STATUS_META) as ReservationStatusCode[]).map((code) => {
              const meta = STATUS_META[code];
              const IconComponent = meta.Icon;
              const final = isFinalStatus(code);

              return (
                <div
                  key={code}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-silver bg-white p-3.5"
                >
                  <div className="min-w-0">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-2.5 py-1 text-small font-bold ${TONE_STYLES[meta.tone]}`}
                    >
                      <IconComponent className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{meta.label}</span>
                    </span>
                    <p className="mt-1.5 font-mono text-xs text-text-2">{meta.code}</p>
                  </div>
                  <span className="shrink-0 text-label text-text-2">
                    {final ? 'FINAL' : 'ACTIF'}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-[var(--radius-md)] border border-silver bg-surface p-4">
              <p className="text-label text-text-2">TIMELINE_ORDER(&apos;delivery&apos;)</p>
              <p className="mt-1.5 font-mono text-xs text-ink">
                {TIMELINE_ORDER('delivery').join(' → ')}
              </p>
            </div>
            <div className="rounded-[var(--radius-md)] border border-silver bg-surface p-4">
              <p className="text-label text-text-2">TIMELINE_ORDER(&apos;pickup&apos;)</p>
              <p className="mt-1.5 font-mono text-xs text-ink">
                {TIMELINE_ORDER('pickup').join(' → ')}
              </p>
            </div>
          </div>
        </section>

        {/* 8 bis. PHOTO DU COLIS PRÊT */}
        <section aria-labelledby="dev-package-photos">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-silver pb-3">
            <div>
              <h2 id="dev-package-photos" className="text-h2 text-ink">
                8 bis. Photo du Colis Prêt (RES-000102)
              </h2>
              <p className="text-small text-text-2">
                Vérification de <code className="font-mono text-ink">packagePhotos</code>,{' '}
                <code className="font-mono text-ink">packageReadyAt</code> et{' '}
                <code className="font-mono text-ink">hasPackagePhotos()</code>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(['RES-000102', 'RES-000101', 'RES-000103'] as const).map((ref) => (
                <button
                  key={ref}
                  type="button"
                  onClick={() => setSelectedReservationRef(ref)}
                  className={`min-h-[40px] rounded-[var(--radius-sm)] px-3 py-1.5 font-mono text-small font-bold transition-colors ${
                    selectedReservationRef === ref
                      ? 'bg-ink text-white'
                      : 'border border-silver bg-white text-ink hover:bg-surface'
                  }`}
                >
                  {ref}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-[var(--radius-md)] border border-silver bg-surface p-5">
            {reservationQuery.isLoading ? (
              <p className="text-small text-text-2">
                Chargement de la réservation {selectedReservationRef}…
              </p>
            ) : reservationQuery.data ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-ink" aria-hidden="true" />
                    <span className="font-mono text-h3 font-bold text-ink">
                      {reservationQuery.data.ref}
                    </span>
                    <span className="text-small text-text-2">·</span>
                    <span className="text-small font-semibold text-ink">
                      {STATUS_META[reservationQuery.data.status].label}
                    </span>
                  </div>

                  <div className="text-small text-text-2">
                    {reservationQuery.data.packageReadyAt ? (
                      <span>
                        Colis prêt le :{' '}
                        <strong className="text-ink">
                          {formatDate(reservationQuery.data.packageReadyAt)}
                        </strong>
                      </span>
                    ) : (
                      <span>Colis pas encore emballé (packageReadyAt: null)</span>
                    )}
                  </div>
                </div>

                {reservationQuery.data.rejectionReason && (
                  <p className="mt-3 rounded-[var(--radius-sm)] border border-danger bg-white p-3 text-small text-danger">
                    Motif de rejet : {reservationQuery.data.rejectionReason}
                  </p>
                )}

                {hasPackagePhotos(reservationQuery.data) ? (
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {reservationQuery.data.packagePhotos.map((photo) => (
                      <figure
                        key={photo.id}
                        className="overflow-hidden rounded-[var(--radius-md)] border border-silver bg-white p-3"
                      >
                        <img
                          src={photo.url}
                          alt={`Colis ${reservationQuery.data.ref} (${photo.id})`}
                          width={photo.width}
                          height={photo.height}
                          className="aspect-[4/3] w-full rounded-[var(--radius-sm)] bg-surface object-cover"
                        />
                        <figcaption className="mt-2 flex items-center justify-between text-xs text-text-2">
                          <span className="font-mono font-semibold text-ink">{photo.id}</span>
                          <span>Prise le {formatDate(photo.takenAt)}</span>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-[var(--radius-sm)] border border-silver bg-white p-4 text-small text-text-2">
                    Aucune photo de colis sur {reservationQuery.data.ref} (
                    <code className="font-mono text-ink">hasPackagePhotos === false</code>).
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </section>

        {/* 9. ENVIRONNEMENT */}
        <section aria-labelledby="dev-env">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-silver pb-3">
            <h2 id="dev-env" className="text-h2 text-ink">
              9. Environnement &amp; Configuration (`src/lib/env.ts`)
            </h2>
            <span className="inline-flex items-center gap-1 text-small font-semibold text-success">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Variables validées au démarrage
            </span>
          </div>

          <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-[var(--radius-md)] border border-silver bg-surface p-4">
              <dt className="text-label text-text-2">NOM DE L&apos;APPLICATION</dt>
              <dd className="mt-1 font-mono text-small font-bold text-ink">{env.appName}</dd>
            </div>
            <div className="rounded-[var(--radius-md)] border border-silver bg-surface p-4">
              <dt className="text-label text-text-2">VERSION DU SOCLE</dt>
              <dd className="mt-1 font-mono text-small font-bold text-ink">{env.appVersion}</dd>
            </div>
            <div className="rounded-[var(--radius-md)] border border-silver bg-surface p-4">
              <dt className="text-label text-text-2">MODE MOCKS MSW (VITE_API_MOCK)</dt>
              <dd className="mt-1 font-mono text-small font-bold text-success">
                {env.apiMock ? 'Activé (true)' : 'Désactivé (false)'}
              </dd>
            </div>
            <div className="rounded-[var(--radius-md)] border border-silver bg-surface p-4">
              <dt className="text-label text-text-2">VITE_API_BASE_URL</dt>
              <dd className="mt-1 truncate font-mono text-small text-ink">{env.apiBaseUrl}</dd>
            </div>
            <div className="rounded-[var(--radius-md)] border border-silver bg-surface p-4">
              <dt className="text-label text-text-2">VITE_CLOUDINARY_CLOUD_NAME</dt>
              <dd className="mt-1 font-mono text-small text-ink">{env.cloudinaryCloudName}</dd>
            </div>
            <div className="rounded-[var(--radius-md)] border border-silver bg-surface p-4">
              <dt className="text-label text-text-2">VITE_SHOP_WHATSAPP</dt>
              <dd className="mt-1 font-mono text-small text-ink">
                {formatCmPhone(env.shopWhatsapp)}
              </dd>
            </div>
          </dl>
        </section>

        {/* 9 bis. SIMULATEUR BOUTIQUE (M4) */}
        <section aria-labelledby="dev-shop-simulator">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-silver pb-3">
            <div>
              <h2 id="dev-shop-simulator" className="text-h2 text-ink">
                Simulateur boutique (Module M4 · Paiement &amp; Preuve)
              </h2>
              <p className="text-small text-text-2">
                Permet de tester la validation, le rejet ou l&apos;expiration d&apos;une réservation
                sans attendre un administrateur.
              </p>
            </div>
            <span className="text-label text-ink">ROUTES /_mock/reservations/:ref/*</span>
          </div>

          <div className="mt-5 space-y-5 rounded-[var(--radius-md)] border border-silver bg-surface p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label
                  htmlFor="simulator-ref-input"
                  className="block text-label text-text-2"
                >
                  RÉFÉRENCE DE LA RÉSERVATION
                </label>
                <input
                  id="simulator-ref-input"
                  type="text"
                  value={simulatorRef}
                  onChange={(e) => setSimulatorRef(e.target.value)}
                  placeholder="RES-000124"
                  className="mt-1.5 min-h-[44px] w-full rounded-[var(--radius-md)] border border-silver bg-white px-3.5 font-mono text-body font-bold uppercase text-ink focus:border-ink focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/reservation/${simulatorRef.trim().toUpperCase() || 'RES-000101'}/paiement`}
                  className="inline-flex min-h-[44px] items-center rounded-[var(--radius-md)] border border-silver bg-white px-3.5 text-small font-bold text-ink hover:bg-surface"
                >
                  Écran Paiement
                </Link>
                <Link
                  to={`/reservation/${simulatorRef.trim().toUpperCase() || 'RES-000101'}/preuve`}
                  className="inline-flex min-h-[44px] items-center rounded-[var(--radius-md)] border border-silver bg-white px-3.5 text-small font-bold text-ink hover:bg-surface"
                >
                  Écran Preuve
                </Link>
                <Link
                  to={`/reservation/${simulatorRef.trim().toUpperCase() || 'RES-000101'}/merci`}
                  className="inline-flex min-h-[44px] items-center rounded-[var(--radius-md)] border border-silver bg-white px-3.5 text-small font-bold text-ink hover:bg-surface"
                >
                  Écran Merci
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <button
                type="button"
                disabled={simulatorBusy}
                onClick={() =>
                  void runShopSimulation('Validation', () =>
                    api.post<ReservationDetailResponse>(
                      endpoints.mock.validateReservation(simulatorRef.trim().toUpperCase()),
                    ),
                  )
                }
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--radius-md)] bg-success px-4 py-2.5 text-small font-bold text-white transition-opacity disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                Valider le paiement
              </button>

              <button
                type="button"
                disabled={simulatorBusy}
                onClick={() =>
                  void runShopSimulation('Rejet (capture illisible)', () =>
                    api.post<ReservationDetailResponse>(
                      endpoints.mock.rejectReservation(simulatorRef.trim().toUpperCase()),
                      { reason: 'Capture illisible' },
                    ),
                  )
                }
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--radius-md)] bg-danger px-4 py-2.5 text-small font-bold text-white transition-opacity disabled:opacity-50"
              >
                <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                Rejeter (capture illisible)
              </button>

              <button
                type="button"
                disabled={simulatorBusy}
                onClick={() =>
                  void runShopSimulation('Rejet (montant incorrect)', () =>
                    api.post<ReservationDetailResponse>(
                      endpoints.mock.rejectReservation(simulatorRef.trim().toUpperCase()),
                      { reason: 'Montant reçu différent de 63 000 FCFA' },
                    ),
                  )
                }
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--radius-md)] border border-danger bg-white px-4 py-2.5 text-small font-bold text-danger transition-opacity disabled:opacity-50"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                Rejeter (montant incorrect)
              </button>

              <button
                type="button"
                disabled={simulatorBusy}
                onClick={() =>
                  void runShopSimulation('Expire dans 2 min', () =>
                    api.post<ReservationDetailResponse>(
                      endpoints.mock.expireSoonReservation(simulatorRef.trim().toUpperCase()),
                    ),
                  )
                }
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--radius-md)] bg-warning px-4 py-2.5 text-small font-bold text-white transition-opacity disabled:opacity-50"
              >
                <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                Expire dans 2 min
              </button>

              <button
                type="button"
                disabled={simulatorBusy}
                onClick={() =>
                  void runShopSimulation('Expiration immédiate', () =>
                    api.post<ReservationDetailResponse>(
                      endpoints.mock.expireReservation(simulatorRef.trim().toUpperCase()),
                    ),
                  )
                }
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--radius-md)] bg-ink px-4 py-2.5 text-small font-bold text-white transition-opacity disabled:opacity-50"
              >
                <TimerOff className="h-4 w-4 shrink-0" aria-hidden="true" />
                Faire expirer
              </button>
            </div>

            {simulatorFeedback ? (
              <div
                role="status"
                aria-live="polite"
                className="rounded-[var(--radius-sm)] border border-silver bg-white px-4 py-3 font-mono text-small text-ink"
              >
                {simulatorFeedback}
              </div>
            ) : null}
          </div>
        </section>

        {/* 9 ter. SIMULATEUR BOUTIQUE ENRICHI (M5) */}
        <ShopSimulatorM5 />

        {/* 10. KIT VISUEL M1 */}
        <M1KitShowcase />
      </main>
    </div>
  );
}

