import { ChevronDown } from 'lucide-react';
import { useRef, type MouseEvent } from 'react';
import { cn } from '@/lib/utils/cn';
import { prefersReducedMotion } from '@/motion/useReducedMotionPref';
import type { TocEntry } from '../markdown/parse';

/** Défile jusqu'au titre, lui donne le focus et garde l'adresse de la section. */
function goToHeading(event: MouseEvent<HTMLAnchorElement>, id: string): boolean {
  const target = document.getElementById(id);
  if (!target) return false;
  event.preventDefault();
  target.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  target.focus({ preventScroll: true });
  // État de l'historique conservé : la flèche retour de l'app continue de fonctionner (M6 §8)
  window.history.replaceState(window.history.state, '', `#${id}`);
  return true;
}

interface TocListProps {
  entries: TocEntry[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNavigate?: () => void;
}

function TocList({ entries, activeId, onSelect, onNavigate }: TocListProps) {
  return (
    <ol className="space-y-0.5 border-l border-silver">
      {entries.map((entry) => {
        const isActive = entry.id === activeId;
        return (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              aria-current={isActive ? 'location' : undefined}
              onClick={(event) => {
                onNavigate?.();
                if (goToHeading(event, entry.id)) onSelect(entry.id);
              }}
              className={cn(
                '-ml-px flex min-h-11 items-center border-l-2 py-1.5 pl-3 text-small lg:min-h-0',
                isActive
                  ? 'border-ink font-semibold text-ink'
                  : 'border-transparent text-text-2 [@media(hover:hover)]:hover:text-ink',
              )}
            >
              {entry.text}
            </a>
          </li>
        );
      })}
    </ol>
  );
}

export interface TableOfContentsProps {
  entries: TocEntry[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

/** Ordinateur : sommaire collant à droite, sous l'en-tête replié (et le bandeau rouge). */
export function DesktopTableOfContents({ entries, activeId, onSelect }: TableOfContentsProps) {
  return (
    <nav
      aria-label="Sommaire"
      className="sticky top-[calc(var(--desktop-shell-top)+24px)] max-h-[calc(100dvh-var(--desktop-shell-top)-48px)] overflow-y-auto overscroll-contain"
    >
      <p className="text-label text-text-2">Sommaire</p>
      <div className="mt-3">
        <TocList entries={entries} activeId={activeId} onSelect={onSelect} />
      </div>
    </nav>
  );
}

/** Mobile : sommaire repliable en haut de la page, jamais collant. */
export function MobileTableOfContents({ entries, activeId, onSelect }: TableOfContentsProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={detailsRef}
      className="group rounded-[var(--radius-md)] border border-silver bg-white"
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-small font-semibold text-ink [&::-webkit-details-marker]:hidden">
        Sommaire
        <ChevronDown className="h-4 w-4 shrink-0 text-text-2 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="px-4 pb-3">
        <TocList
          entries={entries}
          activeId={activeId}
          onSelect={onSelect}
          // Replié avant le défilement : la position visée ne bouge plus ensuite
          onNavigate={() => {
            if (detailsRef.current) detailsRef.current.open = false;
          }}
        />
      </div>
    </details>
  );
}
