import { ArrowLeft, Wrench } from 'lucide-react';
import { useLocation, useParams, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { useSeo } from '@/lib/seo/useSeo';

interface SectionMeta {
  moduleCode: 'A2' | 'A3' | 'A4';
  title: string;
  description: string;
}

function resolveSectionMeta(pathname: string, ref?: string, id?: string): SectionMeta {
  if (pathname.startsWith('/admin/reservations')) {
    return {
      moduleCode: 'A2',
      title: ref ? `Réservation ${ref}` : 'Gestion des réservations & preuves Mobile Money',
      description:
        'Validation en 1 appui ou rejet motivé des captures Mobile Money, avancement du statut et ajout des photos du colis prêt.',
    };
  }
  if (pathname.startsWith('/admin/catalogue')) {
    return {
      moduleCode: 'A3',
      title: id ? `Édition du produit ${id}` : 'Catalogue, stocks et variantes',
      description:
        'Ajustement rapide des stocks par taille et couleur, création de produits, galerie photos et guides des tailles.',
    };
  }
  if (pathname.startsWith('/admin/categories') || pathname.startsWith('/admin/looks')) {
    return {
      moduleCode: 'A3',
      title: 'Looks & Catégories',
      description:
        'Organisation des catégories, sous-catégories et looks « Portés par L’Incompris ».',
    };
  }
  if (pathname.startsWith('/admin/contenus')) {
    return {
      moduleCode: 'A4',
      title: 'Contenus (Aide & Pages légales)',
      description:
        'Édition des pages À propos, FAQ, Livraison & Retrait, Conditions générales et Confidentialité.',
    };
  }
  return {
    moduleCode: 'A4',
    title: 'Paramètres de la boutique & Mobile Money',
    description:
      'Configuration des codes marchands Orange Money / MTN MoMo, modèles USSD, villes et agences de transport.',
  };
}

export default function AdminPlaceholderPage() {
  const location = useLocation();
  const params = useParams<{ ref?: string; id?: string }>();
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get('statut');

  const meta = resolveSectionMeta(location.pathname, params.ref, params.id);

  useSeo({
    title: `${meta.title} — Administration DR Choco`,
    noindex: true,
  });

  return (
    <div className="space-y-6">
      <div>
        <Button
          href="/admin"
          variant="ghost"
          size="sm"
          iconLeft={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
        >
          Retour au tableau de bord
        </Button>
      </div>

      <section className="rounded-[var(--radius-lg)] border border-silver bg-white p-6 sm:p-8">
        <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-full)] bg-ink px-3 py-1 text-label text-white uppercase">
          <Wrench className="h-3.5 w-3.5 text-red" aria-hidden="true" />
          MODULE {meta.moduleCode}
        </span>

        <h1 className="mt-4 text-h2 text-ink">{meta.title}</h1>
        <p className="mt-2 max-w-[60ch] text-body text-text-2">{meta.description}</p>

        {(params.ref || params.id || statusFilter) && (
          <div className="mt-5 inline-flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-silver bg-surface px-4 py-2.5 text-small text-ink">
            {params.ref && (
              <span>
                Référence sélectionnée&nbsp;: <strong className="font-mono">{params.ref}</strong>
              </span>
            )}
            {params.id && (
              <span>
                Produit sélectionné&nbsp;: <strong className="font-mono">{params.id}</strong>
              </span>
            )}
            {statusFilter && (
              <span>
                Filtre statut&nbsp;: <strong className="font-mono">{statusFilter}</strong>
              </span>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

