import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  Heart,
  Plus,
  Ruler,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { BackButton } from '@/components/ui/BackButton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Container, Price, Skeleton } from '@/components/ui/Primitives';
import { ProductCard } from '@/components/ui/ProductCard';
import {
  useDeliveryCitiesInfo,
  useProduct,
  useProducts,
  usePublicSettings,
} from '@/features/catalog/api/useCatalogQueries';
import { ProductGallery } from '@/features/catalog/product/ProductGallery';
import {
  productFallbackImage,
  productPrimaryImage,
} from '@/features/catalog/product/productImages';
import { ProductLightbox } from '@/features/catalog/product/ProductLightbox';
import { ProductSeo } from '@/features/catalog/product/ProductSeo';
import { SizeGuideSheet } from '@/features/catalog/product/SizeGuideSheet';
import { isNetworkError } from '@/features/offline/networkErrors';
import { OfflineScreen } from '@/features/offline/OfflineScreen';
import { useBackNavigation } from '@/lib/hooks/useBackNavigation';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { SITE_NAME, siteOrigin } from '@/lib/seo/seo';
import { useSeo } from '@/lib/seo/useSeo';
import { cn } from '@/lib/utils/cn';
import { haptic } from '@/lib/utils/haptics';
import { formatPrice } from '@/lib/utils/price';
import { duration, ease } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { useCartStore } from '@/stores/cartStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useRecentlyViewedStore } from '@/stores/recentlyViewedStore';
import { useToastStore } from '@/stores/toastStore';
import { useUiStore } from '@/stores/uiStore';
import type { Product, ProductColor, ProductImageEntry } from '@/types/domain';

const CATEGORY_LABELS: Record<string, string> = {
  vetements: 'Vêtements',
  chaussures: 'Chaussures',
  babouches: 'Babouches',
};

const COLOR_SWATCH_CLASSES: Record<string, string> = {
  noir: 'bg-ink border-ink',
  blanc: 'bg-surface border-silver',
  rouge: 'bg-red border-red',
  gris: 'bg-grey border-grey',
};

const PARTICLE_OFFSETS = [
  { x: 0, y: -16 },
  { x: 14, y: -8 },
  { x: 14, y: 8 },
  { x: 0, y: 16 },
  { x: -14, y: 8 },
  { x: -14, y: -8 },
] as const;

/**
 * Durée de blocage d'un article réservé quand les réglages de la boutique ne sont pas encore chargés.
 * HYPOTHÈSE: 24 h, valeur de reservationHoldHours dans les réglages publics (§3.1).
 */
const DEFAULT_HOLD_HOURS = 24;

/** Durée pendant laquelle « Ajouté » remplace « Ajouter » après un ajout au panier. */
const JUST_ADDED_MS = 1200;

type AccordionSectionId = 'description' | 'care' | 'delivery';

/** Erreur « article introuvable » de l'API : code NOT_FOUND ou statut HTTP 404. */
function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, status } = error as { code?: unknown; status?: unknown };
  return code === 'NOT_FOUND' || status === 404;
}

/** Apostrophe typographique dans les textes reçus de l'API (adresses, délais). */
function typographic(text: string): string {
  return text.replace(/'/g, '’');
}

/** Titre de l'onglet et « noindex » des états sans article (introuvable, erreur, hors connexion). */
function StatusSeo({ title }: { title: string }) {
  useSeo({ title: `${title} — ${SITE_NAME}`, absoluteTitle: true, noindex: true });
  return null;
}

/**
 * Page Fiche Produit (`/produit/:slug`, §7).
 */
export function ProductPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: product, isLoading, isError, error, refetch } = useProduct(slug);
  const { data: popularFallback } = useProducts({ sort: 'popular', pageSize: 4 });
  const isOnline = useOnlineStatus();

  // Retour (M6 §8) : écran précédent de l'app, sinon la catégorie de l'article
  // HYPOTHÈSE: parent logique d'une fiche ouverte par lien direct = sa catégorie dans Explorer
  const handleBack = useBackNavigation(product ? `/explorer/${product.categorySlug}` : '/explorer');

  if (isLoading && !product) {
    return <ProductPageSkeleton />;
  }

  const isNotFound =
    (isError && isNotFoundError(error)) || (!isLoading && !isError && !product);

  if (isNotFound) {
    return (
      <Container className="py-12">
        <StatusSeo title="Article introuvable" />
        <BackButton fallback="/explorer" className="mb-4 lg:hidden" />
        <div className="mx-auto max-w-xl rounded-[var(--radius-md)] border border-silver bg-surface p-8 text-center">
          <span className="text-label text-red">ARTICLE INTROUVABLE</span>
          <h1 className="mt-2 text-h1 text-ink">
            Cet article n&rsquo;existe plus ou a été déplacé
          </h1>
          <p className="mt-2 text-small text-text-2">
            Découvrez nos nouveautés et les pièces disponibles à la réservation.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button variant="primary" size="md" href="/explorer">
              Explorer le catalogue
            </Button>
            <Button variant="outline" size="md" href="/">
              Retour à l&rsquo;accueil
            </Button>
          </div>
        </div>

        {popularFallback && popularFallback.items.length > 0 && (
          <section className="mt-14" aria-labelledby="notfound-popular-heading">
            <h2 id="notfound-popular-heading" className="text-h2 text-ink">
              NOS ARTICLES POPULAIRES
            </h2>
            <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-4 md:gap-x-4 lg:gap-6">
              {popularFallback.items.slice(0, 4).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </Container>
    );
  }

  // Données déjà chargées : elles passent avant une relecture échouée (M6 §6.3)
  if (!product && (isNetworkError(error) || (!isOnline && !isLoading))) {
    // Fiche jamais consultée et réseau absent : repli « hors connexion » (M6 §6.5)
    return (
      <Container className="pt-[calc(env(safe-area-inset-top)+var(--offline-banner-h,0px)+16px)] pb-14 lg:pt-14">
        <StatusSeo title="Hors connexion" />
        {/* Pas d'en-tête sur la fiche mobile : retour explicite (indispensable en mode application) */}
        <button
          type="button"
          onClick={handleBack}
          className="-ml-2 inline-flex min-h-11 items-center gap-2 px-2 text-small font-semibold text-ink lg:hidden"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour
        </button>
        <OfflineScreen onRetry={() => refetch()} className="mt-4 lg:mt-0" />
      </Container>
    );
  }

  if (!product) {
    return (
      <Container className="py-14">
        <StatusSeo title="Article indisponible" />
        <BackButton fallback="/explorer" className="mb-4 lg:hidden" />
        <div className="mx-auto max-w-md rounded-[var(--radius-md)] border border-silver bg-surface p-6 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-danger" aria-hidden="true" />
          <h1 className="mt-3 text-h2 text-ink">
            Impossible de charger cet article
          </h1>
          <p className="mt-1.5 text-small text-text-2">
            Vérifiez votre connexion internet et réessayez.
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={() => void refetch()}
            className="mt-5"
          >
            Réessayer
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <ProductDetailView
      key={product.id}
      product={product}
      relatedProducts={product.related ?? []}
      onBack={handleBack}
    />
  );
}

function ProductDetailView({
  product,
  relatedProducts,
  onBack,
}: {
  product: Product;
  relatedProducts: Product[];
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const reducedMotion = useReducedMotionPref();

  const isFavorite = useFavoritesStore((s) => s.ids.includes(product.id));
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const addToCart = useCartStore((s) => s.add);
  const showToast = useToastStore((s) => s.show);
  const triggerFlyToCart = useUiStore((s) => s.triggerFlyToCart);
  const bumpCartBounce = useUiStore((s) => s.bumpCartBounce);
  const showMobileCartPeek = useUiStore((s) => s.showMobileCartPeek);
  const setActiveTransitionSlug = useUiStore((s) => s.setActiveTransitionSlug);

  // Réglages publics (adresse de retrait, durée de blocage), déjà en cache dans l'app
  const { data: settings } = usePublicSettings();
  const holdHours = settings?.reservationHoldHours ?? DEFAULT_HOLD_HOURS;
  const shopCity = settings?.shop?.city ?? settings?.pickupAddress?.city;

  // Enregistre le slug actif pour le retour de transition vers la grille (§4.2)
  useEffect(() => {
    setActiveTransitionSlug(product.slug);
  }, [product.slug, setActiveTransitionSlug]);

  // Derniers articles consultés, proposés hors connexion (M6 §6.5)
  const recordRecentlyViewed = useRecentlyViewedStore((s) => s.record);
  useEffect(() => {
    recordRecentlyViewed(product);
  }, [product, recordRecentlyViewed]);

  // Galerie d'images typée (§7.2)
  const galleryImages = useMemo<ProductImageEntry[]>(() => {
    if (product.mediaGallery && product.mediaGallery.length > 0) {
      return product.mediaGallery;
    }
    return product.images.map((url, idx) => ({
      url,
      fallbackUrl:
        product.fallbackImages[idx] ?? product.fallbackImages[0] ?? url,
      alt: `${product.name} — vue ${idx + 1}`,
      colorCode: product.colors[idx % Math.max(1, product.colors.length)]?.code,
    }));
  }, [product]);

  // Couleur active : depuis `?couleur=` ou première couleur ayant du stock (§7.4)
  const urlColorCode = searchParams.get('couleur');
  const defaultColorCode = useMemo(() => {
    if (
      urlColorCode &&
      product.colors.some((c) => c.code === urlColorCode)
    ) {
      return urlColorCode;
    }
    const firstWithStock = product.colors.find((c) =>
      product.variants.some((v) => v.colorCode === c.code && v.stock > 0),
    );
    return firstWithStock?.code ?? product.colors[0]?.code ?? 'noir';
  }, [product.colors, product.variants, urlColorCode]);

  const [selectedColorCode, setSelectedColorCode] = useState<string>(defaultColorCode);

  const isSingleUniqueSize =
    product.sizes.length === 1 && product.sizes[0] === 'Unique';

  // Taille sélectionnée : auto-sélectionnée uniquement si Taille Unique (§7.5)
  const [selectedSize, setSelectedSize] = useState<string | null>(() =>
    isSingleUniqueSize ? 'Unique' : null,
  );

  const [sizeDeselectedNotice, setSizeDeselectedNotice] = useState<string | null>(
    null,
  );
  const [sizeError, setSizeError] = useState(false);
  const [shakeTick, setShakeTick] = useState(0);
  const [justAdded, setJustAdded] = useState(false);
  const [favBurstKey, setFavBurstKey] = useState(0);

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [showCompactHeader, setShowCompactHeader] = useState(false);

  // Accordéons (§7.7) : Description ouvert par défaut sur ordinateur, fermé sur mobile
  const [openAccordion, setOpenAccordion] = useState<AccordionSectionId | null>(
    () =>
      typeof window !== 'undefined' && window.innerWidth >= 1024
        ? 'description'
        : null,
  );

  const mainImageRef = useRef<HTMLDivElement>(null);
  const sizeSectionRef = useRef<HTMLDivElement>(null);

  const activeColor: ProductColor =
    product.colors.find((c) => c.code === selectedColorCode) ??
    product.colors[0] ?? { code: 'noir', name: 'Noir Charbon', hex: '' };

  const variantsForColor = useMemo(
    () => product.variants.filter((v) => v.colorCode === activeColor.code),
    [activeColor.code, product.variants],
  );

  const selectedVariant = useMemo(
    () => variantsForColor.find((v) => v.size === selectedSize),
    [selectedSize, variantsForColor],
  );

  const totalStock = useMemo(
    () => product.variants.reduce((sum, v) => sum + v.stock, 0),
    [product.variants],
  );

  const isSoldOut = totalStock === 0 || product.badges.includes('sold-out');
  const isLowStock =
    !isSoldOut && (totalStock <= 3 || product.badges.includes('low-stock'));
  const isNew =
    !isSoldOut && !isLowStock && (product.isNew || product.badges.includes('new'));

  const categoryLabel =
    CATEGORY_LABELS[product.categorySlug] ?? product.categorySlug;
  const hasSimilar = relatedProducts.length > 0;

  // Apparition de la barre haute compacte sur mobile après 60 % de la galerie (§7.1)
  useEffect(() => {
    const handleScroll = () => {
      const galleryEl = mainImageRef.current;
      const threshold = galleryEl
        ? Math.max(180, galleryEl.offsetHeight * 0.6)
        : 260;
      setShowCompactHeader(window.scrollY > threshold);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSelectColor = (colorCode: string) => {
    setSelectedColorCode(colorCode);
    setSizeError(false);

    // Met à jour `?couleur=` dans l'URL sans polluer l'historique (§7.4)
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('couleur', colorCode);
    setSearchParams(nextParams, { replace: true });

    // Bascule la galerie sur la photo associée à cette couleur
    const matchingImageIdx = galleryImages.findIndex(
      (img) => img.colorCode === colorCode,
    );
    if (matchingImageIdx >= 0) {
      setActiveImageIndex(matchingImageIdx);
    }

    // Vérifie si la taille actuellement choisie existe en stock dans cette nouvelle couleur (§7.4)
    if (selectedSize && !isSingleUniqueSize) {
      const matchingVariant = product.variants.find(
        (v) =>
          v.colorCode === colorCode && v.size === selectedSize && v.stock > 0,
      );
      if (!matchingVariant) {
        const previousSize = selectedSize;
        setSelectedSize(null);
        setSizeDeselectedNotice(
          `La taille ${previousSize} est épuisée dans cette couleur — veuillez choisir une autre taille.`,
        );
      } else {
        setSizeDeselectedNotice(null);
      }
    } else if (isSingleUniqueSize) {
      const uniqueVariant = product.variants.find(
        (v) => v.colorCode === colorCode && v.size === 'Unique' && v.stock > 0,
      );
      setSelectedSize(uniqueVariant ? 'Unique' : null);
    }
  };

  const handleSelectSize = (size: string) => {
    setSelectedSize(size);
    setSizeError(false);
    setSizeDeselectedNotice(null);
    haptic('light');
  };

  const handleToggleFavorite = () => {
    const added = toggleFavorite(product.id);
    haptic('light');
    if (added) {
      setFavBurstKey((k) => k + 1);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${siteOrigin()}/produit/${product.slug}?couleur=${encodeURIComponent(
      activeColor.code,
    )}`;
    const shareTitle = `${product.name} — ${formatPrice(product.price)}`;
    const shareText = `${product.name} (${formatPrice(product.price)}) sur ${SITE_NAME}`;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // Repli vers le presse-papiers si l'utilisateur ferme ou si le partage échoue
      }
    }

    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      try {
        await navigator.clipboard.writeText(shareUrl);
      } catch {
        // Presse-papiers refusé (permissions, environnement de test) : le message reste affiché
      }
    }

    showToast({
      message: 'Lien copié dans le presse-papiers',
    });
  };

  const triggerNoSizeFeedback = () => {
    setSizeError(true);
    setShakeTick((t) => t + 1);
    haptic('error');
    sizeSectionRef.current?.scrollIntoView?.({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'center',
    });
  };

  const handleAction = (intent: 'add' | 'reserve') => {
    if (isSoldOut) return;

    if (!selectedVariant || selectedVariant.stock <= 0) {
      triggerNoSizeFeedback();
      return;
    }

    const activeImg = galleryImages[activeImageIndex] ?? galleryImages[0];
    const imageSrc = activeImg?.url ?? productPrimaryImage(product);
    const fallbackSrc = activeImg?.fallbackUrl ?? productFallbackImage(product);

    addToCart({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: fallbackSrc,
      variantId: selectedVariant.id,
      size: selectedVariant.size,
      color: activeColor,
      unitPrice: product.price,
      quantity: 1,
      maxQuantity: selectedVariant.stock,
    });

    haptic('success');

    if (intent === 'reserve') {
      bumpCartBounce();
      useUiStore.getState().requireAuth(() => {
        navigate('/reservation', { viewTransition: true });
      });
      return;
    }

    // Animation d'envol de la photo vers le panier (§7.9)
    if (mainImageRef.current) {
      const rect = mainImageRef.current.getBoundingClientRect();
      triggerFlyToCart({
        image: imageSrc,
        fallback: fallbackSrc,
        sourceRect: {
          x: rect.left + rect.width * 0.15,
          y: rect.top + rect.height * 0.15,
          width: Math.min(220, rect.width * 0.7),
          height: Math.min(275, rect.height * 0.7),
        },
      });
    } else {
      bumpCartBounce();
    }

    showMobileCartPeek();
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), JUST_ADDED_MS);

    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      useUiStore.getState().openCartDrawer(true);
    } else {
      showToast({
        message: `${product.name} ajouté au panier`,
        // La taille d'abord : à 360 px, la fin du sous-titre du toast est coupée
        subtitle: `Taille ${selectedVariant.size} · ${activeColor.name}`,
        thumbnail: fallbackSrc,
        actionLabel: 'Voir le panier',
        actionHref: '/panier',
      });
    }
  };

  const scrollToSimilar = () => {
    const target = document.getElementById('articles-similaires');
    target?.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  };

  return (
    <div className="min-h-dvh bg-white pb-[calc(var(--action-bar-h)+24px)] lg:pb-20">
      <ProductSeo product={product} />

      {/* =====================================================================
       * BARRE HAUTE COMPACTE MOBILE (apparaît après 60 % de la galerie, §7.1)
       * ===================================================================== */}
      <AnimatePresence>
        {showCompactHeader && (
          <m.div
            initial={{ y: '-100%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            exit={{ y: '-100%', opacity: 0 }}
            transition={{ duration: duration.fast, ease: ease.out }}
            className="fixed top-[var(--offline-banner-h,0px)] right-0 left-0 z-header flex h-[calc(52px+env(safe-area-inset-top,0px))] items-center justify-between border-b border-silver/70 bg-white/95 px-3 pt-safe shadow-[var(--shadow-header)] backdrop-blur-md lg:hidden"
          >
            <button
              type="button"
              onClick={onBack}
              aria-label="Retour"
              className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-full)] text-ink hover:bg-surface"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="min-w-0 flex-1 px-3 text-center">
              <p className="truncate text-caption font-bold text-ink">{product.name}</p>
              <Price amount={product.price} className="text-caption text-text-2" />
            </div>

            <button
              type="button"
              onClick={handleToggleFavorite}
              aria-label={
                isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'
              }
              aria-pressed={isFavorite}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-full)] text-ink hover:bg-surface"
            >
              <Heart
                className={cn(
                  'h-5 w-5',
                  isFavorite ? 'fill-red text-red' : 'text-ink',
                )}
                aria-hidden="true"
              />
            </button>
          </m.div>
        )}
      </AnimatePresence>

      {/* =====================================================================
       * BOUTONS RONDS FLOTTANTS SUR LA PHOTO MOBILE (Retour, Favori, Partager, §7.1)
       * ===================================================================== */}
      <div
        inert={showCompactHeader}
        className={cn(
          'pointer-events-none fixed top-[calc(0.75rem+var(--offline-banner-h,0px))] right-4 left-4 z-sticky flex items-center justify-between pt-safe transition-opacity duration-fast lg:hidden',
          // La barre compacte reprend Retour et Favori : les boutons ronds ne dépassent plus en dessous
          showCompactHeader && 'opacity-0',
        )}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour"
          className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-full)] bg-white text-ink shadow-[var(--shadow-card-icon)]"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleFavorite}
            aria-label={
              isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'
            }
            aria-pressed={isFavorite}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-full)] bg-white text-ink shadow-[var(--shadow-card-icon)]"
          >
            <Heart
              className={cn(
                'h-5 w-5 transition-colors',
                isFavorite ? 'fill-red text-red' : 'text-ink',
              )}
              aria-hidden="true"
            />
            {favBurstKey > 0 && isFavorite && (
              <span
                key={`mob-fav-${favBurstKey}`}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                {PARTICLE_OFFSETS.map((offset, idx) => (
                  <m.span
                    key={idx}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{
                      x: offset.x,
                      y: offset.y,
                      opacity: 0,
                      scale: 0.4,
                    }}
                    transition={{ duration: duration.base, ease: ease.out }}
                    className="absolute h-1.5 w-1.5 rounded-[var(--radius-full)] bg-red"
                  />
                ))}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => void handleShare()}
            aria-label="Partager cet article"
            className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-full)] bg-white text-ink shadow-[var(--shadow-card-icon)]"
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Fil d'Ariane sur ordinateur (§7.1) */}
      <Container className="hidden pt-6 pb-4 lg:block">
        <nav
          aria-label="Fil d’Ariane"
          className="flex items-center gap-1.5 text-caption text-text-2"
        >
          <Link to="/" viewTransition className="py-1 hover:text-ink">
            Accueil
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link
            to={`/explorer/${product.categorySlug}`}
            viewTransition
            className="py-1 hover:text-ink"
          >
            {categoryLabel}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-semibold text-ink">{product.name}</span>
        </nav>
      </Container>

      {/* =====================================================================
       * MISE EN PAGE PRINCIPALE : Mobile empilé / Ordinateur 2 colonnes (58 % / 42 %)
       * ===================================================================== */}
      <div className="mx-auto max-w-content lg:px-page">
        <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-12">
          {/* Colonne gauche (58 % -> 7 cols sur 12) : Galerie photo */}
          <div className="lg:col-span-7">
            <ProductGallery
              slug={product.slug}
              productName={product.name}
              images={galleryImages}
              activeIndex={activeImageIndex}
              onActiveIndexChange={setActiveImageIndex}
              onOpenLightbox={(idx) => {
                setActiveImageIndex(idx);
                setLightboxOpen(true);
              }}
              mainImageRef={mainImageRef}
              isSoldOut={isSoldOut}
              isLowStock={isLowStock}
              totalStock={totalStock}
              isNew={isNew}
            />
          </div>

          {/* Colonne droite (42 % -> 5 cols sur 12) : Feuille d'informations (remonte de -24px sur mobile, §7.1) ;
              sur ordinateur, collée sous l'en-tête replié (et sous le bandeau rouge s'il est affiché) */}
          <div className="relative z-10 -mt-6 rounded-t-[var(--radius-sheet)] bg-white px-page pt-6 lg:sticky lg:top-[calc(var(--desktop-shell-top)+24px)] lg:col-span-5 lg:mt-0 lg:rounded-none lg:px-0 lg:pt-0">
            {/* Poignée décorative mobile */}
            <div
              aria-hidden="true"
              className="mx-auto mb-4 h-1 w-10 rounded-[var(--radius-full)] bg-silver lg:hidden"
            />

            {/* Catégorie + Badge statut */}
            <div className="flex items-center justify-between gap-2">
              <Link
                to={`/explorer/${product.categorySlug}`}
                viewTransition
                className="-my-3 inline-flex min-h-11 items-center text-label text-text-2 hover:text-ink"
              >
                {categoryLabel}
              </Link>

              <div className="lg:hidden">
                {isSoldOut ? (
                  <Badge variant="sold-out" />
                ) : isLowStock ? (
                  <Badge variant="low-stock" lowStockCount={totalStock} />
                ) : isNew ? (
                  <Badge variant="new" />
                ) : null}
              </div>
            </div>

            {/* Titre produit */}
            <h1 className="mt-1.5 text-h1 text-ink">{product.name}</h1>

            {/* Prix + Mention de blocage (masquée si l'article est épuisé : rien à réserver) */}
            <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-silver/60 pb-4">
              <Price amount={product.price} className="text-h2 text-ink" />
              {!isSoldOut && (
                <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-success">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Réservation gratuite · article bloqué {holdHours}&nbsp;h</span>
                </span>
              )}
            </div>

            {/* =================================================================
             * SÉLECTEUR DE COULEUR (§7.4)
             * ================================================================= */}
            {product.colors.length > 0 && (
              <div className="mt-5">
                <p className="text-label text-text-2">
                  COULEUR&nbsp;: <span className="text-ink">{activeColor.name}</span>
                </p>

                <div
                  role="radiogroup"
                  aria-label="Choisir une couleur"
                  className="mt-2.5 flex flex-wrap items-center gap-3"
                >
                  {product.colors.map((color) => {
                    const isSelected = color.code === activeColor.code;
                    const isColorSoldOut = !product.variants.some(
                      (v) => v.colorCode === color.code && v.stock > 0,
                    );

                    return (
                      <button
                        key={color.code}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={
                          isColorSoldOut
                            ? `${color.name}, épuisée`
                            : color.name
                        }
                        onClick={() => handleSelectColor(color.code)}
                        className={cn(
                          // before: zone tactile de 44 px autour de la pastille de 36 px
                          "relative flex h-9 w-9 items-center justify-center rounded-[var(--radius-full)] border transition-transform before:absolute before:-inset-1 before:rounded-[var(--radius-full)] before:content-['']",
                          COLOR_SWATCH_CLASSES[color.code] ?? 'bg-ink border-ink',
                          isSelected && 'ring-2 ring-ink ring-offset-2',
                          isColorSoldOut && 'opacity-55',
                        )}
                      >
                        {isColorSoldOut && (
                          <span
                            aria-hidden="true"
                            className={cn(
                              'pointer-events-none absolute -inset-x-0.5 top-1/2 h-[2px] -translate-y-1/2 -rotate-45',
                              // Barre rouge invisible sur la pastille rouge : barre noire pour celle-ci
                              color.code === 'rouge' ? 'bg-ink' : 'bg-red',
                            )}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* =================================================================
             * SÉLECTEUR DE TAILLE & ÉTATS DE STOCK (§7.5)
             * ================================================================= */}
            <div ref={sizeSectionRef} className="mt-6">
              <div className="flex items-center justify-between gap-2">
                <span className="text-label text-text-2">
                  {product.categorySlug === 'vetements' ? 'TAILLE' : 'POINTURE'}
                </span>

                {product.sizeGuide && (
                  <button
                    type="button"
                    onClick={() => setSizeGuideOpen(true)}
                    className="-my-3 inline-flex min-h-11 items-center gap-1.5 text-caption font-bold text-ink underline underline-offset-2 hover:text-red"
                  >
                    <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Guide des tailles</span>
                  </button>
                )}
              </div>

              {isSingleUniqueSize ? (
                <div className="mt-2.5 rounded-[var(--radius-md)] border border-ink bg-surface px-4 py-3 text-small font-semibold text-ink">
                  Taille unique — convient à toutes les morphologies
                </div>
              ) : (
                <m.div
                  key={`size-grid-${shakeTick}`}
                  animate={
                    shakeTick > 0 && !reducedMotion
                      ? { x: [0, -6, 6, -4, 4, 0] }
                      : { x: 0 }
                  }
                  transition={{ duration: duration.base }}
                  role="radiogroup"
                  aria-label="Choisir une taille"
                  className={cn(
                    // Colonnes automatiques : les tailles occupent toute la rangée (5 tailles à 768 px aussi)
                    'mt-2.5 grid grid-cols-[repeat(auto-fit,minmax(3.5rem,1fr))] gap-2 rounded-[var(--radius-md)] p-1 transition-colors',
                    sizeError && 'border border-red bg-red/5 p-2',
                  )}
                >
                  {product.sizes.map((size) => {
                    const variant = variantsForColor.find((v) => v.size === size);
                    const stock = variant?.stock ?? 0;
                    const outOfStock = stock <= 0;
                    const isSelected = selectedSize === size && !outOfStock;

                    return (
                      <button
                        key={size}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        disabled={outOfStock}
                        onClick={() => handleSelectSize(size)}
                        aria-label={
                          outOfStock
                            ? `Taille ${size}, épuisée`
                            : `Taille ${size} (${stock} disponible${stock > 1 ? 's' : ''})`
                        }
                        className={cn(
                          'relative flex h-12 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border text-small font-bold transition-colors',
                          outOfStock
                            ? 'cursor-not-allowed border-silver bg-surface text-text-2 line-through'
                            : isSelected
                              ? 'border-ink bg-ink text-white'
                              : 'border-silver bg-white text-ink hover:border-ink',
                        )}
                      >
                        <span>{size}</span>
                        {outOfStock && (
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute -inset-x-1 top-1/2 h-[1px] -translate-y-1/2 -rotate-35 bg-silver"
                          />
                        )}
                      </button>
                    );
                  })}
                </m.div>
              )}

              {/* Messages dynamiques : erreur aucune taille, désélection couleur, ou stock réel (§7.4 & §7.5) */}
              <div aria-live="polite" className="mt-2 min-h-5">
                {sizeError ? (
                  <p role="alert" className="text-caption font-bold text-danger">
                    Choisissez votre taille pour continuer
                  </p>
                ) : sizeDeselectedNotice ? (
                  <p className="text-caption font-semibold text-warning">
                    {sizeDeselectedNotice}
                  </p>
                ) : selectedVariant && selectedVariant.stock > 0 ? (
                  selectedVariant.stock <= 2 ? (
                    <p className="text-caption font-bold text-warning">
                      Plus que {selectedVariant.stock} exemplaire
                      {selectedVariant.stock > 1 ? 's' : ''} en taille{' '}
                      {selectedVariant.size} — bloqué {holdHours}&nbsp;h dès votre réservation
                    </p>
                  ) : (
                    <p className="text-caption font-semibold text-success">
                      En stock — bloqué {holdHours}&nbsp;h dès votre réservation
                    </p>
                  )
                ) : null}
              </div>
            </div>

            {/* =================================================================
             * BOUTONS D'ACTION SUR ORDINATEUR (et état épuisé mobile + bureau, §7.5 & §7.8)
             * ================================================================= */}
            {/* Sur mobile hors épuisé, les boutons sont dans la barre collante : pas de bloc vide (et sa marge) ici */}
            <div className={cn(isSoldOut ? 'mt-5' : 'hidden lg:mt-5 lg:block')}>
              {isSoldOut ? (
                <div className="rounded-[var(--radius-md)] border border-silver bg-surface p-4 text-center">
                  <p className="text-small font-bold text-ink">
                    Cet article est épuisé
                  </p>
                  {hasSimilar ? (
                    <button
                      type="button"
                      onClick={scrollToSimilar}
                      className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-caption font-bold text-red hover:underline"
                    >
                      <span>Voir des articles similaires ↓</span>
                    </button>
                  ) : (
                    <Link
                      to={`/explorer/${product.categorySlug}`}
                      viewTransition
                      className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-caption font-bold text-red hover:underline"
                    >
                      Voir les autres articles&nbsp;: {categoryLabel}
                    </Link>
                  )}
                </div>
              ) : (
                <div className="hidden flex-col gap-3 lg:flex">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => handleAction('add')}
                      iconLeft={
                        justAdded ? (
                          <Check className="h-4 w-4 text-success" aria-hidden="true" />
                        ) : (
                          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                        )
                      }
                      className="w-[42%]"
                    >
                      {justAdded ? 'Ajouté' : 'Ajouter au panier'}
                    </Button>

                    <Button
                      variant="primary"
                      size="lg"
                      onClick={() => handleAction('reserve')}
                      className="flex-1"
                    >
                      Réserver · {formatPrice(product.price)}
                    </Button>
                  </div>

                  {/* Actions secondaires sur ordinateur : Favoris & Partager */}
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleToggleFavorite}
                      aria-pressed={isFavorite}
                      className="inline-flex min-h-11 items-center gap-2 text-caption font-bold text-ink hover:text-red"
                    >
                      <Heart
                        className={cn(
                          'h-4 w-4',
                          isFavorite ? 'fill-red text-red' : 'text-ink',
                        )}
                        aria-hidden="true"
                      />
                      <span>
                        {isFavorite
                          ? 'Retirer de mes favoris'
                          : 'Ajouter à mes favoris'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleShare()}
                      className="inline-flex min-h-11 items-center gap-1.5 text-caption font-bold text-text-2 hover:text-ink"
                    >
                      <Share2 className="h-4 w-4" aria-hidden="true" />
                      <span>Partager l&rsquo;article</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bandeau de réassurance rapide (adresse et frais exacts dans « Livraison et retrait en boutique ») */}
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-[var(--radius-md)] bg-surface p-3.5 text-caption text-ink lg:mt-6">
              <div className="flex items-start gap-2.5">
                <ShieldCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-red"
                  aria-hidden="true"
                />
                <span>Paiement MTN MoMo ou Orange Money après réservation</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Truck
                  className="mt-0.5 h-4 w-4 shrink-0 text-red"
                  aria-hidden="true"
                />
                <span>
                  Retrait gratuit en boutique{shopCity ? ` à ${shopCity}` : ''} ou livraison au
                  Cameroun
                </span>
              </div>
            </div>

            {/* =================================================================
             * 3 ACCORDÉONS D'INFORMATION À OUVERTURE UNIQUE (§7.7)
             * ================================================================= */}
            <div className="mt-6 divide-y divide-silver/70 border-t border-b border-silver/70">
              <AccordionItem
                id="description"
                title="Description"
                isOpen={openAccordion === 'description'}
                onToggle={() =>
                  setOpenAccordion((prev) =>
                    prev === 'description' ? null : 'description',
                  )
                }
              >
                <p className="text-small leading-relaxed text-text-2">
                  {product.description}
                </p>
              </AccordionItem>

              <AccordionItem
                id="care"
                title="Composition et entretien"
                isOpen={openAccordion === 'care'}
                onToggle={() =>
                  setOpenAccordion((prev) => (prev === 'care' ? null : 'care'))
                }
              >
                <div className="space-y-2 text-small text-text-2">
                  <p>
                    <strong className="font-semibold text-ink">
                      Matière&nbsp;:
                    </strong>{' '}
                    {product.composition}
                  </p>
                  {product.careInstructions &&
                    product.careInstructions.length > 0 && (
                      <div>
                        <strong className="font-semibold text-ink">
                          Conseils d&rsquo;entretien&nbsp;:
                        </strong>
                        <ul className="mt-1 list-inside list-disc space-y-1">
                          {product.careInstructions.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              </AccordionItem>

              <AccordionItem
                id="delivery"
                title="Livraison et retrait en boutique"
                isOpen={openAccordion === 'delivery'}
                onToggle={() =>
                  setOpenAccordion((prev) =>
                    prev === 'delivery' ? null : 'delivery',
                  )
                }
              >
                <DeliveryDetails active={openAccordion === 'delivery'} holdHours={holdHours} />
              </AccordionItem>
            </div>
          </div>
        </div>

        {/* =====================================================================
         * SECTION « ARTICLES SIMILAIRES » (§7.10)
         * ===================================================================== */}
        {hasSimilar && (
          <section
            id="articles-similaires"
            aria-labelledby="similar-products-heading"
            className="mt-14 px-page lg:mt-20 lg:px-0"
          >
            {/* Sous 640 px, « Voir tout » sans la catégorie : titre et lien tiennent chacun sur une ligne à 360 px */}
            <div className="flex items-center justify-between gap-4">
              <h2 id="similar-products-heading" className="min-w-0 text-h2 text-ink">
                ARTICLES SIMILAIRES
              </h2>
              <Link
                to={`/explorer/${product.categorySlug}`}
                viewTransition
                aria-label={`Voir tout\u00a0: ${categoryLabel}`}
                className="inline-flex min-h-11 shrink-0 items-center text-caption font-bold whitespace-nowrap text-ink underline-offset-2 hover:underline"
              >
                Voir tout<span className="hidden sm:inline">&nbsp;({categoryLabel})</span>
              </Link>
            </div>

            {/* Carrousel horizontal sur mobile, grille 4 colonnes sur ordinateur */}
            <div className="no-scrollbar mt-5 flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-2 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:pb-0">
              {relatedProducts.slice(0, 4).map((related) => (
                <div
                  key={related.id}
                  className="w-[66vw] max-w-65 shrink-0 snap-start lg:w-auto lg:max-w-none"
                >
                  <ProductCard product={related} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* =====================================================================
       * BARRE D'ACTION COLLANTE EN BAS SUR MOBILE (`72 px` + `pb-safe`, §7.8)
       * ===================================================================== */}
      <div className="fixed right-0 bottom-0 left-0 z-nav border-t border-silver/70 bg-white pb-safe shadow-[var(--shadow-nav)] lg:hidden">
        <Container className="flex h-[var(--action-bar-h)] items-center gap-3">
          {isSoldOut ? (
            hasSimilar ? (
              <Button
                variant="outline"
                size="md"
                fullWidth
                onClick={scrollToSimilar}
              >
                Cet article est épuisé · Voir similaires ↓
              </Button>
            ) : (
              <Button
                variant="outline"
                size="md"
                fullWidth
                href={`/explorer/${product.categorySlug}`}
              >
                Article épuisé · Voir la catégorie
              </Button>
            )
          ) : (
            <>
              <div data-cart-target="product-bar" className="w-[40%]">
                <Button
                  variant="outline"
                  size="md"
                  fullWidth
                  onClick={() => handleAction('add')}
                  iconLeft={
                    justAdded ? (
                      <Check className="h-4 w-4 text-success" aria-hidden="true" />
                    ) : (
                      <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                    )
                  }
                >
                  {justAdded ? 'Ajouté' : 'Ajouter'}
                </Button>
              </div>

              <div className="w-[60%]">
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  onClick={() => handleAction('reserve')}
                >
                  Réserver · {formatPrice(product.price)}
                </Button>
              </div>
            </>
          )}
        </Container>
      </div>

      {/* Visionneuse plein écran (§7.3) */}
      <ProductLightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={galleryImages}
        initialIndex={activeImageIndex}
        productName={product.name}
      />

      {/* Tiroir Guide des tailles (§7.6) */}
      <SizeGuideSheet
        open={sizeGuideOpen}
        onClose={() => setSizeGuideOpen(false)}
        sizeGuide={product.sizeGuide}
      />
    </div>
  );
}

/**
 * Contenu de l'accordéon « Livraison et retrait en boutique » (§7.7) : adresse de retrait et frais
 * lus dans les réglages publics (GET /settings/public) et la liste des villes (GET /delivery/cities),
 * chargée à l'ouverture. Sans ces données (chargement impossible, hors connexion) : formulation
 * neutre, sans aucun montant écrit en dur.
 */
function DeliveryDetails({ active, holdHours }: { active: boolean; holdHours: number }) {
  const { data: settings } = usePublicSettings();
  const { data: cities, isLoading } = useDeliveryCitiesInfo(active);

  const pickup = settings?.pickupAddress;
  const pickupPlace = pickup
    ? typographic([pickup.quarter, pickup.city].filter(Boolean).join(', '))
    : settings?.shop
      ? typographic([settings.shop.address, settings.shop.city].filter(Boolean).join(', '))
      : null;

  const localCities = (cities ?? []).filter((c) => c.isLocal);
  const otherFees = (cities ?? []).filter((c) => !c.isLocal).map((c) => c.fee);
  const minOtherFee = otherFees.length > 0 ? Math.min(...otherFees) : null;
  const maxOtherFee = otherFees.length > 0 ? Math.max(...otherFees) : null;

  return (
    <ul className="space-y-2 text-small text-text-2">
      <li>
        <strong className="font-semibold text-ink">Retrait en boutique (gratuit)&nbsp;:</strong>{' '}
        {pickupPlace ? `${pickupPlace}. ` : ''}Votre pièce est mise de côté pendant {holdHours}&nbsp;h
        dès votre réservation.
      </li>

      {isLoading && active ? (
        <li aria-hidden="true" className="space-y-2 pt-1">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </li>
      ) : cities && cities.length > 0 ? (
        <>
          {localCities.map((city) => (
            <li key={city.id}>
              <strong className="font-semibold text-ink">
                Livraison à {city.name}&nbsp;:
              </strong>{' '}
              {formatPrice(city.fee)}, {typographic(city.estimatedDelay).toLowerCase()}, après
              validation de votre preuve de paiement.
            </li>
          ))}
          {minOtherFee !== null && maxOtherFee !== null && (
            <li>
              <strong className="font-semibold text-ink">Autres villes du Cameroun&nbsp;:</strong>{' '}
              {minOtherFee === maxOtherFee
                ? formatPrice(minOtherFee)
                : `de ${formatPrice(minOtherFee)} à ${formatPrice(maxOtherFee)} selon la ville`}
              , expédition par agence de transport. Tarif et délai exacts à l&rsquo;étape de livraison.
            </li>
          )}
          {settings?.deliveryFeePayment && (
            <li>
              {settings.deliveryFeePayment === 'on_delivery'
                ? 'Les frais de livraison se règlent à la réception du colis.'
                : 'Les frais de livraison se règlent avec votre réservation, par Mobile Money.'}
            </li>
          )}
        </>
      ) : (
        <li>
          <strong className="font-semibold text-ink">Livraison&nbsp;:</strong> frais calculés à
          l&rsquo;étape de livraison, selon votre ville.
        </li>
      )}
    </ul>
  );
}

function AccordionItem({
  id,
  title,
  isOpen,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const panelId = `fiche-accordeon-${id}`;
  return (
    <div>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex min-h-13 w-full items-center justify-between py-3.5 text-left text-small font-bold text-ink"
      >
        <span>{title}</span>
        <Plus
          className={cn(
            'h-4 w-4 shrink-0 text-ink transition-transform duration-quick ease-brand-out',
            isOpen && 'rotate-45 text-red',
          )}
          aria-hidden="true"
        />
      </button>

      {/* Ouverture sans animation de hauteur (M7 §4.4 : transform et opacité seulement) : le contenu
          apparaît en fondu. Fermé, il sort de l'ordre de tabulation et des lecteurs d'écran (inert). */}
      <div
        id={panelId}
        inert={!isOpen}
        className={cn('grid', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              'pb-4 transition-opacity duration-quick ease-brand-out',
              isOpen ? 'opacity-100' : 'opacity-0',
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductPageSkeleton() {
  return (
    <div className="mx-auto max-w-content pb-20 lg:px-page lg:pt-10" aria-hidden="true">
      <div className="lg:grid lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          <Skeleton className="aspect-[4/5] w-full rounded-none lg:rounded-[var(--radius-md)]" />
        </div>
        <div className="space-y-4 px-page pt-6 lg:col-span-5 lg:px-0 lg:pt-0">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-4/5" />
          <Skeleton className="h-7 w-36" />
          <Skeleton className="mt-6 h-10 w-44" />
          <div className="grid grid-cols-5 gap-2 pt-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
          <Skeleton className="mt-6 h-12 w-full" />
        </div>
      </div>
    </div>
  );
}
