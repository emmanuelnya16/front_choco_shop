import { create } from 'zustand';

export interface ToastMessage {
  id: string;
  message: string;
  subtitle?: string;
  thumbnail?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  durationMs?: number;
}

export interface ToastState {
  toasts: ToastMessage[];
  show: (toast: Omit<ToastMessage, 'id'>) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

let toastCounter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  show: (input) => {
    toastCounter += 1;
    const id = `toast-${Date.now()}-${toastCounter}`;
    const durationMs = input.durationMs ?? 3500;

    set((state) => ({
      toasts: [...state.toasts.slice(-2), { ...input, id, durationMs }],
    }));

    if (durationMs > 0 && typeof window !== 'undefined') {
      window.setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, durationMs);
    }

    return id;
  },

  dismiss: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clear: () => {
    set({ toasts: [] });
  },
}));
