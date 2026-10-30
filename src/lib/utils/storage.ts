import type { StateStorage } from 'zustand/middleware';

const memoryFallback = new Map<string, string>();

/**
 * Enveloppe localStorage dans des blocs try/catch (navigation privée, quota dépassé,
 * ou accès bloqué). Bascule automatiquement sur un stockage en mémoire.
 */
export function createSafeStorage(getStorage: () => Storage | undefined = () => window?.localStorage): StateStorage & {
  clearMemoryFallback: () => void;
} {
  return {
    getItem(name: string): string | null {
      try {
        const storage = getStorage();
        if (storage) {
          const val = storage.getItem(name);
          if (val !== null) {
            return val;
          }
        }
      } catch {
        // Fallback en mémoire
      }
      return memoryFallback.get(name) ?? null;
    },

    setItem(name: string, value: string): void {
      memoryFallback.set(name, value);
      try {
        const storage = getStorage();
        if (storage) {
          storage.setItem(name, value);
        }
      } catch {
        // Continue avec la valeur conservée dans memoryFallback
      }
    },

    removeItem(name: string): void {
      memoryFallback.delete(name);
      try {
        const storage = getStorage();
        if (storage) {
          storage.removeItem(name);
        }
      } catch {
        // Ignoré
      }
    },

    clearMemoryFallback(): void {
      memoryFallback.clear();
    },
  };
}

export const safeStorage = createSafeStorage(() =>
  typeof window !== 'undefined' ? window.localStorage : undefined,
);
