import { useEffect, useMemo, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { cn } from '@/lib/utils/cn';
import { readHashId } from '../anchors';
import { formatUpdatedAt } from '../format';
import { MarkdownContent } from '../markdown/MarkdownContent';
import { extractToc, type MdBlock } from '../markdown/parse';
import type { ContentPageResponse } from '../types';
import { DesktopTableOfContents, MobileTableOfContents } from './TableOfContents';
import { useActiveHeading } from './useActiveHeading';

export interface ContentArticleProps {
  page: ContentPageResponse;
  blocks: MdBlock[];
  /** Bloc de fin (contact WhatsApp des pages d'aide). */
  footer?: ReactNode;
}

/**
 * Mise en page de lecture (M7 §3.3) : 680 px au plus, titre et date de mise à jour ; sur
 * ordinateur, sommaire collant à droite (à partir de 2 sections) ; sur mobile, sommaire
 * repliable en haut (à partir de 3 sections).
 */
export function ContentArticle({ page, blocks, footer }: ContentArticleProps) {
  const location = useLocation();
  const toc = useMemo(() => extractToc(blocks), [blocks]);
  const tocIds = useMemo(() => toc.map((entry) => entry.id), [toc]);
  const [activeId, selectHeading] = useActiveHeading(tocIds);
  const showDesktopToc = toc.length >= 2;
  const showMobileToc = toc.length >= 3;
  const updatedAt = formatUpdatedAt(page.updatedAt);

  // Lien vers une section (« /pages/confidentialite#vos-droits ») : la page arrive après le
  // changement d'adresse, on défile une fois le texte affiché.
  const hashId = readHashId(location.hash);
  useEffect(() => {
    if (!hashId) return;
    const target = document.getElementById(hashId);
    if (!target) return;
    target.scrollIntoView({ block: 'start' });
    if (tocIds.includes(hashId)) selectHeading(hashId);
  }, [hashId, blocks, tocIds, selectHeading]);

  return (
    <div
      className={cn(
        showDesktopToc && 'lg:grid lg:grid-cols-[minmax(0,680px)_minmax(0,240px)] lg:justify-center lg:gap-16',
      )}
    >
      <article aria-labelledby="page-titre" className={cn('min-w-0 max-w-[680px]', !showDesktopToc && 'mx-auto')}>
        <header>
          <h1 id="page-titre" className="text-h1 break-words text-ink">
            {page.title}
          </h1>
          {updatedAt && (
            <p className="mt-3 text-small text-text-2">
              Mis à jour le <time dateTime={page.updatedAt}>{updatedAt}</time>
            </p>
          )}
        </header>

        {showMobileToc && (
          <div className="mt-6 lg:hidden">
            <MobileTableOfContents entries={toc} activeId={activeId} onSelect={selectHeading} />
          </div>
        )}

        <MarkdownContent blocks={blocks} className="mt-8" />
        {footer}
      </article>

      {showDesktopToc && (
        <aside className="hidden lg:block">
          <DesktopTableOfContents entries={toc} activeId={activeId} onSelect={selectHeading} />
        </aside>
      )}
    </div>
  );
}
