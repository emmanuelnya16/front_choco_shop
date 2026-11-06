import {
  ExternalLink,
  FileText,
  Layers,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Package,
  ReceiptText,
  Search,
  Settings,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { Logo } from '@/components/ui/Logo';
import { Sheet } from '@/components/ui/Sheet';
import { Toaster } from '@/components/ui/Toast';
import { useAdminDashboard, useAdminLogout } from '@/features/admin/api/useAdminQueries';
import { useAdminAuthStore } from '@/features/admin/auth/adminAuthStore';
import { AdminQuickSearch } from '@/features/admin/layout/AdminQuickSearch';
import { ADMIN_ROLE_LABELS } from '@/features/admin/types';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { cn } from '@/lib/utils/cn';

interface AdminNavItem {
  to: string;
  label: string;
  shortLabel: string;
  Icon: LucideIcon;
  end?: boolean;
  badgeCount?: number;
  badgeTone?: 'red' | 'warning';
}

export function AdminLayout() {
  const navigate = useNavigate();
  const admin = useAdminAuthStore((s) => s.admin);
  const logoutMutation = useAdminLogout();
  const { data: dashboard } = useAdminDashboard();
  const isOnline = useOnlineStatus();

  const [searchOpen, setSearchOpen] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);

  const reservationsAttentionCount =
    (dashboard?.counts.pendingValidation ?? 0) + (dashboard?.counts.toPrepare ?? 0);
  const outOfStockCount = dashboard?.counts.outOfStockVariants ?? 0;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navItems: AdminNavItem[] = [
    {
      to: '/admin',
      label: 'Tableau de bord',
      shortLabel: 'Accueil',
      Icon: LayoutDashboard,
      end: true,
    },
    {
      to: '/admin/reservations',
      label: 'Réservations',
      shortLabel: 'Réservations',
      Icon: ReceiptText,
      badgeCount: reservationsAttentionCount,
      badgeTone: 'red',
    },
    {
      to: '/admin/catalogue',
      label: 'Catalogue',
      shortLabel: 'Catalogue',
      Icon: Package,
      badgeCount: outOfStockCount,
      badgeTone: 'warning',
    },
    {
      to: '/admin/categories',
      label: 'Looks & Catégories',
      shortLabel: 'Catégories',
      Icon: Layers,
    },
    {
      to: '/admin/contenus',
      label: 'Contenus (Aide & Légal)',
      shortLabel: 'Contenus',
      Icon: FileText,
    },
    {
      to: '/admin/parametres/paiement',
      label: 'Paramètres',
      shortLabel: 'Paramètres',
      Icon: Settings,
    },
  ];

  const handleLogout = async () => {
    setMoreSheetOpen(false);
    await logoutMutation.mutateAsync();
    navigate('/admin/connexion', { replace: true });
  };

  const roleLabel = admin ? ADMIN_ROLE_LABELS[admin.role] : 'Administrateur';

  return (
    <div className="min-h-dvh bg-surface text-ink">
      {/* Barre latérale fixe sur ordinateur (lg+) */}
      <aside
        aria-label="Navigation principale de l’administration"
        className="fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col border-r border-ink-2 bg-ink text-white lg:flex"
      >
        <div className="flex h-16 items-center justify-between border-b border-ink-2 px-5">
          <Link to="/admin" className="inline-flex items-center gap-2">
            <Logo variant="light" size="sm" />
          </Link>
          <span className="rounded-[var(--radius-sm)] bg-ink-2 px-2 py-0.5 text-[10px] font-bold tracking-[0.08em] text-silver uppercase">
            ADMIN
          </span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.Icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 items-center justify-between gap-2.5 rounded-[var(--radius-md)] px-3 py-2.5 text-small font-semibold transition-colors duration-fast',
                    isActive
                      ? 'bg-ink-2 text-white shadow-[inset_3px_0_0_var(--color-red)]'
                      : 'text-silver hover:bg-ink-2/60 hover:text-white',
                  )
                }
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                  <span
                    aria-label={`${item.badgeCount} élément${item.badgeCount > 1 ? 's' : ''} à traiter`}
                    className={cn(
                      'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-[var(--radius-full)] px-1.5 text-[11px] font-bold tabular-nums',
                      item.badgeTone === 'warning'
                        ? 'bg-warning text-ink'
                        : 'bg-red text-white',
                    )}
                  >
                    {item.badgeCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-ink-2 p-3">
          <Link
            to="/"
            className="mb-2 flex min-h-11 items-center justify-between rounded-[var(--radius-md)] px-3 py-2 text-small font-semibold text-silver transition-colors hover:bg-ink-2 hover:text-white"
          >
            <span>Voir la boutique</span>
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
          </Link>

          {admin && (
            <div className="rounded-[var(--radius-md)] bg-ink-2 p-3">
              <div className="mb-2 min-w-0">
                <p className="truncate text-small font-bold text-white">{admin.name}</p>
                <p className="truncate text-xs text-silver">
                  {roleLabel} · {admin.email}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-silver/30 bg-ink px-3 py-2 text-xs font-semibold text-white transition-colors hover:border-white hover:bg-ink-2"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Se déconnecter</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Colonne principale */}
      <div className="flex min-h-dvh flex-col pb-20 lg:pl-[240px] lg:pb-8">
        {/* Barre supérieure */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-silver bg-white px-page">
          <div className="flex items-center gap-2.5 lg:hidden">
            <Link to="/admin" className="inline-flex items-center gap-2">
              <Logo variant="dark" size="sm" />
            </Link>
            <span className="rounded-[var(--radius-sm)] bg-ink px-2 py-0.5 text-[10px] font-bold tracking-[0.08em] text-white uppercase">
              ADMIN
            </span>
          </div>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Rechercher une réservation, un numéro ou un produit"
            className="flex min-h-11 flex-1 items-center justify-between gap-3 rounded-[var(--radius-md)] border border-silver bg-surface px-3.5 py-2 text-left text-small text-text-2 transition-colors hover:border-ink hover:text-ink lg:max-w-[460px]"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <Search className="h-4 w-4 shrink-0 text-grey" aria-hidden="true" />
              <span className="truncate">
                Rechercher une réservation (RES-…), un numéro, un produit…
              </span>
            </span>
            <kbd className="hidden shrink-0 rounded-[var(--radius-sm)] border border-silver bg-white px-2 py-0.5 font-mono text-xs text-text-2 sm:inline-block">
              Ctrl K
            </kbd>
          </button>

          <div className="flex items-center gap-3">
            {!isOnline && (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-full)] bg-warning px-3 py-1 text-xs font-bold text-ink"
              >
                <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Hors ligne</span>
              </span>
            )}

            {admin && (
              <div className="hidden items-center gap-2 text-right lg:flex">
                <div>
                  <p className="text-small font-semibold text-ink">{admin.name}</p>
                  <p className="text-xs text-text-2">{roleLabel}</p>
                </div>
              </div>
            )}
          </div>
        </header>

        {!isOnline && (
          <div
            role="status"
            className="border-b border-warning bg-warning px-page py-2 text-xs font-semibold text-ink"
          >
            Hors connexion — Vous consultez les dernières données synchronisées. Les validations de preuves nécessitent une connexion Internet.
          </div>
        )}

        {/* Contenu de la page admin */}
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-page py-6">
          <Outlet />
        </main>
      </div>

      {/* Barre d'onglets basse sur mobile (< lg) */}
      <nav
        aria-label="Navigation mobile de l’administration"
        className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-silver bg-white px-2 lg:hidden"
      >
        {navItems.slice(0, 3).map((item) => {
          const Icon = item.Icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'relative flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] py-1 text-xs font-semibold transition-colors',
                  isActive ? 'text-red' : 'text-text-2 hover:text-ink',
                )
              }
            >
              <div className="relative">
                <Icon className="h-5 w-5" aria-hidden="true" />
                {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                  <span
                    className={cn(
                      'absolute -top-1.5 -right-2.5 inline-flex h-4 min-w-4 items-center justify-center rounded-[var(--radius-full)] px-1 text-[10px] font-bold tabular-nums',
                      item.badgeTone === 'warning'
                        ? 'bg-warning text-ink'
                        : 'bg-red text-white',
                    )}
                  >
                    {item.badgeCount}
                  </span>
                )}
              </div>
              <span>{item.shortLabel}</span>
            </NavLink>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreSheetOpen(true)}
          aria-expanded={moreSheetOpen}
          className="flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] py-1 text-xs font-semibold text-text-2 transition-colors hover:text-ink"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
          <span>Plus</span>
        </button>
      </nav>

      {/* Feuille « Plus » sur mobile */}
      <Sheet
        open={moreSheetOpen}
        onClose={() => setMoreSheetOpen(false)}
        title="Menu administration"
      >
        <div className="space-y-2 pb-4">
          {admin && (
            <div className="mb-4 rounded-[var(--radius-md)] border border-silver bg-surface p-3.5">
              <p className="text-small font-bold text-ink">{admin.name}</p>
              <p className="text-xs text-text-2">
                {roleLabel} · {admin.email}
              </p>
            </div>
          )}

          {navItems.slice(3).map((item) => {
            const Icon = item.Icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMoreSheetOpen(false)}
                className="flex min-h-12 items-center gap-3 rounded-[var(--radius-md)] border border-silver bg-white px-4 py-2.5 text-small font-semibold text-ink transition-colors hover:bg-surface"
              >
                <Icon className="h-4 w-4 text-text-2" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <Link
            to="/"
            onClick={() => setMoreSheetOpen(false)}
            className="flex min-h-12 items-center justify-between rounded-[var(--radius-md)] border border-silver bg-white px-4 py-2.5 text-small font-semibold text-ink transition-colors hover:bg-surface"
          >
            <span>Voir la boutique cliente</span>
            <ExternalLink className="h-4 w-4 text-text-2" aria-hidden="true" />
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-danger bg-white px-4 py-2.5 text-small font-semibold text-danger transition-colors hover:bg-surface"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </Sheet>

      {/* Modale de recherche rapide */}
      <AdminQuickSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Notifications flash (toasts) */}
      <Toaster />
    </div>
  );
}

