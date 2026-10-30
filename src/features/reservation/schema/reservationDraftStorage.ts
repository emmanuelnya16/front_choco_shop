import type { ReservationFormValues } from './reservationSchema';

const DRAFT_STORAGE_KEY = 'drc_reservation_draft_v1';

export function loadReservationDraft(): Partial<ReservationFormValues> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Partial<ReservationFormValues>;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveReservationDraft(
  draft: Partial<ReservationFormValues>,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Ignore sessionStorage quota errors
  }
}

export function clearReservationDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Ignore errors
  }
}
