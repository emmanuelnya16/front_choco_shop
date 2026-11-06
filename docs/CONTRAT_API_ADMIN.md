# Contrat d’API de l’Administration (`/api/admin/*`) — DR Choco L’Incompris

> **Destinataires** : Équipe back-end Symfony & Équipe front-end PWA  
> **Modules couverts** : A1 (Socle & Tableau de bord), A2 (Réservations, Preuves Mobile Money & Colis), A3 (Catalogue, Stocks, Catégories & Looks), A4 (Paramètres, Livraison/Agences, Contenus & Clients)  
> **Types TypeScript de référence** : [`src/features/admin/types.ts`](file:///e:/projet_choco/dr-choco-lincompris/src/features/admin/types.ts) et [`src/types/domain.ts`](file:///e:/projet_choco/dr-choco-lincompris/src/types/domain.ts)

---

## 1. Conventions générales et sécurité (`SP-116`)

1. **Préfixe des routes** : toutes les routes d’administration sont préfixées par `/api/admin` sous `VITE_API_BASE_URL`.
2. **Isolation de la session** :
   - L’authentification admin est **strictement séparée** de la session client OTP SMS (`/auth/*`).
   - Le jeton d’accès JWT court (`15 min`) est transmis dans l’en-tête `Authorization: Bearer <accessToken>` et conservé uniquement en mémoire (`adminAuthStore`).
   - Le cookie de rafraîchissement (`httpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/admin/auth`) est envoyé avec `credentials: 'include'` sur `/api/admin/auth/refresh`.
3. **Interdiction absolue de mise en cache (`SP-061`, `SP-116`)** :
   - Toutes les réponses `/api/admin/*` doivent comporter l’en-tête HTTP :
     ```http
     Cache-Control: no-store, no-cache, must-revalidate, private
     ```
   - Le Service Worker de la PWA exclut explicitement `/api/admin/*` et `/admin/*` de tout cache Workbox (`src/pwa/cacheRules.ts`).
4. **Rôles administrateurs (`AdminRole`)** :
   - `owner` (Propriétaire) : accès intégral (A1 à A4).
   - `manager` (Gérant) : accès intégral aux opérations, au catalogue et aux paramètres courants.
   - `staff` (Équipe boutique / comptoir) : accès lecture/écriture sur le tableau de bord, les réservations, la validation des preuves, les photos de colis et l’ajustement rapide des stocks.
5. **Format d’erreur standard** :
   ```json
   {
     "code": "VALIDATION_ERROR",
     "message": "Message explicite en français destiné à l’opérateur.",
     "details": {}
   }
   ```

---

## 2. Module A1 — Authentification, Tableau de bord & Recherche rapide

| Méthode | Chemin | Rôle min. | Corps / Query | Réponse `200` | Codes d’erreur |
|---|---|---|---|---|---|
| `POST` | `/api/admin/auth/login` | Public | `{ identifier: string, password: string }` (`identifier` = e-mail ou téléphone `+237`) | `{ accessToken: string, admin: AdminUser }` + `Set-Cookie` refresh | `401 INVALID_CREDENTIALS`, `422 VALIDATION_ERROR`, `429 TOO_MANY_ATTEMPTS` (après 5 échecs) |
| `POST` | `/api/admin/auth/refresh` | Cookie | — (`credentials: 'include'`) | `{ accessToken: string, admin: AdminUser }` | `401 ADMIN_UNAUTHORIZED` |
| `POST` | `/api/admin/auth/logout` | Authentifié | — | `204 No Content` | — |
| `GET` | `/api/admin/dashboard` | `staff` | — | `AdminDashboardData` (`urgentCounts`, `actionQueue`, `kpisByPeriod` (`today`, `7d`, `30d`), `lowStockItems`, `serverTime`) | `401 ADMIN_UNAUTHORIZED` |
| `GET` | `/api/admin/search` | `staff` | `?q=<terme>` (min. 2 caractères) | `AdminSearchResponse` (`reservations` max 5, `products` max 5) | `401 ADMIN_UNAUTHORIZED` |

---

## 3. Module A2 — Réservations, Preuves Mobile Money & Photos du colis (`SP-108` à `SP-110`, `SP-112`)

| Méthode | Chemin | Rôle min. | Corps / Query | Réponse `200` | Effets de bord |
|---|---|---|---|---|---|
| `GET` | `/api/admin/reservations` | `staff` | `tab` (`all`, `to_validate`, `to_prepare`, `ready`, `in_delivery`, `attention`, `done`), `status`, `receptionMode`, `city`, `operator`, `q`, `page`, `pageSize` | `AdminReservationsListResponse` (`items`, `counts`, pagination) | Tri prioritaire : preuves en attente les plus anciennes d’abord |
| `GET` | `/api/admin/reservations/:ref` | `staff` | `:ref` (`RES-XXXXXX`) | `AdminReservationDetailResponse` (`reservation`, `duplicateProofRefs`, `internalNotes`, `availableAgencies`) | Vérifie si `reservation.proof.sha256` est déjà présent sur d’autres réservations (`duplicateProofRefs`) |
| `POST` | `/api/admin/reservations/:ref/validate-payment` | `staff` | `{ note?: string }` | `{ reservation }` | Passe à `confirmed`, ajoute l’entrée `timeline` (`actor: 'shop'`) et envoie la notification Web Push `payment_validated` |
| `POST` | `/api/admin/reservations/:ref/reject-payment` | `staff` | `{ reason: string }` (3 à 200 car. obligatoires) | `{ reservation }` | Passe à `payment_rejected`, remplit `rejection: { reason, rejectedAt }`, ajoute l’entrée `timeline` (`actor: 'shop'`) et envoie la notification `payment_rejected` |
| `POST` | `/api/admin/reservations/:ref/status` | `staff` | `{ status: ReservationStatusCode, note?: string, agencyId?: string }` | `{ reservation }` | Avance le statut (`preparing`, `in_delivery`, `delivered`, `picked_up`), met à jour `timeline` (`actor: 'shop'`) et déclenche le Web Push correspondant |
| `POST` | `/api/admin/reservations/:ref/package-ready` | `staff` | `{ photos: AdminPackagePhotoInput[], note?: string, agencyId?: string }` (1 à 3 photos) | `{ reservation }` | Stocke les photos dans le dossier privé Cloudinary, renseigne `packagePhotos` et `packageReadyAt`, passe à `ready_for_pickup` (Retrait) ou `handed_to_agency` (Livraison) et envoie la notification `package_ready` avec l’image signée |
| `POST` | `/api/admin/reservations/:ref/cancel` | `manager` | `{ reason: string }` | `{ reservation }` | Passe à `cancelled`, `cancellable: false`, `actor: 'shop'`, et **réincrémente immédiatement le stock** de chaque variante réservée |
| `POST` | `/api/admin/reservations/:ref/notes` | `staff` | `{ text: string }` | `{ note, internalNotes }` | Ajoute une note interne visible uniquement par l’équipe boutique |

---

## 4. Module A3 — Catalogue, Stocks, Variantes, Catégories & Looks (`SP-002` à `SP-005`, `SP-111`)

| Méthode | Chemin | Rôle min. | Corps / Query | Réponse | Détails |
|---|---|---|---|---|---|
| `GET` | `/api/admin/products` | `staff` | `q`, `category`, `stockStatus` (`all`, `in_stock`, `low_stock`, `out_of_stock`), `sort`, `page`, `pageSize` | `200 AdminProductsListResponse` | Inclut `summary` (`totalProducts`, `inStockProducts`, `lowStockProducts`, `outOfStockProducts`) |
| `GET` | `/api/admin/products/:id` | `staff` | `:id` (ID ou `slug`) | `200 { product: Product }` | — |
| `POST` | `/api/admin/products` | `manager` | `AdminUpsertProductPayload` | `201 { product: Product }` | Recalcule automatiquement `badges` (`new`, `low-stock`, `sold-out`) et `productCount` de la catégorie |
| `PATCH` | `/api/admin/products/:id` | `manager` | `Partial<AdminUpsertProductPayload>` | `200 { product: Product }` | Conserve la cohérence `mediaGallery` (`colorCode` par couleur, `SP-003`) et `sizeGuide` (`SP-004`) |
| `PATCH` | `/api/admin/products/:id/stock` | `staff` | `{ variants: Array<{ variantId: string, stock: number }> }` | `200 { product: Product }` | Ajustement rapide des stocks depuis la liste (`QuickStockSheet`), recalcule `badges` |
| `DELETE` | `/api/admin/products/:id` | `manager` | — | `204 No Content` | Retire l’article du catalogue et met à jour les compteurs de catégories |
| `GET` | `/api/admin/categories` | `staff` | — | `200 { categories: Category[] }` | — |
| `PATCH` | `/api/admin/categories/:id` | `manager` | `Partial<AdminUpdateCategoryPayload>` | `200 { category, categories }` | Met à jour `name`, `description`, `coverImage` et la liste `subCategories` |
| `GET` | `/api/admin/looks` | `staff` | — | `200 { looks: LookbookItem[] }` | — |
| `POST` | `/api/admin/looks` | `manager` | `AdminUpsertLookPayload` | `201 { look, looks }` | Associe une photo 4:5 et `productSlugs` (`SP-005`) |
| `PATCH` | `/api/admin/looks/:id` | `manager` | `Partial<AdminUpsertLookPayload>` | `200 { look, looks }` | — |
| `DELETE` | `/api/admin/looks/:id` | `manager` | — | `204 No Content` | Si `looks` devient vide, `LooksSection` se masque côté client (`SP-005`) |

---

## 5. Module A4 — Paramètres Mobile Money, Livraison/Agences, Contenus & Clients (`SP-012`, `SP-015` à `SP-019`, `SP-031` à `SP-034`, `SP-113`, `SP-114`)

| Méthode | Chemin | Rôle min. | Corps / Query | Réponse | Détails |
|---|---|---|---|---|---|
| `GET` | `/api/admin/settings` | `manager` | — | `200 { settings: PublicSettings }` | Réglages complets de la boutique |
| `PATCH` | `/api/admin/settings` | `owner` / `manager` | `AdminUpdateSettingsPayload` (`payment`, `whatsappNumber`, `reservationHoldHours`, `deliveryFeePayment`, `shop`, `pickupAddress`) | `200 { settings: PublicSettings }` | Valide qu’au moins un opérateur Mobile Money est actif (`422` sinon) et que `whatsappNumber` est au format `+2376XXXXXXXX`. Synchronise `GET /settings/public` |
| `GET` | `/api/admin/delivery/cities` | `staff` | — | `200 { cities: DeliveryCity[] }` | — |
| `POST` | `/api/admin/delivery/cities` | `manager` | `AdminUpsertCityPayload` | `201 { city, cities }` | — |
| `PATCH` | `/api/admin/delivery/cities/:id` | `manager` | `Partial<AdminUpsertCityPayload>` | `200 { city, cities }` | Répercute le nom de la ville sur ses agences rattachées |
| `DELETE` | `/api/admin/delivery/cities/:id` | `manager` | — | `204 No Content` | — |
| `GET` | `/api/admin/delivery/agencies` | `staff` | — | `200 { agencies: Agency[] }` | — |
| `POST` | `/api/admin/delivery/agencies` | `manager` | `AdminUpsertAgencyPayload` | `201 { agency, agencies }` | — |
| `PATCH` | `/api/admin/delivery/agencies/:id` | `manager` | `Partial<AdminUpsertAgencyPayload>` | `200 { agency, agencies }` | — |
| `DELETE` | `/api/admin/delivery/agencies/:id` | `manager` | — | `204 No Content` | — |
| `GET` | `/api/admin/pages` | `manager` | — | `200 AdminPagesListResponse` | Liste les 9 pages (`legal`, `help`, `questions-frequentes`) avec le nombre de balises `[À COMPLÉTER` restantes (`missingPlaceholdersCount`) |
| `GET` | `/api/admin/pages/:slug` | `manager` | `:slug` | `200 AdminContentPageDetail` | — |
| `PATCH` | `/api/admin/pages/:slug` | `manager` | `{ title: string, body: string }` | `200 AdminContentPageDetail` | Applique les règles typographiques françaises (`frenchSpacing`), met à jour `updatedAt` et alimente immédiatement `GET /pages/:slug` côté client |
| `GET` | `/api/admin/customers` | `staff` | `?q=<recherche>` | `200 AdminCustomersListResponse` | Répertoire des clients inscrits avec compteur de réservations, total confirmé en FCFA, adresses et historique |

