# DR Choco L'Incompris — Application Client PWA (Module M0 « Fondations »)

Application web progressive (PWA) mobile-first de réservation d'accessoires masculins (**vêtements, chaussures et babouches**) pour la marque camerounaise **DR Choco L'Incompris**.

Le parcours client repose sur la réservation avec blocage du stock pendant 24 heures, le paiement par **Mobile Money** (Orange Money / MTN MoMo), l'envoi de la capture d'écran de transaction, la validation par la boutique et le suivi détaillé jusqu'à la livraison ou au retrait en boutique (incluant les photos du colis prêt).

---

## 1. Prérequis

- **Node.js** : `20.19+` ou `22.12+`
- **Gestionnaire de paquets** : `npm` (v10+)

---

## 2. Installation et démarrage

```bash
# 1. Installer les dépendances
npm install

# 2. Copier la configuration d'environnement
cp .env.example .env.local

# 3. Initialiser le Service Worker MSW (déjà présent dans public/mockServiceWorker.js)
npx msw init public/ --save

# 4. Lancer le serveur de développement
npm run dev
```

---

## 3. Scripts disponibles (`package.json`)

| Script | Commande | Description |
| --- | --- | --- |
| `npm run dev` | `vite --port=3000 --host=0.0.0.0` | Serveur de développement accessible sur le réseau local |
| `npm run build` | `tsc -b && vite build` | Vérification TypeScript et build de production |
| `npm run preview` | `vite preview --port=4173 --host` | Serveur de prévisualisation du build local |
| `npm run lint` | `eslint .` | Vérification statique ESLint (flat config) |
| `npm run lint:fix` | `eslint . --fix` | Correction automatique ESLint |
| `npm run format` | `prettier --write "src/**/*.{ts,tsx,css}"` | Formatage Prettier + tri des classes Tailwind |
| `npm run typecheck` | `tsc -b --noEmit` | Vérification stricte des types TypeScript |
| `npm run test` | `vitest run` | Exécution de la suite de tests unitaires et d'intégration |
| `npm run test:watch` | `vitest` | Mode interactif Vitest |
| `npm run analyze` | `vite build --mode analyze` | Génère le rapport `stats.html` du poids des bundles |
| `npm run mock:api` | `tsx server/mock-api.ts` | Serveur de mocks Node sur le port 8787 (mêmes gestionnaires MSW, simulateur boutique compris) |
| `npm run preview:pwa` | `tsc -b && vite build --mode pwa && vite preview --mode pwa …` | Build de l'application installable (sans MSW) et prévisualisation sur http://127.0.0.1:4173 |
| `npm run icons` | `pwa-assets-generator && node scripts/generate-extra-icons.mjs` | Icônes, écrans de démarrage iPhone, pastille et raccourcis |
| `npm run screenshots` | `node scripts/capture-manifest-screenshots.mjs` | Captures du manifeste (fenêtre d'installation Android) |

---

## 4. Variables d'environnement

Définies dans `.env.example` et validées au démarrage par `src/lib/env.ts` (aucun composant ne lit `import.meta.env` directement) :

```dotenv
VITE_API_BASE_URL=http://localhost:8000/api
VITE_API_MOCK=true
VITE_CLOUDINARY_CLOUD_NAME=demo
VITE_APP_NAME="DR Choco L'Incompris"
VITE_SHOP_WHATSAPP=+237600000000
VITE_ENABLE_DEV_PAGE=true
# M6 : application installable et notifications
VITE_PWA_ENABLED=          # vide = vrai pour un build de production, faux en développement
VITE_VAPID_PUBLIC_KEY=     # clé publique VAPID du back-end (clé de démonstration par défaut)
```

- En **prévisualisation** (Vercel / Netlify), conserver `VITE_API_MOCK=true` et `VITE_ENABLE_DEV_PAGE=true` permet d'utiliser les mocks MSW et d'inspecter `/_dev`.
- En **production**, passer `VITE_API_MOCK=false` et `VITE_ENABLE_DEV_PAGE=false` désactive totalement MSW et retire la route `/_dev`.

---

## 5. Arborescence commentée

```text
drchoco-app/
├─ index.html                       # Point d'entrée HTML (lang="fr", theme-color #1A1A18)
├─ public/
│  ├─ mockServiceWorker.js          # Service Worker généré par MSW
│  ├─ favicon.ico, pwa-*.png        # Icônes générées depuis le logo officiel (npm run icons)
│  ├─ _redirects                    # Redirection SPA pour Netlify
│  └─ mock/                         # Silhouettes produits 4:5 et photos de colis en SVG local
├─ src/
│  ├─ main.tsx                      # Import unique Archivo Variable (wdth.css), MSW, rendu React
│  ├─ app/
│  │  ├─ App.tsx                    # Assemblage AppProviders + RouterProvider
│  │  ├─ providers.tsx              # QueryClientProvider + MotionProvider + Devtools (lazy)
│  │  ├─ router.tsx                 # Toutes les routes client chargées à la demande (lazy)
│  │  └─ layouts/
│  │     └─ RootLayout.tsx          # Outlet, ScrollRestoration, emplacements réservés M3
│  ├─ pages/                        # Pages provisoires du parcours client (sections 5.2 à 5.17)
│  ├─ features/                     # Domaines métier (catalog, auth, cart, reservation, payment…)
│  ├─ components/
│  │  └─ ui/                        # Réservé pour le kit de composants M1
│  ├─ motion/
│  │  ├─ tokens.ts                  # Durées, courbes, ressorts, décalages
│  │  ├─ presets.ts                 # Variants Motion prêts à l'emploi
│  │  ├─ MotionProvider.tsx         # MotionConfig (reducedMotion="user") + LazyMotion strict
│  │  ├─ features.ts                # Export domMax chargé à la demande
│  │  └─ useReducedMotionPref.ts    # Hook temps réel et helper prefersReducedMotion()
│  ├─ lib/
│  │  ├─ env.ts                     # Validation et typage des variables d'environnement
│  │  ├─ gsap.ts                    # Enregistrement unique des plugins GSAP (isolé en chunk dédié)
│  │  ├─ api/
│  │  │  ├─ client.ts               # Client fetch avec JWT, timeout, refresh 401 et upload XHR
│  │  │  ├─ endpoints.ts            # Contrat des chemins REST
│  │  │  ├─ queryClient.ts          # Configuration TanStack Query (offlineFirst)
│  │  │  └─ queryKeys.ts            # Fabrique de clés de requêtes (qk.*)
│  │  └─ utils/
│  │     ├─ cn.ts                   # clsx + tailwind-merge
│  │     ├─ price.ts                # Formatage FCFA avec espaces insécables fines
│  │     ├─ phone.ts                # Validation, normalisation (+237) et affichage 6XX XX XX XX
│  │     ├─ cloudinary.ts           # URLs f_auto,q_auto, flou LQIP et srcSet réactif
│  │     ├─ haptics.ts              # Vibration Android sécurisée
│  │     ├─ storage.ts              # Stockage localStorage résilient avec repli en mémoire
│  │     ├─ date.ts                 # Dates françaises et compte à rebours 24 h
│  │     └─ contrast.ts             # Calculateur de contraste WCAG 2.1 en direct
│  ├─ stores/
│  │  ├─ authStore.ts               # Session JWT en mémoire + profil persisté
│  │  └─ cartStore.ts               # Panier persisté avec fusion de variantes et plafond de stock
│  ├─ types/
│  │  ├─ domain.ts                  # Entités métier + PackagePhoto + hasPackagePhotos()
│  │  ├─ api.ts                     # Types des requêtes et réponses REST
│  │  └─ reservationStatus.ts       # 12 statuts, STATUS_META, isFinalStatus, TIMELINE_ORDER
│  ├─ mocks/
│  │  ├─ browser.ts                 # setupWorker MSW
│  │  ├─ handlers.ts                # Gestionnaires MSW avec latence mobile simulée (300-900 ms)
│  │  └─ fixtures/                  # 3 catégories, 24 produits, 3 réservations, paramètres publics
│  ├─ styles/
│  │  └─ index.css                  # Tailwind v4 (@theme), jetons, règles WCAG, typographie fluide
│  ├─ dev/
│  │  ├─ DevPage.tsx                # Laboratoire de contrôle /_dev
│  │  └─ GsapTestSandbox.tsx        # Bac à sable GSAP + DrawSVG chargé à la demande
│  └─ test/
│     ├─ setup.ts                   # Configuration Vitest + jsdom
│     └─ m0.test.tsx                # Suite de tests unitaires et rendu routeur
├─ vercel.json                      # Redirection SPA pour Vercel
├─ README.md                        # Documentation du projet
└─ RAPPORT_M0.md                    # Rapport de livraison du module M0
```

---

## 6. Conventions architecturales obligatoires

1. **Jetons de design uniquement** : aucune couleur hexadécimale (`#...`) en dur dans les composants. Utiliser exclusivement les classes et variables définies dans `src/styles/index.css`.
2. **Séparation Motion / GSAP** :
   - **Motion** anime l'interface pilotée par l'état. En raison de `<LazyMotion strict>`, toujours utiliser `import * as m from 'motion/react-m'` (`<m.div />`), jamais `motion.div`.
   - **GSAP** est réservé aux 5 mises en scène narratives. Toujours importer depuis `@/lib/gsap` uniquement dans un composant chargé à la demande (`lazy`), utiliser `useGSAP(() => { ... }, { scope: ref })` et encapsuler les gestionnaires d'événements dans `contextSafe`.
   - **Un élément = un seul animateur** (jamais Motion et GSAP sur le même nœud DOM).
   - **Propriétés compositeur uniquement** : `transform` (`x`, `y`, `scale`, `rotate`) et `opacity` / `autoAlpha`.
3. **Langue** : code et identifiants en anglais ; tous les textes visibles par l'utilisateur et messages d'erreur en français.

---

## 6 bis. Tester la PWA (M6)

Le service worker de MSW et celui de l'application ne peuvent pas contrôler la même page. D'où deux modes :

| Mode | Commande | MSW | Service worker de l'app |
| --- | --- | --- | --- |
| Développement avec mocks | `npm run dev` | Dans le navigateur | Désactivé (et désinscrit au démarrage s'il en reste un) |
| Test de la PWA | `npm run mock:api` puis `npm run preview:pwa` | Serveur Node (port 8787) | Actif |

1. Terminal 1 : `npm run mock:api`. Le serveur charge `src/mocks/handlers.ts` et répond sur `http://127.0.0.1:8787/api`. Remise à zéro complète : `POST /api/_mock/reset` (ou bouton dans `/_dev`).
2. Terminal 2 : `npm run preview:pwa`. Le build utilise `.env.pwa` (`VITE_API_MOCK=false`, `VITE_API_BASE_URL=http://127.0.0.1:8787/api`, `VITE_PWA_ENABLED=true`).
3. Ouvrez **http://127.0.0.1:4173** (et non `localhost` : les mocks comparent l'origine exacte).
4. Chrome DevTools, onglet Application : manifeste, service worker, caches (`api-catalog`, `api-user`, `images`, `pages`, `fonts`). Le mode avion se simule avec « Offline » dans l'onglet Network.
5. Le simulateur boutique de `/_dev` fonctionne avec ce serveur et déclenche aussi la notification locale correspondante.

Le service worker et les notifications exigent un contexte sécurisé : `127.0.0.1`, `localhost` ou HTTPS. Sur un téléphone, passez par une prévisualisation déployée en HTTPS ou un tunnel HTTPS (une adresse `http://192.168.x.x` ne permet ni l'installation ni les notifications).

---

## 7. Tester sur un vrai téléphone Android / iOS

1. Connectez votre téléphone et votre ordinateur au **même réseau Wi-Fi**.
2. Lancez le serveur avec l'option `--host` :
   ```bash
   npm run dev -- --host
   ```
3. Relevez l'adresse `Network` affichée dans le terminal (ex. `http://192.168.1.42:3000`) et ouvrez-la dans Chrome Android ou Safari iOS.
4. Rendez-vous sur `/_dev` pour tester le rendu typographique à 360 px / 390 px, les animations à 60 fps et le retour haptique (`navigator.vibrate`).

---

## 8. Feuille de route des modules

- **M0 — Fondations** : socle technique, jetons Tailwind v4, Motion et GSAP, routeur, couche API, mocks MSW, stores, tests.
- **M1 — Accueil et design system**.
- **M2 — Catalogue** : exploration, recherche, fiche produit, favoris.
- **M3 — Panier et réservation** : connexion OTP, formulaire, blocage du stock 24 h.
- **M4 — Paiement** : Mobile Money, envoi de la preuve, écran Merci.
- **M5 — Suivi, photo du colis et profil**.
- **M6 — PWA, hors connexion et notifications** : installation, service worker, cache, hors connexion, Web Push, pastille.
- **M7 — Finitions** : pages légales, recette générale, mise en ligne.
