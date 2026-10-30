import { useCallback, useSyncExternalStore } from 'react';
import { safeStorage } from '@/lib/utils/storage';

const RECENT_SEARCHES_KEY = 'drc_recent_searches_v1';
const MAX_RECENT_SEARCHES = 6;

export const POPULAR_SEARCH_CHIPS: {
  label: string;
  query: string;
  targetUrl?: string;
}[] = [
  { label: 'Babouches cuir', query: 'babouche cuir' },
  { label: 'T-shirt oversize', query: 'oversize' },
  { label: 'Ensemble noir', query: 'ensemble' },
  { label: 'Pointure 42', query: '42', targetUrl: '/explorer?size=42' },
  { label: 'Taille XL', query: 'XL', targetUrl: '/explorer?size=XL' },
  {
    label: 'Moins de 20 000 FCFA',
    query: '15000',
    targetUrl: '/explorer?price=0-15000',
  },
];

type Listener = () => void;
const listeners = new Set<Listener>();
let cachedRaw: string | null = null;
let cachedList: string[] = [];

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

export function getRecentSearches(): string[] {
  const raw = safeStorage.getItem(RECENT_SEARCHES_KEY) as string | null;
  if (raw === cachedRaw) {
    return cachedList;
  }
  cachedRaw = raw;
  if (!raw) {
    cachedList = [];
    return cachedList;
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      cachedList = parsed
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .slice(0, MAX_RECENT_SEARCHES);
      return cachedList;
    }
  } catch {
    // Ignore malformed JSON
  }
  cachedList = [];
  return cachedList;
}

export function addRecentSearch(term: string): string[] {
  const cleaned = term.trim();
  if (cleaned.length < 2) {
    return getRecentSearches();
  }
  const current = getRecentSearches();
  const normalizedTarget = cleaned.toLowerCase();
  const deduplicated = current.filter(
    (item) => item.toLowerCase() !== normalizedTarget,
  );
  const next = [cleaned, ...deduplicated].slice(0, MAX_RECENT_SEARCHES);
  const raw = JSON.stringify(next);
  safeStorage.setItem(RECENT_SEARCHES_KEY, raw);
  cachedRaw = raw;
  cachedList = next;
  notifyListeners();
  return next;
}

export function removeRecentSearch(term: string): string[] {
  const current = getRecentSearches();
  const normalizedTarget = term.trim().toLowerCase();
  const next = current.filter((item) => item.toLowerCase() !== normalizedTarget);
  const raw = JSON.stringify(next);
  safeStorage.setItem(RECENT_SEARCHES_KEY, raw);
  cachedRaw = raw;
  cachedList = next;
  notifyListeners();
  return next;
}

export function clearRecentSearches(): void {
  safeStorage.removeItem(RECENT_SEARCHES_KEY);
  cachedRaw = null;
  cachedList = [];
  notifyListeners();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRecentSearches() {
  const searches = useSyncExternalStore(
    subscribe,
    getRecentSearches,
    () => [],
  );

  const add = useCallback((term: string) => {
    addRecentSearch(term);
  }, []);

  const remove = useCallback((term: string) => {
    removeRecentSearch(term);
  }, []);

  const clear = useCallback(() => {
    clearRecentSearches();
  }, []);

  return {
    searches,
    add,
    remove,
    clear,
  };
}
