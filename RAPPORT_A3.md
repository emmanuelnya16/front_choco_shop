# Rapport de Livraison — Module A3 : Catalogue, Stocks, Variantes, Catégories et Looks

**Projet** : PWA DR Choco L’Incompris  
**Module** : A3 (`/admin/catalogue`, `/admin/catalogue/nouveau`, `/admin/catalogue/:id`, `/admin/categories`, `/admin/looks`)  
**Statut** : Livré et vérifié

---

## 1. Périmètre livré

1. **Catalogue & Ajustement rapide des stocks (`/admin/catalogue`)**
   - Page [`AdminCatalogPage`](file:///e:/projet_choco/dr-choco-lincompris/src/pages/admin/AdminCatalogPage.tsx) :
     - **Onglets d’état de stock** : *Tous les articles*, *En stock*, *Stock faible (≤ 3)*, *Rupture / variante épuisée*.
     - **Recherche & filtres** : par nom ou slug, par catégorie (`Vêtements`, `Chaussures`, `Babouches`), et tri (*Plus récents*, *Stock le plus bas*, *Ordre alphabétique*, *Prix croissant / décroissant*).
     - **Affichage enrichi** : miniature 4:5, prix en FCFA (`tabular-nums`), badges calculés dynamiquement (`NOUVEAU`, `DERNIÈRES PIÈCES`, `ÉPUISÉ`), pastilles de couleurs et aperçu du stock par taille.
   - Composant [`QuickStockSheet`](file:///e:/projet_choco/dr-choco-lincompris/src/features/admin/catalog/QuickStockSheet.tsx) (`SP-111`) :
     - Ouverture en 1 appui depuis n’importe quelle ligne du catalogue sans quitter la liste.
     - Compteurs `- / +` (cibles tactiles `44×44 px`) et saisie directe par variante (`couleur × taille`), action rapide « Tout mettre à 0 (épuisé) » et recalcul automatique des badges produit (`low-stock`, `sold-out`).

2. **Éditeur complet de produit (`/admin/catalogue/nouveau` et `/admin/catalogue/:id`)**
   - Page [`AdminProductEditPage`](file:///e:/projet_choco/dr-choco-lincompris/src/pages/admin/AdminProductEditPage.tsx) structurée en **5 sections** :
     1. **Informations générales** : nom avec génération automatique du `slug` URL, sélection de catégorie et sous-catégorie dépendante (`SP-002`), prix en FCFA avec aperçu formaté `<Price />`, case « Badge NOUVEAU », description éditoriale, composition et conseils d’entretien.
     2. **Couleurs (`colors`)** : préréglages signature DR Choco (*Noir Charbon*, *Blanc Craie*, *Rouge Incompris*, *Gris Béton*, *Terre de Sienne*, *Olive Militaire*) et ajout de couleur personnalisée (`code`, `name`, `hex`).
     3. **Galerie photos & rattachement par couleur (`mediaGallery`, `SP-003`)** : ajout par URL, visuels studio rapides ou import depuis le téléphone avec compression client (`prepareProof`), sélecteur `colorCode` sur chaque photo, réordonnancement (la 1ʳᵉ photo définit la couverture) et **alerte douce** si une couleur déclarée n’a aucune photo rattachée.
     4. **Tailles & Grille de variantes (`sizes` & `variants`)** : préréglages rapides par rayon (*Vêtements S à XXL*, *Chaussures & Babouches 39 à 45*, *Taille unique*), ajout de taille personnalisée et **tableau croisé Couleurs × Tailles** avec actions rapides par ligne (« Tout à 5 », « Tout à 0 »).
     5. **Guide des tailles (`sizeGuide`, `SP-004`)** : sélection de gabarit (`clothing`, `footwear`, `one-size`) et personnalisation du titre et du conseil coupe/morphologie.

3. **Catégories, Sous-catégories et Looks « Portés par L’Incompris » (`/admin/categories` et `/admin/looks`)**
   - Page [`AdminCategoriesLooksPage`](file:///e:/projet_choco/dr-choco-lincompris/src/pages/admin/AdminCategoriesLooksPage.tsx) :
     - **Onglet Catégories & Sous-catégories (`SP-002`)** : édition des 3 catégories principales (`Vêtements`, `Chaussures`, `Babouches`), de leur description, image de couverture et gestion complète de leurs sous-catégories (ajout / suppression).
     - **Onglet Looks « Portés par L’Incompris » (`SP-005`)** : création, modification et suppression de looks 4:5 avec sélecteur multi-produits visuel (`productSlugs`). Si aucun look n’est publié (`looks.length === 0`), l’interface indique que la section « Portés par L’Incompris » se masque automatiquement sur la page d’accueil client (`LooksSection.tsx`).

---

## 2. Contrat API Symfony consolidé pour A3

| Méthode & Endpoint | Rôle | Corps / Paramètres | Réponse |
|---|---|---|---|
| `GET /api/admin/products` | Liste paginée et filtrable du catalogue + compteurs de stock | `q`, `category`, `stockStatus`, `sort`, `page`, `pageSize` | `AdminProductsListResponse` (`items`, `summary`, pagination) |
| `GET /api/admin/products/:id` | Détail complet d’un produit (par `id` ou `slug`) | `:id` | `{ product: Product }` |
| `POST /api/admin/products` | Créer un nouveau produit avec variantes et galerie | `AdminUpsertProductPayload` | `201 { product: Product }` |
| `PATCH /api/admin/products/:id` | Modifier un produit existant | `Partial<AdminUpsertProductPayload>` | `200 { product: Product }` |
| `PATCH /api/admin/products/:id/stock` | Ajustement rapide des stocks par variante (`SP-111`) | `{ variants: Array<{ variantId, stock }> }` | `200 { product: Product }` |
| `DELETE /api/admin/products/:id` | Supprimer un produit du catalogue | `:id` | `204 No Content` |
| `GET /api/admin/categories` | Liste des catégories et sous-catégories avec compteurs | — | `{ categories: Category[] }` |
| `PATCH /api/admin/categories/:id` | Mettre à jour une catégorie et ses sous-catégories | `Partial<AdminUpdateCategoryPayload>` | `200 { category, categories }` |
| `GET /api/admin/looks` | Liste des looks « Portés par L’Incompris » | — | `{ looks: LookbookItem[] }` |
| `POST /api/admin/looks` | Publier un nouveau look | `AdminUpsertLookPayload` | `201 { look, looks }` |
| `PATCH /api/admin/looks/:id` | Modifier un look existant | `Partial<AdminUpsertLookPayload>` | `200 { look, looks }` |
| `DELETE /api/admin/looks/:id` | Supprimer un look | `:id` | `204 No Content` |

