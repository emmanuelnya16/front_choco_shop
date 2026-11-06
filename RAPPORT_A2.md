# Rapport de Livraison — Module A2 : Gestion des Réservations, Preuves Mobile Money et Photos du Colis

**Projet** : PWA DR Choco L’Incompris  
**Module** : A2 (`/admin/reservations`, `/admin/reservations/:ref`)  
**Statut** : Livré et vérifié

---

## 1. Périmètre livré

1. **File d’attente et liste filtrable des réservations (`/admin/reservations`)**
   - **7 onglets opérationnels rapides avec compteurs en direct** :
     - *À valider* (`pending_validation` — badge prioritaire rouge)
     - *À préparer* (`confirmed`, `preparing`)
     - *Prêtes / Agence* (`ready_for_pickup`, `handed_to_agency`)
     - *En route* (`in_delivery`)
     - *À surveiller* (`reserved`, `payment_rejected`)
     - *Terminées* (`delivered`, `picked_up`, `expired`, `cancelled`)
     - *Toutes*
   - **Recherche instantanée & filtres** : par référence (`RES-...`), nom du client, numéro de téléphone, mode de réception (`Livraison` / `Retrait en boutique`), opérateur (`Orange Money` / `MTN MoMo`) et ville (`Douala`, `Yaoundé`, `Bafoussam`).
   - **Double affichage adaptatif** : tableau dense sur ordinateur (`md+`) et cartes opérationnelles sur téléphone (`< md`) avec action principale en 1 appui.

2. **Vérification des preuves Mobile Money (`/admin/reservations/:ref`)**
   - Composant dédié [`ProofVerificationPanel`](file:///e:/projet_choco/dr-choco-lincompris/src/features/admin/reservations/ProofVerificationPanel.tsx) :
     - Prévisualisation de la capture envoyée par le client + visionneuse plein écran.
     - Affichage grand format du **montant exact attendu en FCFA** (`tabular-nums`), de l’opérateur déclaré, du numéro payeur (copie + appel direct `tel:`) et de l’identifiant de transaction.
     - **Contrôle d’unicité SHA-256** : bandeau vert « Empreinte unique vérifiée ✓ » ou alerte rouge « Attention : cette capture a déjà été utilisée sur RES-… » si `duplicateProofRefs` est non vide.
     - **Validation en 1 appui** (`POST /api/admin/reservations/:ref/validate-payment`) → passe à `confirmed`, ajoute l’entrée `timeline` (`actor: 'shop'`), synchronise les onglets via `BroadcastChannel` et déclenche la notification `payment_validated`.
     - **Rejet motivé** (`POST /api/admin/reservations/:ref/reject-payment`) → feuille avec 4 motifs rapides en 1 appui (`Montant incorrect`, `Capture illisible ou coupée`, `Transaction introuvable sur le compte marchand`, `Numéro ou destinataire erroné`) + champ libre obligatoire (`3–200` caractères), enregistré dans `rejection.reason` et `timeline` (`actor: 'shop'`).

3. **Préparation, prise/ajout de 1 à 3 photos du colis prêt et avancement du parcours (`SP-108` à `SP-110`, `SP-112`)**
   - Composant [`PackagePhotosUploader`](file:///e:/projet_choco/dr-choco-lincompris/src/features/admin/reservations/PackagePhotosUploader.tsx) :
     - Prise de photo directe sur téléphone (`capture="environment"`) ou sélection multiple depuis la galerie (1 à 3 photos), avec compression côté client (`prepareProof`, max `1600 px`, JPEG `0,82`).
     - Sélecteur d’agence de transport (pour les livraisons interurbaines) et note d’expédition (bordereau, contact chauffeur).
     - Enregistrement via `POST /api/admin/reservations/:ref/package-ready` → remplit `packagePhotos` et `packageReadyAt`, passe à `ready_for_pickup` (Retrait) ou `handed_to_agency` (Livraison) et déclenche la notification `package_ready` avec la photo du colis.
   - **Poste d’action adapté à chaque statut** : passage à `preparing`, `in_delivery`, `delivered`, `picked_up`, relance WhatsApp préremplie selon le statut, liste de colisage avec cases à cocher de pointage, journal complet (`timeline` avec auteur `Boutique` / `Client` / `Système`), notes internes équipe et **annulation côté boutique** avec remise immédiate en stock.

---

## 2. Contrat API Symfony consolidé pour A2

| Méthode & Endpoint | Rôle | Corps / Paramètres | Réponse `200` |
|---|---|---|---|
| `GET /api/admin/reservations` | Liste filtrable et compteurs par onglet | `tab`, `status`, `receptionMode`, `city`, `operator`, `q`, `page`, `pageSize` | `AdminReservationsListResponse` (`items`, `counts`, pagination) |
| `GET /api/admin/reservations/:ref` | Fiche complète + contrôle doublon SHA-256 + notes internes | `:ref` (`RES-XXXXXX`) | `AdminReservationDetailResponse` (`reservation`, `duplicateProofRefs`, `internalNotes`, `availableAgencies`) |
| `POST /api/admin/reservations/:ref/validate-payment` | Valider la preuve Mobile Money | `{ note?: string }` | `{ reservation }` (`status: 'confirmed'`) |
| `POST /api/admin/reservations/:ref/reject-payment` | Rejeter la preuve avec motif obligatoire | `{ reason: string }` (3–200 car.) | `{ reservation }` (`status: 'payment_rejected'`) |
| `POST /api/admin/reservations/:ref/status` | Avancer le statut (`preparing`, `in_delivery`, `delivered`, `picked_up`) | `{ status, note?, agencyId? }` | `{ reservation }` |
| `POST /api/admin/reservations/:ref/package-ready` | Joindre 1 à 3 photos du colis prêt et notifier le client | `{ photos, note?, agencyId? }` ou `multipart/form-data` | `{ reservation }` (`ready_for_pickup` ou `handed_to_agency`) |
| `POST /api/admin/reservations/:ref/cancel` | Annuler côté boutique et remettre les variantes en stock | `{ reason: string }` | `{ reservation }` (`status: 'cancelled'`) |
| `POST /api/admin/reservations/:ref/notes` | Ajouter une note interne équipe | `{ text: string }` | `{ note, internalNotes }` |

