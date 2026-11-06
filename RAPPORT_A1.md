# Rapport de Livraison — Module A1 : Socle Admin, Authentification et Tableau de Bord

**Projet** : PWA DR Choco L’Incompris  
**Module** : A1 (`Soyez maîtres du comptoir` — `/admin/connexion`, `/admin`)  
**Statut** : Livré et vérifié

---

## 1. Périmètre livré

1. **Isolation technique et découpage (`assets/admin-*`)**
   - Tout le code de l’administration est confiné dans `src/features/admin/` et `src/pages/admin/`.
   - Le routeur principal (`src/app/router.tsx`) charge chaque écran `/admin/*` à la demande via `lazy: async () => import(...)`.
   - Aucun octet du code d’administration n’entre dans le chargement initial de la boutique cliente (`index.html`), et les chunks `assets/admin-*.js` restent exclus du précache Workbox (`globIgnores: ['assets/admin-*']` dans `vite.config.ts`).

2. **Authentification dédiée et session isolée (`/admin/connexion`)**
   - Store Zustand dédié `useAdminAuthStore` (`src/features/admin/auth/adminAuthStore.ts`), persisté sous la clé `drc_admin_user_v1` (sans jamais stocker `accessToken` dans `localStorage`), totalement indépendant de `useAuthStore` (`drc_user_v1`).
   - Client HTTP dédié `adminApi` (`src/features/admin/api/adminClient.ts`) avec en-tête `Authorization: Bearer <adminToken>`, rafraîchissement automatique sur `401` via `POST /api/admin/auth/refresh` (`credentials: 'include'`) et préservation de la session locale en cas de coupure réseau ou d’erreur `5xx`.
   - Garde de route `AdminAuthGuard` (`src/features/admin/auth/AdminAuthGuard.tsx`) avec fonction pure `sanitizeAdminRedirect()` permettant d’ouvrir directement un lien profond reçu sur WhatsApp (ex. `/admin/reservations/RES-000101`) après connexion.
   - Écran de connexion `/admin/connexion` (`src/pages/admin/AdminLoginPage.tsx`) validé par `react-hook-form` + `zod`, bouton Afficher/Masquer le mot de passe (`44 × 44 px`), messages d’erreur explicites (`401`, `429`, hors-ligne) et bouton de remplissage rapide en mode développement.

3. **Coquille responsive d’administration (`AdminLayout`) & Recherche rapide**
   - **Ordinateur (`lg+`)** : barre latérale fixe de `240 px` (`bg-ink text-white`) avec logo, badge `ADMIN`, 6 entrées de navigation (`Tableau de bord`, `Réservations` avec badge dynamique des urgences, `Catalogue` avec badge des ruptures, `Looks & Catégories`, `Contenus`, `Paramètres`), lien « Voir la boutique » et bloc utilisateur avec déconnexion.
   - **Mobile (`< lg`)** : barre supérieure compacte + barre d’onglets fixe en bas (`64 px`) à 4 entrées (`Accueil`, `Réservations`, `Catalogue`, `Plus` ouvrant une feuille `Sheet` avec le reste des sections et la déconnexion).
   - **Recherche globale (`AdminQuickSearch`)** : accessible par clic ou raccourci `Ctrl/Cmd + K`, interroge `GET /api/admin/search?q=` sur les réservations (référence `RES-...`, nom client, téléphone, ville) et les produits du catalogue.

4. **Tableau de bord opérationnel (`/admin`)**
   - **4 cartes d’action prioritaire** reliées aux files filtrées :
     - *Preuves à valider* (`pendingValidation` → `/admin/reservations?statut=pending_validation`)
     - *Colis à préparer* (`toPrepare` → `/admin/reservations?statut=confirmed`)
     - *Prêts à remettre* (`readyForHandover` → `/admin/reservations?statut=ready_for_pickup`)
     - *Expirent bientôt (< 3 h)* (`expiringSoon` → `/admin/reservations?statut=reserved`)
   - **File « À traiter maintenant »** : tableau sur ordinateur et cartes empilées sur mobile pour les 5 réservations les plus urgentes, avec bouton d’action directe « Traiter → » vers `/admin/reservations/:ref`.
   - **Indicateurs d’activité par période (`Aujourd’hui`, `7 derniers jours`, `30 derniers jours`)** : Chiffre d’affaires confirmé en FCFA, Réservations confirmées / créées + taux de transformation, Panier moyen, répartition Orange Money / MTN MoMo et Livraison / Retrait boutique.
   - **Alertes de stock** : liste des variantes en rupture (`stock === 0`) ou en stock critique (`stock <= 2`) avec lien direct « Ajuster → » vers `/admin/catalogue/:id`.

---

## 2. Contrat API Symfony consolidé pour A1 (SP-115, SP-116)

| Méthode & Endpoint | Rôle | Corps / Paramètres | Réponse `200` / Codes d’erreur |
|---|---|---|---|
| `POST /api/admin/auth/login` | Connexion d’un membre de l’équipe | `{ identifier: string, password: string }` | `200`: `{ accessToken, admin: { id, email, phone, name, role } }` + cookie `HttpOnly` de rafraîchissement (`30 j`). `401 INVALID_CREDENTIALS`, `429 TOO_MANY_ATTEMPTS`. |
| `POST /api/admin/auth/refresh` | Rafraîchissement silencieux | Cookie `HttpOnly` (`credentials: 'include'`) | `200`: `{ accessToken, admin }`. `401 NO_ADMIN_SESSION`. |
| `POST /api/admin/auth/logout` | Déconnexion | — | `204 No Content` (efface le cookie `HttpOnly`). |
| `GET /api/admin/dashboard` | Compteurs d’urgence, file d’attente, KPI par période et alertes de stock | En-tête `Authorization: Bearer <token>` | `200`: `AdminDashboardData` (`serverTime`, `counts`, `urgentReservations`, `kpis`, `lowStockItems`). |
| `GET /api/admin/search?q=` | Recherche transversale rapide | `?q=<texte>` (≥ 2 caractères) | `200`: `{ reservations: AdminReservationRow[], products: AdminSearchProductItem[] }`. |

### Comptes de démonstration configurés dans MSW (`src/mocks/adminHandlers.ts`)
- **Propriétaire (`owner`)** : `admin@drchoco.cm` ou `690 00 00 00` / mot de passe : `choco2026`
- **Gérant (`manager`)** : `manager@drchoco.cm` ou `690 00 00 10` / mot de passe : `choco2026`
- **Équipe boutique (`staff`)** : `vendeur@drchoco.cm` ou `690 00 00 20` / mot de passe : `choco2026`

