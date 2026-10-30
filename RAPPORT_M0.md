# RAPPORT DE LIVRAISON — MODULE M0 « FONDATIONS » — DR CHOCO L'INCOMPRIS

## 1. Résumé de ce qui a été livré

Le module **M0 « Fondations »** est intégralement en place, testé et validé :

- **Configuration & Qualité (P1–P2)** : Vite 8, React 19, TypeScript 5.8 en mode strict, ESLint 10 (flat config), Prettier avec tri Tailwind, alias `@/` vers `./src`, validation stricte des variables d'environnement dans `src/lib/env.ts`.
- **Identité Visuelle & Typographie (P3)** : Tailwind CSS v4 dans `src/styles/index.css` avec les 11 jetons de couleur (5 couleurs de charte + 6 nuances techniques), règles de contraste WCAG documentées, rayons, ombres, z-index nommés, zones de sécurité (`pt-safe`…), police locale **Archivo Variable** avec les deux axes `wght` et `wdth`, échelle typographique fluide (390 px → 1440 px) et masque `.mask-line`.
- **Fondations du Mouvement (P4)** : jetons (`src/motion/tokens.ts`), presets (`src/motion/presets.ts`), `MotionProvider` (`MotionConfig reducedMotion="user"` + `LazyMotion` strict chargeant `domMax` à la demande), hook `useReducedMotionPref` temps réel, et point d'entrée unique `src/lib/gsap.ts` (`useGSAP`, `ScrollTrigger`, `SplitText`, `DrawSVGPlugin`) isolé dans son propre chunk Rollup/Rolldown.
- **Routage (P5)** : `createBrowserRouter` avec les 17 routes de la section 9.2 chargées à la demande (`lazy`), `RootLayout` avec barre de chargement neutre, `ScrollRestoration`, `RouterErrorBoundary` en français et titres d'onglet dynamiques (`useDocumentTitle`).
- **Couche API, Stores & Utilitaires (P6)** : client `fetch` maison (`ApiError` en français, délai d'attente `AbortController` 15 s / 30 s, rafraîchissement automatique sur 401 via `POST /auth/refresh`, envoi multipart `XMLHttpRequest` avec progression), `QueryClient` configuré en `offlineFirst`, fabrique de clés `qk`, stores Zustand `authStore` et `cartStore` persistés via `safeStorage`, utilitaires testés (`price`, `phone`, `cloudinary`, `haptics`, `date`, `storage`, `contrast`) et types métier incluant `PackagePhoto` et `hasPackagePhotos()`.
- **Mocks MSW & Fixtures (P7)** : 3 catégories avec sous-catégories, 24 produits réalistes entre 8 000 et 65 000 FCFA avec images SVG 4:5 locales (`public/mock/`), 3 réservations de démonstration (`RES-000101`, `RES-000102` avec 2 photos de colis prêt, `RES-000103` rejetée), et gestionnaires MSW simulant une latence mobile 3G/4G de 300 à 900 ms.
- **Laboratoire `/_dev` & Tests (P8–P9)** : page de contrôle `/_dev` couvrant les 9+1 sections demandées, 14 suites de tests unitaires et d'intégration passantes à 100 %, et configurations de prévisualisation Vercel (`vercel.json`) et Netlify (`public/_redirects`).

---

## 2. Versions exactes installées

| Paquet | Version installée | Notes |
| --- | --- | --- |
| `vite` | `^8.3.0` (`8.3.5`) | Bundler Rolldown natif |
| `react` / `react-dom` | `^19.0.1` | React 19 |
| `typescript` | `^5.8.3` | Mode strict activé (`tsconfig.app.json`) |
| `tailwindcss` / `@tailwindcss/vite` | `^4.3.3` | Configuration CSS-first via `@theme` et `@utility` |
| `react-router` | `^8.5.1` | API Data Router (`createBrowserRouter`, `lazy`) identique à v7 |
| `@tanstack/react-query` | `^5.105.0` | + `@tanstack/react-query-devtools` chargé à la demande en dev |
| `zustand` | `^5.0.16` | Middleware `persist` + `createJSONStorage` |
| `motion` | `^12.23.24` | Points d'entrée `motion/react` et `motion/react-m` |
| `gsap` / `@gsap/react` | `^3.15.0` / `^2.1.2` | Inclut `ScrollTrigger`, `SplitText`, `DrawSVGPlugin` |
| `@fontsource-variable/archivo` | `^5.3.0` | Import de `@fontsource-variable/archivo/wdth.css` |
| `lucide-react` | `^0.546.0` | Icônes vectorielles |
| `clsx` / `tailwind-merge` | `^2.1.1` / `^3.7.0` | Utilitaire `cn()` |
| `msw` | `^3.0.3` | En MSW 3.x, `onUnhandledRequest` est remplacé par `onUnhandledFrame` |
| `vitest` / `jsdom` | `^5.0.5` / `^30.1.3` | + `@testing-library/react` `^16.3.3` |
| `eslint` / `typescript-eslint` | `^10.13.0` / `^8.72.1` | Flat config `eslint.config.js` |
| `prettier` / `prettier-plugin-tailwindcss` | `^3.9.10` / `^0.8.1` | Formatage automatique |
| `rollup-plugin-visualizer` | `^7.1.1` | Génération de `stats.html` via `npm run analyze` |

### Justification du choix du fichier CSS pour Archivo Variable (Section 7.1)

L'inspection de `node_modules/@fontsource-variable/archivo` montre que :
- `index.css` et `wght.css` chargent `archivo-*-wght-normal.woff2`, qui n'expose **que** l'axe de graisse (`font-weight: 100 900`) sans l'axe de largeur `wdth`.
- **`wdth.css`** (ainsi que `standard.css`) charge `archivo-*-wdth-normal.woff2` (`format('woff2-variations')`), qui déclare à la fois **`font-weight: 100 900`** et **`font-stretch: 62% 125%`**.
Nous avons donc importé `@fontsource-variable/archivo/wdth.css` une seule fois en tête de `src/main.tsx`.

---

## 3. Liste de toutes les `HYPOTHÈSE:` à faire valider par l'équipe Back-end

1. **Stratégie de jetons d'authentification (`src/stores/authStore.ts` & `src/lib/api/client.ts`)** :
   - Le jeton d'accès JWT (`accessToken`) est conservé uniquement en mémoire dans `authStore` (non écrit dans `localStorage` pour éviter le vol par XSS), tandis que seul l'objet `user` est persisté.
   - Le rafraîchissement (`POST /auth/refresh`) s'appuie sur un cookie `httpOnly` de longue durée (~90 jours) envoyé avec `credentials: 'include'`.
2. **Contrat des routes et payloads REST (`src/lib/api/endpoints.ts` & `src/types/api.ts`)** :
   - Structure de pagination `Paginated<T>` (`items`, `page`, `pageSize`, `total`, `totalPages`).
   - Paramètres de filtrage catalogue sur `GET /products` (`category`, `q`, `size`, `minPrice`, `maxPrice`, `available`, `sort`, `page`).
   - Format normalisé des erreurs JSON renvoyées par Symfony (`{ code, message, details }`).
3. **Photos privées du colis prêt (`src/types/domain.ts`)** :
   - `Reservation.packagePhotos` et `Reservation.packageReadyAt` renvoient des URL signées complètes générées par le back-end (dossier Cloudinary privé par réservation). Le front-end les affiche telles quelles sans passer par `cloudinaryUrl()`.
4. **Activation de `/_dev` en prévisualisation (`src/lib/env.ts`)** :
   - La route `/_dev` est active lorsque `import.meta.env.DEV` est vrai, ou lorsque `VITE_ENABLE_DEV_PAGE=true` / `VITE_API_MOCK=true` pour permettre au client de consulter `/_dev` sur l'URL de prévisualisation avant l'ouverture de la production.

---

## 4. Poids des morceaux JavaScript (`npm run analyze`)

Mesures relevées lors du build de production (`NODE_ENV=production ANALYZE=true vite build`) :

| Morceau (Chunk) | Taille brute | Taille compressée (gzip) | Chargement |
| --- | --- | --- | --- |
| **`index-*.js` (Socle initial : React 19, Router, Query, Zustand, Motion Lazy)** | **387,41 kB** | **123,07 kB** | Initial |
| `rolldown-runtime-*.js` | 0,91 kB | 0,51 kB | Initial |
| `HomePage-*.js` + `_PlaceholderPage-*.js` + `useDocumentTitle-*.js` | 7,04 kB | 2,60 kB | Route `/` (lazy) |
| **Total JS initial sur la route `/`** | **395,36 kB** | **126,18 kB** | **< 180 kB gzip ✓** |
| `index-*.css` (Tailwind v4 + jetons) | 21,75 kB | 5,27 kB | Initial |
| `features-*.js` (Motion `domMax`) | 83,97 kB | 27,38 kB | Asynchrone (`LazyMotion`) |
| `gsap-*.js` (GSAP + ScrollTrigger + SplitText + DrawSVG) | 132,53 kB | 52,16 kB | **Isolé (0 kB au démarrage) ✓** |
| `GsapTestSandbox-*.js` | 4,62 kB | 1,52 kB | À la demande (`/_dev`) |
| `DevPage-*.js` | 51,27 kB | 15,06 kB | À la demande (`/_dev`) |
| `Pages client provisoires` (`ExplorePage`, `CartPage`, `ProductPage`…) | 0,40 à 0,52 kB | 0,29 à 0,38 kB | À la demande par route |
| `browser-*.js` (Worker MSW + fixtures de démo) | 418,16 kB | 159,24 kB | Dynamique si `VITE_API_MOCK=true` |

---

## 5. Écarts techniques par rapport au prompt et justifications

1. **Port du serveur de développement (`3000` au lieu de `5173`)** : l'environnement d'exécution et de prévisualisation impose le port `3000` (`vite --port=3000 --host=0.0.0.0`). Le paramètre `host: true` est conservé pour permettre le test sur téléphone via Wi-Fi.
2. **MSW 3.0 (`onUnhandledFrame: 'bypass'`)** : la dernière version stable de MSW est la `3.0.3`, dans laquelle l'option `onUnhandledRequest` de MSW 2 a été renommée `onUnhandledFrame` conformément à la documentation officielle MSW 3.
3. **Remplacement de `__dirname` par `import.meta.dirname` dans `vite.config.ts`** : requis par Vite 8 pour supprimer l'avertissement du chargeur natif de configuration.

---

## 6. Idées notées pour les modules suivants

- **M4 (Catalogue)** : précharger (`queryClient.prefetchQuery`) la fiche produit au survol ou au `onPointerDown` d'une carte produit pour rendre l'ouverture instantanée sur réseau 3G.
- **M7 (Paiement)** : ajouter une compression côté client (`canvas` / WebP max 1200 px) avant `api.upload()` de la capture Mobile Money afin de diviser par 5 le temps d'envoi sur réseau mobile instable.
- **M8 (Suivi)** : utiliser une visionneuse plein écran légère pour inspecter les photos du colis prêt (`packagePhotos`) avec zoom tactile.

---

## 7. Points d'attention pour le module M1 (Design System)

- Toujours utiliser `<m.button {...pressable}>` (`import * as m from 'motion/react-m'`) pour les boutons interactifs afin de respecter `<LazyMotion strict>`.
- Respecter scrupuleusement les règles de contraste documentées dans `src/styles/index.css` : jamais de texte `red` sur fond `ink`, jamais de texte `grey` sur fond `white` (utiliser `text-2`).
- Garantir une zone tactile minimale de `44 × 44 px` (`min-h-[44px]`) sur tous les contrôles interactifs (sélecteurs de taille, boutons d'action, filtres).
- Toujours associer `text-price` (`tabular-nums`) aux montants formatés avec `formatPrice()`.
