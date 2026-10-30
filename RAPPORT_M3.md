# Rapport de Livraison — Module M3 « Panier, Connexion et Réservation »

**Projet** : DR Choco L’Incompris — Boutique PWA mobile-first de réservation (streetwear, chaussures et babouches artisanales au Cameroun)  
**Module** : M3 — Panier (`/panier` + `CartDrawer`), Connexion par SMS OTP (`AuthSheet` + gestion de session), Formulaire de réservation (`/reservation` + moment signature + `HoldCountdown` + `PendingReservationBanner`)  
**Statut** : **Terminé et validé** (`typecheck` 0 erreur, `lint` 0 erreur / 0 warning, `test` 39/39 tests réussis, bundle initial `97,40 kB gzip < 180 kB gzip`).

---

## 1. Arbre complet des fichiers créés et modifiés en M3

```text
├── RAPPORT_M3.md                                                [CRÉÉ]
├── package.json                                                 [MODIFIÉ] (+ react-hook-form, zod, @hookform/resolvers)
└── src/
    ├── app/
    │   └── layouts/
    │       └── RootLayout.tsx                                   [MODIFIÉ] (Rafraîchissement silencieux /auth/refresh, PendingReservationBanner, LazyCartDrawer, LazyAuthSheet, useNetworkRecoveryToast)
    ├── components/
    │   ├── layout/
    │   │   ├── AppHeader.tsx                                    [MODIFIÉ] (Ouverture CartDrawer au clic panier bureau, initiale du prénom dans cercle bg-ink sur « Mon compte » connecté)
    │   │   └── BottomNav.tsx                                    [MODIFIÉ] (Masquage sur /produit/*, /reservation et /panier non vide pour laisser place aux barres collantes)
    │   └── ui/
    │       └── SizePicker.tsx                                   [MODIFIÉ] (Intention « reserve » branchée sur requireAuth -> /reservation ; ouverture auto CartDrawer 2,5 s sur bureau)
    ├── features/
    │   ├── auth/
    │   │   ├── api/
    │   │   │   └── useAuthQueries.ts                            [CRÉÉ] (useRequestOtp, useVerifyOtp + fusion favoris, useMe, useUpdateProfile, useLogout, useRequireAuth)
    │   │   └── components/
    │   │       └── AuthSheet.tsx                                [CRÉÉ] (Feuille OTP 3 étapes : Téléphone +237 & badge Orange/MTN, 6 cases OTP + WebOTP + 422/410/429 + cascade verte, Prénom/Nom nouveau client)
    │   ├── cart/
    │   │   ├── api/
    │   │   │   └── useCartQueries.ts                            [CRÉÉ] (useValidateCart + synchronisation automatique avec cartStore)
    │   │   └── components/
    │   │       ├── AnimatedPriceCounter.tsx                     [CRÉÉ] (Compteur animé en FCFA interpolé sur 0,25 s avec tabular-nums)
    │   │       ├── CartDrawer.tsx                               [CRÉÉ] (Tiroir latéral bureau 420 px, ouverture auto 2,5 s à l’ajout sauf survol, bouton Réserver -> requireAuth)
    │   │       ├── CartItemRow.tsx                              [CRÉÉ] (Ligne article 80×100 px, chiffre déroulant 0,2 s, swipe-to-delete drag="x", états reduced / unavailable / price_changed)
    │   │       └── EmptyCartState.tsx                           [CRÉÉ] (Illustration SVG cabas tracée au GSAP DrawSVG + grille 4 articles populaires sur /panier)
    │   └── reservation/
    │       ├── api/
    │       │   └── useReservationQueries.ts                     [CRÉÉ] (useAddresses, useSaveAddress, useDeliveryCities, useAgencies, useCreateReservation avec Idempotency-Key, usePendingReservations, useReservation)
    │       ├── components/
    │       │   ├── CheckoutStepper.tsx                          [CRÉÉ] (Indicateur 3 étapes : 1 Coordonnées · 2 Paiement · 3 Confirmation)
    │       │   ├── CityPickerField.tsx                          [CRÉÉ] (Sélecteur 15 villes camerounaises : Sheet plein écran mobile / liste filtrable bureau avec frais et délai)
    │       │   ├── HoldCountdown.tsx                            [CRÉÉ] (Compte à rebours 24 h : variantes ring / inline / compact, correction serverTime, pause onglet masqué, tons ink / warning / red)
    │       │   ├── PendingReservationBanner.tsx                 [CRÉÉ] (Bandeau discret global pour réservation pending_payment active avec HoldCountdown compact et fermeture par session)
    │       │   └── SignatureHoldOverlay.tsx                     [CRÉÉ] (Moment signature GSAP : convergence miniatures -> sceau octogonal DrawSVG -> coche rouge -> référence RES-XXXXXX)
    │       └── schema/
    │           ├── reservationDraftStorage.ts                   [CRÉÉ] (Sauvegarde et restauration debounced 500 ms du brouillon dans sessionStorage)
    │           └── reservationSchema.ts                         [CRÉÉ] (Validation conditionnelle Zod Douala local / agence interurbaine / retrait boutique + computeReservationAmounts)
    ├── lib/
    │   ├── api/
    │   │   ├── endpoints.ts                                     [MODIFIÉ] (Ajout endpoints.cart.validate)
    │   │   └── queryKeys.ts                                     [MODIFIÉ] (Ajout qk.pendingReservations)
    │   ├── hooks/
    │   │   └── useOnlineStatus.ts                               [CRÉÉ] (useOnlineStatus + useNetworkRecoveryToast)
    │   └── utils/
    │       ├── operator.ts                                      [CRÉÉ] (detectCmOperator Orange / MTN et getOperatorLabel)
    │       └── phone.ts                                         [MODIFIÉ] (Ajout cleanCmPhoneDigits et formatCmPhoneInput en direct 6XX XX XX XX)
    ├── mocks/
    │   ├── fixtures/
    │   │   └── settings.ts                                      [MODIFIÉ] (15 villes camerounaises avec frais/délais, agences fictives par ville, 2 adresses enregistrées pour Junior Mbarga)
    │   └── handlers.ts                                          [MODIFIÉ] (Handlers MSW M3 : /cart/validate, /auth/otp/request, /auth/otp/verify, /auth/refresh, /auth/logout, /me, /me/addresses, /favorites, /delivery/cities, /delivery/agencies, /reservations idempotent + 409)
    ├── pages/
    │   ├── CartPage.tsx                                         [MODIFIÉ] (Page complète /panier mobile & bureau : vérification /cart/validate, swipe-to-delete + Toast Annuler 5 s, récapitulatif collant)
    │   ├── CheckoutPage.tsx                                     [MODIFIÉ] (Page complète /reservation : coordonnées, cartes Livraison / Retrait boutique, adresses enregistrées, Douala vs Agence, créneaux retrait, gestion 409/401/réseau, moment signature)
    │   ├── PaymentPage.tsx                                      [MODIFIÉ] (Point d’entrée /reservation/:ref/paiement avec CheckoutStepper étape 2, HoldCountdown ring, coordonnées Mobile Money et état Réservation introuvable)
    │   ├── ProductPage.tsx                                      [MODIFIÉ] (Bouton « Réserver maintenant » branché sur requireAuth -> /reservation ; ouverture auto CartDrawer sur bureau)
    │   ├── ProfilePage.tsx                                      [MODIFIÉ] (Connexion OTP si invité, informations client et bouton « Se déconnecter » conservant le panier)
    │   └── ReservationsPage.tsx                                 [MODIFIÉ] (Liste des réservations actives avec HoldCountdown inline et lien vers le paiement)
    ├── stores/
    │   ├── cartStore.ts                                         [MODIFIÉ] (Plafonnement maxQuantity, restore(item, index), validationMap, applyValidation)
    │   ├── reservationStore.ts                                  [CRÉÉ] (activeReservation, serverTimeOffsetMs, bannerDismissedRef en sessionStorage)
    │   └── uiStore.ts                                           [MODIFIÉ] (isCartDrawerOpen, isAuthSheetOpen, requireAuth(next, onCancel))
    ├── test/
    │   ├── m0.test.tsx                                          [MODIFIÉ] (Alignement assertion route /panier sur l’état vide réel M3)
    │   ├── m3.test.tsx                                          [CRÉÉ] (8 tests automatisés couvrant les 7 exigences de §9.3)
    │   └── setup.ts                                             [MODIFIÉ] (Nettoyage ScrollTrigger en afterEach)
    └── types/
        ├── api.ts                                               [MODIFIÉ] (Contrats API M3 : CartValidatePayload, CartValidationResult, OtpRequestResult, AuthSession, CreateReservationPayload, ReservationCreated)
        └── domain.ts                                            [MODIFIÉ] (Enrichissement DeliveryCity, Agency, Address, Reservation)
```

---

## 2. Résultats des vérifications (`typecheck`, `lint`, `test`, `analyze`)

| Commande | Résultat | Détails |
| :--- | :--- | :--- |
| `npm run typecheck` | **SUCCÈS** (`0 erreur`) | `tsc -b --noEmit` exécuté en mode strict sans aucune erreur. |
| `npm run lint` | **SUCCÈS** (`0 erreur, 0 warning`) | ESLint + React Hooks + React Refresh passent sans avertissement. |
| `npm run test` | **SUCCÈS** (`39 / 39 tests passés`) | `m0.test.tsx` (14), `m1.test.tsx` (7), `m2.test.tsx` (10), `m3.test.tsx` (8). |
| `npm run analyze` | **SUCCÈS** (`built in 6.49s`) | Bundle initial `index.js` à **97,40 kB gzip** (objectif `< 180 kB gzip`). |
| Couleurs en dur (`#`, `rgb(`) | **0 occurrence** | Aucune couleur en dur dans `src/` hors `src/styles/index.css` et `src/mocks/`. |

---

## 3. Tailles brutes et gzip des chunks générés (`npm run analyze`)

L'analyse de production confirme que **`react-hook-form`, `zod` et `@hookform/resolvers` sont intégralement isolés dans le chunk `CheckoutPage`** (chargé uniquement lorsque l'utilisateur accède à `/reservation`) et que `AuthSheet` ainsi que `CartDrawer` sont chargés à la demande (`React.lazy`).

| Chunk / Asset | Taille brute | Taille gzip | Rôle |
| :--- | ---: | ---: | :--- |
| `dist/assets/index-DidYY3Fw.js` | `316,47 kB` | **`97,40 kB`** | Noyau initial (React 19, routeur, stores, en-tête, barre d'onglets) — **< 180 kB gzip** |
| `dist/assets/index-sdot4q1t.css` | `68,29 kB` | `12,56 kB` | Feuille de style Tailwind CSS v4 + tokens `@theme` |
| `dist/assets/CheckoutPage-O_i8XUG0.js` | `160,84 kB` | `47,81 kB` | Page `/reservation` + `react-hook-form` + `zod` + `CityPickerField` + `SignatureHoldOverlay` (isolé à la demande) |
| `dist/assets/AuthSheet-Dkey_Y41.js` | `14,18 kB` | `4,78 kB` | Feuille de connexion OTP en 3 étapes (chargée à la demande) |
| `dist/assets/CartPage-BeSOHKso.js` | `10,75 kB` | `3,51 kB` | Page `/panier` complète + `EmptyCartState` |
| `dist/assets/CartItemRow-DaVLpGML.js` | `7,15 kB` | `2,60 kB` | Ligne d'article du panier (swipe-to-delete, sélecteur de quantité animé) |
| `dist/assets/CartDrawer-BQo0AxnN.js` | `5,20 kB` | `2,22 kB` | Tiroir latéral du panier sur ordinateur (420 px) |
| `dist/assets/PaymentPage-1nfWFw7p.js` | `5,81 kB` | `2,06 kB` | Page `/reservation/:ref/paiement` + `HoldCountdown` anneau SVG |
| `dist/assets/ProfilePage-CiqNaXCj.js` | `5,87 kB` | `1,97 kB` | Page `/profil` avec connexion OTP et déconnexion |
| `dist/assets/AnimatedPriceCounter-D3XFBZPf.js` | `0,88 kB` | `0,53 kB` | Compteur de montant animé en FCFA |
| `dist/assets/CheckoutStepper-Ckmh4opL.js` | `1,37 kB` | `0,71 kB` | Indicateur d'avancement en 3 étapes |
| `dist/assets/ReservationsPage-BcGKT5H2.js` | `0,70 kB` | `0,47 kB` | Liste des réservations `/reservations` |

---

## 4. Hypothèses (`// HYPOTHÈSE:`) et questions ouvertes pour l'équipe back-end Symfony

Toutes les hypothèses ci-dessous sont balisées par `// HYPOTHÈSE:` dans le code source :

1. **Ville principale de la boutique (`src/mocks/fixtures/settings.ts`)** :
   - La boutique physique Flagship est configurée à **Douala** (`isLocal: true`, frais de livraison à domicile par coursier de `1 500 FCFA`, délai « Aujourd'hui ou demain »). Les 14 autres villes camerounaises utilisent le mode d'expédition par agence interurbaine (`hasAgencies: true`, frais de `2 000` à `5 000 FCFA`).
2. **Mode de règlement des frais de livraison (`PublicSettings.deliveryFeePayment`)** :
   - Par défaut configuré à `'upfront'` (les frais de livraison sont inclus dans le total Mobile Money à régler). Le moteur `computeReservationAmounts` et l'interface supportent également `'on_delivery'` (« À payer à la réception »).
3. **Format du SMS pour WebOTP Android (`src/features/auth/components/AuthSheet.tsx`)** :
   - Pour que le remplissage automatique `navigator.credentials.get({ otp: { transport: ['sms'] } })` fonctionne sur Chrome Android sans quitter l'application, le SMS envoyé par le back-end Symfony devra se terminer par la ligne normalisée : `@<domaine-production> #123456`.
4. **Contrat de vérification du panier `POST /api/v1/cart/validate` (`src/types/api.ts`, `src/mocks/handlers.ts`)** :
   - Requête : `{ items: [{ variantId: string, quantity: number }] }`.
   - Réponse : `{ checkedAt: string, items: [{ variantId, status: 'ok' | 'reduced' | 'unavailable' | 'price_changed', availableQuantity, unitPrice, previousPrice? }] }`.
5. **Idempotence et horloge serveur sur `POST /api/v1/reservations` (`src/features/reservation/api/useReservationQueries.ts`)** :
   - Le front-end envoie l'en-tête HTTP `Idempotency-Key: <UUID v4>` généré à l'ouverture du formulaire `/reservation` et conservé à travers les tentatives réseau.
   - La réponse inclut `serverTime` (ISO 8601) et `expiresAt` (ISO 8601) afin que `HoldCountdown` corrige immédiatement tout décalage d'horloge du téléphone client.

---

## 5. Points d'accroche prêts pour le Module M4

Les fondations et points d'entrée suivants sont opérationnels et prêts à accueillir le **Module M4 (Paiement Mobile Money, Envoi de preuve et Suivi de réservation)** :

- **`/reservation/:ref/paiement` (`src/pages/PaymentPage.tsx`)** :
  - Récupère la réservation via `useReservation(ref)` (ou depuis `reservationStore.activeReservation`), affiche l'étape 2 du `CheckoutStepper`, la référence `RES-XXXXXX`, le montant total, l'anneau `HoldCountdown variant="ring"`, les codes marchands Orange Money / MTN MoMo issus de `/settings/public`, et le bouton vers `/reservation/:ref/preuve`.
  - Gère déjà la protection d'authentification et l'état « Réservation introuvable » si la référence est inconnue.
- **`/reservation/:ref/preuve` (`src/pages/ProofPage.tsx`)** et **`/reservation/:ref/merci` (`src/pages/SuccessPage.tsx`)** :
  - Routes déclarées et chargées à la demande dans `src/app/router.tsx`, prêtes pour le téléversement de capture d'écran (`endpoints.reservations.uploadProof(ref)`) et l'écran de confirmation finale.
- **`/reservations` (`src/pages/ReservationsPage.tsx`)** et **`/reservations/:ref` (`src/pages/ReservationDetailPage.tsx`)** :
  - `usePendingReservations()` et `useReservation(ref)` sont branchés sur TanStack Query (`qk.pendingReservations()`, `qk.reservation(ref)`), et le bandeau global `PendingReservationBanner` affiche en temps réel la réservation en attente de paiement dans toute l'application.
- **`/profil` (`src/pages/ProfilePage.tsx`)** :
  - Intègre l'état connecté/déconnecté, l'édition du profil (`useUpdateProfile`), la gestion des adresses (`useAddresses`, `useSaveAddress`) et la déconnexion propre (`useLogout`) qui vide la session et les réservations en cache tout en conservant le panier.
