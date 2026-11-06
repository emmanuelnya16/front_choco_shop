import * as m from 'motion/react-m';
import { Check, Download } from 'lucide-react';
import { WhatsAppIcon } from '@/components/layout/FloatingWhatsApp';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Primitives';
import { usePublicSettings } from '@/features/catalog/api/useCatalogQueries';
import { InstallSheets } from '@/features/install/InstallSheets';
import { useInstallController } from '@/features/install/useInstallController';
import { buildWhatsAppQuestionUrl } from '@/features/payment/whatsapp';
import { env } from '@/lib/env';
import { fadeUp } from '@/motion/presets';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';

const PWA_BENEFITS = [
  'Accès en un appui',
  'Suivi de vos réservations',
  'Alerte dès que votre colis est prêt',
];

/**
 * Bloc WhatsApp et application. Apparition discrète du bloc au défilement (l'ancien titre révélé
 * mot par mot avec GSAP SplitText faisait concurrence à l'entrée du hero : un seul effet fort par écran).
 */
export function WhatsAppAppSection() {
  const reducedMotion = useReducedMotionPref();
  const { data: settings } = usePublicSettings();
  const install = useInstallController('home');

  // Numéro des réglages publics, sinon celui de la configuration de la boutique (jamais un numéro fictif)
  const whatsappUrl = buildWhatsAppQuestionUrl(settings?.whatsappNumber ?? env.shopWhatsapp);

  return (
    <section className="py-section">
      <Container className="px-0 lg:px-page">
        <div className="bg-ink px-page py-10 text-white lg:rounded-[var(--radius-md)] lg:p-12">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center lg:gap-10">
            {/* Gauche : aide sur WhatsApp */}
            <m.div
              variants={fadeUp}
              initial={reducedMotion ? 'visible' : 'hidden'}
              whileInView="visible"
              viewport={{ once: true, amount: 0.25 }}
              className="lg:col-span-7"
            >
              <span className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-red px-3 py-1 text-label text-white">
                Besoin d&rsquo;aide&nbsp;?
              </span>

              <h2 className="mt-4 text-h1 text-white">
                UNE QUESTION&nbsp;? ON VOUS RÉPOND SUR WHATSAPP.
              </h2>

              <p className="mt-3 max-w-lg text-body text-silver">
                Un doute sur votre taille, la coupe d&rsquo;un t-shirt ou le délai de livraison vers
                votre ville&nbsp;? Notre équipe vous répond en direct.
              </p>

              <div className="mt-6">
                <Button
                  variant="primary"
                  size="lg"
                  href={whatsappUrl}
                  external
                  iconLeft={<WhatsAppIcon className="h-5 w-5" />}
                >
                  Écrire sur WhatsApp
                </Button>
              </div>
            </m.div>

            {/* Droite : carte d'installation (masquée une fois l'application installée, M6 §5.2) */}
            <div
              hidden={!install.canOffer}
              className="rounded-[var(--radius-md)] border border-white/10 bg-ink-2 p-6 lg:col-span-5 lg:p-8"
            >
              <span className="text-label text-silver">Application mobile</span>
              <h3 className="mt-2 text-h3 text-white">
                Ajoutez DR Choco à votre écran d&rsquo;accueil
              </h3>

              <ul className="mt-4 space-y-3">
                {PWA_BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-3 text-small text-silver">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                      <Check className="h-3 w-3" aria-hidden="true" />
                    </span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                <Button
                  variant="outline-light"
                  size="md"
                  fullWidth
                  iconLeft={<Download className="h-4 w-4" aria-hidden="true" />}
                  onClick={install.open}
                >
                  Installer l&rsquo;application
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Container>
      <InstallSheets controller={install} />
    </section>
  );
}
