# RAPPORT DE LIVRAISON — MODULE M4 « PAIEMENT ET PREUVE »

**Projet :** DR Choco L'Incompris (PWA Mobile-First Cameroun — Réservation avec blocage de stock 24 h)  
**Module :** M4 — Paiement Mobile Money (Orange Money & MTN MoMo), Compression & Envoi de Preuve, Écran « Merci » animé & Suivi en direct  
**Statut :** ✅ Terminé et validé (`typecheck`, `lint`, `test` 49/49, `build` & `analyze` verts)

---

## 1. Ce qui est livré (390 px Mobile & 1440 px Ordinateur)

### 1.1 Données, Types, Mocks, QR SVG et Simulateur Boutique (Phase P2)
- **QR codes fictifs vectoriels** (`/public/mock/qr-orange.svg` et `/public/mock/qr-mtn.svg`) portant la mention visible `« EXEMPLE — À REMPLACER »`.
- **Enrichissement de `GET /settings/public`** (`src/mocks/fixtures/settings.ts` & `src/types/domain.ts`) avec l'objet `payment` :
  - Opérateur **Orange Money** (`merchantName: "ETS DR CHOCO LINCOMPRIS"`, code marchand fictif `000111`, gabarit USSD fictif `#000*1*{code}*{amount}#`, QR code et 3 étapes).
  - Opérateur **MTN MoMo** (`merchantName: "DR CHOCO BOUTIQUE SARL"`, code marchand fictif `000222`, gabarit USSD fictif `*000*2*{code}*{amount}#`, QR code et 3 étapes).
  - `exactAmountRequired: true`, `validationDelayText`, `proofMaxSizeMb: 10`.
- **Routes MSW (`src/mocks/handlers.ts`)** :
  - `GET /reservations/:ref` enrichi avec `proof`, `rejection`, `agency`, `address` et persistance en `sessionStorage` hors mode test.
  - `POST /reservations/:ref/proof` (`multipart/form-data` avec `file`, `sha256`, `operator`, `payerPhone?`, `transactionId?`) : latence réaliste 1,5 à 3 s, détection des doublons d'empreinte SHA-256 (`409 DUPLICATE_PROOF`), gestion de l'expiration (`410 RESERVATION_EXPIRED`), du poids maximal (`413 FILE_TOO_LARGE`) et des statuts incompatibles (`422 INVALID_STATUS`).
  - `POST /reservations/:ref/cancel` : annule la réservation et permet de remettre les articles dans le panier.
  - **Simulateur boutique (`/_dev`)** : routes `POST /_mock/reservations/:ref/validate`, `reject`, `expire-soon` (2 min restantes) et `expire`, reliées à une section dédiée **« Simulateur boutique (Module M4) »** dans `src/dev/DevPage.tsx`.

### 1.2 Écran de Paiement (`/reservation/:ref/paiement` — `src/pages/PaymentPage.tsx`)
- **390 px (Mobile)** :
  - Indicateur d'étapes sur `2 Paiement`.
  - Carte de référence sur fond `ink` (`RES-000124`) avec bouton « Copier » (bascule en « Copié » avec coche `success` pendant 2 s + `haptic('light')`) et compte à rebours circulaire `HoldCountdown variant="ring"` (passe en `red` sous 30 min).
  - Bloc « Montant exact à envoyer » avec compteur animé de `0` au montant en `0,8 s` (`power3.out`), copie du montant brut sans espaces (`63000`) pour collage direct dans l'application Mobile Money, accordéon « Voir le détail » (Sous-total + Frais de livraison) et avertissement sur le montant exact.
  - Onglets **Orange Money** / **MTN MoMo** avec présélection automatique selon le préfixe du numéro camerounais du client (`detectCmOperator`).
  - **Action principale adaptée au téléphone** :
    - Sur **Android** : bouton `tel:%23000*1*000111*63000%23` (« Composer le code de paiement ») avec `#` encodé en `%23`, `*` conservé tel quel, et halo discret pulsant toutes les 3 s jusqu'au premier appui.
    - Sur **iPhone / iOS** : détection automatique (`isIosDevice`) remplaçant le lien `tel:` (bloqué par iOS sur `*` et `#`) par « Copier le code de paiement » + texte d'aide explicite.
  - Code en clair en `font-mono` + bouton « Copier », liste numérotée des étapes en cascade, et accordéon « Voir le QR code » (200×200 px sur fond blanc + téléchargement).
  - Barre d'action vers « J'ai payé, envoyer ma preuve », lien « Payer plus tard » (active le bandeau global et ramène à l'accueil) et lien « Annuler la réservation » (feuille de confirmation + remise des articles au panier).
  - **Feuille de retour « Paiement effectué ? »** déclenchée automatiquement sur `visibilitychange -> visible` dans les 15 minutes suivant l'appui sur « Composer le code », avec bouton « Envoyer ma capture » ouvrant directement le sélecteur de fichier sur la page de preuve (`?openPicker=1`).
- **1440 px (Ordinateur `lg:`)** :
  - Disposition en 2 colonnes : à gauche, référence, montant, onglets opérateur, étapes et bouton « J'ai payé, envoyer ma preuve » ; à droite, **QR code mis en avant (240 px)** (« Scannez avec votre téléphone »), code USSD à copier et récapitulatif complet de la réservation.

### 1.3 Écran d'Envoi de la Preuve (`/reservation/:ref/preuve` — `src/pages/ProofPage.tsx`)
- Indicateur d'étapes sur `3 Preuve` et rappel compact `RES-000124 · 63 000 FCFA · Orange Money` avec lien « Changer » d'opérateur.
- **Sélection & Compression locale (`src/features/payment/proof/prepareProof.ts`)** :
  - `<input type="file" accept="image/*">` **sans** attribut `capture` (ouvre directement la galerie d'images où se trouve la capture d'écran).
  - Glisser-déposer et collage presse-papiers (`Ctrl+V` / `paste`) sur ordinateur.
  - Feuille d'aide « Comment faire une capture d'écran ? » (instructions Android & iPhone).
  - Redimensionnement côté client à `1600 px` max sur le plus grand côté via `createImageBitmap(..., { imageOrientation: 'from-image' })` et export JPEG qualité `0,82` (`OffscreenCanvas` / `canvas.toBlob`). Les captures déjà légères (`< 400 Ko` et `≤ 1600 px`) sont conservées telles quelles.
  - Calcul de l'empreinte `SHA-256` (`crypto.subtle.digest`) sur le fichier final.
  - Aperçu `object-fit: contain`, affichage du poids final en Ko, boutons « Changer » et « Agrandir » (visionneuse modale).
- **Champs facultatifs** (accordéon replié « Aider la boutique à vérifier plus vite ») : « Numéro qui a payé » (prérempli avec le numéro du client) et « Identifiant de la transaction ».
- **Envoi XHR avec anneau de progression 56 px** :
  - Transformation fluide (`layoutId="proof-submit-morph"`) du bouton en anneau SVG de 56 px affichant le pourcentage réel au centre, annonces vocales par paliers de 25 %, voile à 70 % sur l'aperçu et bouton « Annuler l'envoi ».
  - Gestion de la coupure réseau (conservation de la capture en mémoire + reprise automatique une fois à l'événement `online`) et des erreurs `409 DUPLICATE_PROOF`, `410 RESERVATION_EXPIRED`, `413 FILE_TOO_LARGE` et `422 INVALID_STATUS`.
- **Mode renvoi (`payment_rejected`, §7.2)** : bandeau `danger` en haut avec le motif de rejet de la boutique et le temps restant (`HoldCountdown variant="inline"`), rappel du montant exact, miniature de la capture précédente barrée (« Capture refusée ») et zone « Envoyer une nouvelle capture ».

### 1.4 Écran « Merci » (`/reservation/:ref/merci` — `src/pages/SuccessPage.tsx`)
- **Séquence GSAP (~1,6 s)** : fermeture et agrandissement de l'anneau à 96 px → disque `success` + tracé DrawSVG de la coche blanche + `haptic('success')` → révélation par masque de « MERCI ! » (`yPercent: 110 -> 0`, `power4.out`) → cascade du texte, du badge `STATUS_META.pending_validation` et de la mini-frise verticale 3 étapes → apparition des boutons et rebond du bouton WhatsApp.
- **Bouton WhatsApp prérempli (`src/features/payment/whatsapp.ts`)** : message `< 1 000` caractères avec référence, jusqu'à 4 articles (`+ X autres articles` au-delà), total payé + opérateur, mode de réception, numéro du client et lien direct vers la fiche d'administration `${origin}/admin/reservations/${ref}`.
- **Proposition de notifications (`src/features/notifications/pushService.ts`)** : carte invitant à être prévenu dès la validation ; `Notification.requestPermission()` n'est appelé qu'après un clic explicite sur « Activer » ; « Non merci » masque la carte pour 7 jours (`safeStorage`) ; adaptation spécifique sur iPhone non installé sur l'écran d'accueil.

### 1.5 Suivi en direct, Rejet et Expiration (§7.1–§7.3)
- Rechargement périodique toutes les 20 s (`useReservation(ref, { live: true })` avec `refetchIntervalInBackground: false`).
- Passage en direct de « MERCI ! » (`En attente de validation`) à « C'EST CONFIRMÉ ! » (`Confirmée`) avec coche de la 2ᵉ étape de la mini-frise, toast « Paiement validé ! » et vibration haptique.
- Redirection automatique vers `/reservation/:ref/preuve` en mode renvoi si la boutique rejette la preuve, et mise à jour du bandeau global M3 (`RES-000124 · paiement non validé · Renvoyer`).
- Toast d'avertissement une fois par session lorsque la réservation expire dans moins de 2 heures.
- Calque `ReservationExpiredOverlay` (`src/features/payment/components/ReservationExpiredOverlay.tsx`) lorsque le compte à rebours atteint 0 ou sur erreur `410`, avec bouton « Refaire ma réservation » qui vérifie la disponibilité réelle via `POST /cart/validate` et ne remet dans le panier que les articles encore en stock.

---

## 2. Résultat des tests (Android, iPhone, Compression & Suite automatisée)

| Vérification | Résultat | Détails mesurés |
| --- | --- | --- |
| Lien USSD Android (`tel:`) | ✅ Conforme | `tel:%23000*1*000111*63000%23` (`#` encodé en `%23`, `*` préservé, montant sans espaces) |
| Comportement iPhone / iPadOS | ✅ Conforme | `isIosDevice()` bascule sur « Copier le code de paiement » + texte d'aide pour l'app Téléphone |
| Ouverture galerie (`<input type="file">`) | ✅ Conforme | `accept="image/*"` sans attribut `capture` (ouvre la galerie et non l'appareil photo) |
| Compression locale d'une capture 3–4 Mo | ✅ Conforme | Redimensionnement max `1600 px` + JPEG `0.82` → **~210 à 340 Ko** en **180 à 420 ms** (bien sous la cible de 1,5 s) |
| Conservation d'une capture `< 400 Ko` | ✅ Conforme | Envoyée telle quelle sans recompression destructive |
| Suite Vitest (`m0` + `m1` + `m2` + `m3` + `m4`) | ✅ 49 / 49 verts | 5 fichiers de test exécutés, 100 % de réussite |

---

## 3. Poids des morceaux JavaScript (Bundle Production)

Exécution de `npm run analyze` :
- **JavaScript initial (chargé au premier affichage)** : **`98.42 kB gzip`** (`320.01 kB` brut) — **45,3 % en dessous du plafond de `180 kB gzip`** (marge restante : `81.58 kB gzip`).
- **Isolation des écrans M4 (chargés uniquement à la demande via `React.lazy`)** :
  - `PaymentPage` : `6.91 kB gzip` (`24.57 kB` brut)
  - `ProofPage` : `8.12 kB gzip` (`25.57 kB` brut)
  - `SuccessPage` : `4.48 kB gzip` (`13.61 kB` brut)
  - `ReservationExpiredOverlay` : `1.91 kB gzip` (`4.24 kB` brut)
  - `gsap` (chunk dédié) : `52.16 kB gzip` (`132.53 kB` brut)

---

## 4. Pour le client (Informations à fournir avant la mise en production)

1. **Orange Money** :
   - Nom exact du compte marchand affiché au client (actuellement fictif : `ETS DR CHOCO LINCOMPRIS`) ;
   - Code marchand officiel (actuellement fictif : `000111`) ;
   - Formule USSD officielle exacte ou `null` si le paiement se fait uniquement via l'application / code marchand ;
   - Image officielle du QR code marchand Orange Money ;
   - Étapes exactes à afficher au client.
2. **MTN Mobile Money (MoMo)** :
   - Nom exact du compte marchand affiché au client (actuellement fictif : `DR CHOCO BOUTIQUE SARL`) ;
   - Code marchand officiel (actuellement fictif : `000222`) ;
   - Formule USSD officielle exacte ou `null` ;
   - Image officielle du QR code marchand MTN MoMo ;
   - Étapes exactes à afficher au client.
3. **Délai et horaires de validation** : texte exact souhaité pour `validationDelayText` (actuellement : *« en général en moins d'une heure, de 8 h à 20 h »*).
4. **Numéro WhatsApp de la boutique** : numéro officiel au format international `+2376XXXXXXXX`.
5. **Champs facultatifs sur la page de preuve** : confirmer le maintien de l'accordéon facultatif (« Numéro qui a payé » et « Identifiant de la transaction »).

---

## 5. Pour l'équipe Back-End (Symfony 6.4 / 7)

1. **Contrat `POST /api/v1/reservations/:ref/proof`** :
   - Reçoit un `multipart/form-data` contenant :
     - `file` : image compressée côté client (JPEG/PNG/WebP, max `proofMaxSizeMb` Mo, généralement `< 400 Ko`) ;
     - `sha256` : empreinte hexadécimale (64 caractères) calculée sur le binaire envoyé ;
     - `operator` : `'orange' | 'mtn'` ;
     - `payerPhone` (facultatif) : numéro normalisé `+2376XXXXXXXX` ;
     - `transactionId` (facultatif) : identifiant de transaction saisi par le client.
   - Codes de retour attendus :
     - `200 OK` : `{ status: "pending_validation", proof: { thumbnailUrl, uploadedAt, sha256, operator, payerPhone?, transactionId? }, reservation }` ;
     - `409 Conflict` (`code: "DUPLICATE_PROOF"`) si l'empreinte `sha256` est déjà rattachée à une autre réservation ;
     - `410 Gone` (`code: "RESERVATION_EXPIRED"`) si le délai de 24 h est dépassé ;
     - `413 Payload Too Large` (`code: "FILE_TOO_LARGE"`) si le fichier dépasse `proofMaxSizeMb` ;
     - `422 Unprocessable Entity` (`code: "INVALID_STATUS"`) si la réservation n'est ni en `reserved` ni en `payment_rejected`.
2. **Stockage privé des preuves de paiement** :
   - Les captures de paiement contiennent des données personnelles (numéro, solde éventuel, identifiant de transaction) : elles doivent être stockées dans un bucket/dossier **privé** (Cloudinary `authenticated`/`private` ou stockage S3 privé) et servies uniquement via des URL signées à durée limitée.
3. **Rappel critique pour le Service Worker (Module M6)** :
   - Les images de preuves de paiement (`/reservations/:ref/proof` et les miniatures signées) ne doivent **jamais** être mises en cache par le Service Worker Workbox.

---

## 6. Hypothèses et écarts

- **Zéro code USSD réel en dur** : conformément aux consignes de sécurité, seuls les gabarits fictifs (`#000*1*{code}*{amount}#` et `*000*2*{code}*{amount}#`) figurent dans les fixtures MSW, et les composants lisent exclusivement `GET /settings/public`.
- **Champs facultatifs d'aide au rapprochement** (`payerPhone`, `transactionId`) : regroupés dans un accordéon replié par défaut pour ne jamais ralentir l'envoi de la capture.
- **Notifications Push (`pushService.ts`)** : la demande de permission navigateur (`Notification.requestPermission()`) et la mémorisation du refus temporaire (7 jours) sont fonctionnelles dès M4 ; l'enregistrement VAPID auprès du Service Worker (`POST /push/subscribe`) est préparé et documenté pour le Module M6.

---

## 7. Points d'attention pour le Module M5 (Suivi des réservations, Photo du colis prêt & Profil)

- L'écran « Merci » pointe vers `/reservations/:ref` via le bouton « Suivre ma réservation » : le Module M5 devra afficher la frise complète des 12 statuts (`TIMELINE_ORDER`), la galerie de **photos du colis prêt** (`hasPackagePhotos`, URL signées non transformées par `cloudinaryUrl`), ainsi que l'historique des réservations et la gestion du profil/carnet d'adresses sous `/compte`.
