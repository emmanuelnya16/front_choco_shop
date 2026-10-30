# Rapport de Recette — Module M1 « Vitrine »
**Projet :** DR Choco L’Incompris — Boutique & Réservation en ligne (Cameroun)  
**Date :** 30 octobre 2026  
**Périmètre :** Module M1 (Pipeline d’images résilient, Kit visuel réutilisable, Coquille applicative complète, Page d’accueil 11 sections fidèle à la maquette « Bralder », Section Kit dans `/_dev`, Tests automatisés M1)

---

## 1. Ce qui est livré (Rendus de 360 px à 1440 px)

### 1.1 Pipeline d’images et données enrichies (`public/images/`, `SmartImage`, `src/mocks/`)
- **Arborescence `public/images/` et `public/images/README.md`** : guide complet en français pour le photographe / graphiste (dimensions, ratios `16:9`, `9:14`, `4:5`, `2:1`, `1:1`, `16:10`, poids cibles WebP, nommage).
- **8 visuels d’ambiance de remplacement (`public/images/fallback/mood-*.svg`)** : fond sombre en dégradé `#1A1A18 → #262624`, halo rouge discret, motif barbelé stylisé et mot-repère en filigrane (`COLLECTION`, `VÊTEMENTS`, `CHAUSSURES`, `BABOUCHES`, `T-SHIRTS`, `HOODIES`, `PANTALONS`, `L’INCOMPRIS`).
- **5 silhouettes produits vectorielles enrichies (`public/mock/product-*.svg`)** : t-shirt, hoodie, pantalon cargo, sneaker monolithe et babouche artisanale sur fond `#F4F4F3` avec ombre portée au sol.
- **Composant `SmartImage` (`src/components/ui/SmartImage.tsx`)** :
  - Réservation systématique de l’espace via `aspect-ratio` (`CLS = 0`).
  - Bascule automatique et silencieuse vers `fallback` si la photo WebP finale n’est pas encore déposée dans `public/images/`, sans aucune erreur console ni icône d’image cassée.
  - Traitement `tone="mood"` appliquant le rendu noir et blanc contrasté + grain subtil fidèle à la maquette, avec option `colorRevealOnGroupHover` (retour en couleur au survol pour la section Looks).
- **Catalogue démo réaliste (`src/mocks/fixtures/`)** :
  - **3 catégories racines** (`Vêtements`, `Chaussures`, `Babouches`) et **7 sous-catégories** (`T-shirts`, `Hoodies`, `Pantalons`, `Sneakers`, `Derbies & Boots`, `Cuir lisse`, `Croco embossé`).
  - **24 produits camerounais réalistes** entre `8 000 FCFA` et `65 000 FCFA` incluant des articles nouveaux (`isNew`), des stocks faibles (`1 à 3` exemplaires → badge « Plus que X ») et des articles épuisés (`stock = 0` → badge « Épuisé »).
  - **4 looks complets (`src/mocks/fixtures/looks.ts`)** servis par `GET /looks`.

### 1.2 Kit visuel réutilisable (`src/components/ui/`)
- **`Logo`** : variantes `dark` / `light`, tailles `sm` (`28 px`), `md` (`34 px`), `lg` (`44 px`), bascule automatique vers `/brand/logo-*.svg` si présent.
- **`Button`** : 6 variantes (`primary`, `dark`, `light`, `outline`, `outline-light`, `ghost`), 3 tailles (`sm`, `md`, `lg`), état `loading`, `fullWidth`, support `href` interne/externe, rétroaction tactile `m.button` (`scale: 0.97`).
- **`IconButton`** : cible tactile garantie `44 × 44 px`, disque visuel `40 px`, variantes `plain`, `surface`, `dark`, `light-ghost`, pastille numérique `red` animée (`spring.bounce` via `key={badge}`).
- **`Badge` & `Chip`** : badges statutaires (`Nouveau`, `Plus que X`, `Épuisé`, `Info`) et puces de filtre `Chip` (`36 px` dans une zone tactile de `44 px`).
- **`SectionHeader`** : étiquette `eyebrow` rouge optionnelle, titre `text-h2`, lien d’action avec flèche qui glisse de `4 px` au survol, et emplacement `rightSlot` (flèches de carrousel).
- **`ProductCard` & `ProductCardSkeleton`** :
  - Cadre `4:5` sur fond `surface`, bascule vers la 2e vue au survol ordinateur, zoom `1.05`.
  - Cœur favori en haut à gauche avec rebond (`scale: [0.8, 1.25, 1]`) et **6 particules rouges** qui s’écartent en `0,4 s`.
  - Badge de disponibilité en haut à droite (maximum 1 badge statutaire priorisé : `Épuisé` > `Plus que X` > `Nouveau`).
  - Pastilles de couleurs mappées sur les jetons CSS (zéro couleur `#` en dur), prix tabulaire FCFA, et double bouton d’action (« Réserver » + « Ajouter », ou « Voir l’article » si épuisé).
- **`CategoryTile`** : tuile sombre avec photo `tone="mood"`, voile `--color-scrim-55` passant à `--color-scrim-40` au survol, zoom `1.06` et titre blanc qui monte de `4 px`.
- **`Sheet` & `SizePicker`** : feuille modale responsive (tiroir bas glissable `drag="y"` sur mobile, boîte centrée sur ordinateur) avec piège de focus, fermeture par `Escape` ou glissement (`> 120 px` ou vitesse `> 500`), sélection de couleur et de taille (tailles épuisées barrées et désactivées), ajout au `cartStore`, vibration haptique et notification `Toast`.
- **`Toast` / `Toaster`** : notifications sobres `bg-ink text-white` avec barre latérale `bg-red`, empilables par 2 maximum, auto-fermeture à `3,5 s`.
- **`Marquee`** : bandeau défilant infini GSAP (`xPercent: -50`), accélération réactive à la vitesse de défilement (`ScrollTrigger.getVelocity()`), mise en pause hors écran et onglet masqué, piste dupliquée masquée aux lecteurs d’écran (`aria-hidden="true"`), immobile en mode `prefers-reduced-motion: reduce`.

### 1.3 Coquille de l’application (`src/components/layout/` & `RootLayout.tsx`)
- **`AppHeader`** :
  - **Ordinateur (`lg:`)** : 2 lignes (Ligne 1 de `72 px` : `Logo`, barre de recherche `360 px` redirigeant vers `/recherche`, `IconButton` Favoris, Panier et Compte avec badges ; Ligne 2 de `48 px` : bouton « Catégories » ouvrant le `MegaMenu`, liens Accueil · Vêtements · Chaussures · Babouches · Comment réserver avec soulignement rouge glissant `layoutId`, bouton « Mes réservations »). La ligne 2 se replie en douceur après `80 px` de défilement (`transform` + `opacity`, sans animer `height`).
  - **Mobile (`< lg`)** : barre de `56 px` (`--header-h`) transparente avec logo et icônes blancs au-dessus du Hero sur `/`, devenant blanche avec ombre après `40 px`, se cachant au défilement vers le bas (`> 8 px`) et réapparaissant dès qu’on remonte.
- **`MegaMenu`** : panneau ordinateur 4 colonnes (Vêtements, Chaussures, Babouches + tuile d’ambiance « Nouveautés de la semaine ») animé via `clipPath`, fermeture au clic extérieur, touche `Escape` et changement de route.
- **`BottomNav`** : barre mobile 5 onglets (`Accueil`, `Explorer`, `Panier` avec badge rebondissant, `Réservations`, `Profil`), hauteur `64 px + pb-safe`, verre dépoli `--color-nav-glass`, barre active `3 × 20 px` glissante (`layoutId`).
- **`FloatingWhatsApp`** : bouton flottant `52 px` en `bg-ink` avec icône SVG blanche (sans vert de marque), numéro issu de `GET /settings/public`, apparition après `1,5 s` (`spring.bounce`), masqué sur les routes de paiement.
- **`AppFooter`** : pied de page sombre `bg-ink text-silver` avec `Logo light lg`, bouton WhatsApp, 4 colonnes sur ordinateur / accordéons repliables sur mobile, adresse et horaires dynamiques depuis `/settings/public`, et pastilles texte « Orange Money » / « MTN MoMo » en `bg-ink-2`.

### 1.4 Page d’accueil complète en 11 sections (`src/pages/HomePage.tsx`)
1. **§7.1 Hero (`HeroSection`)** : pleine largeur, photo d’ambiance plein cadre, voile dégradé directionnel (gauche → droite sur ordinateur, bas → haut sur mobile), pastille « Nouvelle collection », titre `text-display` sur 3 lignes masquées (`.mask-line`), 2 boutons `lg`, indicateur de défilement vertical et séquence GSAP (`< 1,7 s`) + parallaxe au défilement.
2. **§7.2 Bandeau des avantages (`Marquee tone="red"`)** : 5 engagements séparés par `✦`.
3. **§7.3 Nos univers (`CategoriesSection`)** : grille 3×2 de `CategoryTile` sur ordinateur ; mosaïque (`16:9` + `2 × 1:1`) et carrousel de `Chip`s sous-catégories sur mobile.
4. **§7.4 Les plus réservés (`BestSellersSection`)** : 4 `ProductCard` triées par popularité (`sort: 'popular'`) + bouton mobile pleine largeur « Voir plus d’articles ».
5. **§7.5 Nouveautés (`NewArrivalsSection`)** : carrousel horizontal `scroll-snap-type: x mandatory` aligné à gauche sur le `Container` et débordant à droite jusqu’au bord de l’écran, avec boutons flèches sur ordinateur.
6. **§7.6 Bandeau paiement & livraison (`Marquee tone="surface" direction="right"`)** : 6 items avec icônes Lucide (`Orange Money`, `MTN MoMo`, `Livraison partout au Cameroun`, `Retrait en boutique`, `Paiement vérifié`, `Photo de votre colis`).
7. **§7.7 Spécial babouches (`BabouchesSpotlightSection`)** : tuile verticale « L’ART DE LA BABOUCHE » dévoilée en `clipPath` de bas en haut + 3 `ProductCard` de la catégorie babouches.
8. **§7.8 Comment ça marche (`HowItWorksSection`, `id="comment-reserver"`)** : 3 étapes (`01`, `02`, `03`) reliées par une ligne verticale qui se remplit en rouge au défilement (`ScrollTrigger scrub: 0.6`), activant chaque carré numéroté (`bg-ink text-white`) face à la photo `4:5` en `position: sticky`.
9. **§7.9 Nos engagements (`EngagementsSection`)** : mosaïque honnête à 3 colonnes décalées sur ordinateur (avec parallaxe douce `-24 px` à `24 px`) et alternance carte/photo sur mobile.
10. **§7.10 Bloc WhatsApp & Application (`WhatsAppAppSection`)** : bloc `bg-ink` avec titre révélé mot par mot (`SplitText type: "words", mask: "words"`) et carte `bg-ink-2` d’installation PWA déclenchant le toast « Bientôt disponible ».
11. **§7.11 Portés par l’Incompris (`LooksSection`)** : 4 cartes portrait `4:5` en noir et blanc qui repassent en couleur et zooment à `1.04` au survol sur ordinateur (carrousel `78 vw` sur mobile).

---

## 2. Tableau de comparaison avec la maquette « Bralder » (§9.1)

| Section de la maquette | Réalisé dans DR Choco (M1) | Écart & Justification métier |
| --- | --- | --- |
| **En-tête 2 lignes + recherche + icônes** | En-tête ordinateur 2 lignes (`72 px` + `48 px` repliable au scroll) + méga-menu 4 colonnes ; en-tête mobile `56 px` transparent sur le Hero et auto-masquant au défilement bas. | Adaptation mobile-first avec barre basse 5 onglets (`BottomNav`) pour l’usage à une main au Cameroun. |
| **Hero sombre plein cadre + grand titre condensé** | Hero `min(88vh, 760px)` / `88svh` avec photo N&B contrastée, voile dégradé, titre Archivo Variable `wdth 75%` sur 3 lignes masquées, point final rouge et double CTA. | Fidélité directe à l’atmosphère de la maquette ; texte adapté à la réservation et au paiement Mobile Money. |
| **Grille 3×2 de tuiles sombres (« Hoodies », « Caps »…)** | Grille 3×2 de `CategoryTile` sur ordinateur (`Vêtements`, `Chaussures`, `Babouches`, `T-shirts`, `Hoodies`, `Pantalons`) avec voile `ink` et compteur d’articles. | Sur mobile, transformée en mosaïque `16:9` + `2 × 1:1` + puces horizontales pour éviter 6 tuiles empilées trop hautes. |
| **Grilles produits « Best Selling » & « New Arrival » sur fond gris clair** | Sections « Les plus réservés » (grille 4 colonnes / 2×2 mobile) et « Nouveautés » (carrousel `scroll-snap` débordant à droite) avec `ProductCard` `4:5` sur fond `--color-surface`. | Remplacement des étoiles d’avis fictives par de vraies pastilles de couleurs disponibles et le double bouton « Réserver » / « Ajouter ». |
| **Bandeau « Trusted By Our Brand »** | Double bandeau `Marquee` : bandeau rouge d’avantages sous le Hero + bandeau `surface` inversé mettant en avant Orange Money, MTN MoMo, la livraison et la photo du colis. | Zéro logo de marque tierce non autorisé ; utilisation d’icônes Lucide + typographie forte. |
| **Section « Transform Your Ideas Into Design Mockups » (étapes 01-02-03 + photo)** | Section `#comment-reserver` « RÉSERVEZ EN 3 ÉTAPES » : carrés `44 px` numérotés `01`, `02`, `03` reliés par une ligne verticale rouge animée au défilement + photo `4:5` sticky à droite. | Texte dédié au parcours réel : blocage du stock 24 h → capture Mobile Money → photo du colis avant expédition. |
| **Mosaïque « Trusted by 20k+ Happy Customer »** | Section « POURQUOI NOUS FAIRE CONFIANCE » : mosaïque 3 colonnes décalées alternant 3 photos d’ambiance N&B et 4 cartes d’engagements vérifiables. | Aucun faux chiffre ni faux témoignage client (conformément à la règle d’honnêteté §1.2 et §7.9). |
| **Rangée « Built for the Next Generation of Streetwear »** | Section « PORTÉS PAR / L’INCOMPRIS » : 4 cartes looks portrait `4:5` avec transition N&B → couleur au survol et lien « Voir le look → ». | Fidèle à la mise en page éditoriale en bas de maquette. |
| **Pied de page sombre multi-colonnes** | `AppFooter` en `bg-ink text-silver` avec 4 colonnes sur ordinateur, accordéons sur mobile, horaires/adresse dynamiques et pastilles texte Orange Money / MTN MoMo. | Ajout du bouton direct WhatsApp et de l’espace de sécurité pour la barre de navigation basse mobile. |

---

## 3. Poids des morceaux JavaScript (Build de production gzip)

Mesures obtenues via `npm run analyze` (`NODE_ENV=production vite build`) :

| Morceau (Chunk) | Chargement | Taille brute | Taille Gzip | Budget cible |
| --- | --- | --- | --- | --- |
| `assets/index-Dh16Ex6n.js` (Socle initial + Coquille M1) | Initial | `358,97 kB` | **`112,88 kB`** | **< 180 kB gzip ✅** |
| `assets/gsap-tLDLf56L.js` (`gsap` + `ScrollTrigger` + `SplitText`) | À la demande (lazy) | `132,53 kB` | **`52,16 kB`** | Isolé du chargement initial ✅ |
| `assets/HomePage-BgrKoazy.js` (11 sections de la vitrine) | À la demande (lazy) | `28,04 kB` | **`8,00 kB`** | Chargé uniquement sur `/` ✅ |
| `assets/SectionHeader-BaZ8KG9M.js` (Composants partagés catalogue) | À la demande (lazy) | `12,63 kB` | **`4,41 kB`** | Partagé entre routes ✅ |
| `assets/index-BhKNux5P.css` (Tailwind v4 + jetons M0/M1) | Initial | `50,51 kB` | **`9,76 kB`** | Léger & sans doublon ✅ |

- **Respect strict du budget initial** : le JavaScript initial s’établit à **`112,88 kB gzip`** (soit 37 % sous le plafond de `180 kB gzip`), et `gsap` n’est jamais téléchargé sur les routes qui n’en ont pas besoin (`/panier`, `/reservations`, etc.).

---

## 4. Jetons ajoutés dans `@theme` (`src/styles/index.css`) et justification

Pour respecter la règle **zéro `#` ni `rgb(` en dur dans `src/`** (hors `src/styles/index.css` et `src/mocks/`), les jetons dérivés suivants ont été déclarés dans `@theme` :

| Jeton CSS | Valeur | Pourquoi il a été ajouté |
| --- | --- | --- |
| `--color-scrim-40` | `rgba(26, 26, 24, 0.40)` | Voile sombre allégé au survol des `CategoryTile` et haut du Hero mobile. |
| `--color-scrim-50` | `rgba(26, 26, 24, 0.50)` | Toile de fond (`backdrop`) de la feuille modale `Sheet`. |
| `--color-scrim-55` | `rgba(26, 26, 24, 0.55)` | Voile par défaut des `CategoryTile` garantissant la lisibilité du titre blanc. |
| `--color-scrim-85` | `rgba(26, 26, 24, 0.85)` | Dégradé latéral gauche du Hero ordinateur et des tuiles éditoriales. |
| `--color-scrim-95` | `rgba(26, 26, 24, 0.95)` | Dégradé inférieur profond du Hero mobile et de la tuile « Spécial babouches ». |
| `--color-glass-light` | `rgba(255, 255, 255, 0.10)` | Fond translucide de la pastille « Nouvelle collection » sur le Hero. |
| `--color-glass-border` | `rgba(255, 255, 255, 0.20)` | Bordure subtile de la pastille du Hero et des boutons sur fond sombre. |
| `--color-nav-glass` | `rgba(255, 255, 255, 0.92)` | Fond blanc translucide (`backdrop-blur`) de la barre basse mobile `BottomNav`. |
| `--shadow-header` | `0 2px 16px rgba(26, 26, 24, 0.06)` | Ombre discrète sous l’en-tête après défilement (`> 40 px` mobile / `> 80 px` ordinateur). |
| `--shadow-card-icon` | `0 2px 8px rgba(26, 26, 24, 0.12)` | Ombre du bouton cœur favori posé sur les photos produits. |

---

## 5. Liste des photos à fournir (`public/images/`)

Toutes les emplacements ci-dessous sont prêts et documentés dans `public/images/README.md`. Tant que les fichiers `.webp` définitifs ne sont pas déposés, `SmartImage` affiche automatiquement les visuels de remplacement de `public/images/fallback/` et `public/mock/` :

| Emplacement attendu | Format / Ratio | Statut actuel |
| --- | --- | --- |
| `public/brand/logo-dark.svg` & `logo-light.svg` | SVG vectoriel | Remplacement typographique actif dans `<Logo />` |
| `public/images/hero/hero-desktop.webp` | `1920 × 1080 px` (`16:9`) | Remplacement actif (`mood-hero.svg`) |
| `public/images/hero/hero-mobile.webp` | `1080 × 1680 px` (`9:14`) | Remplacement actif (`mood-hero.svg`) |
| `public/images/categories/{vetements,chaussures,babouches,t-shirts,hoodies,pantalons}.webp` | `1200 × 600 px` (`2:1`) | Remplacement actif (`mood-*.svg`) |
| `public/images/how/how-it-works.webp` | `1200 × 1500 px` (`4:5`) | Remplacement actif (`mood-portrait.svg`) |
| `public/images/engagements/engagement-{1..3}.webp` | `900 × 1125 px` (`4:5`) | Remplacement actif (`mood-*.svg`) |
| `public/images/looks/look-{1..4}.webp` | `900 × 1125 px` (`4:5`) | Remplacement actif (`mood-*.svg`) |
| `public/images/products/<slug>-{1,2}.webp` | `1000 × 1250 px` (`4:5`) | Remplacement actif (`product-*.svg`) |

---

## 6. Hypothèses et écarts par rapport au prompt

1. **Contraste WCAG sur fond `ink`** : dans la section §7.10 (« Bloc WhatsApp et application ») et la tuile §7.7 (« Spécial babouches »), l’étiquette au-dessus du titre sur fond `ink` est rendue sous forme de pastille `bg-red text-white` (ratio `4.54:1`) plutôt qu’en texte rouge direct sur fond `ink` (qui n’aurait qu’un ratio de `3.74:1`), afin de respecter simultanément l’accent rouge demandé et la règle stricte d’accessibilité M0/M1 (« jamais de texte rouge sur fond `ink` »).
2. **Routes catégories** : les routes `/explorer/:category` et `/categorie/:category` pointent toutes deux vers la page d’exploration afin de garantir qu’aucun lien issu de l’en-tête, du méga-menu ou des tuiles ne génère de 404.
3. **MSW 3.0.3 dans les tests d’intégration** : conformément au correctif documenté au Module M0, `server.listen({ onUnhandledFrame: 'bypass' })` est utilisé dans `src/test/m1.test.tsx`.

---

## 7. Idées pour les modules suivants (Catalogue & Fiche produit)

- **Pré-chargement au survol / toucher (`prefetchQuery`)** : déclencher `queryClient.prefetchQuery` sur `qk.product(slug)` lorsqu’une `ProductCard` entre dans le centre de l’écran ou au `onPointerEnter` sur ordinateur pour une ouverture instantanée de la fiche produit.
- **Conservation des filtres dans l’URL (`useSearchParams`)** : synchroniser les `Chip`s de sous-catégories, le tri (`popular`, `newest`, `price_asc`, `price_desc`) et le filtre de taille dans l’URL de `/explorer` pour permettre le partage direct de liens filtrés sur WhatsApp.
- **Galerie fiche produit avec zoom natif et bouton « Réserver ma taille » collant** : réutiliser la logique de `SizePicker` directement dans la fiche produit avec une barre d’action collante au-dessus de la `BottomNav` sur mobile.
