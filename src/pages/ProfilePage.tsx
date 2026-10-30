import {
  ArrowRight,
  Heart,
  LogOut,
  MapPin,
  Phone,
  ReceiptText,
  User as UserIcon,
} from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Primitives';
import { useLogout } from '@/features/auth/api/useAuthQueries';
import { useAddresses } from '@/features/reservation/api/useReservationQueries';
import { formatCmPhone } from '@/lib/utils/phone';
import { useAuthStore } from '@/stores/authStore';
import { selectFavoritesCount, useFavoritesStore } from '@/stores/favoritesStore';
import { useToastStore } from '@/stores/toastStore';
import { useUiStore } from '@/stores/uiStore';

/**
 * Page Profil (`/profil`, §5.1 & §5.5) :
 * - Ouvre la feuille de connexion OTP si le client n'est pas encore connecté.
 * - Une fois connecté : affiche ses coordonnées, ses adresses enregistrées,
 *   l'accès à ses favoris et réservations, et le bouton « Se déconnecter »
 *   (`POST /auth/logout`, vidant la session et les réservations en cache tout en conservant le panier).
 */
export function ProfilePage() {
  const favoritesCount = useFavoritesStore(selectFavoritesCount);
  const authStatus = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const openAuthSheet = useUiStore((s) => s.openAuthSheet);
  const showToast = useToastStore((s) => s.show);

  const { data: addresses = [] } = useAddresses();
  const logout = useLogout();

  useEffect(() => {
    document.title = "Profil · DR Choco L'Incompris";
  }, []);

  // Demande la connexion à l'ouverture du Profil si non connecté (§5.1)
  useEffect(() => {
    if (authStatus !== 'authenticated') {
      openAuthSheet();
    }
  }, [authStatus, openAuthSheet]);

  const handleLogout = async () => {
    await logout.mutateAsync();
    showToast({
      message: 'Vous êtes déconnecté',
      subtitle: 'Votre panier a été conservé sur cet appareil.',
      durationMs: 3500,
    });
  };

  return (
    <Container className="py-8 lg:py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <span className="text-label text-text-2">ESPACE CLIENT</span>
          <h1 className="mt-1 text-h1 text-ink">MON PROFIL</h1>
        </div>

        {/* Bloc session client (§5.5) */}
        {authStatus === 'authenticated' && user ? (
          <div className="rounded-[var(--radius-md)] border border-silver bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-ink text-h2 text-white">
                  {(user.firstName?.[0] ?? 'C').toUpperCase()}
                </span>
                <div>
                  <h2 className="text-h2 text-ink">
                    {[user.firstName, user.lastName].filter(Boolean).join(' ') ||
                      'Client DR Choco'}
                  </h2>
                  <p className="mt-0.5 flex items-center gap-1.5 font-mono text-small font-semibold text-text-2">
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>+237 {formatCmPhone(user.phone)}</span>
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                loading={logout.isPending}
                iconLeft={<LogOut className="h-4 w-4" aria-hidden="true" />}
                onClick={handleLogout}
              >
                Se déconnecter
              </Button>
            </div>

            {addresses.length > 0 && (
              <div className="mt-6 border-t border-silver/60 pt-5">
                <h3 className="text-label text-text-2">
                  ADRESSES ENREGISTRÉES ({addresses.length})
                </h3>
                <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {addresses.map((addr) => (
                    <li
                      key={addr.id}
                      className="rounded-[var(--radius-md)] border border-silver/70 bg-surface/60 p-3.5 text-small"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-ink">
                          {addr.label}
                        </span>
                        {addr.isDefault && (
                          <span className="text-[11px] font-bold text-red">
                            Par défaut
                          </span>
                        )}
                      </div>
                      <p className="mt-1 flex items-center gap-1 font-semibold text-ink">
                        <MapPin className="h-3.5 w-3.5 text-text-2" aria-hidden="true" />
                        <span>
                          {addr.city} · {addr.district || addr.quarter}
                        </span>
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-text-2">
                        {addr.landmark || addr.details}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-[var(--radius-md)] border border-silver bg-surface p-6">
            <div className="flex items-center gap-3">
              <UserIcon className="h-5 w-5 text-ink" aria-hidden="true" />
              <span className="text-label text-ink">CONNEXION RAPIDE PAR SMS</span>
            </div>
            <p className="mt-2 text-small text-text-2">
              Connectez-vous avec votre numéro de téléphone pour retrouver vos
              réservations et vos adresses enregistrées, sans mot de passe.
            </p>
            <div className="mt-4">
              <Button
                variant="primary"
                size="md"
                onClick={() => openAuthSheet()}
              >
                Se connecter par SMS
              </Button>
            </div>
          </div>
        )}

        {/* Raccourci direct vers Mes favoris */}
        <Link
          to="/favoris"
          viewTransition
          className="group flex items-center justify-between rounded-[var(--radius-md)] border border-silver bg-white p-5 transition-colors hover:border-ink"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-full)] bg-surface text-red">
              <Heart className="h-5 w-5 fill-red text-red" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-h3 text-ink">Mes favoris</h2>
              <p className="text-small text-text-2">
                {favoritesCount > 0
                  ? `${favoritesCount} article${favoritesCount > 1 ? 's' : ''} enregistré${favoritesCount > 1 ? 's' : ''}`
                  : 'Retrouvez les articles que vous avez mis de côté'}
              </p>
            </div>
          </div>
          <ArrowRight
            className="h-5 w-5 text-text-2 transition-transform group-hover:translate-x-1 group-hover:text-ink"
            aria-hidden="true"
          />
        </Link>

        {/* Raccourci vers Mes réservations */}
        <Link
          to="/reservations"
          viewTransition
          className="group flex items-center justify-between rounded-[var(--radius-md)] border border-silver bg-white p-5 transition-colors hover:border-ink"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-full)] bg-surface text-ink">
              <ReceiptText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-h3 text-ink">Mes réservations</h2>
              <p className="text-small text-text-2">
                Suivez vos réservations 24 h et vos preuves de paiement
              </p>
            </div>
          </div>
          <ArrowRight
            className="h-5 w-5 text-text-2 transition-transform group-hover:translate-x-1 group-hover:text-ink"
            aria-hidden="true"
          />
        </Link>
      </div>
    </Container>
  );
}
