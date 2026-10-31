# RAPPORT DE LIVRAISON — MODULE M6 « PWA, HORS CONNEXION ET NOTIFICATIONS »

> Branche `feat/m6-pwa` (partie de `feat/m5-suivi-profil`), version 0.6.0.
> Commits par phase : P2 `ffbe664`, P4 `17840cc`, P3 `5337b28`, P6 `744dd80`, P7 `cc5c4a0`, P5 `619f3c3`, P8 `e41d345`, budget de démarrage `b120c16`, corrections responsive : voir §8.
> Rien n'a été poussé ni fusionné dans `main`.

**Résumé.**
- **Installation** : la PWA est installable. Chrome ne signale aucune erreur d'installabilité ni de manifeste.
- **Hors connexion** : elle reste utilisable sans réseau (catalogue déjà vu, panier, favoris, réservations), et l'écran de paiement reste lisible avec « Composer le code » actif.
- **Notifications** : elles sont réelles côté front (vrai abonnement Chrome, réception, clic, pastille).
- **Mode application** : retour arrière, zones de sécurité, écran de lancement, mises à jour sans perte.
- **Non fait** : la recette sur de vrais appareils Android et iPhone (§9.1 et §9.2), faute d'appareils. Tout a été vérifié dans Chrome piloté (CDP), avec mode avion, push et zones de sécurité simulés.

---

## 1. Ce qui est livré

### 1.1 Coexistence avec les mocks (P2)
- **Développement avec mocks** (`npm run dev`) : MSW tourne dans le navigateur et le service worker de l'app est désactivé. S'il en reste un d'une session précédente, il est désinscrit au démarrage, avec un message en console.
- **Test de la PWA** :
  - `npm run mock:api` lance `server/mock-api.ts`, qui sert les **mêmes gestionnaires MSW** sous Node sur le port 8787 : CORS avec credentials, fichiers `/mock`, simulateur `/_mock/...`, remise à zéro complète `POST /api/_mock/reset`.
  - `npm run preview:pwa` construit en mode `pwa` (`.env.pwa`) et prévisualise sur `http://127.0.0.1:4173`.
- `VITE_PWA_ENABLED` est validée dans `src/lib/env.ts` : vraie en production, fausse en développement. Le README contient une section « Tester la PWA ».

### 1.2 Manifeste, icônes, écrans de démarrage (P3)
- **Manifeste** (`pwa-manifest.ts`) : toutes les clés du §4.1, dont 3 captures étroites, 1 large, et les 3 raccourcis Explorer, Mes réservations et Mon panier.
- **Icônes** : générées par `npm run icons` (`pwa-assets.config.ts` puis `scripts/generate-extra-icons.mjs`) :
  - 192, 512 et apple-touch 180 : logo blanc sur `#1A1A18` ;
  - 512 masquable : 20 % de marge ;
  - 64 px et `favicon.ico` : monogramme ;
  - pastille des notifications 96 px : silhouette blanche sur fond transparent ;
  - 3 icônes de raccourci ;
  - 26 écrans de démarrage iPhone.
- **index.html** : toutes les balises du §4.3. Le lien du manifeste est injecté au build.
- **Captures du manifeste** : `npm run screenshots` les génère avec Chrome piloté (CDP).

### 1.3 Service worker et mises à jour (P4, P8)
- `src/sw.ts` (injectManifest). Les règles sont des fonctions pures dans `src/pwa/cacheRules.ts`, testées :

| Ressource | Stratégie | Cache |
| --- | --- | --- |
| Coquille (JS, CSS, police latine, index.html, icônes utiles hors connexion) | Précache | `precache` |
| Pages | NetworkFirst 3 s, repli sur index.html | `pages` |
| Catalogue (`/categories`, `/products*`, `/looks*`, `/search/suggest*`, `/settings/public`, `/delivery/*`) | StaleWhileRevalidate, 300 entrées, 7 j | `api-catalog` |
| Données du client (`/me`, `/me/addresses`, `/reservations*`, `/favorites`) | NetworkFirst 4 s, 60 entrées, 2 j, **vidé à la déconnexion** | `api-user` |
| Images publiques (`/images/*`, `/mock/*`, Cloudinary `image/upload`) | CacheFirst, 200 entrées, 30 j, réponses 200 seulement | `images` |
| Polices latin étendu et vietnamien | CacheFirst | `fonts` |

- **Jamais mis en cache** :
  - les requêtes non GET ;
  - `/auth/*`, `/push/*`, `/cart/validate` et `/_mock/*` ;
  - les preuves et photos de colis (`/private/`, `/authenticated/`, signature Cloudinary `s--…--`, paramètres de signature, `/reservations/:ref/proof`) ;
  - `/admin` et `/api/admin` ;
  - les réponses `no-store`.
- **Morceaux exclus du précache** : `mocks-*`, `dev-*` et `admin-*` (nommés au build). En production, le code des mocks est complètement éliminé.
- **Messages** : SKIP_WAITING, CLEAR_USER_DATA, GET_VERSION, PUSH_RECEIVED et NAVIGATE.
- **Recherche de mise à jour** : au démarrage, au retour sur l'app et toutes les 60 min.
- **Bandeau « Une nouvelle version est disponible »** :
  - jamais sur la réservation, le paiement ou la preuve, ni pendant un envoi ;
  - rechargement une seule fois quand la nouvelle version prend la main, puis toast « Application mise à jour ».

### 1.4 Installation (P5)
- **Service** (`src/pwa/installEarly.ts` puis `installService.ts`) : `beforeinstallprompt` est capté avant le rendu. État réactif : installée, disponible, iPhone ou non prise en charge. À l'installation : toast et `storage.persist()`.
- **Invitations** :
  - jamais au premier chargement ;
  - feuille automatique une seule fois à la 2e visite (au moins 1 jour après la première), 8 s après l'arrivée sur l'accueil ;
  - 14 jours de silence après « Plus tard » ;
  - tout est masqué une fois installée.
- **Endroits** : bloc de l'accueil, ligne du profil, écran Merci après la première preuve (en plus des notifications, ou à leur place sur iPhone sans l'app), feuille de 2e visite.
- **Feuilles** :
  - Android et ordinateur : icône à rebond, 3 avantages en cascade, aperçu de 2 captures ;
  - iPhone : 3 étapes illustrées, icône Partager en SVG, flèche animée, mention des notifications dès iOS 16.4.
- **Mesure** : `track()` est prête, avec trace en console en développement.

### 1.5 Hors connexion (P6)
- **État réseau** : un store unique (`src/pwa/networkStore.ts`). Il passe hors connexion après 2 échecs réseau et revient au premier succès. Il est relié à TanStack Query et remplace les détections dispersées de M2 à M5.
- **Bandeau** « Hors connexion · contenu de votre dernière visite » avec « Réessayer », puis « Connexion rétablie », puis les données affichées sont relues.
- **Page `/hors-ligne`** : nuage barré, Réessayer, Voir mon panier, articles consultés disponibles hors connexion. Le même contenu sert de repli sur toute page jamais enregistrée.
- **Paiement sans réseau** :
  - les données déjà chargées passent avant l'erreur ;
  - les paramètres de paiement sont gardés sur le téléphone ;
  - « Composer le code » reste actif ;
  - l'envoi de la preuve est bloqué ; la capture est gardée en mémoire seulement (jamais sur le disque) et l'envoi reprend au retour du réseau.
- **Réservations** : « Mis à jour le … » ; photos de colis remplacées par un message propre.
- **Déconnexion évitée** : une coupure réseau ne déconnecte plus le client (corrigé en premier, commit `595c127`).

### 1.6 Notifications push (P7)
- **Abonnement et désabonnement réels** : un seul POST même en appels simultanés, et `oldEndpoint` si l'abonnement a changé.
- **États affichés au profil** : abonné, accordé, à demander, refusé, non disponible, à installer (iPhone). « Désactiver » est proposé.
- **Déconnexion** : désabonnement, pastille effacée et `CLEAR_USER_DATA`. Le panier est conservé.
- **App ouverte** : relecture immédiate des données et toast riche (miniature du colis prêt, « Voir »). Au clic sur une notification, la bonne page s'ouvre (NAVIGATE).
- **Interrogation** : 2 min au lieu de 20 et 30 s quand les notifications fonctionnent.
- **Pastille de l'icône** : `setAppBadge(réservations à traiter)`.
- **`/_dev`** :
  - section « Application installable » : mode, service worker, version, caches, espace occupé et quota, persistance ;
  - section « Notifications » : 5 notifications locales de test et copie de l'abonnement JSON ;
  - le simulateur boutique déclenche la notification correspondante.

### 1.7 Mode application (P8)
- **Flèche retour** sur toutes les pages de niveau 2, avec une seule logique : écran précédent, sinon le parent.
- **Touche retour d'Android** : chaque feuille, la visionneuse, le panier latéral et le méga-menu ajoutent une entrée d'historique. La touche retour les ferme d'abord, sans navigation parasite.
- **Zones de sécurité** : `calc(X + env(safe-area-inset-*))`, partout où `pt-safe` et `pb-safe` écrasaient les marges.
- **Gestes et sélection** : pas de rechargement par glissement dans l'app installée. La coquille n'est pas sélectionnable ; références et codes USSD le restent.
- **Écran de lancement** de 0,85 s : app installée seulement, jamais en mode réduit.
- **Liens externes** : `tel:` et `mailto:` en simple lien, http(s) en nouvel onglet.
- **Retour sur l'app après plus d'une heure** : les données affichées sont relues.

### 1.8 Captures (`docs/captures/m6/`)

| Fichier | Contenu |
| --- | --- |
| `01-icones-planche.png` | Icônes 192, masquable découpée, apple, 64, favicon, pastille, raccourcis, écran de démarrage |
| `02` à `05` | Feuilles d'installation : Android 390, ordinateur 1280, iPhone 390, iPad 1280 |
| `06`, `07` | Écran Merci : carte d'installation (Android, iPhone) |
| `08` | Toast « DR Choco est installé » |
| `09` | Écran de lancement |
| `10` à `17` | Hors connexion : accueil, fiche, réservations, détail (photo indisponible), paiement (USSD actif), preuve, `/hors-ligne`, « Connexion rétablie » |
| `18` | Push reçu app ouverte : toasts riches |
| `19` | Profil : notifications activées |
| `20`, `21` | `/_dev` : application installable, notifications |
| `22` à `24` | Bandeau de mise à jour, après la mise à jour, absence du bandeau sur le paiement |
| `25`, `26` | Flèche retour, feuille fermée par la touche retour |

**Pas de captures sur appareil réel** (icône sur l'écran d'accueil, raccourcis par appui long, notification système Android avec photo) : aucun téléphone n'était disponible pour la recette, voir §2.

---

## 2. Recette sur appareils (§9.1, §9.2)

**Non réalisée sur de vrais téléphones.** Ce qui a été vérifié dans Chrome piloté (CDP), sur la prévisualisation PWA avec le serveur de mocks Node :

| Parcours §9.1 | Vérifié | Comment |
| --- | --- | --- |
| 1. Installation | Partiel | Manifeste sans erreur, `getInstallabilityErrors` vide, 41 ressources en 200. Fenêtre native non testée (pas d'appareil). |
| 2. Lancement, écran de démarrage | Partiel | Écran de lancement mesuré à 0,89 s avec `navigator.standalone` simulé. Écrans de démarrage iPhone générés, non vus sur appareil. |
| 3. Raccourcis | Partiel | Présents dans le manifeste, icônes en 200. Appui long non testé. |
| 4. Réouverture en mode avion | Oui | Accueil, fiches déjà vues, panier, bandeau (CDP hors connexion, page et service worker). |
| 5. Paiement en mode avion | Oui | Référence, montant, `tel:%23000*1*000111*46500%23` actif, aussi après un rechargement à froid hors connexion. |
| 6. Colis prêt, app en arrière-plan | Oui (CDP) | `ServiceWorker.deliverPushMessage` : notification avec photo, données relues. Le vrai clic système ne se simule pas en CDP ; le message NAVIGATE est vérifié. |
| 7. Même action, app au premier plan | Oui | Pas de notification système, toast et écran mis à jour aussitôt. |
| 8. Pastille après un rejet | Partiel | `setAppBadge` appelé (tests et sonde). Rendu sur l'icône non visible sans appareil. |
| 9. Nouvelle version | Oui | Bandeau, « Mettre à jour », rechargement, toast, panier conservé. Absent sur le paiement. |
| 10. Déconnexion | Oui | Cache `api-user` supprimé, désabonnement envoyé. |
| 11. Touche retour d'Android | Oui (CDP) | Feuille fermée d'abord, adresse inchangée, puis retour à l'écran précédent. |

**iPhone (§9.2)** : la feuille d'explication et la détection d'iOS 16.4 sont vérifiées par les tests et en capture (agent utilisateur iPhone). L'installation réelle, les zones de sécurité sur un appareil à encoche et les notifications sur iOS restent à faire.

**À faire avant la mise en ligne**, sur une prévisualisation HTTPS (Vercel) :
- parcours 1 à 11 sur un Android récent (Chrome) ;
- parcours §9.2 sur un iPhone en iOS 16.4 ou plus ;
- noter les modèles et versions dans ce rapport.

---

## 3. Précache, caches et performance

Mesures faites sur le build `--mode pwa` servi par `vite preview`, avec l'API simulée sur le port 8787, piloté par Chrome sans fenêtre (CDP).

### 3.1 Précache

| Type | Taille (non compressée) |
| --- | --- |
| JavaScript | 1 327,2 Kio |
| CSS | 86,5 Kio |
| Police Archivo (latin) | 88,0 Kio |
| Images (logos, visuels de repli, QR de démonstration) | 47,2 Kio |
| index.html | 9,0 Kio |
| **Total** | **139 fichiers, 1 557,9 Kio (1 595 301 octets)** |

**Écart** : l'objectif était de 1,5 Mo (1 536 Kio), et le total le dépasse de 22 Kio (1,4 %). La police latine reste précachée, car le §4.5 la demande et elle évite un changement de police hors connexion. Deux options pour passer sous l'objectif :
- retirer la police du précache (−88 Kio) : elle est alors chargée dans le cache `fonts` à la première visite ;
- exclure les morceaux des pages rarement ouvertes hors connexion (guide des tailles, simulateur…).

Décision laissée à M7, qui reprend le budget global.

### 3.2 Contenu des caches après une visite connectée

Pages visitées : accueil, Explorer, fiche, mes réservations, détail, paiement, profil.

| Cache | Entrées |
| --- | --- |
| précache | 139 |
| `pages` | 6 |
| `api-catalog` | 9 |
| `api-user` | 6 |

Aucune entrée interdite (`/auth`, `/push`, `/_mock`, `/admin`, preuves, photos de colis, URL signées). Stockage utilisé : 3,4 Mo.

### 3.3 JavaScript de démarrage et visite répétée

- **JavaScript de démarrage** : 178,2 kB gzip (objectif < 180 kB). Le bilan est de 226 kB avant M6 et de 192,2 kB après l'ajout du PWA. Il est ramené à 178,2 kB par :
  - le chargement à la demande du pied de page, du menu ordinateur, de la recherche ordinateur, de la feuille des tailles et du pont des notifications ;
  - l'enregistrement du service worker chargé à la demande ;
  - le retrait du logo 64 px intégré en base64.
- **Visite répétée en 3G simulée** (Fast 3G de DevTools, 3 essais) : premier affichage à 300, 288 et 320 ms ; titre de la page présent à chaque fois.
- **Installabilité** : aucune erreur (`Page.getInstallabilityErrors` vide), manifeste sans erreur, service worker en contrôle de la page.

### 3.4 Hors connexion

- Avec les serveurs arrêtés, les pages déjà vues s'affichent depuis le cache, y compris le lien USSD de paiement.
- La vérification automatique du bandeau, avec un serveur injoignable et en mode avion, a bloqué dans Chrome sans fenêtre. Deux défauts ont été corrigés avant ce blocage, et le contrôle complet est repris par le parcours Playwright n° 8 de M7 :
  - le cache d'images acceptait la page HTML de repli ;
  - le bandeau ne s'affichait pas quand le serveur ne répond plus mais que le téléphone se croit en ligne.
- **Lighthouse mobile** : reporté à M7 (§7.1), qui fixe les budgets par page sur le build de production.

---

## 4. Pour l'équipe back-end (Symfony)

1. **Clés VAPID** : générer la paire (par exemple `vendor/bin/web-push generate-vapid-keys`) et fournir la clé publique, à placer dans `VITE_VAPID_PUBLIC_KEY`. Une clé de démonstration est utilisée en attendant, et sa clé privée n'a pas été conservée.
2. **Endpoints d'abonnement** :
   - `POST /api/push/subscribe` reçoit `{ subscription, platform: 'android' | 'ios' | 'web', userAgent, oldEndpoint? }` avec le jeton du client. Un client peut avoir plusieurs appareils, d'où un abonnement par point de terminaison. Avec `oldEndpoint`, l'ancien abonnement est remplacé.
   - Le service worker rappelle aussi cet endpoint sur `pushsubscriptionchange`. Il n'a pas le jeton d'accès : il s'identifie par le cookie de session et `oldEndpoint`.
   - `POST /api/push/unsubscribe { endpoint }` est appelé avec le jeton, avant `/auth/logout`.
3. **Envoi Web Push** (`minishlink/web-push`) à chaque changement de statut, au format `PushPayload` (`src/pwa/pushPayload.ts`) : `{ type, title, body, ref, url, image?, tag? }`.
   - Textes : ceux du §7.2.
   - `url` est toujours un chemin de l'app (`/reservations/RES-…`) ; une URL externe est ignorée par l'app.
   - `image` (colis prêt seulement) est une URL signée de courte durée.
4. **Abonnements expirés** : les supprimer quand le service de push répond 404 ou 410.
5. **En-têtes** : `Cache-Control: no-store` sur toutes les données privées. L'app les respecte : elles ne sont jamais enregistrées.
6. **URL privées** : confirmer le motif des preuves et photos de colis. L'app considère comme privés les chemins Cloudinary `/private/` et `/authenticated/`, une signature `s--…--`, et les paramètres `signature`, `sig`, `token`, `expires`, `X-Amz-Signature` et `__cld_token__`.
7. **`/auth/refresh`** : répondre 401 ou 403 seulement si la session est réellement refusée. Une erreur 5xx ou une coupure garde le client connecté côté app.
8. **Partage des fiches produit** : rendu côté serveur des balises de partage (rappel M2).
9. **Administration** : toutes les données sous `/api/admin`. L'app ne les met jamais en cache, ni les pages `/admin`.

---

## 5. Pour le client

- **Logo vectoriel blanc** : à fournir. Les icônes actuelles reprennent le logotype M1 vectorisé. Sur un écran d'accueil Android, environ 48 dp, « L'INCOMPRIS » devient très petit ; un monogramme serait plus lisible, et ce choix ne demande qu'une ligne de configuration.
- **Nom court** « DR Choco » sous l'icône : à valider.
- **Textes des notifications** (§7.2) : à valider, notamment l'heure limite affichée dans « paiement non validé ».
- **Captures de la fenêtre d'installation Android** : faites avec les données de démonstration, à refaire avec les vraies photos (`npm run screenshots`).

---

## 6. Hypothèses et écarts

### 6.1 Écarts par rapport au prompt
- **`@mswjs/http-middleware` non utilisé** : il appelle `msw.handleRequest`, qui n'existe plus dans MSW 3. Il est remplacé par un pont Express maison qui utilise `getResponse` de MSW 3 (Express était déjà installé).
- **Captures du manifeste** : Chrome installé piloté en CDP au lieu de Playwright, qui n'est pas une dépendance autorisée.
- **127.0.0.1 au lieu de `localhost`** dans `.env.pwa` : les mocks comparent l'origine exacte, et `localhost:3000` en IPv6 sert un autre projet sur le poste de développement.
- **Mode `pwa`** (`.env.pwa`) au lieu de variables passées sur la ligne de commande, qui ne fonctionnent pas sous Windows.
- **Icônes précachées** : seules les icônes utiles hors connexion (192 et pastille) sont précachées ; les autres sont lues par le navigateur à l'installation. Cache `fonts` ajouté pour les polices rarement utilisées.
- **Photo du colis dans la notification** (demandée au §7.2) : M4 et M5 interdisaient toute photo dans une notification. Le prompt M6 prévaut. La photo est chargée par le système depuis son URL signée, sans passer par nos caches.
- **Réponses JSON des réservations** dans `api-user` (prompt §4.5) : elles contiennent des URL signées, mais pas les images elles-mêmes, et le cache est vidé à la déconnexion.
- **Désabonnement à la déconnexion** : il part avant `/auth/logout`, pour que la session soit encore valide.
- **Bandeau de mise à jour** : bouton « Masquer jusqu'au prochain lancement » ; bandeau masqué sur mobile sur la fiche produit et le panier rempli (barre d'action collante).
- **Écran de lancement** : 0,65 s d'affichage et 0,2 s de fondu (moins d'1 s).
- **Fermer la feuille d'installation** (croix, fond) compte comme « Plus tard ».

### 6.2 Hypothèses (`// HYPOTHÈSE:` dans le code)
- Clé VAPID de démonstration ; motif des URL privées ; 401 et 403 sur `/auth/refresh` = session refusée.
- `VITE_PWA_ENABLED` vide = vraie en production.
- Hors connexion, le profil connu reste connecté.
- Une visite = un chargement au moins 30 min après le précédent ; 2e visite = au moins 1 jour après la première ; la première page Merci affichée = première preuve.
- « Connexion rétablie » visible 2,2 s ; 12 articles consultés gardés, 6 affichés.
- Paramètres de paiement (publics) gardés dans le stockage local.
- Capture de preuve perdue au rechargement (jamais sur le disque).
- Notifications « Non disponibles » en mode mocks du navigateur.
- Plateformes `ios`, `android` et `web` ; `/push/unsubscribe` avec la session.
- Parents logiques de la flèche retour (fiche → sa catégorie, paiement → suivi…).
- Écran de lancement de 0,65 s + 0,2 s.
- Captures du manifeste tirées de l'app.

### 6.3 Corrections apportées aux modules précédents
- **Rapport M5 corrigé** : le JavaScript de démarrage n'était pas de 100,4 kB gzip mais d'environ 226 kB. Le découpage M0 (`manualChunks`) mettait React dans le morceau GSAP, préchargé à l'ouverture. Après M6 : voir §3.
- **`cn()`** supprimait les tailles de texte du projet (`text-small`, `text-label`, `text-price`…) : badges, prix et pied de page étaient mal dimensionnés partout.
- **Accueil (M1)** :
  - six sections sans marges latérales ;
  - variables de marge absentes, donc carrousels sans décalage ;
  - première carte des carrousels coupée ;
  - bloc « L'art de la babouche » jamais affiché.
- **Session (M0, M3)** : une coupure réseau effaçait la session.
- **Mocks (M3)** : la connexion OTP n'était pas mémorisée.
- **Sécurité** : les invites AI Studio de `public/assets/aistudio/` étaient publiées en production ; elles sont déplacées dans `docs/aistudio/`.
- **Écran Merci (M4)** : double abonnement aux notifications, et erreur d'abonnement avalée.
- **Feuille de connexion (M3, M4)** : elle s'ouvrait au rechargement de la réservation et du paiement alors que le client était connecté.

---

## 7. Points d'attention pour M7 (finitions, pages légales, recette générale, mise en ligne)

- **Recette sur appareils réels** (§2), en HTTPS : installation, raccourcis, notification système avec photo, pastille, zones de sécurité iPhone.
- **Clés VAPID et endpoints push** réels ; vérifier l'envoi complet par le back-end.
- **Hébergement** : en-têtes `Cache-Control: no-cache` pour `/sw.js` et `/manifest.webmanifest`, `immutable` pour `/assets/*`.
- **Pages légales et aide** : elles utilisent encore la page provisoire (flèche retour déjà en place).
- **Budget** : le précache et le JavaScript de démarrage sont proches de leurs limites (§3). Toute nouvelle dépendance au démarrage est à surveiller.
- **Deux fichiers de verrouillage** (`package-lock.json` et `bun.lock`) : `bun.lock` n'a pas été mis à jour pour les nouvelles dépendances.
- **Surcouches non reliées à l'historique** : ReservationExpiredOverlay, SignatureHoldOverlay, fenêtre de ProofPage.

---

## 8. Corrections responsive

Le client a signalé des défauts d'affichage sur ordinateur. Un audit par captures, de 360 à 1440 px, en a confirmé 41, en plus des audits du catalogue et de la fiche produit. Tous sont corrigés, en cinq lots :

| Lot | Commit | Principales corrections |
| --- | --- | --- |
| Accueil | `2074b05` | Sections dans `Container` ; marge de page `--spacing-page` et largeur `--container-content` dans `@theme` ; carrousel des nouveautés aligné sur la marge de page |
| Tunnel | `314e723` | Panier en deux colonnes dès 768 px ; cartes d'adresse de la réservation ; alignement de l'écran de paiement et du code USSD |
| Coquille | `eb1691f` | Pile des barres du bas en variables (`--bottom-bar-h`, `--pending-banner-h`, `--update-banner-h`, `--floating-button-h`) ; en-tête ordinateur replié à 72 px ; toasts ; pied de page ; recherche |
| Suivi et profil | `cc89e84` | En-tête des feuilles fixe et contenu défilant ; grille de mes réservations ; cartes de réservation ; photos du colis ; montants et numéros avec espaces insécables ; champs d'adresse adaptés à leur conteneur |
| Catalogue et fiche | `800e685` | Cartes produit adaptées à leur conteneur ; Explorer et favoris sur 3 colonnes ; filtres latéraux collants sous l'en-tête ; galerie, visionneuse, guide des tailles ; accueil tablette |

Après ces corrections, le JavaScript de démarrage était remonté à 182,2 kB. Il est ramené à 178,2 kB (`0e2f11f`).

**Logo** : le vrai logo (`public/images/logo_choco.jpg`) remplace les logos redessinés partout :
- icônes du manifeste, favicon, pastille et écran de lancement ;
- en-tête, avec l'emblème et le texte.

`npm run icons` régénère l'ensemble à partir de ce fichier (`scripts/prepare-logo.mjs`).

**Incident** : pendant le nettoyage des copies de travail des agents, `git worktree remove --force` a suivi les liens de `node_modules` et supprimé une partie des dépendances du projet principal. Elles ont été réinstallées (`npm install`). Ensuite, `npm ls` ne signale aucun manque et les tests passent (275/275). Le code source n'a pas été touché.
