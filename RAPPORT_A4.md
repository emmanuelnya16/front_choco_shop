# Rapport de Livraison — Module A4 : Paramètres, Livraison/Agences, Contenus, Clients et Recette Finale (A1–A4)

**Projet** : PWA DR Choco L’Incompris  
**Module** : A4 (`/admin/parametres/paiement`, `/admin/parametres/livraison`, `/admin/parametres/boutique`, `/admin/contenus`, `/admin/clients`)  
**Statut** : Livré et vérifié — Espace d’administration `/admin` complet (A1 à A4)

---

## 1. Périmètre livré dans le Module A4

1. **Paramètres Mobile Money, réservation et boutique (`/admin/parametres/paiement` & `/admin/parametres/boutique`)** — [`AdminSettingsPage.tsx`](file:///e:/projet_choco/dr-choco-lincompris/src/pages/admin/AdminSettingsPage.tsx)
   - **Cartes opérateurs (`Orange Money` et `MTN MoMo`, `SP-015`, `SP-016`, `SP-114`)** :
     - Activation/désactivation avec garde-fou empêchant de désactiver les deux opérateurs simultanément ;
     - Nom officiel du compte marchand (`merchantName`), code marchand (`merchantCode`), formule USSD (`ussdTemplate`) avec vérification des balises `{code}` et `{amount}` ;
     - **Aperçu interactif en direct** du code USSD composé pour un panier type de `45 000 FCFA` via [`buildUssdCode`](file:///e:/projet_choco/dr-choco-lincompris/src/features/payment/utils/ussd.ts) ;
     - Image du QR code marchand (`qrImageUrl`) et éditeur ordonné des instructions étape par étape (`steps`).
   - **Règles de réservation (`SP-017`, `SP-019`)** : texte du délai de validation (`validationDelayText`), durée de blocage du stock (`reservationHoldHours`), mode de règlement des frais de livraison (`upfront` d’avance ou `on_delivery` à la réception) et poids maximal d’une capture (`proofMaxSizeMb`).
   - **Boutique & WhatsApp officiel (`/admin/parametres/boutique`, `SP-033`, `SP-034`)** : nom de la boutique, ville, quartier, point de repère, horaires d’ouverture, lien Google Maps et numéro WhatsApp camerounais validé (`isValidCmPhone`), synchronisant `shop` et `pickupAddress` dans `PublicSettings`.

2. **Villes de livraison et agences de transport (`/admin/parametres/livraison`, `SP-031`, `SP-032`, `SP-113`)** — [`AdminSettingsPage.tsx`](file:///e:/projet_choco/dr-choco-lincompris/src/pages/admin/AdminSettingsPage.tsx)
   - Gestion complète des villes desservies (`GET / POST / PATCH / DELETE /api/admin/delivery/cities`) : nom, tarif en FCFA, délai estimé, distinction livraison locale à domicile vs expédition interurbaine par agence.
   - Gestion des agences de transport par ville (`GET / POST / PATCH / DELETE /api/admin/delivery/agencies`) : nom, ville rattachée, adresse et point de repère, téléphone et horaires de retrait.

3. **Éditeur Markdown des pages légales, guides d’aide et FAQ (`/admin/contenus`, `SP-012`, `SP-013`)** — [`AdminContentPagesPage.tsx`](file:///e:/projet_choco/dr-choco-lincompris/src/pages/admin/AdminContentPagesPage.tsx)
   - Liste des **9 pages de contenu** regroupées en *Pages légales* (`conditions-generales`, `annulation-retours`, `confidentialite`, `mentions-legales`) et *Guides d’aide & FAQ* (`questions-frequentes`, `comment-reserver`, `paiement-mobile-money`, `livraison-retrait`, `suivre-ma-reservation`), avec compteur en direct des passages `[À COMPLÉTER]` restants.
   - **Éditeur Markdown côte à côte** sur ordinateur (onglets *Écrire / Aperçu* sur mobile) avec barre d’outils (`H2`, `H3`, `Gras`, `Liste`, `Lien`), puces cliquables sélectionnant chaque passage `[À COMPLÉTER...]` dans le texte et **aperçu fidèle en direct** via `parseMarkdown` + `MarkdownContent` (et `splitFaq` + `FaqAccordion` pour la FAQ).

4. **Répertoire des clients (`/admin/clients`)** — [`AdminCustomersPage.tsx`](file:///e:/projet_choco/dr-choco-lincompris/src/pages/admin/AdminCustomersPage.tsx)
   - Recherche instantanée par nom, numéro `+237` ou ville ;
   - Fiche récapitulative du client sélectionné : coordonnées formatées (`+237 6 XX XX XX XX`), appel direct et bouton WhatsApp, adresses enregistrées et historique complet de ses réservations avec lien vers `/admin/reservations/:ref`.

5. **Documentation consolidée**
   - Contrat d’API complet pour l’équipe Symfony : [`docs/CONTRAT_API_ADMIN.md`](file:///e:/projet_choco/dr-choco-lincompris/docs/CONTRAT_API_ADMIN.md)
   - Mise à jour de [`docs/SUIVI_POINTS_OUVERTS.md`](file:///e:/projet_choco/dr-choco-lincompris/docs/SUIVI_POINTS_OUVERTS.md) (`SP-108` à `SP-116` résolus côté front).

---

## 2. Récapitulatif global de l’Espace d’Administration (Modules A1 à A4)

| Module | Routes `/admin` | Fichiers principaux | Tests Vitest |
|---|---|---|---|
| **A1 — Socle, Authentification & Tableau de bord** | `/admin/connexion`, `/admin` | `AdminLoginPage.tsx`, `AdminDashboardPage.tsx`, `AdminLayout.tsx`, `AdminQuickSearch.tsx`, `adminAuthStore.ts` | `src/test/admin-a1.test.tsx` (5 tests) |
| **A2 — Réservations, Preuves Mobile Money & Colis** | `/admin/reservations`, `/admin/reservations/:ref` | `AdminReservationsPage.tsx`, `AdminReservationDetailPage.tsx`, `ProofVerificationPanel.tsx`, `PackagePhotosUploader.tsx` | `src/test/admin-a2.test.tsx` (6 tests) |
| **A3 — Catalogue, Stocks, Variantes, Catégories & Looks** | `/admin/catalogue`, `/admin/catalogue/nouveau`, `/admin/catalogue/:id`, `/admin/categories`, `/admin/looks` | `AdminCatalogPage.tsx`, `QuickStockSheet.tsx`, `AdminProductEditPage.tsx`, `AdminCategoriesLooksPage.tsx` | `src/test/admin-a3.test.tsx` (4 tests) |
| **A4 — Paramètres, Livraison/Agences, Contenus & Clients** | `/admin/parametres/*`, `/admin/contenus`, `/admin/clients` | `AdminSettingsPage.tsx`, `AdminContentPagesPage.tsx`, `AdminCustomersPage.tsx` | `src/test/admin-a4.test.tsx` (4 tests) |

