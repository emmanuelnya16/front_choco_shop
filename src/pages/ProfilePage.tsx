import * as m from 'motion/react-m';
import {
  Bell,
  BookOpen,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Heart,
  LogOut,
  MapPin,
  MessageCircle,
  ReceiptText,
  RotateCcw,
  Shield,
  Truck,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { Skeleton } from '@/components/ui/Primitives';
import { Sheet } from '@/components/ui/Sheet';
import { useLogout } from '@/features/auth/api/useAuthQueries';
import { usePublicSettings } from '@/features/catalog/api/useCatalogQueries';
import { buildWhatsAppQuestionUrl } from '@/features/payment/whatsapp';
import { NotificationsSheet } from '@/features/profile/components/NotificationsSheet';
import { ProfileShell } from '@/features/profile/components/ProfileShell';
import {
  getNotificationsDisplayState,
  NOTIFICATIONS_STATE_LABELS,
  type NotificationsDisplayState,
} from '@/features/profile/notifications';
import { useAddresses } from '@/features/reservation/api/useReservationQueries';
import { useReservationsAttention } from '@/features/tracking/useReservationsAttention';
import { env } from '@/lib/env';
import { cn } from '@/lib/utils/cn';
import { formatCmPhone } from '@/lib/utils/phone';
import { useDocumentTitle } from '@/lib/utils/useDocumentTitle';
import { fadeUp, staggerContainer } from '@/motion/presets';
import { useAuthStore } from '@/stores/authStore';
import { selectFavoritesCount, useFavoritesStore } from '@/stores/favoritesStore';
import { useToastStore } from '@/stores/toastStore';
import { useUiStore } from '@/stores/uiStore';
import type { User } from '@/types/domain';

const FALLBACK_WHATSAPP = '+237690000000';

function isInstalledApp(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || Boolean(window.matchMedia?.('(display-mode: standalone)').matches);
}

export function ProfilePage() {
  useDocumentTitle('Mon profil');
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  if (status === 'authenticated' && user) return <ProfileConnected user={user} />;
  if (status === 'unknown' && user) {
    return (
      <ProfileShell>
        <Skeleton className="h-40 w-full lg:rounded-[var(--radius-md)]" />
        <div className="mt-6 space-y-3 px-page lg:px-0">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      </ProfileShell>
    );
  }
  return <ProfileGuest />;
}

interface RowProps {
  icon: LucideIcon;
  label: string;
  value?: string;
  to?: string;
  href?: string;
  onClick?: () => void;
  iconClassName?: string;
}

/** Ligne de réglage de 56 px : icône à gauche, valeur éventuelle, chevron à droite (§7.2 M5). */
function SettingsRow({ icon: Icon, label, value, to, href, onClick, iconClassName }: RowProps) {
  const content = (
    <>
      <Icon className={cn('h-5 w-5 shrink-0 text-text-2', iconClassName)} aria-hidden="true" />
      <span className="flex-1 text-body text-ink">{label}</span>
      {value && <span className="text-small text-text-2">{value}</span>}
      {href ? (
        <ExternalLink className="h-4 w-4 shrink-0 text-text-2" aria-hidden="true" />
      ) : (
        <ChevronRight className="h-5 w-5 shrink-0 text-text-2" aria-hidden="true" />
      )}
    </>
  );
  const className =
    'flex min-h-[56px] w-full items-center gap-3.5 px-4 text-left transition-colors [@media(hover:hover)]:hover:bg-surface';

  if (to) {
    return (
      <Link to={to} viewTransition className={className}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function SettingsGroup({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <m.section variants={fadeUp} id={id} aria-labelledby={`${id ?? title}-titre`} className="scroll-mt-28">
      <h2 id={`${id ?? title}-titre`} className="px-1 text-label text-text-2">
        {title}
      </h2>
      <ul className="mt-2 divide-y divide-silver/60 overflow-hidden rounded-[var(--radius-md)] border border-silver/70 bg-white">
        {children}
      </ul>
    </m.section>
  );
}

function HelpAndLegalRows({ whatsappNumber }: { whatsappNumber: string }) {
  return (
    <>
      <SettingsGroup id="aide" title="Aide">
        <li>
          <SettingsRow icon={MessageCircle} label="Contacter la boutique sur WhatsApp" href={buildWhatsAppQuestionUrl(whatsappNumber)} />
        </li>
        <li>
          <SettingsRow icon={BookOpen} label="Comment réserver" to="/#comment-reserver" />
        </li>
        <li>
          <SettingsRow icon={Truck} label="Livraison et retrait" to="/pages/livraison-et-retrait" />
        </li>
      </SettingsGroup>
      <SettingsGroup title="Légal">
        <li>
          <SettingsRow icon={FileText} label="Conditions générales" to="/pages/conditions-generales" />
        </li>
        <li>
          <SettingsRow icon={RotateCcw} label="Politique d’annulation et de retour" to="/pages/politique-retour" />
        </li>
        <li>
          <SettingsRow icon={Shield} label="Confidentialité" to="/pages/confidentialite" />
        </li>
      </SettingsGroup>
    </>
  );
}

/** Non connecté (§7.1 M5) : invitation sobre et liens publics. */
function ProfileGuest() {
  const openAuthSheet = useUiStore((s) => s.openAuthSheet);
  const favoritesCount = useFavoritesStore(selectFavoritesCount);
  const { data: settings } = usePublicSettings();

  return (
    <div className="mx-auto w-full max-w-xl px-page pt-8 pb-12">
      <m.div variants={staggerContainer(0.04)} initial="hidden" animate="visible" className="space-y-8">
        <m.div variants={fadeUp} className="flex flex-col items-center text-center">
          <Logo variant="dark" size="md" />
          <h1 className="mt-6 text-h1 text-ink">Votre espace</h1>
          <p className="mt-3 max-w-sm text-body text-text-2">
            Suivez vos réservations, retrouvez vos adresses et vos favoris.
          </p>
          <Button variant="primary" size="lg" fullWidth className="mt-6" onClick={() => openAuthSheet()}>
            Me connecter avec mon numéro
          </Button>
        </m.div>
        <SettingsGroup title="Sur ce téléphone">
          <li>
            <SettingsRow
              icon={Heart}
              label="Mes favoris"
              value={favoritesCount > 0 ? String(favoritesCount) : undefined}
              to="/favoris"
            />
          </li>
        </SettingsGroup>
        <HelpAndLegalRows whatsappNumber={settings?.whatsappNumber ?? FALLBACK_WHATSAPP} />
      </m.div>
    </div>
  );
}

function ProfileConnected({ user }: { user: User }) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const showToast = useToastStore((s) => s.show);
  const logout = useLogout();
  const { data: settings } = usePublicSettings();
  const { data: addresses } = useAddresses();
  const favoritesCount = useFavoritesStore(selectFavoritesCount);
  const { needsAttention, activeCount } = useReservationsAttention();

  const [installed] = useState(isInstalledApp);
  const [notificationsState, setNotificationsState] = useState<NotificationsDisplayState>(
    getNotificationsDisplayState,
  );
  const [logoutOpen, setLogoutOpen] = useState(false);
  const notificationsOpen = searchParams.get('notifications') === '1';

  const setNotificationsOpen = (open: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (open) next.set('notifications', '1');
    else next.delete('notifications');
    setSearchParams(next, { replace: true });
  };

  // Lien « Aide » de la colonne de gauche (ordinateur)
  useEffect(() => {
    if (location.hash !== '#aide') return;
    document.getElementById('aide')?.scrollIntoView({ block: 'start' });
  }, [location.hash]);

  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Client DR Choco';
  const initial = (user.firstName ?? name).trim().charAt(0).toUpperCase() || 'D';

  return (
    <ProfileShell>
      <m.div variants={staggerContainer(0.04)} initial="hidden" animate="visible">
        {/* En-tête */}
        <m.header
          variants={fadeUp}
          className="flex items-center gap-4 bg-ink px-page pt-safe pb-6 text-white lg:rounded-[var(--radius-md)] lg:p-6"
        >
          <div className="mt-6 flex w-full items-center gap-4 lg:mt-0">
            <span
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-full)] bg-ink-2 text-h2 text-white"
            >
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-h2 text-white">{name}</h1>
              <p className="mt-0.5 font-mono text-small text-silver">+237 {formatCmPhone(user.phone)}</p>
            </div>
            <Link
              to="/profil/informations"
              viewTransition
              className="inline-flex min-h-[44px] items-center px-2 text-small font-semibold text-white underline underline-offset-2"
            >
              Modifier
            </Link>
          </div>
        </m.header>

        <div className="space-y-7 px-page pt-6 lg:px-0">
          {/* Raccourcis */}
          <m.div variants={fadeUp} className="grid grid-cols-2 gap-3">
            <Link
              to="/reservations"
              viewTransition
              className="relative flex min-h-[104px] flex-col justify-between rounded-[var(--radius-md)] bg-surface p-4 transition-colors [@media(hover:hover)]:hover:bg-silver/40"
            >
              <ReceiptText className="h-5 w-5 text-ink" aria-hidden="true" />
              <span>
                <span className="block text-h3 text-ink">Mes réservations</span>
                <span className="text-small text-text-2">
                  {activeCount === undefined ? '…' : `${activeCount} en cours`}
                </span>
              </span>
              {needsAttention && (
                <span className="absolute top-4 right-4 h-2.5 w-2.5 rounded-[var(--radius-full)] bg-red">
                  <span className="sr-only">Une réservation demande votre attention</span>
                </span>
              )}
            </Link>
            <Link
              to="/favoris"
              viewTransition
              className="flex min-h-[104px] flex-col justify-between rounded-[var(--radius-md)] bg-surface p-4 transition-colors [@media(hover:hover)]:hover:bg-silver/40"
            >
              <Heart className="h-5 w-5 text-ink" aria-hidden="true" />
              <span>
                <span className="block text-h3 text-ink">Mes favoris</span>
                <span className="text-small text-text-2">
                  {favoritesCount} article{favoritesCount > 1 ? 's' : ''}
                </span>
              </span>
            </Link>
          </m.div>

          <SettingsGroup title="Mon compte">
            <li>
              <SettingsRow icon={UserRound} label="Mes informations" to="/profil/informations" />
            </li>
            <li>
              <SettingsRow
                icon={MapPin}
                label="Mes adresses"
                value={addresses ? String(addresses.length) : undefined}
                to="/profil/adresses"
              />
            </li>
          </SettingsGroup>

          <SettingsGroup title="Application">
            <li>
              <SettingsRow
                icon={Bell}
                label="Notifications"
                value={NOTIFICATIONS_STATE_LABELS[notificationsState]}
                onClick={() => setNotificationsOpen(true)}
              />
            </li>
            {!installed && (
              <li>
                <SettingsRow
                  icon={Download}
                  label="Installer l’application"
                  // HYPOTHÈSE: l'installation réelle (beforeinstallprompt) arrive avec le module M6.
                  onClick={() => showToast({ message: 'Bientôt disponible : l’installation arrive avec la prochaine mise à jour.' })}
                />
              </li>
            )}
          </SettingsGroup>

          <HelpAndLegalRows whatsappNumber={settings?.whatsappNumber ?? FALLBACK_WHATSAPP} />

          {/* Déconnexion */}
          <m.div variants={fadeUp}>
            <ul className="overflow-hidden rounded-[var(--radius-md)] border border-silver/70 bg-white">
              <li>
                <SettingsRow
                  icon={LogOut}
                  iconClassName="text-red"
                  label="Se déconnecter"
                  onClick={() => setLogoutOpen(true)}
                />
              </li>
            </ul>
          </m.div>

          <m.p variants={fadeUp} className="pb-2 text-center text-small text-text-2">
            DR Choco L’Incompris · version {env.appVersion}
          </m.p>
        </div>
      </m.div>

      <NotificationsSheet
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onStateChange={setNotificationsState}
      />

      <Sheet open={logoutOpen} onClose={() => setLogoutOpen(false)} title="Se déconnecter ?">
        <p className="text-body text-text-2">Votre panier sera conservé sur ce téléphone.</p>
        <div className="mt-6 flex flex-col gap-3">
          <Button
            variant="danger"
            size="lg"
            fullWidth
            loading={logout.isPending}
            onClick={() =>
              logout.mutate(undefined, {
                onSettled: () => {
                  setLogoutOpen(false);
                  showToast({ message: 'Vous êtes déconnecté. À bientôt !' });
                },
              })
            }
          >
            Me déconnecter
          </Button>
          <Button variant="outline" size="lg" fullWidth onClick={() => setLogoutOpen(false)}>
            Rester connecté
          </Button>
        </div>
      </Sheet>
    </ProfileShell>
  );
}
