import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useAgencies } from '@/features/reservation/api/useReservationQueries';
import { CityPickerField } from '@/features/reservation/components/CityPickerField';
import { isCityLocal } from '@/features/reservation/schema/reservationSchema';
import { cn } from '@/lib/utils/cn';
import { haptic } from '@/lib/utils/haptics';
import { formatCmPhoneInput } from '@/lib/utils/phone';
import type { DeliveryCity } from '@/types/domain';

/** Champs d'adresse partagés par le formulaire de réservation (M3) et les adresses du profil (M5). */
export interface DeliveryAddressFieldValues {
  city: string;
  district: string;
  landmark: string;
  agencyId: string;
  recipientType: 'self' | 'other';
  recipientName: string;
  recipientPhone: string;
}

export interface DeliveryAddressFieldsProps {
  cities: DeliveryCity[];
  disabled?: boolean;
  /** Appelé quand le client change de ville (l'agence choisie est déjà remise à zéro). */
  onCityChange?: (city: string) => void;
  /** Préfixe des identifiants de champs (unicité si deux formulaires coexistent). */
  idPrefix?: string;
  cityLabel?: string;
}

/**
 * Ville, puis selon la ville : quartier + point de repère (livraison locale à Douala)
 * ou agence de transport + personne qui récupère le colis (autres villes) — §6.4 M3.
 * À utiliser dans un `FormProvider` de react-hook-form ; règles : `addDeliveryAddressIssues`.
 */
export function DeliveryAddressFields({
  cities,
  disabled = false,
  onCityChange,
  idPrefix = 'res',
  cityLabel = 'VILLE DE LIVRAISON *',
}: DeliveryAddressFieldsProps) {
  const {
    register,
    setValue,
    control,
    formState: { errors },
  } = useFormContext<DeliveryAddressFieldValues>();
  const currentCity = useWatch({ control, name: 'city' }) ?? 'Douala';
  const selectedAgencyId = useWatch({ control, name: 'agencyId' }) ?? '';
  const recipientType = useWatch({ control, name: 'recipientType' }) ?? 'self';
  const isLocalSelected = isCityLocal(currentCity, cities);

  const { data: cityAgencies = [], isLoading: isLoadingAgencies } = useAgencies(
    !isLocalSelected ? currentCity : undefined,
  );

  return (
    <>
      {/* 6.4.2 Choix de la ville */}
      <div data-field="city">
        <label className="mb-1.5 block text-label text-ink">{cityLabel}</label>
        <CityPickerField
          cities={cities}
          value={currentCity}
          disabled={disabled}
          error={errors.city?.message}
          onChange={(newCity) => {
            onCityChange?.(newCity);
            setValue('city', newCity, {
              shouldValidate: true,
            });
            setValue('agencyId', '');
          }}
        />
        {errors.city && (
          <p
            role="alert"
            className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{errors.city.message}</span>
          </p>
        )}
      </div>

      {/* 6.4.3 Selon la ville : Ville locale (Quartier + Point de repère) vs Autre ville (Agence) */}
      {isLocalSelected ? (
        <div className="space-y-4">
          <div data-field="district">
            <label htmlFor={`${idPrefix}-district`} className="block text-label text-ink">
              QUARTIER *
            </label>
            <input
              id={`${idPrefix}-district`}
              type="text"
              enterKeyHint="next"
              disabled={disabled}
              placeholder="Ex. : Bonamoussadi, Akwa, Makepe…"
              aria-invalid={Boolean(errors.district)}
              aria-describedby={errors.district ? `${idPrefix}-err-district` : undefined}
              {...register('district')}
              className={cn(
                'mt-1.5 h-12 w-full rounded-[var(--radius-md)] border bg-white px-3.5 text-[16px] text-ink placeholder:text-text-2 focus:border-ink focus:outline-none',
                errors.district ? 'border-danger' : 'border-silver',
              )}
            />
            {errors.district && (
              <p
                id={`${idPrefix}-err-district`}
                role="alert"
                className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{errors.district.message}</span>
              </p>
            )}
          </div>

          <div data-field="landmark">
            <label htmlFor={`${idPrefix}-landmark`} className="block text-label text-ink">
              POINT DE REPÈRE PRÉCIS *
            </label>
            <input
              id={`${idPrefix}-landmark`}
              type="text"
              enterKeyHint="next"
              disabled={disabled}
              placeholder="Ex. : Après la pharmacie du carrefour, portail noir"
              aria-invalid={Boolean(errors.landmark)}
              aria-describedby={`${idPrefix}-help-landmark ${idPrefix}-err-landmark`}
              {...register('landmark')}
              className={cn(
                'mt-1.5 h-12 w-full rounded-[var(--radius-md)] border bg-white px-3.5 text-[16px] text-ink placeholder:text-text-2 focus:border-ink focus:outline-none',
                errors.landmark ? 'border-danger' : 'border-silver',
              )}
            />
            <p id={`${idPrefix}-help-landmark`} className="mt-1.5 text-xs text-text-2">
              Au Cameroun, les livreurs se repèrent surtout grâce aux repères connus. Soyez précis.
            </p>
            {errors.landmark && (
              <p
                id={`${idPrefix}-err-landmark`}
                role="alert"
                className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{errors.landmark.message}</span>
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Choix de l'agence de transport */}
          <div data-field="agencyId">
            <span className="block text-label text-ink">
              AGENCE DE TRANSPORT À {currentCity.toUpperCase()} *
            </span>
            {isLoadingAgencies ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-text-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Chargement des agences de {currentCity}…</span>
              </div>
            ) : (
              <div
                role="radiogroup"
                aria-label={`Agences de transport à ${currentCity}`}
                className="mt-2 space-y-2.5"
              >
                {cityAgencies.map((agency) => {
                  const isSelected = selectedAgencyId === agency.id;
                  return (
                    <button
                      key={agency.id}
                      type="button"
                      role="radio"
                      disabled={disabled}
                      aria-checked={isSelected}
                      onClick={() => {
                        haptic('light');
                        setValue('agencyId', agency.id, {
                          shouldValidate: true,
                        });
                      }}
                      className={cn(
                        'flex w-full items-start justify-between gap-3 rounded-[var(--radius-md)] border p-3.5 text-left transition-colors',
                        isSelected
                          ? 'border-2 border-ink bg-surface'
                          : 'border-silver bg-white hover:border-ink',
                      )}
                    >
                      <div>
                        <span className="block text-small font-bold text-ink">{agency.name}</span>
                        <span className="mt-0.5 block text-xs text-text-2">{agency.address}</span>
                        <span className="mt-1 block text-[11px] font-semibold text-text-2">
                          {agency.openingHours}
                        </span>
                      </div>
                      <span
                        className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                          isSelected ? 'border-ink bg-ink text-white' : 'border-silver bg-white',
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" aria-hidden="true" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {errors.agencyId && (
              <p
                role="alert"
                className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{errors.agencyId.message}</span>
              </p>
            )}
          </div>

          {/* Personne qui récupère le colis (§6.4.3) */}
          <div>
            <span className="block text-label text-ink">PERSONNE QUI RÉCUPÈRE LE COLIS</span>
            <div
              role="radiogroup"
              aria-label="Personne qui récupère le colis"
              className="mt-2 grid grid-cols-2 gap-2.5"
            >
              <button
                type="button"
                role="radio"
                aria-checked={recipientType === 'self'}
                onClick={() => setValue('recipientType', 'self', { shouldValidate: true })}
                className={cn(
                  'min-h-[44px] rounded-[var(--radius-md)] border px-3 py-2 text-small font-bold transition-colors',
                  recipientType === 'self'
                    ? 'border-ink bg-ink text-white'
                    : 'border-silver bg-white text-ink hover:bg-surface',
                )}
              >
                Moi-même
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={recipientType === 'other'}
                onClick={() => setValue('recipientType', 'other', { shouldValidate: true })}
                className={cn(
                  'min-h-[44px] rounded-[var(--radius-md)] border px-3 py-2 text-small font-bold transition-colors',
                  recipientType === 'other'
                    ? 'border-ink bg-ink text-white'
                    : 'border-silver bg-white text-ink hover:bg-surface',
                )}
              >
                Quelqu&rsquo;un d&rsquo;autre
              </button>
            </div>

            {recipientType === 'other' && (
              <div className="mt-4 grid grid-cols-1 gap-4 rounded-[var(--radius-md)] bg-surface p-4 sm:grid-cols-2">
                <div data-field="recipientName">
                  <label htmlFor={`${idPrefix}-recipientName`} className="block text-label text-ink">
                    NOM COMPLET DU DESTINATAIRE *
                  </label>
                  <input
                    id={`${idPrefix}-recipientName`}
                    type="text"
                    enterKeyHint="next"
                    placeholder="Ex. : Paul Biyong"
                    aria-invalid={Boolean(errors.recipientName)}
                    {...register('recipientName')}
                    className={cn(
                      'mt-1.5 h-11 w-full rounded-[var(--radius-md)] border bg-white px-3 text-[16px] text-ink focus:border-ink focus:outline-none',
                      errors.recipientName ? 'border-danger' : 'border-silver',
                    )}
                  />
                  {errors.recipientName && (
                    <p role="alert" className="mt-1 text-xs font-semibold text-danger">
                      {errors.recipientName.message}
                    </p>
                  )}
                </div>

                <div data-field="recipientPhone">
                  <label htmlFor={`${idPrefix}-recipientPhone`} className="block text-label text-ink">
                    TÉLÉPHONE DU DESTINATAIRE *
                  </label>
                  <input
                    id={`${idPrefix}-recipientPhone`}
                    type="tel"
                    inputMode="numeric"
                    enterKeyHint="next"
                    placeholder="677 00 00 00"
                    aria-invalid={Boolean(errors.recipientPhone)}
                    {...register('recipientPhone', {
                      onChange: (e) => {
                        e.target.value = formatCmPhoneInput(e.target.value);
                      },
                    })}
                    className={cn(
                      'mt-1.5 h-11 w-full rounded-[var(--radius-md)] border bg-white px-3 font-mono text-[16px] text-ink focus:border-ink focus:outline-none',
                      errors.recipientPhone ? 'border-danger' : 'border-silver',
                    )}
                  />
                  {errors.recipientPhone && (
                    <p role="alert" className="mt-1 text-xs font-semibold text-danger">
                      {errors.recipientPhone.message}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
