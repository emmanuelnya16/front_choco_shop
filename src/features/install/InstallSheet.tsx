import { BellRing, ReceiptText, Zap, type LucideIcon } from 'lucide-react';
import type { Variants } from 'motion/react';
import * as m from 'motion/react-m';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { delay, duration, ease, spring, staggerSlow, staggerStep } from '@/motion/tokens';
import { AppIconTile } from './AppIconTile';

const BENEFITS: { icon: LucideIcon; label: string }[] = [
  { icon: Zap, label: 'Ouverture instantanée, même avec peu de réseau' },
  { icon: BellRing, label: 'Notification dès que votre colis est prêt' },
  { icon: ReceiptText, label: 'Vos réservations toujours à portée de main' },
];

// Captures du manifeste (`npm run screenshots`) ; une maquette les remplace tant qu'elles manquent
const PREVIEWS = [
  { src: '/screenshots/accueil-narrow.png', label: 'Accueil' },
  { src: '/screenshots/suivi-narrow.png', label: 'Suivi de réservation' },
];

const benefitsList: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: delay.short + staggerStep, staggerChildren: staggerSlow } },
};

const benefitItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } },
};

/** Aperçu d'une capture (format 9:16), avec une maquette sobre si l'image est absente. */
function ScreenshotPreview({ src, label }: { src: string; label: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <figure className="w-27 shrink-0 snap-start">
      <div className="aspect-[9/16] overflow-hidden rounded-[var(--radius-md)] border border-silver/70 bg-surface">
        {failed ? (
          <div aria-hidden="true" className="flex h-full flex-col">
            <div className="flex h-7 items-center bg-ink px-2">
              <span className="text-caption font-black tracking-wide text-white">DR CHOCO</span>
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-2">
              <div className="h-12 rounded-[var(--radius-sm)] bg-silver/60" />
              <div className="h-1.5 w-3/4 rounded-[var(--radius-full)] bg-silver" />
              <div className="h-1.5 w-1/2 rounded-[var(--radius-full)] bg-silver/70" />
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                <div className="aspect-[3/4] rounded-[var(--radius-sm)] bg-silver/50" />
                <div className="aspect-[3/4] rounded-[var(--radius-sm)] bg-silver/50" />
              </div>
              <div className="mt-auto h-4 rounded-[var(--radius-sm)] bg-red" />
            </div>
          </div>
        ) : (
          <img
            src={src}
            alt={`Aperçu\u00A0: ${label}`}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <figcaption className="mt-1.5 text-center text-caption text-text-2">{label}</figcaption>
    </figure>
  );
}

export interface InstallSheetProps {
  open: boolean;
  installing?: boolean;
  onInstall: () => void;
  onLater: () => void;
}

/** Feuille d'installation Android et ordinateur (M6 §5.3). */
export function InstallSheet({ open, installing = false, onInstall, onLater }: InstallSheetProps) {
  const reducedMotion = useReducedMotionPref();

  return (
    <Sheet open={open} onClose={onLater} title="Installer l’application">
      <div className="pb-2">
        <div className="flex items-center gap-4">
          <m.div
            initial={reducedMotion ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...spring.bounce, delay: staggerStep }}
          >
            <AppIconTile />
          </m.div>
          <div className="min-w-0">
            <p className="text-h3 font-bold text-ink">DR Choco L’Incompris</p>
            {/* HYPOTHÈSE: « moins de 1 Mo » = téléchargement de l'application enregistrée sur le téléphone
                (environ 535 Ko compressés au build pwa d'octobre 2026, 1,4 Mo une fois décompressée). */}
            <p className="mt-0.5 text-small text-text-2">Gratuit · moins de 1 Mo</p>
          </div>
        </div>

        <m.ul
          variants={benefitsList}
          initial={reducedMotion ? false : 'hidden'}
          animate="visible"
          className="mt-5 space-y-2.5"
        >
          {BENEFITS.map(({ icon: Icon, label }) => (
            <m.li key={label} variants={benefitItem} className="flex items-center gap-3 text-small text-ink">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-surface text-ink">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>{label}</span>
            </m.li>
          ))}
        </m.ul>

        <div
          role="group"
          aria-label="Aperçu de l’application"
          className="-mx-5 mt-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 lg:-mx-6 lg:px-6"
        >
          {PREVIEWS.map((preview) => (
            <ScreenshotPreview key={preview.src} src={preview.src} label={preview.label} />
          ))}
        </div>

        <Button variant="primary" size="lg" fullWidth className="mt-5" loading={installing} onClick={onInstall}>
          Installer
        </Button>
        <button
          type="button"
          onClick={onLater}
          className="mt-2 flex min-h-11 w-full items-center justify-center text-small font-semibold text-text-2 underline underline-offset-4 [@media(hover:hover)]:hover:text-ink"
        >
          Plus tard
        </button>
      </div>
    </Sheet>
  );
}
