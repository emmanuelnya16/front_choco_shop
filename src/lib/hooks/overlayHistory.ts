/**
 * Historique des surcouches (M6 §8) : feuilles, visionneuse, tiroir du panier et méga-menu.
 *
 * - À l'ouverture, une entrée d'historique est ajoutée (copie de l'état de React Router, avec le
 *   même `idx`, plus un repère `drcOverlay`). La touche retour d'Android ferme donc d'abord la
 *   surcouche, puis revient à l'écran précédent.
 * - La touche retour qui ferme une surcouche est interceptée avant React Router (écouteur en
 *   capture, posé avant la création du routeur) : aucune navigation POP parasite, et `useBlocker`
 *   ne voit jamais un retour de « delta 0 » (qui rechargerait la page avec `history.go(0)`).
 * - Une fermeture par l'interface retire l'entrée par `history.back()`. Pendant ce retour
 *   asynchrone, les `pushState` / `replaceState` (navigation lancée juste après la fermeture :
 *   SizePicker puis navigate, consumeAuthAction, liens du méga-menu…) sont mis en attente puis
 *   rejoués une fois le retour terminé : la navigation n'est jamais annulée.
 * - Si une navigation a déjà recouvert l'entrée, elle reste dans l'historique comme entrée
 *   « morte » ; elle est sautée automatiquement quand on y revient.
 *
 * Aucune dépendance au routeur : Sheet reste utilisable sans routeur (tests M1).
 */

const MARKER = 'drcOverlay';
/** Délai de sécurité : sans `popstate` après un retour, on reprend la main. */
const BACK_TIMEOUT_MS = 1200;
/** Après une fermeture par la touche retour, délai laissé au parent pour fermer réellement. */
const REOPEN_CHECK_MS = 120;

type HistoryState = Record<string, unknown> | null;
type HistoryUrl = string | URL | null | undefined;

interface EntryPosition {
  idx: number | null;
  seq: number;
}

interface CurrentEntry extends EntryPosition {
  url: string;
  state: HistoryState;
}

interface OverlayRecord {
  seq: number;
  idx: number | null;
  /** pending : entrée pas encore ajoutée · active : entrée présente · closed : surcouche fermée. */
  status: 'pending' | 'active' | 'closed';
  /** Vrai quand le composant a libéré la surcouche (fermeture, démontage). */
  released: boolean;
  close: () => void;
}

export interface OverlayHandle {
  /** La surcouche se ferme par l'interface, une navigation ou un démontage. */
  release: () => void;
}

let installed = false;
let originalPush: ((data: unknown, unused: string, url?: HistoryUrl) => void) | null = null;
let originalReplace: ((data: unknown, unused: string, url?: HistoryUrl) => void) | null = null;
const stack: OverlayRecord[] = [];
const deferred: Array<() => void> = [];
let pendingBacks = 0;
let backTimer: ReturnType<typeof setTimeout> | undefined;
let lastSeq = 0;
let current: CurrentEntry = { idx: null, seq: 0, url: '', state: null };

function readState(value: unknown): HistoryState {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function readSeq(state: HistoryState): number {
  const value = state?.[MARKER];
  return typeof value === 'number' ? value : 0;
}

function readIdx(state: HistoryState): number | null {
  const value = state?.idx;
  return typeof value === 'number' ? value : null;
}

function withoutMarker(state: HistoryState): Record<string, unknown> {
  if (!state) return {};
  const rest = { ...state };
  delete rest[MARKER];
  return rest;
}

/** Ordre des entrées : d'abord l'index de React Router, puis l'ordre d'ouverture des surcouches. */
function compare(a: EntryPosition, b: EntryPosition): number {
  const ai = a.idx ?? -1;
  const bi = b.idx ?? -1;
  return ai !== bi ? ai - bi : a.seq - b.seq;
}

function nextSeq(): number {
  // Croissant même après un rechargement : une entrée d'une session précédente est toujours « morte »
  lastSeq = Math.max(Date.now(), lastSeq + 1);
  return lastSeq;
}

function syncCurrent(): void {
  const state = readState(window.history.state);
  current = { idx: readIdx(state), seq: readSeq(state), url: window.location.href, state };
}

function isActiveSeq(seq: number): boolean {
  return seq > 0 && stack.some((record) => record.seq === seq && record.status === 'active');
}

function flushDeferred(): void {
  while (pendingBacks === 0 && deferred.length > 0) {
    const operation = deferred.shift();
    operation?.();
  }
}

function startBack(): void {
  pendingBacks += 1;
  if (backTimer !== undefined) clearTimeout(backTimer);
  backTimer = setTimeout(() => {
    backTimer = undefined;
    if (pendingBacks > 0) {
      pendingBacks = 0;
      syncCurrent();
      flushDeferred();
    }
  }, BACK_TIMEOUT_MS);
  window.history.back();
}

function patchedPushState(data: unknown, unused: string, url?: HistoryUrl): void {
  if (pendingBacks > 0) {
    deferred.push(() => patchedPushState(data, unused, url));
    return;
  }
  originalPush?.(data, unused, url);
  syncCurrent();
}

function patchedReplaceState(data: unknown, unused: string, url?: HistoryUrl): void {
  if (pendingBacks > 0) {
    deferred.push(() => patchedReplaceState(data, unused, url));
    return;
  }
  let next = data;
  const currentSeq = readSeq(readState(window.history.state));
  const nextState = readState(data);
  // React Router remplace l'entrée d'une surcouche (filtres en `replace`) : le repère reste
  if (currentSeq > 0 && readSeq(nextState) === 0) {
    next = { ...(nextState ?? {}), [MARKER]: currentSeq };
  }
  originalReplace?.(next, unused, url);
  syncCurrent();
}

function closeRecordFromHistory(record: OverlayRecord): void {
  record.status = 'closed';
  const index = stack.indexOf(record);
  if (index >= 0) stack.splice(index, 1);
  record.close();
  // Le parent refuse de fermer (envoi en cours…) : la surcouche retrouve son entrée
  setTimeout(() => {
    if (!record.released && record.status === 'closed') {
      record.status = 'pending';
      stack.push(record);
      schedulePush(record);
    }
  }, REOPEN_CHECK_MS);
}

function onPopState(event: PopStateEvent): void {
  const previous = current;
  const landedState = readState(window.history.state);
  const landed: EntryPosition = { idx: readIdx(landedState), seq: readSeq(landedState) };
  const ours = pendingBacks > 0;
  if (ours) pendingBacks -= 1;
  if (pendingBacks === 0 && backTimer !== undefined) {
    clearTimeout(backTimer);
    backTimer = undefined;
  }

  const backward = compare(landed, previous) < 0;
  // Même index React Router entre une page et ses surcouches : invisible pour le routeur
  const hiddenFromRouter =
    ours || (landed.idx === previous.idx && (landed.seq > 0 || previous.seq > 0));
  const toClose = stack
    .filter(
      (record) =>
        record.status === 'active' && compare({ idx: record.idx, seq: record.seq }, landed) > 0,
    )
    .reverse();
  const landedOnDeadEntry = landed.seq > 0 && !isActiveSeq(landed.seq);

  if (hiddenFromRouter) {
    event.stopImmediatePropagation();
    // Le routeur garde l'adresse et l'état de l'entrée quittée (ex. filtres remplacés pendant la
    // feuille ouverte) : l'entrée atteinte les reprend pour rester cohérente avec lui
    if (window.location.href !== previous.url || landedState?.key !== previous.state?.key) {
      const carried: Record<string, unknown> = withoutMarker(previous.state);
      if (landed.seq > 0) carried[MARKER] = landed.seq;
      originalReplace?.(carried, '', previous.url);
    }
    syncCurrent();
  } else {
    syncCurrent();
  }

  for (const record of toClose) closeRecordFromHistory(record);

  if (landedOnDeadEntry) {
    if (backward) startBack();
    else window.history.forward();
  }
  flushDeferred();
}

function install(): void {
  if (installed || typeof window === 'undefined' || !window.history) return;
  installed = true;
  const history = window.history;
  originalPush = history.pushState.bind(history);
  originalReplace = history.replaceState.bind(history);

  // Une entrée de surcouche restée après un rechargement n'a plus de surcouche ouverte
  const initialState = readState(history.state);
  if (readSeq(initialState) > 0) originalReplace(withoutMarker(initialState), '');
  syncCurrent();

  history.pushState = patchedPushState;
  history.replaceState = patchedReplaceState;
  // Capture + enregistrement au chargement du module (avant createBrowserRouter) : passe avant React Router
  window.addEventListener('popstate', onPopState, { capture: true });
}

function schedulePush(record: OverlayRecord): void {
  const apply = () => {
    if (record.status !== 'pending' || record.released) return;
    const base = readState(window.history.state);
    record.idx = readIdx(base);
    record.status = 'active';
    originalPush?.({ ...withoutMarker(base), [MARKER]: record.seq }, '', window.location.href);
    syncCurrent();
  };
  if (pendingBacks > 0) deferred.push(apply);
  else apply();
}

/** Ouvre une surcouche : ajoute son entrée d'historique (ou la met en attente d'un retour en cours). */
export function openOverlay(close: () => void): OverlayHandle {
  install();
  const record: OverlayRecord = {
    seq: nextSeq(),
    idx: null,
    status: 'pending',
    released: false,
    close,
  };
  if (typeof window === 'undefined') {
    return { release: () => undefined };
  }
  stack.push(record);
  schedulePush(record);

  return {
    release: () => {
      if (record.released) return;
      record.released = true;
      const index = stack.indexOf(record);
      if (index >= 0) stack.splice(index, 1);
      if (record.status !== 'active') {
        record.status = 'closed';
        return;
      }
      record.status = 'closed';
      const currentSeq = readSeq(readState(window.history.state));
      // Toujours l'entrée courante : on la retire. Sinon une navigation l'a recouverte : elle
      // reste comme entrée morte, sautée plus tard (jamais de retour en trop).
      if (currentSeq === record.seq && pendingBacks === 0) startBack();
    },
  };
}

/** Nombre de surcouches ouvertes (tests et outils de développement). */
export function getOpenOverlayCount(): number {
  return stack.filter((record) => record.status !== 'closed').length;
}

/** Retours d'historique encore attendus (tests). */
export function getPendingBackCount(): number {
  return pendingBacks;
}

/** Tests : oublie les surcouches et remet l'entrée courante à l'adresse donnée, sans repère. */
export function resetOverlayHistoryForTests(url = '/'): void {
  install();
  stack.length = 0;
  deferred.length = 0;
  pendingBacks = 0;
  if (backTimer !== undefined) clearTimeout(backTimer);
  backTimer = undefined;
  originalReplace?.(null, '', url);
  syncCurrent();
}

// Installé dès l'import (Sheet est importé par RootLayout, lui-même importé par le routeur)
install();
