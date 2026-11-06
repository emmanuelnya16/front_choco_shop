import { Loader2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { silentAdminRefresh } from '@/features/admin/api/adminClient';
import { useAdminAuthStore } from '@/features/admin/auth/adminAuthStore';

export interface AdminAuthGuardProps {
  children?: ReactNode;
}

export function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const location = useLocation();
  const status = useAdminAuthStore((s) => s.status);
  const admin = useAdminAuthStore((s) => s.admin);
  const accessToken = useAdminAuthStore((s) => s.accessToken);

  const needsSilentRefresh = status === 'unknown' || (Boolean(admin) && !accessToken);
  const [refreshAttempted, setRefreshAttempted] = useState(false);

  useEffect(() => {
    if (!needsSilentRefresh || refreshAttempted) {
      return undefined;
    }
    let active = true;
    void silentAdminRefresh().finally(() => {
      if (active) {
        setRefreshAttempted(true);
      }
    });
    return () => {
      active = false;
    };
  }, [needsSilentRefresh, refreshAttempted]);

  if ((needsSilentRefresh && !refreshAttempted) || status === 'unknown') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-surface px-page text-ink"
      >
        <Loader2 className="h-6 w-6 animate-spin text-red" aria-hidden="true" />
        <p className="text-small text-grey">Vérification de la session administrateur…</p>
      </div>
    );
  }

  if (status === 'guest' || !admin) {
    const requestedPath = `${location.pathname}${location.search}`;
    const target =
      requestedPath && requestedPath !== '/admin'
        ? `/admin/connexion?redirect=${encodeURIComponent(requestedPath)}`
        : '/admin/connexion';
    return <Navigate to={target} replace />;
  }

  return <>{children ?? <Outlet />}</>;
}
