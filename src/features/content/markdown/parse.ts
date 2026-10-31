import { frenchSpacing } from './typography';

/**
 * Markdown léger et sûr (M7 §3.1), sans dépendance : le texte est converti en un arbre de nœuds,
 * rendu ensuite en éléments React (jamais de HTML injecté). Tout HTML présent dans le texte reste
 * du texte, échappé par React.
 *
 * Pris en charge : titres # à ###, paragraphes, listes à puces et numérotées (imbriquées),
 * gras **, italique *, code `…`, liens [texte](adresse), tableaux simples | a | b |,
 * citations >, séparateurs ---, retours à la ligne forcés (deux espaces ou \ en fin de ligne),
 * et le repère « [À COMPLÉTER …] », toujours en gras.
 */

export type MdAlign = 'left' | 'center' | 'right' | null;

/** internal : lien du routeur ; external : site web (nouvel onglet) ; app : téléphone, e-mail. */
export type MdLinkKind = 'internal' | 'external' | 'app';

export type MdInline =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: MdInline[] }
  | { type: 'em'; children: MdInline[] }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; kind: MdLinkKind; children: MdInline[] }
  | { type: 'placeholder'; value: string }
  | { type: 'break' };

export interface MdListItem {
  /** Texte de la première ligne (et de ses lignes de suite). */
  children: MdInline[];
  /** Blocs imbriqués (sous-liste, paragraphe suivant…). */
  blocks: MdBlock[];
}

export type MdBlock =
  | { type: 'heading'; level: 2 | 3 | 4; id: string | null; text: string; children: MdInline[] }
  | { type: 'paragraph'; children: MdInline[] }
  | { type: 'list'; ordered: boolean; start: number; items: MdListItem[] }
  | { type: 'table'; align: MdAlign[]; header: MdInline[][]; rows: MdInline[][][] }
  | { type: 'blockquote'; children: MdBlock[] }
  | { type: 'hr' };

export interface ParseOptions {
  /** Générateur d'identifiants d'ancre partagé (une page = un générateur). */
  slugger?: Slugger;
}

export type Slugger = (text: string) => string;

/** Garde-fous contre un texte démesuré ou une imbrication pathologique. */
const MAX_SOURCE_LENGTH = 100_000;
const MAX_BLOCK_DEPTH = 6;
const MAX_INLINE_DEPTH = 4;
/** Longueur maximale cherchée pour fermer un intitulé de lien, une adresse ou un code. */
const MAX_LABEL_LENGTH = 500;
const MAX_DESTINATION_LENGTH = 2100;
const MAX_CODE_LENGTH = 1000;

// ---------------------------------------------------------------------------
// Liens
// ---------------------------------------------------------------------------

const ALLOWED_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);
const SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):/i;
/**
 * Espaces et caractères de contrôle à l'intérieur d'une adresse : les navigateurs en retirent
 * certains (« java\tscript: » devient « javascript: »), l'adresse est donc refusée.
 */
// eslint-disable-next-line no-control-regex
const UNSAFE_URL_CHARS = /[\u0000-\u0020\u007f-\u009f\u00A0\u1680\u2000-\u200F\u2028-\u202F\u205F\u3000\uFEFF]/;

export interface SafeHref {
  href: string;
  kind: MdLinkKind;
}

/**
 * N'accepte que https:, http:, mailto:, tel: et les chemins internes commençant par « / ».
 * Tout le reste (javascript:, data:, vbscript:, adresses relatives, « //autre-site »…) renvoie
 * null : le lien devient du texte simple.
 */
export function sanitizeHref(raw: string): SafeHref | null {
  const value = raw.trim();
  if (!value || value.length > 2048) return null;
  if (UNSAFE_URL_CHARS.test(value)) return null;
  // « /\autre-site » est lu « //autre-site » par les navigateurs
  if (value.includes('\\')) return null;

  if (value.startsWith('/')) {
    if (value.startsWith('//')) return null;
    return { href: value, kind: 'internal' };
  }

  const scheme = SCHEME_PATTERN.exec(value)?.[1]?.toLowerCase();
  if (!scheme || !ALLOWED_SCHEMES.has(scheme)) return null;

  if (scheme === 'http' || scheme === 'https') {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) return null;
    return { href: url.href, kind: 'external' };
  }

  return { href: value, kind: 'app' };
}

// ---------------------------------------------------------------------------
// Ancres des titres
// ---------------------------------------------------------------------------

/** Identifiants déjà utilisés par la coquille de l'app (lien d'évitement, sections fixes). */
export const RESERVED_ANCHOR_IDS: readonly string[] = [
  'contenu',
  'sommaire',
  'page-titre',
  'page-introuvable-titre',
  'questions-frequentes',
  'questions-frequentes-titre',
  'aide-contact-titre',
  'hors-connexion-titre',
];

/** « Délai de 24 h ? » → « delai-de-24-h » : sans accents, minuscules, tirets. */
export function slugify(text: string): string {
  const slug = text
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
  return slug || 'section';
}

/** Identifiants stables et uniques dans la page : « tarifs », « tarifs-2 », « tarifs-3 »… */
export function createSlugger(reserved: Iterable<string> = RESERVED_ANCHOR_IDS): Slugger {
  const used = new Set(reserved);
  return (text: string) => {
    const base = slugify(text);
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(candidate);
    return candidate;
  };
}

// ---------------------------------------------------------------------------
// Texte en ligne
// ---------------------------------------------------------------------------

const ASCII_PUNCTUATION = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;
const PLACEHOLDER_PATTERN = /^\s*a completer\b/i;

type Token =
  | { t: 'text'; value: string }
  | { t: 'node'; node: MdInline }
  | { t: 'delim'; length: number; canOpen: boolean; canClose: boolean };

interface Delimiter {
  delim: true;
  length: number;
}

function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036F]/g, '');
}

function unescapePunctuation(text: string): string {
  return text.replace(/\\(.)/g, (match, char: string) => (ASCII_PUNCTUATION.test(char) ? char : match));
}

/** Fin d'un groupe équilibré (crochets ou parenthèses) ouvert en `start`, ou -1. */
function findClosing(src: string, start: number, open: string, close: string, maxLength: number): number {
  let level = 0;
  const end = Math.min(src.length, start + maxLength);
  for (let i = start; i < end; i += 1) {
    const char = src[i];
    if (char === '\\') {
      i += 1;
      continue;
    }
    if (char === open) level += 1;
    else if (char === close) {
      level -= 1;
      if (level === 0) return i;
    }
  }
  return -1;
}

/** Lien, lien refusé (texte seul) ou repère « [À COMPLÉTER …] » commençant en `start`. */
function parseBracket(
  src: string,
  start: number,
  depth: number,
  allowLinks: boolean,
): { nodes: MdInline[]; end: number } | null {
  const labelEnd = findClosing(src, start, '[', ']', MAX_LABEL_LENGTH);
  if (labelEnd === -1) return null;
  const label = src.slice(start + 1, labelEnd);

  if (allowLinks && src[labelEnd + 1] === '(') {
    const destEnd = findClosing(src, labelEnd + 1, '(', ')', MAX_DESTINATION_LENGTH);
    if (destEnd !== -1) {
      const children =
        depth < MAX_INLINE_DEPTH ? parseInlineTokens(label, depth + 1, false) : [textNode(label)];
      const safe = sanitizeHref(unescapePunctuation(src.slice(labelEnd + 2, destEnd)));
      // Adresse refusée : seul le texte du lien reste, l'adresse n'est jamais affichée
      const nodes: MdInline[] = safe ? [{ type: 'link', href: safe.href, kind: safe.kind, children }] : children;
      return { nodes, end: destEnd + 1 };
    }
  }

  if (PLACEHOLDER_PATTERN.test(stripAccents(label))) {
    return { nodes: [{ type: 'placeholder', value: `[${unescapePunctuation(label).trim()}]` }], end: labelEnd + 1 };
  }
  return null;
}

function textNode(value: string): MdInline {
  return { type: 'text', value };
}

function tokenize(src: string, depth: number, allowLinks: boolean): Token[] {
  const tokens: Token[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer) {
      tokens.push({ t: 'text', value: buffer });
      buffer = '';
    }
  };

  let i = 0;
  while (i < src.length) {
    const char = src[i];

    if (char === '\\' && i + 1 < src.length && ASCII_PUNCTUATION.test(src[i + 1])) {
      buffer += src[i + 1];
      i += 2;
      continue;
    }

    // Retour à la ligne forcé (marqué par le découpage des paragraphes)
    if (char === '\n') {
      flush();
      tokens.push({ t: 'node', node: { type: 'break' } });
      i += 1;
      continue;
    }

    if (char === '`') {
      let runEnd = i;
      while (src[runEnd] === '`') runEnd += 1;
      const fence = src.slice(i, runEnd);
      let search = runEnd;
      let closeAt = -1;
      while (search < src.length) {
        const found = src.indexOf(fence, search);
        if (found === -1 || found - runEnd > MAX_CODE_LENGTH) break;
        let after = found + fence.length;
        if (src[after] !== '`' && src[found - 1] !== '`') {
          closeAt = found;
          break;
        }
        while (src[after] === '`') after += 1;
        search = after;
      }
      if (closeAt === -1) {
        buffer += fence;
        i = runEnd;
        continue;
      }
      let code = src.slice(runEnd, closeAt).replace(/\n/g, ' ');
      if (code.length > 2 && code.startsWith(' ') && code.endsWith(' ')) code = code.slice(1, -1);
      flush();
      tokens.push({ t: 'node', node: { type: 'code', value: code } });
      i = closeAt + fence.length;
      continue;
    }

    if (char === '[') {
      const result = parseBracket(src, i, depth, allowLinks);
      if (result) {
        flush();
        for (const node of result.nodes) tokens.push({ t: 'node', node });
        i = result.end;
        continue;
      }
      buffer += char;
      i += 1;
      continue;
    }

    if (char === '*') {
      let runEnd = i;
      while (src[runEnd] === '*') runEnd += 1;
      const before = i > 0 ? src[i - 1] : '';
      const after = runEnd < src.length ? src[runEnd] : '';
      flush();
      tokens.push({
        t: 'delim',
        length: runEnd - i,
        canOpen: after !== '' && !/\s/.test(after),
        canClose: before !== '' && !/\s/.test(before),
      });
      i = runEnd;
      continue;
    }

    buffer += char;
    i += 1;
  }
  flush();
  return tokens;
}

/** Délimiteurs restants → texte ; textes voisins fusionnés. */
function finalize(items: Array<MdInline | Delimiter>): MdInline[] {
  const out: MdInline[] = [];
  for (const item of items) {
    const node: MdInline | null =
      'delim' in item ? (item.length > 0 ? textNode('*'.repeat(item.length)) : null) : item;
    if (!node) continue;
    const last = out[out.length - 1];
    if (node.type === 'text' && last?.type === 'text') {
      out[out.length - 1] = textNode(last.value + node.value);
    } else {
      out.push(node);
    }
  }
  return out;
}

/** Gras et italique : chaque fermeture s'associe à l'ouverture la plus proche. */
function resolveEmphasis(tokens: Token[]): MdInline[] {
  const items: Array<MdInline | Delimiter> = [];
  const openers: number[] = [];

  for (const token of tokens) {
    if (token.t === 'text') {
      items.push(textNode(token.value));
      continue;
    }
    if (token.t === 'node') {
      items.push(token.node);
      continue;
    }

    let remaining = token.length;
    if (token.canClose) {
      while (remaining > 0 && openers.length > 0) {
        const openerIndex = openers[openers.length - 1];
        const opener = items[openerIndex] as Delimiter;
        const used = remaining >= 2 && opener.length >= 2 ? 2 : 1;
        const children = finalize(items.splice(openerIndex + 1));
        opener.length -= used;
        remaining -= used;
        if (opener.length === 0) {
          items.splice(openerIndex, 1);
          openers.pop();
        }
        items.push(used === 2 ? { type: 'strong', children } : { type: 'em', children });
      }
    }
    if (remaining > 0) {
      items.push({ delim: true, length: remaining });
      if (token.canOpen) openers.push(items.length - 1);
    }
  }
  return finalize(items);
}

function applyTypography(nodes: MdInline[]): MdInline[] {
  return nodes.map((node) => {
    switch (node.type) {
      case 'text':
        return textNode(frenchSpacing(node.value));
      case 'placeholder':
        return { ...node, value: frenchSpacing(node.value) };
      case 'strong':
      case 'em':
      case 'link':
        return { ...node, children: applyTypography(node.children) };
      default:
        return node;
    }
  });
}

function parseInlineTokens(src: string, depth: number, allowLinks: boolean): MdInline[] {
  return resolveEmphasis(tokenize(src, depth, allowLinks));
}

/** Texte en ligne (titre, paragraphe, cellule) → nœuds. */
export function parseInline(src: string): MdInline[] {
  return applyTypography(parseInlineTokens(src, 0, true));
}

/** Texte brut d'une suite de nœuds (titres, sommaire, identifiants). */
export function inlineText(nodes: MdInline[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
        case 'code':
        case 'placeholder':
          return node.value;
        case 'break':
          return ' ';
        default:
          return inlineText(node.children);
      }
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Blocs
// ---------------------------------------------------------------------------

const HEADING_PATTERN = /^ {0,3}(#{1,6})[ \t]+(.*)$/;
const HR_PATTERN = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const UL_PATTERN = /^( *)([-*+])[ \t]+(.*)$/;
const OL_PATTERN = /^( *)(\d{1,9})[.)][ \t]+(.*)$/;
const QUOTE_PATTERN = /^ {0,3}>[ ]?(.*)$/;
const TABLE_SEPARATOR_PATTERN = /^[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)*\|?[ \t]*$/;

interface ListMarker {
  indent: number;
  ordered: boolean;
  number: number;
  content: string;
  /** Colonne où commence le texte de l'élément (indentation attendue des lignes de suite). */
  contentIndent: number;
}

function isBlank(line: string): boolean {
  return line.trim() === '';
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

function matchListItem(line: string): ListMarker | null {
  if (HR_PATTERN.test(line)) return null;
  const bullet = UL_PATTERN.exec(line);
  if (bullet) {
    const indent = bullet[1].length;
    return {
      indent,
      ordered: false,
      number: 1,
      content: bullet[3],
      contentIndent: line.length - bullet[3].length,
    };
  }
  const numbered = OL_PATTERN.exec(line);
  if (numbered) {
    return {
      indent: numbered[1].length,
      ordered: true,
      number: Number(numbered[2]),
      content: numbered[3],
      contentIndent: line.length - numbered[3].length,
    };
  }
  return null;
}

function splitTableRow(line: string): string[] {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  const cells: string[] = [];
  let current = '';
  for (let i = 0; i < row.length; i += 1) {
    const char = row[i];
    if (char === '\\' && row[i + 1] === '|') {
      current += '|';
      i += 1;
    } else if (char === '|') {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function isTableStart(lines: string[], index: number): boolean {
  const header = lines[index];
  const separator = lines[index + 1];
  if (separator === undefined || !header.includes('|') || !separator.includes('|')) return false;
  if (!TABLE_SEPARATOR_PATTERN.test(separator)) return false;
  return splitTableRow(header).length === splitTableRow(separator).length;
}

function startsBlock(lines: string[], index: number): boolean {
  const line = lines[index];
  return (
    HEADING_PATTERN.test(line) ||
    HR_PATTERN.test(line) ||
    QUOTE_PATTERN.test(line) ||
    matchListItem(line) !== null ||
    isTableStart(lines, index)
  );
}

/** Lignes d'un paragraphe → texte en ligne, retours forcés marqués par « \n ». */
function joinParagraphLines(lines: string[]): string {
  return lines
    .map((line, index) => {
      const trimmed = line.trimStart();
      if (index === lines.length - 1) return trimmed.trimEnd();
      if (/( {2,}|\\)$/.test(trimmed)) return `${trimmed.replace(/( {2,}|\\)$/, '')}\n`;
      return `${trimmed.trimEnd()} `;
    })
    .join('');
}

interface BlockContext {
  slugger: Slugger;
}

function parseHeading(match: RegExpExecArray, ctx: BlockContext): MdBlock {
  const hashes = match[1].length;
  // HYPOTHÈSE: le titre de la page est le seul h1 ; « # » dans le texte devient un h2,
  // « #### » et au-delà des h4 (sans ancre ni entrée de sommaire).
  const level: 2 | 3 | 4 = hashes <= 2 ? 2 : hashes === 3 ? 3 : 4;
  const raw = match[2].replace(/[ \t]+#+[ \t]*$/, '').replace(/^#+[ \t]*$/, '').trim();
  const children = parseInline(raw);
  const text = inlineText(children).trim();
  return { type: 'heading', level, id: level <= 3 ? ctx.slugger(text) : null, text, children };
}

function parseTable(lines: string[], start: number): { block: MdBlock; next: number } {
  const header = splitTableRow(lines[start]);
  const align: MdAlign[] = splitTableRow(lines[start + 1]).map((cell) => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    if (left) return 'left';
    return null;
  });
  const rows: MdInline[][][] = [];
  let i = start + 2;
  while (i < lines.length && !isBlank(lines[i]) && lines[i].includes('|')) {
    const cells = splitTableRow(lines[i]);
    rows.push(header.map((_, column) => parseInline(cells[column] ?? '')));
    i += 1;
  }
  return {
    block: { type: 'table', align, header: header.map((cell) => parseInline(cell)), rows },
    next: i,
  };
}

function parseList(
  lines: string[],
  start: number,
  ctx: BlockContext,
  depth: number,
): { block: MdBlock; next: number } {
  const first = matchListItem(lines[start]) as ListMarker;
  const baseIndent = first.indent;
  const items: MdListItem[] = [];
  let i = start;

  while (i < lines.length) {
    if (isBlank(lines[i])) {
      // Liste aérée : elle continue si l'élément suivant est de même type et de même niveau
      let next = i + 1;
      while (next < lines.length && isBlank(lines[next])) next += 1;
      const sibling = next < lines.length ? matchListItem(lines[next]) : null;
      if (sibling && sibling.ordered === first.ordered && sibling.indent <= baseIndent + 1) {
        i = next;
        continue;
      }
      break;
    }

    const marker = matchListItem(lines[i]);
    if (!marker || marker.ordered !== first.ordered || marker.indent > baseIndent + 1) break;

    const itemLines = [marker.content];
    i += 1;
    while (i < lines.length) {
      const line = lines[i];
      if (isBlank(line)) {
        let next = i + 1;
        while (next < lines.length && isBlank(lines[next])) next += 1;
        if (next < lines.length && indentOf(lines[next]) > baseIndent + 1 && !matchSibling(lines[next], baseIndent)) {
          itemLines.push('');
          i = next;
          continue;
        }
        break;
      }
      if (matchSibling(line, baseIndent)) break;
      const indent = indentOf(line);
      if (indent > baseIndent + 1) {
        itemLines.push(line.slice(Math.min(indent, marker.contentIndent)));
        i += 1;
        continue;
      }
      // Ligne de suite non indentée du texte de l'élément
      if (!startsBlock(lines, i)) {
        itemLines.push(line);
        i += 1;
        continue;
      }
      break;
    }
    items.push(buildListItem(itemLines, ctx, depth));
  }

  return { block: { type: 'list', ordered: first.ordered, start: first.number, items }, next: i };
}

function matchSibling(line: string, baseIndent: number): boolean {
  const marker = matchListItem(line);
  return marker !== null && marker.indent <= baseIndent + 1;
}

function buildListItem(itemLines: string[], ctx: BlockContext, depth: number): MdListItem {
  if (depth >= MAX_BLOCK_DEPTH) {
    return { children: parseInline(joinParagraphLines(itemLines.filter((line) => !isBlank(line)))), blocks: [] };
  }
  const blocks = parseBlocks(itemLines, ctx, depth + 1);
  const [head, ...rest] = blocks;
  if (head?.type === 'paragraph') return { children: head.children, blocks: rest };
  return { children: [], blocks };
}

function parseBlocks(lines: string[], ctx: BlockContext, depth: number): MdBlock[] {
  const blocks: MdBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i += 1;
      continue;
    }

    const heading = HEADING_PATTERN.exec(line);
    if (heading) {
      blocks.push(parseHeading(heading, ctx));
      i += 1;
      continue;
    }

    if (HR_PATTERN.test(line)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    if (QUOTE_PATTERN.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && QUOTE_PATTERN.test(lines[i])) {
        inner.push((QUOTE_PATTERN.exec(lines[i]) as RegExpExecArray)[1]);
        i += 1;
      }
      blocks.push(
        depth >= MAX_BLOCK_DEPTH
          ? { type: 'paragraph', children: parseInline(joinParagraphLines(inner.filter((l) => !isBlank(l)))) }
          : { type: 'blockquote', children: parseBlocks(inner, ctx, depth + 1) },
      );
      continue;
    }

    if (isTableStart(lines, i)) {
      const { block, next } = parseTable(lines, i);
      blocks.push(block);
      i = next;
      continue;
    }

    if (matchListItem(line) && indentOf(line) <= 3) {
      const { block, next } = parseList(lines, i, ctx, depth);
      blocks.push(block);
      i = next;
      continue;
    }

    const paragraph: string[] = [line];
    i += 1;
    while (i < lines.length && !isBlank(lines[i]) && !startsBlock(lines, i)) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: 'paragraph', children: parseInline(joinParagraphLines(paragraph)) });
  }

  return blocks;
}

/** Markdown → blocs. Les titres h2 et h3 reçoivent un identifiant d'ancre unique. */
export function parseMarkdown(source: string, options: ParseOptions = {}): MdBlock[] {
  const text = String(source ?? '')
    .slice(0, MAX_SOURCE_LENGTH)
    .replace(/\r\n?/g, '\n')
    .replaceAll('\u0000', '\uFFFD')
    .replace(/\t/g, '    ');
  return parseBlocks(text.split('\n'), { slugger: options.slugger ?? createSlugger() }, 0);
}

// ---------------------------------------------------------------------------
// Sommaire
// ---------------------------------------------------------------------------

export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

/** Sommaire : titres h2 de premier niveau (h3 s'il n'y a aucun h2). */
export function extractToc(blocks: MdBlock[]): TocEntry[] {
  const headings = blocks.filter(
    (block): block is Extract<MdBlock, { type: 'heading' }> & { id: string } =>
      block.type === 'heading' && block.id !== null && block.level <= 3,
  );
  const level: 2 | 3 = headings.some((heading) => heading.level === 2) ? 2 : 3;
  return headings
    .filter((heading) => heading.level === level)
    .map((heading) => ({ id: heading.id, text: heading.text, level }));
}
