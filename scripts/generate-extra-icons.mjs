// Icônes complémentaires de l'application installable (M6 §4.2), lancé par `npm run icons`
// après pwa-assets-generator (pwa-assets.config.ts) :
//   - public/pwa-64x64.png et public/favicon.ico : monogramme de public/favicon.svg (le logotype
//     complet devient illisible sous 64 px) ;
//   - public/badge-96.png : silhouette blanche sur fond transparent (pastille des notifications Android) ;
//   - public/shortcuts/*-96.png : pictogrammes des raccourcis du manifeste, ceux de la barre de navigation.
// Vérifie aussi que index.html référence exactement les écrans de démarrage de public/splash/.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
// Pictogrammes de la barre de navigation (src/components/layout/BottomNav.tsx), licence ISC
import { __iconNode as layoutGridIcon } from 'lucide-react/dist/esm/icons/layout-grid.js';
import { __iconNode as receiptTextIcon } from 'lucide-react/dist/esm/icons/receipt-text.js';
import { __iconNode as shoppingBagIcon } from 'lucide-react/dist/esm/icons/shopping-bag.js';

const INK = '#1A1A18';
const WHITE = '#FFFFFF';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
// Sans palette : couleurs exactes (fond #1A1A18), les fichiers restent minuscules
const PNG = { compressionLevel: 9 };

/** Monogramme (« C » et point rouge) lu dans public/favicon.svg, en unités 64 × 64. */
function readMonogram() {
  const svg = readFileSync(join(PUBLIC, 'favicon.svg'), 'utf8');
  const letter = /<path[^>]*\sd="([^"]+)"/.exec(svg)?.[1];
  const dot = /<circle[^>]*\scx="([\d.]+)"[^>]*\scy="([\d.]+)"[^>]*\sr="([\d.]+)"/.exec(svg);
  if (!letter || !dot) {
    throw new Error('public/favicon.svg : tracé du « C » (<path d>) ou point (<circle cx cy r>) introuvable.');
  }
  return { svg, letter, dot: { cx: Number(dot[1]), cy: Number(dot[2]), r: Number(dot[3]) } };
}

/** Encode un fichier .ico à partir d'images PNG (format accepté depuis Windows Vista). */
function encodeIco(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const entry = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

/** Pastille : « C » blanc échancré autour du point, pour que le point reste visible en silhouette. */
function badgeSvg({ letter, dot }) {
  // Contenu (x 16→52, y 10,5→53,5 en unités 64) ramené à 80 px de haut, centré dans 96 px
  const scale = 80 / 43;
  const tx = 48 - 34 * scale;
  const ty = 48 - 32 * scale;
  const gap = 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <defs><mask id="notch"><rect width="64" height="64" fill="#FFFFFF"/><circle cx="${dot.cx}" cy="${dot.cy}" r="${dot.r + gap}" fill="#000000"/></mask></defs>
  <g transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${scale.toFixed(5)})" fill="${WHITE}">
    <path d="${letter}" mask="url(#notch)"/>
    <circle cx="${dot.cx}" cy="${dot.cy}" r="${dot.r}"/>
  </g>
</svg>`;
}

function iconNodeToSvg(node) {
  return node
    .map(([tag, attrs]) => {
      const list = Object.entries(attrs)
        .filter(([name]) => name !== 'key')
        .map(([name, value]) => `${name}="${value}"`)
        .join(' ');
      return `<${tag} ${list}/>`;
    })
    .join('');
}

/** Raccourci : pictogramme blanc (traits de 2 unités sur 24) sur carré ink aux coins arrondis. */
function shortcutSvg(node) {
  const size = 96;
  const glyph = 52;
  const offset = (size - glyph) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${(size * 10) / 64}" fill="${INK}"/>
  <g transform="translate(${offset} ${offset}) scale(${glyph / 24})" fill="none" stroke="${WHITE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconNodeToSvg(node)}</g>
</svg>`;
}

async function writePng(svg, file, { size, flatten } = {}) {
  let image = sharp(Buffer.from(svg), { density: 288 });
  if (size) image = image.resize(size, size);
  if (flatten) image = image.flatten({ background: flatten });
  await image.png(PNG).toFile(file);
  console.log(`Créé : ${file}`);
}

/** Les liens apple-touch-startup-image de index.html doivent correspondre aux fichiers générés. */
function checkSplashLinks() {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const linked = new Set(
    [...html.matchAll(/rel="apple-touch-startup-image"[^>]*href="\/splash\/([^"]+)"/g)].map((m) => m[1]),
  );
  const files = new Set(readdirSync(join(PUBLIC, 'splash')).filter((name) => name.endsWith('.png')));
  const missing = [...files].filter((name) => !linked.has(name));
  const orphan = [...linked].filter((name) => !files.has(name));
  if (missing.length || orphan.length) {
    console.warn('index.html : liens apple-touch-startup-image à mettre à jour (voir la sortie du générateur).');
    if (missing.length) console.warn(`  Fichiers sans lien : ${missing.join(', ')}`);
    if (orphan.length) console.warn(`  Liens sans fichier : ${orphan.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`index.html : ${files.size} écrans de démarrage référencés.`);
  }
}

const monogram = readMonogram();
mkdirSync(join(PUBLIC, 'shortcuts'), { recursive: true });

// Fond transparent des coins arrondis remplacé par ink : carré plein comme les icônes 192 et 512
await writePng(monogram.svg, join(PUBLIC, 'pwa-64x64.png'), { size: 64, flatten: INK });

const icoSizes = [16, 32, 48];
const icoImages = await Promise.all(
  icoSizes.map(async (size) => ({
    size,
    data: await sharp(Buffer.from(monogram.svg), { density: 288 }).resize(size, size).png(PNG).toBuffer(),
  })),
);
writeFileSync(join(PUBLIC, 'favicon.ico'), encodeIco(icoImages));
console.log(`Créé : ${join(PUBLIC, 'favicon.ico')} (${icoSizes.join(', ')} px)`);

await writePng(badgeSvg(monogram), join(PUBLIC, 'badge-96.png'), { size: 96 });

const shortcuts = { explorer: layoutGridIcon, reservations: receiptTextIcon, panier: shoppingBagIcon };
for (const [name, node] of Object.entries(shortcuts)) {
  await writePng(shortcutSvg(node), join(PUBLIC, 'shortcuts', `${name}-96.png`), { size: 96 });
}

if (existsSync(join(PUBLIC, 'splash'))) checkSplashLinks();
