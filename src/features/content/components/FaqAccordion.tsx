import { ChevronDown } from 'lucide-react';
import * as m from 'motion/react-m';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { cn } from '@/lib/utils/cn';
import { duration, ease } from '@/motion/tokens';
import { useReducedMotionPref } from '@/motion/useReducedMotionPref';
import { readHashId } from '../anchors';
import type { FaqItem } from '../faq';
import { ANCHOR_OFFSET_CLASS, InlineContent, MarkdownContent } from '../markdown/MarkdownContent';

export interface FaqAccordionProps {
  items: FaqItem[];
}

/**
 * Questions fréquentes en accordéons (M7 §3.2) : bouton dans un titre, aria-expanded et
 * aria-controls, réponse dans une région nommée par sa question ; Entrée et Espace ouvrent ou
 * ferment (bouton natif). Plusieurs réponses peuvent rester ouvertes. Ouverture en
 * opacité et translation seulement ; aucune animation en mode réduit.
 * Une adresse « /aide#question » ouvre directement la question.
 */
export function FaqAccordion({ items }: FaqAccordionProps) {
  const location = useLocation();
  const reducedMotion = useReducedMotionPref();
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set());
  const [handledHash, setHandledHash] = useState('');

  const hashId = readHashId(location.hash);
  const linkedItem = items.find((item) => item.id === hashId);
  if (linkedItem && handledHash !== hashId) {
    setHandledHash(hashId);
    setOpenIds((current) => new Set(current).add(linkedItem.id));
  }

  useEffect(() => {
    if (!linkedItem) return;
    document.getElementById(linkedItem.id)?.scrollIntoView({ block: 'start' });
  }, [linkedItem]);

  const toggle = (id: string) => {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <ul className="divide-y divide-silver border-y border-silver">
      {items.map((item) => {
        const expanded = openIds.has(item.id);
        const buttonId = `${item.id}-question`;
        const panelId = `${item.id}-reponse`;
        return (
          <li key={item.id} id={item.id} className={ANCHOR_OFFSET_CLASS}>
            <h3 className="text-h3">
              <button
                type="button"
                id={buttonId}
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
                className="flex min-h-14 w-full items-center justify-between gap-4 py-4 text-left text-ink"
              >
                <span>
                  <InlineContent nodes={item.questionInlines} />
                </span>
                <m.span
                  aria-hidden="true"
                  initial={false}
                  animate={{ rotate: expanded ? 180 : 0 }}
                  transition={reducedMotion ? { duration: 0 } : { duration: duration.fast, ease: ease.out }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-full)] bg-surface text-ink"
                >
                  <ChevronDown className="h-4 w-4" />
                </m.span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!expanded}
              className={cn(expanded && 'pb-5')}
            >
              <m.div
                initial={false}
                animate={expanded ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
                transition={reducedMotion ? { duration: 0 } : { duration: duration.fast, ease: ease.out }}
              >
                <MarkdownContent blocks={item.answer} />
              </m.div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
