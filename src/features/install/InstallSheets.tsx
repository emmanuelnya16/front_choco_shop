import { InstallHelpSheet } from './InstallHelpSheet';
import { InstallSheet } from './InstallSheet';
import { IosInstallSheet } from './IosInstallSheet';
import type { InstallController } from './useInstallController';

/** Feuilles d'installation pilotées par un contrôleur (une seule ouverte à la fois). */
export function InstallSheets({ controller }: { controller: InstallController }) {
  const { sheet, installing, install, dismiss, acknowledge } = controller;

  return (
    <>
      <InstallSheet
        open={sheet === 'install'}
        installing={installing}
        onInstall={() => void install()}
        onLater={dismiss}
      />
      <IosInstallSheet open={sheet === 'ios'} onDone={acknowledge} onClose={dismiss} />
      <InstallHelpSheet open={sheet === 'help'} onClose={acknowledge} />
    </>
  );
}
