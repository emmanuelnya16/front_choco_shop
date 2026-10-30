import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { qk } from '@/lib/api/queryKeys';
import type { UpdateAddressPayload } from '@/types/api';
import type { Address } from '@/types/domain';

/** Place l'adresse par défaut en tête et retire le défaut des autres (une seule adresse par défaut). */
export function applyDefaultAddress(list: Address[], defaultId: string): Address[] {
  const target = list.find((a) => a.id === defaultId);
  if (!target) return list;
  return [
    { ...target, isDefault: true },
    ...list.filter((a) => a.id !== defaultId).map((a) => ({ ...a, isDefault: false })),
  ];
}

/** Retire une adresse ; si c'était l'adresse par défaut, la première restante le devient. */
export function removeAddress(list: Address[], id: string): Address[] {
  const removed = list.find((a) => a.id === id);
  const rest = list.filter((a) => a.id !== id);
  if (removed?.isDefault && rest.length > 0 && !rest.some((a) => a.isDefault)) {
    return rest.map((a, index) => ({ ...a, isDefault: index === 0 }));
  }
  return rest;
}

/** Modification d'une adresse existante (`PATCH /me/addresses/:id`, §7.3 M5). */
export function useUpdateAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAddressPayload }) =>
      api.patch<Address>(endpoints.me.address(id), payload),
    onSuccess: (saved) => {
      queryClient.setQueryData<Address[]>(qk.addresses(), (old = []) => {
        const replaced = old.map((a) => (a.id === saved.id ? saved : a));
        return saved.isDefault ? applyDefaultAddress(replaced, saved.id) : replaced;
      });
    },
  });
}

/**
 * Définir par défaut (`PATCH` avec `isDefault: true`) : mise à jour optimiste pour que l'étiquette
 * « Par défaut » glisse tout de suite vers la nouvelle carte, annulée en cas d'erreur.
 */
export function useSetDefaultAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.patch<Address>(endpoints.me.address(id), { isDefault: true } satisfies UpdateAddressPayload),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: qk.addresses() });
      const previous = queryClient.getQueryData<Address[]>(qk.addresses());
      if (previous) {
        queryClient.setQueryData<Address[]>(qk.addresses(), applyDefaultAddress(previous, id));
      }
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(qk.addresses(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.addresses() });
    },
  });
}

/**
 * Suppression définitive (`DELETE /me/addresses/:id`). L'écran retire d'abord la carte et
 * n'appelle cette mutation qu'après les 5 s pendant lesquelles « Annuler » reste possible.
 */
export function useDeleteAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<void>(endpoints.me.address(id)),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Address[]>(qk.addresses(), (old = []) => removeAddress(old, id));
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: qk.addresses() });
    },
  });
}
