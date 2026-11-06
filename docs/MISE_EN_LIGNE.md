# Mise en ligne de l’application DR Choco L’Incompris

Ce guide explique, pas à pas, comment publier l’application sur l’hébergement cPanel (type Verpex), comment la mettre à jour et comment revenir à la version précédente en cas de problème. Il est écrit pour une personne qui n’est pas développeur  chaque étape dit quoi faire et ce que l’on doit voir.

> **En bref.** L’application est un ensemble de fichiers prêts à l’emploi (le dossier `dist/`). On les dépose dans `public_html/`, à côté du dossier `api/` de l’API Symfony, sans jamais toucher à ce dernier.

---

## 1. Vue d’ensemble

```
public_html/                  ← racine du site https://<domaine>/
├── index.html                ← page de l'application
├── .htaccess                 ← règles du serveur (adresses, cache, sécurité) : fichier caché, indispensable
├── sw.js                     ← service worker (hors connexion, notifications)
├── manifest.webmanifest      ← fiche d'installation de l'application
├── assets/                   ← scripts, styles et police (noms qui changent à chaque version)
├── images/  brand/  splash/  screenshots/  shortcuts/  …
├── robots.txt  sitemap.xml   ← référencement
└── api/                      ← API Symfony : NE JAMAIS SUPPRIMER NI ÉCRASER
```

- Toutes les adresses de l’application (`/produit/…`, `/reservations/…`, plus tard `/admin`) sont servies par `index.html` grâce au fichier `.htaccess`.
- Les adresses commençant par `/api/` sont laissées à l’API Symfony.

---

## 2. Prérequis (une seule fois)

| Élément | Où le vérifier | Ce qu’on doit voir |
| --- | --- | --- |
| Nom de domaine pointé vers l’hébergement | cPanel → « Domaines » | Le domaine est listé, sa racine est `public_html` |
| Certificat SSL actif | cPanel → « SSL/TLS Status » (AutoSSL) | Domaine et `www` en vert (« AutoSSL Domain Validated ») |
| API Symfony installée sous `/api` | Navigateur  `https://<domaine>/api/settings/public` | Une réponse en JSON (texte entre accolades), pas une page d’erreur |
| Accès aux fichiers | cPanel → « Gestionnaire de fichiers », ou un compte FTP (FileZilla, en FTPS ou SFTP) | Le dossier `public_html` s’ouvre |
| Poste qui construit l’application | Ordinateur du développeur | Node.js 22 ou plus récent et ce dépôt |

Valeurs à obtenir avant la première mise en ligne (voir `docs/SUIVI_POINTS_OUVERTS.md`, section « Bloquant ») 
- la **clé publique VAPID** des notifications (fournie par l’équipe back-end) 
- le **nom du compte Cloudinary** (photos) 
- le **numéro WhatsApp** de la boutique 
- l'**adresse définitive du site** (domaine en `.com`).

---

## 3. Construire la version à publier

À faire sur le poste du développeur, dans le dossier du projet.

1. **Variables de production.** Copier `.env.production.example` en `.env.production`, puis remplir chaque valeur (le fichier explique chacune). Les valeurs essentielles 

   ```ini
   VITE_API_MOCK=false
   VITE_API_BASE_URL=/api
   VITE_APP_STAGE=production
   VITE_ENABLE_DEV_PAGE=false
   VITE_PWA_ENABLED=true
   VITE_VAPID_PUBLIC_KEY=<clé publique fournie par le back-end>
   VITE_CLOUDINARY_CLOUD_NAME=<nom du compte Cloudinary>
   VITE_SHOP_WHATSAPP=<numéro au format +237XXXXXXXXX>
   VITE_SITE_URL=https://<domaine>
   ```

   `.env.production` n’est jamais envoyé sur l’hébergement ni enregistré dans le dépôt  il sert seulement à construire.

2. **Installer et construire :**

   ```bash
   npm ci
   npm run build
   ```

   À la fin, le terminal affiche `✓ built in …` et le dossier `dist/` est créé.

3. **Contrôler le poids :**

   ```bash
   npm run check:size
   ```

   Le terminal doit finir par « Tous les budgets sont respectés. ». Sinon, ne pas publier  prévenir le développeur.

4. **Contrôler le contenu de `dist/`.** Il ne doit **pas** contenir `mockServiceWorker.js`, ni de dossier `mock/`, ni de fichiers `.map`. Il doit contenir `.htaccess` (fichier caché  sous Windows, cocher « Éléments masqués » dans l’Explorateur).

5. **Préparer l’archive.** Compresser le **contenu** de `dist/` (pas le dossier lui-même) en `dist-AAAA-MM-JJ.zip`, par exemple `dist-2026-11-15.zip`. Garder cette archive  elle sert au retour arrière (§7).

---

## 4. Envoyer sur l’hébergement

### 4.1 Avec le gestionnaire de fichiers de cPanel (recommandé)

1. Ouvrir cPanel → « Gestionnaire de fichiers » → `public_html`.
2. Cliquer sur « Paramètres » (en haut à droite) et cocher **« Afficher les fichiers cachés (dotfiles) »**, sinon `.htaccess` reste invisible.
3. **Première mise en ligne seulement :** si `public_html` contient une page d’accueil par défaut de l’hébergeur (`index.php`, `default.html`…), la supprimer. **Ne jamais toucher au dossier `api/`.**
4. Cliquer sur « Charger », envoyer `dist-AAAA-MM-JJ.zip`, puis revenir dans `public_html`.
5. Clic droit sur l’archive → « Extraire » → dossier `/public_html` → confirmer. Les fichiers existants sont remplacés.
6. Supprimer l’archive `.zip` de `public_html` (elle reste sur le poste du développeur).

> **Ne pas vider le dossier `assets/` à chaque mise à jour.** Les anciens fichiers servent encore quelques minutes aux personnes qui avaient l’application ouverte. On peut faire du ménage une fois par trimestre (fichiers de plus de 30 jours).

### 4.2 Avec un logiciel FTP (FileZilla)

1. Se connecter en **FTPS** ou **SFTP** (jamais en FTP simple) avec le compte fourni par l’hébergeur.
2. Afficher les fichiers cachés  menu « Serveur » → « Forcer l’affichage des fichiers cachés ».
3. Glisser le **contenu** de `dist/` dans `public_html/` et accepter le remplacement des fichiers existants.
4. Envoyer `index.html` et `sw.js` **en dernier**  ainsi, personne ne reçoit une page qui pointe vers des fichiers pas encore arrivés.

Aucun script de déploiement automatique n’est fourni. Il demanderait de stocker des identifiants d’accès à l’hébergement, et le gestionnaire de fichiers suffit pour une mise à jour de quelques minutes. Un tel script pourra être ajouté plus tard, avec les identifiants dans des variables d’environnement, jamais dans le dépôt.

---

## 5. Vérifications après la mise en ligne (15 points)

À faire dans l’ordre, avec un ordinateur (Chrome) et un téléphone Android. Les vérifications « en-têtes » se font dans Chrome  clic droit → « Inspecter » → onglet « Réseau » (Network), recharger la page, cliquer sur le fichier, rubrique « En-têtes de réponse ».

| # | Vérification | Comment | Résultat attendu |
| --- | --- | --- | --- |
| 1 | HTTPS | Ouvrir `http://<domaine>` | Redirection vers `https://<domaine>`, cadenas dans la barre d’adresse |
| 2 | Adresse principale | Ouvrir `https://www.<domaine>` | Redirection vers `https://<domaine>` (sans `www`) |
| 3 | Page d’accueil | Ouvrir `https://<domaine>` | La vitrine s’affiche avec les vrais produits |
| 4 | Actualisation sur une fiche | Ouvrir une fiche produit, puis appuyer sur F5 | La fiche se recharge, **pas** de page « 404 Not Found » |
| 5 | API | Ouvrir `https://<domaine>/api/settings/public` | Du JSON, pas la page de l’application |
| 6 | Cache du service worker | Réseau → `sw.js` | `Cache-Control: no-cache` |
| 7 | Cache des fichiers de version | Réseau → un fichier `assets/index-….js` | `Cache-Control: public, max-age=31536000, immutable` et `Content-Encoding: br` ou `gzip` |
| 8 | Manifeste | Réseau → `manifest.webmanifest` | `Content-Type: application/manifest+json` et `Cache-Control: no-cache` |
| 9 | Pages de développement absentes | Ouvrir `https://<domaine>/_dev` puis `https://<domaine>/mockServiceWorker.js` | « Page introuvable » dans l’application, puis une erreur 404 |
| 10 | Sécurité | Ouvrir https://securityheaders.com et analyser le domaine | Au moins la note B (les en-têtes `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` sont présents) |
| 11 | Console propre | Inspecter → onglet « Console », parcourir accueil, fiche, panier | Aucune erreur rouge  aucun avertissement « Content Security Policy » |
| 12 | Installation | Sur Android, Chrome → menu ⋮ → « Installer l’application » | L’icône DR Choco apparaît sur l’écran d’accueil et l’app s’ouvre en plein écran |
| 13 | Notification de test | Dans l’app installée, se connecter et activer les notifications, puis demander au back-end d’envoyer une notification de test | La notification s’affiche  un appui ouvre la bonne réservation |
| 14 | Hors connexion | Ouvrir l’app, visiter 2 fiches et « Mes réservations », passer en mode avion, rouvrir l’app | Les pages vues s’affichent avec le bandeau « Hors connexion »  réserver est impossible, avec un message clair |
| 15 | Parcours complet | Réserver un article avec un numéro de test, payer un petit montant, envoyer la preuve, faire valider par la boutique | Chaque étape se passe sans erreur, la notification de validation arrive |

Compléments utiles  `https://<domaine>/robots.txt` et `https://<domaine>/sitemap.xml` s’affichent. Dans Google Search Console, déclarer le plan du site.

---

## 6. Renforcer la sécurité après la mise en ligne

Ces deux réglages se font dans `public_html/.htaccess` (clic droit → « Modifier » dans le gestionnaire de fichiers), puis dans `public/.htaccess` du dépôt pour les versions suivantes.

1. **HTTPS strict (HSTS)**, quand le HTTPS fonctionne sur le domaine **et** sur `www` (vérifications 1 et 2)  retirer le `#` au début de la ligne `# Header always set Strict-Transport-Security …`. Les navigateurs refuseront ensuite toute connexion non chiffrée pendant un an  ne pas l’activer tant que le certificat n’est pas fiable.
2. **Politique de sécurité du contenu (CSP)**  elle est d’abord en mode observation (`Content-Security-Policy-Report-Only`). Après une semaine sans avertissement dans la console (vérification 11, sur plusieurs pages, téléphone et ordinateur), remplacer `Content-Security-Policy-Report-Only` par `Content-Security-Policy`.
   - Si l’API est un jour déplacée sur un sous-domaine (`https://api.<domaine>`), ajouter son adresse à `connect-src` et lire `docs/CONTRAT_API.md` §2 (cookies et CORS).
   - Si un outil de mesure d’audience est ajouté, il faudra l’autoriser dans la CSP **et** demander le consentement des visiteurs (bandeau de cookies)  aujourd’hui l’application n’en utilise aucun.

---

## 7. Mettre à jour l’application

1. Construire la nouvelle version (§3) et créer sa nouvelle archive datée.
2. L’envoyer (§4), sans supprimer l’ancien dossier `assets/`.
3. Vérifier rapidement les points 3, 4, 6 et 11 du §5.
4. **Vérifier la mise à jour chez une personne qui a déjà installé l’app :**
   - ouvrir l’application installée sur le téléphone (ou la remettre au premier plan) 
   - quelques secondes après l’ouverture ou le retour sur l’app (au plus tard dans l’heure si elle reste ouverte), le bandeau « Une nouvelle version est disponible » apparaît en bas de l’écran. Il n’apparaît pas pendant un paiement ou l’envoi d’une preuve, pour ne pas interrompre la personne 
   - appuyer sur « Mettre à jour »  l’application se recharge sur la nouvelle version.
   - Si le bandeau n’apparaît pas  vérifier le point 6 (`sw.js` doit être en `no-cache`).

---

## 8. Revenir à la version précédente

Si une mise à jour pose problème 

1. Reprendre l’archive de la version précédente (`dist-AAAA-MM-JJ.zip`, gardée au §3).
2. L’envoyer et l’extraire dans `public_html` exactement comme au §4.1 (les fichiers sont remplacés).
3. Vérifier les points 3, 4 et 11 du §5.

Les personnes qui ont l’application installée reçoivent l’ancienne version comme une « nouvelle version »  le bandeau s’affiche et elles reviennent en arrière en appuyant sur « Mettre à jour ». Garder au moins les **trois dernières archives**.

---

## 9. Choix de l’adresse principale (avec ou sans `www`)

Le fichier `.htaccess` renvoie `www.<domaine>` vers `<domaine>`. Pour faire l’inverse (adresse principale avec `www`), remplacer dans `.htaccess` le bloc « 2. www vers le domaine principal » par 

```apache
RewriteCond %{HTTP_HOST} !^www\. [NC]
RewriteCond %{REQUEST_URI} !^/\.well-known/
RewriteRule ^ https://www.%{HTTP_HOST}%{REQUEST_URI} [R=301,L]
```

Mettre aussi `VITE_SITE_URL=https://www.<domaine>` dans `.env.production`, puis l’adresse avec `www` dans `public/robots.txt` et `public/sitemap.xml`.

---

## 10. Dépannage

| Symptôme | Cause probable | Solution |
| --- | --- | --- |
| « 404 Not Found » en actualisant une page | `.htaccess` absent (fichier caché non envoyé) | Afficher les fichiers cachés et renvoyer `.htaccess` (§4.1, étape 2) |
| Page blanche | Fichiers de `assets/` manquants ou envoi interrompu | Renvoyer toute l’archive  vider le cache du navigateur |
| L’API répond par la page de l’application | Dossier `api/` absent ou mal configuré | Vérifier l’installation de Symfony sous `public_html/api` |
| Le bandeau « Une nouvelle version est disponible » n’apparaît jamais | `sw.js` mis en cache par un intermédiaire | Vérifier le point 6  vider le cache de l’hébergeur s’il en propose un (LiteSpeed Cache, Cloudflare…) |
| Erreur 500 juste après l’envoi | Une directive de `.htaccess` n’est pas acceptée par l’hébergeur | Consulter cPanel → « Erreurs »  prévenir le développeur avec le message exact |
| Avertissements « Content Security Policy » dans la console | Une ressource externe nouvelle (image, police…) | Prévenir le développeur avant d’activer la CSP stricte (§6) |

**Testé avant livraison :** le `.htaccess` a été vérifié sur un serveur Apache 2.4 local (XAMPP), en HTTP et en HTTPS. Points vérifiés 
- redirections HTTPS et `www` 
- réécriture des adresses de l’application, y compris `/admin` 
- `/api/` laissé à l’API 
- erreur 404 pour un fichier de version absent et pour les fichiers cachés 
- en-têtes de cache, compression Brotli et gzip, types de fichiers 
- en-têtes de sécurité 
- CSP en observation dans Chrome.
