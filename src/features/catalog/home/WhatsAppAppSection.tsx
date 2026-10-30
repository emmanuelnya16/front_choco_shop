import { Check, Download } from 'lucide-react';
import { useRef } from 'react';
import { WhatsAppIcon } from '@/components/layout/FloatingWhatsApp';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Primitives';
import { usePublicSettings } from '@/features/catalog/api/useCatalogQueries';
import { gsap, SplitText, useGSAP } from '@/lib/gsap';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { useToastStore } from '@/stores/toastStore';

const PWA_BENEFITS = [
  'Accès en un appui',
  'Suivi de vos réservations',
  'Alertes nouveautés',
];

export function WhatsAppAppSection() {
  const scopeRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const reducedMotion = useReducedMotionPref();
  const { data: settings } = usePublicSettings();
  const showToast = useToastStore((s) => s.show);

  const rawNumber = settings?.whatsappNumber ?? '+237690000000';
  const cleanNumber = rawNumber.replace(/[^0-9]/g, '');
  const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(
    "Bonjour DR Choco, j'ai une question.",
  )}`;

  useGSAP(
    () => {
      if (reducedMotion || !titleRef.current || !scopeRef.current) return;

      const split = SplitText.create(titleRef.current, {
        type: 'words',
        mask: 'words',
      });

      gsap.fromTo(
        split.words,
        { yPercent: 105 },
        {
          yPercent: 0,
          duration: 0.75,
          ease: 'power3.out',
          stagger: 0.04,
          scrollTrigger: {
            trigger: scopeRef.current,
            start: 'top 80%',
            once: true,
          },
        },
      );

      return () => {
        split.revert();
      };
    },
    { scope: scopeRef, dependencies: [reducedMotion] },
  );

  return (
    <section ref={scopeRef} className="py-section">
      <Container className="px-0 lg:px-page">
        <div className="bg-ink px-page py-10 text-white lg:rounded-[var(--radius-md)] lg:p-12">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center lg:gap-10">
            {/* Left: WhatsApp Help */}
            <div className="lg:col-span-7">
              <span className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-red px-2.5 py-1 text-label text-white">
                Besoin d&apos;aide ?
              </span>

              <h2
                ref={titleRef}
                className="mt-4 text-h1 text-white"
              >
                UNE QUESTION ? ON VOUS RÉPOND SUR WHATSAPP.
              </h2>

              <p className="mt-3 max-w-lg text-body text-silver">
                Un doute sur votre taille, la coupe d&apos;un t-shirt ou le délai de
                livraison vers votre ville ? Notre équipe vous répond en direct.
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
            </div>

            {/* Right: PWA Install Card */}
            <div className="rounded-[var(--radius-md)] border border-white/10 bg-ink-2 p-6 lg:col-span-5 lg:p-8">
              <span className="text-label text-silver">Application mobile</span>
              <h3 className="mt-2 text-h3 text-white">
                Ajoutez DR Choco à votre écran d&apos;accueil
              </h3>

              <ul className="mt-4 space-y-2.5">
                {PWA_BENEFITS.map((benefit) => (
                  <li
                    key={benefit}
                    className="flex items-center gap-2.5 text-small text-silver"
                  >
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
                  onClick={() =>
                    showToast({
                      message:
                        "Bientôt disponible — l'installation directe arrivera avec la coquille PWA.",
                    })
                  }
                >
                  Installer l&apos;application
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
