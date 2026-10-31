import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/ui/Logo';
import { ease } from '@/motion/tokens';
import {
  decideSplash,
  isSplashFirstAppearance,
  SPLASH_EXIT_MS,
  SPLASH_LOGO_IN_MS,
  splashRemainingMs,
} from './splash';

/**
 * Écran de lancement de l'app installée (M6 §8) : logo blanc sur fond ink qui apparaît en fondu
 * et grossit légèrement, puis l'accueil. Une seule fois par lancement à froid, jamais en
 * navigation web classique, jamais en mode réduit, jamais plus d'une seconde.
 * Monté dans l'écran de chargement initial et dans le gabarit : le second montage reprend
 * l'écran là où il en est, sans rejouer l'apparition.
 */
export function SplashScreen() {
  const [visible, setVisible] = useState(() => decideSplash() && splashRemainingMs() > 0);
  const [firstAppearance] = useState(isSplashFirstAppearance);

  useEffect(() => {
    if (!visible) return undefined;
    const timer = window.setTimeout(() => setVisible(false), splashRemainingMs());
    return () => window.clearTimeout(timer);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <m.div
          key="splash"
          aria-hidden="true"
          data-testid="splash-screen"
          initial={false}
          exit={{ opacity: 0 }}
          transition={{ duration: SPLASH_EXIT_MS / 1000, ease: ease.out }}
          className="fixed inset-0 z-splash flex items-center justify-center bg-ink"
        >
          <m.div
            initial={firstAppearance ? { opacity: 0, scale: 0.92 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: SPLASH_LOGO_IN_MS / 1000, ease: ease.out }}
          >
            <Logo variant="light" size="lg" />
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
