/**
 * Sécurise la cible de redirection après connexion à l’administration :
 * n’accepte que les chemins internes commençant par `/admin` (hors `/admin/connexion`).
 */
export function sanitizeAdminRedirect(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') {
    return '/admin';
  }
  const trimmed = raw.trim();
  if (
    !trimmed.startsWith('/admin') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/admin/connexion')
  ) {
    return '/admin';
  }
  return trimmed;
}

