import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Edit3,
  ExternalLink,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Store,
  Truck,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { Navigate, useBlocker, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Container, Price } from '@/components/ui/Primitives';
import { SmartImage } from '@/components/ui/SmartImage';
import { useLogout } from '@/features/auth/api/useAuthQueries';
import { AnimatedPriceCounter } from '@/features/cart/components/AnimatedPriceCounter';
import { usePublicSettings } from '@/features/catalog/api/useCatalogQueries';
import {
  useAddresses,
  useAgencies,
  useCreateReservation,
  useDeliveryCities,
  useSaveAddress,
} from '@/features/reservation/api/useReservationQueries';
import { CheckoutStepper } from '@/features/reservation/components/CheckoutStepper';
import { DeliveryAddressFields } from '@/features/reservation/components/DeliveryAddressFields';
import { SignatureHoldOverlay } from '@/features/reservation/components/SignatureHoldOverlay';
import {
  clearReservationDraft,
  loadReservationDraft,
  saveReservationDraft,
} from '@/features/reservation/schema/reservationDraftStorage';
import {
  computeReservationAmounts,
  createReservationFormSchema,
  isCityLocal,
  type ReservationFormValues,
} from '@/features/reservation/schema/reservationSchema';
import { ApiError } from '@/lib/api/client';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { cn } from '@/lib/utils/cn';
import { haptic } from '@/lib/utils/haptics';
import {
  formatCmPhone,
  normalizeCmPhone,
} from '@/lib/utils/phone';
import { formatPrice } from '@/lib/utils/price';
import { ease, spring } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { useAuthStore } from '@/stores/authStore';
import {
  selectCartCount,
  selectCartSubtotal,
  useCartStore,
} from '@/stores/cartStore';
import { useToastStore } from '@/stores/toastStore';
import { useUiStore, type SourceRect } from '@/stores/uiStore';
import type { CartValidationItemResult } from '@/types/api';
import type { Address } from '@/types/domain';

const ADDRESS_LABEL_OPTIONS: Array<'Maison' | 'Bureau' | 'Autre'> = [
  'Maison',
  'Bureau',
  'Autre',
];

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Page Formulaire de réservation (`/reservation`, §6, §7.1, §7.2 & §8).
 */
export function CheckoutPage() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotionPref();
  const isOnline = useOnlineStatus();

  const authStatus = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const openAuthSheet = useUiStore((s) => s.openAuthSheet);

  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clear);
  const applyValidation = useCartStore((s) => s.applyValidation);
  const cartCount = useCartStore(selectCartCount);
  const subtotal = useCartStore(selectCartSubtotal);

  const showToast = useToastStore((s) => s.show);
  const logout = useLogout();

  const { data: settings } = usePublicSettings();
  const { data: cities = [] } = useDeliveryCities();
  const { data: savedAddresses = [] } = useAddresses();
  const saveAddressMutation = useSaveAddress();
  const createReservation = useCreateReservation();

  // Clé d'idempotence unique générée à l'ouverture du formulaire (§7.1)
  const [idempotencyKey] = useState<string>(() => generateIdempotencyKey());

  // Réservation créée déclenchant le moment signature (§7.2)
  const [confirmedRef, setConfirmedRef] = useState<string | null>(null);
  const [confirmButtonRect, setConfirmButtonRect] = useState<SourceRect | null>(
    null,
  );

  // État d'interruption réseau et réessai automatique (§7.1)
  const [networkRetryNotice, setNetworkRetryNotice] = useState<string | null>(
    null,
  );
  const [manualRetryAvailable, setManualRetryAvailable] = useState(false);

  // Adresse enregistrée sélectionnée vs édition manuelle (§6.4.1)
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [isEditingAddressFields, setIsEditingAddressFields] = useState(true);
  const [isMobileSummaryOpen, setIsMobileSummaryOpen] = useState(false);
  const [errorShakeTick, setErrorShakeTick] = useState(0);

  const desktopConfirmBtnRef = useRef<HTMLDivElement>(null);
  const mobileConfirmBtnRef = useRef<HTMLDivElement>(null);
  const initializedAddressRef = useRef(false);

  useEffect(() => {
    document.title = "Réservation · DR Choco L'Incompris";
  }, []);

  // Garde d'authentification : si le client n'est pas connecté, ouvre AuthSheet par-dessus (§8)
  useEffect(() => {
    if (items.length === 0 || confirmedRef) return;
    // Session en cours de restauration (profil connu) : le formulaire reste remplissable hors connexion
    if (authStatus === 'unknown' && user) return;
    if (authStatus !== 'authenticated') {
      openAuthSheet(undefined, () => {
        navigate('/panier', { replace: true });
      });
    }
  }, [authStatus, user, items.length, confirmedRef, openAuthSheet, navigate]);

  const initialDraft = useMemo(() => loadReservationDraft(), []);

  const schema = useMemo(() => createReservationFormSchema(cities), [cities]);

  const form = useForm<ReservationFormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      firstName: initialDraft?.firstName ?? user?.firstName ?? '',
      lastName: initialDraft?.lastName ?? user?.lastName ?? '',
      receptionMode: initialDraft?.receptionMode ?? 'delivery',
      city: initialDraft?.city ?? user?.city ?? 'Douala',
      district: initialDraft?.district ?? '',
      landmark: initialDraft?.landmark ?? '',
      agencyId: initialDraft?.agencyId ?? '',
      recipientType: initialDraft?.recipientType ?? 'self',
      recipientName: initialDraft?.recipientName ?? '',
      recipientPhone: initialDraft?.recipientPhone ?? '',
      notes: initialDraft?.notes ?? '',
      saveAddress: initialDraft?.saveAddress ?? true,
      addressLabel: initialDraft?.addressLabel ?? 'Maison',
    },
  });
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    setFocus,
    formState: { errors, isSubmitting },
  } = form;

  // Synchronise Prénom/Nom lorsque l'utilisateur se connecte via AuthSheet
  useEffect(() => {
    if (!user) return;
    const currentFirst = getValues('firstName');
    const currentLast = getValues('lastName');
    if (!currentFirst && user.firstName) {
      setValue('firstName', user.firstName, { shouldValidate: true });
    }
    if (!currentLast && user.lastName) {
      setValue('lastName', user.lastName);
    }
  }, [user, getValues, setValue]);

  const applySavedAddress = (addr: Address, foldFields = true) => {
    setSelectedAddressId(addr.id);
    setIsEditingAddressFields(!foldFields);
    setValue('city', addr.city, { shouldValidate: true });
    setValue('district', addr.district || addr.quarter || '', {
      shouldValidate: true,
    });
    setValue('landmark', addr.landmark || addr.details || '', {
      shouldValidate: true,
    });
    if (addr.agencyId) {
      setValue('agencyId', addr.agencyId, { shouldValidate: true });
    }
    setValue('saveAddress', false);
  };

  // Présélectionne l'adresse par défaut du client s'il en a une (§6.4.1)
  useEffect(() => {
    if (initializedAddressRef.current || savedAddresses.length === 0) return;
    if (initialDraft?.district || initialDraft?.landmark) {
      initializedAddressRef.current = true;
      return;
    }
    const defaultAddr =
      savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
    if (defaultAddr) {
      initializedAddressRef.current = true;
      const id = requestAnimationFrame(() => {
        applySavedAddress(defaultAddr, true);
      });
      return () => cancelAnimationFrame(id);
    }
  });

  const watchedValues = useWatch({ control });
  const receptionMode = watchedValues.receptionMode ?? 'delivery';
  const currentCity = watchedValues.city ?? 'Douala';
  const notesValue = watchedValues.notes ?? '';
  const saveAddressChecked = watchedValues.saveAddress ?? true;
  const addressLabelValue = watchedValues.addressLabel ?? 'Maison';

  // Sauvegarde du brouillon dans sessionStorage avec délai de 500 ms (§6.8)
  useEffect(() => {
    if (confirmedRef) return;
    const timer = window.setTimeout(() => {
      saveReservationDraft(watchedValues as Partial<ReservationFormValues>);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [watchedValues, confirmedRef]);

  const selectedCityObj = useMemo(
    () =>
      cities.find(
        (c) =>
          c.name.toLowerCase() === currentCity.toLowerCase() ||
          c.id.toLowerCase() === currentCity.toLowerCase(),
      ) ?? null,
    [cities, currentCity],
  );

  const isLocalSelected = isCityLocal(currentCity, cities);

  const { data: cityAgencies = [] } = useAgencies(
    receptionMode === 'delivery' && !isLocalSelected ? currentCity : undefined,
  );

  const amounts = useMemo(
    () =>
      computeReservationAmounts({
        subtotal,
        receptionMode,
        selectedCity: selectedCityObj,
        deliveryFeePayment: settings?.deliveryFeePayment ?? 'upfront',
      }),
    [subtotal, receptionMode, selectedCityObj, settings?.deliveryFeePayment],
  );

  const isSending = createReservation.isPending || isSubmitting;

  // Bloque la navigation retour pendant l'envoi de la réservation (§7.1)
  const blocker = useBlocker(isSending && !confirmedRef);
  useEffect(() => {
    if (blocker.state === 'blocked') {
      const leave = window.confirm(
        'Votre réservation est en cours de création. Quitter quand même ?',
      );
      if (leave) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  // Garde de route : panier vide (et aucune réservation en cours d'affichage signature) -> /panier (§8)
  if (items.length === 0 && !confirmedRef) {
    return <Navigate to="/panier" replace />;
  }

  const handleSwitchPhoneAccount = async () => {
    await logout.mutateAsync();
    openAuthSheet(undefined, () => {
      navigate('/panier', { replace: true });
    });
  };

  const executeReservationSubmit = async (values: ReservationFormValues) => {
    if (!isOnline) return;

    // Si la session a expiré entre-temps, ouvre AuthSheet et reprend l'envoi après reconnexion (§8)
    if (useAuthStore.getState().status !== 'authenticated') {
      openAuthSheet(() => {
        executeReservationSubmit(values);
      });
      return;
    }

    setNetworkRetryNotice(null);
    setManualRetryAvailable(false);

    // Capture la position du bouton Confirmer pour le clipPath du moment signature (§7.2)
    const activeBtnEl =
      window.innerWidth >= 1024
        ? desktopConfirmBtnRef.current
        : mobileConfirmBtnRef.current;
    if (activeBtnEl) {
      const r = activeBtnEl.getBoundingClientRect();
      setConfirmButtonRect({
        x: r.left,
        y: r.top,
        width: r.width,
        height: r.height,
      });
    }

    const userPhone = user?.phone ?? '+237690000001';
    const recipientPhoneFormatted =
      values.recipientType === 'other' && values.recipientPhone
        ? (() => {
            try {
              return normalizeCmPhone(values.recipientPhone);
            } catch {
              return values.recipientPhone;
            }
          })()
        : userPhone;

    const payload = {
      receptionMode: values.receptionMode,
      items: items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      })),
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phone: userPhone,
      city: values.receptionMode === 'delivery' ? values.city : 'Douala',
      district:
        values.receptionMode === 'delivery' && isLocalSelected
          ? values.district.trim()
          : undefined,
      landmark:
        values.receptionMode === 'delivery' && isLocalSelected
          ? values.landmark.trim()
          : undefined,
      agencyId:
        values.receptionMode === 'delivery' && !isLocalSelected
          ? values.agencyId
          : undefined,
      recipientType: values.recipientType,
      recipientName:
        values.recipientType === 'other'
          ? values.recipientName.trim()
          : `${values.firstName.trim()} ${values.lastName.trim()}`.trim(),
      recipientPhone: recipientPhoneFormatted,
      notes: values.notes.trim() || undefined,
      deliveryAddressId: selectedAddressId ?? undefined,
    };

    // Jusqu'à 2 nouvelles tentatives automatiques avec la même clé d'idempotence en cas de coupure réseau (§7.1)
    let attempt = 0;
    const maxAutoRetries = 2;

    while (attempt <= maxAutoRetries) {
      try {
        const created = await createReservation.mutateAsync({
          payload,
          idempotencyKey,
        });

        // Enregistre l'adresse si demandé (§6.4.5 & §7.1)
        if (
          values.receptionMode === 'delivery' &&
          values.saveAddress &&
          !selectedAddressId
        ) {
          saveAddressMutation.mutate({
            label: values.addressLabel,
            city: values.city,
            district: isLocalSelected ? values.district.trim() : values.city,
            landmark: isLocalSelected
              ? values.landmark.trim()
              : (cityAgencies.find((a) => a.id === values.agencyId)?.name ??
                'Agence de transport'),
            receptionMode: 'delivery',
            agencyId: !isLocalSelected ? values.agencyId : undefined,
            recipientName: payload.recipientName,
            recipientPhone: recipientPhoneFormatted,
          });
        }

        // Vide le panier et efface le brouillon (§7.1)
        clearCart();
        clearReservationDraft();
        setNetworkRetryNotice(null);
        setConfirmedRef(created.ref);
        return;
      } catch (err) {
        if (err instanceof ApiError) {
          // Conflit de stock 409 -> retour au panier avec les lignes mises en évidence (§7.1)
          if (err.status === 409) {
            const conflictItems = (err.details?.items ??
              []) as CartValidationItemResult[];
            if (Array.isArray(conflictItems) && conflictItems.length > 0) {
              applyValidation({
                items: conflictItems,
                checkedAt: new Date().toISOString(),
              });
            }
            haptic('error');
            showToast({
              message:
                "Un article n'est plus disponible dans la quantité demandée. Vérifiez votre panier.",
              durationMs: 5000,
            });
            navigate('/panier', { replace: true });
            return;
          }

          // Session expirée 401 -> ouvre la feuille de connexion et reprend l'envoi (§8)
          if (err.status === 401) {
            openAuthSheet(() => {
              executeReservationSubmit(values);
            });
            return;
          }

          // Délai dépassé ou coupure réseau -> réessai automatique avec la même clé (§7.1)
          if (
            (err.status === 408 || err.status === 0) &&
            attempt < maxAutoRetries
          ) {
            attempt += 1;
            setNetworkRetryNotice(
              'La connexion a été interrompue. Nous vérifions si votre réservation a été créée…',
            );
            await new Promise((r) => window.setTimeout(r, 900));
            continue;
          }
        }

        haptic('error');
        setNetworkRetryNotice(
          'La connexion a été interrompue. Votre panier et vos informations sont conservés.',
        );
        setManualRetryAvailable(true);
        return;
      }
    }
  };

  const onInvalidSubmit = (fieldErrors: Record<string, unknown>) => {
    haptic('error');
    setErrorShakeTick((t) => t + 1);

    // Si l'erreur porte sur un champ d'adresse replié, déplie la section
    if (
      fieldErrors.city ||
      fieldErrors.district ||
      fieldErrors.landmark ||
      fieldErrors.agencyId
    ) {
      setIsEditingAddressFields(true);
    }

    const order: Array<keyof ReservationFormValues> = [
      'firstName',
      'city',
      'district',
      'landmark',
      'agencyId',
      'recipientName',
      'recipientPhone',
      'notes',
    ];
    const firstKey = order.find((k) => Boolean(fieldErrors[k]));
    if (firstKey) {
      try {
        setFocus(firstKey);
      } catch {
        // Champ personnalisé (ex. CityPickerField)
      }
      const el = document.querySelector(`[data-field="${firstKey}"]`);
      el?.scrollIntoView?.({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'center',
      });
    }
  };

  const shopInfo = settings?.shop ?? {
    name: "Flagship DR Choco L'Incompris",
    address:
      'Akwa, Boulevard de la Liberté — À 100 m de la Cathédrale, immeuble anthracite rez-de-chaussée',
    city: 'Douala',
    openingHours: 'Lun – Sam · 09 h 30 à 19 h 30',
    mapsUrl:
      'https://maps.google.com/?q=Boulevard+de+la+Liberte+Akwa+Douala+Cameroun',
  };

  return (
    <div className="pb-32 lg:pb-16">
      {/* Moment signature GSAP après création (§7.2) */}
      {confirmedRef && (
        <SignatureHoldOverlay
          reservationRef={confirmedRef}
          buttonRect={confirmButtonRect}
          onComplete={() => {
            navigate(`/reservation/${confirmedRef}/paiement`, {
              replace: true,
              viewTransition: true,
            });
          }}
        />
      )}

      {/* 6.1 Indicateur d'étapes : 1 Réception -> 2 Paiement -> 3 Preuve */}
      <CheckoutStepper currentStep={1} />

      <Container className="py-6 lg:py-10">
        <div className="mb-6">
          <span className="text-label text-text-2">ÉTAPE 1 SUR 3</span>
          <h1 className="mt-1 text-h1 text-ink">FINALISER LA RÉSERVATION</h1>
        </div>

        {/* Bandeau de réessai réseau (§7.1) */}
        {networkRetryNotice && (
          <div
            role="alert"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-warning bg-surface p-4 text-small text-ink"
          >
            <div className="flex items-center gap-2.5">
              {manualRetryAvailable ? (
                <AlertCircle
                  className="h-5 w-5 shrink-0 text-warning"
                  aria-hidden="true"
                />
              ) : (
                <Loader2
                  className="h-5 w-5 shrink-0 animate-spin text-ink"
                  aria-hidden="true"
                />
              )}
              <span className="font-semibold">{networkRetryNotice}</span>
            </div>

            {manualRetryAvailable && (
              <Button
                variant="dark"
                size="sm"
                iconLeft={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
                onClick={(e) => {
                  void handleSubmit(executeReservationSubmit, onInvalidSubmit)(e);
                }}
              >
                Réessayer
              </Button>
            )}
          </div>
        )}

        {/* 6.6 Récapitulatif repliable en haut sur mobile */}
        <div className="mb-6 rounded-[var(--radius-md)] border border-silver/70 bg-surface/60 lg:hidden">
          <button
            type="button"
            aria-expanded={isMobileSummaryOpen}
            onClick={() => setIsMobileSummaryOpen((prev) => !prev)}
            className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="text-small font-bold text-ink">
              Récapitulatif ({cartCount} article{cartCount > 1 ? 's' : ''}) ·{' '}
              <span className="font-extrabold tabular-nums">
                {formatPrice(amounts.total)}
              </span>
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-text-2 transition-transform duration-200',
                isMobileSummaryOpen && 'rotate-180',
              )}
              aria-hidden="true"
            />
          </button>

          <AnimatePresence initial={false}>
            {isMobileSummaryOpen && (
              <m.div
                initial={reducedMotion ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="space-y-3 border-t border-silver/60 bg-white p-4"
              >
                <ul className="divide-y divide-silver/40">
                  {items.map((item) => (
                    <li
                      key={item.variantId}
                      className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="h-14 w-11 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-surface">
                        <SmartImage
                          src={item.image}
                          fallback={item.image}
                          alt={item.name}
                          ratio="4/5"
                          className="h-full w-full"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-small font-bold text-ink">
                          {item.name}
                        </p>
                        <p className="text-xs text-text-2">
                          {item.color.name} · Taille {item.size} · Qté{' '}
                          {item.quantity}
                        </p>
                      </div>
                      <Price
                        amount={item.unitPrice * item.quantity}
                        className="text-small font-bold text-ink"
                      />
                    </li>
                  ))}
                </ul>

                <dl className="space-y-1.5 border-t border-silver/60 pt-3 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-text-2">Sous-total</dt>
                    <dd className="font-bold text-ink">
                      {formatPrice(amounts.subtotal)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-2">Livraison</dt>
                    <dd className="font-bold text-ink">
                      {amounts.deliveryLabel}
                    </dd>
                  </div>
                  <div className="flex justify-between pt-1 text-small font-extrabold text-ink">
                    <dt>Total</dt>
                    <dd>{formatPrice(amounts.total)}</dd>
                  </div>
                </dl>
              </m.div>
            )}
          </AnimatePresence>
        </div>

        {/* Grille 2 colonnes sur ordinateur (60 % formulaire / 40 % récapitulatif, §6.1) */}
        <FormProvider {...form}>
        <form
          onSubmit={(e) => {
            void handleSubmit(executeReservationSubmit, onInvalidSubmit)(e);
          }}
          noValidate
          className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start"
        >
          {/* Colonne gauche (60 % -> 7/12) : Sections empilées */}
          <div className="space-y-6 lg:col-span-7">
            {/* 6.2 Section « Vos coordonnées » */}
            <m.section
              key={`coord-${errorShakeTick}`}
              animate={
                errorShakeTick > 0 && errors.firstName && !reducedMotion
                  ? { x: [0, -6, 6, -4, 4, 0] }
                  : { x: 0 }
              }
              transition={{ duration: 0.35, ease: ease.out }}
              aria-labelledby="checkout-contact-heading"
              className="rounded-[var(--radius-md)] border border-silver/60 bg-white p-5 sm:p-6"
            >
              <h2 id="checkout-contact-heading" className="text-h3 text-ink">
                1. VOS COORDONNÉES
              </h2>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div data-field="firstName">
                  <label
                    htmlFor="res-firstName"
                    className="block text-label text-ink"
                  >
                    PRÉNOM *
                  </label>
                  <input
                    id="res-firstName"
                    type="text"
                    autoComplete="given-name"
                    enterKeyHint="next"
                    disabled={isSending}
                    aria-invalid={Boolean(errors.firstName)}
                    aria-describedby={
                      errors.firstName ? 'err-firstName' : undefined
                    }
                    placeholder="Junior"
                    {...register('firstName')}
                    className={cn(
                      'mt-1.5 h-12 w-full rounded-[var(--radius-md)] border bg-white px-3.5 text-[16px] text-ink placeholder:text-text-2 focus:border-ink focus:outline-none',
                      errors.firstName ? 'border-danger' : 'border-silver',
                    )}
                  />
                  {errors.firstName && (
                    <p
                      id="err-firstName"
                      role="alert"
                      className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger"
                    >
                      <AlertCircle
                        className="h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{errors.firstName.message}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="res-lastName"
                    className="block text-label text-ink"
                  >
                    NOM
                  </label>
                  <input
                    id="res-lastName"
                    type="text"
                    autoComplete="family-name"
                    enterKeyHint="next"
                    disabled={isSending}
                    placeholder="Mbarga"
                    {...register('lastName')}
                    className="mt-1.5 h-12 w-full rounded-[var(--radius-md)] border border-silver bg-white px-3.5 text-[16px] text-ink placeholder:text-text-2 focus:border-ink focus:outline-none"
                  />
                </div>
              </div>

              {/* Téléphone en lecture seule + lien « Ce n'est pas vous ? Changer de numéro » (§6.2) */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] bg-surface px-4 py-3">
                <div>
                  <span className="block text-xs font-semibold text-text-2">
                    Numéro de téléphone vérifié
                  </span>
                  <span className="font-mono text-body font-bold text-ink">
                    +237 {formatCmPhone(user?.phone ?? '+237690000001')}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isSending}
                  onClick={handleSwitchPhoneAccount}
                  className="text-xs font-bold text-ink underline hover:text-red"
                >
                  Ce n&rsquo;est pas vous ? Changer de numéro
                </button>
              </div>
            </m.section>

            {/* 6.3 Section « Mode de réception » */}
            <section
              aria-labelledby="checkout-reception-heading"
              className="rounded-[var(--radius-md)] border border-silver/60 bg-white p-5 sm:p-6"
            >
              <h2 id="checkout-reception-heading" className="text-h3 text-ink">
                2. MODE DE RÉCEPTION
              </h2>

              <div
                role="radiogroup"
                aria-labelledby="checkout-reception-heading"
                className="mt-4 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2"
              >
                {/* Carte Livraison */}
                <button
                  type="button"
                  role="radio"
                  disabled={isSending}
                  aria-checked={receptionMode === 'delivery'}
                  onClick={() => {
                    haptic('light');
                    setValue('receptionMode', 'delivery', {
                      shouldValidate: true,
                    });
                  }}
                  className={cn(
                    'relative flex min-h-[112px] flex-col items-start justify-between rounded-[var(--radius-md)] p-4 text-left transition-colors',
                    receptionMode === 'delivery'
                      ? 'border-2 border-red bg-surface'
                      : 'border border-silver bg-white hover:border-ink',
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <Truck
                      className={cn(
                        'h-5 w-5',
                        receptionMode === 'delivery'
                          ? 'text-red'
                          : 'text-ink',
                      )}
                      aria-hidden="true"
                    />
                    {receptionMode === 'delivery' && (
                      <m.span
                        initial={reducedMotion ? false : { scale: 0.4 }}
                        animate={{ scale: 1 }}
                        transition={spring.bounce}
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-red text-white"
                      >
                        <Check className="h-3 w-3" aria-hidden="true" />
                      </m.span>
                    )}
                  </div>
                  <div className="mt-3">
                    <span className="block text-body font-extrabold text-ink">
                      Livraison
                    </span>
                    <span className="mt-0.5 block text-xs text-text-2">
                      Livraison dans votre ville ou envoi par agence
                    </span>
                    <span className="mt-1 block text-xs font-bold text-ink">
                      À partir de 1 500 FCFA
                    </span>
                  </div>
                </button>

                {/* Carte Retrait en boutique */}
                <button
                  type="button"
                  role="radio"
                  disabled={isSending}
                  aria-checked={receptionMode === 'pickup'}
                  onClick={() => {
                    haptic('light');
                    setValue('receptionMode', 'pickup', {
                      shouldValidate: true,
                    });
                  }}
                  className={cn(
                    'relative flex min-h-[112px] flex-col items-start justify-between rounded-[var(--radius-md)] p-4 text-left transition-colors',
                    receptionMode === 'pickup'
                      ? 'border-2 border-red bg-surface'
                      : 'border border-silver bg-white hover:border-ink',
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <Store
                      className={cn(
                        'h-5 w-5',
                        receptionMode === 'pickup' ? 'text-red' : 'text-ink',
                      )}
                      aria-hidden="true"
                    />
                    {receptionMode === 'pickup' && (
                      <m.span
                        initial={reducedMotion ? false : { scale: 0.4 }}
                        animate={{ scale: 1 }}
                        transition={spring.bounce}
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-red text-white"
                      >
                        <Check className="h-3 w-3" aria-hidden="true" />
                      </m.span>
                    )}
                  </div>
                  <div className="mt-3">
                    <span className="block text-body font-extrabold text-ink">
                      Retrait en boutique
                    </span>
                    <span className="mt-0.5 block text-xs font-bold text-success">
                      Gratuit · {shopInfo.city}
                    </span>
                    <span className="mt-1 block text-xs text-text-2">
                      {shopInfo.openingHours}
                    </span>
                  </div>
                </button>
              </div>

              {/* Contenu dynamique sous les cartes (fondu croisé + glissement 8 px, §6.3) */}
              <div className="mt-6">
                <AnimatePresence mode="wait" initial={false}>
                  {receptionMode === 'delivery' ? (
                    <m.div
                      key="mode-delivery"
                      initial={
                        reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      exit={
                        reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }
                      }
                      transition={{ duration: 0.2, ease: ease.out }}
                      className="space-y-5"
                    >
                      {/* 6.4.1 Adresses enregistrées */}
                      {savedAddresses.length > 0 && (
                        <div>
                          <span className="block text-label text-ink">
                            VOS ADRESSES ENREGISTRÉES
                          </span>
                          <div className="mt-2 flex gap-2.5 overflow-x-auto pb-1">
                            {savedAddresses.map((addr) => {
                              const isSelected = selectedAddressId === addr.id;
                              return (
                                <button
                                  key={addr.id}
                                  type="button"
                                  disabled={isSending}
                                  onClick={() => applySavedAddress(addr, true)}
                                  className={cn(
                                    'flex min-w-[180px] shrink-0 flex-col items-start rounded-[var(--radius-md)] border p-3 text-left transition-colors',
                                    isSelected
                                      ? 'border-2 border-ink bg-surface'
                                      : 'border-silver bg-white hover:border-ink',
                                  )}
                                >
                                  <div className="flex w-full items-center justify-between gap-2">
                                    <span className="text-xs font-extrabold uppercase text-ink">
                                      {addr.label}
                                    </span>
                                    {isSelected && (
                                      <Check
                                        className="h-3.5 w-3.5 text-red"
                                        aria-hidden="true"
                                      />
                                    )}
                                  </div>
                                  <span className="mt-1 text-xs font-bold text-ink">
                                    {addr.city} · {addr.district || addr.quarter}
                                  </span>
                                  <span className="mt-0.5 line-clamp-1 text-[11px] text-text-2">
                                    {addr.landmark || addr.details}
                                  </span>
                                </button>
                              );
                            })}

                            <button
                              type="button"
                              disabled={isSending}
                              onClick={() => {
                                setSelectedAddressId(null);
                                setIsEditingAddressFields(true);
                                setValue('district', '');
                                setValue('landmark', '');
                                setValue('saveAddress', true);
                              }}
                              className={cn(
                                'flex min-w-[155px] shrink-0 flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border border-dashed p-3 text-xs font-bold transition-colors',
                                !selectedAddressId
                                  ? 'border-ink bg-surface text-ink'
                                  : 'border-silver text-text-2 hover:border-ink hover:text-ink',
                              )}
                            >
                              <Plus className="h-4 w-4" aria-hidden="true" />
                              <span>+ Nouvelle adresse</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Si une adresse enregistrée est sélectionnée et repliée, résumé compact + bouton Modifier */}
                      {selectedAddressId && !isEditingAddressFields ? (
                        <div className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-silver bg-surface/60 p-4">
                          <div className="text-small">
                            <p className="font-bold text-ink">
                              Livraison à {currentCity} —{' '}
                              {watchedValues.district}
                            </p>
                            <p className="mt-0.5 text-xs text-text-2">
                              Repère : {watchedValues.landmark}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsEditingAddressFields(true)}
                            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 px-2 text-xs font-bold text-ink underline hover:text-red"
                          >
                            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Modifier</span>
                          </button>
                        </div>
                      ) : (
                        <m.div
                          key={`addr-fields-${errorShakeTick}`}
                          animate={
                            errorShakeTick > 0 &&
                            (errors.city ||
                              errors.district ||
                              errors.landmark ||
                              errors.agencyId) &&
                            !reducedMotion
                              ? { x: [0, -6, 6, -4, 4, 0] }
                              : { x: 0 }
                          }
                          transition={{ duration: 0.35, ease: ease.out }}
                          className="space-y-4"
                        >
                          {/* 6.4.2 à 6.4.3 : ville, puis quartier + repère ou agence + destinataire (composant partagé avec le profil, M5) */}
                          <DeliveryAddressFields
                            cities={cities}
                            disabled={isSending}
                            onCityChange={() => setSelectedAddressId(null)}
                          />

                          {/* 6.4.5 Case à cocher « Enregistrer cette adresse » + Nom de l'adresse en chips */}
                          {!selectedAddressId && (
                            <div className="space-y-3 border-t border-silver/60 pt-4">
                              <label className="flex cursor-pointer items-center gap-3 text-small font-semibold text-ink">
                                <input
                                  type="checkbox"
                                  {...register('saveAddress')}
                                  className="h-5 w-5 accent-ink"
                                />
                                <span>
                                  Enregistrer cette adresse pour mes prochaines
                                  réservations
                                </span>
                              </label>

                              {saveAddressChecked && (
                                <div className="flex flex-wrap items-center gap-2 pl-8">
                                  <span className="text-xs font-semibold text-text-2">
                                    Nom de l&rsquo;adresse :
                                  </span>
                                  {ADDRESS_LABEL_OPTIONS.map((labelOpt) => (
                                    <button
                                      key={labelOpt}
                                      type="button"
                                      onClick={() =>
                                        setValue('addressLabel', labelOpt)
                                      }
                                      className={cn(
                                        'min-h-[36px] rounded-[var(--radius-md)] border px-3 py-1 text-xs font-bold transition-colors',
                                        addressLabelValue === labelOpt
                                          ? 'border-ink bg-ink text-white'
                                          : 'border-silver bg-white text-ink hover:bg-surface',
                                      )}
                                    >
                                      {labelOpt}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </m.div>
                      )}
                    </m.div>
                  ) : (
                    /* 6.5 Mode Retrait en boutique */
                    <m.div
                      key="mode-pickup"
                      initial={
                        reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      exit={
                        reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }
                      }
                      transition={{ duration: 0.2, ease: ease.out }}
                      className="rounded-[var(--radius-md)] border border-silver bg-surface p-4 sm:p-5"
                    >
                      <div className="flex items-start gap-3">
                        <MapPin
                          className="mt-0.5 h-5 w-5 shrink-0 text-red"
                          aria-hidden="true"
                        />
                        <div className="space-y-2 text-small">
                          <p className="font-extrabold text-ink">
                            {shopInfo.name} — {shopInfo.city}
                          </p>
                          <p className="text-text-2">{shopInfo.address}</p>
                          <p className="text-xs font-semibold text-ink">
                            Horaires : {shopInfo.openingHours}
                          </p>
                          <a
                            href={shopInfo.mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-bold text-ink underline hover:text-red"
                          >
                            <span>Ouvrir dans Google Maps</span>
                            <ExternalLink
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          </a>
                          <p className="border-t border-silver/60 pt-2 text-xs text-text-2">
                            Nous vous prévenons dès que votre commande est
                            prête, avec la photo de votre colis.
                          </p>
                        </div>
                      </div>
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            </section>

            {/* 6.4.4 Remarques facultatives (200 caractères + compteur) */}
            <section
              aria-labelledby="checkout-notes-heading"
              className="rounded-[var(--radius-md)] border border-silver/60 bg-white p-5 sm:p-6"
            >
              <div className="flex items-baseline justify-between">
                <label
                  id="checkout-notes-heading"
                  htmlFor="res-notes"
                  className="text-h3 text-ink"
                >
                  3. REMARQUES (FACULTATIF)
                </label>
                <span className="font-mono text-xs text-text-2">
                  {notesValue.length}/200
                </span>
              </div>
              <textarea
                id="res-notes"
                rows={2}
                maxLength={200}
                enterKeyHint="done"
                disabled={isSending}
                placeholder="Ex. : appeler avant de passer"
                {...register('notes')}
                className="mt-3 w-full rounded-[var(--radius-md)] border border-silver bg-white p-3 text-[16px] text-ink placeholder:text-text-2 focus:border-ink focus:outline-none"
              />
              {errors.notes && (
                <p
                  role="alert"
                  className="mt-1.5 text-xs font-semibold text-danger"
                >
                  {errors.notes.message}
                </p>
              )}
            </section>
          </div>

          {/* Colonne droite collante sur ordinateur (40 % -> 5/12, §6.1 & §6.6) */}
          <aside className="hidden lg:sticky lg:top-24 lg:col-span-5 lg:block">
            <div className="rounded-[var(--radius-md)] border border-silver/70 bg-white p-6">
              <h2 className="text-h3 text-ink">
                RÉCAPITULATIF ({cartCount} ARTICLE{cartCount > 1 ? 'S' : ''})
              </h2>

              <ul className="mt-4 max-h-[260px] divide-y divide-silver/50 overflow-y-auto pr-1">
                {items.map((item) => (
                  <li
                    key={item.variantId}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="h-16 w-13 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-surface">
                      <SmartImage
                        src={item.image}
                        fallback={item.image}
                        alt={item.name}
                        ratio="4/5"
                        className="h-full w-full"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-small font-bold text-ink">
                        {item.name}
                      </p>
                      <p className="text-xs text-text-2">
                        {item.color.name} · Taille {item.size} · Qté{' '}
                        {item.quantity}
                      </p>
                    </div>
                    <Price
                      amount={item.unitPrice * item.quantity}
                      className="text-small font-bold text-ink"
                    />
                  </li>
                ))}
              </ul>

              <dl className="mt-4 space-y-2.5 border-t border-b border-silver/60 py-4 text-small">
                <div className="flex items-center justify-between">
                  <dt className="text-text-2">Sous-total</dt>
                  <dd className="text-ink">
                    <AnimatedPriceCounter amount={amounts.subtotal} />
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-text-2">Livraison</dt>
                  <dd
                    className={cn(
                      'font-bold',
                      receptionMode === 'pickup' ? 'text-success' : 'text-ink',
                    )}
                  >
                    {amounts.deliveryLabel}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-body font-bold text-ink">Total</span>
                <AnimatedPriceCounter
                  amount={amounts.total}
                  className="text-price text-ink"
                />
              </div>

              {amounts.isOnDelivery && (
                <p className="mt-2 text-xs text-text-2">
                  Note : les frais de livraison ({formatPrice(amounts.deliveryFee)})
                  seront réglés directement à la réception du colis.
                </p>
              )}

              {!isOnline && (
                <p role="alert" className="mt-3 text-xs font-bold text-warning">
                  Vous êtes hors connexion. Reconnectez-vous pour réserver : vos informations
                  restent enregistrées.
                </p>
              )}

              <div ref={desktopConfirmBtnRef} className="mt-5">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={!isOnline || isSending}
                >
                  {isSending ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      <span>Réservation…</span>
                    </span>
                  ) : (
                    'Confirmer la réservation'
                  )}
                </Button>
              </div>

              <p className="mt-3 text-center text-xs leading-relaxed text-text-2">
                En confirmant, vos articles sont mis de côté pendant 24 h. Vous
                paierez à l&rsquo;étape suivante par Mobile Money.
              </p>
            </div>
          </aside>

          {/* Barre d'action collée en bas sur mobile (§6.1) */}
          <div className="fixed right-0 bottom-0 left-0 z-40 border-t border-silver/70 bg-white px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-[var(--shadow-nav)] lg:hidden">
            {!isOnline && (
              <p role="alert" className="mb-2 text-xs font-bold text-warning">
                Vous êtes hors connexion. Reconnectez-vous pour réserver : vos informations
                restent enregistrées.
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-text-2">
                  Total
                </span>
                <AnimatedPriceCounter
                  amount={amounts.total}
                  className="text-price text-ink"
                />
              </div>
              <div ref={mobileConfirmBtnRef}>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={!isOnline || isSending}
                >
                  {isSending ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      <span>Réservation…</span>
                    </span>
                  ) : (
                    'Confirmer la réservation'
                  )}
                </Button>
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-text-2">
              En confirmant, vos articles sont mis de côté pendant 24 h. Vous
              paierez à l&rsquo;étape suivante par Mobile Money.
            </p>
          </div>
        </form>
        </FormProvider>
      </Container>
    </div>
  );
}
