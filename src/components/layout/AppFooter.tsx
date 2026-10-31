import { ChevronDown, Clock, MapPin, Phone } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { WhatsAppIcon } from '@/components/layout/FloatingWhatsApp';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { Container } from '@/components/ui/Primitives';
import { usePublicSettings } from '@/features/catalog/api/useCatalogQueries';
import { cn } from '@/lib/utils/cn';

const FOOTER_SECTIONS = [
  {
    id: 'categories',
    title: 'Catégories',
    links: [
      { label: 'Vêtements', to: '/explorer/vetements' },
      { label: 'Chaussures', to: '/explorer/chaussures' },
      { label: 'Babouches', to: '/explorer/babouches' },
      { label: 'Nouveautés', to: '/explorer?sort=newest' },
    ],
  },
  {
    id: 'aide',
    title: 'Aide',
    links: [
      { label: 'Comment réserver', to: '/#comment-reserver' },
      { label: 'Paiement Mobile Money', to: '/pages/paiement-mobile-money' },
      { label: 'Livraison et retrait', to: '/pages/livraison-et-retrait' },
      { label: 'Suivre ma réservation', to: '/reservations' },
    ],
  },
  {
    id: 'legal',
    title: 'Légal',
    links: [
      { label: 'Conditions générales', to: '/pages/conditions-generales' },
      { label: "Politique d'annulation et de retour", to: '/pages/politique-retour' },
      { label: 'Confidentialité', to: '/pages/confidentialite' },
    ],
  },
];

export function AppFooter() {
  const { data: settings } = usePublicSettings();
  const [openAccordion, setOpenAccordion] = useState<string | null>('categories');

  const rawNumber = settings?.whatsappNumber ?? '+237690000000';
  const cleanNumber = rawNumber.replace(/[^0-9]/g, '');
  const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(
    "Bonjour DR Choco, j'ai une question.",
  )}`;

  const pickup = settings?.pickupAddress;
  const formattedAddress = pickup
    ? `${pickup.name} — ${pickup.quarter}, ${pickup.city} (${pickup.landmark})`
    : 'Boutique DR Choco — Akwa, Douala, Cameroun';
  const formattedHours = pickup?.openingHours ?? 'Lun – Sam : 09h00 – 19h30';

  const toggleSection = (id: string) => {
    setOpenAccordion((prev) => (prev === id ? null : id));
  };

  return (
    // Mobile : place réservée sous le pied de page pour la pile du bas (barre basse ou barre d'action,
    // bandeau rouge, bandeau de mise à jour — index.css) ; tout en bas, rien n'est caché
    <footer className="bg-ink text-silver pb-[calc(var(--bottom-bar-h)+var(--pending-banner-h)+var(--update-banner-h))] lg:pb-0">
      <Container className="py-12 lg:py-16">
        {/* Top Row */}
        <div className="flex flex-col items-start justify-between gap-6 border-b border-white/10 pb-10 lg:flex-row lg:items-center">
          <div className="max-w-md space-y-3">
            <Logo variant="light" size="lg" />
            <p className="text-small text-silver">
              Vêtements, chaussures et babouches pour hommes. Réservez en ligne,
              payez par Mobile Money.
            </p>
          </div>

          <Button
            variant="outline-light"
            size="md"
            href={whatsappUrl}
            external
            iconLeft={<WhatsAppIcon className="h-4 w-4" />}
          >
            Nous écrire sur WhatsApp
          </Button>
        </div>

        {/* Middle Columns (4 on desktop, accordions on mobile) */}
        <div className="mt-8 grid grid-cols-1 gap-2 lg:mt-12 lg:grid-cols-4 lg:gap-8">
          {FOOTER_SECTIONS.map((section) => {
            const isOpen = openAccordion === section.id;

            return (
              <div
                key={section.id}
                className="border-b border-white/10 py-3 lg:border-b-0 lg:py-0"
              >
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={isOpen}
                  className="flex min-h-11 w-full items-center justify-between py-2 text-left text-label text-white lg:pointer-events-none lg:min-h-0 lg:py-0"
                >
                  <span>{section.title}</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-silver transition-transform lg:hidden',
                      isOpen && 'rotate-180',
                    )}
                    aria-hidden="true"
                  />
                </button>

                <ul
                  className={cn(
                    // Mobile : liens de 44 px de haut, sans espace en plus entre eux
                    'mt-1 lg:mt-4 lg:block lg:space-y-2.5',
                    isOpen ? 'block pb-2' : 'hidden',
                  )}
                >
                  {section.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        to={link.to}
                        className="inline-flex min-h-11 items-center text-small text-silver transition-colors hover:text-white lg:min-h-0"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {/* 4th Column: Boutique */}
          <div className="border-b border-white/10 py-3 lg:border-b-0 lg:py-0">
            <button
              type="button"
              onClick={() => toggleSection('boutique')}
              aria-expanded={openAccordion === 'boutique'}
              className="flex min-h-11 w-full items-center justify-between py-2 text-left text-label text-white lg:pointer-events-none lg:min-h-0 lg:py-0"
            >
              <span>Boutique</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-silver transition-transform lg:hidden',
                  openAccordion === 'boutique' && 'rotate-180',
                )}
                aria-hidden="true"
              />
            </button>

            <div
              className={cn(
                'mt-3 space-y-3 text-small text-silver lg:mt-4 lg:block',
                openAccordion === 'boutique' ? 'block pb-2' : 'hidden',
              )}
            >
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white" aria-hidden="true" />
                <span>{formattedAddress}</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-white" aria-hidden="true" />
                <span>{formattedHours}</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-white" aria-hidden="true" />
                <span className="font-mono">
                  {settings?.whatsappNumber ?? '+237 6 90 00 00 00'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row — dès 640 px, les pastilles s'arrêtent avant la colonne du bouton WhatsApp flottant */}
        <div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:pr-14">
          <p className="text-xs text-silver">
            © 2026 DR Choco L&apos;Incompris. Tous droits réservés.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-[var(--radius-sm)] bg-ink-2 px-3 py-1.5 text-xs font-semibold text-white">
              Orange Money
            </span>
            <span className="rounded-[var(--radius-sm)] bg-ink-2 px-3 py-1.5 text-xs font-semibold text-white">
              MTN MoMo
            </span>
          </div>
        </div>
      </Container>
    </footer>
  );
}
