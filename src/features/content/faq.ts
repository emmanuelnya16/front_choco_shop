import type { MdBlock, MdInline } from './markdown/parse';

export interface FaqItem {
  /** Identifiant d'ancre (titre de la question sans accents). */
  id: string;
  question: string;
  questionInlines: MdInline[];
  answer: MdBlock[];
}

export interface FaqContent {
  /** Blocs placés avant la première question. */
  intro: MdBlock[];
  items: FaqItem[];
}

/**
 * Questions fréquentes (M7 §3.2) : chaque titre « ## Question ? » ouvre une question, sa réponse
 * court jusqu'au titre de niveau 2 suivant. Les titres ### restent dans la réponse.
 */
export function splitFaq(blocks: MdBlock[]): FaqContent {
  const intro: MdBlock[] = [];
  const items: FaqItem[] = [];
  for (const block of blocks) {
    if (block.type === 'heading' && block.level === 2 && block.id) {
      items.push({ id: block.id, question: block.text, questionInlines: block.children, answer: [] });
      continue;
    }
    const current = items[items.length - 1];
    if (current) current.answer.push(block);
    else intro.push(block);
  }
  return { intro, items };
}
