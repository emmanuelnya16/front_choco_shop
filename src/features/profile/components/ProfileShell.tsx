import { Bell, LifeBuoy, MapPin, UserRound, UserSquare2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { cn } from '@/lib/utils/cn';

const NAV_ITEMS = [
  { to: '/profil', label: 'Mon espace', icon: UserSquare2, match: (path: string, search: string, hash: string) => path === '/profil' && !search.includes('notifications') && hash !== '#aide' },
  { to: '/profil/informations', label: 'Informations', icon: UserRound, match: (path: string) => path === '/profil/informations' },
  { to: '/profil/adresses', label: 'Adresses', icon: MapPin, match: (path: string) => path === '/profil/adresses' },
  { to: '/profil?notifications=1', label: 'Notifications', icon: Bell, match: (_p: string, search: string) => search.includes('notifications') },
  { to: '/profil#aide', label: 'Aide', icon: LifeBuoy, match: (path: string, _s: string, hash: string) => path === '/profil' && hash === '#aide' },
];

/**
 * Cadre de l'espace client (§7.2 M5) : sur ordinateur, colonne de navigation à gauche
 * (Informations, Adresses, Notifications, Aide) et contenu à droite ; sur mobile, contenu seul.
 */
export function ProfileShell({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="mx-auto w-full max-w-content pb-12 lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-10 lg:px-page lg:pt-10">
      <nav aria-label="Mon espace" className="hidden lg:block">
        <ul className="sticky top-[calc(var(--desktop-shell-top)+4rem)] space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = item.match(location.pathname, location.search, location.hash);
            const Icon = item.icon;
            return (
              <li key={item.label}>
                <Link
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] px-3 text-small font-semibold transition-colors',
                    active ? 'bg-ink text-white' : 'text-ink hover:bg-surface',
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
