import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowLeft, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { useAdminLogin } from '@/features/admin/api/useAdminQueries';
import { sanitizeAdminRedirect } from '@/features/admin/auth/adminRedirect';
import { useAdminAuthStore } from '@/features/admin/auth/adminAuthStore';
import { ApiError } from '@/lib/api/client';
import { useSeo } from '@/lib/seo/useSeo';
import { cn } from '@/lib/utils/cn';

const adminLoginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, 'Veuillez saisir votre adresse e-mail ou votre numéro de téléphone.'),
  password: z
    .string()
    .min(4, 'Veuillez saisir votre mot de passe (4 caractères minimum).'),
});

type AdminLoginFormValues = z.infer<typeof adminLoginSchema>;

export default function AdminLoginPage() {
  useSeo({
    title: 'Connexion — Administration DR Choco',
    description:
      'Accès réservé à l’équipe DR Choco L’Incompris pour la gestion des réservations et du catalogue.',
    noindex: true,
  });

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = sanitizeAdminRedirect(searchParams.get('redirect'));

  const status = useAdminAuthStore((s) => s.status);
  const admin = useAdminAuthStore((s) => s.admin);
  const loginMutation = useAdminLogin();

  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<AdminLoginFormValues>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  if (status === 'authenticated' && admin) {
    return <Navigate to={redirectTarget} replace />;
  }

  const onSubmit = async (values: AdminLoginFormValues) => {
    setServerError(null);
    try {
      await loginMutation.mutateAsync({
        identifier: values.identifier.trim(),
        password: values.password,
      });
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setServerError('Identifiant ou mot de passe incorrect.');
        } else if (err.status === 429) {
          setServerError('Trop de tentatives. Réessayez dans 15\u00A0minutes.');
        } else {
          setServerError(err.message || 'Une erreur est survenue lors de la connexion.');
        }
      } else {
        setServerError('Connexion impossible. Vérifiez votre accès Internet.');
      }
    }
  };

  const handleFillDemoAccount = () => {
    setServerError(null);
    clearErrors();
    setValue('identifier', 'admin@drchoco.cm', { shouldValidate: true });
    setValue('password', 'choco2026', { shouldValidate: true });
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-ink px-page py-10 text-white">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo variant="light" size="md" />
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-[var(--radius-full)] border border-ink-2 bg-ink-2 px-3 py-1 text-label text-white">
            <ShieldCheck className="h-3.5 w-3.5 text-red" aria-hidden="true" />
            ESPACE ADMINISTRATION
          </span>
        </div>

        <section
          aria-labelledby="admin-login-heading"
          className="rounded-[var(--radius-lg)] border border-silver bg-white p-6 text-ink shadow-[var(--shadow-lg)] sm:p-8"
        >
          <header className="mb-6">
            <h1 id="admin-login-heading" className="text-h2 text-ink">
              Connexion boutique
            </h1>
            <p className="mt-1.5 text-small text-text-2">
              Gestion des réservations, des preuves Mobile Money et du catalogue.
            </p>
          </header>

          {serverError && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-[var(--radius-md)] border border-danger bg-surface p-3.5 text-small text-danger"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="admin-identifier"
                className="mb-1.5 block text-small font-semibold text-ink"
              >
                Identifiant (e-mail ou téléphone)
              </label>
              <input
                id="admin-identifier"
                type="text"
                autoComplete="username"
                placeholder="admin@drchoco.cm ou 690 00 00 00"
                aria-invalid={Boolean(errors.identifier)}
                aria-describedby={errors.identifier ? 'admin-identifier-error' : undefined}
                className={cn(
                  'h-12 w-full rounded-[var(--radius-md)] border bg-white px-3.5 text-body text-ink placeholder:text-grey transition-colors duration-fast focus:outline-none',
                  errors.identifier
                    ? 'border-danger focus:border-danger'
                    : 'border-silver focus:border-ink',
                )}
                {...register('identifier')}
              />
              {errors.identifier && (
                <p
                  id="admin-identifier-error"
                  role="alert"
                  className="mt-1.5 text-xs font-medium text-danger"
                >
                  {errors.identifier.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="mb-1.5 block text-small font-semibold text-ink"
              >
                Mot de passe
              </label>
              <div className="relative flex items-center">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Votre mot de passe"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'admin-password-error' : undefined}
                  className={cn(
                    'h-12 w-full rounded-[var(--radius-md)] border bg-white pr-12 pl-3.5 text-body text-ink placeholder:text-grey transition-colors duration-fast focus:outline-none',
                    errors.password
                      ? 'border-danger focus:border-danger'
                      : 'border-silver focus:border-ink',
                  )}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
                  }
                  className="absolute right-1 inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-text-2 transition-colors hover:bg-surface hover:text-ink"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p
                  id="admin-password-error"
                  role="alert"
                  className="mt-1.5 text-xs font-medium text-danger"
                >
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={loginMutation.isPending}
              >
                Se connecter
              </Button>
            </div>
          </form>

          {import.meta.env.DEV && (
            <div className="mt-5 border-t border-silver pt-4">
              <button
                type="button"
                onClick={handleFillDemoAccount}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-silver bg-surface px-3 py-2 text-xs font-semibold text-text-2 transition-colors hover:border-ink hover:text-ink"
              >
                <KeyRound className="h-3.5 w-3.5 text-red" aria-hidden="true" />
                <span>Remplir le compte de démo (admin@drchoco.cm)</span>
              </button>
            </div>
          )}
        </section>

        <div className="mt-6 text-center">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 px-3 text-small font-semibold text-silver transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Retour à la boutique</span>
          </Link>
        </div>
      </div>
    </main>
  );
}

