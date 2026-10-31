import { Laptop, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { isInAppBrowser } from '@/pwa/installService';

export interface InstallHelpSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Courte explication quand le navigateur ne propose pas l'installation directe (Firefox, navigateur
 * intégré à une application, fenêtre du navigateur déjà refusée pendant cette visite).
 */
export function InstallHelpSheet({ open, onClose }: InstallHelpSheetProps) {
  const [inApp] = useState(() => isInAppBrowser());

  return (
    <Sheet open={open} onClose={onClose} title="Installer l’application">
      <div className="pb-2">
        {inApp ? (
          <p className="text-body text-text-2">
            Ouvrez d’abord cette page dans Chrome ou Safari (menu de l’application, puis «&nbsp;Ouvrir dans le
            navigateur&nbsp;»), puis installez DR Choco depuis le menu du navigateur.
          </p>
        ) : (
          <>
            <p className="text-body text-text-2">
              Votre navigateur ne propose pas l’installation directe pour le moment. Vous pouvez l’ajouter
              vous-même :
            </p>
            <ul className="mt-4 space-y-3">
              <li className="flex items-start gap-3 text-small text-ink">
                <Smartphone className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <span>
                  Sur téléphone : ouvrez le menu <strong className="font-bold">⋮</strong> du navigateur,
                  puis «&nbsp;Installer l’application&nbsp;» ou «&nbsp;Ajouter à l’écran d’accueil&nbsp;».
                </span>
              </li>
              <li className="flex items-start gap-3 text-small text-ink">
                <Laptop className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <span>Sur ordinateur : cliquez sur l’icône d’installation à droite de la barre d’adresse de Chrome ou d’Edge.</span>
              </li>
            </ul>
          </>
        )}
        <Button variant="dark" size="lg" fullWidth className="mt-6" onClick={onClose}>
          J’ai compris
        </Button>
      </div>
    </Sheet>
  );
}
