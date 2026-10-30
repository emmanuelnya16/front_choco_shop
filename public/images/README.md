# Pipeline d'images — DR Choco L'Incompris (Module M1)

Déposez vos vraies photographies aux emplacements ci-dessous en conservant exactement ces noms de fichiers.
Le composant `<SmartImage />` les chargera automatiquement sans aucune modification de code et utilisera les visuels de remplacement (`public/images/fallback/*.svg`) tant qu'un fichier est absent.

## 1. Hero de la page d'accueil (`public/images/hero/`)

| Fichier | Dimensions conseillées | Ratio | Description |
| --- | --- | --- | --- |
| `public/images/hero/hero-desktop.webp` | `1920 × 1080 px` | `16:9` | Mannequins cadrés à droite sur fond sombre (espace libre à gauche pour le titre) |
| `public/images/hero/hero-mobile.webp` | `1080 × 1600 px` | `2:3` / `9:16` | Portrait vertical, sujet dans les 2/3 supérieurs |

## 2. Tuiles de catégories (`public/images/categories/`)

| Fichier | Dimensions conseillées | Ratio | Usage |
| --- | --- | --- | --- |
| `public/images/categories/vetements.webp` | `1200 × 600 px` | `2:1` | Catégorie principale Vêtements |
| `public/images/categories/chaussures.webp` | `1200 × 600 px` | `2:1` | Catégorie principale Chaussures |
| `public/images/categories/babouches.webp` | `1200 × 600 px` | `2:1` | Catégorie principale Babouches & bloc « Spécial babouches » |
| `public/images/categories/t-shirts.webp` | `1200 × 600 px` | `2:1` | Sous-catégorie T-shirts |
| `public/images/categories/hoodies.webp` | `1200 × 600 px` | `2:1` | Sous-catégorie Hoodies |
| `public/images/categories/pantalons.webp` | `1200 × 600 px` | `2:1` | Sous-catégorie Pantalons |

## 3. Section « Comment ça marche » (`public/images/how/`)

| Fichier | Dimensions conseillées | Ratio | Usage |
| --- | --- | --- | --- |
| `public/images/how/how-it-works.webp` | `1000 × 1250 px` | `4:5` | Groupe de mannequins streetwear (colonne droite sticky sur ordinateur) |

## 4. Mosaïque « Nos engagements » (`public/images/engagements/`)

| Fichier | Dimensions conseillées | Ratio | Usage |
| --- | --- | --- | --- |
| `public/images/engagements/engagement-1.webp` | `900 × 1200 px` | `3:4` | Photo d'atelier / détail matière (colonne 1) |
| `public/images/engagements/engagement-2.webp` | `900 × 1200 px` | `3:4` | Photo de colis préparé / boutique (colonne 2) |
| `public/images/engagements/engagement-3.webp` | `900 × 1200 px` | `3:4` | Photo portée urbaine Douala (colonne 3) |

## 5. Section « Portés par l'Incompris » (`public/images/looks/`)

| Fichier | Dimensions conseillées | Ratio | Usage |
| --- | --- | --- | --- |
| `public/images/looks/look-1.webp` | `960 × 1200 px` | `4:5` | Look 1 — Total black barbelé |
| `public/images/looks/look-2.webp` | `960 × 1200 px` | `4:5` | Look 2 — Héritage Akwa |
| `public/images/looks/look-3.webp` | `960 × 1200 px` | `4:5` | Look 3 — Silhouette Monolithe |
| `public/images/looks/look-4.webp` | `960 × 1200 px` | `4:5` | Look 4 — Nocturne Croco |

## 6. Photos produits (`public/images/products/`)

- Format : `960 × 1200 px` (`4:5`), fond clair uniforme (`#F4F4F3`).
- Nommage : `public/images/products/{slug}-1.webp`, `{slug}-2.webp` (la 2ᵉ image apparaît au survol sur ordinateur).

## 7. Logos vectoriels optionnels (`public/brand/`)

- `public/brand/logo-white.svg` (pour fond sombre `ink`)
- `public/brand/logo-black.svg` (pour fond clair `white`)
*(En leur absence, le composant `<Logo />` affiche automatiquement le logotype typographique officiel en Archivo Variable).*
