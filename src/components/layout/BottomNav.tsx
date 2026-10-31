import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import {
  Home,
  LayoutGrid,
  ReceiptText,
  ShoppingBag,
  User,
} from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useBottomInsets } from '@/components/layout/bottomInsets';
import { isBottomNavHidden } from '@/components/layout/bottomNavVisibility';
import { AttentionDot } from '@/features/tracking/components/AttentionDot';
import { useReservationsAttention } from '@/features/tracking/useReservationsAttention';
import { cn } from '@/lib/utils/cn';
import { ease, spring } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { selectCartCount, useCartStore } from '@/stores/cartStore';
import { useUiStore } from '@/stores/uiStore';

const NAV_TABS = [
  { id: 'accueil', label: 'Accueil', to: '/', icon: Home, exact: true },
  {
    id: 'explorer',
    label: 'Explorer',
    to: '/explorer',
    icon: LayoutGrid,
    matchPrefixes: ['/explorer', '/categorie', '/produit', '/recherche'],
  },
  {
    id: 'panier',
    label: 'Panier',
    to: '/panier',
    icon: ShoppingBag,
    showCartBadge: true,
    // Parcours de réservation (`/reservation`, `/reservation/:ref/*`), mais pas « Mes réservations »
    matchPrefixes: ['/panier', '/reservation/'],
    matchExact: ['/reservation'],
  },
  {
    id: 'reservations',
    label: 'Réservations',
    to: '/reservations',
    icon: ReceiptText,
    matchPrefixes: ['/reservations'],
  },
  {
    id: 'profil',
    label: 'Profil',
    to: '/profil',
    icon: User,
    matchPrefixes: ['/profil', '/favoris'],
  },
];

export function BottomNav() {
  const location = useLocation();
  const cartCount = useCartStore(selectCartCount);
  const cartBounceTick = useUiStore((s) => s.cartBounceTick);
  const reducedMotion = useReducedMotionPref();
  const { needsAttention } = useReservationsAttention();
  // Hauteurs variables de la pile du bas de l'écran (barres d'action des pages, bandeau de mise à jour)
  useBottomInsets();

  // Masqué sur la fiche produit, le parcours de réservation/paiement/preuve et le panier non vide pour laisser place à la barre d'action collante
  // `/reservation` et `/reservation/:ref/*` seulement : « Mes réservations » (`/reservations`) garde la barre (M5).
  if (isBottomNavHidden(location.pathname, cartCount)) {
    return null;
  }

  const isTabActive = (tab: (typeof NAV_TABS)[number]) => {
    if (tab.exact) return location.pathname === location.pathname && location.pathname === tab.to;
    if (tab.matchExact?.includes(location.pathname)) return true;
    if (tab.matchPrefixes) {
      return tab.matchPrefixes.some((prefix) => location.pathname.startsWith(prefix));
    }
    return location.pathname.startsWith(tab.to);
  };

  return (
    <nav
      aria-label="Navigation principale mobile"
      className="bottom-nav fixed right-0 bottom-0 left-0 z-40 border-t border-silver/50 bg-[var(--color-nav-glass)] pb-safe shadow-[var(--shadow-nav)] backdrop-blur-md lg:hidden"
    >
      <ul className="grid h-[var(--bottom-nav-h)] grid-cols-5 items-stretch">
        {NAV_TABS.map((tab) => {
          const active = isTabActive(tab);
          const Icon = tab.icon;

          return (
            <li key={tab.id} className="flex">
              <Link
                to={tab.to}
                viewTransition
                aria-current={active ? 'page' : undefined}
                data-cart-target={tab.showCartBadge ? 'mobile' : undefined}
                className={cn(
                  'relative flex w-full flex-col items-center justify-center gap-1 pt-1 transition-colors',
                  active ? 'text-red' : 'text-text-2 hover:text-ink',
                )}
              >
                {active && (
                  <m.span
                    layoutId="bottom-nav-indicator"
                    transition={spring.snappy}
                    className="absolute top-0 h-[3px] w-5 rounded-b-[var(--radius-sm)] bg-red"
                  />
                )}

                <m.span
                  key={
                    tab.showCartBadge
                      ? `bnav-cart-${cartBounceTick}`
                      : tab.id
                  }
                  initial={
                    tab.showCartBadge && cartBounceTick > 0 && !reducedMotion
                      ? { scale: 1 }
                      : false
                  }
                  animate={
                    tab.showCartBadge && cartBounceTick > 0 && !reducedMotion
                      ? { scale: [1, 1.25, 1] }
                      : { scale: 1 }
                  }
                  whileTap={reducedMotion ? undefined : { scale: 0.9 }}
                  transition={{ duration: 0.35, ease: ease.out }}
                  className="relative flex h-6 w-6 items-center justify-center"
                >
                  <Icon className="h-[22px] w-[22px]" aria-hidden="true" />

                  {tab.id === 'reservations' && (
                    <AttentionDot show={needsAttention} className="-top-0.5 -right-1" />
                  )}

                  {tab.showCartBadge && (
                    <AnimatePresence mode="popLayout">
                      {cartCount > 0 && (
                        <m.span
                          key={cartCount}
                          initial={reducedMotion ? false : { scale: 0.4, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.4, opacity: 0 }}
                          transition={spring.bounce}
                          className="absolute -top-1.5 -right-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red px-1 font-mono text-[11px] font-bold leading-none text-white"
                        >
                          {cartCount > 99 ? '99+' : cartCount}
                        </m.span>
                      )}
                    </AnimatePresence>
                  )}
                </m.span>

                <span className="text-[11px] font-semibold leading-none">
                  {tab.label}
                  {tab.id === 'reservations' && needsAttention && (
                    <span className="sr-only"> : une réservation demande votre attention</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
