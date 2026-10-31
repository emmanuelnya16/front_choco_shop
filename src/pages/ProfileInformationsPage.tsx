import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Lock } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { useUpdateProfile } from '@/features/auth/api/useAuthQueries';
import { ProfileShell } from '@/features/profile/components/ProfileShell';
import { profileFormSchema, type ProfileFormValues } from '@/features/profile/schema/profileSchemas';
import { useDeliveryCities } from '@/features/reservation/api/useReservationQueries';
import { CityPickerField } from '@/features/reservation/components/CityPickerField';
import { cn } from '@/lib/utils/cn';
import { formatCmPhone } from '@/lib/utils/phone';
import { useDocumentTitle } from '@/lib/utils/useDocumentTitle';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useUiStore } from '@/stores/uiStore';
import type { User } from '@/types/domain';

export function ProfileInformationsPage() {
  useDocumentTitle('Mes informations');
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const openAuthSheet = useUiStore((s) => s.openAuthSheet);

  return (
    <ProfileShell>
      <div className="px-page pt-6 lg:px-0 lg:pt-0">
        <BackButton fallback="/profil" label="Profil" className="lg:hidden" />
        <h1 className="mt-2 text-h1 text-ink lg:mt-0">Mes informations</h1>
        {status === 'authenticated' && user ? (
          <InformationsForm user={user} />
        ) : (
          <div className="mt-6">
            <p className="text-body text-text-2">Connectez-vous pour modifier vos informations.</p>
            <Button variant="primary" size="lg" className="mt-5" onClick={() => openAuthSheet()}>
              Me connecter
            </Button>
          </div>
        )}
      </div>
    </ProfileShell>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

function InformationsForm({ user }: { user: User }) {
  const navigate = useNavigate();
  const showToast = useToastStore((s) => s.show);
  const updateProfile = useUpdateProfile();
  const { data: cities = [] } = useDeliveryCities();

  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    mode: 'onTouched',
    defaultValues: {
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      city: user.city ?? 'Douala',
    },
  });
  const city = useWatch({ control, name: 'city' });

  const submit = handleSubmit((values) => {
    updateProfile.mutate(
      { firstName: values.firstName, lastName: values.lastName, city: values.city },
      {
        onSuccess: () => {
          showToast({ message: 'Vos informations sont enregistrées' });
          navigate('/profil', { viewTransition: true });
        },
      },
    );
  });

  const inputClass = (hasError: boolean) =>
    cn(
      'mt-1.5 h-12 w-full rounded-[var(--radius-md)] border bg-white px-3.5 text-[16px] text-ink placeholder:text-text-2 focus:border-ink focus:outline-none',
      hasError ? 'border-danger' : 'border-silver',
    );

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="mt-6 max-w-xl space-y-5">
      <div>
        <label htmlFor="profile-firstName" className="block text-label text-ink">
          PRÉNOM *
        </label>
        <input
          id="profile-firstName"
          type="text"
          autoComplete="given-name"
          aria-invalid={Boolean(errors.firstName)}
          aria-describedby={errors.firstName ? 'profile-firstName-error' : undefined}
          {...register('firstName')}
          className={inputClass(Boolean(errors.firstName))}
        />
        <FieldError id="profile-firstName-error" message={errors.firstName?.message} />
      </div>

      <div>
        <label htmlFor="profile-lastName" className="block text-label text-ink">
          NOM
        </label>
        <input
          id="profile-lastName"
          type="text"
          autoComplete="family-name"
          aria-invalid={Boolean(errors.lastName)}
          {...register('lastName')}
          className={inputClass(Boolean(errors.lastName))}
        />
        <FieldError id="profile-lastName-error" message={errors.lastName?.message} />
      </div>

      <div>
        <span className="mb-1.5 block text-label text-ink">VILLE *</span>
        <CityPickerField
          cities={cities}
          value={city}
          error={errors.city?.message}
          onChange={(nextCity) => setValue('city', nextCity, { shouldValidate: true, shouldDirty: true })}
        />
        <FieldError id="profile-city-error" message={errors.city?.message} />
      </div>

      <div>
        <label htmlFor="profile-phone" className="block text-label text-ink">
          TÉLÉPHONE
        </label>
        <div className="relative">
          <input
            id="profile-phone"
            type="tel"
            readOnly
            value={`+237 ${formatCmPhone(user.phone)}`}
            aria-describedby="profile-phone-help"
            className="mt-1.5 h-12 w-full rounded-[var(--radius-md)] border border-silver bg-surface px-3.5 pr-10 font-mono text-[16px] text-ink"
          />
          <Lock className="pointer-events-none absolute top-1/2 right-3.5 mt-0.75 h-4 w-4 -translate-y-1/2 text-text-2" aria-hidden="true" />
        </div>
        <p id="profile-phone-help" className="mt-1.5 text-xs text-text-2">
          Pour changer de numéro, déconnectez-vous et connectez-vous avec le nouveau.
        </p>
      </div>

      {updateProfile.isError && (
        <p role="alert" className="text-small text-ink">
          L’enregistrement a échoué. Vérifiez votre connexion puis réessayez.
        </p>
      )}

      <Button type="submit" variant="primary" size="lg" loading={updateProfile.isPending} className="w-full sm:w-auto">
        Enregistrer
      </Button>
    </form>
  );
}
