import { useState } from 'react';
import { cn } from '@/lib/utils/cn';

const APP_ICON_SRC = '/pwa-192x192.png';
const APP_ICON_FALLBACK_SRC = '/pwa-64x64.png';

interface AppIconTileProps {
  className?: string;
}

/**
 * Icône de l'application (72 px, rayon 16) : icône 192 px du manifeste, ou le favicon tant que les
 * icônes générées (`npm run icons`) ne sont pas présentes.
 */
export function AppIconTile({ className }: AppIconTileProps) {
  const [src, setSrc] = useState(APP_ICON_SRC);

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={72}
      height={72}
      decoding="async"
      onError={() => setSrc((current) => (current === APP_ICON_FALLBACK_SRC ? current : APP_ICON_FALLBACK_SRC))}
      className={cn('h-18 w-18 shrink-0 rounded-2xl bg-ink object-cover shadow-[var(--shadow-card-icon)]', className)}
    />
  );
}
