import { useMemo } from 'react';
import { Navigate, useParams } from 'react-router';
import { BackButton } from '@/components/ui/BackButton';
import { useContentPage } from '@/features/content/api/useContentPage';
import { ContentArticle } from '@/features/content/components/ContentArticle';
import { ContentLoadError, ContentNotFound, ContentSkeleton } from '@/features/content/components/ContentStates';
import { HelpContactBlock } from '@/features/content/components/HelpContactBlock';
import { inlineText, parseMarkdown, type MdBlock } from '@/features/content/markdown/parse';
import {
  findContentEntry,
  HELP_CENTER_PATH,
  isValidContentSlug,
  resolveContentRedirect,
} from '@/features/content/registry';
import type { ContentKind } from '@/features/content/types';
import { isNetworkError } from '@/features/offline/networkErrors';
import { OfflineScreen } from '@/features/offline/OfflineScreen';
import { ApiError } from '@/lib/api/client';
import { useDocumentTitle } from '@/lib/utils/useDocumentTitle';

/** Longueur utile d'une description pour les moteurs de recherche. */
const DESCRIPTION_MAX = 155;

/**
 * Description d'une page ajoutée depuis l'administration (inconnue de l'app) : début du premier
 * paragraphe, coupé à un mot entier. Chaque page garde ainsi une description qui lui est propre.
 */
function describeBlocks(blocks: MdBlock[]): string | undefined {
  const paragraph = blocks.find((block) => block.type === 'paragraph');
  if (!paragraph || paragraph.type !== 'paragraph') return undefined;
  const text = inlineText(paragraph.children).replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  if (text.length <= DESCRIPTION_MAX) return text;
  const cut = text.slice(0, DESCRIPTION_MAX - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:]+$/, '')}…`;
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/**
 * Page légale (/pages/:slug) ou page d'aide (/aide/:slug), M7 §3. Le contenu vient de
 * GET /pages/:slug ; une page inconnue de l'app mais connue de l'API s'affiche aussi.
 */
function ContentPageView({ kind }: { kind: ContentKind }) {
  const { slug } = useParams<{ slug: string }>();
  const redirect = resolveContentRedirect(slug, kind);
  const validSlug = isValidContentSlug(slug);
  const entry = findContentEntry(slug);
  const query = useContentPage(validSlug && !redirect ? slug : undefined);
  const { data, error } = query;
  const notFound = !validSlug || isNotFoundError(error);
  const body = data?.body;
  const blocks = useMemo(() => (body ? parseMarkdown(body) : []), [body]);

  const fallbackTitle = entry?.title ?? (kind === 'help' ? 'Aide' : 'Informations');
  useDocumentTitle(notFound ? 'Page introuvable' : (data?.title ?? fallbackTitle), {
    description: notFound ? undefined : (entry?.description ?? describeBlocks(blocks)),
    noindex: notFound ? true : undefined,
  });

  if (redirect) return <Navigate to={redirect} replace />;

  let content;
  if (notFound) {
    content = <ContentNotFound />;
  } else if (data) {
    content = (
      <ContentArticle
        page={data}
        blocks={blocks}
        footer={kind === 'help' ? <HelpContactBlock className="mt-12" /> : null}
      />
    );
  } else if (error && isNetworkError(error)) {
    // Page jamais lue et réseau absent (M6 §6.5)
    content = <OfflineScreen onRetry={() => query.refetch()} />;
  } else if (error) {
    content = <ContentLoadError onRetry={() => void query.refetch()} retrying={query.isFetching} />;
  } else {
    content = <ContentSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-content px-page pt-4 pb-16 lg:pt-10">
      {/* Retour (M6 §8). HYPOTHÈSE: le centre d'aide est le parent logique des pages légales et d'aide */}
      <BackButton fallback={HELP_CENTER_PATH} className="mb-2 lg:hidden" />
      {content}
    </div>
  );
}

export function LegalContentPage() {
  return <ContentPageView kind="legal" />;
}

export function HelpContentPage() {
  return <ContentPageView kind="help" />;
}
