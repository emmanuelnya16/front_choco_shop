/**
 * Pages de contenu (M7 §3) : pages légales et pages d'aide, modifiables plus tard depuis
 * l'administration. Le corps est du Markdown, converti en éléments React par le rendu maison.
 */

/** Réponse de `GET /pages/:slug`. */
export interface ContentPageResponse {
  slug: string;
  title: string;
  /** Date ISO 8601 de la dernière modification. */
  updatedAt: string;
  /** Corps en Markdown (titres, listes, liens, tableaux simples…). */
  body: string;
}

/** Rubrique d'affichage : chemin, flèche retour et bloc « Vous n’avez pas trouvé ? ». */
export type ContentKind = 'legal' | 'help';
