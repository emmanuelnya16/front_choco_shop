// Prépare le logo du client pour l'application (M6 §4.2), première étape de `npm run icons`.
//
// Source : public/images/logo_choco.jpg (logo officiel fourni par le client : emblème blanc sur fond noir).
// Sorties :
//   - public/brand/logo-choco-white.png : emblème blanc sur fond TRANSPARENT, carré 1024 px, source des
//     icônes, écrans de démarrage et pastille des notifications (pwa-assets.config.ts,
//     scripts/generate-extra-icons.mjs) ;
//   - src/assets/brand/logo-choco-{64,128,192}.webp : pastille ronde (emblème blanc sur disque ink) pour
//     l'en-tête, le pied de page et l'écran de lancement (importée par src/components/ui/Logo.tsx).
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'public', 'images', 'logo_choco.jpg');
const INK = { r: 0x1a, g: 0x1a, b: 0x18 };
const SIZE = 1024;
// Seuils de luminance : le noir du JPEG (bruit de compression compris) devient transparent, le blanc opaque
const BLACK_POINT = 28;
const WHITE_POINT = 225;

mkdirSync(join(ROOT, 'public', 'brand'), { recursive: true });
mkdirSync(join(ROOT, 'src', 'assets', 'brand'), { recursive: true });

// 1. Carré centré sur fond noir (l'image fournie fait 918 × 928), en 1024 × 1024.
// (sharp applique extend() après resize() : le carré se fait donc par resize « contain ».)
const square = await sharp(SOURCE)
  .flatten({ background: '#000000' })
  .resize(SIZE, SIZE, { fit: 'contain', background: '#000000', kernel: 'lanczos3' })
  .greyscale()
  .raw()
  .toBuffer({ resolveWithObject: true });
if (square.info.width !== SIZE || square.info.height !== SIZE) {
  throw new Error(`Taille inattendue : ${square.info.width} × ${square.info.height}`);
}
// greyscale() peut garder plusieurs canaux : on lit le premier
const { data: grey, info: greyInfo } = square;

// 2. Emblème blanc, opacité = luminance (contours lissés conservés)
const rgba = Buffer.alloc(SIZE * SIZE * 4);
for (let i = 0; i < SIZE * SIZE; i += 1) {
  const level = (grey[i * greyInfo.channels] - BLACK_POINT) / (WHITE_POINT - BLACK_POINT);
  rgba[i * 4] = 255;
  rgba[i * 4 + 1] = 255;
  rgba[i * 4 + 2] = 255;
  rgba[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, level)) * 255);
}
const white = sharp(rgba, { raw: { width: SIZE, height: SIZE, channels: 4 } });
await white.clone().png({ compressionLevel: 9 }).toFile(join(ROOT, 'public', 'brand', 'logo-choco-white.png'));

// 3. Pastilles rondes pour l'interface : disque ink, emblème blanc à 92 % du diamètre
const whitePng = await white.clone().png().toBuffer();
for (const size of [64, 128, 192]) {
  const emblem = await sharp(whitePng)
    .resize(Math.round(size * 0.92), Math.round(size * 0.92), { kernel: 'lanczos3' })
    .toBuffer();
  const disc = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="rgb(${INK.r},${INK.g},${INK.b})"/></svg>`,
  );
  await sharp(disc)
    .composite([{ input: emblem, gravity: 'center' }])
    .webp({ quality: 82, alphaQuality: 90, effort: 6 })
    .toFile(join(ROOT, 'src', 'assets', 'brand', `logo-choco-${size}.webp`));
}

console.log('Logo préparé : public/brand/logo-choco-white.png et src/assets/brand/logo-choco-{64,128,192}.webp');
