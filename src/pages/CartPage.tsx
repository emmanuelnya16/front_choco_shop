import { AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  Camera,
  Clock,
  Loader2,
  Smartphone,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Primitives';
import { ProductCard } from '@/components/ui/ProductCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useRequireAuth } from '@/features/auth/api/useAuthQueries';
import { useValidateCart } from '@/features/cart/api/useCartQueries';
import { AnimatedPriceCounter } from '@/features/cart/components/AnimatedPriceCounter';
import { CartItemRow } from '@/features/cart/components/CartItemRow';
import { EmptyCartState } from '@/features/cart/components/EmptyCartState';
import { useProducts } from '@/features/catalog/api/useCatalogQueries';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import {
  selectCartCount,
  selectCartSubtotal,
  selectHasUnavailableItems,
  useCartStore,
} from '@/stores/cartStore';
import { useToastStore } from '@/stores/toastStore';
import type { CartItem } from '@/types/domain';

const TWO_MINUTES_MS = 2 * 60 * 1000;

/**
 * Page `/panier` complète (§4.1 à §4.4) :
 * - Mobile : lignes glissables, bloc « Vos avantages », récapitulatif avec compteurs animés,
 *   carrousel « Vous aimerez aussi » (6 articles), et barre d'action collée en bas.
 * - Ordinateur : 2 colonnes (lignes 64 % à gauche, récapitulatif collant 36 % à droite).
 * - Vérification automatique du stock et des prix à l'ouverture (> 2 min) et au clic sur « Réserver ».
 */
export function CartPage() {
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const requireAuth = useRequireAuth();

  const items = useCartStore((s) => s.items);
  const validationMap = useCartStore((s) => s.validationMap);
  const lastValidatedAt = useCartStore((s) => s.lastValidatedAt);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const remove = useCartStore((s) => s.remove);
  const restore = useCartStore((s) => s.restore);
  const count = useCartStore(selectCartCount);
  const subtotal = useCartStore(selectCartSubtotal);
  const hasUnavailable = useCartStore(selectHasUnavailableItems);

  const showToast = useToastStore((s) => s.show);
  const validateCart = useValidateCart();
  const mutateValidateCart = validateCart.mutate;

  useEffect(() => {
    document.title = "Panier · DR Choco L'Incompris";
  }, []);

  // Déclenche la vérification du stock à l'ouverture si > 2 min (§4.4)
  useEffect(() => {
    if (items.length === 0 || !isOnline) return;
    const now = Date.now();
    if (!lastValidatedAt || now - lastValidatedAt > TWO_MINUTES_MS) {
      mutateValidateCart({ timeoutMs: 2500 });
    }
  }, [items.length, isOnline, lastValidatedAt, mutateValidateCart]);

  // Nombre d'articles ayant changé (reduced, unavailable, price_changed)
  const changedItemsCount = useMemo(() => {
    return items.filter((item) => {
      const v = validationMap[item.variantId];
      return v && v.status !== 'ok';
    }).length;
  }, [items, validationMap]);

  // Catégorie dominante pour « Vous aimerez aussi » (§4.1.7)
  const { data: catalogData } = useProducts({
    available: true,
    sort: 'popular',
    page: 1,
    pageSize: 24,
  });

  const recommendedProducts = useMemo(() => {
    const allProducts = catalogData?.items ?? [];
    if (allProducts.length === 0 || items.length === 0) return [];

    const cartProductIds = new Set(items.map((i) => i.productId));
    const categoryCounts = new Map<string, number>();

    for (const item of items) {
      const prod = allProducts.find((p) => p.id === item.productId);
      const cat = prod?.categorySlug ?? 'vetements';
      categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + item.quantity);
    }

    let dominantCategory = 'vetements';
    let maxCount = -1;
    for (const [cat, c] of categoryCounts.entries()) {
      if (c > maxCount) {
        maxCount = c;
        dominantCategory = cat;
      }
    }

    const inDominant = allProducts.filter(
      (p) => p.categorySlug === dominantCategory && !cartProductIds.has(p.id),
    );
    const others = allProducts.filter(
      (p) => p.categorySlug !== dominantCategory && !cartProductIds.has(p.id),
    );

    return [...inDominant, ...others].slice(0, 6);
  }, [catalogData?.items, items]);

  const handleRemoveItem = (item: CartItem) => {
    const index = items.findIndex((i) => i.variantId === item.variantId);
    remove(item.variantId);
    showToast({
      message: 'Article retiré',
      subtitle: `${item.name} · ${item.color.name} (${item.size})`,
      actionLabel: 'Annuler',
      durationMs: 5000,
      onAction: () => {
        restore(item, index);
      },
    });
  };

  const handleReserve = async () => {
    if (!isOnline || hasUnavailable || items.length === 0) return;

    try {
      const result = await validateCart.mutateAsync({ timeoutMs: 2000 });
      const newlyUnavailable = result.items.some(
        (v) => v.status === 'unavailable' || v.availableQuantity <= 0,
      );
      if (newlyUnavailable) {
        return;
      }
    } catch {
      // Si le réseau ne répond pas dans les 2 s, on continue vers la réservation (§4.4)
    }

    requireAuth(() => {
      navigate('/reservation', { viewTransition: true });
    });
  };

  if (items.length === 0) {
    return (
      <Container>
        <EmptyCartState />
      </Container>
    );
  }

  return (
    <div className="pb-28 lg:pb-16">
      <Container className="py-6 lg:py-10">
        {/* 1. Titre + nombre d'articles (§4.1) */}
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-silver/70 pb-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-h1 text-ink">MON PANIER</h1>
            <span className="text-body font-semibold text-text-2">
              {count} article{count > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* 2. Bandeau de vérification (§4.4) */}
        {changedItemsCount > 0 && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-3 rounded-[var(--radius-md)] border border-warning bg-surface p-4 text-ink"
          >
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-warning"
              aria-hidden="true"
            />
            <div className="text-small">
              <p className="font-bold">
                {changedItemsCount === 1
                  ? '1 article de votre panier a changé. Vérifiez avant de réserver.'
                  : `${changedItemsCount} articles de votre panier ont changé. Vérifiez avant de réserver.`}
              </p>
              {hasUnavailable && (
                <p className="mt-1 font-semibold text-danger">
                  Retirez les articles épuisés pour continuer.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Mise en page 2 colonnes dès la tablette (64 % / 36 %, §4.3) : pas de colonne unique étirée à 768-1023 px */}
        <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-12 md:items-start md:gap-6 lg:gap-8">
          {/* Colonne gauche (64 % -> 8/12 ou 7/12) : Lignes d'articles */}
          <div className="space-y-4 md:col-span-7 xl:col-span-8">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <CartItemRow
                  key={item.variantId}
                  item={item}
                  validation={validationMap[item.variantId]}
                  onQuantityChange={setQuantity}
                  onRemove={handleRemoveItem}
                />
              ))}
            </AnimatePresence>

            {/* Bloc « Vos avantages » sur mobile (§4.1.5) */}
            <div className="rounded-[var(--radius-md)] bg-surface p-4 lg:hidden">
              <ul className="space-y-2.5 text-small text-ink">
                <li className="flex items-center gap-3">
                  <Clock
                    className="h-4 w-4 shrink-0 text-red"
                    aria-hidden="true"
                  />
                  <span>Mis de côté 24 h dès la réservation</span>
                </li>
                <li className="flex items-center gap-3">
                  <Smartphone
                    className="h-4 w-4 shrink-0 text-ink"
                    aria-hidden="true"
                  />
                  <span>Paiement Orange Money ou MTN MoMo</span>
                </li>
                <li className="flex items-center gap-3">
                  <Camera
                    className="h-4 w-4 shrink-0 text-ink"
                    aria-hidden="true"
                  />
                  <span>Photo de votre colis avant l&rsquo;envoi</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Colonne droite collante sur ordinateur (36 % -> 5/12 ou 4/12, §4.3) */}
          <aside className="space-y-4 md:col-span-5 lg:sticky lg:top-24 xl:col-span-4">
            <div className="rounded-[var(--radius-md)] border border-silver/70 bg-white p-5 sm:p-6">
              <h2 className="text-h3 text-ink">RÉCAPITULATIF</h2>

              <dl className="mt-4 space-y-3 border-b border-silver/60 pb-4 text-small">
                <div className="flex items-center justify-between">
                  <dt className="text-text-2">Sous-total</dt>
                  <dd className="text-ink">
                    <AnimatedPriceCounter amount={subtotal} />
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-text-2">Livraison</dt>
                  <dd className="text-text-2">
                    Calculée à l&rsquo;étape suivante
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-body font-bold text-ink">Total</span>
                <AnimatedPriceCounter
                  amount={subtotal}
                  className="text-price text-ink"
                />
              </div>

              {hasUnavailable && (
                <p role="alert" className="mt-3 text-xs font-bold text-danger">
                  Retirez les articles épuisés pour continuer.
                </p>
              )}

              {!isOnline && (
                <p role="alert" className="mt-3 text-xs font-bold text-warning">
                  Vous êtes hors connexion. Reconnectez-vous pour réserver.
                </p>
              )}

              {/* Bouton Réserver sur ordinateur */}
              <div className="mt-5 hidden lg:block">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={
                    !isOnline || hasUnavailable || validateCart.isPending
                  }
                  onClick={handleReserve}
                >
                  {validateCart.isPending ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      <span>Vérification…</span>
                    </span>
                  ) : (
                    'Réserver'
                  )}
                </Button>
              </div>
            </div>

            {/* Bloc « Vos avantages » sous le récapitulatif sur ordinateur (§4.3) */}
            <div className="hidden rounded-[var(--radius-md)] bg-surface p-5 lg:block">
              <ul className="space-y-3 text-small text-ink">
                <li className="flex items-center gap-3">
                  <Clock
                    className="h-4 w-4 shrink-0 text-red"
                    aria-hidden="true"
                  />
                  <span>Mis de côté 24 h dès la réservation</span>
                </li>
                <li className="flex items-center gap-3">
                  <Smartphone
                    className="h-4 w-4 shrink-0 text-ink"
                    aria-hidden="true"
                  />
                  <span>Paiement Orange Money ou MTN MoMo</span>
                </li>
                <li className="flex items-center gap-3">
                  <Camera
                    className="h-4 w-4 shrink-0 text-ink"
                    aria-hidden="true"
                  />
                  <span>Photo de votre colis avant l&rsquo;envoi</span>
                </li>
              </ul>
            </div>
          </aside>
        </div>

        {/* 7. Carrousel « Vous aimerez aussi » (6 ProductCard, §4.1.7) */}
        {recommendedProducts.length > 0 && (
          <section
            aria-labelledby="cart-upsell-heading"
            className="mt-14 border-t border-silver/60 pt-10"
          >
            <SectionHeader
              eyebrow="COMPLÉTEZ VOTRE TENUE"
              title="VOUS AIMEREZ AUSSI"
              actionLabel="Voir le catalogue"
              actionHref="/explorer"
            />
            <div className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 lg:grid lg:grid-cols-6 lg:overflow-visible lg:pb-0">
              {recommendedProducts.map((product) => (
                <div
                  key={product.id}
                  className="w-[210px] shrink-0 snap-start lg:w-auto"
                >
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </section>
        )}
      </Container>

      {/* Barre d'action collée en bas sur mobile (à la place de la barre de navigation, §4.1) */}
      <div className="fixed right-0 bottom-0 left-0 z-40 border-t border-silver/70 bg-white px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-[var(--shadow-nav)] lg:hidden">
        {hasUnavailable && (
          <p role="alert" className="mb-2 text-xs font-bold text-danger">
            Retirez les articles épuisés pour continuer.
          </p>
        )}
        {!isOnline && (
          <p role="alert" className="mb-2 text-xs font-bold text-warning">
            Vous êtes hors connexion. Reconnectez-vous pour réserver.
          </p>
        )}
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-text-2">
              Total
            </span>
            <AnimatedPriceCounter
              amount={subtotal}
              className="text-price text-ink"
            />
          </div>
          <Button
            variant="primary"
            size="lg"
            disabled={!isOnline || hasUnavailable || validateCart.isPending}
            onClick={handleReserve}
            className="min-w-[180px]"
          >
            {validateCart.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                <span>Vérification…</span>
              </span>
            ) : (
              'Réserver'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
