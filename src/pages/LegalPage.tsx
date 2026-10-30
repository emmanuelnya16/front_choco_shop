import { useParams } from 'react-router';
import { PlaceholderPage } from './_PlaceholderPage';

export function LegalPage() {
  const { slug } = useParams<{ slug?: string }>();
  return (
    <PlaceholderPage
      title="Pages légales"
      documentTitle={slug ? `Informations · ${slug}` : 'Pages légales'}
      sectionNumber="5.17"
      moduleRef="M3 / M10"
      description="Conditions générales de réservation, politique de confidentialité et mentions légales DR Choco L'Incompris."
    />
  );
}
