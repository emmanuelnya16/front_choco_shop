import { BellRing, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import {
  disableNotifications,
  enableNotifications,
  refreshPushStatus,
} from '@/features/notifications/pushService';
import {
  NOTIFICATIONS_STATE_LABELS,
  useNotificationsDisplayState,
  type NotificationsDisplayState,
} from '@/features/profile/notifications';

export interface NotificationsSheetProps {
  open: boolean;
  onClose: () => void;
  onStateChange?: (state: NotificationsDisplayState) => void;
}

const ACTIVATION_ERROR =
  'Impossible d’activer les notifications pour le moment. Vérifiez votre connexion, puis réessayez.';

/** Feuille « Notifications » du profil (§7.5 M5) : état réel de l'abonnement (§7.1 M6). */
export function NotificationsSheet({ open, onClose, onStateChange }: NotificationsSheetProps) {
  const state = useNotificationsDisplayState();
  const [pending, setPending] = useState<'activate' | 'deactivate' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // La ligne « Notifications » du profil suit l'état réel (permission et abonnement)
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  // À l'ouverture : permission ou abonnement ont pu changer depuis les réglages du téléphone
  useEffect(() => {
    if (open) void refreshPushStatus();
  }, [open]);

  const activate = async () => {
    setPending('activate');
    setError(null);
    const result = await enableNotifications();
    setPending(null);
    if (result === 'failed') setError(ACTIVATION_ERROR);
  };

  const deactivate = async () => {
    setPending('deactivate');
    setError(null);
    await disableNotifications();
    setPending(null);
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
        <Button
          variant="primary"
          size="lg"
          fullWidth
          className="mt-5"
          loading={pending === 'activate'}
          disabled={pending !== null}
          onClick={() => void activate()}
        >
          Activer
        </Button>
      )}

      {state === 'enabled' && (
        <>
          <p className="mt-4 text-small text-text-2">Vous recevrez nos alertes sur ce téléphone.</p>
          <Button
            variant="outline"
            size="lg"
            fullWidth
            className="mt-4"
            loading={pending === 'deactivate'}
            disabled={pending !== null}
            onClick={() => void deactivate()}
          >
            Désactiver
          </Button>
        </>
      )}

      {error && state === 'disabled' && (
        <p role="alert" className="mt-3 text-small text-danger">
          {error}
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
            <li>Ouvrez «&nbsp;Autorisations&nbsp;».</li>
            <li>Choisissez «&nbsp;Notifications&nbsp;», puis «&nbsp;Autoriser&nbsp;».</li>
          </ol>
        </div>
      )}

      {state === 'ios-install' && (
        <p className="mt-4 text-small text-text-2">
          Installez d’abord l’application sur votre écran d’accueil&nbsp;: touchez le bouton Partager de
          Safari, puis «&nbsp;Sur l’écran d’accueil&nbsp;».
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
