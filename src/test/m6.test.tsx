import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, refreshSessionSilently } from '@/lib/api/client';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types/domain';

const JUNIOR: User = {
  id: 'usr-junior-01',
  phone: '+237690000001',
  firstName: 'Junior',
  createdAt: '2026-09-15T10:00:00.000Z',
};

/** Profil persisté, sans jeton d'accès : situation d'un lancement à froid de l'app. */
function restoreProfileWithoutToken() {
  useAuthStore.setState({ user: JUNIOR, accessToken: null, status: 'unknown' });
}

describe('M6 · 1. Session hors connexion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clearSession();
  });

  it('garde le client connecté quand le rafraîchissement échoue faute de réseau', async () => {
    restoreProfileWithoutToken();
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(refreshSessionSilently()).resolves.toBe('unreachable');
    const state = useAuthStore.getState();
    expect(state.user?.id).toBe('usr-junior-01');
    expect(state.status).toBe('authenticated');
  });

  it('garde le client connecté sur une erreur serveur momentanée (503)', async () => {
    restoreProfileWithoutToken();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 503 }));

    await expect(refreshSessionSilently()).resolves.toBe('unreachable');
    expect(useAuthStore.getState().user?.id).toBe('usr-junior-01');
  });

  it('déconnecte le client quand le serveur refuse la session (401)', async () => {
    restoreProfileWithoutToken();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'INVALID_REFRESH_TOKEN' }), { status: 401 }),
    );

    await expect(refreshSessionSilently()).resolves.toBe('rejected');
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.status).toBe('guest');
  });

  it('ne fait rien sans profil ou avec un jeton déjà valide', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(refreshSessionSilently()).resolves.toBe('skipped');
    useAuthStore.getState().setSession('jwt-valide', JUNIOR);
    await expect(refreshSessionSilently()).resolves.toBe('skipped');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("une 401 suivie d'un rafraîchissement sans réseau renvoie une erreur réseau, sans déconnecter", async () => {
    useAuthStore.getState().setSession('jwt-expire', JUNIOR);
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Expired JWT' }), { status: 401 }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(api.get('/me')).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
      code: 'NETWORK_ERROR',
    } satisfies Partial<ApiError>);
    expect(useAuthStore.getState().user?.id).toBe('usr-junior-01');
  });

  it("une 401 suivie d'un refus du rafraîchissement renvoie SESSION_EXPIRED et déconnecte", async () => {
    useAuthStore.getState().setSession('jwt-expire', JUNIOR);
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Expired JWT' }), { status: 401 }))
      .mockResolvedValueOnce(new Response('', { status: 401 }));

    await expect(api.get('/me')).rejects.toMatchObject({ status: 401, code: 'SESSION_EXPIRED' });
    expect(useAuthStore.getState().user).toBeNull();
  });
});
