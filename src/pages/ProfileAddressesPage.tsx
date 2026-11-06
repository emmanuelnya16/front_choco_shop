import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { AlertCircle, MapPin, MoreHorizontal, Pencil, Plus, Star, Trash2, Truck, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Primitives';
import { Sheet } from '@/components/ui/Sheet';
import { isNetworkError } from '@/features/offline/networkErrors';
import { OfflineScreen } from '@/features/offline/OfflineScreen';
import { useDeleteAddress, useSetDefaultAddress } from '@/features/profile/api/useAddressMutations';
import { AddressSheet } from '@/features/profile/components/AddressSheet';
import { ProfileShell } from '@/features/profile/components/ProfileShell';
import { useAddresses } from '@/features/reservation/api/useReservationQueries';
import { formatCmPhone } from '@/lib/utils/phone';
import { useDocumentTitle } from '@/lib/utils/useDocumentTitle';
import { duration, ease, spring } from '@/motion/tokens';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useUiStore } from '@/stores/uiStore';
import type { Address } from '@/types/domain';

const UNDO_DELAY_MS = 5000;

export function ProfileAddressesPage() {
  useDocumentTitle('Mes adresses');
  const status = useAuthStore((s) => s.status);
  const openAuthSheet = useUiStore((s) => s.openAuthSheet);

  return (
    <ProfileShell>
      <div className="px-page pt-6 lg:px-0 lg:pt-0">
        <BackButton fallback="/profil" label="Profil" className="lg:hidden" />
        <h1 className="mt-2 text-h1 text-ink lg:mt-0">Mes adresses</h1>
        {status === 'authenticated' ? (
          <AddressesContent />
        ) : (
          <div className="mt-6">
            <p className="text-body text-text-2">Connectez-vous pour retrouver vos adresses.</p>
            <Button variant="primary" size="lg" className="mt-5" onClick={() => openAuthSheet()}>
              Me connecter
            </Button>
          </div>
        )}
      </div>
    </ProfileShell>
  );
}

function AddressesContent() {
  const addressesQuery = useAddresses();
  const { data: addresses = [], isPending } = addressesQuery;
  const setDefault = useSetDefaultAddress();
  const deleteAddress = useDeleteAddress();
  const showToast = useToastStore((s) => s.show);
  const dismissToast = useToastStore((s) => s.dismiss);

  const [sheet, setSheet] = useState<{ open: boolean; address: Address | null }>({ open: false, address: null });
  const [menuFor, setMenuFor] = useState<Address | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Address | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const timersRef = useRef(new Map<string, number>());
  const toastIdsRef = useRef(new Map<string, string>());

  // Quitter la page valide tout de suite les suppressions encore annulables
  useEffect(() => {
    const timers = timersRef.current;
    const toastIds = toastIdsRef.current;
    return () => {
      timers.forEach((timer, id) => {
        window.clearTimeout(timer);
        // Plus d'« Annuler » possible une fois la page quittée : on retire le message
        const toastId = toastIds.get(id);
        if (toastId) useToastStore.getState().dismiss(toastId);
        deleteAddress.mutate(id);
      });
      timers.clear();
      toastIds.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = addresses.filter((a) => !hiddenIds.includes(a.id));

  const scheduleDelete = (address: Address) => {
    setConfirmDelete(null);
    setHiddenIds((ids) => [...ids, address.id]);
    const timer = window.setTimeout(() => {
      timersRef.current.delete(address.id);
      toastIdsRef.current.delete(address.id);
      deleteAddress.mutate(address.id, {
        onSettled: () => setHiddenIds((ids) => ids.filter((id) => id !== address.id)),
      });
    }, UNDO_DELAY_MS);
    timersRef.current.set(address.id, timer);

    const toastId = showToast({
      message: `Adresse «\u00A0${address.label}\u00A0» supprimée`,
      actionLabel: 'Annuler',
      durationMs: UNDO_DELAY_MS,
      onAction: () => {
        window.clearTimeout(timersRef.current.get(address.id));
        timersRef.current.delete(address.id);
        toastIdsRef.current.delete(address.id);
        setHiddenIds((ids) => ids.filter((id) => id !== address.id));
        dismissToast(toastId);
      },
    });
    toastIdsRef.current.set(address.id, toastId);
  };

  if (isPending) {
    return (
      <div className="mt-6 space-y-3" aria-hidden="true">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-13 w-52" />
      </div>
    );
  }

  // Adresses jamais chargées sur ce téléphone : réseau absent ou erreur (pas d'état « vide » trompeur)
  if (addressesQuery.isError && !addressesQuery.data) {
    if (isNetworkError(addressesQuery.error)) {
      return <OfflineScreen headingLevel="h2" onRetry={() => addressesQuery.refetch()} className="mt-6 py-4" />;
    }
    return (
      <div className="mt-6 flex flex-col items-center rounded-[var(--radius-md)] bg-surface px-6 py-10 text-center">
        <AlertCircle className="h-6 w-6 text-red" aria-hidden="true" />
        <p className="mt-3 text-body font-semibold text-ink">Impossible de charger vos adresses.</p>
        <p className="mt-1 text-small text-text-2">
          Un problème est survenu de notre côté. Réessayez dans quelques instants.
        </p>
        <Button variant="dark" size="md" className="mt-5" onClick={() => void addressesQuery.refetch()}>
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {visible.length === 0 ? (
        <div className="flex flex-col items-center rounded-[var(--radius-md)] bg-surface px-5 py-8 text-center">
          <MapPin className="h-6 w-6 text-text-2" aria-hidden="true" />
          <p className="mt-3 text-body font-semibold text-ink">Aucune adresse enregistrée</p>
          <p className="mt-1 max-w-sm text-small text-text-2">
            Ajoutez-en une ici ou lors de votre prochaine réservation&nbsp;: elle vous sera proposée
            automatiquement.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {visible.map((address) => (
              <m.li
                key={address.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: duration.fast, ease: ease.out } }}
                transition={{ layout: spring.sheet, duration: duration.base, ease: ease.out }}
              >
                <AddressCard address={address} onOpenMenu={() => setMenuFor(address)} />
              </m.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <Button
        variant="dark"
        size="lg"
        className="mt-5"
        iconLeft={<Plus className="h-4 w-4" />}
        onClick={() => setSheet({ open: true, address: null })}
      >
        Ajouter une adresse
      </Button>

      {/* Menu « ⋯ » d'une adresse */}
      <Sheet open={Boolean(menuFor)} onClose={() => setMenuFor(null)} title={menuFor ? `Adresse «\u00A0${menuFor.label}\u00A0»` : 'Adresse'}>
        {menuFor && (
          <ul className="-mx-1 divide-y divide-silver/60">
            <li>
              <button
                type="button"
                onClick={() => {
                  setSheet({ open: true, address: menuFor });
                  setMenuFor(null);
                }}
                className="flex min-h-14 w-full items-center gap-3 px-1 text-left text-body text-ink"
              >
                <Pencil className="h-5 w-5 text-text-2" aria-hidden="true" />
                Modifier
              </button>
            </li>
            {!menuFor.isDefault && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setDefault.mutate(menuFor.id, {
                      onSuccess: () =>
                        showToast({ message: `«\u00A0${menuFor.label}\u00A0» est votre adresse par défaut` }),
                    });
                    setMenuFor(null);
                  }}
                  className="flex min-h-14 w-full items-center gap-3 px-1 text-left text-body text-ink"
                >
                  <Star className="h-5 w-5 text-text-2" aria-hidden="true" />
                  Définir par défaut
                </button>
              </li>
            )}
            <li>
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(menuFor);
                  setMenuFor(null);
                }}
                className="flex min-h-14 w-full items-center gap-3 px-1 text-left text-body text-ink"
              >
                <Trash2 className="h-5 w-5 text-red" aria-hidden="true" />
                Supprimer
              </button>
            </li>
          </ul>
        )}
      </Sheet>

      {/* Confirmation de suppression */}
      <Sheet
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title={
          confirmDelete
            ? `Supprimer «\u00A0${confirmDelete.label}\u00A0»\u00A0?`
            : 'Supprimer l’adresse\u00A0?'
        }
      >
        <p className="text-body text-text-2">
          Elle ne sera plus proposée lors de vos prochaines réservations.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Button variant="danger" size="lg" fullWidth onClick={() => confirmDelete && scheduleDelete(confirmDelete)}>
            Supprimer
          </Button>
          <Button variant="outline" size="lg" fullWidth onClick={() => setConfirmDelete(null)}>
            Garder l’adresse
          </Button>
        </div>
      </Sheet>

      <AddressSheet
        open={sheet.open}
        address={sheet.address}
        onClose={() => setSheet({ open: false, address: null })}
        onSaved={(_saved, mode) => {
          setSheet({ open: false, address: null });
          showToast({ message: mode === 'created' ? 'Adresse ajoutée' : 'Adresse modifiée' });
        }}
      />
    </div>
  );
}

function AddressCard({ address, onOpenMenu }: { address: Address; onOpenMenu: () => void }) {
  const isAgency = Boolean(address.agencyId);

  return (
    <article className="relative rounded-[var(--radius-md)] border border-silver/70 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-h3 text-ink">{address.label}</h2>
          {address.isDefault && (
            <m.span
              layoutId="default-address-tag"
              transition={spring.snappy}
              className="inline-flex h-6 items-center rounded-[var(--radius-full)] bg-ink px-2.5 text-label text-white"
            >
              Par défaut
            </m.span>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label={`Actions pour l’adresse ${address.label}`}
          className="-mt-2 -mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-full)] text-ink hover:bg-surface"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-2 space-y-1.5 text-small text-text-2">
        {isAgency ? (
          <>
            <p className="flex items-start gap-2">
              <Truck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-semibold text-ink">{address.city}</span> · {address.landmark}
              </span>
            </p>
            {address.recipientName && (
              <p className="flex items-start gap-2">
                <User className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Destinataire&nbsp;: {address.recipientName}
                  {address.recipientPhone ? ` · ${formatCmPhone(address.recipientPhone)}` : ''}
                </span>
              </p>
            )}
          </>
        ) : (
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-semibold text-ink">{address.city}</span>
              {address.district || address.quarter ? `, ${address.district || address.quarter}` : ''}
              {address.landmark ? ` — ${address.landmark}` : ''}
            </span>
          </p>
        )}
      </div>
    </article>
  );
}
