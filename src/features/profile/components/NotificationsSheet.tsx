import { BellRing, Lock } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { pushService } from '@/features/notifications/pushService';
import {
  getNotificationsDisplayState,
  NOTIFICATIONS_STATE_LABELS,
  type NotificationsDisplayState,
} from '@/features/profile/notifications';

export interface NotificationsSheetProps {
  open: boolean;
  onClose: () => void;
  onStateChange?: (state: NotificationsDisplayState) => void;
}

/** Feuille « Notifications » du profil (§7.5 M5). L'abonnement réel arrive au module M6. */
export function NotificationsSheet({ open, onClose, onStateChange }: NotificationsSheetProps) {
  const [state, setState] = useState<NotificationsDisplayState>(() => getNotificationsDisplayState());
  const [requesting, setRequesting] = useState(false);

  const activate = async () => {
    setRequesting(true);
    try {
      await pushService.requestPermission();
    } finally {
      const next = getNotificationsDisplayState();
      setState(next);
      onStateChange?.(next);
      setRequesting(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Notifications">
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-red" aria-hidden="true" />
        <p className="text-body text-text-2">
          Soyez prévenu quand votre paiement est validé, quand votre colis est prêt et quand il est en
          route.
        </p>
      </div>

      <p className="mt-4 flex items-center justify-between rounded-[var(--radius-md)] bg-surface px-4 py-3 text-small">
        <span className="text-text-2">État actuel</span>
        <span className="font-semibold text-ink" role="status">
          {NOTIFICATIONS_STATE_LABELS[state]}
        </span>
      </p>

      {state === 'disabled' && (
        <Button variant="primary" size="lg" fullWidth className="mt-5" loading={requesting} onClick={() => void activate()}>
          Activer
        </Button>
      )}

      {state === 'enabled' && (
        <p className="mt-4 text-small text-text-2">
          Vous recevrez nos alertes sur ce téléphone. Pour les couper, utilisez les réglages de votre
          navigateur.
        </p>
      )}

      {state === 'blocked' && (
        <div className="mt-4 rounded-[var(--radius-md)] border border-silver/70 p-4">
          <p className="flex items-center gap-2 text-small font-semibold text-ink">
            <Lock className="h-4 w-4" aria-hidden="true" />
            Pour les réactiver sur Chrome Android
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-small text-text-2">
            <li>Touchez l’icône cadenas à gauche de l’adresse du site.</li>
            <li>Ouvrez « Autorisations ».</li>
            <li>Choisissez « Notifications », puis « Autoriser ».</li>
          </ol>
        </div>
      )}

      {state === 'ios-install' && (
        <p className="mt-4 text-small text-text-2">
          Installez d’abord l’application sur votre écran d’accueil : touchez le bouton Partager de
          Safari, puis « Sur l’écran d’accueil ».
        </p>
      )}

      {state === 'unsupported' && (
        <p className="mt-4 text-small text-text-2">
          Votre navigateur ne permet pas les notifications. Suivez vos réservations dans l’onglet
          Réservations.
        </p>
      )}
    </Sheet>
  );
}
