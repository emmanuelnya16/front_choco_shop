import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePublicSettings } from '@/features/catalog/api/useCatalogQueries';
import { api, ApiError } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { qk } from '@/lib/api/queryKeys';
import { useReservationStore } from '@/stores/reservationStore';
import type {
  CancelReservationResponse,
  UploadProofResponse,
} from '@/types/api';
import type { PaymentSettings, Reservation } from '@/types/domain';
import {
  addReservationItemsWithoutCheck,
  restoreReservationItemsToCart,
  type RestoreReservationResult,
} from '@/features/cart/restoreReservationItems';
import { resolveShopWhatsapp } from '@/features/payment/whatsapp';
import { loadStoredPaymentSettings, saveStoredPaymentSettings } from './paymentSettingsStorage';

/**
 * État des paramètres de paiement affichables :
 * - `ready` : paramètres réels (reçus de l'API ou mémorisés sur le téléphone) ;
 * - `loading` : premier chargement en cours, rien de mémorisé ;
 * - `unavailable` : échec ou hors connexion sans paramètres mémorisés.
 */
export type PaymentSettingsStatus = 'ready' | 'loading' | 'unavailable';

/**
 * Paramètres de paiement issus de `GET /settings/public` (§3.1 & §3.4).
 * Hors connexion, les derniers paramètres reçus (conservés sur le téléphone) sont utilisés (M6 §6.3).
 * Aucune valeur fictive côté app (M7) : sans paramètres reçus ni mémorisés, `payment` vaut `null`
 * et l'écran de paiement affiche un état de chargement puis « Paiement momentanément indisponible ».
 */
export function usePaymentSettings() {
  const query = usePublicSettings();
  const [stored] = useState(loadStoredPaymentSettings);

  const freshPayment = query.data?.payment;
  const freshWhatsapp = query.data?.whatsappNumber;
  useEffect(() => {
    if (freshPayment) saveStoredPaymentSettings(freshPayment, freshWhatsapp);
  }, [freshPayment, freshWhatsapp]);

  const payment: PaymentSettings | null = freshPayment ?? stored?.payment ?? null;
  const settingsStatus: PaymentSettingsStatus = payment
    ? 'ready'
    : query.isLoading
      ? 'loading'
      : 'unavailable';

  return {
    ...query,
    payment,
    settingsStatus,
    /** Numéro WhatsApp de la boutique, ou `undefined` s'il est inconnu (boutons masqués). */
    whatsappNumber: resolveShopWhatsapp(freshWhatsapp, stored?.whatsappNumber),
  };
}

export interface UploadProofInput {
  file: Blob;
  fileName?: string;
  sha256: string;
  operator: 'orange' | 'mtn';
  payerPhone?: string;
  transactionId?: string;
}

/**
 * Envoi de la preuve de paiement avec progression XHR, annulation et reprise (§3.4 & §5.3).
 */
export function useUploadProof(ref: string | undefined) {
  const normalizedRef = (ref ?? '').trim().toUpperCase();
  const queryClient = useQueryClient();
  const clearActiveReservation = useReservationStore(
    (s) => s.clearActiveReservation,
  );
  const activeReservation = useReservationStore((s) => s.activeReservation);

  const [progress, setProgress] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setProgress(0);
  }, []);

  const mutation = useMutation({
    mutationFn: async (input: UploadProofInput) => {
      if (!normalizedRef) {
        throw new ApiError(400, 'MISSING_REF', 'Référence de réservation manquante.');
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setProgress(5);

      const formData = new FormData();
      formData.append(
        'file',
        input.file,
        input.fileName ?? `preuve-${normalizedRef.toLowerCase()}.jpg`,
      );
      formData.append('sha256', input.sha256);
      formData.append('operator', input.operator);
      if (input.payerPhone?.trim()) {
        formData.append('payerPhone', input.payerPhone.trim());
      }
      if (input.transactionId?.trim()) {
        formData.append('transactionId', input.transactionId.trim());
      }

      try {
        const res = await api.upload<UploadProofResponse>(
          endpoints.reservations.proof(normalizedRef),
          formData,
          {
            signal: controller.signal,
            onProgress: (pct) => {
              setProgress(Math.max(5, Math.min(99, pct)));
            },
          },
        );
        setProgress(100);
        return res;
      } finally {
        abortControllerRef.current = null;
      }
    },
    onSuccess: (response) => {
      if (response.reservation) {
        queryClient.setQueryData<Reservation>(
          qk.reservation(normalizedRef),
          response.reservation,
        );
      } else {
        queryClient.setQueryData<Reservation | undefined>(
          qk.reservation(normalizedRef),
          (old) =>
            old
              ? {
                  ...old,
                  status: 'pending_validation',
                  proof: response.proof,
                  rejection: undefined,
                  rejectionReason: undefined,
                }
              : undefined,
        );
      }

      if (
        activeReservation &&
        activeReservation.ref.toUpperCase() === normalizedRef
      ) {
        clearActiveReservation();
      }

      void queryClient.invalidateQueries({ queryKey: qk.pendingReservations() });
      void queryClient.invalidateQueries({ queryKey: qk.reservations() });
    },
  });

  return {
    ...mutation,
    progress,
    cancelUpload,
  };
}

/**
 * Annulation de la réservation par le client et remise des articles dans le panier (§3.4 & §4.1).
 */
export function useCancelReservation(ref: string | undefined) {
  const normalizedRef = (ref ?? '').trim().toUpperCase();
  const queryClient = useQueryClient();
  const clearActiveReservation = useReservationStore(
    (s) => s.clearActiveReservation,
  );

  return useMutation({
    mutationFn: async (reservationToRestore?: Reservation | null) => {
      const res = await api.post<CancelReservationResponse>(
        endpoints.reservations.cancel(normalizedRef),
      );
      const itemsToRestore = reservationToRestore?.items ?? res.reservation?.items ?? [];
      // Remise au panier commune (« Refaire ma réservation », « Réserver à nouveau ») : stock vérifié,
      // couleur réelle (colorCode / colorHex) ; hors connexion, tout est remis et le panier revérifiera.
      let restored: RestoreReservationResult;
      try {
        restored = await restoreReservationItemsToCart(itemsToRestore);
      } catch {
        addReservationItemsWithoutCheck(itemsToRestore);
        restored = { added: itemsToRestore.length, unavailable: 0 };
      }
      return { response: res, restored };
    },
    onSuccess: ({ response }) => {
      clearActiveReservation();
      if (response.reservation) {
        queryClient.setQueryData(
          qk.reservation(normalizedRef),
          response.reservation,
        );
      }
      void queryClient.invalidateQueries({ queryKey: qk.pendingReservations() });
      void queryClient.invalidateQueries({ queryKey: qk.reservations() });
    },
  });
}
