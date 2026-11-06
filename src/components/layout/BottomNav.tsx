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
import { duration, ease, spring } from '@/motion/tokens';
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
    if (tab.exact) return location.pathname === tab.to;
    if (tab.matchExact?.includes(location.pathname)) return true;
    if (tab.matchPrefixes) {
      return tab.matchPrefixes.some((prefix) => location.pathname.startsWith(prefix));
    }
    return location.pathname.startsWith(tab.to);
  };

  return (
    <nav
      aria-label="Navigation principale mobile"
      // Verre à 96 % : les libellés gardent un contraste suffisant même posés sur le pied de page sombre
      className="bottom-nav fixed right-0 bottom-0 left-0 z-nav border-t border-silver/50 bg-white/96 pb-safe shadow-[var(--shadow-nav)] backdrop-blur-md lg:hidden"
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
                  'relative flex w-full min-w-0 flex-col items-center justify-center gap-1 pt-1 transition-colors duration-fast',
                  // Onglet actif : icône et repère rouges, libellé ink (le rouge en 12 px manque de contraste)
                  active ? 'text-red' : 'text-text-2 hover:text-ink',
                )}
              >
                {active && (
                  <m.span
                    layoutId="bottom-nav-indicator"
                    transition={spring.snappy}
                    className="absolute top-0 h-[3px] w-6 rounded-b-[var(--radius-sm)] bg-red"
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
                  transition={{ duration: duration.base, ease: ease.out }}
                  className="relative flex h-6 w-6 items-center justify-center"
                >
                  <Icon className="h-6 w-6" aria-hidden="true" />

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
                          className="absolute -top-2 -right-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-red px-1 text-caption leading-none font-bold tabular-nums text-white"
                        >
                          {cartCount > 99 ? '99+' : cartCount}
                        </m.span>
                      )}
                    </AnimatePresence>
                  )}
                </m.span>

                {/* 12 px (text-caption). Exception mesurée : sous 380 px, un onglet fait 72 px et
                    « Réservations » en 12 px demi-gras en demande 76 : 11 px pour ne jamais le couper */}
                <span
                  className={cn(
                    'max-w-full truncate px-0.5 text-caption leading-none font-semibold max-[379px]:text-[11px]',
                    active && 'text-ink',
                  )}
                >
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
