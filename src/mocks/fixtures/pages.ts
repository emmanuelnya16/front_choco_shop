import { frenchSpacing } from '@/features/content/markdown/typography';
import type { ContentPageResponse } from '@/features/content/types';

/**
 * Pages légales et d'aide de démonstration (M7 §3.4), servies par GET /pages/:slug.
 * Textes de travail fidèles au fonctionnement de l'app (M3 à M6) ; chaque passage qui dépend
 * d'une décision de la boutique est marqué **[À COMPLÉTER …]**.
 * HYPOTHÈSE: les frais, délais, horaires et adresses repris ici sont ceux des données de
 * démonstration (fixtures/settings.ts) ; ils sont à confirmer par la boutique.
 * Les espaces insécables (avant « : ; ? ! », dans « », les montants et « 24 h ») sont posés par
 * frenchSpacing, comme le ferait l'administration à l'enregistrement.
 */

const UPDATED_AT = '2026-10-31T09:00:00+01:00';

const LEGAL_NOTICE = '> **Texte provisoire, à faire valider par un professionnel du droit.**';

function page(slug: string, title: string, body: string): ContentPageResponse {
  return {
    slug,
    title: frenchSpacing(title),
    updatedAt: UPDATED_AT,
    body: frenchSpacing(body.trim()),
  };
}

const conditionsGenerales = page(
  'conditions-generales',
  'Conditions générales de réservation',
  `
${LEGAL_NOTICE}

Ces conditions s’appliquent à toute réservation faite sur l’application DR Choco L’Incompris. En confirmant une réservation, vous les acceptez.

## 1. Qui sommes-nous ?

L’application est éditée par **[À COMPLÉTER PAR LA BOUTIQUE : raison sociale, forme juridique et numéro RCCM]**, boutique de vêtements, chaussures et babouches pour hommes, située à Akwa, Douala (Cameroun). Les informations complètes figurent dans les [mentions légales](/pages/mentions-legales).

## 2. Le principe de la réservation

- L’application ne vend pas directement en ligne : vous **réservez** des articles, puis vous les payez par Mobile Money.
- Une réservation met vos articles de côté pendant **24 h**. Pendant ce délai, ils ne sont proposés à personne d’autre.
- La vente est conclue quand la boutique a validé votre preuve de paiement. Votre réservation passe alors au statut « Confirmée ».

## 3. Faire une réservation

Pour réserver, vous vous connectez avec votre numéro de téléphone : un code vous est envoyé par SMS. Vous indiquez ensuite :

- vos coordonnées (prénom, nom et numéro de téléphone) ;
- le mode de réception : livraison à Douala, envoi par agence de voyage dans une autre ville, ou Retrait en boutique ;
- vos remarques éventuelles.

Vérifiez vos articles, vos tailles et vos coordonnées avant d’appuyer sur « Confirmer la réservation ». Vous recevez alors une référence, par exemple RES-000124.

## 4. Prix

- Les prix sont indiqués en francs CFA (FCFA). **[À COMPLÉTER PAR LA BOUTIQUE : préciser si les prix s’entendent toutes taxes comprises]**
- Le prix retenu est celui affiché au moment de la réservation. Si un prix change pendant que l’article est dans votre panier, l’application vous prévient avant la réservation.
- Les frais de livraison dépendent de la ville. Ils sont affichés avant la confirmation et inclus dans le montant à payer par Mobile Money. **[À COMPLÉTER PAR LA BOUTIQUE : confirmer que les frais de livraison sont payés avec la réservation, et non à la réception]**

## 5. Paiement

- Le paiement se fait par Orange Money ou MTN MoMo, au compte marchand affiché dans l’application, pour le **montant exact** de la réservation.
- Après le paiement, vous envoyez la capture d’écran de la confirmation : c’est votre preuve de paiement.
- La boutique vérifie que le paiement est bien arrivé **[À COMPLÉTER PAR LA BOUTIQUE : délai et horaires de vérification, par exemple « en général en moins d’une heure, de 8 h à 20 h »]**.
- Si la preuve ne permet pas de retrouver le paiement, la boutique la refuse et indique le motif. Vous pouvez envoyer une nouvelle capture tant que le délai de 24 h n’est pas écoulé.
- La boutique ne vous demandera jamais votre code secret Mobile Money.

## 6. Expiration de la réservation

Si aucune preuve de paiement n’est envoyée dans les 24 h, la réservation expire et les articles sont remis en vente. Rien ne vous est facturé.

Vous avez payé, mais votre réservation a expiré ? Écrivez-nous sur WhatsApp avec votre capture : nous vérifions votre paiement. **[À COMPLÉTER PAR LA BOUTIQUE : remise de côté des articles ou remboursement dans ce cas]**

## 7. Livraison et retrait

- **À Douala** : livraison à l’adresse indiquée (quartier et point de repère), en général le jour même ou le lendemain.
- **Dans les autres villes** : la boutique remet le colis à l’agence de voyage choisie, au nom de la personne indiquée. Le colis se retire à l’agence d’arrivée, en général sous 1 à 3 jours.
- **Retrait en boutique** : à Akwa, Douala, dès que la réservation est prête, avec votre code de retrait et une pièce d’identité.
- Avant chaque envoi ou retrait, la boutique photographie votre colis. La photo est visible dans le détail de la réservation.

Les délais sont donnés à titre indicatif. **[À COMPLÉTER PAR LA BOUTIQUE : responsabilité en cas de perte, de dommage ou de retard pendant le transport par l’agence de voyage]**

Tous les détails : [Livraison et retrait](/aide/livraison-retrait).

## 8. Annulation, échange et retour

Les règles sont détaillées dans la [politique d’annulation et de retour](/pages/annulation-retours).

## 9. Réception et réclamations

Vérifiez votre colis à la réception, en le comparant à la photo envoyée par la boutique. Signalez tout problème sur WhatsApp, avec des photos, **[À COMPLÉTER PAR LA BOUTIQUE : délai pour signaler un problème, par exemple 48 h après la réception]**.

## 10. Données personnelles

Les informations que vous nous confiez servent à traiter votre réservation. Voir la [politique de confidentialité](/pages/confidentialite).

## 11. Droit applicable et litiges

Ces conditions sont soumises au droit camerounais. En cas de désaccord, nous cherchons d’abord une solution amiable avec vous. **[À COMPLÉTER PAR UN JURISTE : juridiction compétente et voies de recours]**

## 12. Modification des conditions

La boutique peut modifier ces conditions. Les conditions applicables sont celles en vigueur le jour de votre réservation. La date de la dernière mise à jour figure en haut de cette page.

## Contact

Pour toute question, écrivez-nous sur WhatsApp ou contactez-nous : **[À COMPLÉTER PAR LA BOUTIQUE : adresse e-mail et numéro de téléphone]**.
`,
);

const annulationRetours = page(
  'annulation-retours',
  'Politique d’annulation et de retour',
  `
${LEGAL_NOTICE}

## Annuler une réservation

Vous pouvez annuler depuis le détail de votre réservation, avec le lien « Annuler la réservation », tant que la boutique n’a pas commencé à préparer votre colis. Vous pouvez indiquer un motif, ce n’est pas obligatoire.

| Statut de la réservation | Annulation dans l’app | Ce qui se passe |
| --- | --- | --- |
| Réservée | Oui | Les articles sont remis en vente immédiatement. |
| Paiement rejeté | Oui | Les articles sont remis en vente immédiatement. |
| En attente de validation | Oui | Vous avez déjà payé : la boutique vous contacte pour le remboursement. |
| Confirmée | Oui | Vous avez déjà payé : la boutique vous contacte pour le remboursement. |
| En préparation, et après | Non | Écrivez-nous sur WhatsApp avec la référence de la réservation. |

## Remboursement

- Le remboursement se fait par Mobile Money, sur le numéro qui a payé. **[À COMPLÉTER PAR LA BOUTIQUE : délai de remboursement et frais de transaction éventuellement retenus]**
- **[À COMPLÉTER PAR LA BOUTIQUE : remboursement intégral ou partiel selon le moment de l’annulation]**

## Réservation expirée

Une réservation non payée dans les 24 h expire d’elle-même. Rien ne vous est facturé et les articles sont remis en vente.

Si vous avez payé mais que la réservation a expiré, écrivez-nous sur WhatsApp avec votre capture de paiement : nous vérifions et trouvons une solution avec vous.

## Annulation par la boutique

La boutique peut annuler une réservation, par exemple si un article se révèle abîmé ou indisponible. Vous êtes prévenu dans l’application. Si vous avez déjà payé, vous êtes remboursé. **[À COMPLÉTER PAR LA BOUTIQUE : confirmer le remboursement intégral et son délai]**

## Échanges

- **[À COMPLÉTER PAR LA BOUTIQUE : échange de taille ou de couleur possible ou non, délai (par exemple 7 jours après la réception), état exigé (article non porté, étiquette attachée, emballage d’origine)]**
- **[À COMPLÉTER PAR LA BOUTIQUE : qui paie les frais de renvoi par agence de voyage]**

Pour limiter les échanges, consultez le **Guide des tailles** sur la fiche de chaque article avant de réserver.

## Retours

- **[À COMPLÉTER PAR LA BOUTIQUE : retours acceptés ou non, délai, état de l’article, articles exclus (par exemple articles soldés ou faits sur mesure)]**
- Pour demander un retour, écrivez-nous sur WhatsApp en indiquant la référence de la réservation (RES-…) et en joignant des photos de l’article.

## Article abîmé ou différent de votre réservation

Comparez votre colis à la photo envoyée par la boutique avant l’envoi. Si un article est abîmé ou ne correspond pas à votre réservation, prévenez-nous sur WhatsApp avec des photos **[À COMPLÉTER PAR LA BOUTIQUE : délai pour signaler le problème]**. La boutique vous propose alors un échange ou un remboursement.
`,
);

const confidentialite = page(
  'confidentialite',
  'Politique de confidentialité',
  `
${LEGAL_NOTICE}

> La conformité de cette politique avec la réglementation camerounaise sur la protection des données personnelles est à faire vérifier par un juriste.

Cette page explique quelles informations nous gardons quand vous utilisez l’application DR Choco L’Incompris, pourquoi, et comment exercer vos droits.

## Qui est responsable de vos données ?

**[À COMPLÉTER PAR LA BOUTIQUE : raison sociale, adresse et contact du responsable des données]**

## Les données que nous recueillons

| Données | À quel moment | Pourquoi |
| --- | --- | --- |
| Numéro de téléphone | À la connexion | Vous identifier par un code SMS et vous joindre au sujet de votre réservation |
| Prénom et nom | À la réservation | Préparer et remettre votre colis |
| Ville, quartier, point de repère, agence de voyage | À la réservation, en cas de livraison | Livrer ou expédier votre colis |
| Nom et numéro de la personne qui récupère le colis | Envoi par agence de voyage | Remettre le colis à la bonne personne |
| Captures de paiement, numéro qui a payé et identifiant de transaction (facultatifs) | Après le paiement | Vérifier votre paiement |
| Photos de votre colis | Avant l’envoi ou le retrait | Vous montrer le colis préparé |
| Historique de vos réservations et motif d’annulation éventuel | À chaque réservation | Suivi de vos réservations et service client |
| Favoris | Quand vous êtes connecté | Les retrouver sur tous vos appareils |
| Abonnement aux notifications | Si vous les activez | Vous prévenir des étapes de votre réservation |

Nous ne recueillons **jamais** votre code secret Mobile Money ni de données de carte bancaire.

Sur votre téléphone, l’application garde aussi votre panier, vos favoris, vos préférences et les pages déjà consultées, pour fonctionner sans réseau. Ces informations restent sur votre téléphone.

## Pourquoi nous les utilisons

- gérer vos réservations, du paiement à la remise du colis ;
- vérifier vos paiements ;
- vous informer de l’avancement de vos réservations (notifications, SMS ou WhatsApp) ;
- répondre à vos questions ;
- protéger l’application contre les abus, par exemple en limitant les demandes de code SMS.

Nous n’utilisons pas vos données pour de la publicité et nous ne les vendons pas. **[À COMPLÉTER PAR LA BOUTIQUE : messages promotionnels par SMS ou WhatsApp envisagés ? Si oui, avec votre accord préalable]**

## Combien de temps nous les gardons

- Compte et historique des réservations : **[À COMPLÉTER PAR LA BOUTIQUE : durée de conservation]**
- Captures de paiement et photos de colis : **[À COMPLÉTER PAR LA BOUTIQUE : durée de conservation]**
- Pièces comptables : **[À COMPLÉTER PAR UN JURISTE : durée légale de conservation]**

## Qui peut y accéder

- l’équipe de la boutique DR Choco L’Incompris, pour traiter vos réservations ;
- le prestataire d’envoi des SMS, pour vous envoyer le code de connexion **[À COMPLÉTER PAR LA BOUTIQUE : nom du prestataire]** ;
- l’hébergeur de l’application et des données **[À COMPLÉTER PAR LA BOUTIQUE : nom et pays d’hébergement]** ;
- Cloudinary, qui stocke les images : photos des articles, et dans un espace privé, captures de paiement et photos de colis **[À COMPLÉTER PAR LA BOUTIQUE : pays de stockage]** ;
- le service de notifications de votre navigateur (Google, Apple ou Mozilla), si vous activez les notifications : il transmet le message à afficher ;
- l’agence de voyage choisie, qui reçoit le nom et le numéro de la personne qui récupère le colis.

Certains prestataires peuvent être situés hors du Cameroun. **[À COMPLÉTER PAR UN JURISTE : encadrement des transferts de données hors du Cameroun]**

## Sécurité

- Les captures de paiement et les photos de colis sont rangées dans un espace privé et ne s’affichent que par des liens temporaires.
- L’application ne garde jamais ces images sur votre téléphone pour la lecture sans réseau.
- La connexion se fait par un code à usage unique envoyé par SMS, sans mot de passe à retenir.

## Cookies et mesure d’audience

L’application n’utilise **aucun cookie publicitaire** ni aucun outil de suivi ou de mesure d’audience proposé par un tiers. C’est pourquoi aucun bandeau de consentement ne s’affiche.

Seules les informations nécessaires au fonctionnement sont enregistrées : maintien de votre connexion, panier, favoris, préférences et pages déjà consultées. Si un outil de mesure d’audience est ajouté plus tard, votre accord vous sera demandé avant son activation.

## Vos droits

Vous pouvez demander à :

1. accéder aux données que nous gardons sur vous ;
2. les corriger : votre prénom, votre nom, votre ville et vos adresses se modifient aussi directement dans votre profil ;
3. les supprimer, sous réserve des obligations légales de conservation ;
4. vous opposer à certains usages.

Les notifications se désactivent à tout moment dans les réglages de votre téléphone ou de votre navigateur.

Pour exercer vos droits, écrivez-nous sur WhatsApp ou à **[À COMPLÉTER PAR LA BOUTIQUE : adresse e-mail dédiée]**. Nous répondons sous **[À COMPLÉTER PAR LA BOUTIQUE : délai de réponse]**. **[À COMPLÉTER PAR UN JURISTE : autorité de protection des données compétente au Cameroun et manière de lui adresser une réclamation]**

## Modification de cette politique

Nous pouvons modifier cette politique, par exemple si l’application évolue. La date de la dernière mise à jour figure en haut de cette page.
`,
);

const mentionsLegales = page(
  'mentions-legales',
  'Mentions légales',
  `
${LEGAL_NOTICE}

## Éditeur de l’application

- Nom commercial : DR Choco L’Incompris
- Raison sociale et forme juridique : **[À COMPLÉTER PAR LA BOUTIQUE]**
- Capital social : **[À COMPLÉTER PAR LA BOUTIQUE]**
- Numéro RCCM : **[À COMPLÉTER PAR LA BOUTIQUE]**
- Numéro d’identifiant unique (NIU) : **[À COMPLÉTER PAR LA BOUTIQUE]**
- Siège : Akwa, Boulevard de la Liberté, Douala, Cameroun **[À COMPLÉTER PAR LA BOUTIQUE : adresse exacte]**
- Téléphone et WhatsApp : **[À COMPLÉTER PAR LA BOUTIQUE]**
- E-mail : **[À COMPLÉTER PAR LA BOUTIQUE]**
- Directeur de la publication : **[À COMPLÉTER PAR LA BOUTIQUE]**

## Hébergement

- Application : **[À COMPLÉTER PAR LA BOUTIQUE : nom, adresse et site de l’hébergeur]**
- Serveur et données : **[À COMPLÉTER PAR LA BOUTIQUE : nom, adresse et pays de l’hébergeur]**
- Images : Cloudinary **[À COMPLÉTER PAR LA BOUTIQUE : société contractante et adresse]**

## Conception et réalisation

**[À COMPLÉTER PAR LA BOUTIQUE : prestataire ou équipe qui a réalisé l’application]**

## Propriété intellectuelle

La marque DR Choco L’Incompris, le logo, les photos et les textes de l’application appartiennent à **[À COMPLÉTER PAR LA BOUTIQUE : titulaire des droits]**. Toute reproduction sans autorisation écrite est interdite.

## Photos des articles

Les photos sont prises avec soin. Les couleurs peuvent toutefois varier légèrement selon l’écran de votre téléphone.

## Données personnelles

Voir la [politique de confidentialité](/pages/confidentialite).

## Contact

Écrivez-nous sur WhatsApp ou à **[À COMPLÉTER PAR LA BOUTIQUE : adresse e-mail]**.
`,
);

const commentReserver = page(
  'comment-reserver',
  'Comment réserver',
  `
Réserver, c’est mettre vos articles de côté pendant **24 h**, le temps de payer par Mobile Money. Il n’y a pas de paiement en ligne direct : vous payez la boutique depuis votre compte Orange Money ou MTN MoMo.

## 1. Choisissez vos articles

- Parcourez le catalogue ou utilisez la recherche.
- Sur la fiche d’un article, choisissez la couleur et la taille. En cas de doute, ouvrez le **Guide des tailles**.
- Appuyez sur « Réserver » pour réserver tout de suite, ou ajoutez l’article au panier pour en réserver plusieurs en une fois.

## 2. Connectez-vous avec votre numéro

Pas de mot de passe : saisissez votre numéro de téléphone, puis le code reçu par SMS. Sur Android, le code se remplit souvent tout seul.

## 3. Choisissez comment recevoir vos articles

- **Livraison** : chez vous à Douala, ou par agence de voyage dans une autre ville.
- **Retrait en boutique** : à Akwa, Douala.

Les frais de livraison s’affichent avant la confirmation. Vos adresses sont enregistrées pour la prochaine fois. Tous les détails dans [Livraison et retrait](/aide/livraison-retrait).

## 4. Confirmez la réservation

Appuyez sur « Confirmer la réservation ». Vous recevez une référence, par exemple RES-000124 : vos articles sont mis de côté pendant 24 h. Un compte à rebours vous indique le temps restant.

## 5. Payez et envoyez votre preuve de paiement

Payez par Orange Money ou MTN MoMo, puis envoyez la capture d’écran de votre paiement. Tout est expliqué dans [Payer par Mobile Money](/aide/paiement-mobile-money).

Pas le temps tout de suite ? Appuyez sur « Payer plus tard » : un bandeau vous rappelle le temps restant et vous ramène au paiement.

## 6. Suivez votre réservation

La boutique valide votre paiement, prépare votre colis et vous envoie sa photo avant l’envoi ou le retrait. Voir [Suivre ma réservation](/aide/suivre-ma-reservation).

## Bon à savoir

- Une réservation non payée dans les 24 h expire et les articles sont remis en vente.
- Vous pouvez annuler tant que la boutique n’a pas commencé à préparer votre colis. Voir la [politique d’annulation et de retour](/pages/annulation-retours).
- Votre panier reste sur votre téléphone, même sans réseau.
`,
);

const paiementMobileMoney = page(
  'paiement-mobile-money',
  'Payer par Mobile Money',
  `
Le paiement se fait uniquement par Mobile Money : **Orange Money** ou **MTN MoMo**. Vous payez directement la boutique, puis vous envoyez la capture de votre paiement. Vous avez 24 h après la réservation.

## Avant de payer

- Payez le **montant exact** affiché sur l’écran de paiement : c’est ce montant que la boutique vérifie.
- Vérifiez que votre compte Mobile Money est suffisamment approvisionné. **[À COMPLÉTER PAR LA BOUTIQUE : frais de l’opérateur à la charge du client ou non]**
- Vous pouvez quitter l’app et revenir : votre réservation vous attend dans l’onglet Réservations.

## Payer avec Orange Money

1. Sur l’écran de paiement, choisissez **Orange Money**.
2. Appuyez sur « Composer le code de paiement » : le code USSD, avec le montant, s’affiche dans votre téléphone. Vous pouvez aussi ouvrir Orange Money et payer au code marchand affiché, ou scanner le QR code depuis un ordinateur.
3. Vérifiez le nom du bénéficiaire : il doit être celui indiqué dans l’app.
4. Confirmez avec votre code secret. **Ne communiquez jamais ce code**, pas même à la boutique.

## Payer avec MTN MoMo

1. Sur l’écran de paiement, choisissez **MTN MoMo**.
2. Appuyez sur « Composer le code de paiement », ou ouvrez l’application MTN MoMo et payez au code marchand affiché.
3. Vérifiez le nom du marchand : il doit être celui indiqué dans l’app.
4. Validez avec votre code secret MTN Mobile Money.

## Envoyer votre preuve de paiement

1. Faites une capture d’écran du message de confirmation (SMS ou écran de l’opérateur). L’app explique comment faire selon votre téléphone.
2. Revenez dans l’app et appuyez sur « J’ai payé, envoyer ma preuve ».
3. Ajoutez votre capture d’écran, puis appuyez sur « Envoyer ma preuve ». Vous pouvez aussi indiquer le numéro qui a payé et l’identifiant de la transaction.

La capture doit être nette et montrer le montant, la date et le bénéficiaire. Taille maximale : 10 Mo. Si le réseau coupe pendant l’envoi, votre capture est gardée et vous pourrez l’envoyer dès le retour du réseau.

## La validation par la boutique

- Votre réservation passe au statut « En attente de validation ».
- La boutique vérifie que le paiement est bien arrivé **[À COMPLÉTER PAR LA BOUTIQUE : délai et horaires de vérification, par exemple « en général en moins d’une heure, de 8 h à 20 h »]**.
- Dès que c’est fait, votre réservation passe au statut « Confirmée ». Si vous avez activé les notifications, vous êtes prévenu tout de suite.

## Si votre preuve est refusée

Votre réservation passe au statut « Paiement rejeté », avec le motif indiqué par la boutique. Envoyez une nouvelle capture avec « Renvoyer ma preuve », depuis le bandeau rouge ou le détail de la réservation, **avant la fin du délai de 24 h**.

Les motifs les plus fréquents :

- capture floue ou coupée ;
- montant différent du montant de la réservation ;
- paiement envoyé à un autre bénéficiaire ;
- capture déjà envoyée pour une autre réservation.

## Vous avez payé, mais la réservation a expiré ?

Écrivez-nous sur WhatsApp avec votre capture : nous vérifions votre paiement et trouvons une solution avec vous.

## Erreur de montant

**[À COMPLÉTER PAR LA BOUTIQUE : que faire si vous avez payé trop, ou pas assez]**
`,
);

const livraisonRetrait = page(
  'livraison-retrait',
  'Livraison et retrait',
  `
Trois façons de recevoir vos articles. Les frais exacts s’affichent au moment de la réservation, avant la confirmation.

| Mode | Pour qui | Délai indicatif | Frais |
| --- | --- | --- | --- |
| Livraison à domicile | Douala | Aujourd’hui ou demain | 1 500 FCFA |
| Envoi par agence de voyage | Autres villes du Cameroun | 1 à 3 jours | 2 000 à 5 000 FCFA selon la ville |
| Retrait en boutique | Tout le monde | Dès que la réservation est prête | Gratuit |

**[À COMPLÉTER PAR LA BOUTIQUE : confirmer les villes desservies, les frais et les délais]**

## Livraison à Douala

- Indiquez votre quartier et un point de repère précis (par exemple « face à la pharmacie du carrefour »).
- Restez joignable au numéro indiqué : le livreur peut vous appeler. **[À COMPLÉTER PAR LA BOUTIQUE : le livreur appelle-t-il avant de passer ?]**
- Votre réservation passe au statut « En cours de livraison », puis « Livrée ».

## Envoi par agence de voyage (hors Douala)

- Choisissez votre ville, puis l’agence de voyage parmi celles proposées.
- Indiquez le nom et le numéro de la personne qui récupérera le colis.
- La boutique dépose le colis à l’agence et le photographie avant l’envoi : votre réservation passe au statut « Remise à l’agence », avec la photo.
- L’adresse, les horaires et le téléphone de l’agence figurent dans le détail de la réservation.
- Retirez le colis à l’agence d’arrivée avec une pièce d’identité. **[À COMPLÉTER PAR LA BOUTIQUE : justificatifs demandés par les agences, frais de garde éventuels]**

## Retrait en boutique

- Adresse : Akwa, Boulevard de la Liberté, à Douala, à 100 m de la Cathédrale.
- Horaires : du lundi au samedi, de 9 h 30 à 19 h 30.
- Attendez le statut « Prête pour retrait » : la photo de votre colis est alors disponible.
- Présentez votre **code de retrait** (la référence de la réservation, affichée en grand dans le détail) avec une pièce d’identité.

**[À COMPLÉTER PAR LA BOUTIQUE : confirmer l’adresse et les horaires, durée de garde du colis en boutique, retrait possible par une autre personne ou non]**

## La photo du colis

Avant l’envoi ou le retrait, la boutique photographie votre colis (une à trois photos). Vous la retrouvez dans le détail de la réservation, avec « Voir mon colis », et vous pouvez l’enregistrer sur votre téléphone.

## À la réception

Vérifiez votre colis en le comparant à la photo. En cas de problème, écrivez-nous sur WhatsApp avec des photos. Voir aussi la [politique d’annulation et de retour](/pages/annulation-retours).
`,
);

const suivreMaReservation = page(
  'suivre-ma-reservation',
  'Suivre ma réservation',
  `
Toutes vos réservations se trouvent dans l’onglet **Réservations** (ou « Mes réservations » en haut de l’écran sur ordinateur). Connectez-vous avec le numéro utilisé pour réserver.

## Où trouver vos réservations

- L’onglet « En cours » regroupe les réservations à payer, en vérification, en préparation ou en route.
- L’onglet « Terminées » regroupe les réservations livrées, retirées, expirées ou annulées.
- Tirez la liste vers le bas pour l’actualiser.

## Les étapes de votre réservation

| Statut | Ce que cela veut dire | Ce que vous faites |
| --- | --- | --- |
| Réservée | Vos articles sont mis de côté pendant 24 h | Payer et envoyer votre preuve de paiement |
| En attente de validation | Votre preuve est en cours de vérification | Rien, patientez |
| Paiement rejeté | La boutique a refusé votre preuve, le motif est affiché | Renvoyer une preuve avant la fin du délai |
| Confirmée | Votre paiement est validé | Rien à faire |
| En préparation | La boutique prépare votre colis | Rien à faire |
| Remise à l’agence | Le colis est déposé à l’agence de voyage, photo à l’appui | Attendre son arrivée |
| Prête pour retrait | Le colis vous attend en boutique, photo à l’appui | Venir avec votre code de retrait |
| En cours de livraison | Le colis est en route | Rester joignable |
| Livrée ou Retirée | C’est terminé | Vérifier votre colis |
| Expirée | Le délai de 24 h est passé sans paiement | Réserver à nouveau si vous le souhaitez |
| Annulée | Annulée par vous ou par la boutique | Rien à faire |

## Le détail d’une réservation

Appuyez sur une réservation pour voir :

- l’action à faire maintenant (payer, renvoyer une preuve, venir retirer le colis…) ;
- la frise des étapes, avec la date de chacune ;
- vos articles, le mode de réception et le paiement ;
- la photo de votre colis, dès qu’il est prêt ;
- un bouton pour écrire à la boutique sur WhatsApp, avec la référence déjà indiquée.

## La photo de votre colis

Avant l’envoi ou le retrait, la boutique photographie votre colis. La photo apparaît dans le détail de la réservation. Vous pouvez l’agrandir et l’enregistrer sur votre téléphone.

## Être prévenu à chaque étape

- Activez les notifications dans votre profil, rubrique « Notifications » : vous êtes prévenu dès que votre paiement est validé, que votre colis est prêt ou qu’il est en route.
- Sur iPhone, installez d’abord l’application sur l’écran d’accueil pour recevoir les notifications.
- Un point rouge sur l’onglet Réservations signale une action à faire ou une nouveauté.
- Sans notifications, la page se met à jour régulièrement, et dès que vous revenez sur l’application.

## Sans réseau

Les réservations déjà consultées restent lisibles sans réseau, avec la date de leur dernière mise à jour.

## Réserver à nouveau

Sur une réservation terminée, « Réserver à nouveau » remet dans votre panier les articles encore disponibles.
`,
);

const questionsFrequentes = page(
  'questions-frequentes',
  'Questions fréquentes',
  `
## Puis-je payer directement en ligne ?

Non. L’application fonctionne par réservation : vos articles sont mis de côté, puis vous payez la boutique par Mobile Money (Orange Money ou MTN MoMo) et vous envoyez votre preuve de paiement. Il n’y a pas de paiement par carte bancaire.

## Combien de temps ai-je pour payer ?

Vous avez **24 h** après la réservation. Un compte à rebours vous indique le temps restant. Passé ce délai, la réservation expire et les articles sont remis en vente.

## Comment payer par Mobile Money ?

Sur l’écran de paiement, choisissez Orange Money ou MTN MoMo, puis appuyez sur « Composer le code de paiement » : le code USSD, avec le montant, s’affiche dans votre téléphone. Payez le montant exact et confirmez avec votre code secret. Le pas à pas est dans [Payer par Mobile Money](/aide/paiement-mobile-money).

## Qu’est-ce que la preuve de paiement ?

C’est la capture d’écran du message de confirmation de votre paiement (SMS ou écran de l’opérateur). Elle doit être nette et montrer le montant, la date et le bénéficiaire. Envoyez-la avec « J’ai payé, envoyer ma preuve ».

## Combien de temps prend la validation ?

La boutique vérifie que le paiement est bien arrivé, **[À COMPLÉTER PAR LA BOUTIQUE : délai et horaires de vérification]**. Votre réservation passe alors au statut « Confirmée ».

## Ma preuve de paiement a été refusée, que faire ?

Lisez le motif indiqué par la boutique, puis envoyez une nouvelle capture avec « Renvoyer ma preuve », avant la fin du délai de 24 h. Le plus souvent, la capture était floue ou coupée, ou le montant ne correspondait pas.

## Livrez-vous en dehors de Douala ?

Oui, par agence de voyage. Choisissez votre ville et l’agence, puis indiquez la personne qui récupérera le colis. La boutique dépose le colis à l’agence et vous envoie sa photo. Comptez en général 1 à 3 jours. Voir [Livraison et retrait](/aide/livraison-retrait).

## Comment se passe la livraison à Douala ?

Le colis est livré à l’adresse indiquée (quartier et point de repère), en général le jour même ou le lendemain. Restez joignable au numéro indiqué.

## Puis-je retirer mes articles en boutique ?

Oui, choisissez « Retrait en boutique » au moment de réserver. Quand votre réservation est « Prête pour retrait », venez à la boutique d’Akwa, à Douala, avec votre code de retrait et une pièce d’identité.

## Pourquoi la boutique m’envoie-t-elle une photo du colis ?

Avant l’envoi ou le retrait, la boutique photographie votre colis. Vous voyez ce qui a été préparé, et vous pouvez comparer à la réception. La photo se trouve dans le détail de la réservation.

## Puis-je annuler ma réservation ?

Oui, tant que la boutique n’a pas commencé à préparer votre colis : ouvrez la réservation, puis « Annuler la réservation ». Si vous avez déjà payé, la boutique vous contacte pour le remboursement. Voir la [politique d’annulation et de retour](/pages/annulation-retours).

## Comment choisir ma taille ?

Sur la fiche de chaque article, ouvrez le **Guide des tailles**. En cas de doute entre deux tailles, écrivez-nous sur WhatsApp avant de réserver. **[À COMPLÉTER PAR LA BOUTIQUE : échange de taille possible ou non]**

## Comment suivre ma réservation et être prévenu ?

Ouvrez l’onglet Réservations : chaque réservation affiche son statut et les étapes à venir. Activez les notifications dans votre profil pour être prévenu à chaque étape. Voir [Suivre ma réservation](/aide/suivre-ma-reservation).

## J’ai payé, mais ma réservation a expiré : que faire ?

Écrivez-nous sur WhatsApp avec votre capture de paiement : nous vérifions votre paiement et trouvons une solution avec vous.

## Faut-il créer un compte ?

Non. Vous vous connectez avec votre numéro de téléphone et un code reçu par SMS, sans mot de passe. Vos favoris et vos adresses sont ensuite gardés pour vos prochaines réservations.
`,
);

export const mockContentPages: Readonly<Record<string, ContentPageResponse>> = Object.fromEntries(
  [
    conditionsGenerales,
    annulationRetours,
    confidentialite,
    mentionsLegales,
    commentReserver,
    paiementMobileMoney,
    livraisonRetrait,
    suivreMaReservation,
    questionsFrequentes,
  ].map((item) => [item.slug, item]),
);

export function findMockContentPage(slug: string): ContentPageResponse | undefined {
  return Object.prototype.hasOwnProperty.call(mockContentPages, slug) ? mockContentPages[slug] : undefined;
}
