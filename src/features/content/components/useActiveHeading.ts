import { useCallback, useEffect, useState } from 'react';

/** Hauteur collante en haut de l'écran sur ordinateur (en-tête replié, bandeau rouge). */
function readShellTop(): number {
  if (typeof window === 'undefined') return 72;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--desktop-shell-top');
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : 72;
}

/**
 * Section en cours de lecture (M7 §3.3) : un seul IntersectionObserver suit les titres, sans
 * écoute du défilement. Un titre devient actif quand il entre dans la bande haute de l'écran
 * (sous l'en-tête, jusqu'à 40 % de la hauteur) ; s'il redescend sous cette bande en remontant la
 * page, la section précédente redevient active.
 */
export function useActiveHeading(ids: readonly string[]): [string | null, (id: string) => void] {
  const idsKey = ids.join('|');
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  const [trackedKey, setTrackedKey] = useState(idsKey);

  // Nouvelle page : on repart du premier titre
  if (trackedKey !== idsKey) {
    setTrackedKey(idsKey);
    setActive(ids[0] ?? null);
  }

  useEffect(() => {
    const list = idsKey ? idsKey.split('|') : [];
    if (list.length === 0 || typeof IntersectionObserver === 'undefined') return undefined;

    const elements = list
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) return undefined;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          if (entry.isIntersecting) {
            visible.add(id);
            continue;
          }
          visible.delete(id);
          const movedBelow = entry.rootBounds !== null && entry.boundingClientRect.top >= entry.rootBounds.bottom;
          if (movedBelow) {
            const previous = list[Math.max(0, list.indexOf(id) - 1)];
            setActive((current) => (current === id ? previous : current));
          }
        }
        const first = list.find((id) => visible.has(id));
        if (first) setActive(first);
      },
      { rootMargin: `-${Math.round(readShellTop() + 16)}px 0px -60% 0px`, threshold: 0 },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [idsKey]);

  const select = useCallback((id: string) => setActive(id), []);
  return [active, select];
}
