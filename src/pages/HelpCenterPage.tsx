import {
  ChevronRight,
  CloudOff,
  LifeBuoy,
  PackageSearch,
  RefreshCw,
  ShoppingBag,
  Smartphone,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Primitives';
import { useContentPage } from '@/features/content/api/useContentPage';
import { FaqAccordion } from '@/features/content/components/FaqAccordion';
import { HelpContactBlock } from '@/features/content/components/HelpContactBlock';
import { splitFaq } from '@/features/content/faq';
import { ANCHOR_OFFSET_CLASS, MarkdownContent } from '@/features/content/markdown/MarkdownContent';
import { parseMarkdown } from '@/features/content/markdown/parse';
import {
  contentPath,
  FAQ_ANCHOR,
  FAQ_SLUG,
  FAQ_TITLE,
  HELP_CENTER_TITLE,
  HELP_PAGES,
  LEGAL_PAGES,
} from '@/features/content/registry';
import { isNetworkError } from '@/features/offline/networkErrors';
import { cn } from '@/lib/utils/cn';
import { useDocumentTitle } from '@/lib/utils/useDocumentTitle';

const HELP_ICONS: Record<string, LucideIcon> = {
  'comment-reserver': ShoppingBag,
  'paiement-mobile-money': Smartphone,
  'livraison-retrait': Truck,
  'suivre-ma-reservation': PackageSearch,
};

const DESCRIPTION =
  'Réserver, payer par Mobile Money, recevoir vos articles ou les retirer en boutique\u00A0: les réponses à vos questions.';

function FaqSkeleton() {
  return (
    <div role="status" aria-label="Chargement des questions fréquentes" className="mt-4 space-y-3">
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

function FaqUnavailable({ offline, onRetry, retrying }: { offline: boolean; onRetry: () => void; retrying: boolean }) {
  return (
    <div role="alert" className="mt-4 rounded-[var(--radius-md)] border border-silver bg-surface p-4">
      <p className="flex items-start gap-2 text-body text-ink">
        {offline && <CloudOff className="mt-1 h-4 w-4 shrink-0 text-text-2" aria-hidden="true" />}
        {offline
          ? 'Les questions fréquentes n’ont pas encore été enregistrées sur votre téléphone.'
          : 'Les questions fréquentes n’ont pas pu être chargées.'}
      </p>
      <Button
        variant="outline"
        size="md"
        className="mt-3"
        loading={retrying}
        onClick={onRetry}
        iconLeft={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
      >
        Réessayer
      </Button>
    </div>
  );
}

/**
 * Centre d'aide (/aide, M7 §3.2) : guides, questions fréquentes (page Markdown
 * « questions-frequentes », modifiable depuis l'administration), contact et pages légales.
 */
export function HelpCenterPage() {
  useDocumentTitle(HELP_CENTER_TITLE, { description: DESCRIPTION });
  const faq = useContentPage(FAQ_SLUG);
  const faqBody = faq.data?.body;
  const faqContent = useMemo(() => (faqBody ? splitFaq(parseMarkdown(faqBody)) : null), [faqBody]);

  return (
    <div className="mx-auto w-full max-w-content px-page pt-4 pb-16 lg:pt-10">
      <BackButton fallback="/" className="mb-2 lg:hidden" />
      <div className="mx-auto max-w-170">
        <header>
          <h1 className="text-h1 text-ink">{HELP_CENTER_TITLE}</h1>
          <p className="mt-3 text-body leading-[1.65] text-text-2">{DESCRIPTION}</p>
        </header>

        <section aria-labelledby="aide-guides-titre" className="mt-10">
          <h2 id="aide-guides-titre" className="text-h2 text-ink">
            Guides
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {HELP_PAGES.map((entry) => {
              const Icon = HELP_ICONS[entry.slug] ?? LifeBuoy;
              return (
                <li key={entry.slug}>
                  <Link
                    to={contentPath(entry)}
                    viewTransition
                    className="flex h-full items-start gap-3 rounded-[var(--radius-md)] border border-silver bg-white p-4 [@media(hover:hover)]:hover:border-ink"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-full)] bg-surface text-ink">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-h3 text-ink">{entry.title}</span>
                      <span className="mt-1 block text-small text-text-2">{entry.description}</span>
                    </span>
                    <ChevronRight className="mt-2.5 h-4 w-4 shrink-0 text-text-2" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section
          id={FAQ_ANCHOR}
          aria-labelledby="questions-frequentes-titre"
          className={cn('mt-12', ANCHOR_OFFSET_CLASS)}
        >
          <h2 id="questions-frequentes-titre" className="text-h2 text-ink">
            {faq.data?.title ?? FAQ_TITLE}
          </h2>
          {faqContent ? (
            <>
              {faqContent.intro.length > 0 && <MarkdownContent blocks={faqContent.intro} className="mt-4" />}
              <div className="mt-4">
                <FaqAccordion items={faqContent.items} />
              </div>
            </>
          ) : faq.error ? (
            <FaqUnavailable
              offline={isNetworkError(faq.error)}
              onRetry={() => void faq.refetch()}
              retrying={faq.isFetching}
            />
          ) : (
            <FaqSkeleton />
          )}
        </section>

        <HelpContactBlock className="mt-12" />

        <section aria-labelledby="aide-legal-titre" className="mt-12">
          <h2 id="aide-legal-titre" className="text-label text-text-2">
            Informations légales
          </h2>
          <ul className="mt-3 divide-y divide-silver/70 border-y border-silver/70">
            {LEGAL_PAGES.map((entry) => (
              <li key={entry.slug}>
                <Link
                  to={contentPath(entry)}
                  className="flex min-h-12 items-center justify-between gap-3 text-body text-ink [@media(hover:hover)]:hover:underline"
                >
                  {entry.title}
                  <ChevronRight className="h-4 w-4 shrink-0 text-text-2" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
