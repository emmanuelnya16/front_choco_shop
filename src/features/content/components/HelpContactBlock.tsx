import { WhatsAppIcon } from '@/components/layout/FloatingWhatsApp';
import { useShopWhatsapp } from '@/components/layout/useShopWhatsapp';
import { Button } from '@/components/ui/Button';
import { buildWhatsAppQuestionUrl } from '@/features/payment/whatsapp';
import { cn } from '@/lib/utils/cn';

const TITLE = 'Vous n’avez pas trouvé\u00A0?';

/**
 * Fin des pages d'aide (M7 §3.3) : contact WhatsApp, même lien prérempli que le profil (M5).
 * Numéro de la boutique inconnu (réglages absents) : le bloc ne s'affiche pas.
 */
export function HelpContactBlock({ className }: { className?: string }) {
  const whatsapp = useShopWhatsapp();
  if (!whatsapp) return null;

  return (
    <section
      aria-labelledby="aide-contact-titre"
      className={cn('rounded-[var(--radius-md)] border border-silver bg-surface p-5 sm:p-6', className)}
    >
      <h2 id="aide-contact-titre" className="text-h3 text-ink">
        {TITLE}
      </h2>
      <p className="mt-2 text-body text-text-2">
        Écrivez-nous sur WhatsApp. Une personne de la boutique vous répond.
      </p>
      <Button
        variant="dark"
        size="lg"
        href={buildWhatsAppQuestionUrl(whatsapp.number)}
        external
        className="mt-4 w-full sm:w-auto"
        iconLeft={<WhatsAppIcon className="h-5 w-5" />}
      >
        Contacter la boutique sur WhatsApp
      </Button>
    </section>
  );
}
