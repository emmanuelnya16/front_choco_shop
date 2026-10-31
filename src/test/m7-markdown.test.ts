import { render } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { splitFaq } from '@/features/content/faq';
import { formatUpdatedAt } from '@/features/content/format';
import { MarkdownContent } from '@/features/content/markdown/MarkdownContent';
import {
  createSlugger,
  extractToc,
  inlineText,
  parseInline,
  parseMarkdown,
  sanitizeHref,
  slugify,
  type MdBlock,
  type MdInline,
} from '@/features/content/markdown/parse';
import { frenchSpacing } from '@/features/content/markdown/typography';

const NBSP = '\u00A0';

function renderMarkdown(source: string) {
  return render(
    createElement(MemoryRouter, null, createElement(MarkdownContent, { blocks: parseMarkdown(source) })),
  );
}

function firstParagraph(source: string): MdInline[] {
  const block = parseMarkdown(source)[0];
  if (block?.type !== 'paragraph') throw new Error(`Paragraphe attendu, reçu ${block?.type}`);
  return block.children;
}

/** Tous les liens d'un arbre de blocs (y compris dans les listes, tableaux et citations). */
function collectLinks(blocks: MdBlock[]): Array<Extract<MdInline, { type: 'link' }>> {
  const links: Array<Extract<MdInline, { type: 'link' }>> = [];
  const visitInlines = (nodes: MdInline[]) => {
    for (const node of nodes) {
      if (node.type === 'link') links.push(node);
      if (node.type === 'strong' || node.type === 'em' || node.type === 'link') visitInlines(node.children);
    }
  };
  const visitBlocks = (list: MdBlock[]) => {
    for (const block of list) {
      if (block.type === 'heading' || block.type === 'paragraph') visitInlines(block.children);
      if (block.type === 'blockquote') visitBlocks(block.children);
      if (block.type === 'list') {
        for (const item of block.items) {
          visitInlines(item.children);
          visitBlocks(item.blocks);
        }
      }
      if (block.type === 'table') {
        block.header.forEach(visitInlines);
        block.rows.forEach((row) => row.forEach(visitInlines));
      }
    }
  };
  visitBlocks(blocks);
  return links;
}

describe('M7 · Markdown · titres et ancres', () => {
  it('convertit # et ## en h2, ### en h3, #### en h4 (le titre de la page reste le seul h1)', () => {
    const blocks = parseMarkdown('# Grand titre\n## Section\n### Sous-section\n#### Détail');
    expect(blocks.map((block) => (block.type === 'heading' ? block.level : null))).toEqual([2, 2, 3, 4]);
    const last = blocks[3];
    expect(last.type === 'heading' && last.id).toBeNull();
  });

  it('crée des identifiants sans accents, en minuscules, dédoublonnés et stables', () => {
    const source = '## Délai de 24 h ?\n## Tarifs\n## Tarifs\n### Tarifs\n## Qu’est-ce que la preuve ?';
    const ids = parseMarkdown(source).map((block) => (block.type === 'heading' ? block.id : null));
    expect(ids).toEqual(['delai-de-24-h', 'tarifs', 'tarifs-2', 'tarifs-3', 'qu-est-ce-que-la-preuve']);
    // Même texte, même résultat : les liens vers une section restent valables
    expect(parseMarkdown(source).map((block) => (block.type === 'heading' ? block.id : null))).toEqual(ids);
  });

  it('évite les identifiants déjà utilisés par la coquille de l’app', () => {
    const [heading] = parseMarkdown('## Contenu');
    expect(heading.type === 'heading' && heading.id).toBe('contenu-2');
    const slugger = createSlugger([]);
    expect(slugger('Contenu')).toBe('contenu');
    expect(slugify('Œuvre & Ætre — 100 %')).toBe('oeuvre-aetre-100');
    expect(slugify('!!!')).toBe('section');
  });

  it('retire la séquence de fermeture « ## » d’un titre', () => {
    const [heading] = parseMarkdown('## Livraison ##');
    expect(heading.type === 'heading' && heading.text).toBe('Livraison');
  });

  it('génère le sommaire depuis les h2 (ou les h3 à défaut)', () => {
    const toc = extractToc(parseMarkdown('Intro\n## Un\n### Un point un\n## Deux'));
    expect(toc).toEqual([
      { id: 'un', text: 'Un', level: 2 },
      { id: 'deux', text: 'Deux', level: 2 },
    ]);
    expect(extractToc(parseMarkdown('### A\n### B')).map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(extractToc(parseMarkdown('Texte seul'))).toEqual([]);
  });
});

describe('M7 · Markdown · paragraphes, listes, tableaux', () => {
  it('assemble les lignes d’un paragraphe et respecte les retours forcés', () => {
    expect(firstParagraph('ligne un\nligne deux')).toEqual([{ type: 'text', value: 'ligne un ligne deux' }]);
    expect(firstParagraph('ligne un  \nligne deux')).toEqual([
      { type: 'text', value: 'ligne un' },
      { type: 'break' },
      { type: 'text', value: 'ligne deux' },
    ]);
    expect(parseMarkdown('premier\n\nsecond').map((block) => block.type)).toEqual(['paragraph', 'paragraph']);
  });

  it('gère les listes à puces, numérotées (avec numéro de départ) et imbriquées', () => {
    const blocks = parseMarkdown('- un\n- deux\n  - deux point un\n\n3. trois\n4. quatre');
    expect(blocks).toHaveLength(2);
    const [bullets, numbers] = blocks;
    if (bullets.type !== 'list' || numbers.type !== 'list') throw new Error('Listes attendues');
    expect(bullets.ordered).toBe(false);
    expect(bullets.items.map((item) => inlineText(item.children))).toEqual(['un', 'deux']);
    const nested = bullets.items[1].blocks[0];
    expect(nested.type === 'list' && nested.items.map((item) => inlineText(item.children))).toEqual([
      'deux point un',
    ]);
    expect(numbers.ordered).toBe(true);
    expect(numbers.start).toBe(3);
    expect(numbers.items).toHaveLength(2);
  });

  it('ne confond pas une liste avec du gras ou un séparateur', () => {
    expect(parseMarkdown('**Gras** en début de ligne')[0].type).toBe('paragraph');
    expect(parseMarkdown('---')[0].type).toBe('hr');
    expect(parseMarkdown('- - -')[0].type).toBe('hr');
    expect(parseMarkdown('***')[0].type).toBe('hr');
  });

  it('lit un tableau simple avec alignements et lignes incomplètes', () => {
    const [table] = parseMarkdown(
      '| Mode | Délai | Frais |\n| :--- | :---: | ---: |\n| Douala | Demain | 1 500 FCFA |\n| Agence | 1 à 3 jours |',
    );
    if (table.type !== 'table') throw new Error('Tableau attendu');
    expect(table.header.map(inlineText)).toEqual(['Mode', 'Délai', 'Frais']);
    expect(table.align).toEqual(['left', 'center', 'right']);
    expect(table.rows).toHaveLength(2);
    expect(inlineText(table.rows[0][2])).toBe(`1${NBSP}500${NBSP}FCFA`);
    expect(table.rows[1]).toHaveLength(3);
    expect(table.rows[1][2]).toEqual([]);
  });

  it('lit les citations et les séparateurs', () => {
    const blocks = parseMarkdown('> **Texte provisoire**\n> suite\n\n---\n\nAprès');
    expect(blocks.map((block) => block.type)).toEqual(['blockquote', 'hr', 'paragraph']);
    const quote = blocks[0];
    expect(quote.type === 'blockquote' && quote.children[0].type).toBe('paragraph');
  });
});

describe('M7 · Markdown · texte en ligne', () => {
  it('gras, italique, imbrication et code', () => {
    expect(parseInline('**gras** et *italique*')).toEqual([
      { type: 'strong', children: [{ type: 'text', value: 'gras' }] },
      { type: 'text', value: ' et ' },
      { type: 'em', children: [{ type: 'text', value: 'italique' }] },
    ]);
    expect(parseInline('***les deux***')).toEqual([
      { type: 'em', children: [{ type: 'strong', children: [{ type: 'text', value: 'les deux' }] }] },
    ]);
    expect(parseInline('*a **b** c*')).toEqual([
      {
        type: 'em',
        children: [
          { type: 'text', value: 'a ' },
          { type: 'strong', children: [{ type: 'text', value: 'b' }] },
          { type: 'text', value: ' c' },
        ],
      },
    ]);
    expect(parseInline('Composez `*126#` puis')).toEqual([
      { type: 'text', value: 'Composez ' },
      { type: 'code', value: '*126#' },
      { type: 'text', value: ' puis' },
    ]);
  });

  it('laisse en texte les astérisques isolés, non fermés ou échappés', () => {
    expect(parseInline('5 * 3 * 2')).toEqual([{ type: 'text', value: '5 * 3 * 2' }]);
    expect(parseInline('**non fermé')).toEqual([{ type: 'text', value: '**non fermé' }]);
    expect(parseInline('\\*pas en italique\\*')).toEqual([{ type: 'text', value: '*pas en italique*' }]);
  });

  it('garde le repère « [À COMPLÉTER …] » lisible et en gras', () => {
    expect(parseInline('**[À COMPLÉTER PAR LA BOUTIQUE : délai]**')).toEqual([
      {
        type: 'strong',
        children: [{ type: 'placeholder', value: `[À COMPLÉTER PAR LA BOUTIQUE${NBSP}: délai]` }],
      },
    ]);
    // Sans les astérisques, ou sans accents : toujours repéré
    expect(parseInline('Durée : [À COMPLÉTER]')[1]).toEqual({ type: 'placeholder', value: '[À COMPLÉTER]' });
    expect(parseInline('[A COMPLETER : horaires]')[0].type).toBe('placeholder');
    // Crochets ordinaires : simple texte
    expect(parseInline('[note]')).toEqual([{ type: 'text', value: '[note]' }]);

    const { container } = renderMarkdown('Délai : **[À COMPLÉTER PAR LA BOUTIQUE : 48 h]**');
    const marks = container.querySelectorAll('[data-placeholder]');
    expect(marks).toHaveLength(1);
    expect(marks[0].tagName).toBe('STRONG');
    // textContent exact : toHaveTextContent ramène les espaces insécables à des espaces simples
    expect(marks[0].textContent).toBe(`[À COMPLÉTER PAR LA BOUTIQUE${NBSP}: 48${NBSP}h]`);
  });

  it('pose les espaces insécables de la typographie française', () => {
    expect(frenchSpacing('Note : vous avez 24 h ! Prêt ? Oui ; « bien » 45 000 FCFA, 10 Mo')).toBe(
      `Note${NBSP}: vous avez 24${NBSP}h${NBSP}! Prêt${NBSP}? Oui${NBSP}; «${NBSP}bien${NBSP}» 45${NBSP}000${NBSP}FCFA, 10${NBSP}Mo`,
    );
    const once = frenchSpacing('Payez 1 500 000 FCFA : merci !');
    expect(frenchSpacing(once)).toBe(once);
    // Alignement de tableau et adresses intacts
    expect(frenchSpacing('| :--- | ---: |')).toBe('| :--- | ---: |');
    expect(frenchSpacing('https://exemple.cm/a?b=1')).toBe('https://exemple.cm/a?b=1');
  });
});

describe('M7 · Markdown · liens sûrs', () => {
  it('accepte https:, http:, mailto:, tel: et les chemins internes', () => {
    expect(sanitizeHref('https://exemple.cm/page?x=1')).toEqual({ href: 'https://exemple.cm/page?x=1', kind: 'external' });
    expect(sanitizeHref('http://exemple.cm')).toEqual({ href: 'http://exemple.cm/', kind: 'external' });
    expect(sanitizeHref('HTTPS://EXEMPLE.CM/')).toEqual({ href: 'https://exemple.cm/', kind: 'external' });
    expect(sanitizeHref('mailto:contact@exemple.cm')).toEqual({ href: 'mailto:contact@exemple.cm', kind: 'app' });
    expect(sanitizeHref('tel:+237690000000')).toEqual({ href: 'tel:+237690000000', kind: 'app' });
    expect(sanitizeHref('/aide/comment-reserver')).toEqual({ href: '/aide/comment-reserver', kind: 'internal' });
    expect(sanitizeHref('  /pages/confidentialite  ')).toEqual({ href: '/pages/confidentialite', kind: 'internal' });
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    'java script:alert(1)',
    '&#106;avascript:alert(1)',
    'jav&#x61;script:alert(1)',
    '%6Aavascript:alert(1)',
    'javascript%3Aalert(1)',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'DATA:image/svg+xml,<svg onload=alert(1)>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    '//evil.example',
    '/\\evil.example',
    'https://exemple.cm/a b',
    'https://',
    'aide/comment-reserver',
    '#section',
    '',
  ])('refuse « %s »', (href) => {
    expect(sanitizeHref(href)).toBeNull();
  });

  it('transforme un lien refusé en texte simple, sans jamais montrer l’adresse', () => {
    for (const source of [
      '[x](javascript:alert(1))',
      '[x](JaVaScRiPt:alert(document.cookie))',
      '[x]( javascript:alert(1) )',
      '[x](data:text/html,<script>alert(1)</script>)',
      '[x](java script:alert(1))',
      '[x](%6Aavascript:alert(1))',
      '[x](/\\evil.example)',
      '[x](\\/\\/evil.example)',
    ]) {
      expect(parseInline(source), source).toEqual([{ type: 'text', value: 'x' }]);
    }
  });

  it('crée des liens internes, externes et d’application', () => {
    const links = collectLinks(
      parseMarkdown(
        '[Aide](/aide/comment-reserver), [site](https://exemple.cm/(test)), [écrire](mailto:a@b.cm) et [**appeler**](tel:+237690000000)',
      ),
    );
    expect(links.map((link) => [link.kind, link.href])).toEqual([
      ['internal', '/aide/comment-reserver'],
      ['external', 'https://exemple.cm/(test)'],
      ['app', 'mailto:a@b.cm'],
      ['app', 'tel:+237690000000'],
    ]);
    expect(links[3].children[0].type).toBe('strong');
  });
});

describe('M7 · Markdown · rendu React sûr', () => {
  it('affiche le HTML brut comme du texte (aucune balise créée)', () => {
    const { container } = renderMarkdown(
      [
        '<script>alert("xss")</script>',
        '',
        '<img src=x onerror=alert(1)>',
        '',
        '## <b onmouseover=alert(1)>Titre</b>',
        '',
        '- <iframe src="https://evil.example"></iframe>',
        '',
        '| <svg onload=alert(1)> | b |',
        '| --- | --- |',
        '| <a href="javascript:alert(1)">x</a> | c |',
      ].join('\n'),
    );
    expect(container.querySelector('script, img, iframe, svg, b')).toBeNull();
    expect(container.querySelectorAll('a')).toHaveLength(0);
    expect(container.querySelector('[onerror], [onload], [onmouseover]')).toBeNull();
    expect(container).toHaveTextContent('<script>alert("xss")</script>');
    expect(container).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(container.querySelector('h2')).toHaveTextContent('<b onmouseover=alert(1)>Titre</b>');
  });

  it('ne produit aucun lien javascript: ou data:, quelle que soit l’écriture', () => {
    const { container } = renderMarkdown(
      [
        '[a](javascript:alert(1)) [b](JaVaScRiPt:alert(1)) [c](data:text/html,x)',
        '[d]( javascript:alert(1)) [e](vbscript:x) [f](//evil.example) [g](jav&#x61;script:alert(1))',
        '[ok](/aide)',
      ].join('\n'),
    );
    const anchors = Array.from(container.querySelectorAll('a'));
    expect(anchors).toHaveLength(1);
    expect(anchors[0]).toHaveAttribute('href', '/aide');
    expect(container.innerHTML).not.toMatch(/javascript:|data:|vbscript:/i);
    expect(container).toHaveTextContent(/a b c d e f g ok/);
  });

  it('ouvre les liens externes dans un nouvel onglet, sans accès à la page d’origine', () => {
    const { container } = renderMarkdown('[Site](https://exemple.cm) [Interne](/pages/confidentialite) [Tél](tel:+237690000000)');
    const [external, internal, phone] = Array.from(container.querySelectorAll('a'));
    expect(external).toHaveAttribute('target', '_blank');
    expect(external).toHaveAttribute('rel', 'noopener noreferrer');
    expect(internal).toHaveAttribute('href', '/pages/confidentialite');
    expect(internal).not.toHaveAttribute('target');
    expect(phone).toHaveAttribute('href', 'tel:+237690000000');
    expect(phone).not.toHaveAttribute('target');
  });

  it('rend titres ancrés, listes, tableau et citation', () => {
    const { container } = renderMarkdown(
      '## Données collectées\n\nTexte **gras**.\n\n1. un\n2. deux\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n> Note',
    );
    expect(container.querySelector('h2#donnees-collectees')).not.toBeNull();
    expect(container.querySelector('ol')?.children).toHaveLength(2);
    expect(container.querySelectorAll('th[scope="col"]')).toHaveLength(2);
    expect(container.querySelector('td')).toHaveTextContent('1');
    expect(container.querySelector('blockquote')).toHaveTextContent('Note');
    expect(container.querySelector('strong')).toHaveTextContent('gras');
  });
});

describe('M7 · Markdown · robustesse', () => {
  it('reste rapide et sans erreur sur un texte malveillant ou démesuré', () => {
    const hostile = [
      '['.repeat(20_000),
      '('.repeat(5_000),
      '`'.repeat(3_000) + ' `` '.repeat(2_000),
      '*a '.repeat(10_000),
      '> '.repeat(50) + 'citation profonde',
      '  - '.repeat(40) + 'liste profonde',
    ].join('\n');
    const started = performance.now();
    expect(() => parseMarkdown(hostile)).not.toThrow();
    expect(performance.now() - started).toBeLessThan(2000);
  });

  it('ignore une entrée vide ou non textuelle', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown(undefined as unknown as string)).toEqual([]);
  });
});

describe('M7 · Questions fréquentes et date de mise à jour', () => {
  it('découpe la FAQ : une question par titre ##, réponse jusqu’au suivant', () => {
    const { intro, items } = splitFaq(
      parseMarkdown('Introduction\n\n## Puis-je payer en ligne ?\nNon.\n\n- détail\n\n## Combien de temps ?\n### Précision\n24 h.'),
    );
    expect(intro.map((block) => block.type)).toEqual(['paragraph']);
    expect(items.map((item) => item.question)).toEqual([`Puis-je payer en ligne${NBSP}?`, `Combien de temps${NBSP}?`]);
    expect(items[0].id).toBe('puis-je-payer-en-ligne');
    expect(items[0].answer.map((block) => block.type)).toEqual(['paragraph', 'list']);
    expect(items[1].answer.map((block) => block.type)).toEqual(['heading', 'paragraph']);
  });

  it('formate la date en français, au fuseau de Douala', () => {
    expect(formatUpdatedAt('2026-10-31')).toBe('31 octobre 2026');
    expect(formatUpdatedAt('2026-10-31T09:00:00+01:00')).toBe('31 octobre 2026');
    // 23 h 30 à Greenwich = 0 h 30 le lendemain à Douala
    expect(formatUpdatedAt('2026-10-31T23:30:00Z')).toBe('1er novembre 2026');
    expect(formatUpdatedAt('pas une date')).toBe('');
  });
});
