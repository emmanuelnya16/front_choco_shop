import { ArrowDown, ArrowUp, Bell } from 'lucide-react';
import * as m from 'motion/react-m';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { cn } from '@/lib/utils/cn';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { getIosInstallContext, type IosInstallContext } from '@/pwa/installService';
import { AppIconTile } from './AppIconTile';

/** Icône Partager d'iOS : carré ouvert surmonté d'une flèche vers le haut. */
function IosShareIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M8.5 9.5H7a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7.5a2 2 0 0 0-2-2h-1.5" />
      <path d="M12 15V3" />
      <path d="M8.5 6.5 12 3l3.5 3.5" />
    </svg>
  );
}

/** Icône « Sur l'écran d'accueil » du menu de partage d'iOS : carré arrondi avec un plus. */
function IosAddToHomeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

function Step({ index, title, children }: { index: number; title: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-full)] bg-ink text-small font-bold text-white"
      >
        {index}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-body text-ink">{title}</p>
        {children}
      </div>
    </li>
  );
}

/** Où trouver Partager selon le navigateur et l'appareil (espaces insécables dans les guillemets). */
function shareHint({ browser, shareLocation }: IosInstallContext): string {
  if (browser === 'chrome') return 'En haut à droite, dans la barre d’adresse de Chrome.';
  if (browser === 'other') return 'Dans le menu de votre navigateur.';
  if (shareLocation === 'top') return 'En haut à droite de l’écran dans Safari.';
  // HYPOTHÈSE: avec la barre d'onglets compacte (iOS 26), Partager se trouve dans le menu « ··· ».
  return 'En bas de l’écran dans Safari (ou dans le menu « ··· »).';
}

/** Petite flèche qui monte et descend doucement vers le bouton Partager du navigateur. */
function ShareArrow({ direction, label }: { direction: 'up' | 'down'; label: string }) {
  const reducedMotion = useReducedMotionPref();
  const Icon = direction === 'down' ? ArrowDown : ArrowUp;
  const travel = direction === 'down' ? 6 : -6;

  return (
    <div className={cn('flex flex-col items-center gap-1 text-text-2', direction === 'down' ? 'mt-4' : 'mb-4')}>
      {direction === 'down' && <span className="text-xs">{label}</span>}
      <m.span
        aria-hidden="true"
        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-full)] bg-surface text-ink"
        // Pas d'initial={false} : il figerait la boucle sur sa dernière image au montage
        initial={{ y: 0 }}
        animate={reducedMotion ? { y: 0 } : { y: [0, travel, 0] }}
        transition={reducedMotion ? { duration: 0 } : { duration: 1.4, ease: 'easeInOut', repeat: Infinity }}
      >
        <Icon className="h-4 w-4" />
      </m.span>
      {direction === 'up' && <span className="text-xs">{label}</span>}
    </div>
  );
}

export interface IosInstallSheetProps {
  open: boolean;
  /** « J'ai compris ». */
  onDone: () => void;
  /** Croix, fond ou glissement : « Plus tard ». */
  onClose: () => void;
}

/** Feuille d'installation iPhone et iPad : ajout manuel par le menu Partager (M6 §5.4). */
export function IosInstallSheet({ open, onDone, onClose }: IosInstallSheetProps) {
  const [context] = useState(() => getIosInstallContext());
  const arrowLabel =
    context.shareLocation === 'bottom' ? 'Le bouton Partager est juste en dessous' : 'Le bouton Partager est en haut';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={context.device === 'ipad' ? 'Installer sur votre iPad' : 'Installer sur votre iPhone'}
      className="max-h-[92dvh] overflow-y-auto"
    >
      <div className="pb-2">
        {context.shareLocation === 'top' && <ShareArrow direction="up" label={arrowLabel} />}

        <div className="flex items-center gap-3.5">
          <AppIconTile className="h-12 w-12 rounded-xl" />
          <p className="text-small text-text-2">
            Ajoutez DR Choco à votre écran d’accueil : il s’ouvrira comme une application, en plein écran.
          </p>
        </div>

        <ol className="mt-5 space-y-4" aria-label="Étapes d’installation">
          <Step
            index={1}
            title={
              <>
                Appuyez sur <strong className="font-bold">Partager</strong>
                <span className="ml-2 inline-flex h-7 w-7 translate-y-1.5 items-center justify-center rounded-[var(--radius-sm)] border border-silver bg-white text-ink">
                  <IosShareIcon className="h-[18px] w-[18px]" />
                </span>
              </>
            }
          >
            <p className="mt-1 text-small text-text-2">{shareHint(context)}</p>
          </Step>

          <Step
            index={2}
            title={
              <>
                Faites défiler et choisissez <strong className="font-bold">Sur l’écran d’accueil</strong>
              </>
            }
          >
            {/* Maquette de la ligne du menu de partage */}
            <div
              aria-hidden="true"
              className="mt-2 flex items-center justify-between rounded-[var(--radius-md)] border border-silver/70 bg-surface px-3.5 py-2.5"
            >
              <span className="text-small text-ink">Sur l’écran d’accueil</span>
              <IosAddToHomeIcon className="h-5 w-5 text-ink" />
            </div>
          </Step>

          <Step
            index={3}
            title={
              <>
                Appuyez sur <strong className="font-bold">Ajouter</strong>
              </>
            }
          >
            <div
              aria-hidden="true"
              className="mt-2 flex items-center justify-between rounded-[var(--radius-md)] border border-silver/70 bg-surface px-3.5 py-2.5 text-small"
            >
              <span className="text-text-2">Annuler</span>
              <span className="font-semibold text-ink">DR Choco</span>
              <span className="font-bold text-red">Ajouter</span>
            </div>
          </Step>
        </ol>

        {context.supportsPush && (
          <p className="mt-5 flex items-start gap-2.5 rounded-[var(--radius-md)] bg-surface px-3.5 py-3 text-small text-ink">
            <Bell className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Une fois installée, vous pourrez recevoir les notifications de vos réservations.
          </p>
        )}

        <Button variant="dark" size="lg" fullWidth className="mt-5" onClick={onDone}>
          J’ai compris
        </Button>

        {context.shareLocation === 'bottom' && <ShareArrow direction="down" label={arrowLabel} />}
      </div>
    </Sheet>
  );
}
