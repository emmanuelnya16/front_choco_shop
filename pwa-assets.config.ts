import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createAppleSplashScreens,
  defineConfig,
  type AppleDeviceName,
  type AssetType,
  type Preset,
  type ResolvedAssetSize,
} from '@vite-pwa/assets-generator/config';

/**
 * Icônes et écrans de démarrage de l'application installable (M6 §4.2), via `npm run icons`.
 *
 * Source : public/brand/logo-white.svg (logo blanc, fond transparent). Pour le remplacer par le logo
 * définitif du client, garder un SVG sans police web, avec une taille intrinsèque d'au moins 1 200 px de
 * large (sharp le rastérise à cette taille avant de réduire : en dessous, les écrans de démarrage sont flous).
 *
 * Le générateur écrit à côté de l'image source (public/brand/) : les noms commencent donc par « ../ »
 * pour arriver dans public/ et public/splash/, aux chemins du manifeste (pwa-manifest.ts).
 *
 * Complété par scripts/generate-extra-icons.mjs : pwa-64x64.png et favicon.ico (monogramme de
 * public/favicon.svg, le logotype complet étant illisible sous 64 px), pastille des notifications et
 * icônes des raccourcis.
 */

// HYPOTHÈSE: le client n'a pas fourni de logo vectoriel : logo-white.svg reprend le logotype de M1
// (variante claire : point rouge, « DR CHOCO » blanc, « L'INCOMPRIS » argent), texte vectorisé.
// HYPOTHÈSE: logotype complet à partir de 180 px (lisible sur les icônes 192 et 512), monogramme « C »
// en dessous (64 px, favicon, pastille) où les deux lignes de texte deviendraient illisibles.

const INK = '#1A1A18';
const onInk = { fit: 'contain', background: INK } as const;
const png = { compressionLevel: 9, quality: 85 } as const;

const root = dirname(fileURLToPath(import.meta.url));
// writeFile ne crée pas les dossiers : public/splash doit exister avant la génération
mkdirSync(resolve(root, 'public/splash'), { recursive: true });

/** Noms des fichiers, relatifs à public/brand/ (dossier de l'image source). */
function assetName(type: AssetType, size: ResolvedAssetSize): string {
  if (type === 'maskable') return `../maskable-icon-${size.width}x${size.height}.png`;
  if (size.width === 180) return `../apple-touch-icon-180x180.png`;
  return `../pwa-${size.width}x${size.height}.png`;
}

/**
 * iPhone courants (tailles uniques : le générateur ignore les doublons).
 * SE 1re gén. · 8 et SE 2e/3e gén. · 8 Plus · X, XS, 11 Pro, 12/13 mini · XR, 11 · XS Max, 11 Pro Max ·
 * 12 à 14 et 16e · 12/13 Pro Max, 14 Plus · 14 Pro, 15, 15 Pro, 16 · 14 Pro Max, 15 Plus, 15 Pro Max,
 * 16 Plus · 16 Pro, 17, 17 Pro · 16/17 Pro Max · Air.
 */
const IPHONES: AppleDeviceName[] = [
  'iPhone SE 4"',
  'iPhone 8',
  'iPhone 8 Plus',
  'iPhone X',
  'iPhone XR',
  'iPhone XS Max',
  'iPhone 12',
  'iPhone 12 Pro Max',
  'iPhone 14 Pro',
  'iPhone 14 Pro Max',
  'iPhone 16 Pro',
  'iPhone 16 Pro Max',
  'iPhone Air',
];

const preset: Preset = {
  // Le type « transparent » garde un fond transparent : un logo blanc y serait invisible.
  transparent: { sizes: [] },
  // Icônes « any » 192 et 512 et apple-touch-icon 180 : logo sur fond ink plein, 12 % de marge de chaque côté.
  // Le type « apple » est le seul (avec « maskable ») à peindre le fond sur toute l'icône.
  apple: { sizes: [180, 192, 512], padding: 0.24, resizeOptions: onInk },
  // Masquable : 20 % de marge de chaque côté ; le logo tient dans le cercle de sécurité (rayon 40 %).
  maskable: { sizes: [512], padding: 0.4, resizeOptions: onInk },
  png,
  assetName,
  appleSplashScreens: createAppleSplashScreens(
    {
      // Logo centré sur 40 % de la largeur en portrait
      padding: 0.6,
      resizeOptions: onInk,
      png: { compressionLevel: 9, quality: 70 },
      linkMediaOptions: { basePath: '/brand/' },
      name: (landscape, size) =>
        `../splash/apple-splash-${landscape ? 'landscape' : 'portrait'}-${size.width}x${size.height}.png`,
    },
    IPHONES,
  ),
};

export default defineConfig({
  headLinkOptions: { preset: '2023', basePath: '/brand/' },
  // Le manifeste est écrit à la main (pwa-manifest.ts) et index.html contient déjà les liens
  manifestIconsEntry: false,
  preset,
  images: ['public/brand/logo-white.svg'],
});
