# Rapport de Recette — Module M2 « Catalogue et Fiche Produit »
**Projet :** DR Choco L’Incompris — Boutique & Réservation en ligne (Cameroun)  
**Date :** 30 octobre 2026  
**Périmètre :** Module M2 (Synchronisation des filtres dans l’URL, Mocks MSW enrichis avec facettes et recherche sans accent, Page Explorer & Catégories, Recherche instantanée plein écran mobile & panneau ordinateur, Fiche produit complète avec galerie/lightbox/guide des tailles/barre collante/vol vers le panier, Transitions de vues natives, Page Favoris avec annulation, Tests automatisés M2)

---

## 1. Ce qui est livré (Rendus de `360 px` à `1440 px`)

### 1.1 Page Explorer & Catégories (`/explorer`, `/explorer/vetements`, `/explorer/chaussures`, `/explorer/babouches`, `/categorie/:category`)
- **En-tête éditorial adaptatif (§5.1)** :
  - **Sur `/explorer` (Catalogue complet)** : fil d’Ariane `Accueil › Explorer`, titre `TOUS LES ARTICLES`, sous-titre explicatif et **compteur animé** (`AnimatedCounter` interpolant l’ancien et le nouveau total en `0,35 s`).
  - **Sur `/explorer/:category` (ex. `/explorer/babouches`)** : bandeau d’ambiance sombre (`180 px` sur mobile, `240 px` sur ordinateur) avec `SmartImage tone="mood"`, voile dégradé `--color-scrim-85 → --color-scrim-40`, fil d’Ariane blanc `Accueil › Explorer › Babouches`, titre `text-h1` en blanc, sous-titre de la catégorie et pastille du nombre d’articles.
  - **Sur `/explorer?look=:id`** : bandeau sombre dédié au look sélectionné (« Porté par L’Incompris ») avec miniature `4:5`, titre, sous-titre et bouton « Voir tout le catalogue » qui retire `look` de l’URL.
  - **Sur `/explorer?q=:query`** : en-tête `RÉSULTATS POUR « … »` avec bouton « Effacer la recherche ».
- **Barre d’outils collante sur mobile (`< lg`, §5.2)** :
  - Rangée 1 (`48 px`) : puces `Chip` défilables horizontalement (`Tout` + sous-catégories de la catégorie active ou des 3 univers).
  - Rangée 2 (`52 px`) : 3 boutons ouvrant les feuilles basses (`Sheet`) : **Filtrer** (avec pastille rouge `activeCount` animée), **Taille / Pointure**, et **Trier : [libellé actif]**.
  - Rangée 3 conditionnelle (`40 px`) : puces des filtres actifs avec retrait individuel (`×`) et lien « Tout effacer ».
- **Colonne latérale de filtres sur ordinateur (`lg:`, `260 px` sticky, §5.3)** :
  - 5 sections dépliables (`AnimatePresence`, `0,22 s`) : **Catégories** (avec compteurs issus de `facets.categories`), **Sous-catégories**, **Taille / Pointure** (grille 4 colonnes avec compteurs `facets.sizes`, tailles à `0` grisées et barrées en diagonale), **Budget (FCFA)** (boutons radio `Tous les prix` + 4 tranches avec compteurs `facets.prices`), et **Disponibilité** (interrupteur `role="switch"` « En stock uniquement »).
  - Barre supérieure de grille : compteur d’articles, puces des filtres actifs + « Tout effacer », et sélecteur de tri.
- **Grille de produits, chargement infini et états (§5.4)** :
  - Grille responsive : **2 colonnes** dès `360 px` (`gap-3`), **3 colonnes** sur tablette (`md:grid-cols-3 gap-5`), **3 colonnes** à droite de la barre latérale sur ordinateur (`lg:grid-cols-3 gap-6`).
  - **Conservation des données précédentes (`placeholderData: keepPreviousData`)** : lors d’un changement de filtre ou de tri, la grille existante reste affichée à `opacity-60` pendant la requête, évitant tout saut de mise en page (`CLS = 0`).
  - **Chargement par lots de 12 (`useInfiniteQuery`)** : déclenchement automatique via `IntersectionObserver` (`rootMargin: '400px'`) + bouton explicite « Afficher plus d’articles (X restants) » avec indicateur « Vous avez vu X articles sur Y ».
  - **État « Aucun article ne correspond »** : illustration vectorielle du cintre L’Incompris avec trait d’accent rouge (`stroke-red`), texte d’aide et double action (« Réinitialiser les filtres » / « Voir tout le catalogue »).

### 1.2 Recherche instantanée (`/recherche` sur mobile & `DesktopSearchDropdown` sur ordinateur, §6)
- **Sur mobile (`/recherche`)** :
  - Ouverture plein écran avec animation circulaire `clipPath: circle(...)` depuis la position exacte de la loupe (`uiStore.searchOrigin`) en `0,32 s` (bascule en fondu simple si `prefers-reduced-motion: reduce`).
  - Champ de recherche auto-focusé (`font-size: 16px` garantissant zéro zoom involontaire sur iOS Safari), bouton d’effacement rapide et bouton « Annuler ».
  - **Avant 2 caractères** : **Recherches récentes** persistées dans `safeStorage` (`drc_recent_searches_v1`, max 6 entrées dédupliquées) avec suppression unitaire ou globale, **Recherches populaires** (6 `Chip`s cliquables) et **Parcourir par univers** (3 tuiles horizontales `72 px`).
  - **Dès 2 caractères (`useSearchSuggest`, debounce `250 ms`)** : catégories correspondantes + jusqu’à 6 articles avec miniature `56 × 70 px`, nom avec **terme surligné en gras** (`<HighlightMatch />` insensible aux accents et à la casse), prix FCFA et badge de stock, suivis du bouton « Voir les X résultats pour « … » → ».
- **Sur ordinateur (`DesktopSearchDropdown` dans `AppHeader`)** :
  - Panneau déroulant de `440 px` sous le champ de recherche de l’en-tête (`role="combobox"`), navigation complète au clavier (`ArrowDown`, `ArrowUp`, `Enter`, `Escape`) et fermeture au clic extérieur.

### 1.3 Fiche produit complète (`/produit/:slug`, §7)
- **Navigation mobile dédiée (§7.1)** : barre flottante en haut (`h-14`) avec bouton retour, titre centré qui apparaît au défilement (`> 260 px`), et boutons Favori + Partager (`navigator.share` natif avec repli copie du lien + toast « Lien copié dans le presse-papiers »).
- **Galerie photos (`ProductGallery`, §7.2)** :
  - **Mobile** : carrousel `4:5` plein cadre (`scroll-snap-type: x mandatory`), compteur `1 / N` en haut à droite, indicateurs de pagination animés en bas, ouverture de la visionneuse plein écran au toucher.
  - **Ordinateur** : colonne de miniatures verticales (`76 × 95 px`) + grande image principale `4:5` avec loupe au survol (`scale(1.8)` suivant le curseur sur `pointer: fine`).
  - **Changement de couleur** : retour automatique à la première vue avec fondu enchaîné `0,22 s`.
  - **Transition de vue partagée (`viewTransitionName: product-${slug}`)** : continuité fluide entre la miniature touchée dans le catalogue et la grande photo de la fiche produit.
- **Visionneuse plein écran (`ProductLightbox`, §7.2)** :
  - Fond `--color-ink`, fermeture par bouton `×` (`44 × 44 px`), touche `Escape` ou glissement vertical (`> 100 px`), navigation Précédent / Suivant + flèches clavier, et zoom `1× ↔ 2×` au double-clic / double-tap avec déplacement panoramique.
- **Colonne d’informations et de réservation (§7.3)** :
  - Badges statutaires (`Nouveau`, `Plus que X`, `Épuisé`), titre `text-h1`, référence `SKU`, prix FCFA en `font-extrabold tabular-nums` + mention « Réservation gratuite · Paiement Mobile Money après confirmation ».
  - **Sélecteur de couleur (`role="radiogroup"`)** : pastilles `36 px` dans une cible tactile de `44 × 44 px`, anneau actif `ring-2 ring-ink ring-offset-2`, hachure diagonale si toute la couleur est épuisée. Si la taille précédemment sélectionnée est épuisée dans la nouvelle couleur, elle est automatiquement désélectionnée avec l’avertissement : *« La taille [X] est épuisée dans cette couleur — veuillez choisir une autre taille. »*
  - **Sélecteur de taille / pointure (`role="radiogroup"`)** : boutons `min-w-[52px] h-12`, état sélectionné `bg-ink text-white`, état épuisé grisé/barré (`disabled`), cas **Taille unique (`Unique`)** automatiquement pré-sélectionné.
  - **Indicateur de stock honnête en temps réel** :
    - `stock === 1` ou `2` : point ambre + *« Plus que X exemplaire(s) en taille [T] — réservez avant rupture »*.
    - `stock >= 3` : point vert + *« En stock — bloqué 24 h dès votre réservation »*.
  - **Validation sans taille choisie** : secousse horizontale (`x: [0, -6, 6, -4, 4, 0]`), message `role="alert"` *« Choisissez votre taille pour continuer »*, défilement fluide vers le sélecteur et vibration `haptic('error')`.
  - **Animation de vol vers le panier (`FlyToCartLayer`, §7.5)** : miniature `48 × 60 px` décrivant une trajectoire courbe vers l’icône du panier en `0,55 s`, suivie du rebond `scale: [1, 1.25, 1]` du badge panier dans `AppHeader` et `BottomNav`.
  - **Question WhatsApp pré-remplie** : lien direct incluant le nom de l’article, la couleur, la taille choisie et l’URL de la fiche.
  - **3 accordéons d’informations** : *Description et coupe* (ouverte par défaut), *Matières et entretien* (`composition` + `careInstructions`), *Livraison, retrait et réservation 24 h* (adresse et horaires dynamiques depuis `/settings/public`).
- **Feuille modale Guide des tailles (`SizeGuideSheet`, §7.6)** : tableau de mesures en centimètres (`S–XXL` ou pointures `39–45` avec conseil cou-de-pied pour les babouches artisanales) et encadré « Comment prendre vos mesures ».
- **Barre d’action collante mobile (`StickyMobileProductBar`, §7.4)** : apparaît au-dessus de `BottomNav` (`bottom: calc(var(--bottom-nav-h) + env(safe-area-inset-bottom))`) dès que le bloc principal d’achat sort de l’écran, avec rappel de la taille choisie (ou bouton « Choisir la taille ↑ »), bouton « Ajouter » et bouton « Réserver ».
- **SEO & Métadonnées (`ProductSeo`, §7.8)** : mise à jour dynamique de `document.title`, des balises OpenGraph (`og:title`, `og:description`, `og:image`, `og:url`) et injection d’un bloc `<script type="application/ld+json">` de type `Schema.org/Product` (`offers.priceCurrency: "XAF"`, disponibilité réelle `InStock` / `OutOfStock`).

### 1.4 Page Favoris (`/favoris`, §8) et liaison Profil (`/profil`)
- Grille 2 colonnes mobile / 4 colonnes ordinateur restituant les articles de `favoritesStore` via `useFavoriteProducts`.
- **Retrait animé avec annulation** : clic sur le cœur → sortie fluide + réorganisation `layout` des cartes restantes + `Toast` de 4 secondes « Retiré des favoris » doté d’un bouton **« Annuler »** qui restaure immédiatement l’article.
- Liens rapides vers `/favoris` et `/explorer` intégrés dans `/profil` en attendant le Module M4.

---

## 2. Poids des morceaux JavaScript (Build de production gzip, §10.2)

Mesures obtenues via `npm run analyze` (`NODE_ENV=production ANALYZE=true vite build`) :

| Morceau (Chunk) | Chargement | Taille brute | Taille Gzip | Budget cible |
| --- | --- | --- | --- | --- |
| `assets/index-GBJqOc4v.js` (Socle initial + Coquille M1/M2) | Initial | `289,32 kB` | **`89,41 kB`** | **< 180 kB gzip ✅** |
| `assets/ExplorePage-DxnLUEFI.js` (`/explorer` + filtres + barre latérale) | À la demande (lazy) | `37,82 kB` | **`11,37 kB`** | Chargé uniquement sur `/explorer` ✅ |
| `assets/ProductPage-C60PSUx7.js` (`/produit/:slug` + galerie + lightbox + guide) | À la demande (lazy) | `37,40 kB` | **`11,01 kB`** | Chargé uniquement sur `/produit/:slug` ✅ |
| `assets/SearchPage-BafRbmRV.js` (`/recherche` mobile plein écran) | À la demande (lazy) | `10,59 kB` | **`3,50 kB`** | Chargé uniquement sur `/recherche` ✅ |
| `assets/FavoritesPage-CYDOy7cU.js` (`/favoris` avec retrait/annulation) | À la demande (lazy) | `3,30 kB` | **`1,59 kB`** | Chargé uniquement sur `/favoris` ✅ |
| `assets/HomePage-C14V0OpO.js` (`/` vitrine 11 sections) | À la demande (lazy) | `27,97 kB` | **`7,95 kB`** | Chargé uniquement sur `/` ✅ |
| `assets/gsap-tLDLf56L.js` (`gsap` + `ScrollTrigger` + `SplitText`) | À la demande (lazy) | `132,53 kB` | **`52,16 kB`** | Isolé du chargement initial ✅ |
| `assets/index-T71TrHzW.css` (Tailwind v4 + jetons + transitions de vues) | Initial | `62,07 kB` | **`11,57 kB`** | Léger & sans doublon ✅ |

- **Respect strict du budget initial** : le morceau d’entrée `index.js` s’établit à **`89,41 kB gzip`** (et **`119,07 kB gzip`** en comptant les petits morceaux partagés de stores Zustand), soit plus de **60 kB sous le plafond de `180 kB gzip`**. Le worker MSW (`browser-Cd1PeS4p.js`) reste 100 % isolé en chargement dynamique conditionnel (`if (env.apiMock) await import('@/mocks/browser')`).

---

## 3. Paramètres d’URL gérés sur `/explorer` (§2.1 & §10.2)

Tous les filtres sont lus et écrits dans l’URL via `useCatalogFilters` avec `{ replace: true }` (zéro pollution de l’historique du bouton Retour) :

| Paramètre | Emplacement | Valeurs acceptées | Rôle métier |
| --- | --- | --- | --- |
| `:category` | Segment (`/explorer/:category`) ou `?category=` | `vetements` · `chaussures` · `babouches` | Filtre sur l’un des 3 univers racines. |
| `sub` | Query string (`?sub=`) | `t-shirts` · `hoodies` · `pantalons` · `sneakers` · `derbies-boots` · `cuir-lisse` · `croco-embosse` | Filtre sur une sous-catégorie (automatiquement effacé lorsqu’on change de catégorie). |
| `size` | Query string répétable (`?size=L&size=XL`) | `S`, `M`, `L`, `XL`, `XXL`, `39` à `45`, `Unique` | Sélection multiple de tailles ou pointures (vérifie `stock > 0` dans la taille demandée). |
| `price` | Query string (`?price=`) | `0-15000` · `15000-30000` · `30000-50000` · `50000-plus` | Filtre par tranche de prix en FCFA. |
| `available` | Query string (`?available=1`) | `1` (absent sinon) | Masque les articles entièrement épuisés (`totalStock === 0`). |
| `sort` | Query string (`?sort=`) | `popular` (défaut, omis de l’URL) · `newest` · `price-asc` · `price-desc` | Ordre de tri de la grille (conservé lors d’un `reset()` des filtres). |
| `look` | Query string (`?look=`) | `look-1` · `look-2` · `look-3` · `look-4` | Restreint l’affichage aux pièces composant un look de la page d’accueil. |
| `q` | Query string (`?q=`) | Chaîne libre (ex. `babouche cuir`) | Filtre textuel insensible aux accents et à la casse. |

**Exemple d’URL complète partageable sur WhatsApp :**
```text
https://drchoco.cm/explorer/vetements?sub=t-shirts&size=L&size=XL&price=15000-30000&available=1&sort=price-asc
```

---

## 4. Liste des 24 produits du catalogue démo (`src/mocks/fixtures/products.ts`, §10.2)

| # | ID | Slug | Nom de l’article | Catégorie / Sous-catégorie | Prix (FCFA) | État de stock & particularités |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `prod-01` | `hoodie-barbele-noir` | Hoodie Barbelé Noir | `vetements` / `hoodies` | `32 000 FCFA` | **En stock** (`Nouveau`) — couleur *Gris Béton* entièrement épuisée (`stock = 0`) pour tester la pastille barrée. |
| 2 | `prod-02` | `tshirt-lincompris-oversize` | T-shirt L’Incompris Oversize | `vetements` / `t-shirts` | `18 000 FCFA` | **En stock** (`Nouveau`) — 4 couleurs (*Noir*, *Blanc*, *Rouge*, *Gris*) avec tailles partiellement épuisées (`S` épuisée en *Rouge*). |
| 3 | `prod-03` | `babouche-royale-akwa-cuir` | Babouche Royale Akwa Cuir | `babouches` / `cuir-lisse` | `28 000 FCFA` | **En stock** (`Nouveau`) — pointures `40` à `45` en cuir de veau pleine fleur. |
| 4 | `prod-04` | `cargo-tactique-bastos` | Pantalon Cargo Tactique Bastos | `vetements` / `pantalons` | `29 000 FCFA` | **En stock** — tailles `S` à `XXL`, coloris *Noir Charbon* et *Kaki Militaire*. |
| 5 | `prod-05` | `sneaker-monolithe-01` | Sneaker Monolithe 01 | `chaussures` / `sneakers` | `48 000 FCFA` | **En stock** (`Nouveau`) — pointures `40` à `45`, semelle sculptée `4,5 cm`. |
| 6 | `prod-06` | `babouche-croco-imperiale` | Babouche Croco Impériale | `babouches` / `croco-embosse` | `35 000 FCFA` | **Stock faible** (`totalStock = 3` → badge « Plus que 3 ») — cuir embossé crocodile. |
| 7 | `prod-07` | `tshirt-signature-dos-barbele` | T-shirt Signature Dos Barbelé | `vetements` / `t-shirts` | `16 500 FCFA` | **En stock** — sérigraphie dorsale haute densité. |
| 8 | `prod-08` | `derby-cuir-bonapriso` | Derby Cuir Ciselé Bonapriso | `chaussures` / `derbies-boots` | `55 000 FCFA` | **En stock** — cousu Blake, cuir glacé *Noir* et *Brun Cognac*. |
| 9 | `prod-09` | `hoodie-sans-manches-forge` | Hoodie Sans Manches Forge | `vetements` / `hoodies` | `24 000 FCFA` | **Épuisé (`totalStock = 0`)** — badge « Épuisé », boutons d’achat remplacés par « Cet article est épuisé ». |
| 10 | `prod-10` | `babouche-sultan-brodee` | Babouche Sultan Brodée Fil Rouge | `babouches` / `cuir-lisse` | `30 000 FCFA` | **En stock** (`Nouveau`) — broderie fil rouge testant la recherche sans accent (`brodee`). |
| 11 | `prod-11` | `jogger-molleton-lourd-akwa` | Jogger Molleton Lourd Akwa | `vetements` / `pantalons` | `25 000 FCFA` | **En stock** — molleton `430 g/m²` coordonné aux hoodies. |
| 12 | `prod-12` | `sneaker-basse-asphalte` | Sneaker Basse Asphalte | `chaussures` / `sneakers` | `42 000 FCFA` | **En stock** — cuir grainé et empiècements suédés. |
| 13 | `prod-13` | `tshirt-col-montant-minimal` | T-shirt Col Montant Minimal | `vetements` / `t-shirts` | `15 000 FCFA` | **En stock** — entrée de gamme `<= 15 000 FCFA` en coton peigné `240 g/m²`. |
| 14 | `prod-14` | `babouche-croco-rouge-sang` | Babouche Croco Rouge Incompris | `babouches` / `croco-embosse` | `38 000 FCFA` | **Stock très faible** (`totalStock = 2`, `Nouveau` → badge « Plus que 2 »). |
| 15 | `prod-15` | `chelsea-boot-cuir-douala` | Chelsea Boot Cuir Douala | `chaussures` / `derbies-boots` | `62 000 FCFA` | **Stock faible** (`totalStock = 3` → badge « Plus que 3 ») — tranche `50000-plus`. |
| 16 | `prod-16` | `hoodie-zippe-armure` | Hoodie Zippé Lourd Armure | `vetements` / `hoodies` | `36 000 FCFA` | **En stock** (`Nouveau`) — zip métallique double curseur. |
| 17 | `prod-17` | `tshirt-archive-01` | T-shirt Archive N°01 | `vetements` / `t-shirts` | `14 000 FCFA` | **Épuisé (`totalStock = 0`)** — série limitée numérotée en rupture complète. |
| 18 | `prod-18` | `pantalon-droit-atelier` | Pantalon Coupe Droite Atelier | `vetements` / `pantalons` | `27 500 FCFA` | **En stock** — sergé de coton lourd à pli central pressé. |
| 19 | `prod-19` | `babouche-nomade-daim` | Babouche Nomade Daim Sable | `babouches` / `cuir-lisse` | `22 000 FCFA` | **En stock** — veau velours souple *Beige Sable* et *Brun Cognac*. |
| 20 | `prod-20` | `sneaker-runner-nuit` | Sneaker Runner Nuit Rouge | `chaussures` / `sneakers` | `46 000 FCFA` | **En stock** (`Nouveau`) — mesh balistique et cuir mat. |
| 21 | `prod-21` | `surchemise-toile-incompris` | Surchemise Toile Lourde L’Incompris | `vetements` / `hoodies` | `34 000 FCFA` | **En stock** — gabardine `390 g/m²` à boutons métalliques gravés. |
| 22 | `prod-22` | `babouche-croco-ebene-or` | Babouche Croco Ébène Prestige | `babouches` / `croco-embosse` | `40 000 FCFA` | **Stock critique** (`totalStock = 1` en pointure `42` → badge « Plus que 1 »). |
| 23 | `prod-23` | `combat-boot-monolithe` | Combat Boot Monolithe Cuir | `chaussures` / `derbies-boots` | `65 000 FCFA` | **En stock** (`Nouveau`) — cuir pleine fleur hydrofuge et semelle crantée. |
| 24 | `prod-24` | `bandana-pack-signature` | Pack T-shirt & Foulard Signature | `vetements` / `t-shirts` | `8 000 FCFA` | **Taille Unique (`Unique`)** — pré-sélection automatique de la taille unique sur la fiche produit. |
