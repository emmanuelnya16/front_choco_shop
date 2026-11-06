/**
 * Libellé du bouton qui mène aux résultats d'une recherche, accordé au nombre :
 * « Voir le résultat pour « forge » », « Voir les 6 résultats pour « babouche » ».
 * Espaces insécables à l'intérieur des guillemets.
 */
export function seeResultsLabel(count: number, query: string): string {
  const quoted = `«\u00a0${query}\u00a0»`;
  return count > 1 ? `Voir les ${count} résultats pour ${quoted}` : `Voir le résultat pour ${quoted}`;
}
