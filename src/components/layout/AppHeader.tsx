import { useMotionValueEvent, useScroll } from 'motion/react';
import * as m from 'motion/react-m';
import {
  ChevronDown,
  Heart,
  LayoutGrid,
  Search,
  ShoppingBag,
  User,
} from 'lucide-react';
import { type FormEvent, lazy, type MouseEvent, Suspense, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Logo } from '@/components/ui/Logo';
import { Container } from '@/components/ui/Primitives';
import { addRecentSearch } from '@/features/catalog/search/recentSearches';
import { AttentionDot } from '@/features/tracking/components/AttentionDot';
import { useReservationsAttention } from '@/features/tracking/useReservationsAttention';
import { cn } from '@/lib/utils/cn';
import { duration, ease, spring } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { selectCartCount, useCartStore } from '@/stores/cartStore';
import { useAuthStore } from '@/stores/authStore';
import { selectFavoritesCount, useFavoritesStore } from '@/stores/favoritesStore';
import { useUiStore } from '@/stores/uiStore';

// Méga-menu et suggestions de recherche (ordinateur) : chargés à la première ouverture, hors du
// JavaScript de démarrage
const LazyMegaMenu = lazy(() =>
  import('@/components/layout/MegaMenu').then((m) => ({
    default: m.MegaMenu,
  })),
);

const LazyDesktopSearchDropdown = lazy(() =>
  import('@/features/catalog/search/DesktopSearchDropdown').then((m) => ({
    default: m.DesktopSearchDropdown,
  })),
);

const DESKTOP_LINKS = [
  { label: 'Accueil', to: '/', matchExact: true },
  { label: 'Vêtements', to: '/explorer/vetements' },
  { label: 'Chaussures', to: '/explorer/chaussures' },
  { label: 'Babouches', to: '/explorer/babouches' },
  { label: 'Comment réserver', to: '/#comment-reserver', isAnchor: true },
];

export function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotionPref();

  const cartCount = useCartStore(selectCartCount);
  const favoritesCount = useFavoritesStore(selectFavoritesCount);
  const { needsAttention: reservationsAttention } = useReservationsAttention();
  const authUser = useAuthStore((s) => s.user);
  const authStatus = useAuthStore((s) => s.status);
  const cartBounceTick = useUiStore((s) => s.cartBounceTick);
  const setSearchOrigin = useUiStore((s) => s.setSearchOrigin);
  const openCartDrawer = useUiStore((s) => s.openCartDrawer);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchDropdownOpenPath, setSearchDropdownOpenPath] = useState<string | null>(
    null,
  );
  const isSearchDropdownOpen = searchDropdownOpenPath === location.pathname;
  // Reste monté après la première ouverture (animation de fermeture)
  const [searchDropdownMounted, setSearchDropdownMounted] = useState(false);
  if (isSearchDropdownOpen && !searchDropdownMounted) setSearchDropdownMounted(true);

  const [megaMenuOpenPath, setMegaMenuOpenPath] = useState<string | null>(null);
  const isMegaMenuOpen = megaMenuOpenPath === location.pathname;
  // Reste monté après la première ouverture (animation de fermeture)
  const [megaMenuMounted, setMegaMenuMounted] = useState(false);
  if (isMegaMenuOpen && !megaMenuMounted) setMegaMenuMounted(true);

  const [isPast40, setIsPast40] = useState(false);
  const [isPast80, setIsPast80] = useState(false);
  const [isMobileHidden, setIsMobileHidden] = useState(false);

  const lastScrollY = useRef(0);
  const megaTriggerRef = useRef<HTMLButtonElement>(null);

  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const previous = lastScrollY.current;
    const delta = latest - previous;
    lastScrollY.current = latest;

    setIsPast40(latest > 40);
    setIsPast80(latest > 80);

    if (latest <= 40) {
      setIsMobileHidden(false);
    } else if (delta > 8) {
      setIsMobileHidden(true);
    } else if (delta < -4) {
      setIsMobileHidden(false);
    }
  });

  const isHomePage = location.pathname === '/';
  const isProductDetailPage = location.pathname.startsWith('/produit/');
  const isSearchPage = location.pathname.startsWith('/recherche');
  const isMobileTransparent = isHomePage && !isPast40;

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    setSearchDropdownOpenPath(null);
    if (trimmed) {
      addRecentSearch(trimmed);
      navigate(`/explorer?q=${encodeURIComponent(trimmed)}`, {
        viewTransition: true,
      });
    } else {
      navigate('/recherche', { viewTransition: true });
    }
  };

  const handleMobileSearchClick = (e: MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSearchOrigin({
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2),
    });
  };

  const handleHowItWorksClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (location.pathname === '/') {
      e.preventDefault();
      const target = document.getElementById('comment-reserver');
      if (target) {
        target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
      }
    }
  };

  const isLinkActive = (to: string, matchExact?: boolean, isAnchor?: boolean) => {
    if (isAnchor) return false;
    if (matchExact) return location.pathname === to;
    return location.pathname.startsWith(to);
  };

  return (
    <>
      {/* Desktop Header (lg and above) */}
      <header className="site-header sticky top-0 z-40 hidden bg-white lg:block">
        {/* Row 1: 72px */}
        <div
          className={cn(
            'relative z-20 h-[72px] bg-white transition-shadow duration-250',
            isPast80 && !isMegaMenuOpen && 'shadow-[var(--shadow-header)]',
          )}
        >
          <Container className="flex h-full items-center justify-between gap-6">
            <Logo variant="dark" size="md" />

            <div className="relative w-[360px]">
              <form
                onSubmit={handleSearchSubmit}
                role="search"
                className="relative w-full"
              >
                <Search
                  className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-text-2"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  role="combobox"
                  aria-expanded={isSearchDropdownOpen}
                  aria-controls="desktop-search-dropdown"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchDropdownOpenPath(location.pathname);
                  }}
                  onFocus={() => {
                    if (isMegaMenuOpen) setMegaMenuOpenPath(null);
                    setSearchDropdownOpenPath(location.pathname);
                  }}
                  placeholder="Rechercher un t-shirt, une babouche…"
                  aria-label="Rechercher un article"
                  className="h-10 w-full rounded-[var(--radius-md)] border border-transparent bg-surface pr-4 pl-10 text-small text-ink placeholder:text-text-2 transition-colors focus:border-ink focus:bg-white focus:outline-none"
                />
              </form>

              {searchDropdownMounted && (
                <Suspense fallback={null}>
                  <LazyDesktopSearchDropdown
                    query={searchQuery}
                    onQueryChange={setSearchQuery}
                    open={isSearchDropdownOpen}
                    onClose={() => setSearchDropdownOpenPath(null)}
                  />
                </Suspense>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <IconButton
                icon={<Heart className="h-5 w-5" aria-hidden="true" />}
                label="Mes favoris"
                badge={favoritesCount}
                href="/favoris"
              />
              <m.div
                key={`desktop-cart-${cartBounceTick}`}
                data-cart-target="desktop"
                initial={cartBounceTick > 0 && !reducedMotion ? { scale: 1 } : false}
                animate={
                  cartBounceTick > 0 && !reducedMotion
                    ? { scale: [1, 1.25, 1] }
                    : { scale: 1 }
                }
                transition={{ duration: 0.35, ease: ease.out }}
              >
                <IconButton
                  icon={<ShoppingBag className="h-5 w-5" aria-hidden="true" />}
                  label="Mon panier"
                  badge={cartCount}
                  onClick={() => openCartDrawer(false)}
                />
              </m.div>
              <IconButton
                icon={
                  authStatus === 'authenticated' && authUser ? (
                    <span
                      data-testid="header-user-initial"
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-caption font-bold text-white"
                    >
                      {(authUser.firstName?.trim()?.[0] || 'C').toUpperCase()}
                    </span>
                  ) : (
                    <User className="h-5 w-5" aria-hidden="true" />
                  )
                }
                label="Mon compte"
                href="/profil"
              />
            </div>
          </Container>
        </div>

        {/* Row 2: 48px — folds via transform & opacity when scrolled > 80px */}
        <div
          className={cn(
            'relative z-10 h-12 origin-top border-t border-b border-silver/60 bg-white transition-[transform,opacity] duration-250 ease-out',
            isPast80 && !isMegaMenuOpen
              ? 'pointer-events-none -translate-y-full scale-y-0 opacity-0'
              : 'translate-y-0 scale-y-100 opacity-100',
          )}
        >
          <Container className="flex h-full items-center justify-between gap-6">
            <button
              ref={megaTriggerRef}
              type="button"
              aria-expanded={isMegaMenuOpen}
              aria-controls="mega-menu-panel"
              onClick={() => {
                setSearchDropdownOpenPath(null);
                setMegaMenuOpenPath((prev) =>
                  prev === location.pathname ? null : location.pathname,
                );
              }}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] px-3 text-small font-semibold transition-colors',
                isMegaMenuOpen
                  ? 'bg-ink text-white'
                  : 'text-ink hover:bg-surface',
              )}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
              <span>Catégories</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  isMegaMenuOpen && 'rotate-180',
                )}
                aria-hidden="true"
              />
            </button>

            <nav aria-label="Navigation principale" className="flex h-full items-center gap-7">
              {DESKTOP_LINKS.map((item) => {
                const active = isLinkActive(item.to, item.matchExact, item.isAnchor);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    viewTransition
                    onClick={item.isAnchor ? handleHowItWorksClick : undefined}
                    className={cn(
                      'relative inline-flex h-full items-center text-small font-semibold transition-colors',
                      active ? 'text-ink' : 'text-text-2 hover:text-ink',
                    )}
                  >
                    <span>{item.label}</span>
                    {active && (
                      <m.span
                        layoutId="desktop-nav-underline"
                        transition={spring.snappy}
                        className="absolute right-0 bottom-0 left-0 h-0.5 bg-red"
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            <span className="relative inline-flex">
              <Button variant="dark" size="sm" href="/reservations">
                Mes réservations
                {reservationsAttention && (
                  <span className="sr-only"> : une réservation demande votre attention</span>
                )}
              </Button>
              <AttentionDot show={reservationsAttention} className="-top-1 -right-1" />
            </span>
          </Container>

          {megaMenuMounted && (
            <Suspense fallback={null}>
              <LazyMegaMenu
                open={isMegaMenuOpen}
                onClose={() => setMegaMenuOpenPath(null)}
                triggerRef={megaTriggerRef}
              />
            </Suspense>
          )}
        </div>
      </header>

      {/* Mobile Header (below lg) — masqué sur la fiche produit (§7.1) et sur la page recherche plein écran */}
      {!isProductDetailPage && !isSearchPage && (
        <>
          <m.header
            initial={false}
            animate={{
              y: !reducedMotion && isMobileHidden ? '-100%' : '0%',
            }}
            transition={{ duration: duration.fast, ease: ease.out }}
            className={cn(
              'site-header fixed top-0 right-0 left-0 z-40 pt-safe transition-[background-color,box-shadow] duration-250 lg:hidden',
              isMobileTransparent
                ? 'bg-transparent text-white'
                : 'bg-white text-ink shadow-[var(--shadow-header)]',
            )}
          >
            <Container className="flex h-[var(--header-h)] items-center justify-between">
              <Logo
                variant={isMobileTransparent ? 'light' : 'dark'}
                size="sm"
              />

              <div className="flex items-center gap-1">
                <span onPointerDown={handleMobileSearchClick}>
                  <IconButton
                    variant={isMobileTransparent ? 'light-ghost' : 'plain'}
                    icon={<Search className="h-5 w-5" aria-hidden="true" />}
                    label="Rechercher"
                    href="/recherche"
                  />
                </span>
                <m.div
                  key={`mobile-hdr-cart-${cartBounceTick}`}
                  data-cart-target="mobile-header"
                  initial={cartBounceTick > 0 && !reducedMotion ? { scale: 1 } : false}
                  animate={
                    cartBounceTick > 0 && !reducedMotion
                      ? { scale: [1, 1.25, 1] }
                      : { scale: 1 }
                  }
                  transition={{ duration: 0.35, ease: ease.out }}
                >
                  <IconButton
                    variant={isMobileTransparent ? 'light-ghost' : 'plain'}
                    icon={<ShoppingBag className="h-5 w-5" aria-hidden="true" />}
                    label="Mon panier"
                    badge={cartCount}
                    href="/panier"
                  />
                </m.div>
              </div>
            </Container>
          </m.header>

          {/* Cale mobile hors accueil : hauteur de l'en-tête + zone de sécurité (encoche), qui s'additionnent */}
          {!isHomePage && (
            <div
              className="h-[calc(var(--header-h)+env(safe-area-inset-top,0px))] lg:hidden"
              aria-hidden="true"
            />
          )}
        </>
      )}
    </>
  );
}
