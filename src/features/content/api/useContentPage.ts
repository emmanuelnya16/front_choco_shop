import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { qk } from '@/lib/api/queryKeys';
import type { ContentPageResponse } from '../types';

/**
 * HYPOTHÈSE: les pages légales et d'aide changent rarement : 30 min avant un nouveau chargement,
 * gardées 24 h en mémoire. Hors connexion, le service worker sert la dernière version lue
 * (cache « api-catalog », M7 §3.1).
 */
const CONTENT_STALE_TIME_MS = 30 * 60_000;
const CONTENT_GC_TIME_MS = 24 * 60 * 60_000;

/** Page de contenu `GET /pages/:slug` ; aucune requête tant que `slug` est absent. */
export function useContentPage(slug: string | undefined) {
  return useQuery({
    queryKey: qk.contentPage(slug ?? ''),
    queryFn: () => api.get<ContentPageResponse>(endpoints.content.page(slug ?? '')),
    enabled: Boolean(slug),
    staleTime: CONTENT_STALE_TIME_MS,
    gcTime: CONTENT_GC_TIME_MS,
  });
}
