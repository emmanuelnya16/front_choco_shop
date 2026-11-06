# Plan et Prompts de l’Espace d’Administration (Modules A1 à A4) — DR Choco L’Incompris

> Ce document réunit le **plan d’architecture** et les **4 prompts complets (`A1` à `A4`)** de l’espace d’administration (`/admin`), rédigés dans le même format et avec les mêmes exigences de qualité que les modules clients `M0` à `M7`.

---

## Vue d’ensemble du découpage (A1 → A4)

| Module | Périmètre fonctionnel | Routes `/admin` | Points ouverts couverts (`SUIVI_POINTS_OUVERTS.md`) |
| --- | --- | --- | --- |
| **A1 — Socle admin, authentification et tableau de bord** | Authentification dédiée (`/api/admin/auth/*`), session isolée (`adminAuthStore`), coquille responsive (mobile gérant + ordinateur), recherche rapide, tableau de bord opérationnel avec compteurs d’urgence et statistiques | `/admin/connexion`, `/admin` | `SP-115`, `SP-116` |
| **A2 — Réservations, preuves Mobile Money et photos du colis** | File d’attente et liste filtrable des réservations, validation en 1 appui ou rejet motivé des captures Mobile Money, avancement du parcours selon le mode de réception, prise/ajout de 1 à 3 photos du colis prêt (caméra téléphone ou fichier), notifications push déclenchées | `/admin/reservations`, `/admin/reservations/:ref` | `SP-108`, `SP-109`, `SP-110`, `SP-112`, `SP-115` |
| **A3 — Catalogue, stocks, variantes, catégories et looks** | Liste produits et ajustement rapide des stocks, création/édition de produit, grille de variantes (tailles × couleurs), galerie photos rattachées par couleur (`colorCode`), guides des tailles, catégories/sous-catégories, looks « Portés par L’Incompris » | `/admin/catalogue`, `/admin/catalogue/nouveau`, `/admin/catalogue/:id`, `/admin/categories`, `/admin/looks` | `SP-002`, `SP-003`, `SP-004`, `SP-005`, `SP-111` |
| **A4 — Paramètres, livraison/agences, contenus et recette** | Configuration Orange Money & MTN MoMo (codes marchands, modèles USSD avec aperçu, QR codes, étapes, délai), villes et agences de transport, horaires/adresse boutique, éditeur Markdown des pages légales et d’aide, répertoire clients, contrat API admin et tests E2E | `/admin/parametres/paiement`, `/admin/parametres/livraison`, `/admin/parametres/boutique`, `/admin/contenus`, `/admin/clients` | `SP-012`, `SP-015` à `SP-017`, `SP-019`, `SP-031` à `SP-034`, `SP-113`, `SP-114` |

---

# PROMPT 1 — MODULE A1 « SOCLE ADMIN, AUTHENTIFICATION ET TABLEAU DE BORD »

```markdown
# PROMPT — MODULE A1 « SOCLE ADMIN, AUTHENTIFICATION ET TABLEAU DE BORD » — PWA DR CHOCO L'INCOMPRIS

> À coller dans ton agent de code, **dans le projet existant** (après M0 à M7).
> Langue de travail : français. Code et identifiants : anglais. Textes visibles : français.
> C'est le premier module de l'espace d'administration (`/admin`).

---

## 0. TON RÔLE ET L'OBJECTIF

Tu es un développeur front-end senior et un designer d'interface exigeant, spécialisé en outils de gestion e-commerce mobile et ordinateur, en React et en animation sobre (Motion).

La partie client (M0 à M7) est terminée. **Tu construis maintenant l'espace d'administration de la boutique DR Choco sous `/admin`.**
Particularité essentielle du terrain au Cameroun : **le gérant et les vendeurs utilisent l'administration à 70 % sur leur téléphone** (quand ils reçoivent un message WhatsApp avec un lien `/admin/reservations/RES-000124`, quand ils vérifient un SMS Mobile Money, ou quand ils prennent en photo un colis prêt sur le comptoir) et à **30 % sur ordinateur** (pour saisir le catalogue ou faire le point). L'interface `/admin` doit donc être **aussi rapide et irréprochable sur téléphone à 390 px que sur ordinateur à 1440 px**.

Dans ce module **A1**, tu livres :

1. **L'isolation technique stricte** : tout le code de l'administration vit dans `src/pages/admin/` et `src/features/admin/`. Grâce au découpage déjà prévu dans `vite.config.ts` (`assets/admin-[name]-[hash].js`), **pas un seul octet** du code admin ne doit entrer dans le chargement initial du client (`npm run check:size` reste < 180 kB gzip) ni dans le précache du service worker.
2. **L'authentification dédiée de l'administration** (`/admin/connexion`) : connexion par identifiant (adresse e-mail ou numéro de téléphone) + mot de passe, session séparée de la session client (`adminAuthStore` distinct de `authStore`), rafraîchissement via `/api/admin/auth/refresh`, rôles (`owner`, `manager`, `staff`), garde des routes `AdminAuthGuard` avec redirection vers la page demandée après connexion (indispensable quand le gérant clique sur un lien WhatsApp `/admin/reservations/RES-000124`).
3. **La coquille de l'administration (`AdminLayout`)** :
   - sur ordinateur (`lg` et plus) : barre latérale fixe à gauche (240 px, fond `ink`, texte blanc) avec les 6 entrées de navigation, badges de compteur sur « Réservations » (preuves à valider + colis à préparer), barre supérieure avec recherche rapide (`RES-…`, nom, téléphone), état réseau et profil connecté ;
   - sur mobile (sous `lg`) : en-tête compact + barre de navigation basse dédiée à 4 onglets (« Tableau de bord », « Réservations » avec badge rouge, « Catalogue », « Plus ») pour que le gérant travaille d'une seule main.
4. **Le tableau de bord opérationnel (`/admin`)** :
   - **File d'urgence en haut** : 4 cartes d'action immédiate (« Preuves à valider », « Colis à préparer », « Prêts pour retrait / agence », « Expirent sous 2 h ») qui mènent directement à la liste filtrée ;
   - **Liste rapide « À traiter maintenant »** : les réservations en attente de validation ou de préparation, avec aperçu direct et action rapide ;
   - **Indicateurs d'activité** (Aujourd'hui / 7 jours / 30 jours) : chiffre d'affaires validé (FCFA), réservations créées vs confirmées, panier moyen, répartition Orange Money / MTN MoMo, répartition Livraison / Retrait en boutique ;
   - **Alertes de stock** : variantes épuisées ou en stock faible (≤ 2 pièces).
5. **Le socle API et mocks de l'administration** (`/api/admin/*`) synchronisé en direct avec les données des mocks clients (quand l'admin modifie une réservation ou un produit dans un onglet, le client le voit dans l'autre onglet via `BroadcastChannel` et le stockage partagé des mocks).

---

## 1. AVANT DE CODER : LIS LE PROJET

Lis attentivement :

1. `docs/SUIVI_POINTS_OUVERTS.md` (notamment §10 « Administration A1–A4 », `SP-108` à `SP-116`), `docs/CONTRAT_API.md` (§2.10), `RAPPORT_M5.md` (§6), `RAPPORT_M6.md` (§1.3 et §4.9).
2. `vite.config.ts` (règle `chunkFileName` pour `/src/(pages|features)/admin/` et exclusion `assets/admin-*` du précache), `src/pwa/cacheRules.ts` (`isAdminUrl`), `public/robots.txt`, `public/.htaccess`.
3. `src/app/router.tsx`, `src/lib/api/client.ts`, `src/lib/api/endpoints.ts`, `src/lib/api/queryKeys.ts`.
4. `src/mocks/handlers.ts`, `src/mocks/fixtures/*`, `server/mock-api.ts`, `src/dev/ShopSimulatorM5.tsx`.
5. `src/styles/index.css` et `src/components/ui/*`.

**Contraintes impératives :**
- Tout fichier de l'administration est placé dans `src/pages/admin/` ou `src/features/admin/` pour que Vite le range automatiquement dans les morceaux `assets/admin-*`.
- Aucune couleur en dur hors `src/styles/index.css` ; respect strict des contrastes WCAG AA et des cibles tactiles de 44 × 44 px.
- Toutes les pages `/admin*` appellent `useSeo({ title: '... — Administration DR Choco', noindex: true })`.
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` et `npm run check:size` doivent passer sans erreur.

---

## 2. WORKFLOW OBLIGATOIRE

| Phase | Contenu | Sections |
| --- | --- | --- |
| P1 | Lecture du projet, vérification de l'isolation des chunks `admin-*`, plan écrit | 1 |
| P2 | Types admin, endpoints `/api/admin/*`, store `adminAuthStore`, mocks MSW + `server/mock-api.ts` | 3 |
| P3 | Écran de connexion `/admin/connexion`, garde `AdminAuthGuard`, redirection profonde | 4 |
| P4 | Coquille `AdminLayout` (ordinateur + mobile), recherche rapide globale | 5 |
| P5 | Tableau de bord `/admin` (compteurs d'urgence, file « À traiter », chiffres clés, alertes stock) | 6 |
| P6 | Pages cibles provisoires (`/admin/reservations`, `/admin/catalogue`, `/admin/parametres`, `/admin/contenus`) + tests unitaires/intégration + vérification du poids + `RAPPORT_A1.md` | 7, 8 |

À la fin de chaque phase : `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run check:size`, commit Conventional Commits, résumé de 3 à 5 lignes.

---

## 3. DONNÉES, AUTHENTIFICATION ET CONTRAT API (`/api/admin`)

### 3.1 Session d'administration séparée (`src/features/admin/auth/adminAuthStore.ts`)

- Le gérant peut tester la boutique en tant que client sur le même téléphone ou navigateur : **`adminAuthStore` est totalement indépendant de `authStore`**.
- Le jeton d'accès admin (`adminAccessToken`) est conservé **en mémoire uniquement** (jamais dans `localStorage`). Seul le profil admin (`AdminUser : { id, email, phone, name, role: 'owner' | 'manager' | 'staff' }`) est mémorisé dans `sessionStorage` ou `safeStorage` (clé `drc_admin_user_v1`) pour éviter un écran blanc au rechargement pendant que `POST /api/admin/auth/refresh` vérifie le cookie `httpOnly`.
- Crée un client ou une option dédiée dans `src/features/admin/api/adminClient.ts` (s'appuyant sur `src/lib/api/client.ts`) qui :
  - préfixe les appels par `/admin` (soit `/api/admin/...`) ;
  - injecte `Authorization: Bearer <adminAccessToken>` ;
  - sur un **401**, appelle `POST /api/admin/auth/refresh` (cookie `httpOnly` `drc_admin_refresh`) une seule fois puis rejoue la requête ; si le rafraîchissement échoue (401/403), vide `adminAuthStore` et redirige vers `/admin/connexion?redirect=<chemin_actuel>` ;
  - sur une erreur réseau ou 5xx pendant `/api/admin/auth/refresh`, conserve l'état connu et affiche le bandeau hors connexion sans déconnecter brutalement.

### 3.2 Endpoints du module A1

| Méthode | Chemin (`/api/admin/...`) | Détail |
| --- | --- | --- |
| POST | `/admin/auth/login` | `{ identifier, password }` → `{ accessToken, admin: { id, name, email, phone, role } }` ; 401 `INVALID_CREDENTIALS` (« Identifiant ou mot de passe incorrect. ») ; 429 `TOO_MANY_ATTEMPTS` (`retryAfter`) |
| POST | `/admin/auth/refresh` | Cookie `httpOnly` → `{ accessToken, admin }` ; 401 `NO_ADMIN_SESSION` |
| POST | `/admin/auth/logout` | 204, efface le cookie |
| GET | `/admin/dashboard` | Paramètre `period=today\|7d\|30d` (défaut `7d`) → `{ serverTime, counts: { pendingValidation, toPrepare, readyForHandover, expiringSoon, activeTotal, lowStockVariants, outOfStockVariants }, urgentReservations: AdminReservationRow[], kpis: { revenueConfirmed, reservationsCreated, reservationsConfirmed, conversionRate, averageBasket, byOperator: { orange, mtn }, byReception: { delivery, pickup } }, lowStockItems: Array<{ productId, slug, name, image, variantId, size, colorName, stock }> }` |
| GET | `/admin/search?q=` | Recherche rapide universelle (référence `RES-…`, téléphone, nom de client, nom d'article) → `{ reservations: AdminReservationRow[], products: Array<{ id, slug, name, image, price, totalStock }> }` |

### 3.3 Mocks (`src/features/admin/mocks/` ou `src/mocks/`)

- Compte de démonstration :
  - Identifiant : `admin@drchoco.cm` ou `690000000` (accepté avec ou sans `+237` / espaces) ;
  - Mot de passe : `choco2026` (tout autre mot de passe → 401 `INVALID_CREDENTIALS` ; 5 échecs → 429 pendant 5 min) ;
  - En développement (`import.meta.env.DEV`), ajoute sur `/admin/connexion` un bouton discret « Remplir le compte de démo » pour accélérer les tests.
- Les compteurs et la liste `urgentReservations` de `GET /api/admin/dashboard` sont **calculés dynamiquement à partir de la base de réservations et de produits des mocks existants** (`src/mocks/fixtures/reservations.ts` et `products.ts`). Ainsi, toute action faite dans l'app client ou dans `/_dev` se reflète immédiatement dans `/admin` !

---

## 4. ÉCRAN DE CONNEXION (`/admin/connexion`)

- Mise en page plein écran sobre sur fond `ink` (ordinateur : carte centrée de 420 px sur fond blanc, rayon `md` ; mobile : en-tête `ink` avec `Logo variant="light"` + badge « ADMINISTRATION », corps blanc).
- Champs :
  - « Adresse e-mail ou téléphone » (`autoComplete="username"`) ;
  - « Mot de passe » (`type="password"`, `autoComplete="current-password"`, bouton Afficher/Masquer le mot de passe de 44 × 44 px) ;
  - `Button primary lg` pleine largeur « Se connecter ».
- Validation par `react-hook-form` + `zod`.
- Gestion du paramètre `?redirect=` :
  - Si le gérant ouvre `/admin/reservations/RES-000101` depuis WhatsApp sans être connecté, `AdminAuthGuard` l'envoie sur `/admin/connexion?redirect=%2Fadmin%2Freservations%2FRES-000101`.
  - Dès la connexion réussie, il atterrit **directement** sur `/admin/reservations/RES-000101` (sécurité : vérifier que `redirect` commence par `/admin` et jamais par `//`).

---

## 5. COQUILLE DE L'ADMINISTRATION (`AdminLayout`)

### 5.1 Navigation et structure

| Entrée | Chemin | Icône Lucide | Badge |
| --- | --- | --- | --- |
| Tableau de bord | `/admin` (exact) | `LayoutDashboard` | — |
| Réservations | `/admin/reservations` | `ReceiptText` | Nombre de réservations demandant une action (`pendingValidation + toPrepare`), en `bg-red text-white` |
| Catalogue | `/admin/catalogue` | `Package` | Nombre de produits en rupture (`outOfStockVariants > 0` → point d'attention) |
| Looks & Catégories | `/admin/categories` | `Layers` | — |
| Contenus (Aide & Légal) | `/admin/contenus` | `FileText` | — |
| Paramètres | `/admin/parametres/paiement` | `Settings` | — |

### 5.2 Barre supérieure et recherche rapide (`Cmd/Ctrl + K` ou appui sur la loupe)

- Champ de recherche rapide accessible partout dans `/admin` :
  - Taper `102` ou `RES-000102` ou `690` ou `Hoodie` affiche instantanément les réservations et les articles correspondants.
  - Un appui ouvre la réservation (`/admin/reservations/:ref`) ou l'article (`/admin/catalogue/:id`).
- Bouton « Voir la boutique ↗ » (ouvre `/` dans un nouvel onglet).
- Indicateur « Hors connexion » si le réseau tombe : rappelle que l'administration nécessite une connexion active pour valider les paiements ou modifier les stocks.

---

## 6. TABLEAU DE BORD (`/admin`)

1. **En-tête** : « Bonjour, [Nom] », date du jour, sélecteur de période (« Aujourd'hui », « 7 derniers jours », « 30 derniers jours ») et bouton « Actualiser ».
2. **Bandeau des 4 compteurs d'action prioritaire** (grille 2 × 2 sur mobile, 4 colonnes sur ordinateur) :
   - **Preuves à valider** (`pending_validation`) : bordure/accent `warning` ou `red` si > 0 → clic mène à `/admin/reservations?statut=pending_validation` ;
   - **Colis à préparer** (`confirmed`, `preparing`) → `/admin/reservations?statut=a-preparer` ;
   - **Prêts à remettre** (`ready_for_pickup`, `handed_to_agency`) → `/admin/reservations?statut=prets` ;
   - **Expirent bientôt** (`reserved` dont `expiresAt` < 2 h) → `/admin/reservations?statut=expire-bientot`.
3. **Section « À traiter maintenant »** :
   - Tableau sur ordinateur / cartes compactes sur mobile des 5 réservations les plus urgentes (`pending_validation` d'abord, puis `confirmed`/`preparing`).
   - Affiche : référence `RES-…`, client (nom + téléphone cliquable), montant en FCFA (`tabular-nums`), mode de réception (ville ou Retrait en boutique), temps écoulé depuis l'envoi de la preuve, et bouton « Traiter → » vers `/admin/reservations/:ref`.
4. **Section « Activité sur la période »** :
   - 4 cartes : **Chiffre d'affaires confirmé** (`formatPrice`), **Réservations confirmées / créées** (avec taux de transformation en %), **Panier moyen**, **Répartition des paiements** (barre visuelle Orange Money vs MTN MoMo et Livraison vs Retrait).
5. **Section « Alertes de stock »** :
   - Liste des variantes à 0 (épuisées) ou ≤ 2 pièces, avec miniature, taille/couleur, stock restant et lien vers `/admin/catalogue/:id`.

---

## 7. CRITÈRES D'ACCEPTATION ET RAPPORT (`RAPPORT_A1.md`)

1. **Isolation vérifiée** : `npm run check:size` confirme que le bundle initial client n'a pas augmenté ; les fichiers compilés de l'admin commencent tous par `assets/admin-` et sont absents du précache Workbox.
2. **Connexion & garde** : `/admin` redirige vers `/admin/connexion` si non connecté ; après connexion, redirige vers l'URL `/admin/...` initialement demandée.
3. **Synchronisation temps réel** : les compteurs du tableau de bord reflètent les réservations réelles des mocks.
4. **Tests Vitest** (`src/test/admin-a1.test.tsx`) : connexion réussie/échouée, garde de route avec `?redirect=`, affichage des compteurs du tableau de bord, recherche rapide, isolation vis-à-vis de `authStore` client.
5. Rédige `RAPPORT_A1.md` à la racine du projet.
```

---

# PROMPT 2 — MODULE A2 « GESTION DES RÉSERVATIONS, VALIDATION DES PREUVES ET PHOTOS DU COLIS »

```markdown
# PROMPT — MODULE A2 « GESTION DES RÉSERVATIONS, VALIDATION DES PREUVES ET PHOTOS DU COLIS » — PWA DR CHOCO L'INCOMPRIS

> À coller dans ton agent de code, **dans le projet existant** (après A1).
> Langue de travail : français. Code et identifiants : anglais. Textes visibles : français.

---

## 0. TON RÔLE ET L'OBJECTIF

Tu es un développeur front-end senior chargé du cœur opérationnel quotidien de la boutique DR Choco : **le traitement des réservations, la vérification des preuves Mobile Money et l'envoi des photos du colis prêt** (`/admin/reservations` et `/admin/reservations/:ref`).

C'est l'interface que le gérant ouvre 30 fois par jour, souvent depuis le lien `https://<domaine>/admin/reservations/RES-000124` reçu sur WhatsApp quand un client vient d'envoyer sa capture de paiement.
Chaque action que le gérant fait ici pilote directement l'application client (M4, M5, M6) :
- **Valider une preuve** passe la réservation à `confirmed`, ajoute une entrée au journal (`timeline`) avec `actor: 'shop'`, et envoie la notification push `payment_validated` ;
- **Rejeter une preuve** demande un motif clair (ex. « Montant incorrect », « Capture illisible »), passe la réservation à `payment_rejected`, affiche ce motif exact au client, et envoie la notification `payment_rejected` ;
- **Déclarer le colis prêt** (`ready_for_pickup` ou `handed_to_agency`) permet de **prendre ou joindre 1 à 3 photos du colis emballé**, les compresse sur le téléphone du gérant, les enregistre en stockage privé et déclenche la notification `package_ready` avec la photo du colis (qui déclenchera l'animation de dévoilement M5 chez le client).

---

## 1. AVANT DE CODER : LIS LE PROJET

1. `RAPPORT_A1.md`, `RAPPORT_M4.md`, `RAPPORT_M5.md` (§6), `RAPPORT_M6.md` (§4), `docs/CONTRAT_API.md` (§10 et §14), `docs/SUIVI_POINTS_OUVERTS.md` (`SP-108`, `SP-109`, `SP-110`, `SP-112`, `SP-115`).
2. `src/types/reservationStatus.ts` (`STATUS_META`, `TIMELINE_ORDER`, `isFinalStatus`), `src/types/domain.ts` (`Reservation`, `PackagePhoto`, `ReservationTimelineEvent`).
3. `src/dev/ShopSimulatorM5.tsx` et `src/dev/devNotifications.ts` : toute la logique de transition et de notification déjà écrite pour le simulateur doit être reprise et enrichie proprement pour `/admin`.
4. `src/features/payment/proof/prepareProof.ts` : réutilise la compression d'image côté client (`canvas` max 1600 px, JPEG 0,82) pour les photos du colis prises par le gérant.

---

## 2. WORKFLOW OBLIGATOIRE

| Phase | Contenu | Sections |
| --- | --- | --- |
| P1 | Lecture du projet, plan écrit | 1 |
| P2 | Endpoints `/api/admin/reservations/*`, mocks et synchronisation `BroadcastChannel` + notifications push simulées | 3 |
| P3 | Liste des réservations `/admin/reservations` (onglets d'action, filtres, recherche, cartes mobile & tableau ordinateur) | 4 |
| P4 | Fiche détail `/admin/reservations/:ref` : vérification de la preuve Mobile Money (zoom, contrôle SHA-256, validation, rejet motivé) | 5 |
| P5 | Fiche détail : avancement du parcours, prise/envoi de 1 à 3 photos du colis prêt, choix de l'agence, remise finale, annulation boutique | 6 |
| P6 | Tests complets (`src/test/admin-a2.test.tsx`), vérification des budgets et `RAPPORT_A2.md` | 7 |

---

## 3. CONTRAT API (`/api/admin/reservations`)

| Méthode | Chemin (`/api/admin/...`) | Détail |
| --- | --- | --- |
| GET | `/admin/reservations` | Paramètres : `tab` (`all` \| `to_validate` \| `to_prepare` \| `ready` \| `in_delivery` \| `attention` \| `done`), `status`, `receptionMode` (`delivery` \| `pickup`), `city`, `operator` (`orange` \| `mtn`), `q` (référence, nom, téléphone), `page`, `pageSize` (20) → `{ items: AdminReservationRow[], page, pageSize, total, totalPages, counts: { all, toValidate, toPrepare, ready, inDelivery, attention, done } }` |
| GET | `/admin/reservations/:ref` | Détail complet `Reservation` + `{ duplicateProofRefs?: string[], internalNotes?: Array<{ id, author, text, createdAt }> }` |
| POST | `/admin/reservations/:ref/validate-payment` | `{ note? }` → passe de `pending_validation` (ou `reserved` / `payment_rejected` si paiement vérifié manuellement) à `confirmed`, ajoute l'événement `timeline` (`actor: 'shop'`), déclenche la notification `payment_validated`, renvoie `{ reservation }` |
| POST | `/admin/reservations/:ref/reject-payment` | `{ reason }` (obligatoire, 3 à 200 caractères) → passe à `payment_rejected`, remplit `rejection: { reason, rejectedAt }` et `rejectionReason`, ajoute l'entrée `timeline` (`actor: 'shop'`, `note: reason`), déclenche la notification `payment_rejected`, renvoie `{ reservation }` |
| POST | `/admin/reservations/:ref/status` | `{ status, note?, agencyId? }` → fait avancer la réservation vers l'étape choisie (`preparing`, `in_delivery`, `delivered`, `picked_up`), vérifie la cohérence avec `receptionMode`, ajoute l'entrée `timeline` (`actor: 'shop'`), déclenche la notification correspondante (`in_delivery`, `delivered`) |
| POST | `/admin/reservations/:ref/package-ready` | `multipart/form-data` (ou JSON en mock après préparation) : 1 à 3 fichiers images (`photos[]`), `note?`, `agencyId?` → enregistre les `PackagePhoto` (`id`, `url` signée, `thumbnailUrl` signée, `width`, `height`, `takenAt`), fixe `packageReadyAt`, passe le statut à `ready_for_pickup` (si `pickup`) ou `handed_to_agency` (si `delivery`), ajoute l'entrée `timeline` (`actor: 'shop'`), déclenche la notification `package_ready` avec la 1re photo |
| POST | `/admin/reservations/:ref/cancel` | `{ reason }` (obligatoire) → passe à `cancelled`, remet le stock des variantes en vente, ajoute l'entrée `timeline` (`actor: 'shop'`, `note: reason`), renvoie `{ reservation }` |
| POST | `/admin/reservations/:ref/notes` | `{ text }` → ajoute une note interne boutique (invisible pour le client) |

---

## 4. LISTE DES RÉSERVATIONS (`/admin/reservations`)

### 4.1 Onglets opérationnels rapides (avec compteurs en direct)

1. **À valider** (`pending_validation`) — badge prioritaire ;
2. **À préparer** (`confirmed`, `preparing`) ;
3. **Prêtes / Agence** (`ready_for_pickup`, `handed_to_agency`) ;
4. **En route** (`in_delivery`) ;
5. **À surveiller** (`reserved` en attente de paiement, `payment_rejected`) ;
6. **Terminées** (`delivered`, `picked_up`, `expired`, `cancelled`) ;
7. **Toutes**.

### 4.2 Filtres et recherche

- Barre de recherche instantanée : par référence (`RES-000102` ou `102`), nom du client, numéro de téléphone, quartier ou ville.
- Filtres rapides : Mode de réception (« Tout », « Livraison », « Retrait en boutique »), Opérateur (« Orange Money », « MTN MoMo »), Ville.
- Sur ordinateur : tableau dense et lisible (Référence, Date, Client + Téléphone, Mode & Ville, Articles, Montant, Opérateur + miniature preuve, Statut, Action rapide).
- Sur mobile : cartes opérationnelles avec référence, badge de statut, client, mode de réception, montant et bouton d'action principale en 1 appui.

---

## 5. FICHE DÉTAIL : VÉRIFICATION DE LA PREUVE (`/admin/reservations/:ref`)

Quand une réservation est au statut `pending_validation` (ou possède une `proof`) :

1. **Panneau « Vérification du paiement Mobile Money »** mis en avant en haut de page :
   - **À gauche / en haut** : grande prévisualisation de la capture envoyée par le client (`proof.thumbnailUrl`), clic pour ouvrir la visionneuse plein écran avec zoom, date et heure d'envoi ;
   - **À droite / en dessous** :
     - **Montant exact attendu** en très grand (`46 500 FCFA`, `tabular-nums`) pour le comparer d'un coup d'œil au montant visible sur la capture ;
     - **Opérateur déclaré** (Orange Money / MTN MoMo), **Numéro payeur** (`payerPhone`, avec bouton Copier / Appeler), **ID de transaction** (`transactionId`, avec bouton Copier) ;
     - **Contrôle d'unicité de la capture (`sha256`)** : affiche « Empreinte unique vérifiée ✓ » en vert, ou une alerte `danger` « Attention : cette capture a déjà été utilisée sur RES-… » si `duplicateProofRefs` n'est pas vide ;
   - **Actions de décision** :
     - `Button primary lg` **« Valider le paiement ✓ »** (passe immédiatement à `confirmed`, toast « Paiement validé · le client a été notifié ») ;
     - `Button outline lg` **« Rejeter la preuve… »** : ouvre une feuille ou un panneau avec **4 motifs rapides en 1 appui** (chips : `Montant incorrect`, `Capture illisible ou coupée`, `Transaction introuvable sur le compte marchand`, `Numéro ou destinataire erroné`) + champ libre modifiable, rappelant « Ce motif sera affiché tel quel au client et envoyé par notification », puis bouton `danger` « Confirmer le rejet ».

---

## 6. FICHE DÉTAIL : PRÉPARATION, PHOTOS DU COLIS ET REMISE

### 6.1 Poste d'action selon le statut actuel

Le haut de la fiche propose toujours **la prochaine étape logique** selon `TIMELINE_ORDER(reservation.receptionMode)` :

| Statut actuel | Action principale proposée à la boutique |
| --- | --- |
| `reserved` | « En attente du paiement client » (avec compte à rebours) + bouton « Relancer sur WhatsApp » (message prérempli) + option « Marquer payée manuellement » |
| `pending_validation` | Validation ou rejet de la preuve (§5) |
| `payment_rejected` | « En attente d'une nouvelle preuve » (affiche le motif envoyé) + bouton « Relancer sur WhatsApp » |
| `confirmed` | `Button primary` **« Démarrer la préparation »** → passe à `preparing` |
| `preparing` | **Bloc « Emballer et photographier le colis prêt »** (voir §6.2) → passe à `ready_for_pickup` (Retrait) ou `handed_to_agency` (Livraison) |
| `handed_to_agency` | Bouton **« Marquer en cours de livraison »** (`in_delivery`) ou **« Marquer livrée ✓ »** (`delivered`) |
| `in_delivery` | `Button primary` **« Confirmer la livraison au client ✓ »** (`delivered`) |
| `ready_for_pickup` | Affiche le **code de retrait (`RES-…`)** à vérifier au comptoir + `Button primary` **« Confirmer le retrait en boutique ✓ »** (`picked_up`) |

### 6.2 Prise et envoi des photos du colis prêt (1 à 3 photos, `SP-110`)

- Pour passer de `preparing` (ou `confirmed`) à `ready_for_pickup` / `handed_to_agency`, la boutique joint **1 à 3 photos du colis emballé** (vue d'ensemble, étiquette avec le nom et la référence, scellé) :
  - Sur téléphone : deux boutons clairs — **« Prendre une photo »** (`<input type="file" accept="image/*" capture="environment">`) et **« Choisir dans la galerie »** (`multiple`, sans `capture`) ;
  - Sur ordinateur : sélecteur de fichiers et glisser-déposer ;
  - En mode démonstration / test rapide : bouton discret « Utiliser des photos de colis de démonstration (1, 2 ou 3) » pour tester sans appareil photo ;
  - Chaque photo choisie est compressée côté client (max 1600 px, JPEG 0,82), prévisualisée en grille avec son poids en Ko, réordonnable ou supprimable avant l'envoi.
  - Si la réservation est en livraison interurbaine, le gérant peut confirmer ou modifier l'agence de transport choisie et ajouter une note (ex. numéro de bordereau ou contact chauffeur).
  - Le bouton **« Valider le colis prêt et notifier le client »** envoie les photos, met à jour `packagePhotos` et `packageReadyAt`, avance le statut et déclenche la notification push avec la photo !

### 6.3 Informations complètes, contact client et annulation

- **Liste de colisage (articles à préparer)** : miniature, nom, taille en grand badge lisible, pastille de couleur + nom de couleur, quantité, prix unitaire, cases à cocher locales d'aide au pointage pendant l'emballage.
- **Client & Réception** : nom complet, téléphone avec boutons **« Appeler »** (`tel:`) et **« WhatsApp »** (`https://wa.me/...` avec message prérempli adapté au statut), mode de réception, ville, quartier, point de repère ou agence, destinataire tiers s'il diffère.
- **Journal complet (`timeline`)** : chaque étape datée avec mention de l'auteur (`Client`, `Boutique`, `Système`) et la note associée (notamment le motif d'annulation choisi par le client, `SP-112`).
- **Notes internes boutique** : fil de notes privées entre membres de l'équipe.
- **Annulation côté boutique** : bouton « Annuler la réservation » (sauf si déjà livrée/retirée/annulée) ouvrant une feuille qui exige un motif (ex. « Article endommagé en stock », « Demande téléphonique du client »), rappelle si le client avait déjà payé (« Remboursement à effectuer »), remet le stock en vente et ajoute l'événement `actor: 'shop'`.

---

## 7. CRITÈRES D'ACCEPTATION ET RAPPORT (`RAPPORT_A2.md`)

1. Un lien direct `/admin/reservations/RES-000101` permet de vérifier la preuve, la valider ou la rejeter avec motif en moins de 10 secondes sur téléphone.
2. L'ajout de 1 à 3 photos du colis fonctionne de bout en bout et rend immédiatement visible le bloc « Votre colis est prêt » côté client (`/reservations/:ref`).
3. Toutes les actions mettent à jour la `timeline` avec `actor: 'shop'`, synchronisent les onglets et déclenchent les notifications en mode PWA.
4. Tests Vitest (`src/test/admin-a2.test.tsx`) : filtrage de la liste, validation de paiement, rejet avec motif obligatoire, ajout de photos du colis et passage à `ready_for_pickup` / `handed_to_agency`, annulation boutique et remise en stock.
5. Rédige `RAPPORT_A2.md`.
```

---

# PROMPT 3 — MODULE A3 « CATALOGUE, STOCKS, VARIANTES, CATÉGORIES ET LOOKS »

```markdown
# PROMPT — MODULE A3 « CATALOGUE, STOCKS, VARIANTES, CATÉGORIES ET LOOKS » — PWA DR CHOCO L'INCOMPRIS

> À coller dans ton agent de code, **dans le projet existant** (après A1 et A2).
> Langue de travail : français. Code et identifiants : anglais. Textes visibles : français.

---

## 0. TON RÔLE ET L'OBJECTIF

Tu es un développeur front-end senior chargé du module **A3 « Catalogue, stocks, variantes, catégories et looks »** (`/admin/catalogue`, `/admin/catalogue/nouveau`, `/admin/catalogue/:id`, `/admin/categories`, `/admin/looks`).

Ce module répond aux points `SP-002`, `SP-003`, `SP-004`, `SP-005` et `SP-111` :
- **Remplacer et gérer le catalogue** : créer, modifier ou archiver un article (vêtements, chaussures, babouches), gérer son prix en FCFA, sa description, sa composition et son entretien ;
- **Gérer les couleurs et les photos par couleur (`SP-003`)** : chaque photo de `mediaGallery` peut être rattachée à une couleur (`colorCode`) pour que la fiche produit côté client affiche la photo de la couleur choisie ;
- **Gérer la grille des variantes et le stock en temps réel** : tailles × couleurs, avec un mode **« Ajustement rapide des stocks »** depuis la liste pour que le gérant puisse mettre à jour son stock en boutique en quelques secondes sur son téléphone ;
- **Gérer les guides des tailles (`SP-004`)**, les **catégories et sous-catégories**, et les **looks « Portés par L'Incompris » (`SP-005`)** (y compris masquer automatiquement la section sur l'accueil si aucun look n'est actif).

---

## 1. AVANT DE CODER : LIS LE PROJET

1. `RAPPORT_A1.md`, `RAPPORT_A2.md`, `RAPPORT_M1.md`, `RAPPORT_M2.md`, `docs/SUIVI_POINTS_OUVERTS.md` (`SP-002` à `SP-005`, `SP-111`).
2. `src/types/domain.ts` (`Product`, `ProductColor`, `ProductVariant`, `ProductImageEntry`, `SizeGuideTable`, `Category`, `SubCategory`, `LookbookItem`).
3. `src/mocks/fixtures/products.ts`, `categories.ts`, `looks.ts`.
4. `src/pages/ProductPage.tsx`, `src/features/catalog/product/SizeGuideSheet.tsx`, `src/features/catalog/home/LooksSection.tsx`.

---

## 2. WORKFLOW OBLIGATOIRE

| Phase | Contenu | Sections |
| --- | --- | --- |
| P1 | Lecture du projet, plan écrit | 1 |
| P2 | Endpoints `/api/admin/products/*`, `/categories/*`, `/looks/*` + mocks synchronisés avec le catalogue public | 3 |
| P3 | Liste du catalogue `/admin/catalogue` + tiroir/feuille d'ajustement rapide des stocks par variante | 4 |
| P4 | Formulaire complet de produit (`/admin/catalogue/nouveau` et `/admin/catalogue/:id`) : infos, couleurs, galerie par couleur, matrice des tailles/stocks, guide des tailles | 5 |
| P5 | Gestion des catégories & sous-catégories (`/admin/categories`) et des looks (`/admin/looks`) | 6 |
| P6 | Tests (`src/test/admin-a3.test.tsx`), vérification de l'impact immédiat côté vitrine/catalogue client et `RAPPORT_A3.md` | 7 |

---

## 3. CONTRAT API (`/api/admin/products`, `/categories`, `/looks`)

| Méthode | Chemin (`/api/admin/...`) | Détail |
| --- | --- | --- |
| GET | `/admin/products` | Paramètres : `q`, `category`, `stockStatus` (`all` \| `in_stock` \| `low_stock` \| `out_of_stock`), `sort`, `page`, `pageSize` → liste paginée de produits avec le stock total et le détail des variantes |
| POST | `/admin/products` | Création d'un produit complet (`Product`) → recalcule automatiquement `badges` (`new`, `low-stock`, `sold-out`) et met à jour `productCount` de la catégorie |
| PATCH | `/admin/products/:id` | Mise à jour partielle ou complète d'un produit |
| PATCH | `/admin/products/:id/stock` | `{ variants: Array<{ variantId, stock }> }` → mise à jour ultra-rapide des stocks d'un produit et recalcul immédiat de ses badges |
| DELETE | `/admin/products/:id` | Suppression / retrait de la vente (204) |
| GET / PATCH | `/admin/categories`, `/admin/categories/:id` | Modification des catégories et sous-catégories (nom, description, image de couverture, sous-catégories) |
| GET / POST / PATCH / DELETE | `/admin/looks`, `/admin/looks/:id` | Création, édition, réordonnancement et suppression des looks (`title`, `subtitle`, `image`, `productSlugs`, `enabled`) |

---

## 4. LISTE DU CATALOGUE ET STOCK RAPIDE (`/admin/catalogue`)

1. **Barre d'outils** : recherche par nom ou slug, filtre par catégorie (`Vêtements`, `Chaussures`, `Babouches`), filtre par état de stock (`Tous`, `En stock`, `Stock faible ≤ 3`, `Épuisé`), bouton `Button primary` « + Nouvel article ».
2. **Ligne / Carte d'article** :
   - Miniature 4:5, nom, catégorie/sous-catégorie, prix (`45 000 FCFA`), badges (`Nouveau`, `Plus que 2`, `Épuisé`) ;
   - Résumé visuel des variantes : pastilles de couleur et pilules de taille avec leur stock (`S: 2`, `M: 0`, `L: 4`) ;
   - Bouton **« Stock rapide »** : ouvre une feuille (mobile) ou un tiroir/pop-up (ordinateur) listant chaque variante (`Couleur · Taille`) avec des boutons `−` / `+` et saisie directe du stock, bouton « Enregistrer les stocks » en 1 appui ;
   - Bouton **« Modifier »** → `/admin/catalogue/:id` et lien « Voir en boutique ↗ » → `/produit/:slug`.

---

## 5. ÉDITEUR DE PRODUIT (`/admin/catalogue/nouveau` et `/admin/catalogue/:id`)

Organisé en 5 sections claires (avec aperçu de la carte produit en direct sur ordinateur) :

1. **Informations générales** :
   - Nom de l'article (génère automatiquement le `slug` modifiable, ex. `babouche-sultan-cuir-noir`) ;
   - Catégorie (`vetements`, `chaussures`, `babouches`) et Sous-catégorie dépendante ;
   - Prix en FCFA (entier, avec aperçu formaté `28 000 FCFA`) ;
   - Case « Mettre en avant comme Nouveauté (`isNew`) » ;
   - Description commerciale, Composition / matières (`composition`), Instructions d'entretien (`careInstructions`, liste de lignes).
2. **Couleurs (`colors`)** :
   - Ajout/modification de couleurs : nom (ex. `Noir Charbon`), code (`noir`), sélecteur de teinte + code hexadécimal (`#1A1A18`) avec préréglages des teintes fréquentes DR Choco (Noir, Blanc Cassé, Terre de Sienne, Bordeaux, Olive, Fauve, Chocolat).
3. **Galerie photos et rattachement aux couleurs (`mediaGallery`, `SP-003`)** :
   - Ajout de photos (téléversement simulé/Cloudinary avec compression ou URL, ratio 4:5 prévisualisé) ;
   - Pour chaque photo : sélecteur **« Couleur associée »** (`Toutes les couleurs` ou une couleur précise `colorCode` du produit), texte alternatif (`alt`), boutons pour définir comme photo principale, réordonner ou supprimer ;
   - Avertissement doux si une couleur déclarée n'a aucune photo associée.
4. **Tailles et matrice des stocks (`sizes` et `variants`)** :
   - Boutons de présélection rapide des tailles selon la catégorie :
     - Vêtements : `S, M, L, XL, XXL` ;
     - Chaussures / Babouches : `39, 40, 41, 42, 43, 44, 45` ;
     - Accessoires : `Taille unique` ;
   - Grille croisée **Couleurs × Tailles** : chaque cellule contient le stock de la variante (`variantId: {id}-{colorCode}-{size}`), avec un bouton « Mettre toute la ligne à… » pour gagner du temps.
5. **Guide des tailles (`sizeGuide`, `SP-004`)** :
   - Choix d'un modèle prédéfini (`Vêtements en cm`, `Pointures Chaussures & Babouches`, `Taille unique`) ou personnalisation du titre, du conseil (`tip`, ex. « Prenez une pointure au-dessus si vous avez le cou-de-pied fort ») et des lignes du tableau.

---

## 6. CATÉGORIES (`/admin/categories`) ET LOOKS (`/admin/looks`)

### 6.1 Catégories et sous-catégories (`/admin/categories`)
- Édition des 3 univers (`Vêtements`, `Chaussures`, `Babouches`) : titre, description courte, visuel de couverture (`coverImage`), et gestion de leurs sous-catégories (`T-shirts`, `Hoodies`, `Pantalons`…).

### 6.2 Looks « Portés par L'Incompris » (`/admin/looks`, `SP-005`)
- Liste des looks avec aperçu 4:5, titre, sous-titre et nombre d'articles associés.
- Création / modification d'un look : photo 4:5, titre, sous-titre, **sélecteur visuel des articles portés** (`productSlugs`, recherche et coche des produits du catalogue).
- Si la liste des looks est vide, la section « Portés par L'Incompris » de la page d'accueil client (`LooksSection.tsx`) se masque proprement sans laisser d'espace vide (vérifie et ajuste `LooksSection.tsx` si nécessaire).

---

## 7. CRITÈRES D'ACCEPTATION ET RAPPORT (`RAPPORT_A3.md`)

1. Un article créé ou modifié dans `/admin/catalogue` apparaît immédiatement dans `/explorer` et sur sa fiche `/produit/:slug` avec ses couleurs, ses photos par couleur et ses stocks par taille.
2. Mettre le stock d'une variante à `0` via « Stock rapide » la grise aussitôt sur la fiche produit client et bloque sa réservation dans `/cart/validate`.
3. Tests Vitest (`src/test/admin-a3.test.tsx`) : ajustement rapide du stock, création d'un produit avec variantes et photos par couleur, édition d'un look, masquage de la section looks quand la liste est vide.
4. Rédige `RAPPORT_A3.md`.
```

---

# PROMPT 4 — MODULE A4 « PARAMÈTRES, LIVRAISON, CONTENUS, CLIENTS ET RECETTE FINALE »

```markdown
# PROMPT — MODULE A4 « PARAMÈTRES, LIVRAISON, CONTENUS, CLIENTS ET RECETTE FINALE » — PWA DR CHOCO L'INCOMPRIS

> À coller dans ton agent de code, **dans le projet existant** (après A1, A2 et A3).
> Langue de travail : français. Code et identifiants : anglais. Textes visibles : français.
> C'est le dernier module de l'administration et du projet.

---

## 0. TON RÔLE ET L'OBJECTIF

Tu es un développeur front-end senior chargé de finaliser l'espace d'administration (`/admin`) et de livrer la recette complète client + administration.

Dans les rapports M3 à M7 et `docs/SUIVI_POINTS_OUVERTS.md`, plusieurs réglages critiques ont été conçus pour être administrables par la boutique sans redéployer l'application :
1. **Paramètres Mobile Money et réservation (`/admin/parametres/paiement`, `SP-015` à `SP-019`, `SP-114`)** : codes marchands Orange Money et MTN MoMo, formule du code USSD avec **aperçu interactif en direct**, QR codes officiels, instructions pas à pas, délai de validation affiché au client, durée de blocage du stock (24 h), mode de paiement des frais de livraison (d'avance ou à la réception).
2. **Villes de livraison et agences de transport (`/admin/parametres/livraison`, `SP-031`, `SP-032`, `SP-113`)** : tarifs et délais par ville, distinction livraison locale vs interurbaine par agence, et répertoire des agences de transport (nom, adresse, horaires, téléphone).
3. **Boutique & Contact (`/admin/parametres/boutique`, `SP-033`, `SP-034`, `SP-001`)** : adresse du Retrait en boutique, quartier, point de repère, horaires d'ouverture, lien Google Maps, numéro WhatsApp officiel.
4. **Éditeur des pages légales et du centre d'aide (`/admin/contenus`, `SP-012`, `SP-013`, M7 §3)** : édition en Markdown avec **aperçu en direct côte à côte** (utilisant le même moteur `parseMarkdown` que l'app client) des 4 pages légales, des 4 guides d'aide et de la FAQ (`questions-frequentes`), avec un compteur des passages `[À COMPLÉTER]` restants.
5. **Répertoire des clients (`/admin/clients`)** : liste des clients inscrits, recherche par nom ou numéro `+237`, historique de leurs réservations et adresses.
6. **Documentation finale (`docs/CONTRAT_API_ADMIN.md`), mise à jour de `docs/SUIVI_POINTS_OUVERTS.md`, tests E2E Playwright et `RAPPORT_A4.md`**.

---

## 1. AVANT DE CODER : LIS LE PROJET

1. `RAPPORT_A1.md` à `RAPPORT_A3.md`, `docs/SUIVI_POINTS_OUVERTS.md`, `docs/CONTRAT_API.md`.
2. `src/types/domain.ts` (`PublicSettings`, `PaymentSettings`, `PaymentOperatorConfig`, `DeliveryCity`, `Agency`), `src/mocks/fixtures/settings.ts`, `src/mocks/fixtures/pages.ts`.
3. `src/features/payment/utils/ussd.ts` (`buildUssdCode`), `src/lib/markdown/parseMarkdown.ts`, `src/pages/ContentPage.tsx`, `src/pages/HelpCenterPage.tsx`.

---

## 2. WORKFLOW OBLIGATOIRE

| Phase | Contenu | Sections |
| --- | --- | --- |
| P1 | Lecture du projet, plan écrit | 1 |
| P2 | Endpoints `/api/admin/settings/*`, `/delivery/*`, `/pages/*`, `/customers/*` + mocks reliés aux réglages publics | 3 |
| P3 | Paramètres Mobile Money, réservation et boutique (`/admin/parametres/paiement`, `/admin/parametres/boutique`) | 4 |
| P4 | Villes de livraison et agences de transport (`/admin/parametres/livraison`) | 5 |
| P5 | Éditeur Markdown des pages légales, guides d'aide et FAQ (`/admin/contenus`) + Répertoire clients (`/admin/clients`) | 6, 7 |
| P6 | Tests Vitest (`src/test/admin-a4.test.tsx`), parcours Playwright client ↔ admin, `docs/CONTRAT_API_ADMIN.md`, mise à jour de `docs/SUIVI_POINTS_OUVERTS.md` et `RAPPORT_A4.md` | 8 |

---

## 3. CONTRAT API (`/api/admin/settings`, `/delivery`, `/pages`, `/customers`)

| Méthode | Chemin (`/api/admin/...`) | Détail |
| --- | --- | --- |
| GET / PATCH | `/admin/settings` | Lecture et modification de `PublicSettings` (`payment`, `shop`, `pickupAddress`, `whatsappNumber`, `reservationHoldHours`, `deliveryFeePayment`) → invalide et met à jour `GET /settings/public` côté client |
| GET / POST / PATCH / DELETE | `/admin/delivery/cities`, `/admin/delivery/cities/:id` | Gestion des villes desservies (`name`, `fee`, `isLocal`, `hasAgencies`, `estimatedDelay`) |
| GET / POST / PATCH / DELETE | `/admin/delivery/agencies`, `/admin/delivery/agencies/:id` | Gestion des agences (`cityId`, `city`, `name`, `address`, `phone`, `openingHours`) |
| GET | `/admin/pages` | Liste de toutes les pages de contenu (`legal` + `help` + `questions-frequentes`) avec `slug`, `title`, `updatedAt`, et le nombre de balises `[À COMPLÉTER` restantes dans `body` |
| GET / PATCH | `/admin/pages/:slug` | `{ title, body }` → met à jour la page Markdown et la date `updatedAt`, immédiatement visible sur `/pages/:slug` et `/aide/:slug` |
| GET | `/admin/customers` | Paramètres `q`, `page` → liste des clients avec nombre de réservations, total dépensé confirmé, date de dernière réservation et détail de leurs réservations |

---

## 4. PARAMÈTRES MOBILE MONEY ET BOUTIQUE (`/admin/parametres/*`)

Sous-navigation par onglets dans `/admin/parametres` : **Paiement Mobile Money** · **Livraison & Agences** · **Boutique & WhatsApp**.

### 4.1 Paiement Mobile Money (`/admin/parametres/paiement`, `SP-015`, `SP-016`, `SP-017`, `SP-019`, `SP-114`)

1. **Cartes par opérateur (`Orange Money` et `MTN MoMo`)** :
   - Interrupteur « Activer cet opérateur » (`enabled` — au moins un opérateur doit rester actif) ;
   - « Nom officiel du compte marchand » (`merchantName`, ex. `ETS DR CHOCO LINCOMPRIS`) ;
   - « Code marchand » (`merchantCode`, ex. `654321`) ;
   - « Formule du code USSD » (`ussdTemplate`, ex. `#150*47*{code}*{amount}#`) :
     - Vérifie que `{code}` et `{amount}` sont présents si le champ est renseigné ;
     - **Aperçu en direct** sous le champ : affiche le code exact que verra un client pour un panier de `45 000 FCFA` grâce à `buildUssdCode` (ex. `#150*47*654321*45000#`) ;
   - « Image du QR code marchand » (`qrImageUrl`, aperçu 160 × 160 px + remplacement d'image) ;
   - « Instructions étape par étape » (`steps`, liste modifiable : ajouter, modifier, réordonner ou supprimer une étape).
2. **Règles de réservation et de validation** :
   - « Texte du délai de validation » (`validationDelayText`, ex. `en général en moins d'une heure, de 8 h à 20 h`) ;
   - « Durée de mise de côté du stock » (`reservationHoldHours`, en heures, défaut `24`) ;
   - « Règlement des frais de livraison » (`deliveryFeePayment` : `upfront` « Payés avec la réservation Mobile Money » ou `on_delivery` « Payés à la réception du colis ») ;
   - « Poids maximal d'une capture » (`proofMaxSizeMb`, défaut `10` Mo).

### 4.2 Boutique & WhatsApp (`/admin/parametres/boutique`, `SP-033`, `SP-034`)

- Nom de la boutique, Ville, Quartier (`quarter`), Adresse complète, Point de repère (`landmark`), Horaires d'ouverture (`openingHours`), Lien Google Maps (`mapsUrl`), Numéro WhatsApp officiel au format `+237 6XX XX XX XX` (validé avec `isValidCmPhone`).
- Quand ces champs sont enregistrés, `shop` et `pickupAddress` de `PublicSettings` sont synchronisés pour que le pied de page, la fiche produit, le formulaire de réservation et le détail de retrait affichent tous les mêmes informations.

---

## 5. VILLES DE LIVRAISON ET AGENCES (`/admin/parametres/livraison`, `SP-031`, `SP-032`, `SP-113`)

1. **Liste des villes desservies** :
   - Tableau / cartes : Nom de la ville, Type (« Livraison locale à domicile » ou « Expédition par agence »), Tarif en FCFA (`1 500 FCFA`), Délai estimé (« Aujourd'hui ou demain », « 24 à 48 h »), Nombre d'agences configurées, boutons Modifier / Supprimer + bouton « + Ajouter une ville ».
2. **Gestion des agences de transport par ville** :
   - En cliquant sur une ville (ou dans la section Agences filtrée par ville) : liste des agences avec Nom, Adresse, Horaires, Téléphone ;
   - Feuille de création / modification d'agence (`name`, `cityId`, `address`, `phone`, `openingHours`).

---

## 6. ÉDITEUR DES PAGES LÉGALES ET D'AIDE (`/admin/contenus`, `SP-012`, `SP-013`)

1. **Liste des 9 contenus** regroupés en deux sections :
   - **Pages d'aide & FAQ** : `questions-frequentes` (FAQ du centre d'aide `/aide`), `comment-reserver`, `paiement-mobile-money`, `livraison-retrait`, `suivre-ma-reservation` ;
   - **Pages légales** : `conditions-generales`, `annulation-retours`, `confidentialite`, `mentions-legales`.
   - Chaque ligne affiche le titre, la date de dernière mise à jour, un lien « Voir sur le site ↗ » et un badge d'alerte `warning` s'il reste des mentions `[À COMPLÉTER` dans le texte (ex. « 3 passages à compléter ») ou un badge `success` « Prêt ✓ ».
2. **Éditeur Markdown avec aperçu en direct** :
   - Sur ordinateur : 2 colonnes côte à côte (à gauche : titre + zone de saisie Markdown avec barre d'insertion rapide Titre H2, Titre H3, Gras, Liste, Lien ; à droite : **aperçu fidèle** rendu avec `parseMarkdown` et pour `questions-frequentes` avec `splitFaq`) ;
   - Sur mobile : deux onglets « Écrire » / « Aperçu » ;
   - Bandeau d'aide listant les passages `[À COMPLÉTER...]` détectés dans la page ouverte : cliquer sur l'un d'eux sélectionne le passage dans l'éditeur pour le remplacer facilement.

---

## 7. RÉPERTOIRE DES CLIENTS (`/admin/clients`)

- Liste des clients connus (issus des réservations et comptes des mocks) : Nom, Téléphone formaté (`+237 6 90 00 00 01`), Ville, Nombre de réservations, Total confirmé en FCFA, Date de dernière activité.
- Un clic sur un client ouvre sa fiche récapitulative : coordonnées, adresses enregistrées, historique de ses réservations avec lien direct vers `/admin/reservations/:ref` et bouton WhatsApp.

---

## 8. DOCUMENTATION, RECETTE FINALE ET RAPPORT (`RAPPORT_A4.md`)

1. **Contrat d'API de l'administration (`docs/CONTRAT_API_ADMIN.md`)** : documente sur le modèle de `docs/CONTRAT_API.md` l'ensemble des endpoints `/api/admin/*` des modules A1 à A4 (méthode, chemin, rôle requis, corps, réponse, codes d'erreur, en-tête `Cache-Control: no-store`) pour l'équipe Symfony.
2. **Mise à jour de `docs/SUIVI_POINTS_OUVERTS.md`** : passe à « Résolu » côté front les points `SP-108` à `SP-116`.
3. **Tests unitaires et d'intégration (`src/test/admin-a4.test.tsx`)** :
   - Modification d'un code marchand / USSD dans `/admin/parametres/paiement` et vérification que `GET /settings/public` et l'écran de paiement client reflètent le nouveau code ;
   - Ajout/modification d'une ville et d'une agence ;
   - Modification d'une page légale dans `/admin/contenus`, diminution du compteur `[À COMPLÉTER]` et vérification du rendu sur `/pages/:slug`.
4. **Contrôle final global** :
   - `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` et `npm run check:size` (bundle initial client toujours < 180 kB gzip, aucun fichier `admin-*` dans le précache).
5. Rédige `RAPPORT_A4.md` récapitulant l'ensemble des modules A1 à A4.
```

