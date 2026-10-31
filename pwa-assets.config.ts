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
 * Source : public/brand/logo-choco-white.png, logo officiel du client (public/images/logo_choco.jpg)
 * préparé par scripts/prepare-logo.mjs : emblème blanc sur fond transparent, 1024 × 1024. Pour changer de
 * logo, remplacer public/images/logo_choco.jpg et relancer `npm run icons`.
 *
 * Le générateur écrit à côté de l'image source (public/brand/) : les noms commencent donc par « ../ »
 * pour arriver dans public/ et public/splash/, aux chemins du manifeste (pwa-manifest.ts).
 *
 * Complété par scripts/generate-extra-icons.mjs : pwa-64x64.png, favicon.ico, pastille des
 * notifications et icônes des raccourcis.
 */

// HYPOTHÈSE: logo fourni en JPEG (918 × 928, emblème blanc sur fond noir) et non en vectoriel : les
// écrans de démarrage les plus grands l'affichent à environ 520 px, sous sa résolution d'origine.

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
  // Icônes « any » 192 et 512 et apple-touch-icon 180 : logo sur fond ink plein, 8 % de marge de chaque côté
  // (emblème rond : il remplit bien l'icône).
  // Le type « apple » est le seul (avec « maskable ») à peindre le fond sur toute l'icône.
  apple: { sizes: [180, 192, 512], padding: 0.16, resizeOptions: onInk },
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
  images: ['public/brand/logo-choco-white.png'],
});
