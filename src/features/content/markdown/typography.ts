const NBSP = '\u00A0';

/**
 * Typographie française (règles du projet) : espace insécable avant « : ; ? ! » et à l'intérieur
 * des guillemets « », entre les groupes de chiffres et avant les unités (« 45 000 FCFA », « 24 h »).
 * Ne remplace que des espaces ordinaires : appliquer deux fois ne change rien.
 * Sûr sur du Markdown brut : « | :--- | » (alignement de tableau) et les adresses ne sont pas
 * touchés, la ponctuation devant être suivie d'un espace, d'une fin de ligne ou d'un signe de fin.
 */
export function frenchSpacing(text: string): string {
  return text
    .replace(/[ ]+([:;?!])(?=[\s*_)\]»"]|$)/g, `${NBSP}$1`)
    .replace(/[ ]+»/g, `${NBSP}»`)
    .replace(/«[ ]+/g, `«${NBSP}`)
    .replace(/(\d)[ ](?=\d{3}(?!\d))/g, `$1${NBSP}`)
    .replace(/(\d)[ ](FCFA|h\b|min\b|%|Mo\b)/g, `$1${NBSP}$2`);
}
