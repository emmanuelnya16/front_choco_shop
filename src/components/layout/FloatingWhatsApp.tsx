import * as m from 'motion/react-m';
import { useLocation } from 'react-router';
import { hasMobileActionBar, isPaymentStepPath } from '@/components/layout/bottomNavVisibility';
import { usePublicSettings } from '@/features/catalog/api/useCatalogQueries';
import { cn } from '@/lib/utils/cn';
import { spring } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { selectCartCount, useCartStore } from '@/stores/cartStore';

export function WhatsAppIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      <path d="M9.5 9.5c.3 1.5 1.5 2.7 3 3l1.2-.8c.2-.1.5-.1.7 0l1.6.9c.3.2.4.5.3.8-.3.9-1.2 1.6-2.2 1.6-2.8 0-5.1-2.3-5.1-5.1 0-1 .7-1.9 1.6-2.2.3-.1.6 0 .8.3l.9 1.6c.1.2.1.5 0 .7l-.8 1.2z" />
    </svg>
  );
}

export function FloatingWhatsApp() {
  const location = useLocation();
  const reducedMotion = useReducedMotionPref();
  const { data: settings } = usePublicSettings();
  const cartCount = useCartStore(selectCartCount);

  // Correspondance exacte : la page d'aide « Paiement Mobile Money » garde le bouton
  if (isPaymentStepPath(location.pathname)) return null;

  // Masqué sur mobile quand une barre d'action collante remplace la barre basse (fiche produit §7.1,
  // finalisation de la réservation, panier non vide) : toute la place lui revient
  const hiddenOnMobile = hasMobileActionBar(location.pathname, cartCount);

  const rawNumber = settings?.whatsappNumber ?? '+237690000000';
  const cleanNumber = rawNumber.replace(/[^0-9]/g, '');
  const message = encodeURIComponent("Bonjour DR Choco, j'ai une question.");
  const href = `https://wa.me/${cleanNumber}?text=${message}`;

  return (
    <m.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Nous écrire sur WhatsApp"
      initial={reducedMotion ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileTap={reducedMotion ? undefined : { scale: 0.94 }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : { ...spring.bounce, delay: 1.5 }
      }
      // Pile du bas (index.css) : au-dessus de la barre basse, du bandeau rouge et du bandeau de mise à jour
      data-floating-whatsapp={hiddenOnMobile ? 'desktop' : 'all'}
      className={cn(
        'fixed right-4 bottom-[calc(var(--bottom-bar-h)+var(--pending-banner-h)+var(--update-banner-h)+16px)] z-30 h-[52px] w-[52px] items-center justify-center rounded-full border border-white/15 bg-ink text-white shadow-[var(--shadow-pop)] transition-colors hover:bg-ink-2 lg:right-6 lg:bottom-6',
        hiddenOnMobile ? 'hidden lg:flex' : 'flex',
      )}
    >
      <WhatsAppIcon className="h-6 w-6" />
    </m.a>
  );
}
