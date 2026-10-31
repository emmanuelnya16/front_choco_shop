# Suivi des points ouverts — DR Choco L’Incompris

> État au 31 octobre 2026 (module M7 « Finitions, recette et mise en ligne », phase P1).
> Sources : `RAPPORT_M0.md` à `RAPPORT_M6.md`, `README.md` et toutes les marques « HYPOTHÈSE: » du code (`src/`, `server/`, `scripts/`, `vite.config.ts`, `pwa-manifest.ts`, `pwa-assets.config.ts`).

## À quoi sert ce document

- Il réunit en un seul endroit tout ce qui reste à décider, à fournir ou à vérifier : hypothèses, écarts, informations attendues du client, contrats à valider par le back-end, recette non faite.
- Il s’adresse au client (la boutique DR Choco), à l’équipe back-end (Symfony) et à l’équipe front (l’application).
- Chaque ligne dit ce qu’il faut décider, qui décide, et ce que l’application fait en attendant (« Par défaut » ou « Proposition »).

## Comment le tenir à jour

1. Un identifiant SP-xxx ne change jamais. On ne supprime pas de ligne : un point réglé passe à « Résolu » ou « Décidé » et reste dans son tableau.
2. Nouveau point : l’ajouter dans le bon thème avec le prochain numéro libre (**prochain : SP-136**), puis le reporter dans « Bloquant pour la mise en ligne » ou « Peut attendre ».
3. Changement de statut : modifier la colonne « Statut » et compléter la phrase par la décision et sa date (ex. « Décidé le 05/11/2026 : … »). Si le code change, mettre à jour ou retirer la marque « HYPOTHÈSE: » correspondante.
4. Relire la section « Bloquant pour la mise en ligne » à chaque point d’étape avec le client. L’ouverture au public est possible quand elle est vide.

## Légende

| Statut | Signification |
| --- | --- |
| Ouvert | Rien n’est tranché ni commencé. L’application applique la proposition par défaut indiquée. |
| En cours | Le travail a commencé. « En cours (M7) » : traité dans le module M7 actuel. |
| Résolu | Réglé par un module suivant (le module est cité dans la phrase). |
| Décidé | Choix fait et appliqué, gardé pour mémoire. À rouvrir seulement si quelqu’un le conteste. |

- **Décision par** : Client (la boutique), Back-end (équipe Symfony), Front (équipe de l’application). Plusieurs noms : décision commune, le premier pilote.
- **Origine** : rapport et section (ex. RAPPORT_M4 §5.1), ou fichier du code qui porte la marque « HYPOTHÈSE: ».
- Hypothèse de ce document : le découpage de l’administration en modules A1 à A4 n’est décrit dans aucun rapport. Les points de la section 10 sont à répartir entre ces modules lors de leur planification.

---

## 1. Contenus et marque

| # | Point | Décision par | Statut | Origine |
| --- | --- | --- | --- | --- |
| SP-001 | Photos de la vitrine à fournir : hero ordinateur (1920 × 1080) et mobile (1080 × 1680), 6 univers, « Comment ça marche », 3 engagements, 4 looks. Dimensions et poids sont dans `public/images/README.md`. Les dossiers sont vides : des visuels de remplacement s’affichent. | Client | Ouvert | RAPPORT_M1 §5 ; `public/images/` |
| SP-002 | Remplacer les 24 articles de démonstration par le vrai catalogue : photos 4:5 (1000 × 1250) par couleur, prix, tailles, stock, description, matières et entretien. | Client, Back-end | Ouvert | RAPPORT_M2 §4 ; `src/mocks/fixtures/products.ts` |
| SP-003 | Chaque photo de la galerie est rattachée à une couleur (`colorCode`) et chaque couleur a au moins une photo, pour que la fiche change de photo avec la couleur. Par défaut : sans rattachement, la galerie reste la même pour toutes les couleurs. | Back-end, Client | Ouvert | `src/types/domain.ts` ; `src/mocks/fixtures/products.ts` |
| SP-004 | Guides des tailles réels par type d’article (vêtements en cm, pointures, conseil cou-de-pied des babouches). Les tableaux actuels sont des exemples. | Client, Back-end | Ouvert | RAPPORT_M2 §1.3 ; `src/features/catalog/product/SizeGuideSheet.tsx` |
| SP-005 | Les 4 looks « Portés par L’Incompris » sont fictifs. Proposition : masquer la section tant qu’aucun vrai look n’est prêt (comportement avec une liste vide à vérifier). | Client, Back-end | Ouvert | RAPPORT_M1 §1.1 et §1.4 ; `src/mocks/fixtures/looks.ts` |
| SP-006 | Logo vectoriel blanc (SVG) à fournir. Le vrai logo JPEG (918 × 928) est utilisé partout depuis M6 ; sur l’écran d’accueil Android, « L’INCOMPRIS » devient très petit. Proposition : un monogramme pour les icônes (une ligne de configuration). | Client | Ouvert | RAPPORT_M6 §5 et §8 ; RAPPORT_M1 §5 ; `pwa-assets.config.ts` |
| SP-007 | Nom court affiché sous l’icône de l’application installée. Par défaut : « DR Choco ». | Client | Ouvert | RAPPORT_M6 §5 ; `pwa-manifest.ts` |
| SP-008 | Les captures de la fenêtre d’installation Android utilisent les données de démonstration. À refaire avec les vraies photos (`npm run screenshots`) après SP-001 et SP-002. | Front | Ouvert | RAPPORT_M6 §5 ; `pwa-manifest.ts` |
| SP-009 | Relire les textes de la vitrine et les promesses affichées : « Livraison partout au Cameroun », « Paiement vérifié », « Photo de votre colis », stock bloqué 24 h, engagements. Par défaut : textes actuels, à garder seulement s’ils sont exacts. | Client | Ouvert | RAPPORT_M1 §1.4 et §2 |
| SP-010 | Les 6 recherches populaires, le raccourci « Moins de 20 000 FCFA » et les tranches de budget du filtre (moins de 15 000, 15 000 à 30 000, 30 000 à 50 000, plus de 50 000 FCFA) sont fixés dans le code. Proposition : les garder, à revoir avec les vrais prix. | Client, Front | Ouvert | RAPPORT_M2 §1.2 et §3 ; `src/features/catalog/search/recentSearches.ts` ; `src/features/catalog/filters/useCatalogFilters.ts` |
| SP-011 | Honnêteté : aucun faux chiffre, avis ou témoignage. Orange Money et MTN MoMo sont écrits en texte, sans logo, faute d’autorisation des marques. | Client, Front | Décidé | RAPPORT_M1 §2 |
| SP-012 | Rédiger les pages légales et d’aide : conditions générales, politique d’annulation et de retour, confidentialité, mentions légales (aujourd’hui sans lien dans le pied de page ni le profil), paiement Mobile Money, livraison et retrait, aide. Elles affichent encore une page provisoire. | Front | En cours (M7) | RAPPORT_M6 §7 ; RAPPORT_M5 §4.1 ; `src/pages/LegalPage.tsx` ; `src/components/layout/AppFooter.tsx` |
| SP-013 | Faire valider les textes légaux par le client (et son conseil), et fournir les informations de l’entreprise : raison sociale, RCCM, NIU, adresse, contact, responsable de la publication. Attention : les deux noms de marchand fictifs diffèrent (« ETS DR CHOCO LINCOMPRIS » et « DR CHOCO BOUTIQUE SARL »). | Client | Ouvert | RAPPORT_M6 §7 ; RAPPORT_M4 §4 |
| SP-014 | Référencement de base : titre, description et adresse canonique par page, pages privées non indexées, `robots.txt` et `sitemap.xml`. | Front | En cours (M7) | RAPPORT_M2 §1.3 ; `src/lib/seo/seo.ts` (en cours) |

## 2. Paiement et réservation

| # | Point | Décision par | Statut | Origine |
| --- | --- | --- | --- | --- |
| SP-015 | Orange Money : nom exact du compte marchand, code marchand officiel, formule USSD officielle (ou aucune si le paiement se fait seulement par l’application), image du QR code officiel, étapes exactes. Valeurs actuelles fictives : « ETS DR CHOCO LINCOMPRIS », code 000111. | Client | Ouvert | RAPPORT_M4 §4.1 ; `src/mocks/fixtures/settings.ts` ; `src/types/domain.ts` |
| SP-016 | MTN MoMo : mêmes informations. Valeurs actuelles fictives : « DR CHOCO BOUTIQUE SARL », code 000222. | Client | Ouvert | RAPPORT_M4 §4.2 ; `src/mocks/fixtures/settings.ts` |
| SP-017 | Délai et horaires de validation des paiements. Texte actuel : « en général en moins d’une heure, de 8 h à 20 h ». | Client | Ouvert | RAPPORT_M4 §4.3 ; `src/pages/SuccessPage.tsx` |
| SP-018 | Écart avec RAPPORT_M4 §6 : si les réglages de paiement n’ont jamais été reçus (première visite hors connexion, panne de l’API), l’écran de paiement affiche les codes marchands et les codes USSD **fictifs** écrits dans le code. Proposition : supprimer ces valeurs de secours et afficher « Paiement momentanément indisponible » avec le lien WhatsApp. | Front | Ouvert | `src/features/payment/api/usePaymentQueries.ts` (`DEFAULT_PAYMENT_SETTINGS`) |
| SP-019 | Frais de livraison payés avec la réservation, ou à la réception. L’application gère les deux. Par défaut : payés avec la réservation (inclus dans le montant Mobile Money). | Client | Ouvert | RAPPORT_M3 §4.2 ; `src/mocks/fixtures/settings.ts` |
| SP-020 | Règles d’annulation et de remboursement. Règle actuelle : réservée ou paiement refusé, annulation immédiate ; paiement envoyé ou confirmée, annulation possible avant la préparation, la boutique rembourse selon sa politique ; à partir de la préparation, contact WhatsApp. Le serveur calcule `cancellable`, l’application le suit. | Client, Back-end | Ouvert | RAPPORT_M5 §4.1 ; `src/features/tracking/cancel.ts` ; `src/mocks/fixtures/reservations.ts` |
| SP-021 | Champs facultatifs de la preuve de paiement (« Numéro qui a payé », « Identifiant de la transaction ») dans un bloc replié. Par défaut : gardés, repliés. | Client | Ouvert | RAPPORT_M4 §4.5 et §6 ; `src/pages/ProofPage.tsx` |
| SP-022 | « Réserver à nouveau » sur les réservations terminées (fidélisation, ajouté sans être demandé). Par défaut : gardé ; se retire facilement. | Client | Ouvert | RAPPORT_M5 §4.2 ; `src/features/tracking/api/useRebook.ts` |
| SP-023 | Repère rouge sur l’onglet Réservations : réservation qui attend une action (payer, renvoyer une preuve, venir retirer le colis) ou changement pas encore vu. Par défaut : gardé. | Client | Ouvert | RAPPORT_M5 §4.4 et §1.5 |
| SP-024 | Montant exact obligatoire ; aucun code USSD ni code marchand réel n’est écrit dans le code : tout vient des réglages publics (voir l’écart SP-018). | Front | Décidé | RAPPORT_M4 §6 ; `src/types/domain.ts` ; `src/mocks/fixtures/settings.ts` |
| SP-025 | Sur iPhone, « Copier le code de paiement » remplace l’appel direct, car iOS bloque `*` et `#` dans les liens d’appel. | Front | Décidé | RAPPORT_M4 §1.2 |
| SP-026 | L’opérateur est proposé selon le préfixe du numéro du client. La table des préfixes est indicative et ne bloque jamais le choix. | Front | Décidé | RAPPORT_M4 §1.2 ; `src/lib/utils/operator.ts` |
| SP-027 | La capture de la preuve reste en mémoire seulement (perdue au rechargement, jamais sur le disque). Les réglages de paiement, publics, sont gardés sur le téléphone pour payer hors connexion. | Front | Décidé | RAPPORT_M6 §1.5 et §6.2 ; `src/features/payment/proof/proofMemory.ts` ; `src/features/payment/api/paymentSettingsStorage.ts` |
| SP-028 | Rythme de mise à jour : 20 s sur paiement, preuve et Merci ; 30 s sur le suivi ; 2 min quand les notifications fonctionnent. Le back-end en tient compte pour la charge du serveur. | Front | Décidé | RAPPORT_M5 §7.2 (9) ; RAPPORT_M6 §1.6 ; `src/features/reservation/api/useReservationQueries.ts` ; `src/features/tracking/api/useTrackingQueries.ts` |
| SP-029 | Idée M0 : réduire la capture avant l’envoi. Résolu en M4 : 1600 px au plus, JPEG 0,82, 210 à 340 Ko. | Front | Résolu | RAPPORT_M0 §6 ; RAPPORT_M4 §1.3 et §2 |
| SP-030 | Suivi complet après le paiement (frise des 12 statuts, historique, profil et adresses), attendu par M3 §5 et M4 §7. Résolu en M5. | Front | Résolu | RAPPORT_M3 §5 ; RAPPORT_M4 §7 ; RAPPORT_M5 §1 |

## 3. Livraison et retrait

| # | Point | Décision par | Statut | Origine |
| --- | --- | --- | --- | --- |
| SP-031 | Villes, frais et délais de livraison. Exemple actuel : boutique à Douala, livraison à domicile 1 500 FCFA « aujourd’hui ou demain », 14 autres villes par agence de 2 000 à 5 000 FCFA. | Client | Ouvert | RAPPORT_M3 §4.1 ; `src/mocks/fixtures/settings.ts` |
| SP-032 | Agences de transport par ville : nom, adresse, horaires, téléphone (affichés au client quand le colis part). | Client, Back-end | Ouvert | RAPPORT_M5 §5.3 et §6 |
| SP-033 | Adresse de la boutique, horaires et lien Google Maps pour le Retrait en boutique. Valeurs actuelles fictives : Akwa, boulevard de la Liberté, « Lun – Sam · 09 h 30 à 19 h 30 ». | Client | Ouvert | RAPPORT_M2 §1.3 ; `src/mocks/fixtures/settings.ts` |
| SP-034 | Numéro WhatsApp officiel de la boutique au format +2376XXXXXXXX. Valeurs actuelles fictives : +237690000000 (réglages) et +237600000000 (`.env.example`). | Client | Ouvert | RAPPORT_M4 §4.4 ; `.env.example` ; `src/mocks/fixtures/settings.ts` |
| SP-035 | Valeurs de secours fictives écrites dans le code, affichées si les réglages manquent : numéro WhatsApp +237690000000, adresse « Akwa, Douala » (avec des horaires différents dans le pied de page), téléphone client +237690000001 dans le récapitulatif. Proposition : les retirer ou masquer le bloc concerné. | Front | Ouvert | `src/components/layout/FloatingWhatsApp.tsx` ; `src/components/layout/AppFooter.tsx` ; `src/pages/ProfilePage.tsx` ; `src/pages/CheckoutPage.tsx` ; `src/features/tracking/detail/ActionBlock.tsx` ; `src/lib/env.ts` |
| SP-036 | Écart avec RAPPORT_M2 §1.3 : la fiche produit écrit en dur « Retrait gratuit Akwa Douala ou livraison 24–48 h », « Livraison Douala (1 500 FCFA) » et « Yaoundé & autres villes (2 500 FCFA) », ce qui contredit les frais par ville ; la réservation écrit « À partir de 1 500 FCFA ». Proposition : lire ces textes dans les réglages et la liste des villes. | Front | Ouvert | `src/pages/ProductPage.tsx` ; `src/pages/CheckoutPage.tsx` |
| SP-037 | Écart avec RAPPORT_M3 §1 : les « créneaux de retrait » annoncés n’existent pas dans le code ; le client vient aux horaires d’ouverture. Par défaut : pas de créneau. | Client | Ouvert | RAPPORT_M3 §1 ; `src/pages/CheckoutPage.tsx` |
| SP-038 | Le « code de retrait » affiché en grand est la référence de la réservation (RES-…), à montrer avec une pièce d’identité. Proposition : garder la référence ; un code distinct demanderait un champ en plus dans l’API. | Client, Back-end | Ouvert | RAPPORT_M5 §1.2 ; `src/features/tracking/detail/ActionBlock.tsx` |
| SP-039 | Nombre de photos du colis prêt : l’application en accepte 1 à 3. Proposition : 3 au maximum (vue d’ensemble, étiquette, détail du scellé). | Client | Ouvert | RAPPORT_M5 §4.3 |
| SP-040 | La notification « colis prêt » montre la photo du colis (demande du cahier M6, qui l’emporte sur M4 et M5). Le téléphone la charge depuis son lien temporaire, sans passer par les caches de l’application. | Client, Front | Décidé | RAPPORT_M6 §6.1 |
| SP-041 | Idée M0 : visionneuse plein écran avec zoom pour les photos du colis. Résolu en M5 (avec « Enregistrer la photo »). | Front | Résolu | RAPPORT_M0 §6 ; RAPPORT_M5 §1.3 |

## 4. Notifications et PWA

| # | Point | Décision par | Statut | Origine |
| --- | --- | --- | --- | --- |
| SP-042 | Vraies clés VAPID : le back-end génère la paire et fournit la clé publique (`VITE_VAPID_PUBLIC_KEY`). La clé actuelle est une clé de démonstration dont la clé privée n’a pas été gardée : aucune notification réelle ne peut partir avec elle. | Back-end | Ouvert | RAPPORT_M6 §4.1 ; `src/lib/env.ts` |
| SP-043 | Abonnement aux notifications : `POST /push/subscribe` (abonnement, plateforme `ios`, `android` ou `web`, navigateur, `oldEndpoint`), un abonnement par appareil ; `POST /push/unsubscribe` avec la session, appelé avant `/auth/logout` ; rappel par le service worker sur `pushsubscriptionchange`, identifié par le cookie de session et `oldEndpoint`. | Back-end | Ouvert | RAPPORT_M6 §4.2 ; `src/sw.ts` ; `src/features/notifications/pushService.ts` ; `src/features/auth/api/useAuthQueries.ts` |
| SP-044 | Envoi d’une notification à chaque changement de statut, au format `PushPayload` : `url` toujours un chemin de l’application, `image` (colis prêt seulement) en lien temporaire. Supprimer les abonnements quand le service répond 404 ou 410. | Back-end | Ouvert | RAPPORT_M6 §4.3 et §4.4 ; `src/pwa/pushPayload.ts` |
| SP-045 | Textes des notifications (cahier M6 §7.2), notamment l’heure limite affichée dans « paiement non validé ». Par défaut : textes du cahier M6. | Client | Ouvert | RAPPORT_M6 §5 |
| SP-046 | Notifications réelles côté application (abonnement, réception, clic, toast) et pastille sur l’icône, préparées en M4 et M5. Résolu en M6 côté front ; l’envoi dépend de SP-042 à SP-044. | Front | Résolu | RAPPORT_M4 §6 ; RAPPORT_M5 §8.3 et §8.5 ; RAPPORT_M6 §1.6 |
| SP-047 | Installation de l’application (« Bientôt disponible » en M1 et M5). Résolu en M6 : bloc de l’accueil, ligne du profil, écran Merci, feuille de 2e visite. | Front | Résolu | RAPPORT_M1 §1.4 (10) ; RAPPORT_M5 §4.5 et §8.4 ; RAPPORT_M6 §1.4 |
| SP-048 | Règles d’invitation à installer : une visite = au moins 30 min après la précédente ; feuille automatique à la 2e visite, au moins 1 jour après la première ; l’écran Merci peut la proposer dès la première preuve ; 14 jours de silence après « Plus tard » ; fermer la feuille vaut « Plus tard » ; sur iPhone « J’ai compris » vaut acceptation ; emplacement de Partager selon le navigateur ; mention des notifications masquée si la version d’iOS est illisible ; installation acceptée : invitations retirées aussitôt ; installation déjà constatée sur cet appareil : l’application reste considérée comme installée. | Front | Décidé | RAPPORT_M6 §1.4 et §6.2 ; `src/pwa/installStore.ts` ; `src/pwa/installService.ts` ; `src/features/install/useInstallController.ts` ; `src/features/install/useSuccessInstallOffer.ts` ; `src/features/install/IosInstallSheet.tsx` |
| SP-049 | Mesure d’audience : la fonction `track()` est prête mais rien ne part du téléphone. Choisir un outil, ou aucun ; s’il y en a un, le citer dans la page Confidentialité. Par défaut : aucun. | Client | Ouvert | RAPPORT_M6 §1.4 ; `src/pwa/track.ts` |
| SP-050 | La feuille d’installation annonce « moins de 1 Mo » (environ 535 Ko compressés en octobre 2026). À remesurer sur la version 1.0.0. | Front | Ouvert | `src/features/install/InstallSheet.tsx` |
| SP-051 | Réglages du hors connexion : hors connexion après 2 échecs ; « Connexion rétablie » visible 2,2 s ; nouvelle vérification toutes les 30 s ; 12 articles consultés gardés, 6 affichés ; « Mis à jour le … » sur les réservations seulement ; navigateur hors ligne avec service worker actif = données du téléphone ; le profil connu reste connecté et le serveur revérifie au retour du réseau. | Front | Décidé | RAPPORT_M6 §1.5 et §6.2 ; `src/features/offline/OfflineBanner.tsx` ; `src/stores/recentlyViewedStore.ts` ; `src/pwa/networkStore.ts` ; `src/stores/authStore.ts` |
| SP-052 | Hors connexion après redémarrage, laissé à M6 par M5. Résolu en M6 : réponses des réservations gardées (avec leurs liens temporaires, jamais les images), effacées à la déconnexion. | Front | Résolu | RAPPORT_M5 §7.2 (10) et §8.2 ; RAPPORT_M6 §1.3 et §6.1 |
| SP-053 | Bandeau « Une nouvelle version est disponible » : jamais pendant la réservation, le paiement, la preuve ou un envoi ; masqué sur mobile sur la fiche produit et le panier rempli ; bouton « Masquer jusqu’au prochain lancement ». | Front | Décidé | RAPPORT_M6 §1.3 et §6.1 ; `src/pwa/UpdateBanner.tsx` |
| SP-054 | Écran de lancement : 0,65 s puis 0,2 s de fondu, application installée seulement, jamais en animations réduites. | Front | Décidé | RAPPORT_M6 §1.7 et §6.1 ; `src/pwa/splash.ts` |
| SP-055 | Comportements des notifications : « Non disponibles » en mode démonstration dans le navigateur ; nouvel abonnement automatique si la permission est accordée sans abonnement ; pastille gardée tant que la session est inconnue ; pas de bouton « Voir » si le client est déjà sur la page. | Front | Décidé | RAPPORT_M6 §6.2 ; `src/features/notifications/pushService.ts` ; `src/features/notifications/appBadge.ts` ; `src/pwa/swMessages.ts` |
| SP-056 | Seules les icônes utiles hors connexion (192 px et pastille) sont enregistrées d’avance ; les polices rares vont dans un cache à part. | Front | Décidé | RAPPORT_M6 §6.1 |

## 5. Sécurité et données

| # | Point | Décision par | Statut | Origine |
| --- | --- | --- | --- | --- |
| SP-057 | Session : jeton d’accès en mémoire seulement ; rafraîchissement par cookie `httpOnly` (environ 90 jours) envoyé avec `credentials: 'include'`. Le back-end règle le cookie (`Secure`, `SameSite` selon le domaine de l’API) et le CORS avec credentials limité au domaine de l’application. | Back-end | Ouvert | RAPPORT_M0 §3.1 ; `src/stores/authStore.ts` ; `src/lib/api/client.ts` |
| SP-058 | `/auth/refresh` répond 401 ou 403 seulement si la session est vraiment refusée. Une erreur 5xx ou une coupure garde le client connecté. | Back-end | Ouvert | RAPPORT_M6 §4.7 ; `src/lib/api/client.ts` |
| SP-059 | Les preuves de paiement contiennent des données personnelles : stockage privé (Cloudinary `authenticated` ou `private`, ou S3 privé) et liens signés de courte durée. | Back-end | Ouvert | RAPPORT_M4 §5.2 |
| SP-060 | Confirmer la forme des liens privés : chemins `/private/` et `/authenticated/`, signature `s--…--`, paramètres `signature`, `sig`, `token`, `expires`, `X-Amz-Signature`, `__cld_token__`. Un lien privé d’une autre forme serait gardé dans le cache d’images du téléphone. | Back-end | Ouvert | RAPPORT_M6 §4.6 ; `src/pwa/cacheRules.ts` |
| SP-061 | En-tête `Cache-Control: no-store` sur toutes les données privées ; l’application ne les enregistre alors jamais. | Back-end | Ouvert | RAPPORT_M6 §4.5 |
| SP-062 | Durées de conservation des données (comptes, adresses, preuves de paiement, photos du colis, abonnements aux notifications), à reprendre dans la page Confidentialité. | Client, Back-end | Ouvert | RAPPORT_M4 §5.2 ; RAPPORT_M5 §5.6 ; RAPPORT_M6 §4.2 |
| SP-063 | Ce qui reste sur le téléphone : panier, favoris, profil (sans jeton), références et statuts déjà vus, réglages de paiement publics. Jamais de preuve de paiement ni de photo du colis. | Front | Décidé | RAPPORT_M5 §8.1 ; RAPPORT_M6 §6.2 ; `src/features/payment/api/paymentSettingsStorage.ts` |
| SP-064 | L’application ne garde jamais les preuves ni les photos du colis en cache (demandé en M4 et M5). Résolu en M6 : règles testées, aucune entrée interdite après une visite. | Front | Résolu | RAPPORT_M4 §5.3 ; RAPPORT_M5 §8.1 ; RAPPORT_M6 §1.3 et §3.2 |
| SP-065 | Une coupure réseau effaçait la session (M0, M3). Résolu en M6 (commit `595c127`). | Front | Résolu | RAPPORT_M6 §1.5 et §6.3 |
| SP-066 | Les consignes AI Studio étaient publiées dans `public/`. Résolu en M6 : déplacées dans `docs/aistudio/`. | Front | Résolu | RAPPORT_M6 §6.3 |
| SP-067 | Héritage AI Studio gardé sur consigne : `@google/genai`, `dotenv` et `express` en dépendances de production, port 3000, `DISABLE_HMR`. Aucun n’entre dans l’application livrée (`express` sert seulement au serveur de démonstration). Proposition : si le projet quitte AI Studio, retirer `@google/genai` et `dotenv`, passer `express` en dépendance de développement. | Client, Front | Ouvert | `package.json` ; `docs/aistudio/` ; RAPPORT_M0 §5.1 |

## 6. Performance

| # | Point | Décision par | Statut | Origine |
| --- | --- | --- | --- | --- |
| SP-068 | JavaScript de démarrage à 178,2 kB compressés pour un plafond de 180 kB : surveiller toute nouvelle dépendance au démarrage et fixer les budgets par page. | Front | En cours (M7) | RAPPORT_M6 §3.3 et §7 |
| SP-069 | Fichiers enregistrés d’avance : 1 557,9 Kio, soit 22 Kio au-dessus de l’objectif de 1,5 Mo. Options : retirer la police (−88 Kio, chargée à la première visite) ou exclure les pages rarement ouvertes hors connexion. Décision laissée à M7. | Front | En cours (M7) | RAPPORT_M6 §3.1 |
| SP-070 | Lighthouse mobile sur la version de production (reporté par M6 ; les mesures M5 étaient faites avec les données de démonstration). | Front | En cours (M7) | RAPPORT_M6 §3.4 ; RAPPORT_M5 §3.1 |
| SP-071 | Poids des vraies photos : respecter les poids cibles du guide `public/images/README.md`, à contrôler à la livraison des photos. | Client, Front | Ouvert | RAPPORT_M1 §1.1 et §5 |
| SP-072 | Le rapport M5 annonçait 100,4 kB au démarrage au lieu d’environ 226 kB (React rangé avec GSAP). Résolu en M6 : 178,2 kB. | Front | Résolu | RAPPORT_M6 §3.3 et §6.3 |
| SP-073 | Idée M0 et M1 : préparer la fiche produit au survol ou à l’appui. Résolu en M2 (`usePrefetchProduct`). | Front | Résolu | RAPPORT_M0 §6 ; RAPPORT_M1 §7 ; `src/features/catalog/api/useCatalogQueries.ts` |

## 7. Hébergement et mise en ligne

| # | Point | Décision par | Statut | Origine |
| --- | --- | --- | --- | --- |
| SP-074 | Domaine définitif et certificat HTTPS (obligatoire pour l’installation, le service worker et les notifications). Les exemples divergent : `drchoco.cm` (RAPPORT_M2, `src/pwa/cacheRules.ts`) et `drchoco.com` (adresse par défaut du référencement en cours). | Client | Ouvert | RAPPORT_M2 §3 ; README §6 bis ; `src/lib/seo/seo.ts` (en cours) |
| SP-075 | Configuration de l’hébergeur (`.htaccess`) : toutes les pages renvoient vers `index.html`, `Cache-Control: no-cache` pour `/sw.js` et `/manifest.webmanifest`, `immutable` pour `/assets/*`, HTTPS forcé. `vercel.json` et `public/_redirects` servent aux prévisualisations. | Front | En cours (M7) | RAPPORT_M6 §7 ; `vercel.json` ; `public/_redirects` |
| SP-076 | Variables de production : `VITE_API_MOCK=false`, `VITE_ENABLE_DEV_PAGE=false` (sinon `/_dev` et le simulateur restent visibles), vraie `VITE_API_BASE_URL`, `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_VAPID_PUBLIC_KEY`, `VITE_SHOP_WHATSAPP`, `VITE_PWA_ENABLED` vide. | Front, Back-end | En cours (M7) | README §4 ; RAPPORT_M0 §3.4 ; `src/lib/env.ts` ; `vite.config.ts` |
| SP-077 | Compte Cloudinary réel (aujourd’hui `demo`), avec un dossier privé par réservation pour les photos du colis et les preuves. | Back-end, Client | Ouvert | README §4 ; `.env.example` ; RAPPORT_M0 §3.3 |
| SP-078 | Prévisualisation en HTTPS (Vercel ou tunnel) pour la recette sur téléphones : une adresse `http://192.168.x.x` ne permet ni l’installation ni les notifications. | Front, Client | Ouvert | RAPPORT_M6 §2 ; README §6 bis |
| SP-079 | Passer en version 1.0.0 (aujourd’hui 0.6.0). | Front | En cours (M7) | `package.json` ; RAPPORT_M6 (en-tête) |
| SP-080 | Balises de partage des fiches produit (aperçu WhatsApp et Facebook) écrites par le serveur : ces robots ne lisent pas le JavaScript, ils voient aujourd’hui les balises générales de `index.html`. | Back-end | Ouvert | RAPPORT_M6 §4.8 ; RAPPORT_M2 §1.3 |
| SP-081 | Fichiers de démonstration publiés avec l’application : QR « EXEMPLE — À REMPLACER » et silhouettes de `public/mock/` (enregistrés d’avance sur le téléphone), photos de colis et preuve fictives, `public/mockServiceWorker.js`. Proposition : les exclure du build de production, sauf les silhouettes de repli encore utilisées. | Front | Ouvert | RAPPORT_M4 §1.1 ; RAPPORT_M6 §3.1 ; `vite.config.ts` |
| SP-082 | Deux fichiers de verrouillage : `bun.lock` n’est plus à jour. Proposition : garder npm et supprimer `bun.lock`. | Front | Ouvert | RAPPORT_M6 §7 |
| SP-083 | Documentation : le README est encore titré « Module M0 », son arborescence date de M0, et son §7 conseille une adresse `http://192.168…` incompatible avec l’installation et les notifications. | Front | En cours (M7) | `README.md` §5 et §7 |

## 8. API Symfony

| # | Point | Décision par | Statut | Origine |
| --- | --- | --- | --- | --- |
| SP-084 | Rédiger le contrat d’API consolidé (routes, formes, codes d’erreur) à partir des hypothèses ci-dessous, pour validation par le back-end. | Front, Back-end | En cours (M7) | RAPPORT_M0 §3.2 ; `src/lib/api/endpoints.ts` ; `src/types/api.ts` |
| SP-085 | API réelle en ligne et branchée : fin des données de démonstration (`VITE_API_MOCK=false`). | Back-end | Ouvert | README §4 |
| SP-086 | Contrat général : routes sous `VITE_API_BASE_URL`, pagination `{ items, page, pageSize, total, totalPages }`, filtres de `GET /products` (`category`, `q`, `size`, `minPrice`, `maxPrice`, `available`, `sort`, `page`), erreurs `{ code, message, details }`. | Back-end | Ouvert | RAPPORT_M0 §3.2 ; `src/lib/api/endpoints.ts` ; `src/types/api.ts` |
| SP-087 | Fournisseur SMS pour les codes de connexion à 6 chiffres (coût à valider par le client). | Back-end, Client | Ouvert | RAPPORT_M3 §4.3 |
| SP-088 | Remplissage automatique du code sur Android : le SMS se termine par la ligne `@<domaine> #123456`. Par défaut : sans cette ligne, le client tape le code. | Back-end | Ouvert | RAPPORT_M3 §4.3 ; `src/features/auth/components/AuthSheet.tsx` |
| SP-089 | `POST /cart/validate` : `{ items: [{ variantId, quantity }] }` vers `{ checkedAt, items: [{ variantId, status, availableQuantity, unitPrice, previousPrice? }] }`, statut `ok`, `reduced`, `unavailable` ou `price_changed`. | Back-end | Ouvert | RAPPORT_M3 §4.4 ; `src/types/api.ts` |
| SP-090 | `POST /reservations` : en-tête `Idempotency-Key` (UUID gardé entre les tentatives) ; réponse avec `serverTime` et `expiresAt`. Toutes les réponses de réservation renvoient `serverTime` (comptes à rebours). | Back-end | Ouvert | RAPPORT_M3 §4.5 ; RAPPORT_M5 §5.8 ; `src/features/reservation/api/useReservationQueries.ts` |
| SP-091 | `POST /reservations/:ref/proof` (multipart : `file`, `sha256`, `operator`, `payerPhone?`, `transactionId?`) ; réponses 200, 409 `DUPLICATE_PROOF`, 410 `RESERVATION_EXPIRED`, 413 `FILE_TOO_LARGE`, 422 `INVALID_STATUS`. | Back-end | Ouvert | RAPPORT_M4 §5.1 |
| SP-092 | `GET /reservations?scope=active` ou `done` `&page=N` (10 par page, tri par `updatedAt` décroissant) avec `counts { active, done }` et `reachedStatus` (dernier statut atteint avant expiration ou annulation). `GET /reservations?status=reserved` reste inchangé. | Back-end | Ouvert | RAPPORT_M5 §5.1 ; `src/types/api.ts` ; `src/lib/api/endpoints.ts` |
| SP-093 | `GET /reservations/summary` : `{ needsAction, lastUpdatedAt, items }`. `needsAction` compte `reserved`, `payment_rejected` et `ready_for_pickup`, comme l’application. `items` est un ajout au contrat. | Back-end | Ouvert | RAPPORT_M5 §5.2 ; `src/types/api.ts` ; `src/mocks/handlers.ts` ; `src/features/tracking/seenStore.ts` |
| SP-094 | `GET /reservations/:ref` : `updatedAt`, `cancellable`, `cancelDeadline`, `agency`, `packagePhotos`, `packageReadyAt`, et `timeline` en journal daté `[{ status, at, note?, actor? }]` (`actor` : `client`, `shop` ou `system`, ajout). Réponse 404 si la réservation appartient à un autre client. Écart : ce journal remplace le type de frise de M0. | Back-end | Ouvert | RAPPORT_M5 §5.3 et §7.2 (1) ; `src/types/domain.ts` |
| SP-095 | `POST /reservations/:ref/cancel { reason? }` : réservation mise à jour, ou 422 `CANCEL_NOT_ALLOWED`. | Back-end | Ouvert | RAPPORT_M5 §5.4 |
| SP-096 | Adresses : `PATCH /me/addresses/:id` (champs partiels, `isDefault: true` retire le défaut des autres, `agencyId: null` efface l’agence) ; `DELETE /me/addresses/:id` (204, la première adresse restante devient l’adresse par défaut). | Back-end | Ouvert | RAPPORT_M5 §5.5 ; `src/mocks/handlers.ts` |
| SP-097 | Photos du colis : liens signés et temporaires (1 h conseillée), miniatures signées aussi, renvoyés tels quels. Au premier échec, l’application recharge la réservation une seule fois ; une image ne donnant pas son code d’erreur, tout échec compte comme un lien expiré. | Back-end | Ouvert | RAPPORT_M0 §3.3 ; RAPPORT_M5 §5.6 ; `src/types/domain.ts` ; `src/features/tracking/packagePhotos.ts` |
| SP-098 | Ajouter `colorCode` et `colorHex` aux articles d’une réservation, pour remettre la bonne couleur au panier (« Réserver à nouveau »). | Back-end | Ouvert | RAPPORT_M5 §5.7 ; `src/types/domain.ts` |
| SP-099 | `GET /settings/public` : objet `payment` (opérateurs, montant exact, délai de validation, poids maximal de la preuve), `shop`, `whatsappNumber`, `deliveryFeePayment`, `reservationHoldHours` ; `pickupAddress` gardé pour compatibilité. | Back-end | Ouvert | RAPPORT_M4 §1.1 ; `src/types/domain.ts` |

## 9. Recette sur appareils

| # | Point | Décision par | Statut | Origine |
| --- | --- | --- | --- | --- |
| SP-100 | Android récent (Chrome), en HTTPS : parcours M6 n° 1 à 11 (installation par la fenêtre native, lancement, raccourcis par appui long, réouverture et paiement en mode avion, notification système avec photo et clic, pastille, nouvelle version, déconnexion, touche retour). Vérifiés seulement dans Chrome piloté. | Front, Client | Ouvert | RAPPORT_M6 §2 ; RAPPORT_M5 §7.5 |
| SP-101 | iPhone en iOS 16.4 ou plus (Safari) : installation par Partager, écrans de démarrage, zones de sécurité sur un appareil à encoche, notifications après installation. | Front, Client | Ouvert | RAPPORT_M6 §2 |
| SP-102 | Paiement sur de vrais téléphones avec les vrais codes : lien d’appel USSD sur Android, copie du code sur iPhone, ouverture de la galerie, réduction d’une vraie capture sur un téléphone d’entrée de gamme. | Front, Client | Ouvert | RAPPORT_M4 §2 |
| SP-103 | Gestes du suivi sur téléphone : tirer pour actualiser, « Enregistrer la photo » (partage natif), réservations en mode avion. | Front | Ouvert | RAPPORT_M5 §7.5 (3, 8, 10) |
| SP-104 | Remplissage automatique du code SMS sur Android, avec le vrai fournisseur et le vrai domaine (après SP-087, SP-088, SP-074). | Front, Back-end | Ouvert | RAPPORT_M3 §4.3 |
| SP-105 | Captures sur appareil réel (icône sur l’écran d’accueil, raccourcis, notification système) ; noter modèles et versions dans le rapport. | Front | Ouvert | RAPPORT_M6 §1.8 et §2 |
| SP-106 | Parcours automatisés (Playwright), dont le n° 8 : bandeau hors connexion quand le serveur ne répond plus, vérification bloquée en M6. | Front | En cours (M7) | RAPPORT_M6 §3.4 |
| SP-107 | Vidéo ou GIF du dévoilement de la photo du colis et de la frise : non faits (enregistrement d’écran impossible), remplacés par une capture. Proposition : filmer pendant la recette sur téléphone. | Front | Ouvert | RAPPORT_M5 §2 |

## 10. Administration (A1–A4)

| # | Point | Décision par | Statut | Origine |
| --- | --- | --- | --- | --- |
| SP-108 | Valider ou rejeter une preuve de paiement, avec un motif affiché tel quel au client. Le simulateur de `/_dev` reproduit ces actions et sert de référence. | Back-end | Ouvert | RAPPORT_M5 §6 ; RAPPORT_M4 §1.1 |
| SP-109 | Faire avancer une réservation selon son parcours (livraison locale, agence, Retrait en boutique), chaque changement daté et attribué à la boutique ; annuler côté boutique avec une note ; marquer livrée ou retirée. | Back-end | Ouvert | RAPPORT_M5 §6 |
| SP-110 | Joindre 1 à 3 photos du colis (réduites, stockées en privé) avec la date d’emballage, au passage à « Remise à l’agence » ou « Prête pour retrait ». | Back-end | Ouvert | RAPPORT_M5 §6 |
| SP-111 | Gérer le catalogue : articles, couleurs, tailles, stock, photos par couleur, guides des tailles, looks. | Back-end | Ouvert | RAPPORT_M1 §1.1 ; `src/types/domain.ts` |
| SP-112 | Voir le motif choisi par le client quand il annule. | Back-end | Ouvert | RAPPORT_M5 §6 |
| SP-113 | Renseigner les villes, les frais, les délais et les agences (adresse, horaires, téléphone). Par défaut : saisis directement par le back-end au lancement (voir SP-031 et SP-032). | Back-end | Ouvert | RAPPORT_M5 §6 ; RAPPORT_M3 §4.1 |
| SP-114 | Modifier les moyens de paiement (codes marchands, USSD, QR, étapes, délai de validation) sans redéployer. Par défaut : saisis par le back-end. | Back-end | Ouvert | `src/types/domain.ts` ; `src/mocks/fixtures/settings.ts` |
| SP-115 | Le message WhatsApp de l’écran Merci contient le lien `<domaine>/admin/reservations/RES-…` : à confirmer quand l’adresse de l’administration sera connue. | Back-end, Front | Ouvert | RAPPORT_M4 §1.4 ; `src/features/payment/whatsapp.ts` |
| SP-116 | Données d’administration sous `/api/admin` et pages sous `/admin` : jamais gardées en cache par l’application, aucun écran `/admin` dans l’application client. | Back-end, Front | Décidé | RAPPORT_M6 §4.9 ; `src/pwa/cacheRules.ts` |

## 11. Interface et accessibilité

| # | Point | Décision par | Statut | Origine |
| --- | --- | --- | --- | --- |
| SP-117 | Contrastes : l’étiquette rouge sur fond encre devient une pastille rouge à texte blanc ; le badge « danger » garde un texte encre avec bordure et icône rouges ; « Se déconnecter » a une icône rouge et un texte encre. | Front | Décidé | RAPPORT_M1 §6.1 ; RAPPORT_M5 §7.2 (3) |
| SP-118 | Exceptions à la règle « transform et opacity » : masque `clipPath` (dévoilement de la photo du colis, tuile babouches, ouverture de la recherche) et tracés SVG des anneaux. | Front | Décidé | RAPPORT_M5 §7.2 (5) ; RAPPORT_M1 §1.4 ; RAPPORT_M2 §1.2 |
| SP-119 | Choix d’affichage du suivi : titre « Votre colis est prêt » doublé avec une précision pour les lecteurs d’écran ; un seul message pour plusieurs colis prêts ; carte sans photo ; entrée « Mon espace » sur ordinateur ; 3 colonnes de réservations dès 1 280 px. | Front | Décidé | RAPPORT_M5 §7.2 (4, 6, 7, 8) ; `src/pages/ReservationsPage.tsx` |
| SP-120 | Flèche retour, écran parent quand il n’y a pas d’écran précédent : fiche vers sa catégorie, réservation vers le panier, paiement et Merci vers le suivi, favoris vers le profil. | Front | Décidé | RAPPORT_M6 §6.2 ; `src/pages/ProductPage.tsx` ; `src/pages/CheckoutPage.tsx` ; `src/pages/PaymentPage.tsx` ; `src/pages/SuccessPage.tsx` ; `src/pages/FavoritesPage.tsx` |
| SP-121 | `/explorer/:category` et `/categorie/:category` ouvrent la même page, pour qu’aucun lien ne mène à une page introuvable. | Front | Décidé | RAPPORT_M1 §6.2 |
| SP-122 | Feuilles : pas de fermeture par glissement depuis un contenu qui défile ; hauteur maximale de l’écran moins 9,5 rem. | Front | Décidé | `src/components/ui/Sheet.tsx` ; `src/features/catalog/product/SizeGuideSheet.tsx` ; `src/features/catalog/explore/FilterSheets.tsx` |
| SP-123 | Application installée : interface non sélectionnable (sauf références, codes, montants et adresses) et pas de rechargement par glissement. | Front | Décidé | RAPPORT_M6 §1.7 ; `src/styles/index.css` |
| SP-124 | Au-delà de 1 000 000 FCFA, le bouton de la barre de réservation empiète de quelques pixels sur sa marge, sans sortir de l’écran. | Front | Décidé | `src/pages/CheckoutPage.tsx` |
| SP-125 | Trois surcouches ne se ferment pas avec la touche retour d’Android : calque d’expiration, moment signature de la réservation, fenêtre d’agrandissement de la preuve. | Front | Ouvert | RAPPORT_M6 §7 ; `src/features/payment/components/ReservationExpiredOverlay.tsx` ; `src/features/reservation/components/SignatureHoldOverlay.tsx` ; `src/pages/ProofPage.tsx` |
| SP-126 | Les barres d’action du bas sont reconnues à leur forme. Proposition : ajouter l’attribut `data-bottom-bar` aux pages concernées. | Front | Ouvert | `src/components/layout/bottomInsets.ts` |
| SP-127 | Idées M1 pour le catalogue : filtres dans l’adresse (partage WhatsApp), galerie avec zoom, barre « Réserver ma taille » collante. Résolu en M2. | Front | Résolu | RAPPORT_M1 §7 ; RAPPORT_M2 §1 et §3 |

## 12. Outillage et données de démonstration

| # | Point | Décision par | Statut | Origine |
| --- | --- | --- | --- | --- |
| SP-128 | Port 3000 (imposé par AI Studio) au lieu de 5173 ; MSW 3 (`onUnhandledFrame`) ; `import.meta.dirname` dans `vite.config.ts`. | Front | Décidé | RAPPORT_M0 §5 ; RAPPORT_M1 §6.3 |
| SP-129 | Serveur de démonstration Node : pont Express maison (le module prévu ne marche plus avec MSW 3), adresse `127.0.0.1`, mode `pwa` (`.env.pwa`) car les variables en ligne de commande ne marchent pas sous Windows. | Front | Décidé | RAPPORT_M6 §6.1 |
| SP-130 | `/_dev` visible en développement et en prévisualisation (`VITE_ENABLE_DEV_PAGE=true` ou `VITE_API_MOCK=true`), jamais en production (voir SP-076). | Front | Décidé | RAPPORT_M0 §3.4 ; `src/lib/env.ts` |
| SP-131 | `VITE_PWA_ENABLED` vide : vrai pour un build de production, faux en développement. | Front | Décidé | RAPPORT_M6 §6.2 ; `src/lib/env.ts` ; `vite.config.ts` |
| SP-132 | Captures du manifeste prises avec Chrome piloté, Playwright n’étant pas autorisé en M6. | Front | Décidé | RAPPORT_M6 §6.1 ; `scripts/capture-manifest-screenshots.mjs` ; `pwa-manifest.ts` |
| SP-133 | Données de démonstration : 12 réservations pour Junior, 7 archives, 1 réservation d’un autre client, dates relatives. Synchronisation entre onglets et session gardée : démonstration seulement, rien à reprendre en production. | Front | Décidé | RAPPORT_M5 §7.2 (2) et §8.6 |
| SP-134 | Délai d’attente des tests asynchrones porté à 4 s. | Front | Décidé | RAPPORT_M5 §7.3 |
| SP-135 | Dépendances effacées par `git worktree remove`. Résolu : réinstallées, `npm ls` sans manque, tests verts. | Front | Résolu | RAPPORT_M6 §8 |

---

## Bloquant pour la mise en ligne

Ces points empêchent l’ouverture au public. Un point quitte cette liste quand il passe à « Résolu » ou « Décidé ».

**À fournir ou décider par le client**
- SP-001 photos de la vitrine ; SP-002 vrai catalogue ; SP-004 guides des tailles ; SP-009 textes et promesses de la vitrine.
- SP-013 textes légaux validés et informations de l’entreprise ; SP-062 durées de conservation (avec le back-end).
- SP-015 Orange Money ; SP-016 MTN MoMo ; SP-017 délai de validation ; SP-019 frais de livraison ; SP-020 règles d’annulation.
- SP-031 villes et frais ; SP-032 agences ; SP-033 adresse et horaires de la boutique ; SP-034 numéro WhatsApp.
- SP-074 domaine et HTTPS ; SP-077 compte Cloudinary (avec le back-end).

**À livrer par le back-end**
- SP-085 API réelle en ligne ; SP-086 contrat général ; SP-087 fournisseur SMS.
- SP-089 à SP-097 et SP-099 : vérification du panier, réservation, preuve, listes et détail des réservations, annulation, adresses, photos du colis, réglages publics.
- SP-042 clés VAPID ; SP-043 abonnement ; SP-044 envoi des notifications.
- SP-057 session et CORS ; SP-058 rafraîchissement de session ; SP-059 preuves privées ; SP-060 forme des liens privés ; SP-061 `no-store`.
- SP-108 validation ou rejet des paiements ; SP-109 statuts ; SP-110 photos du colis ; SP-111 catalogue et stock.

**À corriger ou terminer côté front**
- SP-018 réglages de paiement fictifs de secours ; SP-035 valeurs de secours fictives ; SP-036 textes de livraison en dur.
- SP-012 pages légales et d’aide ; SP-075 `.htaccess` ; SP-076 variables de production ; SP-084 contrat d’API (en cours en M7).

**Recette obligatoire**
- SP-078 prévisualisation HTTPS ; SP-100 Android ; SP-101 iPhone ; SP-102 paiement sur vrais téléphones.

## Peut attendre

Points ouverts ou en cours qui n’empêchent pas l’ouverture. L’application applique la proposition par défaut.

- **Client** : SP-005 looks ; SP-006 logo vectoriel ; SP-007 nom court ; SP-010 recherches et tranches de prix ; SP-021 champs facultatifs de la preuve ; SP-022 « Réserver à nouveau » ; SP-023 repère rouge ; SP-037 créneaux de retrait ; SP-038 code de retrait ; SP-039 nombre de photos du colis ; SP-045 textes des notifications ; SP-049 mesure d’audience ; SP-067 héritage AI Studio ; SP-071 poids des photos (avec le front).
- **Back-end** : SP-003 photos par couleur ; SP-080 balises de partage ; SP-088 code SMS automatique ; SP-098 couleur des articles réservés ; SP-112 motif d’annulation ; SP-113 villes et agences dans l’administration ; SP-114 moyens de paiement dans l’administration ; SP-115 lien vers la fiche d’administration.
- **Front** : SP-008 captures du manifeste ; SP-014 référencement (M7) ; SP-050 mention « moins de 1 Mo » ; SP-068 budget de démarrage (M7) ; SP-069 fichiers enregistrés d’avance (M7) ; SP-070 Lighthouse (M7) ; SP-079 version 1.0.0 (M7) ; SP-081 fichiers de démonstration publiés ; SP-082 `bun.lock` ; SP-083 README (M7) ; SP-103 gestes du suivi ; SP-104 code SMS automatique sur Android ; SP-105 captures sur appareil ; SP-106 parcours Playwright (M7) ; SP-107 vidéo du dévoilement ; SP-125 surcouches et touche retour ; SP-126 attribut des barres du bas.
