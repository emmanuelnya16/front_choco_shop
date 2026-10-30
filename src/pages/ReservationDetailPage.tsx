import { useParams } from 'react-router';
import { PlaceholderPage } from './_PlaceholderPage';

export function ReservationDetailPage() {
  const { ref } = useParams<{ ref?: string }>();
  return (
    <PlaceholderPage
      title="Détail de la réservation"
      documentTitle={ref ? `Réservation ${ref}` : 'Détail de la réservation'}
      sectionNumber="5.14"
      moduleRef="M8 Suivi"
      description="Frise chronologique de suivi étape par étape, compte à rebours et photos du colis prêt prises par la boutique."
    />
  );
}
