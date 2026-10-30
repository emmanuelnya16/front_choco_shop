/**
 * Convertit une clé publique VAPID base64url en octets pour pushManager.subscribe (M6 §7.1).
 * Lève une erreur si la chaîne n'est pas du base64url valide.
 */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const trimmed = base64Url.trim();
  if (!/^[A-Za-z0-9_-]*={0,2}$/.test(trimmed)) {
    throw new Error('Clé VAPID invalide : caractères base64url attendus.');
  }
  const padding = '='.repeat((4 - (trimmed.replace(/=+$/, '').length % 4)) % 4);
  const base64 = (trimmed.replace(/=+$/, '') + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}
