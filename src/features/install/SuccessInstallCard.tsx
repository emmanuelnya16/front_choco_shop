import { Download } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { getIosInstallContext, promptInstall } from '@/pwa/installService';
import { useInstallStore } from '@/pwa/installStore';
import { track } from '@/pwa/track';
import { AppIconTile } from './AppIconTile';
import { InstallSheets } from './InstallSheets';
import { useInstallController } from './useInstallController';

/**
 * Carte « Suivez votre réservation depuis votre écran d’accueil » de la page Merci (M6 §5.2), affichée
 * seulement après la toute première preuve de paiement (voir useSuccessInstallOffer) :
 * - Android et ordinateur : en plus de la carte des notifications, « Installer » ouvre la fenêtre du navigateur ;
 * - iPhone sans l'application : à la place de la carte des notifications, « Voir comment installer »
 *   ouvre les instructions d'ajout à l'écran d'accueil.
 */
export function SuccessInstallCard() {
  const controller = useInstallController('success');
  const { state } = controller;
  const [supportsPush] = useState(() => getIosInstallContext().supportsPush);
  const [closed, setClosed] = useState(false);
  const [installing, setInstalling] = useState(false);
  const shownRef = useRef(false);

  const isIos = state === 'ios';
  const visible = !closed && (state === 'available' || isIos);

  useEffect(() => {
    if (!visible || shownRef.current) return;
    shownRef.current = true;
    useInstallStore.getState().markShown('success');
    track('install_prompt_shown', { surface: 'success', kind: isIos ? 'ios-card' : 'card' });
  }, [visible, isIos]);

  const handleInstall = async () => {
    // iPhone : l'ajout se fait par le menu Partager, la feuille explique comment
    if (isIos) {
      controller.open();
      return;
    }
    setInstalling(true);
    const outcome = await promptInstall('success');
    setInstalling(false);
    if (outcome !== 'unavailable') setClosed(true);
  };

  const handleLater = () => {
    useInstallStore.getState().markDismissed();
    track('install_prompt_dismissed', { surface: 'success', kind: isIos ? 'ios-card' : 'card', via: 'later' });
    setClosed(true);
  };

  return (
    <>
      {visible && (
        <section
          data-gsap="actions"
          aria-label="Installer l’application"
          className="mt-6 rounded-[var(--radius-md)] border border-silver/60 bg-surface p-4"
        >
          <div className="flex items-start gap-3">
            <AppIconTile className="h-10 w-10 rounded-[var(--radius-md)] shadow-none" />
            <div className="flex-1">
              <h2 className="text-small font-bold text-ink">Suivez votre réservation depuis votre écran d’accueil</h2>
              <p className="mt-1 text-small text-text-2">
                {isIos
                  ? supportsPush
                    ? 'Ajoutez DR Choco à votre écran d’accueil\u00A0: votre réservation s’ouvre en un appui, et vous pourrez recevoir ses notifications.'
                    : 'Ajoutez DR Choco à votre écran d’accueil\u00A0: votre réservation s’ouvre en un appui.'
                  : 'Installez DR Choco\u00A0: votre réservation s’ouvre en un appui, même avec peu de réseau.'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {isIos ? (
                  <button
                    type="button"
                    onClick={() => void handleInstall()}
                    className="inline-flex min-h-11 items-center text-small font-bold text-ink underline underline-offset-4 hover:text-red"
                  >
                    Voir comment installer
                  </button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    loading={installing}
                    iconLeft={<Download className="h-4 w-4" aria-hidden="true" />}
                    onClick={() => void handleInstall()}
                  >
                    Installer
                  </Button>
                )}
                <button
                  type="button"
                  onClick={handleLater}
                  className="min-h-11 px-2 text-small font-semibold text-text-2 underline underline-offset-4 hover:text-ink"
                >
                  Plus tard
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
      <InstallSheets controller={controller} />
    </>
  );
}
