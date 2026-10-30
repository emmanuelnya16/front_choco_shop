import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { usePublicSettings } from '@/features/catalog/api/useCatalogQueries';
import { api, ApiError } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { qk } from '@/lib/api/queryKeys';
import { useCartStore } from '@/stores/cartStore';
import { useReservationStore } from '@/stores/reservationStore';
import type {
  CancelReservationResponse,
  UploadProofResponse,
} from '@/types/api';
import type { PaymentSettings, Reservation } from '@/types/domain';

const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  operators: [
    {
      id: 'orange',
      label: 'Orange Money',
      merchantName: 'ETS DR CHOCO LINCOMPRIS',
      merchantCode: '000111', // FICTIF
      ussdTemplate: '#000*1*{code}*{amount}#', // FICTIF
      qrImageUrl: '/mock/qr-orange.svg',
      steps: [
        'Appuyez sur « Composer le code de paiement » ou ouvrez Orange Money.',
        'Vérifiez que le destinataire affiché est bien « ETS DR CHOCO LINCOMPRIS » (code 000111).',
        'Confirmez le montant exact avec votre code secret Orange Money.',
      ],
      enabled: true,
    },
    {
      id: 'mtn',
      label: 'MTN MoMo',
      merchantName: 'DR CHOCO BOUTIQUE SARL',
      merchantCode: '000222', // FICTIF
      ussdTemplate: '*000*2*{code}*{amount}#', // FICTIF
      qrImageUrl: '/mock/qr-mtn.svg',
      steps: [
        'Appuyez sur « Composer le code de paiement » ou ouvrez l’application MTN MoMo.',
        'Vérifiez que le nom du marchand est « DR CHOCO BOUTIQUE SARL » (code 000222).',
        'Validez le montant exact avec votre code PIN MTN Mobile Money.',
      ],
      enabled: true,
    },
  ],
  exactAmountRequired: true,
  validationDelayText: "en général en moins d'une heure, de 8 h à 20 h",
  proofMaxSizeMb: 10,
};

/**
 * Paramètres de paiement issus de `GET /settings/public` (§3.1 & §3.4).
 */
export function usePaymentSettings() {
  const query = usePublicSettings();
  const payment: PaymentSettings =
    query.data?.payment ?? DEFAULT_PAYMENT_SETTINGS;

  return {
    ...query,
    payment,
    whatsappNumber: query.data?.whatsappNumber ?? '+237690000000',
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
      return {
        response: res,
        itemsToRestore:
          reservationToRestore?.items ?? res.reservation?.items ?? [],
      };
    },
    onSuccess: ({ response, itemsToRestore }) => {
      const cartStore = useCartStore.getState();
      for (const item of itemsToRestore) {
        cartStore.add({
          productId: item.productId,
          slug: item.slug,
          name: item.name,
          image: item.image,
          variantId: item.variantId,
          size: item.size,
          color: {
            code: item.colorName.toLowerCase().replace(/\s+/g, '-'),
            name: item.colorName,
            hex: '#0A0A0A',
          },
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          maxQuantity: Math.max(5, item.quantity),
        });
      }

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
