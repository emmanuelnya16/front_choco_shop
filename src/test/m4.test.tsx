import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LazyMotion } from 'motion/react';
import { setupServer } from 'msw/node';
import { createMemoryRouter, RouterProvider } from 'react-router';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { ReservationExpiredOverlay } from '@/features/payment/components/ReservationExpiredOverlay';
import {
  computeSha256Hex,
  computeTargetDimensions,
  prepareProof,
  ProofPreparationError,
} from '@/features/payment/proof/prepareProof';
import {
  buildUssdCode,
  buildUssdTelHref,
  formatRawAmountForClipboard,
  isIosDevice,
  resolveUssdActionMode,
} from '@/features/payment/utils/ussd';
import {
  buildWhatsAppPaymentMessage,
  buildWhatsAppPaymentUrl,
} from '@/features/payment/whatsapp';
import { api, ApiError } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { mockProducts } from '@/mocks/fixtures/products';
import { mockReservations } from '@/mocks/fixtures/reservations';
import { handlers, resetMockM3State } from '@/mocks/handlers';
import loadMotionFeatures from '@/motion/features';
import { SuccessPage } from '@/pages/SuccessPage';
import { useCartStore } from '@/stores/cartStore';
import { useReservationStore } from '@/stores/reservationStore';
import type { ReservationDetailResponse, UploadProofResponse } from '@/types/api';
import type { Reservation } from '@/types/domain';

const server = setupServer(...handlers);

beforeAll(() => {
  server.listen();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe('Module M4 — Paiement et Preuve', () => {
  beforeEach(() => {
    resetMockM3State();
    useCartStore.getState().clear();
    useReservationStore.getState().clearActiveReservation();
  });

  // 1. Construction du lien USSD
  describe('1. Construction du code et du lien USSD', () => {
    it('remplace {code} et {amount} sans espaces ni séparateurs et encode # en %23', () => {
      const ussd = buildUssdCode('#000*1*{code}*{amount}#', '000111', 63_000);
      expect(ussd).toBe('#000*1*000111*63000#');

      const telHref = buildUssdTelHref(ussd!);
      expect(telHref).toBe('tel:%23000*1*000111*63000%23');
      expect(telHref.endsWith('%23')).toBe(true);
      expect(telHref.includes('*')).toBe(true);

      const mtnUssd = buildUssdCode('*000*2*{code}*{amount}#', '000222', 45_500);
      expect(mtnUssd).toBe('*000*2*000222*45500#');
      expect(buildUssdTelHref(mtnUssd!)).toBe('tel:*000*2*000222*45500%23');

      expect(formatRawAmountForClipboard(63_000)).toBe('63000');
    });
  });

  // 2. Détection iOS et choix « Composer » / « Copier »
  describe('2. Détection iOS et choix du mode USSD (« dial » vs « copy »)', () => {
    it('détecte iPhone / iPadOS et bascule en mode « copy » au lieu de « dial »', () => {
      const androidUa =
        'Mozilla/5.0 (Linux; Android 13; SM-A546B) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36';
      const iphoneUa =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
      const ipadDesktopModeUa =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';

      expect(isIosDevice(androidUa, 'Linux armv8l', 5)).toBe(false);
      expect(resolveUssdActionMode(isIosDevice(androidUa, 'Linux armv8l', 5))).toBe('dial');

      expect(isIosDevice(iphoneUa, 'iPhone', 5)).toBe(true);
      expect(resolveUssdActionMode(isIosDevice(iphoneUa, 'iPhone', 5))).toBe('copy');

      expect(isIosDevice(ipadDesktopModeUa, 'MacIntel', 5)).toBe(true);
      expect(resolveUssdActionMode(isIosDevice(ipadDesktopModeUa, 'MacIntel', 5))).toBe('copy');
    });
  });

  // 3. prepareProof
  describe('3. Préparation de la preuve (prepareProof)', () => {
    it('refuse un fichier non image ou un fichier dépassant la taille maximale', async () => {
      const pdfFile = new File([new Uint8Array([1, 2, 3, 4])], 'recu.pdf', {
        type: 'application/pdf',
      });

      await expect(prepareProof(pdfFile, { maxSizeMb: 10 })).rejects.toThrow(
        ProofPreparationError,
      );
      await expect(prepareProof(pdfFile, { maxSizeMb: 10 })).rejects.toThrow(
        "Ce format n'est pas pris en charge. Faites une capture d'écran classique.",
      );

      // Fichier > 1 Mo avec limite fixée à 1 Mo
      const oversizedBytes = new Uint8Array(1.2 * 1024 * 1024);
      const hugeFile = new File([oversizedBytes], 'huge.png', { type: 'image/png' });

      await expect(prepareProof(hugeFile, { maxSizeMb: 1 })).rejects.toThrow(
        ProofPreparationError,
      );
      await expect(prepareProof(hugeFile, { maxSizeMb: 1 })).rejects.toThrow(/dépasse 1 Mo/);
    });

    it('calcule un redimensionnement à 1600 px maximum sur le plus grand côté', () => {
      expect(computeTargetDimensions(1080, 1440)).toEqual({
        width: 1080,
        height: 1440,
        resized: false,
      });

      const portrait = computeTargetDimensions(1800, 3600);
      expect(portrait.height).toBe(1600);
      expect(portrait.width).toBe(800);
      expect(portrait.resized).toBe(true);

      const landscape = computeTargetDimensions(3200, 1600);
      expect(landscape.width).toBe(1600);
      expect(landscape.height).toBe(800);
      expect(landscape.resized).toBe(true);
    });

    it('conserve tel quel un fichier léger (< 400 Ko) et produit une empreinte SHA-256 stable', async () => {
      const content = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 42, 99, 128]);
      const lightFile = new File([content], 'capture-om.png', { type: 'image/png' });

      const prepared1 = await prepareProof(lightFile, { maxSizeMb: 10 });
      const prepared2 = await prepareProof(lightFile, { maxSizeMb: 10 });

      expect(prepared1.wasCompressed).toBe(false);
      expect(prepared1.finalSizeBytes).toBe(lightFile.size);
      expect(prepared1.sha256).toHaveLength(64);
      expect(prepared1.sha256).toBe(prepared2.sha256);

      const directSha = await computeSha256Hex(lightFile);
      expect(prepared1.sha256).toBe(directSha);
    });
  });

  // 4. Message WhatsApp
  describe('4. Message WhatsApp prérempli', () => {
    it('inclut les informations complètes, limite à 4 articles (+ X autres), reste < 1000 caractères et encode emojis/accents', () => {
      const baseReservation = mockReservations['RES-000101']!;
      const sixItemsReservation: Reservation = {
        ...baseReservation,
        ref: 'RES-000124',
        total: 63_000,
        items: [
          ...baseReservation.items,
          {
            id: 'ri-extra-1',
            productId: 'prod-2',
            slug: 'tshirt-oversize-akwa',
            name: 'T-Shirt Oversize Akwa',
            size: 'M',
            colorName: 'Blanc Craie',
            quantity: 1,
            unitPrice: 18_000,
            variantId: 'var-extra-1',
            image: '/mock/prod-1.svg',
          },
          {
            id: 'ri-extra-2',
            productId: 'prod-3',
            slug: 'casquette-brodee-237',
            name: 'Casquette Brodée 237',
            size: 'Unique',
            colorName: 'Noir',
            quantity: 1,
            unitPrice: 12_000,
            variantId: 'var-extra-2',
            image: '/mock/prod-1.svg',
          },
          {
            id: 'ri-extra-3',
            productId: 'prod-4',
            slug: 'sacoche-cuir-bonanjo',
            name: 'Sacoche Cuir Bonanjo',
            size: 'Unique',
            colorName: 'Noir',
            quantity: 1,
            unitPrice: 25_000,
            variantId: 'var-extra-3',
            image: '/mock/prod-1.svg',
          },
          {
            id: 'ri-extra-4',
            productId: 'prod-5',
            slug: 'chaussettes-signature',
            name: 'Chaussettes Signature',
            size: '40-44',
            colorName: 'Noir',
            quantity: 2,
            unitPrice: 5_000,
            variantId: 'var-extra-4',
            image: '/mock/prod-1.svg',
          },
          {
            id: 'ri-extra-5',
            productId: 'prod-6',
            slug: 'bob-brode',
            name: 'Bob Brodé Douala',
            size: 'Unique',
            colorName: 'Noir',
            quantity: 1,
            unitPrice: 10_000,
            variantId: 'var-extra-5',
            image: '/mock/prod-1.svg',
          },
        ],
      };

      const message = buildWhatsAppPaymentMessage({
        reservation: sixItemsReservation,
        operatorLabel: 'Orange Money',
        origin: 'https://drchoco.cm',
      });

      expect(message).toContain('Bonjour DR Choco 👋');
      expect(message).toContain("Je viens d'envoyer ma preuve de paiement.");
      expect(message).toContain('Réservation : RES-000124');
      expect(message).toContain('autre');
      expect(message).toContain('(Orange Money)');
      expect(message).toContain('Fiche : https://drchoco.cm/admin/reservations/RES-000124');
      expect(message.length).toBeLessThan(1000);

      const url = buildWhatsAppPaymentUrl('+237690000000', {
        reservation: sixItemsReservation,
        operatorLabel: 'Orange Money',
        origin: 'https://drchoco.cm',
      });
      expect(url.startsWith('https://wa.me/237690000000?text=')).toBe(true);
      expect(url).toContain(encodeURIComponent('Bonjour DR Choco 👋'));
      expect(decodeURIComponent(url.split('?text=')[1]!)).toContain('Réservation : RES-000124');
    });
  });

  // 5. Envoi : progression, annulation, erreurs 409, 410, 422
  describe('5. Envoi de la preuve (POST /reservations/:ref/proof)', () => {
    it('envoie la preuve avec progression, détecte les doublons (409), gère l’expiration (410) et le statut invalide (422)', async () => {
      const formData = new FormData();
      const sampleBlob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' });
      const uniqueSha = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
      formData.append('file', sampleBlob, 'proof.jpg');
      formData.append('sha256', uniqueSha);
      formData.append('operator', 'orange');
      formData.append('payerPhone', '+237691234567');
      formData.append('transactionId', 'PP261030.1142.A12345');

      const progressValues: number[] = [];
      const response = await api.upload<UploadProofResponse>(
        endpoints.reservations.proof('RES-000101'),
        formData,
        {
          onProgress: (pct: number) => progressValues.push(pct),
        },
      );

      expect(response.status).toBe('pending_validation');
      expect(response.proof.sha256).toBe(uniqueSha);
      expect(response.proof.transactionId).toBe('PP261030.1142.A12345');

      // 422 INVALID_STATUS si on renvoie sur RES-000101 désormais en pending_validation
      const formDataSecond = new FormData();
      formDataSecond.append('file', sampleBlob, 'proof2.jpg');
      formDataSecond.append('sha256', 'different_sha_256_hash_value_000000000000000000000000000');
      formDataSecond.append('operator', 'orange');

      await expect(
        api.upload<UploadProofResponse>(
          endpoints.reservations.proof('RES-000101'),
          formDataSecond,
        ),
      ).rejects.toMatchObject({
        status: 422,
        code: 'INVALID_STATUS',
      });

      // 409 DUPLICATE_PROOF si la même empreinte SHA-256 est envoyée sur une autre réservation (RES-000103)
      const duplicateFormData = new FormData();
      duplicateFormData.append('file', sampleBlob, 'proof.jpg');
      duplicateFormData.append('sha256', uniqueSha);
      duplicateFormData.append('operator', 'mtn');

      await expect(
        api.upload<UploadProofResponse>(
          endpoints.reservations.proof('RES-000103'),
          duplicateFormData,
        ),
      ).rejects.toMatchObject({
        status: 409,
        code: 'DUPLICATE_PROOF',
      });

      // 410 RESERVATION_EXPIRED après simulation d'expiration sur RES-000103
      await api.post(endpoints.mock.expireReservation('RES-000103'));
      const freshFormData = new FormData();
      freshFormData.append('file', sampleBlob, 'fresh.jpg');
      freshFormData.append('sha256', 'fresh_sha_hash_value_999999999999999999999999999999999');
      freshFormData.append('operator', 'mtn');

      await expect(
        api.upload<UploadProofResponse>(
          endpoints.reservations.proof('RES-000103'),
          freshFormData,
        ),
      ).rejects.toMatchObject({
        status: 410,
        code: 'RESERVATION_EXPIRED',
      });
    }, 15_000);

    it("permet d'annuler un envoi en cours via AbortSignal", async () => {
      const controller = new AbortController();
      controller.abort();
      const formData = new FormData();
      formData.append('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }), 'p.jpg');
      formData.append('sha256', 'abort_sha_test_1234567890');
      formData.append('operator', 'orange');

      const uploadPromise = api.upload<UploadProofResponse>(
        endpoints.reservations.proof('RES-000101'),
        formData,
        {
          signal: controller.signal,
        },
      );

      await expect(uploadPromise).rejects.toThrow(ApiError);
      await expect(uploadPromise).rejects.toMatchObject({
        code: 'UPLOAD_ABORTED',
      });
    });
  });

  // 6. Suivi en direct : passage de pending_validation à confirmed et à payment_rejected
  describe('6. Suivi en direct sur SuccessPage (pending_validation → confirmed / payment_rejected)', () => {
    it('met à jour le badge et le titre vers « C’EST CONFIRMÉ ! » quand la boutique valide', async () => {
      // Préparer RES-000101 en pending_validation
      const formData = new FormData();
      formData.append('file', new Blob([new Uint8Array([9, 8, 7])], { type: 'image/jpeg' }), 'ok.jpg');
      formData.append('sha256', 'live_tracking_sha_001');
      formData.append('operator', 'orange');
      await api.upload(endpoints.reservations.proof('RES-000101'), formData);

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      const router = createMemoryRouter(
        [
          {
            path: '/reservation/:ref/merci',
            element: (
              <QueryClientProvider client={queryClient}>
                <LazyMotion features={loadMotionFeatures} strict>
                  <SuccessPage />
                </LazyMotion>
              </QueryClientProvider>
            ),
          },
          {
            path: '/reservation/:ref/preuve',
            element: <div>PAGE PREUVE RENVOI</div>,
          },
        ],
        { initialEntries: ['/reservation/RES-000101/merci'] },
      );

      render(<RouterProvider router={router} />);

      await waitFor(() => {
        expect(screen.getByText('MERCI !')).toBeInTheDocument();
        expect(screen.getByText('En attente de validation')).toBeInTheDocument();
      });

      // Simulation validation par la boutique
      const validated = await api.post<ReservationDetailResponse>(
        endpoints.mock.validateReservation('RES-000101'),
      );
      queryClient.setQueryData(['reservation', 'RES-000101'], validated);

      await waitFor(() => {
        expect(screen.getByText("C'EST CONFIRMÉ !")).toBeInTheDocument();
        expect(screen.getByText('Confirmée')).toBeInTheDocument();
      });

      // Simulation rejet par la boutique → redirection vers la page de preuve
      const rejected = await api.post<ReservationDetailResponse>(
        endpoints.mock.rejectReservation('RES-000101'),
        { reason: 'Capture illisible' },
      );
      queryClient.setQueryData(['reservation', 'RES-000101'], rejected);

      await waitFor(() => {
        expect(screen.getByText('PAGE PREUVE RENVOI')).toBeInTheDocument();
      });
    }, 15_000);
  });

  // 7. Expiration : calque à 0, « Refaire ma réservation » remet seulement les articles disponibles
  describe('7. Expiration et restauration des seuls articles disponibles dans le panier', () => {
    it('affiche le calque Réservation expirée et ne remet dans le panier que les articles encore en stock', async () => {
      const availableProduct = mockProducts[0]!;
      const availableVariant = availableProduct.variants.find((v) => v.stock > 0)!;
      const baseReservation = mockReservations['RES-000101']!;

      const expiredReservation: Reservation = {
        ...baseReservation,
        ref: 'RES-000999',
        status: 'expired',
        items: [
          {
            id: 'item-dispo',
            productId: availableProduct.id,
            slug: availableProduct.slug,
            name: availableProduct.name,
            variantId: availableVariant.id,
            size: availableVariant.size,
            colorName: availableProduct.colors[0]?.name ?? 'Noir',
            quantity: 1,
            unitPrice: availableProduct.price,
            image: availableProduct.images[0]!,
          },
          {
            id: 'item-epuise',
            productId: 'prod-inexistant',
            slug: 'article-epuise-test',
            name: 'Article Épuisé Test',
            variantId: 'var-epuise',
            size: 'XL',
            colorName: 'Noir',
            quantity: 2,
            unitPrice: 20_000,
            image: '/mock/prod-1.svg',
          },
        ],
      };

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      const router = createMemoryRouter(
        [
          {
            path: '/',
            element: (
              <QueryClientProvider client={queryClient}>
                <LazyMotion features={loadMotionFeatures} strict>
                  <ReservationExpiredOverlay
                    open={true}
                    reservation={expiredReservation}
                    showAlreadyPaidHelp={true}
                  />
                </LazyMotion>
              </QueryClientProvider>
            ),
          },
          {
            path: '/panier',
            element: <div>PAGE PANIER OUVERTE</div>,
          },
        ],
        { initialEntries: ['/'] },
      );

      render(<RouterProvider router={router} />);

      expect(screen.getByText('Réservation expirée')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Vous avez déjà payé ? Contactez la boutique sur WhatsApp avec votre capture.',
        ),
      ).toBeInTheDocument();

      const rebuildBtn = screen.getByRole('button', { name: /Refaire ma réservation/i });
      fireEvent.click(rebuildBtn);

      await waitFor(() => {
        expect(screen.getByText('PAGE PANIER OUVERTE')).toBeInTheDocument();
      });

      const cartItems = useCartStore.getState().items;
      expect(cartItems).toHaveLength(1);
      expect(cartItems[0]!.variantId).toBe(availableVariant.id);
      expect(cartItems[0]!.productId).toBe(availableProduct.id);
    });
  });
});
