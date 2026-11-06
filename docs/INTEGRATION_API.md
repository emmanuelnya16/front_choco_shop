# Intégration de l’API réelle — liste de vérification

> Version 1.0 du 31 octobre 2026, module M7 « Finitions, recette et mise en ligne » (phase P8).
> Destinataires : équipe back-end (Symfony), équipe front, personne chargée de la recette.
> Référence des routes, formats et erreurs : `docs/CONTRAT_API.md` (cité « Contrat » ci-dessous).

## Sommaire

1. À quoi sert ce document
2. Prérequis côté back-end avant la bascule
3. Bascule des mocks vers l’API réelle
4. Mode préproduction
5. Lire les avertissements « [Contrat API] »
6. Liste de vérification endpoint par endpoint
7. Vérifications transverses
8. Tests de fumée après la bascule
9. Mesurer les temps de réponse
10. Signaler un écart
11. Revenir en arrière

---

## 1. À quoi sert ce document

- L’application a été développée entièrement sur des **mocks** (MSW) qui imitent l’API. Ce document décrit comment la brancher sur l’**API Symfony réelle**, d’abord en préproduction, puis en production.
- La section 6 se coche **endpoint par endpoint, à deux** (une personne du back-end, une du front), sur l’environnement de préproduction.
- La mise en production n’a lieu que lorsque toutes les cases des sections 6, 7 et 8 sont cochées, ou que chaque case restante a une décision écrite (reportée dans `docs/SUIVI_POINTS_OUVERTS.md`).

---

## 2. Prérequis côté back-end avant la bascule

- [ ] API servie en HTTPS sur **le même domaine** que l’application, sous `/api` (Contrat §2.1). Sinon : CORS avec credentials et origine exacte, cookie `SameSite=Lax`, `Vary: Origin`, **et** modification préalable du front (`credentials: 'include'` sur `POST /auth/otp/verify` et `POST /auth/logout`), sans laquelle la session ne tient pas entre deux origines.
- [ ] Toutes les erreurs de `/api/*` au format `{ code, message, details }`, y compris 404, 405, 413 et 500 (jamais la page HTML de Symfony ni celle du serveur web) (Contrat §2.2).
- [ ] Session : jeton d’accès dans le corps, cookie de rafraîchissement `HttpOnly; Secure; SameSite=Lax; Path=/api`, rotation avec délai de grâce, 401 ou 403 seulement pour une session réellement refusée (Contrat §2.4).
- [ ] Routes publiques qui **ignorent** un jeton expiré ou invalide (Contrat §2.4.5).
- [ ] `Cache-Control` posé partout selon Contrat §2.7.2 (décision prise sur les lectures privées : `no-store` ou `private, no-cache`).
- [ ] Sérialiseur : champs facultatifs omis plutôt que `null` (`skip_null_values`), sauf les champs « ou `null` » (Contrat §1.3).
- [ ] Clés VAPID générées ; clé publique transmise au front pour `VITE_VAPID_PUBLIC_KEY` (Contrat §2.11).
- [ ] Compte Cloudinary réel (`VITE_CLOUDINARY_CLOUD_NAME`), dossiers **privés** pour les preuves et les photos du colis, URL signées valables 1 h et conformes aux motifs du Contrat §2.9.
- [ ] Fournisseur SMS branché ; SMS terminé par `@<domaine> #123456` pour le remplissage automatique Android (Contrat §4.1).
- [ ] Données réelles saisies : catalogue (photos par couleur, tailles, stock), villes, frais, délais, agences, paramètres de paiement (codes marchands, USSD, QR, étapes), numéro WhatsApp, adresse et horaires de la boutique.
- [ ] Pages de contenu créées (`GET /pages/:slug`, 9 slugs, Contrat §12.1).
- [ ] `POST /client-errors` créé (Contrat §13.1).
- [ ] Balises de partage des fiches produit et plan du site des produits prévus côté serveur (Contrat §2.12 et Contrat §2.13).
- [ ] Limites d’envoi de fichiers du serveur web et de PHP au-dessus de `proofMaxSizeMb` (Contrat §2.8).
- [ ] Administration capable de valider ou rejeter une preuve, joindre les photos du colis et faire avancer les statuts (sinon les tests de fumée du §8 ne peuvent pas aller au bout).

---

## 3. Bascule des mocks vers l’API réelle

### 3.1 Variables d’environnement

Les variables sont lues **au moment du build** (Vite) et validées par `src/lib/env.ts`. Aucune ne se change après le build : toute modification demande un nouveau build.

| Variable | Développement (mocks) | Préproduction | Production | Rôle |
| --- | --- | --- | --- | --- |
| `VITE_API_MOCK` | `true` | **`false`** | **`false`** | `false` désactive MSW ; le code des mocks est alors retiré du build. |
| `VITE_API_BASE_URL` | `http://localhost:8000/api` | **`/api`** (ou `https://api.<domaine-préprod>/api`) | **`/api`** | Préfixe de toutes les routes (Contrat §1.2). |
| `VITE_PWA_ENABLED` | vide (faux en développement) | **`true`** | `true` ou vide (vide = vrai pour un build) | Service worker, hors connexion, notifications. |
| `VITE_VAPID_PUBLIC_KEY` | vide (clé de démonstration) | clé publique de préproduction | clé publique de production | Abonnement aux notifications. Format base64url de 80 à 100 caractères, sinon l’app refuse de démarrer. |
| `VITE_CLOUDINARY_CLOUD_NAME` | `demo` | compte réel | compte réel | Photos publiques du catalogue. |
| `VITE_SHOP_WHATSAPP` | `+237600000000` | numéro réel | numéro réel | Affiché dans `/_dev`. Attention : l’app lit le vrai numéro dans `GET /settings/public` et, à défaut, une valeur écrite dans le code (`+237690000000`), pas cette variable (correction demandée au front). |
| `VITE_APP_STAGE` | vide (`development`) | **`preproduction`** | **`production`** (valeur par défaut d’un build) | Remontée des erreurs et contrôle du contrat (§4 et §5). |
| `VITE_ENABLE_DEV_PAGE` | `true` | `true` seulement si besoin (§4.2) | **`false` ou absente** | Page de contrôle `/_dev`. |
| `VITE_SITE_URL` | vide | `https://<domaine-préprod>` | `https://<domaine>` | Adresses canoniques (référencement). Vide : origine de la page. |
| `VITE_APP_NAME` | `DR Choco L'Incompris` | idem | idem | Nom de l’app. |

Ne pas définir : `VITE_APP_VERSION` (lue dans `package.json` au build) ; `VITE_MOCK_STOCK_CHAOS` (mocks seulement).

### 3.2 Fichiers de mode

Sous Windows, les variables passées sur la ligne de commande ne fonctionnent pas : on utilise un **fichier par mode** (comme `.env.pwa` et `.env.e2e`). À créer par l’équipe front, sans secret (tout ce qui commence par `VITE_` est public) :

`.env.preproduction`

```dotenv
VITE_API_MOCK=false
VITE_API_BASE_URL=/api
VITE_PWA_ENABLED=true
VITE_VAPID_PUBLIC_KEY=<clé publique VAPID de préproduction>
VITE_CLOUDINARY_CLOUD_NAME=<compte Cloudinary>
VITE_SHOP_WHATSAPP=+2376XXXXXXXX
VITE_APP_STAGE=preproduction
VITE_ENABLE_DEV_PAGE=false
VITE_SITE_URL=https://<domaine-préprod>
```

`.env.production`

```dotenv
VITE_API_MOCK=false
VITE_API_BASE_URL=/api
VITE_PWA_ENABLED=true
VITE_VAPID_PUBLIC_KEY=<clé publique VAPID de production>
VITE_CLOUDINARY_CLOUD_NAME=<compte Cloudinary>
VITE_SHOP_WHATSAPP=+2376XXXXXXXX
VITE_APP_STAGE=production
VITE_ENABLE_DEV_PAGE=false
VITE_SITE_URL=https://<domaine>
```

Ordre de priorité de Vite : `.env.<mode>.local` > `.env.<mode>` > `.env.local` > `.env`. Un `.env.local` de développement (avec `VITE_API_MOCK=true`) est donc écrasé par le fichier de mode **pour les clés que celui-ci définit** : définir toutes les clés ci-dessus dans chaque fichier de mode.

### 3.3 Construire

| Environnement | Commande |
| --- | --- |
| Préproduction | `npx tsc -b && npx vite build --mode preproduction` |
| Production | `npm run build` (mode `production`, lit `.env.production`) |

Après le build, vérifier :
- [ ] aucun fichier `assets/mocks-*` dans le dossier de build (code des mocks retiré) ;
- [ ] `public/mockServiceWorker.js` est copié dans le build mais jamais enregistré (inoffensif ; il est exclu du précache) ;
- [ ] aucun fichier `assets/dev-*` si `VITE_ENABLE_DEV_PAGE` est faux ;
- [ ] poids du build dans les budgets (`node scripts/check-size.mjs <dossier>`).

### 3.4 Déployer

- Copier le dossier de build à la racine du domaine ; l’API Symfony reste sous `/api` (règle « L’API Symfony garde ses propres règles » de `public/.htaccess`).
- La procédure d’hébergement complète est décrite dans `docs/MISE_EN_LIGNE.md` (rédigé en M7).

### 3.5 En-têtes de l’hébergement (rappel)

| Fichier | `Cache-Control` |
| --- | --- |
| `index.html`, `sw.js`, `manifest.webmanifest`, `robots.txt`, `sitemap.xml` | `no-cache` (sinon les mises à jour n’arrivent pas) |
| `assets/*` (noms avec empreinte) | `public, max-age=31536000, immutable` |
| HTML de `/produit/:slug` rendu par Symfony (Contrat §2.12) | `no-cache` |

`public/.htaccess` (M7) applique déjà ces règles pour les fichiers statiques.

---

## 4. Mode préproduction

### 4.1 Ce qui change avec `VITE_APP_STAGE=preproduction`

| | Développement | Préproduction | Production |
| --- | --- | --- | --- |
| Erreurs JavaScript | Console | Envoyées à `POST /client-errors` | Envoyées à `POST /client-errors` |
| Écart de contrat d’API | Console (`[Contrat API] …`) | **Console** (`[Contrat API] …`) | Envoyé à `POST /client-errors` (zone `api-contract`), rien dans la console |
| `/_dev` | Toujours | Seulement avec `VITE_ENABLE_DEV_PAGE=true` | Jamais |

- La préproduction se construit avec l’**API réelle de test** (base de test, SMS réels ou numéros de test, Cloudinary réel, clés VAPID de préproduction distinctes de la production).
- La préproduction ne doit pas être indexée : en-tête `X-Robots-Tag: noindex, nofollow` sur tout le domaine de préproduction, et accès restreint (mot de passe ou liste d’adresses IP, HYPOTHÈSE).
- `VITE_APP_STAGE` absente d’un build vaut `production` : sans elle, la préproduction n’affiche aucun avertissement dans la console.

### 4.2 Réactiver `/_dev` en préproduction

- `/_dev` (page de contrôle : versions, caches, notifications de test, état des mocks) se réactive **uniquement par la variable explicite** `VITE_ENABLE_DEV_PAGE=true` dans `.env.preproduction`, puis un nouveau build.
- Avec l’API réelle, le **simulateur boutique** de `/_dev` ne fonctionne pas : il appelle les routes `/_mock/*`, qui n’existent pas (Contrat §15) et répondent 404. Les actions de la boutique se font dans l’administration.
- **Jamais** `VITE_ENABLE_DEV_PAGE=true` ni `VITE_API_MOCK=true` dans `.env.production` : `/_dev` serait publiée. Aujourd’hui `src/lib/env.ts` active `/_dev` dès que l’une des deux vaut `true`, quelle que soit l’étape (correction demandée au front : l’interdire quand `VITE_APP_STAGE=production`).

---

## 5. Lire les avertissements « [Contrat API] »

- En développement et en préproduction, ouvrir les outils de développement du navigateur (onglet Console) et filtrer sur `[Contrat API]`.
- Format : `[Contrat API] <chemin> : <écart>`. Exemples :
  - `[Contrat API] /reservations/RES-000124 : champ "expiresAt" manquant`
  - `[Contrat API] /products : champ "items.3.badges.0" : attendu "new" | "low-stock" | "sold-out", reçu "promo"`
  - `[Contrat API] /me : champ "firstName" : attendu string, reçu null` (champ à omettre plutôt que `null`)
- Chaque écart n’apparaît qu’une fois par chargement de page, 10 lignes au plus par réponse.
- L’app continue toujours avec la donnée reçue : un avertissement signale un risque d’affichage faux, pas un blocage.
- Routes contrôlées automatiquement : Contrat §1.4 (11 routes). **Les autres se vérifient à la main** avec les exemples du Contrat (onglet Réseau du navigateur).

---

## 6. Liste de vérification endpoint par endpoint

Colonnes :
- **Schéma** : la réponse suit le Contrat (champs, types, `null` seulement là où c’est permis) ; aucun avertissement `[Contrat API]` pour les routes contrôlées.
- **Erreurs** : chaque code d’erreur listé est provoqué au moins une fois et renvoie le bon statut HTTP, le bon `code` et un `message` affichable ; l’écran de l’app affiche le texte prévu.
- **p95** : objectif de temps de réponse côté serveur (§9).
- **Hors connexion** : comportement attendu de l’app, réseau coupé, après une première visite en ligne (build avec service worker).
- **Cache-Control** : valeur attendue présente sur la réponse.
- **CORS / cookies** : seulement si l’API n’est pas sur le même domaine ; sinon cocher « sans objet ».

### 6.1 Authentification

| Endpoint | Schéma | Erreurs à provoquer | p95 | Hors connexion | Cache-Control | CORS / cookies | Fait |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `POST /auth/otp/request` | ☐ | ☐ 422 `INVALID_PHONE` ; ☐ 429 `TOO_MANY_OTP_REQUESTS` avec `details.retryAfter` (4e demande en 10 min) | < 1 s (hors envoi du SMS) ☐ | Bouton inactif hors connexion | `no-store` ☐ | ☐ | ☐ |
| `POST /auth/otp/verify` | ☐ | ☐ 422 `INVALID_OTP_CODE` avec `attemptsLeft` ; ☐ 410 `OTP_EXPIRED` ; ☐ 429 `OTP_LOCKED` (5e code faux) | < 1 s ☐ | — | `no-store` ☐ | ☐ cookie posé (`HttpOnly`, `Secure`, `SameSite`, `Path`) | ☐ |
| `POST /auth/refresh` | ☐ | ☐ 401 `NO_SESSION` sans cookie ; ☐ nouveau cookie à chaque appel (rotation) ; ☐ deux onglets qui rafraîchissent en même temps restent connectés | < 500 ms ☐ | Session gardée, aucune déconnexion | `no-store` ☐ | ☐ cookie envoyé et remplacé | ☐ |
| `POST /auth/logout` | ☐ 204 | ☐ 204 aussi avec une session expirée | < 1 s ☐ | Déconnexion locale quand même | `no-store` ☐ | ☐ cookie effacé (`Max-Age=0`) | ☐ |

### 6.2 Profil, adresses et favoris

| Endpoint | Schéma | Erreurs à provoquer | p95 | Hors connexion | Cache-Control | CORS / cookies | Fait |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /me` | ☐ | ☐ 401 sans jeton → rafraîchissement automatique | < 500 ms ☐ | Profil connu affiché | décision Contrat §2.7.2 ☐ | ☐ | ☐ |
| `PATCH /me` | ☐ | ☐ 422 `VALIDATION_ERROR` | < 1 s ☐ | Enregistrement refusé, message | `no-store` ☐ | ☐ | ☐ |
| `GET /me/addresses` | ☐ adresse par défaut en tête | ☐ 401 | < 500 ms ☐ | Dernière liste (si cache privé permis) | décision Contrat §2.7.2 ☐ | ☐ | ☐ |
| `POST /me/addresses` | ☐ 201 | ☐ 422 ; ☐ `agencyId: null` accepté | < 1 s ☐ | Message d’échec | `no-store` ☐ | ☐ | ☐ |
| `PATCH /me/addresses/:id` | ☐ | ☐ 404 `ADDRESS_NOT_FOUND` ; ☐ `isDefault: true` retire le défaut des autres ; ☐ `agencyId: null` efface l’agence | < 1 s ☐ | Retour à l’état précédent | `no-store` ☐ | ☐ | ☐ |
| `DELETE /me/addresses/:id` | ☐ 204 | ☐ 404 ; ☐ suppression de l’adresse par défaut : la première restante le devient | < 1 s ☐ | Liste relue au retour | `no-store` ☐ | ☐ | ☐ |
| `POST /favorites` | ☐ tableau d’identifiants | ☐ identifiant inconnu ignoré (pas d’erreur) | < 1 s ☐ | Ignoré | `no-store` ☐ | ☐ | ☐ |

### 6.3 Catalogue, paramètres, livraison, panier

| Endpoint | Schéma | Erreurs à provoquer | p95 | Hors connexion | Cache-Control | CORS / cookies | Fait |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /categories` | ☐ | ☐ un jeton expiré envoyé n’entraîne pas de 401 | < 500 ms ☐ | Copie enregistrée (`api-catalog`) | `public, …` (jamais `no-store`) ☐ | ☐ | ☐ |
| `GET /products` | ☐ (`items`, pagination, `facets`) | ☐ chaque filtre (`category`, `sub`, `size` répété, `price` dont `50000+`, `available=1`, `look`, `q` sans accents) ; ☐ chaque tri ; ☐ page au-delà de la fin → `items: []` ; ☐ `pageSize=50` | < 500 ms ☐ | Copie enregistrée | idem ☐ | ☐ | ☐ |
| `GET /products/:slug` | ☐ (`related` compris) | ☐ 404 avec le code **`NOT_FOUND`** → « Cet article n’existe plus ou a été déplacé » | < 500 ms ☐ | Fiches déjà vues disponibles | idem ☐ | ☐ | ☐ |
| `GET /search/suggest` | ☐ | ☐ `q` d’un caractère → listes vides | < 300 ms ☐ | Copie enregistrée | idem ☐ | ☐ | ☐ |
| `GET /looks` | ☐ | ☐ liste vide acceptée | < 500 ms ☐ | Copie enregistrée | idem ☐ | ☐ | ☐ |
| `GET /looks/:id` | ☐ | ☐ 404 `NOT_FOUND` | < 500 ms ☐ | Copie enregistrée | idem ☐ | ☐ | ☐ |
| `GET /settings/public` | ☐ (vrais codes marchands et USSD) | — | < 500 ms ☐ | Paramètres de paiement gardés sur le téléphone : l’écran de paiement reste utilisable | idem ☐ | ☐ | ☐ |
| `GET /delivery/cities` | ☐ | — | < 500 ms ☐ | Copie enregistrée | idem ☐ | ☐ | ☐ |
| `GET /delivery/agencies?city=` | ☐ | ☐ `city=Yaoundé` et `city=yaounde` donnent la même liste ; ☐ ville inconnue → `[]` | < 500 ms ☐ | Copie enregistrée | idem ☐ | ☐ | ☐ |
| `POST /cart/validate` | ☐ | ☐ `reduced` ; ☐ `unavailable` ; ☐ variante inconnue → `unavailable` (jamais 404 ni 422) ; ☐ appel sans connexion (public) | **< 500 ms** (délai de 2 s côté app) ☐ | Le panier reste utilisable, réservation bloquée | `no-store` ☐ | ☐ | ☐ |

### 6.4 Réservations

| Endpoint | Schéma | Erreurs à provoquer | p95 | Hors connexion | Cache-Control | CORS / cookies | Fait |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `POST /reservations` | ☐ 201 (`serverTime`, `amount`, `expiresAt` = +24 h) | ☐ 409 `STOCK_CONFLICT` avec `details.items` ; ☐ même `Idempotency-Key` deux fois → **une seule** réservation, même corps ; ☐ 422 `VALIDATION_ERROR` ; ☐ 401 → connexion puis reprise ; ☐ `deliveryFeePayment` `upfront` et `on_delivery` | < 1 s ☐ | Envoi impossible ; panier et formulaire conservés | `no-store` ☐ | ☐ `Idempotency-Key` autorisé par CORS | ☐ |
| `GET /reservations?status=reserved` | ☐ réservations **complètes** | ☐ inclut `payment_rejected` ; ☐ aucune réservation d’un autre client | < 500 ms ☐ | Bandeau « en attente » d’après la dernière copie | décision Contrat §2.7.2 ☐ | ☐ | ☐ |
| `GET /reservations?scope=&page=` | ☐ (`counts`, 10 par page, tri `updatedAt`) | ☐ `scope=done` page 2 ; ☐ `reachedStatus` pour expirée et annulée ; ☐ `expiresAt` seulement en attente de paiement | < 500 ms ☐ | Dernière liste avec « Mis à jour le … » | décision ☐ | ☐ | ☐ |
| `GET /reservations` (sans paramètre) | ☐ | — (utile seulement si `/_dev` est réactivé) | < 500 ms ☐ | — | décision ☐ | ☐ | ☐ |
| `GET /reservations/summary` | ☐ | ☐ `needsAction` = `reserved` + `payment_rejected` + `ready_for_pickup` ; ☐ route non prise pour une référence | < 500 ms ☐ | Pastille d’après la dernière copie | décision ☐ | ☐ | ☐ |
| `GET /reservations/:ref` | ☐ (journal, `cancellable`, `serverTime`, photos signées) | ☐ 404 `RESERVATION_NOT_FOUND` pour la réservation **d’un autre client** ; ☐ référence en minuscules acceptée ; ☐ liens des photos neufs à chaque appel | < 500 ms ☐ | Dernier état ; photos du colis remplacées par un message | décision ☐ | ☐ | ☐ |
| `POST /reservations/:ref/proof` | ☐ (`status`, `proof`, `reservation`) | ☐ 410 `RESERVATION_EXPIRED` ; ☐ 422 `INVALID_STATUS` ; ☐ 413 `FILE_TOO_LARGE` **en JSON** (pas la page du serveur web) ; ☐ 409 `DUPLICATE_PROOF` (même capture, autre réservation) ; ☐ empreinte fausse refusée | < 1 s (hors transfert) ☐ | Envoi bloqué, capture gardée en mémoire, reprise au retour du réseau | `no-store` ☐ | ☐ `multipart/form-data` accepté | ☐ |
| `POST /reservations/:ref/cancel` | ☐ (`status`, `reservation`) | ☐ 422 `CANCEL_NOT_ALLOWED` après `preparing` ; ☐ corps absent accepté (écran de paiement) ; ☐ motif enregistré | < 1 s ☐ | Refusé, message | `no-store` ☐ | ☐ | ☐ |

### 6.5 Notifications, contenus, erreurs client

| Endpoint | Schéma | Erreurs à provoquer | p95 | Hors connexion | Cache-Control | CORS / cookies | Fait |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `POST /push/subscribe` | ☐ 2xx | ☐ 422 `INVALID_SUBSCRIPTION` ; ☐ `oldEndpoint` remplace l’ancien abonnement ; ☐ deux appareils du même client abonnés ; ☐ appel sans jeton avec le seul cookie (service worker) | < 1 s ☐ | Non enregistré, « Activées » jamais affiché | `no-store` ☐ | ☐ cookie envoyé à `/api/push/subscribe` | ☐ |
| `POST /push/unsubscribe` | ☐ 204 | ☐ 204 pour un abonnement déjà inconnu | < 1 s ☐ | Ignoré | `no-store` ☐ | ☐ | ☐ |
| `GET /pages/:slug` | ☐ (9 slugs) | ☐ 404 `PAGE_NOT_FOUND` → « Page introuvable » | < 500 ms ☐ | Page déjà lue disponible | `public, max-age=300` ☐ | ☐ | ☐ |
| `POST /client-errors` | ☐ 204 | ☐ 429 au-delà de la limite ; ☐ aucun 401 | < 500 ms ☐ | Perdu (sans conséquence) | `no-store` ☐ | ☐ | ☐ |

---

## 7. Vérifications transverses

**Format et données**
- [ ] Une route inconnue (`GET /api/inexistant`) répond 404 en JSON `{ code: "NOT_FOUND", message, details? }`.
- [ ] Une erreur 500 provoquée répond en JSON, sans trace technique dans `message`.
- [ ] Toutes les dates ont un fuseau (`Z` ou `+01:00`).
- [ ] Tous les montants sont des entiers FCFA.
- [ ] Aucun `null` hors des champs permis (aucun avertissement `[Contrat API] … reçu null`).
- [ ] Messages en français, au vouvoiement, avec l’apostrophe ’, sans « commande ».

**Session**
- [ ] Jeton d’accès expiré (attendre sa durée, ou le révoquer) : l’app rafraîchit sans que le client s’en aperçoive.
- [ ] Panne simulée de l’API pendant un rafraîchissement (5xx) : le client **reste connecté**.
- [ ] Jeton expiré envoyé sur le catalogue : réponse 200, pas 401.
- [ ] 403 réservé aux droits réellement refusés ; réservation d’un autre client → 404.

**Cache et sécurité**
- [ ] Outils de développement > Application > Cache Storage, après un parcours connecté : `api-catalog` et `api-user` contiennent seulement les routes attendues ; **aucune** entrée `/auth`, `/push`, `/cart/validate`, preuve, photo du colis ou URL signée ; rien sous `/admin` ni `/api/admin`.
- [ ] Après la déconnexion : `api-user` est vide.
- [ ] Les URL des preuves et des photos du colis suivent un motif privé (Contrat §2.9) et expirent (lien ouvert 2 h plus tard : refusé).
- [ ] Sous-domaine seulement : requête préalable `OPTIONS` acceptée pour `Authorization`, `Content-Type` et `Idempotency-Key` ; `Access-Control-Allow-Origin` égal à l’origine exacte ; `Vary: Origin` ; politique de sécurité du contenu mise à jour.

**Hors connexion** (build avec service worker, après une visite en ligne)
- [ ] Mode avion : bandeau « Hors connexion · contenu de votre dernière visite ».
- [ ] Accueil, Explorer et fiches déjà vues s’affichent.
- [ ] Selon la décision §2.7.2 du Contrat : « Mes réservations » et le détail s’affichent avec « Mis à jour le … » (`private, no-cache`), ou un écran « Hors connexion » propre (`no-store`).
- [ ] Écran de paiement d’une réservation déjà ouverte : codes USSD et « Composer le code » disponibles.
- [ ] Retour du réseau : « Connexion rétablie », données relues, envoi de preuve repris.

---

## 8. Tests de fumée après la bascule

À faire en préproduction, sur un vrai téléphone Android (Chrome) et un iPhone (Safari, app installée sur l’écran d’accueil pour les notifications), en HTTPS. Noter pour chaque test : date, appareil, résultat, référence de réservation.

### 8.1 Parcours complet

- [ ] Accueil : sections chargées, photos réelles, aucune erreur dans la console.
- [ ] Explorer : filtres taille, prix, disponibilité, tri ; pagination en faisant défiler.
- [ ] Recherche : suggestions pendant la saisie, page de résultats.
- [ ] Fiche produit : changement de couleur (photo et tailles), guide des tailles, ajout au panier.
- [ ] Panier : quantité, « Réserver » (vérification du stock), connexion par SMS réel (nouveau client : prénom demandé).
- [ ] Formulaire de réservation : livraison à Douala, puis envoi par agence (autre ville), puis Retrait en boutique ; double appui sur « Confirmer » → une seule réservation.
- [ ] Écran de paiement : montant exact, compte à rebours cohérent (24 h), « Composer le code de paiement » (Android) ou « Copier le code » (iPhone).
- [ ] Preuve de paiement : envoi avec progression, écran Merci.
- [ ] Administration : rejet avec motif → l’app affiche le motif et « Renvoyer ma preuve » ; nouvelle preuve ; validation → « Confirmée ».
- [ ] Administration : préparation, photos du colis (1 à 3), remise à l’agence ou prête pour retrait → photos visibles dans le détail, « Enregistrer la photo ».
- [ ] Livrée ou retirée → onglet « Terminées », « Réserver à nouveau ».
- [ ] Annulation par le client avant la préparation ; refus propre après la préparation (`CANCEL_NOT_ALLOWED`).
- [ ] Expiration : réservation non payée laissée jusqu’à `expiresAt` (ou échéance raccourcie en base de test) → « Expirée », stock libéré.
- [ ] Profil : informations, adresses (ajout, modification, par défaut, suppression avec « Annuler »).
- [ ] Rechargement de la page à chaque étape : le client reste connecté (cookie de rafraîchissement).
- [ ] Déconnexion puis reconnexion : favoris fusionnés, réservations retrouvées.

### 8.2 Notifications

- [ ] « Activer » sur l’écran Merci : permission, puis « Activées » dans le profil ; abonnement visible côté serveur avec la bonne plateforme.
- [ ] App fermée : validation du paiement → notification système ; un appui ouvre la bonne réservation.
- [ ] App ouverte : message interne et données relues, sans notification système.
- [ ] Rejet → bouton « Renvoyer ma preuve » ; colis prêt → photo dans la notification (Android) ; `expiring_soon` → bouton « Payer ».
- [ ] Pastille de l’icône allumée pour un rejet, une échéance proche ou un colis prêt ; effacée à la déconnexion.
- [ ] Deux appareils du même client reçoivent la notification.
- [ ] « Désactiver » dans le profil, puis déconnexion : plus aucune notification sur cet appareil (`POST /push/unsubscribe` reçu avant `/auth/logout`).
- [ ] Abonnement supprimé côté serveur quand le service de push répond 404 ou 410 (désinstaller l’app puis déclencher un envoi).

### 8.3 Hors connexion

- [ ] Reprendre la partie « Hors connexion » du §7 sur un vrai téléphone en mode avion.
- [ ] Page jamais visitée hors connexion → page « Hors ligne » avec les articles consultés disponibles.
- [ ] Mise à jour de l’app (nouveau build déployé) : bandeau « Une nouvelle version est disponible », jamais pendant le paiement ou l’envoi de preuve.

### 8.4 Contenus, partage et erreurs

- [ ] Pages légales et d’aide (9 slugs), questions fréquentes repliables, slug inconnu → « Page introuvable ».
- [ ] Lien d’une fiche produit collé dans WhatsApp : aperçu avec photo, nom et prix (balises rendues par le serveur).
- [ ] `https://<domaine>/robots.txt` et les plans du site accessibles ; fiches produit présentes dans le plan des produits.
- [ ] Erreur JavaScript provoquée en préproduction → reçue par `POST /client-errors`, sans donnée personnelle.
- [ ] Console : aucun avertissement `[Contrat API]` sur tout le parcours.

---

## 9. Mesurer les temps de réponse

| Type d’appel | Objectif p95 côté serveur | Remarque |
| --- | --- | --- |
| Catalogue et données publiques (`GET`) | **< 500 ms** | `GET /search/suggest` : < 300 ms conseillé (saisie en direct). |
| Lectures du client (`GET /me`, `/reservations*`) | < 500 ms (proposition) | Rechargées toutes les 20 à 30 s quand l’écran est visible (Contrat §2.14). |
| Écritures (`POST`, `PATCH`, `DELETE`) | **< 1 s** | Envoi de preuve : temps de traitement, hors transfert du fichier. |
| `POST /cart/validate` | < 500 ms | L’app abandonne à 2 s. |

- Mesure côté serveur : journal des temps de réponse de Symfony (ou du serveur web), sur au moins 200 appels par route, en préproduction avec des données de taille réelle.
- Contrôle côté app : outils de développement > Réseau, avec la limitation « 3G rapide » (Fast 3G) ; le temps « en attente du serveur » (TTFB) doit rester sous les objectifs.
- Noter les résultats dans la colonne « p95 » du §6.

---

## 10. Signaler un écart

**Qui contacter**

| Rôle | Nom | Moyen |
| --- | --- | --- |
| Référent back-end (API Symfony) | [À COMPLÉTER] | [À COMPLÉTER] |
| Référent front (application) | [À COMPLÉTER] | [À COMPLÉTER] |
| Décisions côté boutique (textes, règles) | [À COMPLÉTER] | [À COMPLÉTER] |

**Comment signaler**

1. Copier **l’avertissement `[Contrat API]` complet** depuis la console, ou décrire l’écart constaté à l’écran.
2. Ajouter : environnement (préproduction ou production), date et heure, appareil et navigateur, version de l’app (visible dans `/_dev` si activée, sinon dans le profil), route et méthode, statut HTTP reçu.
3. Joindre la réponse brute (outils de développement > Réseau > la requête > Réponse), **en masquant** les jetons, numéros de téléphone et noms.
4. Citer la section du Contrat concernée (ex. « Contrat §10.6, champ `expiresAt` »).
5. Indiquer qui doit corriger : le serveur (réponse non conforme au Contrat), le front (l’app ne suit pas le Contrat), ou le Contrat lui-même (besoin nouveau ou règle à changer).

Modèle :

```text
Écart d’intégration — préproduction — 2026-11-04 15:42
Appareil : Samsung A14, Chrome 130 — app 0.7.0
Route : GET /api/reservations/RES-000131 → 200
Console : [Contrat API] /reservations/RES-000131 : champ "packageReadyAt" manquant
Attendu : Contrat §10.6 et annexe A.8 — packageReadyAt (date ou null) toujours présent
À corriger par : back-end
```

- Un écart du Contrat lui-même se corrige dans `docs/CONTRAT_API.md` (nouvelle version datée), puis dans le code du front, les mocks et les schémas (`src/lib/api/schemas/`).
- Les décisions sont reportées dans `docs/SUIVI_POINTS_OUVERTS.md`.

---

## 11. Revenir en arrière

- En production, on ne revient **jamais** aux mocks : un problème d’API se corrige côté serveur, ou on redéploie le build précédent de l’application.
- Redéployer un ancien build : l’app installée le détecte à la recherche de mise à jour suivante (démarrage, retour sur l’app, toutes les 60 min) et propose de recharger.
- En préproduction, un build avec `VITE_API_MOCK=true` reste possible pour comparer avec le comportement de référence (mocks et `/_dev` actifs).
