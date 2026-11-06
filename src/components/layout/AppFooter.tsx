import { ChevronDown, Clock, MapPin, Phone } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { WhatsAppIcon } from '@/components/layout/FloatingWhatsApp';
import { useShopWhatsapp } from '@/components/layout/useShopWhatsapp';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { Container } from '@/components/ui/Primitives';
import { usePublicSettings } from '@/features/catalog/api/useCatalogQueries';
import { cn } from '@/lib/utils/cn';
import { formatOpeningHours } from '@/lib/utils/date';
import { formatCmPhoneInternational } from '@/lib/utils/phone';

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
  // Centre d'aide, pages d'aide et pages légales (M7 §3)
  {
    id: 'aide',
    title: 'Aide',
    links: [
      { label: 'Centre d’aide', to: '/aide' },
      { label: 'Comment réserver', to: '/aide/comment-reserver' },
      { label: 'Payer par Mobile Money', to: '/aide/paiement-mobile-money' },
      { label: 'Livraison et retrait', to: '/aide/livraison-retrait' },
      { label: 'Suivre ma réservation', to: '/aide/suivre-ma-reservation' },
    ],
  },
  {
    id: 'legal',
    title: 'Légal',
    links: [
      { label: 'Conditions générales', to: '/pages/conditions-generales' },
      { label: 'Politique d’annulation et de retour', to: '/pages/annulation-retours' },
      { label: 'Confidentialité', to: '/pages/confidentialite' },
      { label: 'Mentions légales', to: '/pages/mentions-legales' },
    ],
  },
];

/**
 * Téléphone et tablette (sous lg, barre basse visible) : bande basse et discrète, demandée par la
 * boutique. Seulement l'aide et les pages légales (accessibles depuis chaque page) et le ©. Pas de
 * bouton WhatsApp : le bouton flottant s'en charge.
 */
// « Conditions » à l'écran, « Conditions générales » pour les lecteurs d'écran (le texte visible
// commence le nom accessible) : mesuré à 390 px, les quatre libellés complets demandent 364 px pour
// 358 disponibles (328 à 360 px) avec des cibles de 44 px ; ils passeraient sur deux lignes.
const COMPACT_LINKS: Array<{ label: string; to: string; accessibleName?: string }> = [
  { label: 'Aide', to: '/aide' },
  { label: 'Conditions', accessibleName: 'Conditions générales', to: '/pages/conditions-generales' },
  { label: 'Confidentialité', to: '/pages/confidentialite' },
  { label: 'Mentions légales', to: '/pages/mentions-legales' },
];

function CompactFooter({ year }: { year: number }) {
  return (
    // Fond de la page, simple filet en haut ; text-2 sur blanc : contraste 5,26:1 (AA)
    <div data-footer="compact" className="border-t border-silver bg-white px-page py-3 lg:hidden">
      <nav aria-label="Aide et informations légales">
        <ul className="flex flex-wrap items-center justify-center">
          {COMPACT_LINKS.map((link, index) => (
            <li key={link.to} className="flex items-center">
              {index > 0 && (
                <span aria-hidden="true" className="text-caption text-text-2">
                  ·
                </span>
              )}
              <Link
                to={link.to}
                aria-label={link.accessibleName}
                // Cible tactile de 44 × 44 px au moins ; le texte reste en 12 px. Lien court en tête
                // (« Aide ») : sa marge en plus passe à gauche, l'écart avant le point reste régulier
                className={cn(
                  'inline-flex min-h-11 min-w-11 items-center justify-center px-1.5 text-caption text-text-2 underline-offset-4 transition-colors duration-fast hover:text-ink hover:underline',
                  index === 0 && 'justify-end',
                )}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <p className="text-center text-caption text-text-2">© {year} DR Choco L&rsquo;Incompris</p>
    </div>
  );
}

export function AppFooter() {
  const { data: settings } = usePublicSettings();
  const year = new Date().getFullYear();
  const [openAccordion, setOpenAccordion] = useState<string | null>('categories');

  // Coordonnées de la boutique : uniquement celles des réglages (jamais d'adresse ni de numéro fictifs)
  const whatsapp = useShopWhatsapp();
  const pickup = settings?.pickupAddress;
  const formattedAddress = pickup
    ? `${pickup.name} — ${pickup.quarter}, ${pickup.city}${pickup.landmark ? ` (${pickup.landmark})` : ''}`
    : null;
  const formattedHours = pickup?.openingHours ? formatOpeningHours(pickup.openingHours) : null;
  const hasShopDetails = Boolean(formattedAddress || formattedHours || whatsapp);

  const toggleSection = (id: string) => {
    setOpenAccordion((prev) => (prev === id ? null : id));
  };

  return (
    // Mobile : place réservée sous le pied de page pour la pile du bas (barre basse ou barre d'action,
    // bandeau rouge, bandeau de mise à jour, bouton WhatsApp flottant — index.css) ; tout en bas,
    // rien n'est caché ni recouvert
    <footer className="bg-white pb-[calc(var(--bottom-bar-h)+var(--pending-banner-h)+var(--update-banner-h)+var(--floating-button-h))] lg:bg-ink lg:pb-0 lg:text-silver">
      <CompactFooter year={year} />

      {/* Ordinateur (lg et plus) : pied de page complet, inchangé */}
      <div data-footer="full" className="hidden lg:block">
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

            {whatsapp && (
              <Button
                variant="outline-light"
                size="md"
                href={whatsapp.url}
                external
                iconLeft={<WhatsAppIcon className="h-4 w-4" />}
              >
                Nous écrire sur WhatsApp
              </Button>
            )}
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
                        'h-4 w-4 text-silver transition-transform duration-fast lg:hidden',
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
                          className="inline-flex min-h-11 items-center text-small text-silver transition-colors duration-fast hover:text-white lg:min-h-0"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}

            {/* 4th Column: Boutique (seulement si les réglages donnent ses coordonnées) */}
            {hasShopDetails && (
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
                      'h-4 w-4 text-silver transition-transform duration-fast lg:hidden',
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
                  {formattedAddress && (
                    <div className="flex items-start gap-2.5">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white" aria-hidden="true" />
                      <span>{formattedAddress}</span>
                    </div>
                  )}
                  {formattedHours && (
                    <div className="flex items-start gap-2.5">
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-white" aria-hidden="true" />
                      <span>{formattedHours}</span>
                    </div>
                  )}
                  {whatsapp && (
                    <div className="flex items-start gap-2.5">
                      <Phone className="mt-0.5 h-4 w-4 shrink-0 text-white" aria-hidden="true" />
                      <span className="tabular-nums">{formatCmPhoneInternational(whatsapp.number)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Row — dès 640 px, les pastilles s'arrêtent avant la colonne du bouton WhatsApp flottant */}
          <div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:pr-14">
            <p className="text-caption text-silver">
              © {year} DR Choco L&rsquo;Incompris. Tous droits réservés.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-[var(--radius-sm)] bg-ink-2 px-3 py-1.5 text-caption font-semibold text-white">
                Orange Money
              </span>
              <span className="rounded-[var(--radius-sm)] bg-ink-2 px-3 py-1.5 text-caption font-semibold text-white">
                MTN MoMo
              </span>
            </div>
          </div>
        </Container>
      </div>
    </footer>
  );
}
