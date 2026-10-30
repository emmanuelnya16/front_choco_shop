/**
 * Contrat des notifications push avec le back-end (M6 §7.2) et transformation en notification
 * système. Fonctions pures, partagées par le service worker, l'app et les outils de /_dev.
 */

export const PUSH_TYPES = [
  'payment_validated',
  'payment_rejected',
  'package_ready',
  'in_delivery',
  'delivered',
  'expiring_soon',
  'new_collection',
] as const;

export type PushType = (typeof PUSH_TYPES)[number];

export interface PushPayload {
  type: PushType;
  title: string;
  body: string;
  /** Référence de la réservation, ex. RES-000124. */
  ref?: string;
  /** Page à ouvrir, ex. « /reservations/RES-000124 ». */
  url: string;
  /** Photo du colis (URL signée de courte durée) : jamais enregistrée par l'app. */
  image?: string;
  /** Par défaut la référence : remplace la notification précédente de la même réservation. */
  tag?: string;
}

export interface NotificationActionLink {
  action: string;
  title: string;
  url: string;
}

export interface NotificationData {
  url: string;
  ref?: string;
  type: PushType;
  /** URL de chaque bouton d'action, retrouvée au clic. */
  actions: Record<string, string>;
}

/** Options de showNotification, sans dépendre des types du navigateur. */
export interface BuiltNotification {
  title: string;
  options: {
    body: string;
    icon: string;
    badge: string;
    image?: string;
    tag: string;
    renotify: boolean;
    data: NotificationData;
    actions: { action: string; title: string }[];
    vibrate: number[];
    lang: string;
  };
}

export const NOTIFICATION_ICON = '/pwa-192x192.png';
export const NOTIFICATION_BADGE = '/badge-96.png';

/** Types qui allument la pastille de l'icône : action demandée ou nouveauté (M6 §7.3). */
export const BADGE_PUSH_TYPES: readonly PushType[] = ['payment_rejected', 'expiring_soon', 'package_ready'];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Seules les pages de l'app peuvent être ouvertes depuis une notification. */
function isSafeAppPath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//');
}

/**
 * Lit le contenu d'une notification reçue. Renvoie null pour un contenu invalide
 * (ignoré proprement par le service worker).
 */
export function parsePushPayload(raw: unknown): PushPayload | null {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (!PUSH_TYPES.includes(v.type as PushType)) return null;
  if (!isNonEmptyString(v.title) || !isNonEmptyString(v.body)) return null;
  if (!isNonEmptyString(v.url) || !isSafeAppPath(v.url)) return null;

  const payload: PushPayload = {
    type: v.type as PushType,
    title: v.title.trim(),
    body: v.body.trim(),
    url: v.url,
  };
  if (isNonEmptyString(v.ref)) payload.ref = v.ref.trim().toUpperCase();
  if (isNonEmptyString(v.image) && /^https?:\/\/|^\//.test(v.image)) payload.image = v.image;
  if (isNonEmptyString(v.tag)) payload.tag = v.tag;
  return payload;
}

/** Boutons d'action par type (M6 §7.2). */
export function notificationActions(payload: PushPayload): NotificationActionLink[] {
  const ref = payload.ref ? encodeURIComponent(payload.ref) : null;
  switch (payload.type) {
    case 'payment_validated':
      return [{ action: 'open', title: 'Voir ma réservation', url: payload.url }];
    case 'payment_rejected':
      return [
        { action: 'proof', title: 'Renvoyer ma preuve', url: ref ? `/reservation/${ref}/preuve` : payload.url },
      ];
    case 'package_ready':
      return [{ action: 'open', title: 'Voir mon colis', url: payload.url }];
    case 'in_delivery':
      return [{ action: 'open', title: 'Suivre', url: payload.url }];
    case 'expiring_soon':
      return [{ action: 'pay', title: 'Payer', url: ref ? `/reservation/${ref}/paiement` : payload.url }];
    case 'new_collection':
      return [{ action: 'open', title: 'Découvrir', url: payload.url }];
    case 'delivered':
      return [];
  }
}

/** Transforme un contenu push en notification système (même rendu dans le SW et dans /_dev). */
export function buildNotification(payload: PushPayload): BuiltNotification {
  const actions = notificationActions(payload);
  return {
    title: payload.title,
    options: {
      body: payload.body,
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_BADGE,
      // La photo n'est montrée que pour le colis prêt (Android) ; iOS affiche le texte seul
      ...(payload.type === 'package_ready' && payload.image ? { image: payload.image } : {}),
      tag: payload.tag ?? payload.ref ?? payload.type,
      renotify: true,
      data: {
        url: payload.url,
        ...(payload.ref ? { ref: payload.ref } : {}),
        type: payload.type,
        actions: Object.fromEntries(actions.map((a) => [a.action, a.url])),
      },
      actions: actions.map(({ action, title }) => ({ action, title })),
      vibrate: [80, 40, 80],
      lang: 'fr',
    },
  };
}

/** URL à ouvrir au clic : celle du bouton d'action s'il y en a un, sinon celle de la notification. */
export function resolveNotificationUrl(data: unknown, action?: string): string {
  if (!data || typeof data !== 'object') return '/';
  const d = data as Partial<NotificationData>;
  const fromAction = action && d.actions ? d.actions[action] : undefined;
  const url = fromAction ?? d.url;
  return typeof url === 'string' && isSafeAppPath(url) ? url : '/';
}

/** Contenus d'exemple (M6 §7.2) : outils de test de /_dev et simulateur boutique. */
export function samplePushPayload(type: PushType, ref = 'RES-000102', image?: string): PushPayload {
  const detail = `/reservations/${ref}`;
  switch (type) {
    case 'payment_validated':
      return { type, title: 'Paiement validé ✓', body: `${ref} est confirmée. Nous préparons votre commande.`, ref, url: detail };
    case 'payment_rejected':
      return { type, title: 'Paiement non validé', body: `${ref} : capture illisible. Renvoyez votre preuve avant 23 h 10.`, ref, url: detail };
    case 'package_ready':
      return {
        type,
        title: 'Votre colis est prêt 📦',
        body: `${ref} est emballée. Voyez la photo de votre colis.`,
        ref,
        url: `${detail}#colis`,
        ...(image ? { image } : {}),
      };
    case 'in_delivery':
      return { type, title: 'Votre colis est en route', body: `${ref} part vers Yaoundé.`, ref, url: detail };
    case 'delivered':
      return { type, title: 'Livré !', body: 'Merci pour votre confiance.', ref, url: detail };
    case 'expiring_soon':
      return { type, title: 'Votre réservation expire bientôt', body: `${ref} expire dans 2 h. Payez pour garder vos articles.`, ref, url: detail };
    case 'new_collection':
      return { type, title: 'Nouvelle collection', body: 'Les nouveautés de la semaine sont arrivées.', url: '/explorer?sort=newest' };
  }
}
