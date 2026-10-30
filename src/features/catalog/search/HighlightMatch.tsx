function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export interface HighlightMatchProps {
  text: string;
  query: string;
  highlightClassName?: string;
}

/**
 * Surligne en gras la sous-chaîne correspondant à la requête saisie,
 * même lorsque les accents ou la casse diffèrent (§6.1).
 */
export function HighlightMatch({
  text,
  query,
  highlightClassName = 'font-extrabold underline decoration-red decoration-2 underline-offset-2',
}: HighlightMatchProps) {
  const cleanedQuery = query.trim();
  if (cleanedQuery.length < 2) {
    return <>{text}</>;
  }

  const normText = normalizeSearchText(text);
  const normQuery = normalizeSearchText(cleanedQuery);
  const matchIdx = normText.indexOf(normQuery);

  if (matchIdx === -1 || text.length !== normText.length) {
    return <>{text}</>;
  }

  const before = text.slice(0, matchIdx);
  const match = text.slice(matchIdx, matchIdx + normQuery.length);
  const after = text.slice(matchIdx + normQuery.length);

  return (
    <>
      {before}
      <strong className={highlightClassName}>{match}</strong>
      {after}
    </>
  );
}
