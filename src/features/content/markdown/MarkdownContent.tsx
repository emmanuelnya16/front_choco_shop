import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils/cn';
import type { MdAlign, MdBlock, MdInline } from './parse';

/**
 * Rendu React de l'arbre Markdown (M7 §3.1). Chaque nœud devient un élément React : aucun HTML
 * n'est injecté, le texte est toujours échappé par React. Les adresses des liens ont déjà été
 * filtrées par `sanitizeHref` (parse.ts).
 */

const LINK_CLASS =
  'font-semibold text-ink underline decoration-1 underline-offset-[3px] [@media(hover:hover)]:hover:decoration-2';

/** Décalage des ancres : en-tête mobile, ou en-tête replié (et bandeau rouge) sur ordinateur. */
export const ANCHOR_OFFSET_CLASS =
  'scroll-mt-[calc(var(--header-h)+16px)] lg:scroll-mt-[calc(var(--desktop-shell-top)+24px)]';

const ALIGN_CLASS: Record<Exclude<MdAlign, null>, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

function renderInline(node: MdInline, key: string): ReactNode {
  switch (node.type) {
    case 'text':
      return <Fragment key={key}>{node.value}</Fragment>;
    case 'break':
      return <br key={key} />;
    case 'code':
      return (
        <code key={key} className="rounded-[var(--radius-sm)] bg-surface px-1 py-0.5 font-mono text-[0.9em]">
          {node.value}
        </code>
      );
    case 'placeholder':
      return (
        <strong
          key={key}
          data-placeholder=""
          className="rounded-[var(--radius-sm)] bg-surface px-1 font-bold text-ink ring-1 ring-silver [box-decoration-break:clone]"
        >
          {node.value}
        </strong>
      );
    case 'strong':
      // « **[À COMPLÉTER …]** » : le repère est déjà en gras
      if (node.children.length === 1 && node.children[0].type === 'placeholder') {
        return renderInline(node.children[0], key);
      }
      return (
        <strong key={key} className="font-bold">
          {renderInlines(node.children, key)}
        </strong>
      );
    case 'em':
      return <em key={key}>{renderInlines(node.children, key)}</em>;
    case 'link':
      if (node.kind === 'internal') {
        return (
          <Link key={key} to={node.href} className={LINK_CLASS}>
            {renderInlines(node.children, key)}
          </Link>
        );
      }
      if (node.kind === 'external') {
        return (
          <a key={key} href={node.href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
            {renderInlines(node.children, key)}
            <span className="sr-only"> (s’ouvre dans un nouvel onglet)</span>
          </a>
        );
      }
      // HYPOTHÈSE: téléphone et e-mail ouvrent l'application concernée, sans nouvel onglet (comme Button)
      return (
        <a key={key} href={node.href} className={LINK_CLASS}>
          {renderInlines(node.children, key)}
        </a>
      );
  }
}

function renderInlines(nodes: MdInline[], keyPrefix = 'i'): ReactNode[] {
  return nodes.map((node, index) => renderInline(node, `${keyPrefix}-${index}`));
}

function renderBlock(block: MdBlock, key: string): ReactNode {
  switch (block.type) {
    case 'heading': {
      if (block.level === 2) {
        return (
          <h2
            key={key}
            id={block.id ?? undefined}
            tabIndex={-1}
            className={cn('mt-10 text-h2 normal-case text-ink first:mt-0', ANCHOR_OFFSET_CLASS)}
          >
            {renderInlines(block.children, key)}
          </h2>
        );
      }
      if (block.level === 3) {
        return (
          <h3
            key={key}
            id={block.id ?? undefined}
            tabIndex={-1}
            className={cn('mt-8 text-h3 text-ink first:mt-0', ANCHOR_OFFSET_CLASS)}
          >
            {renderInlines(block.children, key)}
          </h3>
        );
      }
      return (
        <h4 key={key} className="mt-6 text-body font-semibold text-ink first:mt-0">
          {renderInlines(block.children, key)}
        </h4>
      );
    }
    case 'paragraph':
      return (
        <p key={key} className="mt-4 first:mt-0">
          {renderInlines(block.children, key)}
        </p>
      );
    case 'list': {
      const items = block.items.map((item, index) => (
        <li key={`${key}-${index}`} className="pl-1">
          {renderInlines(item.children, `${key}-${index}`)}
          {item.blocks.length > 0 && (
            <div className="mt-2">{renderBlocks(item.blocks, `${key}-${index}`)}</div>
          )}
        </li>
      ));
      return block.ordered ? (
        <ol
          key={key}
          start={block.start !== 1 ? block.start : undefined}
          className="mt-4 list-decimal space-y-2 pl-6 first:mt-0 marker:font-semibold marker:text-text-2"
        >
          {items}
        </ol>
      ) : (
        <ul key={key} className="mt-4 list-disc space-y-2 pl-6 first:mt-0 marker:text-text-2">
          {items}
        </ul>
      );
    }
    case 'table':
      return (
        // Défilement horizontal au clavier sur petit écran
        <div
          key={key}
          role="region"
          aria-label="Tableau"
          tabIndex={0}
          className="mt-6 overflow-x-auto rounded-[var(--radius-md)] border border-silver first:mt-0"
        >
          <table className="w-full border-collapse text-left text-small">
            <thead className="bg-surface">
              <tr>
                {block.header.map((cell, column) => (
                  <th
                    key={column}
                    scope="col"
                    className={cn(
                      'border-b border-silver px-3 py-2.5 font-semibold text-ink',
                      block.align[column] && ALIGN_CLASS[block.align[column]],
                    )}
                  >
                    {renderInlines(cell, `${key}-h${column}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-silver/60 last:border-b-0">
                  {row.map((cell, column) => (
                    <td
                      key={column}
                      className={cn(
                        'px-3 py-2.5 align-top text-ink',
                        block.align[column] && ALIGN_CLASS[block.align[column]],
                      )}
                    >
                      {renderInlines(cell, `${key}-${rowIndex}-${column}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'blockquote':
      return (
        <blockquote
          key={key}
          className="mt-6 rounded-r-[var(--radius-md)] border-l-4 border-ink bg-surface px-4 py-3 first:mt-0"
        >
          {renderBlocks(block.children, key)}
        </blockquote>
      );
    case 'hr':
      return <hr key={key} className="my-8 border-silver" />;
  }
}

function renderBlocks(blocks: MdBlock[], keyPrefix = 'b'): ReactNode[] {
  return blocks.map((block, index) => renderBlock(block, `${keyPrefix}-${index}`));
}

/** Texte en ligne seul (question d'un accordéon, intitulé). */
export function InlineContent({ nodes }: { nodes: MdInline[] }) {
  return <>{renderInlines(nodes)}</>;
}

export interface MarkdownContentProps {
  blocks: MdBlock[];
  className?: string;
}

/** Texte de lecture : corps 16 px, interligne 1,65 (M7 §3.3). */
export function MarkdownContent({ blocks, className }: MarkdownContentProps) {
  return <div className={cn('text-body leading-[1.65] text-ink', className)}>{renderBlocks(blocks)}</div>;
}
