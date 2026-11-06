# Contrat d’API — DR Choco L’Incompris (application client)

> Version 1.0 du 31 octobre 2026, module M7 « Finitions, recette et mise en ligne » (phase P8).
> Destinataires : équipe back-end (Symfony), équipe front (application), recette.
> Sources : `src/lib/api/endpoints.ts`, `src/lib/api/client.ts`, `src/lib/api/contract.ts` et `src/lib/api/schemas/`, tous les appels à l’API de `src/` (hors tests), `src/types/`, `src/mocks/handlers.ts` et `src/mocks/fixtures/`, `src/pwa/`, `src/sw.ts`, `src/lib/monitoring.ts`, et les sections « Pour l’équipe back-end » de `RAPPORT_M0.md` à `RAPPORT_M6.md`.
> Document compagnon : `docs/INTEGRATION_API.md` (liste de vérification et bascule des mocks vers l’API réelle).

## Sommaire

1. Introduction
2. Exigences transverses
3. Tableau récapitulatif des endpoints
4. Authentification
5. Profil, adresses et favoris
6. Catalogue (catégories, produits, recherche, looks)
7. Paramètres publics
8. Livraison (villes, agences)
9. Panier
10. Réservations
11. Notifications push
12. Contenus (pages légales et d’aide)
13. Erreurs client
14. Statuts de réservation
15. Routes réservées aux mocks (non à implémenter)
16. Endpoints prévus mais non appelés
17. Questions ouvertes pour le back-end
- Annexe A : modèles de données

---

## 1. Introduction

### 1.1 Rôle du document

- Ce document décrit **tout ce que l’application client attend de l’API** : chaque endpoint appelé, ses paramètres, ses réponses, ses erreurs et le message que voit le client.
- Il sert de référence commune pour développer l’API Symfony, la tester et brancher l’application dessus.
- Le **comportement de référence** est celui des mocks (`src/mocks/handlers.ts`), déjà utilisé par toute l’application et ses tests. En cas de doute, ce document l’emporte sur les mocks ; un écart entre les deux est un défaut à signaler (voir `docs/INTEGRATION_API.md` §10).
- Les points non tranchés sont marqués **HYPOTHÈSE** (comme les commentaires `// HYPOTHÈSE:` du code) et repris au §17.
- L’administration (`/api/admin`, écrans `/admin`) n’est pas décrite ici : elle relève des modules d’administration. Seules ses contraintes vis-à-vis de l’application client figurent au §2.10.

### 1.2 Base des URL et versionnement

- Toutes les routes sont relatives à la variable `VITE_API_BASE_URL` du front. Valeur cible : **`/api`** (même domaine que l’application, voir §2.1). Exemple : `GET /products` est appelé sur `https://<domaine>/api/products`.
- Dans ce document, les chemins sont écrits **sans** le préfixe `/api`. Les exemples utilisent le domaine provisoire `drchoco.com` (HYPOTHÈSE : domaine définitif inconnu au 31/10/2026, voir `public/robots.txt`).
- **Versionnement** :
  - Pas de numéro de version dans les chemins pour la première version : `/api/…`. Les anciens rapports citent parfois `/api/v1/…` (RAPPORT_M3 §4, RAPPORT_M4 §5) : c’est la même route. Si l’équipe back-end préfère `/api/v1`, il suffit de régler `VITE_API_BASE_URL=/api/v1` ; aucun chemin du front ne change.
  - Évolutions compatibles (sans nouvelle version) : ajout d’un champ dans une réponse, ajout d’un paramètre facultatif, ajout d’un code d’erreur sur un statut HTTP déjà prévu. Le front ignore les champs inconnus.
  - Évolutions incompatibles (nouvelle version `/api/v2`, ancienne gardée le temps de la mise à jour des téléphones) : champ retiré ou renommé, type changé, champ facultatif devenu obligatoire dans une requête, sens d’un statut changé. Une PWA installée peut garder une ancienne version quelques jours : prévoir au moins **14 jours** de recouvrement (HYPOTHÈSE).

### 1.3 Conventions

| Sujet | Règle |
| --- | --- |
| Format | JSON UTF-8, `Content-Type: application/json` dans les deux sens, sauf l’envoi de preuve (`multipart/form-data`, §10.7). Une réponse 204 n’a pas de corps. |
| Noms des champs | `camelCase`, en anglais, exactement comme dans ce document. |
| Identifiants | Chaînes opaques (`"prod-01"`, `"addr-junior-1"`, `"ag-yde-1"`). Le front ne les interprète jamais. |
| Références de réservation | `RES-` suivi de 6 chiffres (`RES-000124`), en majuscules. Le front met la référence en majuscules avant l’appel ; le serveur l’accepte sans tenir compte de la casse. |
| Slugs | Minuscules, chiffres et tirets (`hoodie-barbele-noir`, `conditions-generales`). |
| Dates | ISO 8601 **avec fuseau** : `2026-10-31T11:00:00.000Z` ou `2026-10-31T12:00:00+01:00` (Douala, UTC+1, sans heure d’été). Jamais de date sans fuseau. |
| Montants | **Entiers en FCFA** (XAF), sans décimale ni séparateur : `45000`. Le front les met en forme (« 45 000 FCFA »). |
| Téléphones | Format international E.164 : `+237690000001`. Le front affiche « 690 00 00 01 ». Exception : `Agency.phone` est aujourd’hui un texte affiché tel quel (`"+237 690 10 11 01"`). |
| Champ absent ou `null` | Un champ facultatif est **omis** quand il n’a pas de valeur. `null` n’est permis que pour les champs marqués « ou `null` » (`packageReadyAt`, `cancelDeadline`, `packagePhotoThumb`, `lastUpdatedAt`, `ussdTemplate`, `qrImageUrl`, `agencyId` en écriture). Avec le sérialiseur Symfony, activer `skip_null_values` sauf pour ces champs, sinon l’app affiche des avertissements « [Contrat API] » (§1.4). |
| Booléens | Vrais booléens JSON. Seule exception : le paramètre de requête `available=1`. |
| Textes renvoyés | Tout texte affiché au client (messages d’erreur, notes du journal, motif de rejet, pages) est en français, au vouvoiement, en phrases courtes, avec l’apostrophe typographique ’ et sans mot technique. Les mots « réservation », « preuve de paiement », « colis » et « Retrait en boutique » sont ceux de l’app ; jamais « commande » côté client. |

**En-têtes envoyés par l’app** sur chaque appel :

| En-tête | Valeur | Quand |
| --- | --- | --- |
| `Accept` | `application/json` | Toujours. |
| `Content-Type` | `application/json` | Quand il y a un corps JSON. Pour la preuve, le navigateur pose `multipart/form-data; boundary=…`. |
| `Authorization` | `Bearer <jeton d’accès>` | Dès que le client est connecté, **y compris sur les routes publiques** (voir §2.4.5). |
| `Idempotency-Key` | UUID v4 (`crypto.randomUUID()`), sinon `idem-<horodatage>-<aléa>` | `POST /reservations` seulement (§2.5). |

Requêtes avec cookies (`credentials: 'include'`) : `POST /auth/refresh` (client), `POST /push/subscribe` depuis le service worker, `POST /client-errors`. Les autres appels utilisent la valeur par défaut du navigateur (`same-origin`) : avec l’API sur le même domaine, les cookies partent aussi.

### 1.4 Contrôle automatique des réponses par l’app

- Chaque réponse JSON réussie des routes ci-dessous est comparée à un schéma (`src/lib/api/contract.ts`, schémas dans `src/lib/api/schemas/`). Le contrôle est chargé à la demande et ne bloque jamais l’affichage.
- En **développement et préproduction**, chaque écart produit un avertissement dans la console du navigateur, par exemple : `[Contrat API] /reservations/RES-000124 : champ "expiresAt" manquant`.
- En **production**, l’écart est envoyé à `POST /client-errors` (zone `api-contract`), sans la donnée elle-même.
- Les schémas sont **souples** : un champ en plus ne déclenche jamais d’alerte ; seuls les champs réellement lus par le front sont exigés.

| Méthode | Route contrôlée | Schéma |
| --- | --- | --- |
| GET | `/products` | `productsPageSchema` |
| GET | `/products/:slug` | `productDetailSchema` |
| GET | `/reservations?scope=…` | `reservationsPageSchema` |
| GET | `/reservations` (avec ou sans `?status=`) | `reservationListSchema` (tableau de réservations complètes) |
| POST | `/reservations` | `reservationCreatedSchema` |
| GET | `/reservations/summary` | `reservationsSummarySchema` |
| GET | `/reservations/:ref` | `reservationSchema` |
| GET | `/settings/public` | `publicSettingsSchema` |
| POST | `/auth/otp/verify` | `authSessionSchema` |
| POST | `/auth/refresh` | `refreshSessionSchema` |
| GET | `/me` | `userSchema` |

Les autres routes ne sont pas contrôlées automatiquement : leur conformité se vérifie à la main avec `docs/INTEGRATION_API.md`.

### 1.5 Légende

- **Auth** :
  - « Public » : aucune authentification requise ; un jeton éventuel est ignoré s’il est invalide (§2.4.5).
  - « Client » : jeton d’accès `Bearer` obligatoire ; 401 s’il manque ou a expiré.
  - « Cookie » : identifié par le cookie de session `httpOnly` (§2.4).
- **Cache côté app** : stratégie du service worker (`src/pwa/cacheRules.ts`, §2.7) : `api-catalog`, `api-user` ou « jamais ». Le service worker n’est actif que dans les builds avec `VITE_PWA_ENABLED=true` et sans mocks du navigateur.
- **Délai max** : délai au-delà duquel l’app abandonne l’appel (`AbortController`) et affiche « Le délai de connexion est dépassé. Vérifiez votre réseau 3G/4G et réessayez. »

---

## 2. Exigences transverses

### 2.1 Domaine, cookies et CORS

- **Configuration cible : même domaine** pour l’application et l’API : `https://<domaine>/` (application) et `https://<domaine>/api/` (API). C’est la condition la plus simple pour que le cookie de session `httpOnly` (§2.4) parte sans réglage particulier, y compris sur Safari iOS, et pour éviter les requêtes préalables CORS.
- HTTPS obligatoire partout (service worker, notifications push et cookie `Secure` l’exigent).
- **Si l’API est sur un sous-domaine** (ex. `https://api.<domaine>` pour une app sur `https://<domaine>`) :
  - **Limite actuelle du front** : seuls `POST /auth/refresh`, `POST /client-errors` et l’appel du service worker partent avec `credentials: 'include'`. `POST /auth/otp/verify` et `POST /auth/logout` partent sans : entre deux origines, le navigateur **ignore** alors le `Set-Cookie` de la connexion (aucun cookie de rafraîchissement n’est posé) et n’envoie pas le cookie à la déconnexion (il ne peut pas être effacé). La configuration sous-domaine demande donc une modification du front (ajouter `credentials: 'include'` à ces deux appels). Le même domaine n’a pas ce problème.
  - Les deux origines restent « même site » : le cookie de rafraîchissement peut garder `SameSite=Lax` (ou `Strict`).
  - Cookie : `Secure; HttpOnly; SameSite=Lax; Path=/api` (ou `/` selon le préfixe), **sans** attribut `Domain` (cookie limité à l’hôte de l’API, qui est le seul à le lire).
  - CORS avec credentials : `Access-Control-Allow-Origin: https://<domaine>` (**origine exacte, jamais `*`**), `Access-Control-Allow-Credentials: true`, `Vary: Origin`.
  - Requêtes préalables (`OPTIONS`) : `Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS` ; `Access-Control-Allow-Headers: Authorization, Content-Type, Idempotency-Key, Accept` ; `Access-Control-Max-Age: 600` conseillé (réseaux mobiles lents).
  - `VITE_API_BASE_URL=https://api.<domaine>/api` (adresse absolue) et `Access-Control-Allow-Origin` à jour pour chaque environnement (préproduction comprise).
  - Politique de sécurité du contenu de l’hébergement (`public/.htaccess`, aujourd’hui en mode « rapport seulement ») : ajouter l’hôte de l’API à `connect-src`. Même chose pour `img-src` et `connect-src` si les médias privés ne sont pas sur `res.cloudinary.com` (S3, par exemple).
- **Domaine complètement différent** (autre site) : à éviter. Il faudrait `SameSite=None; Secure`, et Safari bloque souvent ces cookies tiers : le client serait déconnecté à chaque ouverture.
- Le serveur de mocks Node (`server/mock-api.ts`) applique déjà ce schéma CORS (origine renvoyée en écho, `Vary: Origin`) : il peut servir d’exemple.

### 2.2 Format d’erreur unique

Toute réponse d’erreur (4xx et 5xx) de `/api/*` renvoie ce corps JSON, y compris pour 404 (route inconnue), 405 et 500 (prévoir un écouteur `kernel.exception` qui ne renvoie jamais la page HTML d’erreur de Symfony) :

```json
{
  "code": "INVALID_OTP_CODE",
  "message": "Code incorrect. Il vous reste 4 essais.",
  "details": { "attemptsLeft": 4 }
}
```

| Champ | Type | Règle |
| --- | --- | --- |
| `code` | chaîne | Code applicatif stable, en MAJUSCULES (liste ci-dessous). Le front s’appuie dessus ; ne jamais le traduire ni le changer. |
| `message` | chaîne | Phrase **affichable telle quelle** au client : français, vouvoiement, courte, sans détail technique. L’app l’affiche dans plusieurs écrans (connexion, preuve, erreurs génériques). |
| `details` | objet, facultatif | Données utiles au front. Pour une erreur de validation (422 `VALIDATION_ERROR`) : un message par champ, la clé étant le nom du champ de la requête (chemin Symfony `propertyPath`), ex. `{ "landmark": "Indiquez un point de repère.", "items[0].quantity": "Quantité invalide." }`. HYPOTHÈSE : l’app n’affiche pas encore ces messages champ par champ ; elle affiche `message`. |

Si le corps n’est pas du JSON, l’app retombe sur un message par défaut selon le statut HTTP (`src/lib/api/client.ts`) :

| Statut | `code` retenu par l’app | Message affiché par défaut |
| --- | --- | --- |
| 401 (après échec du rafraîchissement) | `SESSION_EXPIRED` | « Votre session a expiré. Veuillez vous reconnecter. » |
| 403 | `FORBIDDEN` | « Vous n’avez pas l’autorisation d’effectuer cette action. » |
| 404 | `NOT_FOUND` | « La ressource demandée est introuvable. » |
| 422 | `VALIDATION_ERROR` | « Certaines informations saisies sont invalides. » |
| 5xx | `SERVER_ERROR` | « Erreur serveur momentanée. Veuillez réessayer dans quelques instants. » |
| autre | `HTTP_ERROR` | « Une erreur est survenue lors de la communication avec le serveur. » |
| aucune réponse | `NETWORK_ERROR` (statut 0, produit par l’app) | « Réseau indisponible. Vérifiez votre connexion Internet et réessayez. » |
| délai dépassé | `TIMEOUT` (statut 408, produit par l’app) | « Le délai de connexion est dépassé. Vérifiez votre réseau 3G/4G et réessayez. » |

**Codes applicatifs attendus du serveur** (détail dans chaque endpoint) :

| Code | HTTP | Endpoint(s) |
| --- | --- | --- |
| `VALIDATION_ERROR` | 422 | Toute écriture (code générique de validation). |
| `INVALID_PHONE` | 422 | `POST /auth/otp/request` |
| `TOO_MANY_OTP_REQUESTS` | 429 | `POST /auth/otp/request` |
| `TOO_MANY_ATTEMPTS` | 429 | `POST /auth/otp/request` (numéro verrouillé) |
| `OTP_EXPIRED` | 410 | `POST /auth/otp/verify` |
| `INVALID_OTP_CODE` | 422 | `POST /auth/otp/verify` |
| `OTP_LOCKED` | 429 | `POST /auth/otp/verify` |
| `NO_SESSION` | 401 | `POST /auth/refresh` (cookie absent, expiré ou révoqué) |
| `UNAUTHORIZED` | 401 | Toute route « Client » sans jeton valide |
| `FORBIDDEN` | 403 | Droit réellement refusé (jamais pour un jeton expiré) |
| `NOT_FOUND` | 404 | `GET /products/:slug`, `GET /looks/:id`, route inconnue |
| `ADDRESS_NOT_FOUND` | 404 | `PATCH` et `DELETE /me/addresses/:id` |
| `RESERVATION_NOT_FOUND` | 404 | Routes `/reservations/:ref…` (aussi si la réservation appartient à un autre client) |
| `PAGE_NOT_FOUND` | 404 | `GET /pages/:slug` |
| `STOCK_CONFLICT` | 409 | `POST /reservations` |
| `DUPLICATE_PROOF` | 409 | `POST /reservations/:ref/proof` |
| `RESERVATION_EXPIRED` | 410 | `POST /reservations/:ref/proof` |
| `FILE_TOO_LARGE` | 413 | `POST /reservations/:ref/proof` |
| `INVALID_STATUS` | 422 | `POST /reservations/:ref/proof` |
| `CANCEL_NOT_ALLOWED` | 422 | `POST /reservations/:ref/cancel` |
| `INVALID_SUBSCRIPTION` | 422 | `POST /push/subscribe` |
| `IDEMPOTENCY_KEY_REUSED` | 422 | `POST /reservations` (même clé, corps différent) — proposition, HYPOTHÈSE |
| `RATE_LIMITED` | 429 | Limite de débit générique — proposition, HYPOTHÈSE |

Codes produits **par l’app elle-même**, jamais par le serveur : `SESSION_EXPIRED`, `NETWORK_ERROR`, `TIMEOUT`, `UPLOAD_ABORTED`, `MISSING_REF`, `SERVER_ERROR`, `HTTP_ERROR`. Codes propres aux mocks, à ne pas reproduire : `SIMULATED_SERVER_ERROR`, `NO_NEXT_STEP`.

Pour un 429, ajouter `details.retryAfter` (secondes) et l’en-tête standard `Retry-After` : l’app bloque le formulaire pendant ce temps.

### 2.3 Erreurs 5xx et nouvelles tentatives

- Lectures (`GET` via TanStack Query) : l’app réessaie **2 fois** sur une erreur 5xx, une coupure ou un délai dépassé ; jamais sur une 4xx.
- Écritures : jamais de nouvelle tentative automatique, sauf `POST /reservations` (2 nouvelles tentatives avec la même `Idempotency-Key` après une coupure ou un délai dépassé, §10.1).
- Une 5xx sur `POST /auth/refresh` ne déconnecte jamais le client (§2.4.4).

### 2.4 Authentification et session

#### 2.4.1 Principe

- Connexion sans mot de passe : numéro de téléphone puis code à 6 chiffres reçu par SMS (§4.1 et §4.2).
- Deux jetons :
  - **Jeton d’accès** (JWT ou jeton opaque) renvoyé dans le corps de `POST /auth/otp/verify` et `POST /auth/refresh`. L’app le garde **en mémoire seulement** (jamais dans `localStorage`) et l’envoie en `Authorization: Bearer …`. Durée conseillée : **15 min** (HYPOTHÈSE).
  - **Jeton de rafraîchissement** dans un cookie `httpOnly`, posé par `POST /auth/otp/verify`, renouvelé par `POST /auth/refresh`, effacé par `POST /auth/logout`. Durée : **90 jours** glissants (HYPOTHÈSE de `src/stores/authStore.ts`).
- L’app garde aussi le profil (`User`) dans le stockage du téléphone pour s’afficher tout de suite au démarrage et hors connexion ; le serveur reste seul juge de la session.

#### 2.4.2 Cookie de rafraîchissement

| Attribut | Valeur attendue |
| --- | --- |
| Nom | Libre (ex. `drc_refresh`) : le front ne le lit jamais. |
| `HttpOnly` | Oui. |
| `Secure` | Oui. |
| `SameSite` | `Lax` (même domaine ou sous-domaine). `Strict` convient aussi sur le même domaine. |
| `Path` | **`/api`** (HYPOTHÈSE). Il doit couvrir `/api/auth/refresh`, `/api/auth/logout` **et `/api/push/subscribe`** : le service worker se réabonne aux notifications avec ce seul cookie (§11.1). Si le back-end préfère `Path=/api/auth`, il doit identifier le réabonnement du service worker par `oldEndpoint` seul. |
| `Domain` | Absent (cookie limité à l’hôte de l’API). |
| `Max-Age` | 90 jours (HYPOTHÈSE), renouvelé à chaque rafraîchissement. |

#### 2.4.3 Rotation

- Chaque `POST /auth/refresh` réussi émet un **nouveau** jeton de rafraîchissement (nouveau cookie) et invalide l’ancien.
- **Délai de grâce de 30 s conseillé** (HYPOTHÈSE) pour l’ancien jeton : l’app regroupe les rafraîchissements d’un même onglet, mais deux onglets (ou l’app installée et un onglet) peuvent rafraîchir en même temps. Sans délai de grâce, une détection de réutilisation trop stricte révoquerait toute la famille de jetons et déconnecterait le client.
- Réutilisation d’un jeton déjà remplacé hors du délai de grâce : révoquer la famille et répondre 401.

#### 2.4.4 401 et 403 sur `/auth/refresh`, et erreurs 5xx

C’est le point le plus sensible pour l’expérience hors connexion (RAPPORT_M6 §4.7) :

| Réponse de `POST /auth/refresh` | Effet dans l’app |
| --- | --- |
| 200 avec `accessToken` | Nouvelle session, l’appel d’origine est rejoué une fois. |
| 200 **sans** `accessToken` | Session effacée (traité comme un refus). |
| **401 ou 403** | Session **effacée** : le client devra se reconnecter. À réserver aux sessions réellement refusées (cookie absent, expiré, révoqué, réutilisé). |
| 5xx, 429, autre statut, coupure, délai dépassé (15 s) | Session **gardée** : le client reste connecté et voit ses données enregistrées ; l’app réessaiera au retour du réseau. Ne jamais répondre 401 pour une panne (base de données indisponible, etc.). |

#### 2.4.5 Jeton sur les routes publiques

L’app envoie le jeton d’accès sur **toutes** les routes dès que le client est connecté, y compris le catalogue. Si une route publique répond 401 à un jeton expiré, l’app tente un rafraîchissement ; s’il est refusé, l’appel échoue (erreur `SESSION_EXPIRED`, écran « Impossible de charger le catalogue ») au lieu d’afficher les articles, car l’app ne rejoue pas l’appel sans jeton. Règle : **sur une route « Public », un jeton absent, expiré ou invalide est ignoré** (pare-feu Symfony en accès anonyme autorisé, authentificateur qui ne lève pas d’exception sur ces routes).

#### 2.4.6 401 sur une route « Client »

- Jeton absent ou expiré : **401** (jamais 403). L’app appelle `POST /auth/refresh` une seule fois, puis rejoue l’appel une seule fois avec le nouveau jeton.
- Si le rafraîchissement est refusé : l’app affiche la feuille de connexion (par exemple au moment de confirmer une réservation) puis reprend l’action.
- 403 : réservé à un droit réellement refusé. L’app ne tente pas de rafraîchissement et affiche « Vous n’avez pas l’autorisation d’effectuer cette action. »
- Ressource d’un autre client : **404**, jamais 403 (on ne révèle pas son existence).

### 2.5 Idempotence (`Idempotency-Key`)

- **Seule création qui envoie l’en-tête : `POST /reservations`.** La clé est générée à l’ouverture du formulaire de réservation et gardée pour toutes les tentatives de cet envoi (double appui, nouvelles tentatives automatiques après une coupure).
- Format : UUID v4 en général ; à défaut (navigateur ancien), `idem-<horodatage>-<aléa>`. Accepter toute chaîne de 8 à 64 caractères `[A-Za-z0-9-]`.
- Comportement attendu :
  - même clé, même client, même corps : renvoyer **la même réservation** (corps identique), avec 201 ou 200 (l’app accepte tout 2xx) ; ne jamais créer une seconde réservation ;
  - même clé, corps différent : 422 `IDEMPOTENCY_KEY_REUSED` (proposition) ;
  - conservation des clés : au moins **24 h** (HYPOTHÈSE), par client.
- Les autres écritures n’envoient pas de clé :
  - `POST /reservations/:ref/proof` est protégé par l’empreinte `sha256` et par le statut (§10.7) ;
  - `POST /me/addresses` peut créer un doublon si le client appuie deux fois : accepter, ou dédoublonner sur le contenu (HYPOTHÈSE) ;
  - `POST /push/subscribe` est idempotent par nature (un abonnement par `endpoint`).

### 2.6 Pagination et tri

**Pagination** (`Paginated<T>`, `src/types/domain.ts`) :

```json
{ "items": [], "page": 1, "pageSize": 12, "total": 24, "totalPages": 2 }
```

| Règle | Valeur |
| --- | --- |
| Première page | `page=1` (jamais 0). |
| Taille | Paramètre `pageSize` pour `GET /products` : l’app envoie 1, 4, 8, 12, 24 ou 50 ; défaut **12**. Accepter jusqu’à **50** au moins. `GET /reservations?scope=` : taille fixée par le serveur à **10**, l’app n’envoie pas `pageSize`. |
| Page au-delà de la fin | 200 avec `items: []` (jamais 404). |
| Fin de liste | Produits : l’app arrête quand `page × pageSize ≥ total`. Réservations : quand `page ≥ totalPages`. Les deux champs doivent être cohérents. |
| `totalPages` | `max(1, ceil(total / pageSize))` (les mocks renvoient 1 pour une liste vide). |

**Tri** :

| Liste | Paramètre | Valeurs | Règle |
| --- | --- | --- | --- |
| `GET /products` | `sort` | `popular` (défaut), `newest`, `price-asc`, `price-desc` | `popular` : `reservationsCount` décroissant ; `newest` : `createdAt` décroissant ; prix croissant ou décroissant. Accepter aussi les alias `price_asc` et `price_desc` (anciens liens partagés), que l’app convertit déjà avant l’appel. |
| `GET /reservations?scope=` | — | — | `updatedAt` décroissant : une réservation qui vient de changer remonte en tête de son onglet. |
| `GET /reservations?status=` et sans paramètre | — | — | `createdAt` décroissant. |
| `GET /products/:slug` → `related` | — | — | Même sous-catégorie d’abord, puis même catégorie ; 6 au plus. |

### 2.7 En-têtes de cache et cache de l’application

#### 2.7.1 Ce que fait le service worker

| Cache | Routes de l’API | Stratégie | Limites |
| --- | --- | --- | --- |
| `api-catalog` | `/categories`, `/products*`, `/looks*`, `/search/suggest*`, `/settings/public`, `/delivery/*`, `/pages/:slug` | Copie enregistrée servie tout de suite, mise à jour en arrière-plan | 300 entrées, 7 jours |
| `api-user` | `/me`, `/me/addresses*`, `/reservations*` (lectures), `/favorites*` | Réseau d’abord (4 s), dernier état enregistré sinon ; **vidé à la déconnexion** | 60 entrées, 2 jours |
| jamais | Toute requête non GET ; `/auth/*`, `/push/*`, `/cart/validate`, `/_mock/*` ; `/reservations/:ref/proof`, `/reservations/:ref/photos` ; `/admin*` et `/api/admin*` ; médias privés (§2.9) | Directement au réseau | — |

Une réponse n’est enregistrée que si elle est **200**, du bon type (`Content-Type` contenant `json` pour l’API) et **sans `Cache-Control: no-store`**. Une copie du cache `api-user` servie faute de réseau porte l’en-tête interne `X-DRC-Offline-Fallback: 1` (ajouté par le service worker, rien à faire côté serveur) : l’app sait ainsi qu’elle affiche un ancien état.

#### 2.7.2 `Cache-Control` attendu

| Données | Valeur attendue | Raison |
| --- | --- | --- |
| Catalogue et données publiques (`/categories`, `/products*`, `/looks*`, `/search/suggest`, `/settings/public`, `/delivery/*`, `/pages/:slug`) | `public, max-age=60, stale-while-revalidate=600` (proposition), avec `ETag` | Le service worker en garde une copie pour le hors connexion. **Jamais `no-store`** : le catalogue ne serait plus consultable sans réseau. |
| Sessions, écritures et données sensibles (`/auth/*`, `/push/*`, `/cart/validate`, toutes les réponses de `POST`, `PATCH`, `DELETE`, `/reservations/:ref/proof`, `/client-errors`, erreurs 4xx et 5xx des routes privées) | **`no-store`** | Rien ne doit être gardé, ni par le navigateur, ni par un intermédiaire. |
| Données privées en lecture (`GET /me`, `/me/addresses`, `/reservations*`, `/favorites`) | **À trancher** (voir ci-dessous) : `no-store` (RAPPORT_M6 §4.5) **ou** `private, no-cache` (proposition) | — |
| Médias privés signés (preuves, photos du colis) | Au choix du stockage (Cloudinary) ; l’app ne les enregistre jamais (§2.9). | — |

**Point à trancher (écart entre RAPPORT_M6 §4.5 et RAPPORT_M6 §1.3 et §1.5)** : M6 demande `Cache-Control: no-store` sur toutes les données privées, et précise que l’app ne les enregistre alors jamais. Mais M6 promet aussi la lecture hors connexion de « Mes réservations », du détail et de l’écran de paiement grâce au cache `api-user`. Les deux sont incompatibles : avec `no-store`, le cache `api-user` reste vide en production et ces écrans affichent « Hors connexion » au lieu du dernier état connu.
- **Proposition** : `Cache-Control: private, no-cache` sur les lectures privées listées ci-dessus. Aucun intermédiaire ne les garde, le navigateur revalide à chaque appel, et le service worker peut garder la dernière copie (2 jours au plus, 60 entrées, effacée à la déconnexion). Ces réponses contiennent des URL signées, pas les images (RAPPORT_M6 §6.1).
- **Variante stricte** : `no-store` partout. Accepter alors que ces écrans ne soient pas lisibles hors connexion après un redémarrage de l’app.
- Décision attendue du client et du back-end (voir §17, question 1). Dans tous les cas, ajouter `Vary: Authorization` (et `Vary: Origin` en CORS) sur les réponses privées.

### 2.8 Envoi de fichiers (preuves de paiement)

| Règle | Valeur |
| --- | --- |
| Route | `POST /reservations/:ref/proof`, `multipart/form-data` (§10.7). |
| Taille maximale | `payment.proofMaxSizeMb` de `GET /settings/public` (10 Mo aujourd’hui). Au-delà : 413 `FILE_TOO_LARGE`. |
| Taille réelle envoyée | L’app réduit la capture à 1 600 px au plus (JPEG qualité 0,82), soit 210 à 340 Ko en général. Une capture déjà légère (< 400 Ko et ≤ 1 600 px) part telle quelle. |
| Formats reçus | `image/jpeg` le plus souvent ; `image/png` ou `image/webp` pour une capture déjà légère. Les photos HEIC sont converties ou refusées par l’app avant l’envoi. Vérifier le type réel du fichier (contenu, pas seulement l’extension). |
| Empreinte | Champ `sha256` : empreinte hexadécimale (64 caractères) du fichier envoyé. La recalculer côté serveur et refuser un écart (422 `VALIDATION_ERROR`). |
| Délai côté app | 30 s (envoi par `XMLHttpRequest`, avec barre de progression et bouton « Annuler »). |
| Serveur web | Prévoir `client_max_body_size` (nginx) ou `LimitRequestBody` (Apache), `upload_max_filesize` et `post_max_size` (PHP) au-dessus de `proofMaxSizeMb` + 1 Mo. Sinon le serveur web coupe la requête avec une page HTML 413 au lieu du JSON attendu. |
| Stockage | Privé (Cloudinary `authenticated` ou `private`, ou S3 privé), un dossier par réservation ; jamais public (RAPPORT_M4 §5.2). Retirer les métadonnées EXIF. |

### 2.9 Médias privés : URL signées de courte durée

- Concernés : `proof.thumbnailUrl` (preuve de paiement), `packagePhotos[].url` et `packagePhotos[].thumbnailUrl` (photos du colis), `packagePhotoThumb` (liste), et `image` des notifications « colis prêt ».
- L’API renvoie des **URL complètes, signées, valables 1 h** (conseil RAPPORT_M5 §5.6). L’app les affiche telles quelles (jamais transformées par `cloudinaryUrl()`).
- Au premier échec de chargement d’une photo, l’app recharge la réservation **une seule fois** pour obtenir des liens neufs : `GET /reservations/:ref` doit donc toujours renvoyer des liens valides au moment de la réponse.
- **Le service worker ne doit jamais enregistrer ces médias.** Il les reconnaît uniquement à ces motifs (`isPrivateMedia`, `src/pwa/cacheRules.ts`) ; une URL privée d’une autre forme finirait dans le cache d’images du téléphone pendant 30 jours :
  - chemin contenant `/private/` ou `/authenticated/` ;
  - segment de signature Cloudinary `/s--XXXXXXXX--/` (6 caractères au moins entre les tirets) ;
  - paramètre d’URL `signature`, `sig`, `token`, `expires`, `x-amz-signature`, `x-goog-signature` ou `__cld_token__` (sans tenir compte de la casse).
- Exemples conformes : `https://res.cloudinary.com/drchoco/image/authenticated/s--k3J9xQ2a--/v1730197200/reservations/RES-000102/colis-1.jpg`, ou une URL S3 avec `X-Amz-Signature=…`.
- « Enregistrer la photo » télécharge l’image avec `fetch(url)` depuis le navigateur : l’hôte des médias doit répondre avec `Access-Control-Allow-Origin` (Cloudinary le fait). À défaut, l’app ouvre la photo dans un nouvel onglet.
- Les photos du catalogue, elles, sont **publiques** : URL Cloudinary `https://res.cloudinary.com/<compte>/image/upload/…` ou identifiant public (`products/hoodie-barbele-noir-1`), transformées par l’app (`f_auto`, `q_auto`, largeurs 320 à 1 280 px).

### 2.10 Administration (`/api/admin`)

- Toutes les données d’administration sont sous **`/api/admin/…`** ; les écrans sous **`/admin`**.
- L’application client ne contient aucun écran `/admin` et son service worker ne met **jamais** en cache `/admin*` ni `/api/admin*` (règle `isAdminUrl`), même si les deux partagent le domaine.
- Les routes d’administration exigent un rôle distinct ; un jeton client y reçoit 403.
- Le message WhatsApp envoyé depuis l’écran Merci contient un lien `https://<domaine>/admin/reservations/RES-…` (HYPOTHÈSE, à confirmer quand l’adresse de l’administration sera connue).
- Actions d’administration dont dépend l’app client (RAPPORT_M5 §6) : valider ou rejeter une preuve avec un motif (affiché tel quel), faire avancer une réservation selon son parcours, joindre 1 à 3 photos du colis au passage à « Remise à l’agence » ou « Prête pour retrait », marquer livrée ou retirée, annuler avec une note, voir le motif d’annulation du client. Le simulateur boutique de `/_dev` (§15) reproduit ces actions et sert de référence.

### 2.11 Notifications push (Web Push)

- **Clés VAPID** : le back-end génère la paire (ex. `vendor/bin/web-push generate-vapid-keys`, bibliothèque `minishlink/web-push`) et fournit la clé publique au front (`VITE_VAPID_PUBLIC_KEY`, base64url, 87 caractères environ). La clé de démonstration actuelle n’a pas de clé privée : aucune notification réelle ne peut partir avec elle. Changer de paire après la mise en ligne est à éviter : l’app ne remplace l’ancien abonnement qu’à la connexion suivante ou quand le client réactive les notifications ; d’ici là, plus rien n’arrive sur ses appareils.
- **Abonnements** : un client peut avoir **plusieurs appareils**, donc plusieurs abonnements, identifiés par leur `endpoint` (§11.1). Un même `endpoint` n’appartient qu’à un compte à la fois (le dernier qui l’envoie).
- **Envoi** à chaque événement de la réservation (tableau du §14.3), au format `PushPayload` ci-dessous, vers tous les abonnements du client.
- **Abonnements expirés** : si le service de push répond **404 ou 410**, supprimer l’abonnement. Sur 429 ou 5xx, réessayer plus tard sans le supprimer.
- Options conseillées : `TTL` de 24 h (`expiring_soon` : jusqu’à l’échéance), `Urgency: high` pour `payment_rejected` et `expiring_soon`, `normal` sinon.
- Contenu chiffré limité à **4 Ko** environ : rester bref.

**Format `PushPayload`** (`src/pwa/pushPayload.ts`) :

| Champ | Type | Obligatoire | Règle |
| --- | --- | --- | --- |
| `type` | chaîne | oui | `payment_validated`, `payment_rejected`, `package_ready`, `in_delivery`, `delivered`, `expiring_soon` ou `new_collection`. Tout autre type est ignoré par l’app. |
| `title` | chaîne | oui | Non vide. |
| `body` | chaîne | oui | Non vide. |
| `url` | chaîne | oui | **Chemin de l’app** commençant par `/` (jamais `//` ni une URL externe, sinon la notification est ignorée). Ex. `/reservations/RES-000124`, `/reservations/RES-000124#colis`, `/explorer?sort=newest`. |
| `ref` | chaîne | non | Référence de la réservation (mise en majuscules). Sert aux boutons « Payer » et « Renvoyer ma preuve ». |
| `image` | chaîne | non | `package_ready` seulement : photo du colis, URL signée de courte durée (`https://…`). Affichée par Android ; ignorée par iOS. |
| `tag` | chaîne | non | Par défaut la référence : une notification remplace la précédente de la même réservation. |

Boutons ajoutés par l’app : `payment_validated` « Voir ma réservation » ; `payment_rejected` « Renvoyer ma preuve » (`/reservation/<ref>/preuve`) ; `package_ready` « Voir mon colis » ; `in_delivery` « Suivre » ; `expiring_soon` « Payer » (`/reservation/<ref>/paiement`) ; `new_collection` « Découvrir ». Les types `payment_rejected`, `expiring_soon` et `package_ready` allument la pastille de l’icône de l’app. Si l’app est ouverte et visible, aucune notification système n’est affichée : l’app recharge ses données et montre un message interne.

Exemples (textes de travail de `samplePushPayload`, à valider par le client, RAPPORT_M6 §5) :

```json
{ "type": "payment_validated", "title": "Paiement validé ✓", "body": "RES-000124 est confirmée. Nous préparons votre colis.", "ref": "RES-000124", "url": "/reservations/RES-000124" }
{ "type": "payment_rejected", "title": "Paiement non validé", "body": "RES-000124 : capture illisible. Renvoyez votre preuve avant 23 h 10.", "ref": "RES-000124", "url": "/reservations/RES-000124" }
{ "type": "package_ready", "title": "Votre colis est prêt 📦", "body": "RES-000124 est emballée. Voyez la photo de votre colis.", "ref": "RES-000124", "url": "/reservations/RES-000124#colis", "image": "https://res.cloudinary.com/drchoco/image/authenticated/s--k3J9xQ2a--/c_fill,w_720/v1730197200/reservations/RES-000124/colis-1.jpg" }
{ "type": "in_delivery", "title": "Votre colis est en route", "body": "RES-000124 part vers Yaoundé.", "ref": "RES-000124", "url": "/reservations/RES-000124" }
{ "type": "delivered", "title": "Livré !", "body": "Merci pour votre confiance.", "ref": "RES-000124", "url": "/reservations/RES-000124" }
{ "type": "expiring_soon", "title": "Votre réservation expire bientôt", "body": "RES-000124 expire dans 2 h. Payez pour garder vos articles.", "ref": "RES-000124", "url": "/reservations/RES-000124" }
{ "type": "new_collection", "title": "Nouvelle collection", "body": "Les nouveautés de la semaine sont arrivées.", "url": "/explorer?sort=newest" }
```

Note : dans le code (`samplePushPayload`), le texte de `payment_validated` dit encore « Nous préparons votre commande. » ; le mot « commande » est exclu côté client, d’où « colis » ci-dessus (correction demandée au front).

### 2.12 Balises de partage des fiches produit (rendu côté serveur)

- WhatsApp, Facebook et les autres aperçus de lien **n’exécutent pas le JavaScript** : ils lisent seulement le HTML renvoyé pour l’adresse partagée. Aujourd’hui ils voient les balises générales de `index.html`.
- Le serveur qui sert l’application doit donc, pour **`GET /produit/:slug`** (adresse de l’app, pas de l’API), renvoyer `index.html` avec ces balises insérées dans `<head>` (mêmes valeurs que `src/features/catalog/product/ProductSeo.tsx`) :

| Balise | Valeur |
| --- | --- |
| `<title>` | `<nom> — <prix> \| DR Choco L’Incompris` |
| `<meta name="description">` | Description de l’article sur une ligne, coupée au dernier mot avant 160 caractères (suivie de « … »). |
| `<link rel="canonical">` | `https://<domaine>/produit/<slug>` |
| `og:title` | `<nom> — <prix>` |
| `og:description` | Même texte que la description. |
| `og:image` | URL **absolue** de la première photo. Conseil : version 1 200 × 630 en JPEG (Cloudinary `c_fill,w_1200,h_630,f_jpg`). |
| `og:url` | Adresse canonique. |
| `og:type` | `product` |
| `product:price:amount` | Prix entier (`45000`). |
| `product:price:currency` | `XAF` |
| `<script type="application/ld+json">` | Facultatif : bloc Schema.org `Product` (nom, image, description, `sku` = id, marque, offre en `XAF`, disponibilité `InStock` ou `OutOfStock`). |

- Format du prix comme dans l’app : `45 000 FCFA`, avec une espace fine insécable (U+202F) entre les milliers et une espace insécable (U+00A0) avant « FCFA ».
- Slug inconnu : renvoyer `index.html` normal avec le statut **404** (l’app affiche « Cet article n’existe plus ou a été déplacé »).
- Le HTML doit rester servi avec `Cache-Control: no-cache` (le service worker le revalide ; voir aussi `docs/INTEGRATION_API.md` §3.5).
- Hébergement Apache prévu (`public/.htaccess`, M7) : la règle « Toute autre adresse : l’application » envoie aujourd’hui `/produit/…` directement à `index.html`. Il faudra ajouter avant elle une règle qui confie `/produit/…` à un contrôleur Symfony (lecture de `index.html` construit, insertion des balises, réponse HTML). Modification de `public/.htaccess` à faire avec l’équipe front.

### 2.13 Plan du site dynamique

- `public/sitemap.xml` (statique, livré avec l’app) couvre les pages fixes, les catégories connues, le centre d’aide et les pages légales.
- Les fiches produit (`/produit/:slug`) doivent être listées dans un plan **généré par le back-end** (HYPOTHÈSE de nom : `https://<domaine>/sitemap-produits.xml`), avec `<lastmod>` = date de dernière modification de l’article, et regroupées avec le plan statique dans un index de plans (`sitemap-index.xml`) déclaré dans `robots.txt`. Le changement de `robots.txt` est à faire par le front au moment de la mise en ligne.
- Exclure les articles retirés de la vente ; garder les articles épuisés (ils restent consultables).

### 2.14 Délais, limites de débit et performance

| Élément | Valeur côté app |
| --- | --- |
| Délai par défaut d’un appel | 15 s |
| `POST /cart/validate` | **2 s** (au-delà, l’app continue sans vérification) |
| Envoi de preuve | 30 s |
| `POST /auth/refresh` | 15 s |
| Vérification « Réessayer » hors connexion (`GET /settings/public`) | 8 s |
| Désabonnement des notifications à la déconnexion | 3 s au plus, puis déconnexion quand même |

| Rechargement automatique (page visible seulement) | Intervalle |
| --- | --- |
| `GET /reservations/:ref` sur les écrans paiement, preuve et Merci | 20 s |
| `GET /reservations/:ref` (détail), `GET /reservations?scope=…`, `GET /reservations/summary` | 30 s |
| Les mêmes quand les notifications push fonctionnent | 2 min |
| `GET /reservations?status=reserved` | Au retour sur l’app (au plus toutes les 30 s) |

Objectifs de temps de réponse côté serveur (p95, hors transfert réseau) : **< 500 ms** pour le catalogue et les lectures, **< 1 s** pour les écritures. `POST /cart/validate` doit rester nettement sous 500 ms (délai de 2 s côté app sur réseau mobile).

Limites de débit conseillées (en plus de celles de l’OTP, §4.1) : 60 requêtes par minute et par client connecté sur les écritures ; 20 envois `POST /client-errors` par heure et par adresse IP. Réponse 429 au format du §2.2 avec `Retry-After`.

---

## 3. Tableau récapitulatif des endpoints

31 routes (méthode + chemin) appelées par l’application, dont `GET /reservations` sous 3 formes, soit 33 lignes. Toutes sont relatives à `/api`.

| # | Méthode | Chemin | Auth | Cache côté app | `Cache-Control` attendu | Contrat contrôlé | § |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | POST | `/auth/otp/request` | Public | jamais | `no-store` | non | 4.1 |
| 2 | POST | `/auth/otp/verify` | Public | jamais | `no-store` | oui | 4.2 |
| 3 | POST | `/auth/refresh` | Cookie | jamais | `no-store` | oui | 4.3 |
| 4 | POST | `/auth/logout` | Cookie (+ Bearer si présent) | jamais | `no-store` | non | 4.4 |
| 5 | GET | `/me` | Client | `api-user` | à trancher (§2.7.2) | oui | 5.1 |
| 6 | PATCH | `/me` | Client | jamais | `no-store` | non | 5.2 |
| 7 | GET | `/me/addresses` | Client | `api-user` | à trancher (§2.7.2) | non | 5.3 |
| 8 | POST | `/me/addresses` | Client | jamais | `no-store` | non | 5.4 |
| 9 | PATCH | `/me/addresses/:id` | Client | jamais | `no-store` | non | 5.5 |
| 10 | DELETE | `/me/addresses/:id` | Client | jamais | `no-store` | non | 5.6 |
| 11 | POST | `/favorites` | Client | jamais | `no-store` | non | 5.7 |
| 12 | GET | `/categories` | Public | `api-catalog` | `public, max-age=60, stale-while-revalidate=600` | non | 6.1 |
| 13 | GET | `/products` | Public | `api-catalog` | idem | oui | 6.2 |
| 14 | GET | `/products/:slug` | Public | `api-catalog` | idem | oui | 6.3 |
| 15 | GET | `/search/suggest` | Public | `api-catalog` | idem | non | 6.4 |
| 16 | GET | `/looks` | Public | `api-catalog` | idem | non | 6.5 |
| 17 | GET | `/looks/:id` | Public | `api-catalog` | idem | non | 6.6 |
| 18 | GET | `/settings/public` | Public | `api-catalog` | idem | oui | 7.1 |
| 19 | GET | `/delivery/cities` | Public | `api-catalog` | idem | non | 8.1 |
| 20 | GET | `/delivery/agencies` | Public | `api-catalog` | idem | non | 8.2 |
| 21 | POST | `/cart/validate` | Public | jamais | `no-store` | non | 9.1 |
| 22 | POST | `/reservations` | Client + `Idempotency-Key` | jamais | `no-store` | oui | 10.1 |
| 23 | GET | `/reservations?status=reserved` | Client | `api-user` | à trancher | oui | 10.2 |
| 24 | GET | `/reservations?scope=active\|done&page=N` | Client | `api-user` | à trancher | oui | 10.3 |
| 25 | GET | `/reservations` (sans paramètre, `/_dev` seulement) | Client | `api-user` | à trancher | oui | 10.4 |
| 26 | GET | `/reservations/summary` | Client | `api-user` | à trancher | oui | 10.5 |
| 27 | GET | `/reservations/:ref` | Client | `api-user` | à trancher | oui | 10.6 |
| 28 | POST | `/reservations/:ref/proof` | Client, `multipart/form-data` | jamais | `no-store` | non | 10.7 |
| 29 | POST | `/reservations/:ref/cancel` | Client | jamais | `no-store` | non | 10.8 |
| 30 | POST | `/push/subscribe` | Client (app) ou Cookie (service worker) | jamais | `no-store` | non | 11.1 |
| 31 | POST | `/push/unsubscribe` | Client | jamais | `no-store` | non | 11.2 |
| 32 | GET | `/pages/:slug` | Public | `api-catalog` | `public, max-age=300` (proposition) | non | 12.1 |
| 33 | POST | `/client-errors` | Public | jamais | `no-store` | non | 13.1 |

Hors API, à la charge du serveur qui sert l’application : balises de partage de `GET /produit/:slug` (§2.12) et plan du site des produits (§2.13).

---

## 4. Authentification

### 4.1 `POST /auth/otp/request` — Envoyer un code par SMS

| | |
| --- | --- |
| Auth | Public (l’app n’essaie jamais de rafraîchir la session sur cette route) |
| Cache côté app | jamais — `Cache-Control: no-store` |
| Délai max | 15 s |
| Appelé par | Feuille de connexion : « Recevoir le code », puis « Renvoyer le code » |

**Corps**

| Champ | Type | Obligatoire | Règle |
| --- | --- | --- | --- |
| `phone` | chaîne | oui | Numéro camerounais normalisé par l’app : `+237` suivi de 9 chiffres commençant par 6. |

**Exemple**

```http
POST /api/auth/otp/request
Content-Type: application/json
Accept: application/json

{ "phone": "+237690000001" }
```

**Réponse 200**

```json
{ "message": "Code envoyé par SMS.", "expiresIn": 300, "resendIn": 60, "expiresInSeconds": 300 }
```

| Champ | Type | Règle |
| --- | --- | --- |
| `resendIn` | entier (s) | Délai avant que « Renvoyer le code » redevienne actif. **Seul champ lu par l’app** (60 par défaut s’il manque). |
| `expiresIn`, `expiresInSeconds` | entier (s) | Durée de validité du code (300). Les deux noms existent dans le type du front ; renvoyer les deux (doublon à supprimer plus tard). |
| `message` | chaîne, facultatif | Non affiché. |

**Erreurs**

| HTTP | `code` | Quand | Ce que voit le client |
| --- | --- | --- | --- |
| 422 | `INVALID_PHONE` | Numéro invalide (rare : l’app le vérifie avant l’envoi) | Le `message` du serveur sous le champ, ex. « Ce numéro semble incomplet. Entrez les 9 chiffres commençant par 6. » |
| 429 | `TOO_MANY_OTP_REQUESTS` | Plus de **3 demandes en 10 min** pour ce numéro | « Trop de tentatives. Réessayez dans N min. » (calculé par l’app depuis `details.retryAfter`, 600 s par défaut) ; bouton bloqué pendant ce temps. |
| 429 | `TOO_MANY_ATTEMPTS` | Numéro verrouillé après 5 codes faux (§4.2) | Idem. |
| 5xx | — | Panne, fournisseur SMS indisponible | Le `message` du serveur, sinon « Erreur serveur momentanée. Veuillez réessayer dans quelques instants. » |

Au renvoi du code, toute erreur autre que 429 affiche « Impossible de renvoyer le code pour l’instant. »

**Remarques**

- Le SMS contient le code à 6 chiffres. Pour le remplissage automatique sur Android (WebOTP), il se termine par la ligne `@<domaine> #123456` (RAPPORT_M3 §4.3) ; sans elle, le client tape le code.
- Un nouveau code annule le précédent et remet à 5 le nombre d’essais.
- Mocks : le code valide est toujours `123456` et `000000` simule un code expiré ; délai 300 à 900 ms.

### 4.2 `POST /auth/otp/verify` — Vérifier le code et ouvrir la session

| | |
| --- | --- |
| Auth | Public (sans rafraîchissement) |
| Cache côté app | jamais — `no-store` |
| Délai max | 15 s |
| Contrat contrôlé | `authSessionSchema` |

**Corps**

| Champ | Type | Obligatoire | Règle |
| --- | --- | --- | --- |
| `phone` | chaîne | oui | Même numéro qu’au §4.1. |
| `code` | chaîne | oui | 6 chiffres. |

**Exemple**

```http
POST /api/auth/otp/verify
Content-Type: application/json

{ "phone": "+237690000001", "code": "123456" }
```

**Réponse 200** — pose le cookie de rafraîchissement (§2.4.2)

```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store
Set-Cookie: drc_refresh=…; Path=/api; Max-Age=7776000; Secure; HttpOnly; SameSite=Lax
```

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.…",
  "user": {
    "id": "usr-junior-01",
    "phone": "+237690000001",
    "firstName": "Junior",
    "lastName": "Mbarga",
    "city": "Douala",
    "createdAt": "2026-09-15T10:00:00.000Z"
  },
  "isNewUser": false
}
```

| Champ | Type | Obligatoire | Règle |
| --- | --- | --- | --- |
| `accessToken` | chaîne non vide | oui | Jeton d’accès (§2.4.1). |
| `user` | `User` (annexe A) | oui | Profil du client. Compte créé à la première connexion. |
| `isNewUser` | booléen | non | `true` à la création du compte : l’app demande alors le prénom et le nom (`PATCH /me`). |

**Erreurs**

| HTTP | `code` | Quand | Ce que voit le client |
| --- | --- | --- | --- |
| 422 | `INVALID_OTP_CODE` | Code faux ; `details.attemptsLeft` = essais restants | « Code incorrect. Il vous reste N essai(s). » (calculé depuis `attemptsLeft` ; sinon le `message` du serveur, sinon « Code incorrect. ») |
| 410 | `OTP_EXPIRED` | Code expiré (5 min) ou déjà utilisé | « Ce code a expiré. » et proposition de renvoi. |
| 429 | `OTP_LOCKED` | 5 codes faux : numéro verrouillé **10 min** ; `details.retryAfter` (s), `details.attemptsLeft: 0` | « Trop de tentatives. Réessayez dans N min. » |
| 5xx | — | — | Le `message` du serveur (ou le message par défaut). Sans réponse : « Impossible de vérifier ce code. Réessayez. » |

**Remarques**

- Après la connexion, l’app fusionne les favoris du téléphone avec ceux du compte (`POST /favorites`, §5.7), recharge les adresses et les réservations en attente, puis renvoie l’abonnement aux notifications (`POST /push/subscribe`) si la permission est déjà accordée.

### 4.3 `POST /auth/refresh` — Renouveler le jeton d’accès

| | |
| --- | --- |
| Auth | Cookie de rafraîchissement (`credentials: 'include'`), sans corps utile, sans `Authorization` |
| Cache côté app | jamais — `no-store` |
| Délai max | 15 s |
| Contrat contrôlé | `refreshSessionSchema` |
| Appelé | Au démarrage (session connue mais pas de jeton en mémoire), au retour du réseau, au retour sur l’app, et après toute réponse 401 d’une route « Client » |

**Exemple**

```http
POST /api/auth/refresh
Content-Type: application/json
Cookie: drc_refresh=…
```

**Réponse 200** — remplace le cookie (rotation, §2.4.3)

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.…",
  "user": { "id": "usr-junior-01", "phone": "+237690000001", "firstName": "Junior", "lastName": "Mbarga", "city": "Douala", "createdAt": "2026-09-15T10:00:00.000Z" }
}
```

`user` est facultatif mais conseillé (profil remis à jour au démarrage).

**Erreurs** : voir le tableau du §2.4.4. Session refusée : **401** `{ "code": "NO_SESSION", "message": "Aucune session active." }` (ou 403). Toute autre erreur garde le client connecté côté app.

**Remarques**

- Un seul rafraîchissement à la fois par onglet : les appels simultanés attendent le même résultat.
- Si le rafraîchissement suit une 401 et échoue faute de réseau, l’app affiche une erreur réseau, pas « session expirée ».

### 4.4 `POST /auth/logout` — Se déconnecter

| | |
| --- | --- |
| Auth | Cookie de rafraîchissement ; `Authorization` envoyé s’il reste un jeton en mémoire (l’app ne rafraîchit pas sur cette route) |
| Cache côté app | jamais — `no-store` |
| Délai max | 15 s |

**Exemple** : `POST /api/auth/logout` sans corps.

**Réponse 204** sans corps, avec un `Set-Cookie` qui **efface** le cookie de rafraîchissement (`Max-Age=0`, même `Path`) et révoque le jeton côté serveur.

**Erreurs** : aucune attendue. Répondre **204 même si la session a déjà expiré** (ne jamais exiger un jeton d’accès valide). L’app ignore toute erreur : la déconnexion locale a toujours lieu.

**Remarques**

- Ordre des appels à la déconnexion : `POST /push/unsubscribe` (avec la session, 3 s au plus), puis `POST /auth/logout`. Ensuite l’app vide la session, les réservations en mémoire, le cache `api-user` et la pastille de l’icône ; le panier est conservé.

---

## 5. Profil, adresses et favoris

### 5.1 `GET /me` — Profil du client

| | |
| --- | --- |
| Auth | Client |
| Cache côté app | `api-user` (voir §2.7.2) ; en mémoire 5 min |
| Contrat contrôlé | `userSchema` |

**Exemple** : `GET /api/me` avec `Authorization: Bearer …`

**Réponse 200** : objet `User` (annexe A).

```json
{ "id": "usr-junior-01", "phone": "+237690000001", "firstName": "Junior", "lastName": "Mbarga", "city": "Douala", "createdAt": "2026-09-15T10:00:00.000Z" }
```

**Erreurs** : 401 `UNAUTHORIZED` (« Veuillez vous connecter. ») → rafraîchissement automatique (§2.4.6).

**Remarques** : `firstName`, `lastName` et `city` sont omis tant que le client ne les a pas donnés (pas de `null`).

### 5.2 `PATCH /me` — Modifier le profil

| | |
| --- | --- |
| Auth | Client |
| Cache côté app | jamais — `no-store` |
| Appelé par | Étape « Votre prénom » après la première connexion ; page Profil > Mes informations |

**Corps** (tous les champs facultatifs, seuls les champs présents sont modifiés)

| Champ | Type | Règle |
| --- | --- | --- |
| `firstName` | chaîne | Prénom (obligatoire dans le formulaire). |
| `lastName` | chaîne | Nom ; peut être omis à l’étape « Votre prénom ». |
| `city` | chaîne | Ville (nom d’une ville de `GET /delivery/cities`). |

**Exemple**

```http
PATCH /api/me
Content-Type: application/json

{ "firstName": "Junior", "lastName": "Mbarga", "city": "Douala" }
```

**Réponse 200** : le `User` mis à jour (même forme que §5.1).

**Erreurs**

| HTTP | `code` | Ce que voit le client |
| --- | --- | --- |
| 422 | `VALIDATION_ERROR` (`details` par champ) | Page Mes informations : « L’enregistrement a échoué. Vérifiez votre connexion puis réessayez. » ; étape « Votre prénom » : rien (non bloquant, repris au formulaire de réservation). |
| 401 | — | Rafraîchissement automatique. |

### 5.3 `GET /me/addresses` — Carnet d’adresses

| | |
| --- | --- |
| Auth | Client |
| Cache côté app | `api-user` ; en mémoire 5 min |

**Réponse 200** : tableau d’`Address` (annexe A), **adresse par défaut en tête**.

```json
[
  {
    "id": "addr-junior-1",
    "label": "Maison",
    "city": "Douala",
    "district": "Bonamoussadi",
    "quarter": "Bonamoussadi",
    "landmark": "Après la pharmacie du carrefour Eto’o, portail noir en face du glacier",
    "details": "Après la pharmacie du carrefour Eto’o, portail noir en face du glacier",
    "receptionMode": "delivery",
    "recipientName": "Junior Mbarga",
    "recipientPhone": "+237690000001",
    "phone": "+237690000001",
    "isDefault": true
  }
]
```

**Remarques** : `quarter`, `details` et `phone` sont des doublons historiques de `district`, `landmark` et `recipientPhone` : les renvoyer avec la même valeur (à supprimer dans une version suivante).

### 5.4 `POST /me/addresses` — Ajouter une adresse

| | |
| --- | --- |
| Auth | Client |
| Cache côté app | jamais — `no-store` |
| Appelé par | Profil > Mes adresses (« Ajouter une adresse ») ; formulaire de réservation avec « Enregistrer cette adresse » (après la création de la réservation) |

**Corps** (`SaveAddressPayload`)

| Champ | Type | Obligatoire | Règle |
| --- | --- | --- | --- |
| `label` | chaîne | oui | `Maison`, `Bureau` ou `Autre`. |
| `city` | chaîne | oui | Nom de la ville (`DeliveryCity.name`). |
| `district` | chaîne | oui | Quartier pour une ville locale ; **le nom de la ville** pour une ville desservie par agence. |
| `landmark` | chaîne | oui | Point de repère pour une ville locale ; **le nom de l’agence** pour une ville desservie par agence. |
| `receptionMode` | `"delivery"` | oui | Toujours `delivery` aujourd’hui. |
| `agencyId` | chaîne ou `null` | non | Agence choisie (ville non locale) ; `null` pour une ville locale. |
| `recipientName` | chaîne | non | Destinataire (le client par défaut). |
| `recipientPhone` | chaîne E.164 | non | Téléphone du destinataire (celui du compte par défaut). |
| `isDefault` | booléen | non | `true` : devient l’adresse par défaut et retire ce statut aux autres. La première adresse est par défaut. |

**Exemple** (envoi par agence vers Yaoundé)

```json
{
  "label": "Autre",
  "city": "Yaoundé",
  "district": "Yaoundé",
  "landmark": "Agence Express Centre",
  "receptionMode": "delivery",
  "agencyId": "ag-yde-1",
  "recipientName": "Paul Essomba",
  "recipientPhone": "+237677889900"
}
```

**Réponse 201** : l’`Address` créée (avec `id`).

**Erreurs** : 422 `VALIDATION_ERROR` → « L’adresse n’a pas pu être enregistrée. Vérifiez votre connexion puis réessayez. » (Profil) ; échec silencieux après une réservation.

### 5.5 `PATCH /me/addresses/:id` — Modifier une adresse, la définir par défaut

| | |
| --- | --- |
| Auth | Client |
| Cache côté app | jamais — `no-store` |
| Paramètre de chemin | `id` : identifiant de l’adresse |

**Corps** : champs partiels de `SaveAddressPayload` (sans `id`). Règles :
- `isDefault: true` retire le statut « par défaut » à toutes les autres adresses du client ;
- **`agencyId: null` efface l’agence** (adresse passée d’une agence à une livraison locale) ; un champ absent n’est pas modifié.

**Exemples**

```json
{ "isDefault": true }
```

```json
{ "label": "Maison", "city": "Douala", "district": "Akwa", "landmark": "Immeuble Mirage 3e étage", "receptionMode": "delivery", "agencyId": null, "recipientName": "Junior Mbarga", "recipientPhone": "+237690000001" }
```

**Réponse 200** : l’`Address` mise à jour.

**Erreurs**

| HTTP | `code` | Ce que voit le client |
| --- | --- | --- |
| 404 | `ADDRESS_NOT_FOUND` (« Cette adresse est introuvable. ») | Modification : « L’adresse n’a pas pu être enregistrée… » ; « Définir par défaut » : l’étiquette revient sur l’ancienne carte. |
| 422 | `VALIDATION_ERROR` | Idem. |

**Remarques** : « Définir par défaut » est affiché tout de suite (mise à jour optimiste) puis annulé si l’appel échoue.

### 5.6 `DELETE /me/addresses/:id` — Supprimer une adresse

| | |
| --- | --- |
| Auth | Client |
| Cache côté app | jamais — `no-store` |

**Réponse 204** sans corps. Si l’adresse supprimée était l’adresse par défaut, **la première adresse restante devient l’adresse par défaut** (HYPOTHÈSE RAPPORT_M5 §5.5).

**Erreurs** : 404 `ADDRESS_NOT_FOUND` → la liste est rechargée.

**Remarques** : l’écran retire la carte tout de suite et n’appelle cette route qu’après les **5 s** pendant lesquelles « Annuler » reste possible.

### 5.7 `POST /favorites` — Fusionner les favoris du téléphone avec le compte

| | |
| --- | --- |
| Auth | Client |
| Cache côté app | jamais — `no-store` |
| Appelé | Juste après la connexion (§4.2), seulement si le téléphone a des favoris |

**Corps**

```json
{ "productIds": ["prod-01", "prod-04"] }
```

Les mocks acceptent aussi `{ "productId": "prod-01" }` (non utilisé par l’app).

**Réponse 200** : tableau de **tous** les identifiants de produits favoris du compte, après fusion sans doublon.

```json
["prod-01", "prod-04", "prod-14"]
```

**Erreurs** : toutes ignorées (silencieux).

**Remarques**
- Les favoris sont gérés **sur le téléphone** ; le serveur ne reçoit que des ajouts, à la connexion. Un favori retiré sur le téléphone revient donc à la connexion suivante (voir §16 et §17).
- Identifiant inconnu (article retiré) : l’ignorer, sans erreur.

---

## 6. Catalogue (catégories, produits, recherche, looks)

### 6.1 `GET /categories` — Catégories et sous-catégories

| | |
| --- | --- |
| Auth | Public |
| Cache côté app | `api-catalog` |

**Réponse 200** : tableau de `Category` (annexe A), dans l’ordre d’affichage. Les 3 catégories racines actuelles : `vetements` (sous-catégories `t-shirts`, `hoodies`, `pantalons`), `chaussures` (`sneakers`, `derbies`), `babouches` (`cuir-lisse`, `croco-embosse`).

```json
[
  {
    "id": "cat-vetements",
    "slug": "vetements",
    "name": "Vêtements",
    "description": "Coupes lourdes, coton épais et sérigraphies brutes signées DR Choco.",
    "image": "/mock/product-hoodie.svg",
    "coverImage": "/images/categories/vetements.webp",
    "fallbackImage": "/images/fallback/mood-vetements.svg",
    "productCount": 13,
    "subCategories": [
      { "id": "sub-tshirts", "slug": "t-shirts", "name": "T-shirts", "coverImage": "/images/categories/t-shirts.webp", "fallbackImage": "/images/fallback/mood-tshirts.svg", "productCount": 6 },
      { "id": "sub-hoodies", "slug": "hoodies", "name": "Hoodies", "coverImage": "/images/categories/hoodies.webp", "fallbackImage": "/images/fallback/mood-hoodies.svg", "productCount": 3 },
      { "id": "sub-pantalons", "slug": "pantalons", "name": "Pantalons", "coverImage": "/images/categories/pantalons.webp", "fallbackImage": "/images/fallback/mood-pantalons.svg", "productCount": 4 }
    ]
  }
]
```

**Remarques**
- HYPOTHÈSE : les catégories racines restent `vetements`, `chaussures` et `babouches` ; l’app ne reconnaît que ces trois slugs dans `/explorer/:category`. Une nouvelle catégorie racine demande une modification du front.
- `fallbackImage` : visuel de repli livré avec l’app (`/images/fallback/…`), affiché si la photo ne charge pas. Voir §17.

### 6.2 `GET /products` — Liste filtrée et paginée

| | |
| --- | --- |
| Auth | Public |
| Cache côté app | `api-catalog` ; résultats précédents gardés à l’écran pendant le chargement d’un nouveau filtre |
| Contrat contrôlé | `productsPageSchema` |
| Appelé par | Accueil (nouveautés, meilleures ventes, babouches), Explorer (pagination infinie), recherche, panier (« Vous aimerez aussi »), favoris, compteur « Voir N articles » des filtres |

**Paramètres de requête** (tous facultatifs ; sans paramètre : tout le catalogue, tri `popular`, page 1, 12 articles)

| Paramètre | Valeurs | Règle |
| --- | --- | --- |
| `category` | `vetements`, `chaussures`, `babouches` | Catégorie racine. Les mocks acceptent aussi un slug de sous-catégorie. |
| `sub` | `t-shirts`, `hoodies`, `pantalons`, `sneakers`, `derbies`, `cuir-lisse`, `croco-embosse` | Sous-catégorie. |
| `size` | **répétable** : `size=L&size=XL` ; `S`, `M`, `L`, `XL`, `XXL`, `39` à `46`, `Unique` | Articles ayant **du stock** dans au moins une des tailles. Les mocks acceptent aussi `size=L,XL`. |
| `price` | `0-15000`, `15000-30000`, `30000-50000`, `50000+` (encodé `50000%2B`) | Tranches : < 15 000 ; 15 000 à 30 000 inclus ; > 30 000 à 50 000 inclus ; > 50 000. |
| `available` | `1` | Seulement les articles ayant du stock. Absent (ou `0`) : pas de filtre. |
| `look` | identifiant de look (`look-1`) | Pièces du look. |
| `q` | texte libre | Recherche sans tenir compte des accents ni de la casse, sur le nom, la description, la catégorie, la sous-catégorie et les tailles. |
| `sort` | `popular`, `newest`, `price-asc`, `price-desc` | Voir §2.6. |
| `page` | entier ≥ 1 | Défaut 1. |
| `pageSize` | entier, 1 à 50 | Défaut 12. L’app envoie 1, 4, 8, 12, 24 ou 50. |
| `minPrice`, `maxPrice` | entiers FCFA | Prévus par le type `ProductFilters` et gérés par les mocks, **jamais envoyés** par l’app aujourd’hui. Facultatifs. |

**Exemple**

```http
GET /api/products?category=vetements&sub=hoodies&size=L&size=XL&price=30000-50000&available=1&sort=price-asc&page=1&pageSize=12
```

**Réponse 200** (`ProductsResponse` = `Paginated<Product>` + `facets`)

```json
{
  "items": [ { "id": "prod-01", "slug": "hoodie-barbele-noir", "name": "Hoodie Barbelé Noir", "price": 45000, "…": "objet Product complet, voir §6.3" } ],
  "page": 1,
  "pageSize": 12,
  "total": 2,
  "totalPages": 1,
  "facets": {
    "sizes": [ { "value": "S", "count": 9 }, { "value": "M", "count": 9 }, { "value": "L", "count": 10 }, { "value": "XL", "count": 9 }, { "value": "XXL", "count": 7 }, { "value": "Unique", "count": 1 } ],
    "priceRanges": [
      { "value": "0-15000", "label": "Moins de 15 000 FCFA", "count": 2 },
      { "value": "15000-30000", "label": "15 000 – 30 000 FCFA", "count": 5 },
      { "value": "30000-50000", "label": "30 000 – 50 000 FCFA", "count": 6 },
      { "value": "50000+", "label": "Plus de 50 000 FCFA", "count": 0 }
    ],
    "subCategories": [ { "slug": "t-shirts", "name": "T-shirts", "count": 6 }, { "slug": "hoodies", "name": "Hoodies", "count": 3 }, { "slug": "pantalons", "name": "Pantalons", "count": 4 } ]
  }
}
```

(La clé `"…"` ci-dessus abrège l’exemple : chaque élément de `items` est un objet `Product`.)

**Champs**
- `items` : objets `Product`. Les champs exigés pour une carte sont listés dans l’annexe A (« carte produit ») ; renvoyer de préférence l’objet complet (la fiche s’affiche alors tout de suite depuis la liste).
- `facets` (facultatif mais attendu par les filtres) :
  - calculées sur les articles de la **catégorie demandée**, avant les autres filtres (comme les mocks) ;
  - `sizes` : tailles de la catégorie (`S` à `XXL` et `Unique` pour les vêtements, `39` à `46` pour chaussures et babouches, toutes sinon) avec le nombre d’articles ayant du stock dans cette taille ;
  - `priceRanges` : les 4 tranches avec leur libellé et leur nombre ;
  - `subCategories` : sous-catégories de la catégorie (toutes sans catégorie) avec leur nombre.

**Erreurs** : 5xx → « Impossible de charger le catalogue. Vérifiez votre connexion internet et réessayez dans un instant. » (ou l’écran « Hors connexion » sans réseau). Un filtre inconnu est ignoré (pas de 422).

**Remarques** : mocks, `q=__error__` simule une erreur 500 (à ne pas reproduire) ; délai 300 à 900 ms.

### 6.3 `GET /products/:slug` — Fiche produit

| | |
| --- | --- |
| Auth | Public |
| Cache côté app | `api-catalog` ; en mémoire 5 min ; préchargée au survol (150 ms) ou au toucher d’une carte |
| Contrat contrôlé | `productDetailSchema` |
| Paramètre de chemin | `slug` |

**Réponse 200** : `Product` complet + `related` (articles associés, 6 au plus).

```json
{
  "id": "prod-01",
  "slug": "hoodie-barbele-noir",
  "name": "Hoodie Barbelé Noir",
  "description": "Molleton lourd 480 g/m² à la coupe boxy et aux épaules tombantes. Sa broderie poitrine haute densité et sa capuche doublée sans cordon signent l’allure brute de L’Incompris. Conçu pour garder son volume lavage après lavage.",
  "composition": "100 % coton peigné lourd, 480 g/m²",
  "careInstructions": [
    "Lavage en machine à 30 °C sur l’envers avec des couleurs similaires.",
    "Séchage à l’air libre à l’ombre pour préserver la densité du coton et de la sérigraphie.",
    "Repassage doux sur l’envers uniquement, sans passer le fer sur les motifs."
  ],
  "sizeGuide": {
    "type": "clothing",
    "title": "Guide des tailles — Vêtements (coupe ample)",
    "tip": "Entre deux tailles ? Prenez la plus grande pour un rendu oversize assumé, ou la plus petite pour un tombé plus ajusté.",
    "headers": ["Taille", "Tour de poitrine (cm)", "Longueur dos (cm)", "Épaules (cm)"],
    "rows": [["S", "104 – 108", "69", "52"], ["M", "110 – 114", "72", "54"], ["L", "116 – 120", "74", "56"], ["XL", "122 – 126", "77", "58"], ["XXL", "128 – 134", "79", "61"]]
  },
  "categorySlug": "vetements",
  "subCategorySlug": "hoodies",
  "price": 45000,
  "images": ["/images/products/hoodie-barbele-noir-1.webp", "/images/products/hoodie-barbele-noir-2.webp", "/images/products/hoodie-barbele-noir-3.webp"],
  "fallbackImages": ["/mock/product-hoodie.svg", "/mock/product-tee.svg", "/mock/product-pants.svg"],
  "mediaGallery": [
    { "url": "/images/products/hoodie-barbele-noir-1.webp", "fallbackUrl": "/mock/product-hoodie.svg", "colorCode": "noir", "alt": "Hoodie Barbelé Noir — Noir Charbon" },
    { "url": "/images/products/hoodie-barbele-noir-2.webp", "fallbackUrl": "/mock/product-tee.svg", "colorCode": "gris", "alt": "Hoodie Barbelé Noir — Gris Béton" },
    { "url": "/images/products/hoodie-barbele-noir-3.webp", "fallbackUrl": "/mock/product-pants.svg", "colorCode": "noir", "alt": "Hoodie Barbelé Noir — Vue 3" }
  ],
  "colors": [ { "code": "noir", "name": "Noir Charbon", "hex": "#1A1A18" }, { "code": "gris", "name": "Gris Béton", "hex": "#87888A" } ],
  "sizes": ["S", "M", "L", "XL", "XXL"],
  "variants": [
    { "id": "prod-01-noir-s", "size": "S", "colorCode": "noir", "stock": 4 },
    { "id": "prod-01-noir-m", "size": "M", "colorCode": "noir", "stock": 6 },
    { "id": "prod-01-noir-l", "size": "L", "colorCode": "noir", "stock": 2 },
    { "id": "prod-01-noir-xl", "size": "XL", "colorCode": "noir", "stock": 1 },
    { "id": "prod-01-noir-xxl", "size": "XXL", "colorCode": "noir", "stock": 0 },
    { "id": "prod-01-gris-s", "size": "S", "colorCode": "gris", "stock": 0 },
    { "id": "prod-01-gris-m", "size": "M", "colorCode": "gris", "stock": 0 },
    { "id": "prod-01-gris-l", "size": "L", "colorCode": "gris", "stock": 0 },
    { "id": "prod-01-gris-xl", "size": "XL", "colorCode": "gris", "stock": 0 },
    { "id": "prod-01-gris-xxl", "size": "XXL", "colorCode": "gris", "stock": 0 }
  ],
  "isNew": true,
  "reservationsCount": 142,
  "badges": ["new"],
  "createdAt": "2026-10-28T10:00:00.000Z",
  "related": [
    {
      "id": "prod-14", "slug": "hoodie-zip-armure", "name": "Hoodie Zippé Armure", "price": 49000,
      "categorySlug": "vetements", "subCategorySlug": "hoodies",
      "images": ["/images/products/hoodie-zip-armure-1.webp", "/images/products/hoodie-zip-armure-2.webp", "/images/products/hoodie-zip-armure-3.webp"],
      "fallbackImages": ["/mock/product-hoodie.svg", "/mock/product-pants.svg", "/mock/product-hoodie.svg"],
      "colors": [ { "code": "noir", "name": "Noir Charbon", "hex": "#1A1A18" } ],
      "sizes": ["S", "M", "L", "XL", "XXL"],
      "variants": [ { "id": "prod-14-noir-s", "size": "S", "colorCode": "noir", "stock": 0 }, { "id": "prod-14-noir-m", "size": "M", "colorCode": "noir", "stock": 0 }, { "id": "prod-14-noir-l", "size": "L", "colorCode": "noir", "stock": 2 }, { "id": "prod-14-noir-xl", "size": "XL", "colorCode": "noir", "stock": 1 }, { "id": "prod-14-noir-xxl", "size": "XXL", "colorCode": "noir", "stock": 0 } ],
      "badges": ["low-stock", "new"], "isNew": true, "reservationsCount": 71, "createdAt": "2026-10-15T10:00:00.000Z"
    }
  ]
}
```

En production, `images`, `mediaGallery[].url` et les autres photos du catalogue sont des URL Cloudinary publiques ou des identifiants publics (§2.9) ; les chemins `/images/…` et `/mock/…` sont ceux des données de démonstration.

**Erreurs**

| HTTP | `code` | Ce que voit le client |
| --- | --- | --- |
| 404 | **`NOT_FOUND`** (obligatoirement ce code ; message mock : « Cet article n’existe plus. ») | « ARTICLE INTROUVABLE — Cet article n’existe plus ou a été déplacé », avec des articles populaires. L’app reconnaît le cas **par le code** et non par le statut : un autre code (ex. `PRODUCT_NOT_FOUND`) afficherait à tort « Impossible de charger cet article ». |
| 5xx | — | « Impossible de charger cet article. Vérifiez votre connexion internet et réessayez. » |

**Remarques**
- `related` est facultatif (liste vide si absent) ; chaque élément doit au moins respecter la « carte produit » (annexe A).
- Chaque couleur doit avoir au moins une photo dans `mediaGallery` (`colorCode`) pour que la photo change avec la couleur (SP-003).
- Mocks : slug `__error__` → 500 simulée (à ne pas reproduire).

### 6.4 `GET /search/suggest` — Suggestions de recherche

| | |
| --- | --- |
| Auth | Public |
| Cache côté app | `api-catalog` ; en mémoire 60 s |
| Paramètre | `q` (texte, 2 caractères au moins après suppression des espaces) |
| Appelé | Pendant la saisie, 250 ms après la dernière touche |

**Exemple** : `GET /api/search/suggest?q=babouche`

**Réponse 200**

```json
{
  "query": "babouche",
  "categories": [ { "slug": "babouches", "name": "Babouches", "productCount": 6 } ],
  "products": [
    { "id": "prod-03", "slug": "babouche-royale-akwa-cuir", "name": "Babouche Royale Akwa Cuir", "price": 35000, "image": "/images/products/babouche-royale-akwa-cuir-1.webp", "fallbackImage": "/mock/product-babouches.svg", "categorySlug": "babouches", "totalStock": 22 },
    { "id": "prod-06", "slug": "babouche-croco-nocturne", "name": "Babouche Croco Nocturne", "price": 42000, "image": "/images/products/babouche-croco-nocturne-1.webp", "fallbackImage": "/mock/product-babouches.svg", "categorySlug": "babouches", "totalStock": 2 }
  ],
  "totalProducts": 6
}
```

| Champ | Règle |
| --- | --- |
| `query` | Texte reçu, tel quel. |
| `categories` | 4 au plus ; `parentSlug` présent pour une sous-catégorie. |
| `products` | 6 au plus ; `totalStock` facultatif (somme des stocks, sert au badge « épuisé »). |
| `totalProducts` | Nombre total de résultats (« Voir les N résultats »). |

Moins de 2 caractères : 200 avec des listes vides et `totalProducts: 0`. **Erreurs** : aucune affichée (les suggestions disparaissent).

Mocks : délai 180 à 430 ms. Objectif : rester sous 300 ms (saisie en direct).

### 6.5 `GET /looks` — Looks de l’accueil

| | |
| --- | --- |
| Auth | Public |
| Cache côté app | `api-catalog` |

**Réponse 200** : tableau de `LookbookItem` (annexe A).

```json
[
  { "id": "look-1", "title": "Total black barbelé", "subtitle": "Hoodie 480 gsm + Cargo tactique", "image": "/images/looks/look-1.webp", "fallback": "/images/fallback/mood-portrait.svg", "productSlugs": ["hoodie-barbele-noir", "cargo-tactique-bitume"] }
]
```

**Remarques** : liste vide possible (section masquée, comportement à vérifier, SP-005). Les slugs de `productSlugs` doivent exister.

### 6.6 `GET /looks/:id` — Détail d’un look

| | |
| --- | --- |
| Auth | Public |
| Cache côté app | `api-catalog` ; en mémoire 5 min |

**Réponse 200** : `LookbookItem` + `products` (objets `Product` des pièces du look, dans l’ordre de `productSlugs`, en ignorant les articles retirés).

**Erreurs** : 404 `NOT_FOUND` (« Ce look est introuvable. »).

**Remarque** : appelée par la page Explorer quand l’adresse contient `?look=…`, pour afficher le look choisi au-dessus de la grille ; la grille elle-même vient de `GET /products?look=…`. Un 404 masque simplement l’en-tête du look.

---

## 7. Paramètres publics

### 7.1 `GET /settings/public` — Paramètres de la boutique et du paiement

| | |
| --- | --- |
| Auth | Public |
| Cache côté app | `api-catalog` ; la partie `payment` et `whatsappNumber` sont aussi gardés sur le téléphone (`localStorage`) pour afficher l’écran de paiement hors connexion |
| Contrat contrôlé | `publicSettingsSchema` |
| Délai max | 15 s (8 s pour le bouton « Réessayer » hors connexion, qui appelle cette route pour tester le réseau) |

**Réponse 200** (`PublicSettings`, annexe A)

```json
{
  "whatsappNumber": "+237690000000",
  "deliveryFeePayment": "upfront",
  "reservationHoldHours": 24,
  "reservationExpiryHours": 24,
  "shop": {
    "name": "Flagship DR Choco L'Incompris",
    "address": "Akwa, Boulevard de la Liberté — À 100 m de la Cathédrale, immeuble anthracite rez-de-chaussée",
    "city": "Douala",
    "openingHours": "Lun – Sam · 09 h 30 à 19 h 30",
    "mapsUrl": "https://maps.google.com/?q=Boulevard+de+la+Liberte+Akwa+Douala+Cameroun"
  },
  "payment": {
    "operators": [
      {
        "id": "orange",
        "label": "Orange Money",
        "merchantName": "ETS DR CHOCO LINCOMPRIS",
        "merchantCode": "000111",
        "ussdTemplate": "#000*1*{code}*{amount}#",
        "qrImageUrl": "/mock/qr-orange.svg",
        "steps": [
          "Appuyez sur « Composer le code de paiement » ou ouvrez Orange Money.",
          "Vérifiez que le destinataire affiché est bien « ETS DR CHOCO LINCOMPRIS » (code 000111).",
          "Confirmez le montant exact avec votre code secret Orange Money."
        ],
        "enabled": true
      },
      {
        "id": "mtn",
        "label": "MTN MoMo",
        "merchantName": "DR CHOCO BOUTIQUE SARL",
        "merchantCode": "000222",
        "ussdTemplate": "*000*2*{code}*{amount}#",
        "qrImageUrl": "/mock/qr-mtn.svg",
        "steps": [
          "Appuyez sur « Composer le code de paiement » ou ouvrez l’application MTN MoMo.",
          "Vérifiez que le nom du marchand est « DR CHOCO BOUTIQUE SARL » (code 000222).",
          "Validez le montant exact avec votre code PIN MTN Mobile Money."
        ],
        "enabled": true
      }
    ],
    "exactAmountRequired": true,
    "validationDelayText": "en général en moins d'une heure, de 8 h à 20 h",
    "proofMaxSizeMb": 10
  },
  "pickupAddress": {
    "name": "Flagship DR Choco L'Incompris",
    "city": "Douala",
    "quarter": "Akwa, Boulevard de la Liberté",
    "landmark": "À 100 m de la Cathédrale, immeuble anthracite rez-de-chaussée",
    "openingHours": "Lun – Sam · 09 h 30 à 19 h 30"
  }
}
```

Tous les codes marchands, formules USSD et QR ci-dessus sont **fictifs** (SP-015, SP-016) : les vrais sont saisis dans l’administration, jamais écrits dans le code du front.

**Champs exigés par le contrat** : `whatsappNumber`, `deliveryFeePayment` (`upfront` ou `on_delivery`), `shop` (5 champs), `payment.operators` (chaque opérateur avec ses 8 champs), `payment.validationDelayText`. Facultatifs : `payment.exactAmountRequired` (vrai par défaut), `payment.proofMaxSizeMb` (10 par défaut), `pickupAddress` (lu par le pied de page), `operators` (ancien format M1/M2, plus lu), `reservationExpiryHours` et `reservationHoldHours` (le front s’appuie sur `expiresAt` de chaque réservation).

**Remarques**
- `ussdTemplate` : `{code}` est remplacé par le code marchand et `{amount}` par le montant entier. `null` si l’opérateur ne se paie que par son application ; `qrImageUrl` : `null` si pas de QR.
- `enabled: false` masque l’opérateur.
- Si cette route n’a jamais répondu (première visite hors connexion), l’app affiche aujourd’hui des valeurs de secours fictives (écart SP-018, correction prévue côté front) : la route doit être fiable.
- `deliveryFeePayment` change le calcul du montant à payer (§10.1).

---

## 8. Livraison (villes, agences)

### 8.1 `GET /delivery/cities` — Villes desservies

| | |
| --- | --- |
| Auth | Public |
| Cache côté app | `api-catalog` ; en mémoire 1 h |

**Réponse 200** : tableau de `DeliveryCity` (annexe A), dans l’ordre d’affichage.

```json
[
  { "id": "city-dla", "name": "Douala", "fee": 1500, "isLocal": true, "hasAgencies": false, "estimatedDelay": "Aujourd'hui ou demain" },
  { "id": "city-baf", "name": "Bafoussam", "fee": 3000, "isLocal": false, "hasAgencies": true, "estimatedDelay": "1 à 3 jours" },
  { "id": "city-yde", "name": "Yaoundé", "fee": 2500, "isLocal": false, "hasAgencies": true, "estimatedDelay": "1 à 2 jours" }
]
```

**Remarques**
- `isLocal: true` : livraison à domicile (quartier et point de repère demandés). Sinon envoi par agence (`hasAgencies: true`) : l’agence et le destinataire sont demandés.
- Les données de démonstration comptent 15 villes (Douala et 14 villes par agence, de 2 000 à 5 000 FCFA) : à remplacer par les vraies (SP-031).

### 8.2 `GET /delivery/agencies` — Agences d’une ville

| | |
| --- | --- |
| Auth | Public |
| Cache côté app | `api-catalog` ; en mémoire 1 h |
| Paramètre | `city` : **nom de la ville** tel que renvoyé par `GET /delivery/cities` (`Yaoundé`), car le formulaire garde le nom |
| Appelé | Seulement pour une ville non locale ; jamais sans `city` |

**Exemple** : `GET /api/delivery/agencies?city=Yaound%C3%A9`

**Réponse 200** : tableau d’`Agency` (annexe A).

```json
[
  { "id": "ag-yde-1", "cityId": "city-yde", "city": "Yaoundé", "name": "Agence Express Centre", "address": "Mvan, Avenue du Sud face station-service", "phone": "+237 690 10 11 01", "openingHours": "Tous les jours · 06 h 30 à 21 h 00" },
  { "id": "ag-yde-2", "cityId": "city-yde", "city": "Yaoundé", "name": "Relais des Sept Collines", "address": "Biymassi, Carrefour Acacias", "phone": "+237 677 10 11 02", "openingHours": "Lun – Sam · 07 h 00 à 20 h 00" }
]
```

**Remarques**
- Comparer `city` sans tenir compte des accents ni de la casse, et accepter aussi l’identifiant (`city-yde`), comme les mocks. Ville inconnue : 200 avec `[]` (le formulaire indique qu’aucune agence n’est disponible).
- Sans paramètre `city`, les mocks renvoient toutes les agences (non utilisé par l’app).

---

## 9. Panier

### 9.1 `POST /cart/validate` — Vérifier le stock et les prix du panier

| | |
| --- | --- |
| Auth | **Public** (appelé avant la connexion, sur le panier) |
| Cache côté app | jamais — `no-store` |
| Délai max | **2 s** au moment de réserver (au-delà, l’app continue vers le formulaire ; le stock sera revérifié par `POST /reservations`) ; 15 s pour « Réserver à nouveau » |
| Appelé par | Panier et panier latéral (« Réserver »), ouverture du panier, « Réserver à nouveau » (§10.9) |

**Corps**

```json
{ "items": [ { "variantId": "prod-01-noir-l", "quantity": 2 }, { "variantId": "prod-04-noir-42", "quantity": 1 } ] }
```

Panier vide : l’app n’appelle pas la route.

**Réponse 200**

```json
{
  "checkedAt": "2026-10-31T11:00:00.000Z",
  "items": [
    { "variantId": "prod-01-noir-l", "status": "ok", "availableQuantity": 2, "unitPrice": 45000 },
    { "variantId": "prod-04-noir-42", "status": "reduced", "availableQuantity": 1, "unitPrice": 65000 }
  ]
}
```

| Champ | Règle |
| --- | --- |
| `checkedAt` | Date de la vérification. |
| `items[].variantId` | Une entrée par variante reçue, même ordre. |
| `items[].status` | `ok` ; `reduced` (stock inférieur à la quantité : l’app ramène la quantité à `availableQuantity`) ; `unavailable` (épuisé, variante ou article inconnu ou retiré : ligne grisée, réservation bloquée tant qu’elle reste) ; `price_changed` (prix différent : l’app affiche le nouveau prix et l’ancien barré). |
| `items[].availableQuantity` | Quantité réservable (sert de plafond au sélecteur de quantité). 0 pour `unavailable`. |
| `items[].unitPrice` | Prix actuel en FCFA ; l’app remplace le prix du panier. |
| `items[].previousPrice` | Facultatif, avec `price_changed` : ancien prix (sinon l’app prend le prix du panier). |

**Erreurs** : aucune affichée. **Une variante inconnue ne doit jamais provoquer de 404 ou de 422** : renvoyer `unavailable` (« Réserver à nouveau » envoie des variantes d’anciennes réservations, parfois retirées).

**Remarques**
- Le corps ne contient pas le prix vu par le client : le serveur ne peut donc pas savoir seul qu’un prix a changé. Aujourd’hui, l’app met le prix à jour sans le signaler ; voir §17.
- `availableQuantity` révèle le stock exact (comme `variants[].stock`) : à plafonner si la boutique le souhaite (HYPOTHÈSE).
- Mocks : l’en-tête `x-mock-chaos: 1` ou `VITE_MOCK_STOCK_CHAOS=true` simulent des baisses de stock (outil de test, à ne pas implémenter).

---

## 10. Réservations

Une réservation met les articles de côté **24 h** (`reservationHoldHours`) en attendant le paiement Mobile Money et la preuve de paiement. Statuts et transitions : §14.

### 10.1 `POST /reservations` — Créer une réservation

| | |
| --- | --- |
| Auth | Client |
| En-tête particulier | **`Idempotency-Key`** (obligatoire, §2.5) |
| Cache côté app | jamais — `no-store` |
| Délai max | 15 s, puis 2 nouvelles tentatives automatiques avec la même clé |
| Contrat contrôlé | `reservationCreatedSchema` |

**Corps** (`CreateReservationPayload`)

| Champ | Type | Obligatoire | Règle |
| --- | --- | --- | --- |
| `receptionMode` | `delivery` ou `pickup` | oui | Livraison ou Retrait en boutique. |
| `items` | tableau | oui (≥ 1) | `{ productId, variantId, quantity }`. |
| `firstName`, `lastName` | chaînes | oui | Coordonnées du client. |
| `phone` | E.164 | oui | Numéro du compte connecté. Le propriétaire de la réservation est **le compte du jeton**, pas ce champ. |
| `city` | chaîne | oui | Nom de la ville de livraison ; pour `pickup`, l’app envoie `"Douala"` (à ignorer). |
| `district`, `landmark` | chaînes | si ville locale | Quartier et point de repère (livraison à domicile). |
| `agencyId` | chaîne | si ville par agence | Agence choisie. |
| `recipientType` | `self` ou `other` | oui | Qui reçoit le colis. |
| `recipientName` | chaîne | oui | Nom du destinataire (le client si `self`). |
| `recipientPhone` | E.164 | oui | Téléphone du destinataire (celui du compte si `self`). |
| `notes` | chaîne | non | Remarque du client (omise si vide). |
| `deliveryAddressId` | chaîne | non | Adresse du carnet choisie, si le client en a choisi une ; les champs d’adresse sont envoyés quand même. |

**Exemple** (envoi par agence vers Yaoundé, un proche récupère le colis)

```http
POST /api/reservations
Authorization: Bearer eyJ…
Content-Type: application/json
Idempotency-Key: 3f6c2a9e-8d41-4c7b-9f0e-2b5d7a1c4e88

{
  "receptionMode": "delivery",
  "items": [ { "productId": "prod-04", "variantId": "prod-04-noir-42", "quantity": 1 } ],
  "firstName": "Junior",
  "lastName": "Mbarga",
  "phone": "+237690000001",
  "city": "Yaoundé",
  "agencyId": "ag-yde-1",
  "recipientType": "other",
  "recipientName": "Paul Essomba",
  "recipientPhone": "+237677889900"
}
```

**Réponse 201** (`ReservationCreated` = `Reservation` + `serverTime` et `amount` obligatoires)

```json
{
  "ref": "RES-000124",
  "status": "reserved",
  "receptionMode": "delivery",
  "items": [
    { "id": "res-item-124-1", "productId": "prod-04", "slug": "sneaker-monolithe-v1", "name": "Sneaker Monolithe V1", "image": "/mock/product-shoes.svg", "variantId": "prod-04-noir-42", "size": "42", "colorName": "Noir Charbon", "colorCode": "noir", "colorHex": "#1A1A18", "unitPrice": 65000, "quantity": 1 }
  ],
  "subtotal": 65000,
  "deliveryFee": 2500,
  "total": 67500,
  "amount": { "subtotal": 65000, "deliveryFee": 2500, "total": 67500 },
  "city": "Yaoundé",
  "agency": { "id": "ag-yde-1", "name": "Agence Express Centre", "address": "Mvan, Avenue du Sud face station-service", "city": "Yaoundé", "phone": "+237 690 10 11 01", "openingHours": "Tous les jours · 06 h 30 à 21 h 00" },
  "deliveryAddress": { "city": "Yaoundé", "quarter": "Agence Express Centre", "agencyId": "ag-yde-1", "agencyName": "Agence Express Centre", "recipientName": "Paul Essomba", "recipientPhone": "+237677889900" },
  "customer": { "firstName": "Junior", "lastName": "Mbarga", "phone": "+237690000001" },
  "createdAt": "2026-10-31T11:00:00.000Z",
  "updatedAt": "2026-10-31T11:00:00.000Z",
  "expiresAt": "2026-11-01T11:00:00.000Z",
  "serverTime": "2026-10-31T11:00:00.000Z",
  "packagePhotos": [],
  "packageReadyAt": null,
  "timeline": [ { "status": "reserved", "at": "2026-10-31T11:00:00.000Z", "note": "Articles mis de côté pendant 24 h.", "actor": "client" } ],
  "cancellable": true,
  "cancelDeadline": null
}
```

**Règles de calcul**
- Le serveur recalcule **tous** les montants avec ses propres prix et frais (ne jamais faire confiance au client).
- `deliveryFee` : frais de la ville (`DeliveryCity.fee`) ; 0 pour `pickup`.
- `total` = `subtotal` + `deliveryFee` si `deliveryFeePayment = "upfront"` ; = `subtotal` si `"on_delivery"` (les frais restent affichés, à payer à la réception).
- `expiresAt` = `createdAt` + `reservationHoldHours` (24 h) ; `serverTime` = heure du serveur au moment de la réponse (l’app corrige l’horloge du téléphone pour le compte à rebours).
- Le stock des variantes est **bloqué** dès la création, et libéré à l’expiration ou à l’annulation.
- Références séquentielles `RES-` + 6 chiffres (les mocks commencent à `RES-000124`).

**Erreurs**

| HTTP | `code` | Quand | Ce que voit le client |
| --- | --- | --- | --- |
| 409 | `STOCK_CONFLICT` | Une variante n’a plus la quantité demandée (ou n’existe plus). `details.items` : tableau au format de `POST /cart/validate` (`variantId`, `status`, `availableQuantity`, `unitPrice`) | Retour au panier avec les lignes concernées mises à jour, et le message « Un article n’est plus disponible dans la quantité demandée. Vérifiez votre panier. » |
| 401 | — | Session expirée et rafraîchissement refusé | Feuille de connexion, puis l’envoi reprend avec la même clé. |
| 422 | `VALIDATION_ERROR` (`details` par champ) | Champ manquant ou invalide (agence d’une autre ville, ville inconnue…) | Aujourd’hui : « La connexion a été interrompue. Votre panier et vos informations sont conservés. » (message inadapté, correction demandée au front). |
| 422 | `IDEMPOTENCY_KEY_REUSED` | Même clé, corps différent (proposition) | Idem. |
| — | coupure ou délai dépassé | — | « La connexion a été interrompue. Nous vérifions si votre réservation a été créée… », 2 nouvelles tentatives avec la même clé (900 ms d’intervalle), puis le message ci-dessus et un bouton pour réessayer. |

Exemple de 409 :

```json
{
  "code": "STOCK_CONFLICT",
  "message": "Un article n’est plus disponible dans la quantité demandée. Vérifiez votre panier.",
  "details": { "items": [ { "variantId": "prod-04-noir-42", "status": "unavailable", "availableQuantity": 0, "unitPrice": 65000 } ] }
}
```

**Remarques**
- Après la création : le panier est vidé, l’adresse est enregistrée si demandé (`POST /me/addresses`), et l’app ouvre l’écran de paiement `/reservation/RES-000124/paiement`.
- Mocks : délai 1,2 s ; l’en-tête `x-mock-conflict: 1` force un 409 (outil de test).

### 10.2 `GET /reservations?status=reserved` — Réservations en attente de paiement

| | |
| --- | --- |
| Auth | Client |
| Cache côté app | `api-user` ; en mémoire 30 s ; relu au retour sur l’app |
| Contrat contrôlé | `reservationListSchema` (chaque élément est une **réservation complète**, §10.6) |
| Appelé | Dans toute l’app quand le client est connecté (bandeau « Réservation en attente de paiement ») |

**Réponse 200** : tableau de `Reservation` complètes du client **aux statuts `reserved` et `payment_rejected`** (les deux demandent un paiement ou une nouvelle preuve), triées par `createdAt` décroissant. Exemple : `[ { …réservation RES-000101… }, { …réservation RES-000103… } ]`.

**Remarques**
- Attention : malgré le nom du paramètre, `status=reserved` doit inclure `payment_rejected` (comportement des mocks et de l’app). Voir §17.
- L’app retient la première dont `expiresAt` n’est pas dépassé comme « réservation active ».
- Les mocks acceptent aussi `status=<autre statut>` (filtre exact) : non utilisé.

### 10.3 `GET /reservations?scope=active|done&page=N` — « Mes réservations »

| | |
| --- | --- |
| Auth | Client |
| Cache côté app | `api-user` ; relu toutes les 30 s (2 min avec les notifications) et au retour sur l’app |
| Contrat contrôlé | `reservationsPageSchema` |

**Paramètres**

| Paramètre | Valeurs | Règle |
| --- | --- | --- |
| `scope` | `active` | Statuts non finaux (tout sauf `delivered`, `picked_up`, `expired`, `cancelled`). |
| | `done` | Statuts finaux : `delivered`, `picked_up`, `expired`, `cancelled`. |
| `page` | entier ≥ 1 | 10 réservations par page (taille fixée par le serveur). |

**Exemple** : `GET /api/reservations?scope=active&page=1`

**Réponse 200** (`ReservationsListPage` : `Paginated<ReservationListItem>` + `counts`), triée par `updatedAt` décroissant (extrait : 2 des 8 éléments de la page)

```json
{
  "items": [
    {
      "ref": "RES-000103",
      "status": "payment_rejected",
      "createdAt": "2026-10-31T05:00:00.000Z",
      "updatedAt": "2026-10-31T06:12:00.000Z",
      "expiresAt": "2026-11-01T05:00:00.000Z",
      "serverTime": "2026-10-31T11:00:00.000Z",
      "amount": { "total": 67500 },
      "itemsCount": 1,
      "itemsPreview": [ { "image": "/mock/product-shoes.svg", "name": "Sneaker Monolithe V1" } ],
      "packagePhotoThumb": null,
      "receptionMode": "delivery",
      "city": "Yaoundé"
    },
    {
      "ref": "RES-000102",
      "status": "ready_for_pickup",
      "createdAt": "2026-10-29T07:00:00.000Z",
      "updatedAt": "2026-10-29T10:42:00.000Z",
      "serverTime": "2026-10-31T11:00:00.000Z",
      "amount": { "total": 80000 },
      "itemsCount": 2,
      "itemsPreview": [ { "image": "/mock/product-hoodie.svg", "name": "Hoodie Barbelé Noir" }, { "image": "/mock/product-babouches.svg", "name": "Babouche Royale Akwa Cuir" } ],
      "packagePhotoThumb": "https://res.cloudinary.com/drchoco/image/authenticated/s--Qm7rT2xP--/c_fill,w_160/v1730197200/reservations/RES-000102/colis-1.jpg",
      "receptionMode": "pickup",
      "city": "Douala"
    }
  ],
  "page": 1,
  "pageSize": 10,
  "total": 8,
  "totalPages": 1,
  "counts": { "active": 8, "done": 11 }
}
```

| Champ de l’élément | Règle |
| --- | --- |
| `expiresAt` | Seulement pour `reserved` et `payment_rejected` (compte à rebours sur la carte) ; omis sinon. |
| `itemsCount` | Somme des quantités. |
| `itemsPreview` | 3 articles au plus. |
| `packagePhotoThumb` | Miniature signée de la première photo du colis (§2.9), sinon `null` ou omis. |
| `city` | Ville de livraison ; ville de la boutique pour un retrait. |
| `reachedStatus` | Pour `expired` et `cancelled` seulement : dernier statut du parcours atteint avant l’arrêt (un rejet compte comme `pending_validation`). Sert à la barre d’avancement rouge « au point atteint ». |
| `counts` | Nombre total de réservations du client par onglet (« En cours (8) · Terminées (11) »), sur chaque page. |

### 10.4 `GET /reservations` (sans paramètre) — Toutes les réservations

| | |
| --- | --- |
| Auth | Client |
| Contrat contrôlé | `reservationListSchema` |
| Appelé par | **Le simulateur boutique de `/_dev` seulement** (pas l’app publiée) |

**Réponse 200** : tableau de toutes les `Reservation` complètes du client, triées par `createdAt` décroissant. Facultatif pour la mise en ligne ; utile si `/_dev` est réactivé en préproduction (voir `docs/INTEGRATION_API.md` §4).

### 10.5 `GET /reservations/summary` — Repère de l’onglet « Réservations »

| | |
| --- | --- |
| Auth | Client |
| Cache côté app | `api-user` ; relu toutes les 30 s (2 min avec les notifications) |
| Contrat contrôlé | `reservationsSummarySchema` |

Route à déclarer **avant** `/reservations/{ref}` dans le routeur Symfony (sinon `summary` est pris pour une référence).

**Réponse 200** (extrait : 3 des 8 entrées de `items`)

```json
{
  "needsAction": 3,
  "lastUpdatedAt": "2026-10-31T10:24:00.000Z",
  "items": [
    { "ref": "RES-000101", "status": "reserved", "updatedAt": "2026-10-30T16:00:00.000Z", "hasPackagePhotos": false },
    { "ref": "RES-000103", "status": "payment_rejected", "updatedAt": "2026-10-31T06:12:00.000Z", "hasPackagePhotos": false },
    { "ref": "RES-000102", "status": "ready_for_pickup", "updatedAt": "2026-10-29T10:42:00.000Z", "hasPackagePhotos": true }
  ]
}
```

| Champ | Règle |
| --- | --- |
| `needsAction` | Nombre de réservations en cours qui attendent une action du client : statuts `reserved`, `payment_rejected` et `ready_for_pickup` (HYPOTHÈSE M5, à valider avec le client, SP-023). Sert aussi à la pastille de l’icône de l’app. |
| `lastUpdatedAt` | `updatedAt` le plus récent de toutes les réservations du client, ou `null` s’il n’en a aucune. |
| `items` | Une entrée par réservation **en cours** (non finale). |

### 10.6 `GET /reservations/:ref` — Détail d’une réservation

| | |
| --- | --- |
| Auth | Client (propriétaire seulement) |
| Cache côté app | `api-user` ; relu toutes les 20 s sur paiement, preuve et Merci, 30 s sur le détail (2 min avec les notifications) |
| Contrat contrôlé | `reservationSchema` |
| Paramètre de chemin | `ref` (`RES-000103`, sans tenir compte de la casse) |
| Appelé par | Écrans paiement, preuve, Merci, détail de la réservation, « Réserver à nouveau » |

**Réponse 200** : `Reservation` complète (annexe A) avec `serverTime`. Exemple : réservation par agence dont la preuve a été rejetée.

```json
{
  "ref": "RES-000103",
  "status": "payment_rejected",
  "receptionMode": "delivery",
  "items": [
    { "id": "item-RES-000103-1", "productId": "prod-04", "slug": "sneaker-monolithe-v1", "name": "Sneaker Monolithe V1", "image": "/mock/product-shoes.svg", "variantId": "prod-04-noir-42", "size": "42", "colorName": "Noir Charbon", "colorCode": "noir", "colorHex": "#1A1A18", "unitPrice": 65000, "quantity": 1 }
  ],
  "subtotal": 65000,
  "deliveryFee": 2500,
  "total": 67500,
  "amount": { "subtotal": 65000, "deliveryFee": 2500, "total": 67500 },
  "city": "Yaoundé",
  "agency": { "id": "ag-yde-1", "name": "Agence Express Centre", "address": "Mvan, Avenue du Sud face station-service", "city": "Yaoundé", "phone": "+237 690 10 11 01", "openingHours": "Tous les jours · 06 h 30 à 21 h 00" },
  "deliveryAddress": { "city": "Yaoundé", "quarter": "Agence Express Centre", "agencyId": "ag-yde-1", "agencyName": "Agence Express Centre", "recipientName": "Paul Essomba", "recipientPhone": "+237677889900" },
  "proof": {
    "thumbnailUrl": "https://res.cloudinary.com/drchoco/image/authenticated/s--Hn4cW8eL--/c_fill,w_320/v1730352600/preuves/RES-000103/preuve.jpg",
    "uploadedAt": "2026-10-31T05:30:00.000Z",
    "operator": "mtn"
  },
  "rejection": { "reason": "Montant incorrect", "rejectedAt": "2026-10-31T06:12:00.000Z" },
  "rejectionReason": "Montant incorrect",
  "customer": { "firstName": "Junior", "lastName": "Mbarga", "phone": "+237690000001" },
  "createdAt": "2026-10-31T05:00:00.000Z",
  "updatedAt": "2026-10-31T06:12:00.000Z",
  "expiresAt": "2026-11-01T05:00:00.000Z",
  "serverTime": "2026-10-31T11:00:00.000Z",
  "packagePhotos": [],
  "packageReadyAt": null,
  "timeline": [
    { "status": "reserved", "at": "2026-10-31T05:00:00.000Z", "note": "Articles mis de côté pendant 24 h.", "actor": "client" },
    { "status": "pending_validation", "at": "2026-10-31T05:30:00.000Z", "note": "Capture MTN MoMo reçue.", "actor": "client" },
    { "status": "payment_rejected", "at": "2026-10-31T06:12:00.000Z", "note": "Montant incorrect", "actor": "shop" }
  ],
  "cancellable": true,
  "cancelDeadline": null
}
```

Extrait d’une réservation prête pour retrait, avec les photos du colis :

```json
{
  "ref": "RES-000102",
  "status": "ready_for_pickup",
  "receptionMode": "pickup",
  "city": "Douala",
  "subtotal": 80000,
  "deliveryFee": 0,
  "total": 80000,
  "packageReadyAt": "2026-10-29T10:36:00.000Z",
  "packagePhotos": [
    {
      "id": "pkg-RES-000102-1",
      "url": "https://res.cloudinary.com/drchoco/image/authenticated/s--Zr8pK1vN--/c_limit,w_1600/v1730197200/reservations/RES-000102/colis-1.jpg",
      "thumbnailUrl": "https://res.cloudinary.com/drchoco/image/authenticated/s--Qm7rT2xP--/c_fill,w_160/v1730197200/reservations/RES-000102/colis-1.jpg",
      "width": 800,
      "height": 600,
      "takenAt": "2026-10-29T10:34:48.000Z"
    }
  ],
  "timeline": [
    { "status": "reserved", "at": "2026-10-29T07:00:00.000Z", "note": "Articles mis de côté pendant 24 h.", "actor": "client" },
    { "status": "pending_validation", "at": "2026-10-29T07:12:00.000Z", "note": "Capture Orange Money reçue.", "actor": "client" },
    { "status": "confirmed", "at": "2026-10-29T07:30:00.000Z", "note": "Paiement validé par la boutique.", "actor": "shop" },
    { "status": "preparing", "at": "2026-10-29T09:00:00.000Z", "actor": "shop" },
    { "status": "ready_for_pickup", "at": "2026-10-29T10:42:00.000Z", "note": "Colis prêt à la boutique d’Akwa.", "actor": "shop" }
  ],
  "cancellable": false,
  "cancelDeadline": null
}
```

**Champs et règles** (détail dans l’annexe A)
- `expiresAt` : **toujours présent**, y compris après le paiement (échéance initiale du paiement ; l’écran de paiement ne peut pas s’en passer).
- `serverTime` : heure du serveur, dans **toutes** les réponses de réservation (comptes à rebours, RAPPORT_M5 §5.8).
- `timeline` : **journal daté**, une entrée par changement de statut, du plus ancien au plus récent. Un rejet suivi d’une nouvelle preuve donne deux entrées (`payment_rejected` puis `pending_validation`). Les étapes à venir n’y figurent pas : l’app les déduit du parcours (§14.2). `note` est affichée telle quelle sous l’étape ; `actor` (`client`, `shop`, `system`) permet « Annulée par vous » ou « par la boutique ».
- `cancellable` : **calculé par le serveur** ; l’app affiche « Annuler la réservation » seulement s’il est vrai, sans appliquer de règle elle-même. Règle actuelle (HYPOTHÈSE M5, SP-020) : vrai pour `reserved`, `payment_rejected`, `pending_validation` et `confirmed`, faux ensuite. `cancelDeadline` : date limite facultative, ou `null`.
- `packagePhotos` : 1 à 3 photos (3 conseillées : vue d’ensemble, étiquette, scellé), URL signées (§2.9), `width` et `height` réels (format d’affichage) ; `[]` tant que le colis n’est pas prêt. `packageReadyAt` : date d’emballage, ou `null`.
- Livraison à domicile (sans agence) : l’app le reconnaît à l’absence de `agency.name` et de `deliveryAddress.agencyName`, et affiche l’étape `handed_to_agency` sous le libellé « Colis prêt pour la livraison ».
- Doublons historiques à renvoyer de façon cohérente : `subtotal`/`deliveryFee`/`total` et `amount` ; `rejection` et `rejectionReason` ; `city`/`address` et `deliveryAddress` ; `agency` et `deliveryAddress.agencyName`.
- `items[].colorCode` et `colorHex` : pour remettre l’article au panier dans la bonne couleur (« Réserver à nouveau », SP-098).

**Erreurs**

| HTTP | `code` | Quand | Ce que voit le client |
| --- | --- | --- | --- |
| 404 | `RESERVATION_NOT_FOUND` (« Aucune réservation trouvée avec la référence RES-… ») | Référence inconnue **ou appartenant à un autre client** | Détail : « Réservation introuvable — Aucune réservation RES-… n’est associée à votre compte. » ; paiement, preuve et Merci : « Réservation introuvable — Aucune réservation ne correspond à la référence RES-…. » |
| 401 | — | Session expirée | Rafraîchissement automatique, sinon connexion. |
| 5xx | — | — | « Chargement impossible — Vérifiez votre connexion puis réessayez. » |

### 10.7 `POST /reservations/:ref/proof` — Envoyer la preuve de paiement

| | |
| --- | --- |
| Auth | Client (propriétaire) |
| En-tête particulier | `Content-Type: multipart/form-data; boundary=…` (posé par le navigateur) |
| Cache côté app | jamais — `no-store` |
| Délai max | 30 s (`XMLHttpRequest`, progression affichée, annulation possible) |

**Champs du formulaire**

| Champ | Type | Obligatoire | Règle |
| --- | --- | --- | --- |
| `file` | fichier | oui | Capture du paiement (§2.8). Nom par défaut : `preuve-res-000124.jpg`. |
| `sha256` | chaîne | oui | Empreinte hexadécimale (64 caractères) du fichier envoyé. |
| `operator` | `orange` ou `mtn` | oui | Opérateur utilisé. |
| `payerPhone` | E.164 | non | « Numéro qui a payé » (bloc facultatif replié). |
| `transactionId` | chaîne | non | « Identifiant de la transaction ». |

**Exemple**

```http
POST /api/reservations/RES-000124/proof
Authorization: Bearer eyJ…
Content-Type: multipart/form-data; boundary=----drc7MA4YWxkTrZu0gW

------drc7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="file"; filename="preuve-res-000124.jpg"
Content-Type: image/jpeg

(binaire JPEG, 264 Ko)
------drc7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="sha256"

9f2b5c0e4a7d13f8b6e2c9a1d4f7e0b3a6c9d2e5f8a1b4c7d0e3f6a9b2c5d8e1
------drc7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="operator"

orange
------drc7MA4YWxkTrZu0gW--
```

**Réponse 200**

```json
{
  "status": "pending_validation",
  "proof": {
    "thumbnailUrl": "https://res.cloudinary.com/drchoco/image/authenticated/s--Hn4cW8eL--/c_fill,w_320/v1730372400/preuves/RES-000124/preuve.jpg",
    "uploadedAt": "2026-10-31T11:20:00.000Z",
    "sha256": "9f2b5c0e4a7d13f8b6e2c9a1d4f7e0b3a6c9d2e5f8a1b4c7d0e3f6a9b2c5d8e1",
    "operator": "orange"
  },
  "reservation": { "ref": "RES-000124", "status": "pending_validation", "…": "réservation complète, voir §10.6" }
}
```

(La clé `"…"` abrège l’exemple.) `reservation` est facultatif mais conseillé : l’app l’affiche directement ; sans lui, elle met à jour le statut et la preuve elle-même.

**Effets** : statut → `pending_validation` ; entrée de journal (`note` : « Capture Orange Money reçue. », « Capture MTN MoMo reçue. » ou, après un rejet, « Nouvelle preuve envoyée. » ; `actor: "client"`) ; `rejection` et `rejectionReason` retirés ; notification à la boutique.

**Erreurs** (contrôlées dans cet ordre par les mocks)

| HTTP | `code` | Quand | Ce que voit le client |
| --- | --- | --- | --- |
| 404 | `RESERVATION_NOT_FOUND` | Référence inconnue ou d’un autre client | Message du serveur. |
| 410 | `RESERVATION_EXPIRED` (« Le délai de 24 h est dépassé : cette réservation a expiré. ») | `expiresAt` dépassé ou statut `expired` (le serveur passe alors la réservation en `expired`) | Écran « Réservation expirée » avec la proposition de contacter la boutique sur WhatsApp si le client a déjà payé. |
| 422 | `INVALID_STATUS` (`details.status`) | Statut autre que `reserved` ou `payment_rejected` | L’app relit la réservation : si elle est déjà `pending_validation` ou `confirmed` (preuve déjà reçue, réponse perdue), elle ouvre l’écran Merci ; si elle est `expired` ou `cancelled`, l’écran d’expiration. |
| 413 | `FILE_TOO_LARGE` (« Image trop lourde. ») | Fichier au-delà de `proofMaxSizeMb` | « Image trop lourde. » |
| 409 | `DUPLICATE_PROOF` | Même empreinte `sha256` déjà rattachée à **une autre** réservation | « Cette capture a déjà été envoyée pour une autre réservation. Envoyez la capture de ce paiement-ci. » ; la capture est retirée. |
| 422 | `VALIDATION_ERROR` | Champ manquant, type de fichier refusé, empreinte fausse | Le `message` du serveur. |
| — | coupure ou délai dépassé | — | « L’envoi a été interrompu. Votre capture est conservée. » (l’envoi reprend au retour du réseau ; la capture reste en mémoire, jamais sur le disque). |

**Remarques**
- La même capture renvoyée **pour la même réservation** (après un rejet « capture illisible », par exemple) ne doit pas donner `DUPLICATE_PROOF` : le message parlerait à tort d’une « autre réservation ». Les mocks le font aujourd’hui ; voir §17.
- `pending_validation` n’expire pas dans les mocks (le client a payé) : voir §17.
- Mocks : délai 1,5 à 3 s ; l’en-tête `x-mock-too-large: 1` force un 413 (outil de test).

### 10.8 `POST /reservations/:ref/cancel` — Annuler une réservation

| | |
| --- | --- |
| Auth | Client (propriétaire) |
| Cache côté app | jamais — `no-store` |
| Appelé par | Détail de la réservation (« Annuler la réservation », avec un motif facultatif) ; écran de paiement (« Annuler la réservation », sans motif ni corps) |

**Corps** : `{ "reason": "J’ai changé d’avis" }`, ou `{}`, ou **aucun corps** (depuis l’écran de paiement). Motifs proposés : « J’ai changé d’avis », « Erreur de taille », « Délai trop long », « Autre ». À garder pour l’administration (SP-112).

**Réponse 200** (`CancelReservationResponse`)

```json
{
  "status": "cancelled",
  "reservation": { "ref": "RES-000101", "status": "cancelled", "cancellable": false, "timeline": [ { "status": "reserved", "at": "2026-10-30T16:00:00.000Z", "note": "Articles mis de côté pendant 24 h.", "actor": "client" }, { "status": "cancelled", "at": "2026-10-31T11:05:00.000Z", "note": "J’ai changé d’avis", "actor": "client" } ], "…": "réservation complète, voir §10.6" }
}
```

**Effets** : statut → `cancelled`, entrée de journal avec le motif en `note` et `actor: "client"`, stock libéré, `cancellable: false`. Si le client avait déjà payé (`pending_validation` ou `confirmed`), la boutique le rembourse selon sa politique (l’app l’annonce avant la confirmation).

**Erreurs**

| HTTP | `code` | Quand | Ce que voit le client |
| --- | --- | --- | --- |
| 422 | `CANCEL_NOT_ALLOWED` (`details.status`) | La réservation n’est plus annulable (la boutique a commencé la préparation) | Détail : texte de l’app (le `message` du serveur n’est pas affiché) et bouton « Contacter la boutique sur WhatsApp » ; la réservation est relue pour montrer le vrai statut. Écran de paiement : « Impossible d’annuler la réservation pour le moment. Réessayez. » |
| 404 | `RESERVATION_NOT_FOUND` | Inconnue ou d’un autre client | Détail : « L’annulation n’a pas abouti. Vérifiez votre connexion puis réessayez. » ; écran de paiement : comme ci-dessus. |
| 5xx | — | — | Idem. |

Le texte affiché par l’app pour `CANCEL_NOT_ALLOWED`, repris par les mocks, est « Votre commande est déjà en préparation et ne peut plus être annulée ici. » (`src/features/tracking/cancel.ts`) : « commande » est à remplacer par « réservation » (correction demandée au front). Côté serveur, utiliser « Votre réservation est déjà en préparation et ne peut plus être annulée ici. »

**Remarques** : après une annulation depuis l’écran de paiement, l’app remet les articles dans le panier.

### 10.9 « Réserver à nouveau » (pas de route dédiée)

Sur une réservation terminée, « Réserver à nouveau » enchaîne :
1. `GET /reservations/:ref` (si le détail n’est pas déjà en mémoire) ;
2. `POST /cart/validate` avec les variantes et quantités de la réservation ;
3. ajout au panier des articles encore disponibles, au prix renvoyé, puis message « 2 articles ajoutés · 1 n’est plus disponible ».

En cas d’échec : « Impossible de vérifier la disponibilité pour le moment. Réessayez. » Contraintes pour le back-end : `colorCode` et `colorHex` dans les lignes (§10.6) ; une variante disparue renvoie `unavailable` (§9.1).

### 10.10 Photos du colis (pas de route dédiée)

- Les photos du colis arrivent **dans le détail de la réservation** (`packagePhotos`, `packageReadyAt`) et, en miniature, dans la liste (`packagePhotoThumb`) et le résumé (`hasPackagePhotos`).
- Le chemin `/reservations/:ref/photos` est réservé : le service worker ne le mettrait jamais en cache si une route dédiée était créée plus tard (règle `API_PRIVATE`).
- Les photos sont jointes par la boutique dans l’administration au passage à `handed_to_agency` ou `ready_for_pickup` (§14.3), avec une notification `package_ready`.

---

## 11. Notifications push

Principes, clés VAPID et format des notifications : §2.11.

### 11.1 `POST /push/subscribe` — Enregistrer l’abonnement d’un appareil

| | |
| --- | --- |
| Auth | Client (depuis l’app, avec le jeton) **ou** Cookie (depuis le service worker, sans jeton) |
| Cache côté app | jamais — `no-store` |
| Appelé | Après « Activer » les notifications (écran Merci, profil) ; à chaque connexion si la permission est déjà accordée ; au démarrage si l’abonnement a changé ou disparu ; par le service worker sur l’évènement `pushsubscriptionchange` |

**Corps**

| Champ | Type | Obligatoire | Règle |
| --- | --- | --- | --- |
| `subscription` | objet | oui | `PushSubscription.toJSON()` du navigateur : `endpoint` (URL `https://` du service de push), `expirationTime` (`null` en général), `keys.p256dh`, `keys.auth`. |
| `platform` | `ios`, `android` ou `web` | oui | Détecté par l’app (HYPOTHÈSE de valeurs) ; toujours `web` depuis le service worker. |
| `userAgent` | chaîne | oui | Navigateur de l’appareil (affichage dans l’administration, diagnostic). |
| `oldEndpoint` | chaîne ou `null` | non | Ancien `endpoint` du même appareil (abonnement remplacé) : **supprimer l’ancien abonnement** et garder le nouveau. |

**Exemple** (depuis l’app)

```http
POST /api/push/subscribe
Authorization: Bearer eyJ…
Content-Type: application/json

{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/dQw4w9WgXcQ:APA91bH-exemple",
    "expirationTime": null,
    "keys": { "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", "auth": "tBHItJI5svbpez7KI4CCXg" }
  },
  "platform": "android",
  "userAgent": "Mozilla/5.0 (Linux; Android 14; SM-A146B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
  "oldEndpoint": "https://fcm.googleapis.com/fcm/send/ancien-endpoint-exemple"
}
```

**Réponse** : tout 2xx vaut succès ; le corps est ignoré. Les mocks renvoient **201** `{ "ok": true, "devices": 2 }` (nombre d’appareils abonnés du client), ce qui est conseillé.

**Erreurs**

| HTTP | `code` | Quand | Ce que voit le client |
| --- | --- | --- | --- |
| 422 | `INVALID_SUBSCRIPTION` (« Abonnement aux notifications invalide. ») | `endpoint` absent ou non `https://`, clés manquantes | Profil : « Impossible d’activer les notifications pour le moment. Vérifiez votre connexion, puis réessayez. » ; écran Merci : « Impossible d’activer les notifications pour le moment. Réessayez depuis votre profil, rubrique Notifications. » Les notifications ne sont jamais affichées comme « Activées » si le serveur n’a pas enregistré l’abonnement. |
| 401 | — | Pas de session (ni jeton, ni cookie valide) | Idem (depuis l’app, après tentative de rafraîchissement) ; rien depuis le service worker. |

**Appel du service worker (`pushsubscriptionchange`)**

```http
POST /api/push/subscribe
Content-Type: application/json
Accept: application/json
Cookie: drc_refresh=…

{ "subscription": { "endpoint": "https://fcm.googleapis.com/fcm/send/nouvel-endpoint", "expirationTime": null, "keys": { "p256dh": "…", "auth": "…" } }, "oldEndpoint": "https://fcm.googleapis.com/fcm/send/ancien-endpoint", "platform": "web", "userAgent": "Mozilla/5.0 …" }
```

Le service worker n’a **pas** le jeton d’accès : le serveur identifie le client par le cookie de session (`Path` couvrant `/api/push`, §2.4.2) et, à défaut, par `oldEndpoint` (abonnement connu → même compte). HYPOTHÈSE à confirmer (§17). Erreurs ignorées.

### 11.2 `POST /push/unsubscribe` — Retirer l’abonnement d’un appareil

| | |
| --- | --- |
| Auth | Client (appelé **avant** `POST /auth/logout`, pour que la session soit encore valide) |
| Cache côté app | jamais — `no-store` |
| Appelé | « Désactiver » dans le profil ; déconnexion (3 s au plus) |

**Corps** : `{ "endpoint": "https://fcm.googleapis.com/fcm/send/dQw4w9WgXcQ:APA91bH-exemple" }`

**Réponse 204** sans corps, même si l’abonnement était déjà inconnu.

**Erreurs** : toutes ignorées par l’app (le serveur oubliera l’abonnement au premier envoi refusé en 404 ou 410).

---

## 12. Contenus (pages légales et d’aide)

### 12.1 `GET /pages/:slug` — Page de contenu en Markdown

| | |
| --- | --- |
| Auth | Public |
| Cache côté app | `api-catalog` (une page déjà lue reste lisible hors connexion) ; en mémoire 30 min, gardée 24 h |
| `Cache-Control` attendu | `public, max-age=300` (proposition), avec `ETag` |
| Paramètre de chemin | `slug` : minuscules, chiffres et tirets, 80 caractères au plus (l’app n’appelle pas l’API pour un slug d’une autre forme et affiche « Page introuvable ») |
| Appelé par | `/pages/:slug` (pages légales), `/aide/:slug` (pages d’aide), `/aide` (questions fréquentes) |

**Slugs attendus**

| Slug | Titre | Adresse dans l’app |
| --- | --- | --- |
| `conditions-generales` | Conditions générales de réservation | `/pages/conditions-generales` |
| `annulation-retours` | Politique d’annulation et de retour | `/pages/annulation-retours` |
| `confidentialite` | Politique de confidentialité | `/pages/confidentialite` |
| `mentions-legales` | Mentions légales | `/pages/mentions-legales` |
| `comment-reserver` | Comment réserver | `/aide/comment-reserver` |
| `paiement-mobile-money` | Payer par Mobile Money | `/aide/paiement-mobile-money` |
| `livraison-retrait` | Livraison et retrait | `/aide/livraison-retrait` |
| `suivre-ma-reservation` | Suivre ma réservation | `/aide/suivre-ma-reservation` |
| `questions-frequentes` | Questions fréquentes | Section du centre d’aide `/aide` |

Une page inconnue de l’app mais renvoyée par l’API s’affiche aussi (nouvelle page créée dans l’administration).

**Exemple** : `GET /api/pages/mentions-legales`

**Réponse 200**

```json
{
  "slug": "mentions-legales",
  "title": "Mentions légales",
  "updatedAt": "2026-10-31T09:00:00+01:00",
  "body": "> **Texte provisoire, à faire valider par un professionnel du droit.**\n\n## Éditeur de l’application\n\n- Nom commercial : DR Choco L’Incompris\n- Raison sociale et forme juridique : **[À COMPLÉTER PAR LA BOUTIQUE]**\n- Numéro RCCM : **[À COMPLÉTER PAR LA BOUTIQUE]**\n\n## Hébergement\n\n- Images : Cloudinary **[À COMPLÉTER PAR LA BOUTIQUE : société contractante et adresse]**"
}
```

| Champ | Type | Règle |
| --- | --- | --- |
| `slug` | chaîne | Slug demandé. |
| `title` | chaîne | Titre affiché **tel quel** en haut de la page et dans l’onglet : prévoir les espaces insécables à l’enregistrement (avant les deux-points, les points d’interrogation et d’exclamation et les points-virgules, et à l’intérieur des guillemets). |
| `updatedAt` | date ISO 8601 | Affichée « Mis à jour le 31 octobre 2026 ». |
| `body` | chaîne Markdown | 100 000 caractères au plus. |

**Markdown accepté** par le rendu de l’app (`src/features/content/markdown/parse.ts`) : titres `##` et `###` (`#` est réservé au titre de la page), paragraphes, listes à puces et numérotées (imbriquées), gras `**…**`, italique `*…*`, code `` `…` ``, liens `[texte](adresse)`, tableaux simples `| a | b |`, citations `>`, séparateurs `---`, retours à la ligne forcés, et le repère « [À COMPLÉTER …] » (toujours en gras).
- Le HTML éventuel est affiché comme du texte (jamais interprété).
- Liens acceptés : chemins de l’app commençant par `/` (`/aide/livraison-retrait`), `https:`, `http:`, `mailto:` et `tel:`. Tout autre lien (`javascript:`, `data:`, `//autre-site`…) devient du texte simple.
- Les espaces insécables du **corps** sont posées par l’app au rendu : le texte peut être enregistré avec des espaces ordinaires.
- Questions fréquentes : chaque titre `## Question ?` devient une question repliable ; la réponse va jusqu’au titre `##` suivant.

**Erreurs**

| HTTP | `code` | Ce que voit le client |
| --- | --- | --- |
| 404 | `PAGE_NOT_FOUND`, `details.slug` (« Cette page est introuvable. ») | « Page introuvable — Cette page n’existe pas ou a été déplacée. Le centre d’aide répond à la plupart des questions. », avec « Aller au centre d’aide » et « Revenir à l’accueil ». L’app reconnaît le cas au statut 404. |
| 5xx | — | « Page indisponible — Cette page n’a pas pu être chargée. Réessayez dans un instant. » |

```json
{ "code": "PAGE_NOT_FOUND", "message": "Cette page est introuvable.", "details": { "slug": "politique-cookies" } }
```

**Remarques** : route ajoutée en M7 (`src/features/content/`), à créer côté back-end avec l’édition des pages dans l’administration. Les textes de travail sont dans `src/mocks/fixtures/pages.ts` (passages **[À COMPLÉTER …]** à remplir par la boutique, textes légaux à faire valider par un juriste).

---

## 13. Erreurs client

### 13.1 `POST /client-errors` — Remontée des erreurs de l’application

À **créer** côté back-end (HYPOTHÈSE de `src/lib/monitoring.ts` : remplaçable plus tard par un service spécialisé comme Sentry, seule la fonction d’envoi changerait).

| | |
| --- | --- |
| Auth | Public (le cookie part avec la requête mais n’est pas nécessaire ; ne jamais répondre 401) |
| Cache côté app | jamais — `no-store` |
| Envoi | `fetch` direct (pas le client de l’API, pour éviter les boucles), `keepalive: true` (corps ≤ 64 Ko), `credentials: 'include'`, `Content-Type: application/json`, sans `Authorization`. Les erreurs d’envoi sont ignorées. |
| Quand | Préproduction et production seulement (`VITE_APP_STAGE`). Erreurs JavaScript non gérées, erreurs d’affichage (zones de l’app), écarts du contrat d’API en production (zone `api-contract`). |
| Limites côté app | **10 envois au plus par session** (onglet), une seule fois la même erreur. |

**Corps** (`ClientErrorPayload`)

| Champ | Type | Obligatoire | Règle |
| --- | --- | --- | --- |
| `message` | chaîne | oui | 500 caractères au plus, nettoyé. |
| `stack` | chaîne | non | Pile d’appels, 15 lignes et 2 000 caractères au plus, nettoyée. |
| `page` | chaîne | oui | `location.pathname`, **sans** paramètres ni ancre. |
| `appVersion` | chaîne | oui | Version de l’app (`package.json`, ex. `0.6.0`). |
| `userAgent` | chaîne | oui | Navigateur. |
| `zone` | chaîne | non | Zone de l’app (`shell`, `page`, `accueil:nouveautes`, `api-contract`…). |
| `route` | chaîne | non | Motif de route (`/reservations/:ref`). |
| `extra` | objet | non | Valeurs simples (chaîne de 200 caractères au plus, nombre, booléen). Ex. pour `api-contract` : `{ "endpoint": "GET /reservations/:ref", "issues": 2 }`. |
| `occurredAt` | date ISO 8601 | oui | Moment de l’erreur (horloge du téléphone). |

**Aucune donnée personnelle** : l’app retire des textes les jetons (`Bearer`, JWT, longues chaînes opaques), les e-mails, les numéros de téléphone (masqués sauf les 2 derniers chiffres), les champs `token`, `password`, `otp`…, et les paramètres d’adresse. Les références de réservation (`RES-000124`) sont gardées. Le serveur ne doit rien ajouter d’identifiant (pas de rattachement au compte, adresse IP tronquée ou non conservée).

**Exemple**

```http
POST /api/client-errors
Content-Type: application/json

{
  "message": "TypeError: Cannot read properties of undefined (reading 'map')",
  "stack": "TypeError: Cannot read properties of undefined (reading 'map')\n    at TimelineList (https://drchoco.com/assets/ReservationDetailPage-Bq3x9.js:1:2048)",
  "page": "/reservations/RES-000124",
  "appVersion": "0.6.0",
  "userAgent": "Mozilla/5.0 (Linux; Android 14; SM-A146B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
  "zone": "page",
  "route": "/reservations/:ref",
  "occurredAt": "2026-10-31T11:42:07.512Z"
}
```

**Réponse 204** sans corps. Corps invalide : 422 au format du §2.2 (ignoré par l’app). Trop d’envois : 429 (ignoré).

**Remarques**
- Côté serveur : limite de débit par adresse IP (20 par heure conseillé, §2.14), corps refusé au-delà de 64 Ko, journal dédié, alerte quand une même erreur dépasse un seuil (HYPOTHÈSE), conservation 30 jours (HYPOTHÈSE, à reprendre dans la page Confidentialité, SP-062).
- Mocks : 204 en 50 ms, rien n’est conservé.

---

## 14. Statuts de réservation

Source : `src/types/reservationStatus.ts` (`STATUS_META`, `TIMELINE_ORDER`, `isFinalStatus`), `src/features/tracking/timeline.ts` et le simulateur boutique des mocks.

### 14.1 Les 12 statuts et leurs textes

| Code | Libellé (badge) | Ton | Libellé dans la frise | Final | Onglet | Action attendue du client (`needsAction`) | Annulable par le client (règle actuelle) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `reserved` | Réservée | neutre | Réservée | non | En cours | oui : payer | oui |
| `pending_validation` | En attente de validation | attention | « Paiement envoyé », ou « Nouvelle preuve envoyée » après un rejet | non | En cours | non | oui (remboursement par la boutique) |
| `payment_rejected` | Paiement rejeté | danger | Paiement rejeté | non | En cours | oui : renvoyer une preuve | oui |
| `confirmed` | Confirmée | succès | Confirmée | non | En cours | non | oui (remboursement par la boutique) |
| `preparing` | En préparation | neutre | En préparation | non | En cours | non | non |
| `handed_to_agency` | Remise à l’agence | neutre | « Remise à l’agence », ou « Colis prêt pour la livraison » en livraison à domicile | non | En cours | non | non |
| `ready_for_pickup` | Prête pour retrait | succès | Prête pour retrait | non | En cours | oui : venir retirer | non |
| `in_delivery` | En cours de livraison | neutre | En cours de livraison | non | En cours | non | non |
| `delivered` | Livrée | succès | Livrée | **oui** | Terminées | — | non |
| `picked_up` | Retirée | succès | Retirée | **oui** | Terminées | — | non |
| `expired` | Expirée | danger | Expirée | **oui** | Terminées | — | non |
| `cancelled` | Annulée | danger | Annulée (« par vous » ou « par la boutique » selon `actor`) | **oui** | Terminées | — | non |

Le serveur renvoie toujours le **code** ; les libellés sont ceux de l’app. Pour une réservation `expired` ou `cancelled`, la frise s’arrête au dernier statut atteint (`reachedStatus` dans la liste) et finit par une étape rouge.

### 14.2 Parcours affichés (`TIMELINE_ORDER`)

- **Retrait en boutique** (`pickup`) : `reserved` → `pending_validation` → `confirmed` → `preparing` → `ready_for_pickup` → `picked_up`.
- **Livraison** (`delivery`, à domicile ou par agence) : `reserved` → `pending_validation` → `confirmed` → `preparing` → `handed_to_agency` → `in_delivery` → `delivered`.
- Les étapes à venir sont déduites de ce parcours, à partir du statut actuel (après un rejet, la prochaine étape attendue est une nouvelle preuve). Deux entrées identiques consécutives du journal ne forment qu’une étape.

### 14.3 Transitions

| De | Vers | Déclenché par (`actor`) | Effets côté serveur | Note du journal (exemples des mocks) | Notification push |
| --- | --- | --- | --- | --- | --- |
| — | `reserved` | client (`POST /reservations`) | Stock bloqué, `expiresAt` = création + 24 h | « Articles mis de côté pendant 24 h. » | — |
| `reserved` | — (statut inchangé) | system, environ 2 h avant `expiresAt` (HYPOTHÈSE) | — | — | `expiring_soon` |
| `reserved`, `payment_rejected` | `pending_validation` | client (`POST …/proof`) | Preuve enregistrée, rejet effacé | « Capture Orange Money reçue. », « Capture MTN MoMo reçue. », « Nouvelle preuve envoyée. » | — (alerte à la boutique) |
| `reserved`, `payment_rejected` | `expired` | system (`expiresAt` dépassé) | Stock libéré | « Délai de 24 h dépassé : articles remis en vente. » | aucune aujourd’hui (§17) |
| `pending_validation` | `confirmed` | shop (validation) | — | « Paiement validé par la boutique. » | `payment_validated` |
| `pending_validation` | `payment_rejected` | shop (rejet avec motif) | `rejection { reason, rejectedAt }`, `rejectionReason` | le motif, ex. « Montant incorrect », « Capture illisible » | `payment_rejected` |
| `confirmed` | `preparing` | shop | — | (aucune) | — |
| `preparing` | `handed_to_agency` | shop, avec 1 à 3 photos | `packagePhotos`, `packageReadyAt` | « Colis remis à Agence Express Centre. » ou, à domicile, « Colis prêt, en attente du livreur. » | `package_ready` (avec `image`) |
| `preparing` | `ready_for_pickup` | shop, avec 1 à 3 photos | `packagePhotos`, `packageReadyAt` | « Colis prêt à la boutique d’Akwa. » | `package_ready` (avec `image`) |
| `handed_to_agency` | `in_delivery` | shop | — | « En route vers Yaoundé. » ou « Le livreur est en route. » | `in_delivery` |
| `in_delivery` | `delivered` | shop | — | « Colis remis en main propre. » | `delivered` |
| `ready_for_pickup` | `picked_up` | shop | — | « Colis retiré à la boutique. » | `delivered` (HYPOTHÈSE, texte « Livré ! » inadapté, §17) |
| `reserved`, `payment_rejected`, `pending_validation`, `confirmed` | `cancelled` | client (`POST …/cancel`, si `cancellable`) | Stock libéré ; remboursement par la boutique si déjà payé | le motif du client, s’il en a donné un | — |
| tout statut non final | `cancelled` | shop | Stock libéré | « Annulée par la boutique. » ou la note de la boutique | aucune aujourd’hui (§17) |

- Chaque transition ajoute **une** entrée au journal (`timeline`), met à jour `updatedAt` et recalcule `cancellable`.
- Le simulateur boutique permet aussi de passer directement d’un statut payé (`confirmed` à `in_delivery`) à `delivered` ou `picked_up` : l’app affiche correctement tout journal, même avec des étapes sautées.
- Les photos du colis ne peuvent être jointes qu’après la confirmation du paiement et avant l’envoi (`confirmed` ou `preparing`), comme dans le simulateur.

---

## 15. Routes réservées aux mocks (non à implémenter)

Ces routes n’existent que dans les mocks (`src/mocks/handlers.ts`, servis par MSW dans le navigateur ou par `npm run mock:api`). Elles servent au simulateur boutique et aux outils de `/_dev`. **Le back-end ne doit pas les implémenter** ; leurs équivalents réels sont les actions de l’administration (§2.10). Le service worker ne les met jamais en cache.

| Méthode | Chemin | Effet dans les mocks | Appelé par |
| --- | --- | --- | --- |
| GET | `/_mock/status` | Mode des mocks (`browser` ou `node`), nombre d’abonnements push, client connecté | `/_dev` (section « Application installable ») |
| POST | `/_mock/reset` | Remet tout à zéro : session, codes, adresses, favoris, réservations | `/_dev` |
| POST | `/_mock/reservations/reset` | Remet les réservations de démonstration à zéro | Simulateur boutique |
| POST | `/_mock/reservations/:ref/validate` | Valide le paiement (`confirmed`) | Simulateur |
| POST | `/_mock/reservations/:ref/reject` | Rejette le paiement, corps `{ "reason": "Capture illisible" }` | Simulateur |
| POST | `/_mock/reservations/:ref/expire-soon` | Échéance dans 2 min | Simulateur |
| POST | `/_mock/reservations/:ref/expire` | Expire la réservation | Simulateur |
| POST | `/_mock/reservations/:ref/advance` | Étape suivante du parcours | Simulateur |
| POST | `/_mock/reservations/:ref/package-ready` | Joint 1 à 3 photos (`{ "count": 2 }`) et passe à `handed_to_agency` ou `ready_for_pickup` | Simulateur |
| POST | `/_mock/reservations/:ref/complete` | Marque livrée ou retirée | Simulateur |
| POST | `/_mock/reservations/:ref/shop-cancel` | Annulation par la boutique | Simulateur |

Autres comportements propres aux mocks, à ne pas reproduire :
- en-têtes de test `x-mock-chaos`, `x-mock-conflict` et `x-mock-too-large` (lus par les mocks, jamais envoyés par l’app publiée) et variable `VITE_MOCK_STOCK_CHAOS` ;
- valeurs spéciales `q=__error__` (`GET /products`) et slug `__error__` (`GET /products/:slug`) qui simulent une erreur 500 ;
- code OTP toujours `123456` (et `000000` pour un code expiré) ;
- session et réservations gardées dans `sessionStorage` de l’onglet et synchronisées entre onglets ;
- codes d’erreur `SIMULATED_SERVER_ERROR` et `NO_NEXT_STEP`.

---

## 16. Endpoints prévus mais non appelés

| Méthode | Chemin | État | À faire |
| --- | --- | --- | --- |
| GET | `/favorites` | Géré par les mocks (liste des identifiants favoris), **jamais appelé** par l’app | Facultatif tant que les favoris restent sur le téléphone (§17). |
| DELETE | `/favorites/:productId` | Déclaré dans `src/lib/api/endpoints.ts` (`favorites.remove`), **jamais appelé** et **absent des mocks** | Idem. |
| GET | `/delivery/agencies` sans `city` | Géré par les mocks (toutes les agences), jamais appelé | Facultatif. |
| GET | `/reservations?status=<autre statut>` | Géré par les mocks (filtre exact), jamais appelé | Facultatif. |
| GET | `/products?minPrice=…&maxPrice=…` | Prévu par le type `ProductFilters` et géré par les mocks, jamais envoyé | Facultatif. |
| — | `/reservations/:ref/photos` | Chemin réservé par les règles du service worker, aucune route | Rien. |

---

## 17. Questions ouvertes pour le back-end

| # | Question | Proposition ou comportement actuel de l’app |
| --- | --- | --- |
| 1 | `Cache-Control` des lectures privées (`/me`, `/me/addresses`, `/reservations*`) : `no-store` (RAPPORT_M6 §4.5) ou `private, no-cache` ? | Proposition : `private, no-cache`, sinon « Mes réservations » et le paiement ne sont pas lisibles hors connexion après un redémarrage (§2.7.2). Décision avec le client. |
| 2 | `Path` du cookie de rafraîchissement : `/api` (proposé) ou `/api/auth` ? Comment identifier le réabonnement du service worker (`pushsubscriptionchange`) : cookie ou `oldEndpoint` seul ? | `/api`, cookie d’abord puis `oldEndpoint` (§2.4.2, §11.1). |
| 3 | Durées : jeton d’accès (15 min ?), cookie de rafraîchissement (90 jours glissants ?), délai de grâce de la rotation (30 s ?). | Valeurs proposées au §2.4. |
| 4 | Domaine et préfixe définitifs : même domaine `https://<domaine>/api` ? Préfixe `/api` ou `/api/v1` ? Domaine de préproduction ? | Même domaine, `/api` (§1.2, §2.1). |
| 5 | `GET /reservations?status=reserved` renvoie aussi `payment_rejected` : garder ce sens, ou passer à un paramètre explicite (`status=reserved,payment_rejected`) ? | Garder pour la mise en ligne ; un changement demande une modification du front. |
| 6 | Une réservation `pending_validation` (preuve envoyée, pas encore vérifiée) expire-t-elle à 24 h ? Que se passe-t-il si la boutique ne valide jamais ? | Mocks : elle n’expire pas. L’app n’affiche le compte à rebours que pour `reserved` et `payment_rejected`. |
| 7 | Même capture renvoyée pour la **même** réservation après un rejet : accepter, ou un autre code que `DUPLICATE_PROOF` ? | Proposition : `DUPLICATE_PROOF` seulement si l’empreinte appartient à une autre réservation (§10.7). Les mocks refusent aujourd’hui. |
| 8 | Détection de `price_changed` : le corps de `POST /cart/validate` ne contient pas le prix vu par le client. Ajouter `unitPrice` à chaque ligne (modification du front) ? | Aujourd’hui le prix est mis à jour sans être signalé. |
| 9 | Stock exact exposé (`variants[].stock`, `availableQuantity`) : acceptable, ou plafonné (ex. 10) ? | Le front utilise le stock pour « Plus que 3 » (1 à 3) et pour le plafond de quantité. |
| 10 | Favoris : rester sur le téléphone (fusion à la connexion seulement), ou synchroniser ajouts et retraits (`GET /favorites`, `DELETE /favorites/:productId`) ? La page Favoris charge `GET /products?pageSize=50` et n’affiche que les favoris présents dans ces 50 articles : ajouter un filtre `ids=` ? | Aujourd’hui : favoris locaux, retraits jamais transmis. |
| 11 | Notifications à l’annulation par la boutique et à l’expiration ? Type dédié pour le retrait (`picked_up`, le texte « Livré ! » ne convient pas) ? Moment exact de `expiring_soon` (2 h avant ?) ? | Aucune notification aujourd’hui pour ces cas ; `delivered` sert aussi au retrait (§14.3). |
| 12 | Code de retrait : la référence `RES-…` suffit-elle (montrée avec une pièce d’identité) ? | Oui par défaut (SP-038). |
| 13 | Images de repli (`fallbackImage`, `fallbackImages`, `mediaGallery[].fallbackUrl`, `LookbookItem.fallback`) en production : même URL que la photo, ou visuel de repli de l’app (`/images/fallback/mood-*.svg`) ? | Proposition : visuel de repli de l’app selon la catégorie. |
| 14 | Date de modification des articles pour le plan du site (`<lastmod>`) : ajouter `updatedAt` à `Product` ? | Champ facultatif, ignoré par l’app. |
| 15 | `GET /delivery/agencies?city=` reçoit le **nom** de la ville : accepter le nom (sans accents ni casse) et l’identifiant ? | Comme les mocks (§8.2). |
| 16 | `Agency.phone` : texte affiché tel quel (`+237 690 10 11 01`) ou E.164 mis en forme par l’app ? | Texte affiché tel quel aujourd’hui. |
| 17 | Limites de l’OTP : 3 demandes par 10 min, 5 essais, verrou de 10 min, code valable 5 min, renvoi après 60 s. À confirmer, avec le coût des SMS (SP-087). | Valeurs des mocks (§4.1, §4.2). |
| 18 | Idempotence : durée de conservation des clés (24 h ?) et code `IDEMPOTENCY_KEY_REUSED` ? | §2.5. |
| 19 | Format de `details` pour `VALIDATION_ERROR` : clés à plat au nom du champ (`propertyPath`) ? | §2.2. L’app n’affiche pas encore les messages champ par champ. |
| 20 | `POST /client-errors` : stockage, alertes, conservation ; ou service spécialisé (Sentry) ? | Endpoint maison proposé (§13.1). |
| 21 | Règle de `cancellable` (jusqu’à `confirmed` inclus ?) et statuts « action attendue » (`reserved`, `payment_rejected`, `ready_for_pickup`) à valider avec le client. | SP-020, SP-023. |
| 22 | Motifs des URL privées (§2.9) et validité d’1 h des URL signées à confirmer. | SP-060, SP-097. |
| 23 | Textes des notifications (§2.11) et notes du journal (§14.3) : écrits par le serveur, à valider avec le client ; aucune « commande » côté client. | Textes de travail des mocks. |

---

## Annexe A : modèles de données

Colonne « Exigé » : **oui** = exigé par le contrôle de contrat de l’app (§1.4) ou indispensable à l’écran ; « attendu » = présent dans le type TypeScript du front (`src/types/`) et à renvoyer, mais sans alerte s’il manque ; « non » = facultatif. Les types sont ceux de JSON (`chaîne`, `entier`, `booléen`, `date` = chaîne ISO 8601 avec fuseau).

### A.1 `User`

| Champ | Type | Exigé | Description |
| --- | --- | --- | --- |
| `id` | chaîne | oui | Identifiant du compte. |
| `phone` | chaîne E.164 | oui | Numéro du compte (identifiant de connexion). |
| `firstName` | chaîne | non | Omis tant qu’inconnu. |
| `lastName` | chaîne | non | Omis tant qu’inconnu. |
| `city` | chaîne | non | Ville du client. |
| `createdAt` | date | attendu | Création du compte. |

### A.2 `Category` et `SubCategory`

| Champ | Type | Exigé | Description |
| --- | --- | --- | --- |
| `id` | chaîne | attendu | |
| `slug` | chaîne | attendu | `vetements`, `chaussures`, `babouches`. |
| `name` | chaîne | attendu | « Vêtements ». |
| `description` | chaîne | attendu | Phrase d’accroche. |
| `image` | chaîne | attendu | Visuel de la carte de catégorie. |
| `coverImage` | chaîne | attendu | Visuel large (univers de l’accueil). |
| `fallbackImage` | chaîne | attendu | Visuel de repli (§17, question 13). |
| `productCount` | entier | attendu | Nombre d’articles. |
| `subCategories` | `SubCategory[]` | attendu | `{ id, slug, name, coverImage, fallbackImage, productCount }`. |

### A.3 `Product`

| Champ | Type | Exigé (carte) | Exigé (fiche) | Description |
| --- | --- | --- | --- | --- |
| `id` | chaîne | oui | oui | Identifiant (envoyé dans `POST /reservations` et `POST /favorites`). |
| `slug` | chaîne | oui | oui | Adresse de la fiche `/produit/<slug>`. |
| `name` | chaîne | oui | oui | |
| `price` | entier FCFA | oui | oui | Prix actuel. |
| `categorySlug` | chaîne | oui | oui | Catégorie racine. |
| `subCategorySlug` | chaîne | non | non | Sous-catégorie. |
| `images` | chaîne[] | oui | oui | Photos (URL Cloudinary publiques ou identifiants publics), première = photo principale. |
| `fallbackImages` | chaîne[] | oui | oui | Repli de même rang que `images`. |
| `colors` | `ProductColor[]` | oui | oui | `{ code, name, hex }` ; `hex` = teinte de la pastille (`#1A1A18`). |
| `sizes` | chaîne[] | oui | oui | Tailles proposées, dans l’ordre (`S`…`XXL`, `39`…`46`, ou `Unique` : présélectionnée). |
| `variants` | `ProductVariant[]` | oui | oui | Une variante par couleur × taille : `{ id, size, colorCode, stock }`. `id` est envoyé dans le panier et la réservation. |
| `badges` | chaîne[] | oui | oui | `new`, `low-stock`, `sold-out`. Règle des mocks (HYPOTHÈSE) : `sold-out` si le stock total est 0, `low-stock` s’il est de 1 à 3 (« Plus que N »), `new` si `isNew`. |
| `isNew` | booléen | oui | oui | Nouveauté. |
| `description` | chaîne | non | oui | Texte de la fiche (aussi `og:description`). |
| `composition` | chaîne | — | oui | Matières. |
| `careInstructions` | chaîne[] | — | oui | Conseils d’entretien. |
| `sizeGuide` | `SizeGuideTable` | — | oui | `{ type: "clothing" \| "footwear" \| "one-size", title, tip, headers[], rows[][] }`. |
| `mediaGallery` | `ProductImageEntry[]` | non | oui | `{ url, fallbackUrl, colorCode?, alt? }` ; au moins une photo par couleur. |
| `reservationsCount` | entier | non | non | Popularité (tri `popular`). |
| `createdAt` | date | non | non | Tri `newest`. |
| `related` | `Product[]` (carte) | — | non | Fiche seulement : articles associés, 6 au plus. |

### A.4 `LookbookItem`

| Champ | Type | Exigé | Description |
| --- | --- | --- | --- |
| `id` | chaîne | attendu | Utilisé dans `?look=`. |
| `title`, `subtitle` | chaînes | attendu | « Total black barbelé », « Hoodie 480 gsm + Cargo tactique ». |
| `image` | chaîne | attendu | Photo portrait. |
| `fallback` | chaîne | attendu | Repli. |
| `productSlugs` | chaîne[] | attendu | Slugs des pièces. |
| `products` | `Product[]` | `GET /looks/:id` seulement | Pièces du look. |

### A.5 `PublicSettings`

| Champ | Type | Exigé | Description |
| --- | --- | --- | --- |
| `whatsappNumber` | chaîne E.164 | oui | Numéro WhatsApp de la boutique (bouton flottant, pied de page, aide, annulation). |
| `deliveryFeePayment` | `upfront` ou `on_delivery` | oui | Frais de livraison inclus dans le paiement Mobile Money, ou payés à la réception. |
| `shop` | objet | oui | `{ name, address, city, openingHours, mapsUrl }` : boutique du Retrait en boutique. |
| `payment.operators` | `PaymentOperatorConfig[]` | oui | `{ id: "orange" \| "mtn", label, merchantName, merchantCode, ussdTemplate (ou null), qrImageUrl (ou null), steps[], enabled }`. |
| `payment.validationDelayText` | chaîne | oui | Fin de phrase « … en général en moins d’une heure, de 8 h à 20 h ». |
| `payment.exactAmountRequired` | booléen | non | Vrai par défaut. |
| `payment.proofMaxSizeMb` | entier | non | 10 par défaut. |
| `pickupAddress` | objet | non | `{ name, city, quarter, landmark, openingHours }` (pied de page ; ancien format). |
| `operators` | tableau | non | Ancien format M1/M2 (`{ code, name, merchantCode, ussdTemplate, accountName, qrCodeUrl? }`), plus lu. |
| `reservationHoldHours`, `reservationExpiryHours` | entier | non | Durée de mise de côté (24). Doublons ; l’app s’appuie sur `expiresAt`. |

### A.6 `DeliveryCity` et `Agency`

| `DeliveryCity` | Type | Description |
| --- | --- | --- |
| `id` | chaîne | `city-yde`. |
| `name` | chaîne | Nom affiché et envoyé par l’app (`city`). |
| `fee` | entier FCFA | Frais de livraison. |
| `isLocal` | booléen | Livraison à domicile (ville de la boutique). |
| `hasAgencies` | booléen | Envoi par agence possible. |
| `estimatedDelay` | chaîne | « 1 à 2 jours ». |

| `Agency` | Type | Description |
| --- | --- | --- |
| `id` | chaîne | `ag-yde-1`, envoyé dans `agencyId`. |
| `cityId` | chaîne | Ville (`city-yde`). |
| `city` | chaîne | Nom de la ville. |
| `name`, `address`, `phone`, `openingHours` | chaînes | Affichés au client quand le colis part (SP-032). |

### A.7 `Address`

| Champ | Type | Exigé | Description |
| --- | --- | --- | --- |
| `id` | chaîne | attendu | |
| `label` | chaîne | attendu | `Maison`, `Bureau`, `Autre`. |
| `city` | chaîne | attendu | Nom de la ville. |
| `district` | chaîne | attendu | Quartier (ou nom de la ville pour une agence). |
| `quarter` | chaîne | attendu | Doublon de `district`. |
| `landmark` | chaîne | attendu | Point de repère (ou nom de l’agence). |
| `details` | chaîne | non | Doublon de `landmark`. |
| `receptionMode` | `delivery` ou `pickup` | attendu | `delivery` aujourd’hui. |
| `agencyId` | chaîne | non | Agence (ville non locale). |
| `recipientName` | chaîne | non | Destinataire. |
| `recipientPhone` | chaîne E.164 | non | Téléphone du destinataire. |
| `phone` | chaîne E.164 | non | Doublon de `recipientPhone`. |
| `isDefault` | booléen | attendu | Une seule adresse par défaut. |

### A.8 `Reservation`

| Champ | Type | Exigé | Description |
| --- | --- | --- | --- |
| `ref` | chaîne | oui | `RES-000124`. |
| `status` | code de statut | oui | Un des 12 codes du §14 (tout autre code déclenche une alerte de contrat). |
| `receptionMode` | `delivery` ou `pickup` | oui | |
| `items` | `ReservationItem[]` | oui | Lignes (A.9). |
| `subtotal`, `deliveryFee`, `total` | entiers FCFA | oui | Montants (`total` selon `deliveryFeePayment`, §10.1). |
| `amount` | objet | non (oui dans la réponse de création) | `{ subtotal, deliveryFee, total }` : doublon. |
| `city` | chaîne | non | Ville de livraison, ou de la boutique pour un retrait. |
| `address` | objet | non | `{ district?, landmark? }` (livraison à domicile). |
| `agency` | objet | non | `{ id?, name, address?, city?, phone?, openingHours? }` (envoi par agence). Son absence signale une livraison à domicile. |
| `deliveryAddress` | objet | non | `{ city, quarter, district?, landmark?, agencyId?, agencyName?, recipientName?, recipientPhone }`. |
| `customer` | objet | non | `{ firstName, lastName, phone }`. |
| `proof` | objet | non | `{ thumbnailUrl (URL signée), uploadedAt, operator?, sha256?, payerPhone?, transactionId? }` : dernière preuve envoyée. |
| `rejection` | objet | non | `{ reason, rejectedAt }` : présent pour `payment_rejected`. `reason` est affiché tel quel. |
| `rejectionReason` | chaîne | non | Doublon de `rejection.reason`. |
| `notes` | chaîne | non | Remarque du client. |
| `createdAt` | date | oui | |
| `updatedAt` | date | oui | Dernier changement (statut, photos) : tri des listes et repère « Nouveau ». |
| `expiresAt` | date | oui | Échéance du paiement (création + 24 h), toujours présente. |
| `serverTime` | date | non (oui à la création) | Heure du serveur ; à renvoyer dans toutes les réponses de réservation. |
| `packagePhotos` | `PackagePhoto[]` | oui | `[]` tant que le colis n’est pas prêt (A.10). |
| `packageReadyAt` | date ou `null` | oui | Date d’emballage. |
| `timeline` | `ReservationTimelineEvent[]` | oui | Journal daté (A.11), du plus ancien au plus récent. |
| `cancellable` | booléen | oui | Calculé par le serveur. |
| `cancelDeadline` | date ou `null` | non | Limite d’annulation éventuelle. |

### A.9 `ReservationItem`

| Champ | Type | Exigé | Description |
| --- | --- | --- | --- |
| `id` | chaîne | oui | Identifiant de la ligne. |
| `productId` | chaîne | oui | |
| `slug` | chaîne | oui | Lien vers la fiche. |
| `name` | chaîne | oui | Nom au moment de la réservation. |
| `image` | chaîne | oui | Photo (publique) de l’article. |
| `variantId` | chaîne | oui | Variante réservée. |
| `size` | chaîne | oui | |
| `colorName` | chaîne | oui | « Noir Charbon ». |
| `colorCode`, `colorHex` | chaînes | non (demandés) | Pour « Réserver à nouveau » (SP-098). |
| `unitPrice` | entier FCFA | oui | Prix au moment de la réservation. |
| `quantity` | entier | oui | |

### A.10 `PackagePhoto`

| Champ | Type | Exigé | Description |
| --- | --- | --- | --- |
| `id` | chaîne | oui | |
| `url` | chaîne | oui | Photo en grand, URL signée de courte durée (§2.9). |
| `thumbnailUrl` | chaîne | oui | Miniature, URL signée. |
| `width`, `height` | entiers | oui | Dimensions réelles (format d’affichage 4:3, 1:1 ou 4:5). |
| `takenAt` | date | oui | Prise de vue. |

### A.11 `ReservationTimelineEvent`

| Champ | Type | Exigé | Description |
| --- | --- | --- | --- |
| `status` | code de statut | oui | Statut atteint. |
| `at` | date | oui | Moment du changement. |
| `note` | chaîne | non | Affichée telle quelle sous l’étape (motif de rejet, agence, motif d’annulation…). |
| `actor` | `client`, `shop` ou `system` | non (demandé) | Qui a déclenché l’étape. |

### A.12 `ReservationListItem`, `ReservationsSummary`, `CartValidationResult`

Voir les exemples et tableaux des §10.3, §10.5 et §9.1.

### A.13 `ContentPage`, `PushPayload`, `ClientErrorPayload`

Voir les §12.1, §2.11 et §13.1.
