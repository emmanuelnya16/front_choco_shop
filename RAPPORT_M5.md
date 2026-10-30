# RAPPORT DE LIVRAISON — MODULE M5 « SUIVI, PHOTO DU COLIS ET PROFIL »

**Projet :** DR Choco L’Incompris (PWA mobile-first de réservation, Cameroun)
**Module :** M5 — Mes réservations, détail et frise de suivi, photo du colis prêt, profil et adresses, repères de nouveauté, simulateur boutique enrichi
**Branche :** `feat/m5-suivi-profil` (8 commits au-dessus de l’état M4 `e7bd52f`)
**Statut :** terminé. `lint` (0 erreur, 0 avertissement), `typecheck`, `test` (103/103 dont 54 pour M5) et `build` verts. Lighthouse mobile au-dessus des objectifs.

> Point de départ : le dossier de travail ne contenait que M0. Le code M1 à M4 a été récupéré depuis l’archive `dr-choco-l'incompris (1).zip`, committé tel quel (`e7bd52f`), puis M5 a été construit dessus.

---

## 1. Ce qui est livré

### 1.1 Mes réservations (`/reservations`)
- Onglets « En cours (8) » / « Terminées (11) » avec indicateur qui glisse (`layoutId`), contenu qui glisse de 24 px dans le sens de l’onglet. L’onglet est dans l’URL (`?onglet=terminees`) et remplace l’entrée d’historique.
- Carte : référence, date et nombre d’articles, 3 miniatures (ou la photo du colis), total, barre d’avancement (verte pour livrée/retirée, rouge au point atteint pour expirée/annulée), badge de statut, point « Nouveau », action contextuelle selon le statut (Payer + compte à rebours, Renvoyer ma preuve, Voir mon colis, Réserver à nouveau, texte). Appui à 0,98, transition de vue sur la référence (nom posé sur la seule carte touchée).
- Chargement progressif (10 par page) à 600 px de la fin, squelettes au gabarit des cartes, bouton de secours sans `IntersectionObserver`, dédoublonnage si une réservation change de page entre deux chargements.
- Tirer pour actualiser sur écran tactile (indicateur `y` + `rotate`, seuil 72 px, vibration, `overscroll-behavior-y: contain`) ; bouton « Actualiser » sur ordinateur.
- États : invité (« Me connecter »), vide, erreur avec données conservées, hors connexion (bandeau).
- Ordinateur : liste centrée (840 px), grille de 2 colonnes au-delà de 1280 px.

### 1.2 Détail d’une réservation (`/reservations/:ref`)
- En-tête : retour, référence (appui = copie), date, badge animé lors d’un changement en direct.
- **Bloc d’action pour les 12 statuts** : paiement attendu (anneau `HoldCountdown` lisible sur fond encre), paiement non validé (motif, temps restant), vérification (sablier lent), confirmée / en préparation, colis parti (agence, horaires, téléphone `tel:`) ou prêt pour la livraison locale, prêt pour retrait (adresse, horaires, Google Maps, **code de retrait** en très grand), en route, livrée / retirée le…, expirée, annulée (par qui, quand, motif). Fondu croisé quand le statut change.
- **Frise GSAP** (chargée seulement avec le détail) : la ligne se remplit étape par étape (`scaleY`, 0,15 s, `power2.inOut`), les pastilles rebondissent (0,6 → 1), l’étape en cours s’allume (halo). Rejet intercalé en rouge puis « Nouvelle preuve envoyée », arrêt sur « Expirée » / « Annulée ». Première ouverture : tout se remplit ; ensuite seule la portion nouvelle (d’après `seenStore`). Liste ordonnée lisible : « Étape 3 sur 6, Confirmée, le 30 octobre à 14 h 05, en cours », `aria-current="step"`.
- Articles (liens vers les fiches), réception (domicile, agence ou boutique, destinataire, remarques), paiement (opérateur, montants, capture envoyée en visionneuse), aide (WhatsApp prérempli « … sur ma réservation RES-… »).
- **Annulation** : lien discret, feuille avec texte selon le statut, motif facultatif en chips, bouton `danger`, gestion du refus 422 (message + WhatsApp, réservation rechargée). Le front suit toujours `cancellable`.
- « Réserver à nouveau » : vérifie le stock (`/cart/validate`), ajoute les articles disponibles, message « 2 articles ajoutés · 1 n’est plus disponible », ouvre le panier.
- États : chargement avec données partielles issues de la liste, introuvable (y compris réservation d’un autre client), non connecté (feuille de connexion par-dessus).
- Ordinateur : 2 colonnes (60 % action + photo + frise, 40 % collant).

### 1.3 Photo du colis prêt
- Bloc « Votre colis est prêt » (« Emballé le 1ᵉʳ nov. à 16 h 20 ») sous le bloc d’action : grande photo au format d’origine (4:5 au maximum), miniatures, rappel « Vérifiez votre colis à la réception… ».
- **Dévoilement la première fois seulement**, déclenché quand le bloc entre à l’écran (sur mobile il est souvent sous le bloc d’action) : fondu, masque `clipPath` de bas en haut avec échelle 1,08 → 1, badge « Colis prêt » avec rebond, cascade, vibration, puis mémorisation dans `seenStore`. Animations réduites : affichage direct.
- Visionneuse de M2 (glisser, double appui pour zoomer, glisser vers le bas) avec **« Enregistrer la photo »** : partage natif d’un fichier sur mobile si `navigator.canShare({ files })`, sinon téléchargement.
- Miniature sur l’étape « Remise à l’agence » / « Prête pour retrait » de la frise, miniature sur la carte, message « Votre colis RES-… est prêt · Voir » à l’ouverture de l’app (une fois par colis), lien « Voir mon colis » qui défile jusqu’au bloc.
- Liens signés : au premier échec de chargement, la réservation est rechargée une seule fois ; ensuite « Photo indisponible · Réessayer ».

### 1.4 Profil (`/profil`, `/profil/adresses`, `/profil/informations`)
- Connecté : en-tête encre (initiale, nom, téléphone, Modifier), raccourcis « Mes réservations » (nombre en cours + point rouge) et « Mes favoris », réglages en lignes de 56 px (Mon compte, Application, Aide, Légal), déconnexion qui conserve le panier, version. Invité : écran sobre et liens publics. Ordinateur : colonne de navigation à gauche.
- Adresses : cartes, menu Modifier / Définir par défaut / Supprimer, étiquette « Par défaut » qui **glisse** vers la nouvelle carte, suppression avec « Annuler » pendant 5 s (validée si l’on quitte la page), état vide.
- Feuille d’adresse : **mêmes champs et règles qu’à la réservation** — le bloc de champs de `CheckoutPage` a été extrait dans `DeliveryAddressFields` (utilisé par les deux écrans) et les règles dans `addDeliveryAddressIssues` (partagées par les deux schémas zod).
- Mes informations : prénom, nom, ville (sélecteur M3), téléphone en lecture seule ; l’en-tête se met à jour.
- Notifications : explication, état (Activées, Désactivées, Bloquées dans le navigateur…), « Activer » (`pushService.requestPermission()`), aide Chrome Android, cas de l’iPhone sans installation.

### 1.5 Mises à jour en direct et repères
- Liste, résumé et détail rechargés toutes les 30 s quand la page est visible, et dès le retour sur l’app.
- Changement de statut pendant que le détail est ouvert : badge (sortie / entrée + pulsation), bloc d’action en fondu croisé, portion nouvelle de la frise, message « Nouvelle étape : … », vibration, annonce vocale. Pas de message en double pour une annulation faite par le client.
- Point rouge de 8 px (ressort `bounce`) sur l’onglet Réservations et sur « Mes réservations » de l’en-tête ordinateur : action attendue non vue ou changement non vu ; disparaît quand le client ouvre la réservation.

### 1.6 Simulateur boutique (`/_dev`)
Étape suivante, colis prêt + 1/2/3 photos, livrée / retirée, rejet avec motif, annulation boutique, remise à zéro. Chaque action date une entrée du journal et met à jour `updatedAt`. Les mocks sont **synchronisés entre onglets** (`BroadcastChannel`) : simulateur dans un onglet, suivi dans un autre.

### 1.7 Captures (`docs/captures/m5/`)

| Écran | 390 px | 1440 px |
| --- | --- | --- |
| Liste « En cours » | `p3-liste-en-cours-390.png` | `p3-liste-en-cours-1440.png` |
| Liste « Terminées », invité | `p3-liste-terminees-390.png`, `p3-invite-390.png` | — |
| Détail `reserved` | `p4-detail-reserved-390.png` | — |
| Frise avec rejet puis nouvelle preuve | `p4-detail-frise-rejet-390.png` | — |
| Détail `ready_for_pickup` (code de retrait) | `p4-detail-pret-retrait-390.png` | — |
| Détail `in_delivery` (agence Yaoundé) | `p4-detail-en-route-390.png` | `p4-detail-en-route-1440.png` |
| Détail annulé, introuvable | `p4-detail-annulee-390.png`, `p4-detail-introuvable-390.png` | — |
| Photo du colis (dévoilement en cours, terminé) | `p5-devoilement-en-cours-390.png`, `p5-photo-colis-devoilee-390.png` | `p5-photos-colis-1440.png` |
| Visionneuse, message à l’ouverture | `p5-visionneuse-390.png`, `p5-toast-ouverture-390.png` | — |
| Profil connecté / invité | `p6-profil-390.png`, `p6-profil-invite-390.png` | `p6-profil-1440.png` |
| Adresses, ajout, informations, notifications | `p6-adresses-390.png`, `p6-adresse-ajout-390.png`, `p6-informations-390.png`, `p6-notifications-390.png` | — |
| Changement de statut en direct | `p7-direct-changement-statut-390.png` | — |
| Animations réduites | `p8-animations-reduites-390.png` | — |

Les captures ont été produites avec Chrome sans fenêtre piloté par le protocole DevTools (aucune dépendance ajoutée au projet). Vérification complémentaire à 360 px : aucune barre de défilement horizontale sur la liste et le détail.

---

## 2. Vidéo du dévoilement et de la frise

Pas de vidéo ni de GIF : l’environnement ne permet pas l’enregistrement d’écran. Le dévoilement est illustré par une capture prise en cours d’animation (`p5-devoilement-en-cours-390.png`) et vérifié par les tests (dévoilement une seule fois, mémorisation, affichage direct en animations réduites).

---

## 3. Lighthouse et poids du JavaScript

### 3.1 Lighthouse mobile (Lighthouse 12.8.2, 4G simulée, build de production, client connecté)

| Page | Performance | Accessibilité | Bonnes pratiques | LCP | CLS | TBT |
| --- | --- | --- | --- | --- | --- | --- |
| `/reservations` | **99** | **100** | **100** | 1,9 s | 0,02 | 30 ms |
| `/reservations/RES-000108` (3 photos) | **96** | **100** | **100** | 2,3 s | 0 | 90 ms |
| `/profil` | **98** | **100** | **100** | 2,1 s | 0 | 50 ms |

Objectifs : Performance ≥ 85, Accessibilité ≥ 95, Bonnes pratiques ≥ 95 — atteints. Mesures faites **avec les mocks MSW actifs** (le worker démarre avant l’affichage) : la production réelle sera au moins aussi rapide. Deux défauts relevés par Lighthouse ont été corrigés : ordre des titres sur la liste, vibration demandée avant tout geste (erreur console). Le profil affichait un squelette remplacé par un contenu de hauteur différente (CLS 0,194) : il s’affiche désormais directement.

### 3.2 Poids des morceaux (`vite build`)

| Morceau | Brut | gzip | Chargement |
| --- | ---: | ---: | --- |
| `index` (socle initial) | 326,2 kB | **100,4 kB** | Initial (M4 : 98,4 kB) — plafond 180 kB |
| `ReservationsPage` | 16,0 kB | 5,6 kB | Route `/reservations` |
| `ReservationDetailPage` | 36,5 kB | 10,7 kB | Route du détail |
| `gsap` | 132,5 kB | 52,2 kB | Avec le détail uniquement (jamais au démarrage) |
| `ProfilePage` | 12,8 kB | 4,6 kB | Route `/profil` |
| `ProfileAddressesPage` | 11,1 kB | 4,1 kB | Route `/profil/adresses` |
| `ProfileInformationsPage` | 4,6 kB | 1,9 kB | Route `/profil/informations` |
| `CheckoutPage` | 29,3 kB | 8,7 kB | Route `/reservation` (champs d’adresse désormais partagés) |
| `browser` (mocks MSW) | 439,7 kB | 164,9 kB | Seulement si `VITE_API_MOCK=true` |

+1,9 kB gzip au démarrage pour M5 : `seenStore`, résumé des réservations, point rouge et message « colis prêt », nécessaires sur toutes les pages.

---

## 4. Pour le client

1. **Annulation et remboursement** (cahier des charges, point 3) — règle actuelle, à confirmer :
   - réservée ou paiement rejeté : annulation immédiate, articles remis en vente ;
   - paiement envoyé ou confirmée : annulation possible avant la préparation, avec le texte « Vous avez déjà payé : la boutique vous contactera pour le remboursement selon la politique d’annulation. » ;
   - à partir de la préparation : plus d’annulation dans l’app, contact WhatsApp.
   La page « Politique d’annulation et de retour » (`/pages/politique-retour`) reste à rédiger.
2. **« Réserver à nouveau »** : fonctionnalité de fidélisation ajoutée sur les réservations terminées. À valider ; elle se retire facilement.
3. **Photos du colis** : l’app accepte 1 à 3 photos (le simulateur en propose 1, 2 ou 3). Nous recommandons **3 au maximum** (vue d’ensemble, étiquette, détail du scellé).
4. **Repère rouge** : il signale une réservation qui demande une action (payer, renvoyer une preuve, venir retirer le colis) ou un changement pas encore vu. À valider.
5. **Installation de l’app** : la ligne « Installer l’application » du profil affiche « Bientôt disponible » ; l’installation réelle arrive avec le module M6.

---

## 5. Pour l’équipe back-end (Symfony)

Tous les points ci-dessous sont des `// HYPOTHÈSE:` dans le code, à valider.

1. **`GET /reservations?scope=active|done&page=N`** (10 par page) → `{ items, page, pageSize, total, totalPages, counts: { active, done } }`, triés par `updatedAt` décroissant. Élément : `ref, status, createdAt, updatedAt, expiresAt?` (seulement en attente de paiement), `serverTime, amount.total, itemsCount, itemsPreview[≤3] { image, name }, packagePhotoThumb?, receptionMode, city, reachedStatus?` (dernier statut du parcours atteint avant expiration ou annulation, pour la barre rouge). `counts` est un ajout au contrat initial. `GET /reservations?status=reserved` (M3/M4) reste inchangé.
2. **`GET /reservations/summary`** → `{ needsAction, lastUpdatedAt, items: [{ ref, status, updatedAt, hasPackagePhotos }] }` pour les réservations en cours. `items` est un ajout : il permet de calculer le repère sans charger chaque détail. `needsAction` compte `reserved`, `payment_rejected`, `ready_for_pickup`.
3. **`GET /reservations/:ref`** : en plus de M4, `updatedAt`, `cancellable` (calculé par le serveur), `cancelDeadline`, `agency { name, address, city, phone, openingHours }`, `packagePhotos`, `packageReadyAt`, et **`timeline` = journal daté** `[{ status, at, note?, actor? }]` (une entrée par changement de statut, du plus ancien au plus récent ; un rejet suivi d’une nouvelle preuve donne deux entrées). `actor` (`client` | `shop` | `system`) est un ajout pour afficher « Annulée par vous / par la boutique ». **404** aussi si la réservation appartient à un autre client.
4. **`POST /reservations/:ref/cancel`** `{ reason? }` → réservation mise à jour (forme M4 `{ status, reservation }`) ; **422 `CANCEL_NOT_ALLOWED`** si l’annulation n’est plus possible.
5. **Adresses** : `PATCH /me/addresses/:id` (champs partiels ; `isDefault: true` retire le défaut des autres ; **`agencyId: null` efface l’agence**), `DELETE /me/addresses/:id` (204 ; si l’adresse par défaut est supprimée, la première restante devient l’adresse par défaut).
6. **Photos du colis** : URL **signées et temporaires** (dossier privé par réservation), miniatures signées aussi. Validité conseillée : **1 h**. Au premier échec de chargement, le front recharge la réservation une seule fois pour obtenir des liens neufs.
7. **Articles** : ajouter `colorCode` et `colorHex` aux lignes de réservation, pour remettre l’article au panier avec la bonne couleur (« Réserver à nouveau »).
8. **Horloge** : continuer à renvoyer `serverTime` dans les réponses de réservation (comptes à rebours).

---

## 6. Pour l’espace d’administration (`/admin`, plus tard)

Pour alimenter ces écrans, la boutique doit pouvoir :
- faire avancer une réservation d’un statut à l’autre selon le parcours (livraison locale, agence, retrait), chaque changement étant daté et attribué à la boutique ;
- **joindre 1 à 3 photos du colis** (compressées, stockées en privé) au passage à « Remise à l’agence » ou « Prête pour retrait », avec la date d’emballage ;
- **rejeter un paiement avec un motif** (affiché tel quel au client) ;
- annuler côté boutique avec une note, marquer livrée ou retirée ;
- voir le motif choisi par le client lors d’une annulation ;
- renseigner les agences (adresse, horaires, téléphone) affichées au client.

Le simulateur de `/_dev` reproduit ces actions et peut servir de référence.

---

## 7. Hypothèses et écarts par rapport au prompt

### 7.1 Hypothèses (`// HYPOTHÈSE:` dans le code)
Contrat de la liste paginée et `counts` ; `items` du résumé ; champ `actor` du journal ; `reachedStatus` ; règle d’annulation jusqu’à la confirmation incluse ; statuts « action attendue » ; rechargement toutes les 30 s en attendant les notifications push ; `colorCode` / `colorHex` des articles ; adresse par défaut promue à la suppression ; une balise `<img>` ne donnant pas le code HTTP, tout échec de photo est traité comme un lien expiré ; « Réserver à nouveau » à valider ; installation réelle au module M6.

### 7.2 Écarts
1. **Frise** : le type M0 (`{ timestamp, completed, current }`) est remplacé par le journal daté demandé par le contrat M5 ; les étapes à venir sont calculées côté client depuis `TIMELINE_ORDER`.
2. **Données de démonstration** : 12 réservations pour Junior (8 en cours, 4 terminées) au lieu de 11, car une réservation livrée est forcément « terminée » ; + 7 archives pour que l’onglet « Terminées » ait réellement 2 pages ; + 1 réservation d’un autre client pour tester « introuvable ». Dates relatives au moment du chargement.
3. **Contrastes** : le badge « danger » (paiement rejeté, expirée, annulée) garde un texte encre sur fond blanc avec bordure et icône rouges, car le blanc sur rouge (4,0:1) est insuffisant pour du texte de 12 px. Même raison pour « Se déconnecter » : icône rouge, texte encre.
4. **Titres** : pour une réservation prête, le bloc d’action et le bloc photo s’intitulent tous deux « Votre colis est prêt » ; le second porte une précision réservée aux lecteurs d’écran (« : photos du colis »).
5. **Animation `clipPath`** du dévoilement : exception explicitement demandée par le prompt à la règle « transform et opacity ».
6. **Message à l’ouverture** : plusieurs colis prêts sont regroupés en un seul message (« 3 colis sont prêts… ») au lieu d’un message par colis.
7. **Carte « remise à l’agence / prête » sans photo** (possible avec le simulateur) : texte « Votre colis est prêt » au lieu de « Voir mon colis ».
8. **Profil sur ordinateur** : une entrée « Mon espace » s’ajoute en tête de la colonne de navigation.
9. **Écrans M4** : leur rechargement en direct reste à 20 s ; le détail et la liste M5 passent à 30 s.
10. **Hors connexion** : le cache est en mémoire (consultable pendant la session) ; la persistance après redémarrage relève de M6 (voir §8).

### 7.3 Modifications apportées aux modules précédents
- **M0** : scripts `build` / `analyze` compatibles Windows ; `haptic()` ne vibre plus avant un geste de l’utilisateur ; version 0.5.0.
- **M1/M2** : `Button` gagne la variante `danger` ; la visionneuse accepte un libellé, un format par photo et des actions ; `uiStore` gagne la référence de transition des réservations.
- **M3** : correctif de la barre basse (elle disparaissait sur `/reservations` et l’onglet Panier y était actif) ; extraction de `DeliveryAddressFields` et `addDeliveryAddressIssues` (comportement inchangé, tests M3 verts) ; `HoldCountdown` gagne `surface="dark"`.
- **M4** : le calque d’expiration utilise la fonction commune de remise au panier (couleur en dur retirée) ; la miniature de preuve fictive est une capture de paiement (`preuve-1.svg`) au lieu d’une photo de colis.
- **Mocks** : session conservée dans l’onglet (les pages paiement / preuve restent accessibles après un rechargement malgré le contrôle du propriétaire), synchronisation entre onglets.
- **Outillage** : dépôt git initialisé, `.gitattributes` (fins de ligne LF), délai d’attente des tests asynchrones porté à 4 s (un test M2 échouait parfois au premier lancement), `esbuild ^0.28` (requis par Vite 8.3.5).

### 7.4 Revue de code
Une revue indépendante (deux angles : correction du code M5, régressions sur M0–M4), avec contre-vérification de chaque problème, a signalé 13 problèmes, tous confirmés et corrigés dans `93c14cc`. Les plus notables : « Annuler » inopérant après avoir quitté la page des adresses, agence non effacée sur une adresse devenue locale, double message à l’annulation, compte à rebours annoncé chaque seconde par les lecteurs d’écran, pages M4 « introuvables » après rechargement dans les mocks.

### 7.5 Recette (§9.1)

| Parcours | Vérification | Résultat |
| --- | --- | --- |
| 1. Onglet Réservations, cartes, pagination | Captures + tests | OK (point rouge, 8 en cours, 11 terminées sur 2 pages) |
| 2. Payer / Renvoyer ma preuve | Tests | OK |
| 3. Photo de `RES-000102` : dévoilement, visionneuse, réouverture | Captures + tests | OK (l’enregistrement n’a pas été déclenché en mode sans fenêtre) |
| 4. « Étape suivante » pendant que le détail est ouvert | Deux onglets Chrome | OK : 2 s au retour sur l’onglet, 28 s si l’onglet reste visible |
| 5. « Colis prêt + photos » | Tests (miniature, repère, message) | OK |
| 6. Annulations `reserved`, `confirmed`, `preparing` | Tests | OK |
| 7. « Réserver à nouveau » avec un article épuisé | Tests | OK (2 ajoutés, 1 indisponible) |
| 8. Tirer pour actualiser | — | **À vérifier sur un vrai téléphone** |
| 9. Profil, adresses, notifications, déconnexion | Tests + captures | OK |
| 10. Mode avion | — | **À vérifier** (cache de session uniquement) |
| 11. Animations réduites | Capture | OK (affichage direct) |

**Aucun test n’a été fait sur un vrai Android** (pas d’appareil disponible dans cet environnement). C’est le principal point restant avant de considérer la recette complète.

---

## 8. Points d’attention pour le module M6 (PWA, notifications push, hors connexion)

1. **Ne jamais mettre en cache** les photos du colis ni les captures de paiement (URL signées, dossier privé) : règles Workbox en `NetworkOnly` pour ces images et pour les réponses qui les contiennent ; ne rien écrire dans `localStorage` (le `seenStore` ne contient que des références et des statuts).
2. **Hors connexion après redémarrage** : si on persiste la liste et le détail, retirer d’abord `packagePhotoThumb`, `packagePhotos` et `proof` des données stockées.
3. **Notifications push** : à la réception, invalider `qk.reservation(ref)` et `qk.reservations()` (le résumé et le point rouge suivront) ; lien profond vers `/reservations/:ref` (`#colis` pour « colis prêt »). `pushService.subscribe()` est encore vide ; la feuille Notifications appelle déjà `requestPermission()`. Le rechargement toutes les 30 s pourra être espacé une fois le push en place.
4. **Installation** : brancher `beforeinstallprompt` sur la ligne « Installer l’application » du profil (déjà masquée quand l’app est installée).
5. **Pastille de l’icône** : `navigator.setAppBadge()` peut reprendre la logique de `useReservationsAttention`.
6. La synchronisation `BroadcastChannel` et la session conservée ne concernent que les mocks ; rien à reprendre en production.
