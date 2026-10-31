import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { Chip } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useUpdateAddress } from '@/features/profile/api/useAddressMutations';
import {
  ADDRESS_LABELS,
  addressToFormValues,
  createAddressFormSchema,
  formValuesToAddressPayload,
  type AddressFormValues,
} from '@/features/profile/schema/profileSchemas';
import {
  useAgencies,
  useDeliveryCities,
  useSaveAddress,
} from '@/features/reservation/api/useReservationQueries';
import { DeliveryAddressFields } from '@/features/reservation/components/DeliveryAddressFields';
import { isCityLocal } from '@/features/reservation/schema/reservationSchema';
import { useAuthStore } from '@/stores/authStore';
import type { Address } from '@/types/domain';

export interface AddressSheetProps {
  open: boolean;
  onClose: () => void;
  /** Adresse à modifier ; `null` pour en ajouter une. */
  address: Address | null;
  onSaved: (address: Address, mode: 'created' | 'updated') => void;
}

/** Feuille « Ajouter / Modifier une adresse » (§7.3 M5) : mêmes champs et règles qu'à la réservation (M3). */
export function AddressSheet({ open, onClose, address, onSaved }: AddressSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={address ? 'Modifier l’adresse' : 'Nouvelle adresse'}
    >
      {/* Remonté à chaque ouverture : les valeurs initiales suivent l'adresse choisie */}
      {open && <AddressForm key={address?.id ?? 'new'} address={address} onSaved={onSaved} onCancel={onClose} />}
    </Sheet>
  );
}

function AddressForm({
  address,
  onSaved,
  onCancel,
}: {
  address: Address | null;
  onSaved: AddressSheetProps['onSaved'];
  onCancel: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const { data: cities = [] } = useDeliveryCities();
  const schema = useMemo(() => createAddressFormSchema(cities), [cities]);
  const saveAddress = useSaveAddress();
  const updateAddress = useUpdateAddress();

  const form = useForm<AddressFormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: addressToFormValues(address, user),
  });
  const label = useWatch({ control: form.control, name: 'label' });
  const city = useWatch({ control: form.control, name: 'city' }) ?? '';
  const { data: agencies = [] } = useAgencies(city && !isCityLocal(city, cities) ? city : undefined);

  const pending = saveAddress.isPending || updateAddress.isPending;
  const failed = saveAddress.isError || updateAddress.isError;

  const submit = form.handleSubmit((values) => {
    const payload = formValuesToAddressPayload(values, { cities, agencies, user });
    if (address) {
      updateAddress.mutate(
        { id: address.id, payload },
        { onSuccess: (saved) => onSaved(saved, 'updated') },
      );
    } else {
      saveAddress.mutate(payload, { onSuccess: (saved) => onSaved(saved, 'created') });
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={(event) => void submit(event)} noValidate className="space-y-4">
        <fieldset>
          <legend className="text-label text-ink">NOM DE L’ADRESSE</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {ADDRESS_LABELS.map((option) => (
              <Chip
                key={option}
                type="button"
                active={label === option}
                aria-pressed={label === option}
                onClick={() => form.setValue('label', option, { shouldDirty: true })}
              >
                {option}
              </Chip>
            ))}
          </div>
        </fieldset>

        <DeliveryAddressFields cities={cities} disabled={pending} idPrefix="addr" cityLabel="VILLE *" />

        {failed && (
          <p role="alert" className="text-small text-ink">
            L’adresse n’a pas pu être enregistrée. Vérifiez votre connexion puis réessayez.
          </p>
        )}

        <div className="flex flex-col gap-3 pt-2">
          <Button type="submit" variant="primary" size="lg" fullWidth loading={pending}>
            Enregistrer l’adresse
          </Button>
          <Button type="button" variant="outline" size="lg" fullWidth onClick={onCancel} disabled={pending}>
            Annuler
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
