import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { PlaceholderPage } from './_PlaceholderPage';

export function ReservationsPage() {
  const authStatus = useAuthStore((s) => s.status);
  const openAuthSheet = useUiStore((s) => s.openAuthSheet);

  // Demande la connexion à l'ouverture de « Mes réservations » si non connecté (§5.1)
  useEffect(() => {
    if (authStatus !== 'authenticated') {
      openAuthSheet();
    }
  }, [authStatus, openAuthSheet]);

  return (
    <PlaceholderPage
      title="Mes réservations"
      documentTitle="Mes réservations"
      sectionNumber="5.13"
      moduleRef="M8 Suivi"
      description="Historique et suivi en temps réel de vos réservations, de la vérification du paiement à la photo du colis prêt."
    />
  );
}
