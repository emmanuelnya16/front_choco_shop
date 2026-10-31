// Contrôle du poids du build (M7 §7), lancé par `npm run check:size` après un build.
//
//   node scripts/check-size.mjs [dossier-de-build]        (défaut : dist)
//   options : --initial-budget=180  --page-budget=300  --image-budget=250  (en kB)
//
// 1. JavaScript de démarrage : scripts « module » et « modulepreload » de index.html, compressés en
//    gzip (zlib, niveau 9). Budget : 180 kB.
// 2. JavaScript par page : démarrage + morceau de la page chargée à la demande par le routeur et tous
//    ses imports statiques, d'après le manifeste de build (.vite/manifest.json, `build.manifest` dans
//    vite.config.ts). Budget : 300 kB par page. Sans manifeste, ce contrôle est sauté.
// 3. Images : aucune image de plus de 250 kB servie à un téléphone.
//
// Unité : 1 kB = 1000 octets, comme dans le compte rendu de Vite.
// Code de sortie : 0 si tout est dans le budget, 1 si un budget est dépassé, 2 si le dossier est
// illisible (pas de index.html, fichier référencé absent).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

export const KB = 1000;

export const DEFAULT_BUDGETS = Object.freeze({ initialKb: 180, pageKb: 300, imageKb: 250 });

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|avif|gif|svg|ico)$/i;

// HYPOTHÈSE: les captures « wide » du manifeste ne sont affichées que par la fenêtre d'installation
// d'un ordinateur (form_factor: wide), jamais sur un téléphone.
const IMAGES_NOT_FOR_PHONES = [/^screenshots\/[^/]+-wide\.[a-z]+$/i];

// Pages du routeur (src/app/router.tsx), pour un tableau lisible
const PAGE_ROUTES = {
  HomePage: '/',
  ExplorePage: '/explorer, /explorer/:categorie',
  ProductPage: '/produit/:slug',
  SearchPage: '/recherche',
  FavoritesPage: '/favoris',
  CartPage: '/panier',
  CheckoutPage: '/reservation',
  PaymentPage: '/reservation/:ref/paiement',
  ProofPage: '/reservation/:ref/preuve',
  SuccessPage: '/reservation/:ref/merci',
  ReservationsPage: '/reservations',
  ReservationDetailPage: '/reservations/:ref',
  ProfilePage: '/profil',
  ProfileAddressesPage: '/profil/adresses',
  ProfileInformationsPage: '/profil/informations',
  HelpCenterPage: '/aide',
  ContentPage: '/aide/:slug, /pages/:slug',
  LegalPage: '/pages/:slug',
  OfflinePage: '/hors-ligne',
  NotFoundPage: '(page introuvable)',
  DevPage: '/_dev',
};

/** Taille gzip (niveau 9) d'un contenu, en octets. */
export function gzipSize(buffer) {
  return gzipSync(buffer, { level: 9 }).length;
}

function attr(tag, name) {
  const match = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return match ? (match[2] ?? match[3] ?? match[4] ?? '') : null;
}

/** Scripts de démarrage lus dans index.html : `<script type="module" src>` et `<link rel="modulepreload">`. */
export function startupScriptUrls(html) {
  const urls = [];
  for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) {
    const src = attr(tag, 'src');
    if (src && (attr(tag, 'type') ?? '').toLowerCase() === 'module') urls.push(src);
  }
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = (attr(tag, 'rel') ?? '').toLowerCase().split(/\s+/);
    const href = attr(tag, 'href');
    if (href && rel.includes('modulepreload')) urls.push(href);
  }
  return [...new Set(urls)];
}

/** Fichier du build correspondant à une adresse de index.html (« /assets/x.js », « ./assets/x.js »). */
function fileForUrl(distDir, url) {
  if (/^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith('//')) return null;
  const path = decodeURIComponent(url.split(/[?#]/)[0]).replace(/^\.?\/+/, '');
  const candidates = [path, join('assets', basename(path))];
  for (const candidate of candidates) {
    const file = join(distDir, candidate);
    if (existsSync(file) && statSync(file).isFile()) return candidate.replace(/\\/g, '/');
  }
  return null;
}

function walk(dir, root = dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, root, out);
    else if (entry.isFile()) out.push(relative(root, full).replace(/\\/g, '/'));
  }
  return out;
}

function readManifest(distDir) {
  for (const candidate of ['.vite/manifest.json', 'manifest.json']) {
    const file = join(distDir, candidate);
    if (!existsSync(file)) continue;
    try {
      const manifest = JSON.parse(readFileSync(file, 'utf8'));
      // Manifeste de Vite (pas celui de l'application installable, manifest.webmanifest)
      if (manifest && typeof manifest === 'object' && Object.values(manifest).some((v) => v && v.file)) {
        return { manifest, file: candidate };
      }
    } catch {
      // Manifeste illisible : estimation par page sautée
    }
  }
  return null;
}

/** Pages chargées à la demande par le routeur : src/pages/*.tsx et src/dev/DevPage.tsx. */
function pageEntries(manifest) {
  return Object.entries(manifest)
    .filter(([key, chunk]) => {
      const src = (chunk.src ?? key).replace(/\\/g, '/');
      return chunk.isDynamicEntry && chunk.file?.endsWith('.js') && /^src\/(pages|dev)\/[^/]+\.[jt]sx?$/.test(src);
    })
    .map(([key, chunk]) => {
      const src = (chunk.src ?? key).replace(/\\/g, '/');
      const name = basename(src).replace(/\.[jt]sx?$/, '');
      return { key, name, src, isDev: src.startsWith('src/dev/') || name.startsWith('_') };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Fichiers JavaScript d'un morceau et de ses imports statiques (sans les imports dynamiques). */
function staticClosure(manifest, key, seen = new Set()) {
  const chunk = manifest[key];
  if (!chunk || seen.has(key)) return seen;
  seen.add(key);
  for (const dep of chunk.imports ?? []) staticClosure(manifest, dep, seen);
  return seen;
}

/**
 * Mesure un dossier de build. Ne lève pas d'erreur pour un budget dépassé : voir `failures`.
 * @param {string} distDir
 * @param {{ initialKb?: number, pageKb?: number, imageKb?: number }} [budgets]
 */
export function measureBuild(distDir, budgets = {}) {
  const limits = { ...DEFAULT_BUDGETS, ...budgets };
  const dir = resolve(distDir);
  const errors = [];
  const failures = [];
  const indexFile = join(dir, 'index.html');
  if (!existsSync(indexFile)) {
    return { dir, limits, errors: [`index.html introuvable dans ${dir} (lancez d'abord un build).`], failures };
  }

  const sizes = new Map();
  const sizeOf = (file) => {
    if (!sizes.has(file)) {
      const buffer = readFileSync(join(dir, file));
      sizes.set(file, { file, raw: buffer.length, gzip: gzipSize(buffer) });
    }
    return sizes.get(file);
  };

  // 1. Démarrage
  const html = readFileSync(indexFile, 'utf8');
  const initialFiles = [];
  for (const url of startupScriptUrls(html)) {
    const file = fileForUrl(dir, url);
    if (file) initialFiles.push(file);
    else if (!/^[a-z][a-z\d+.-]*:|^\/\//i.test(url)) errors.push(`Script de démarrage introuvable : ${url}`);
  }
  const initial = initialFiles.map(sizeOf).sort((a, b) => b.gzip - a.gzip);
  const initialGzip = initial.reduce((sum, f) => sum + f.gzip, 0);
  if (initialGzip > limits.initialKb * KB) {
    failures.push(
      `JavaScript de démarrage : ${formatKb(initialGzip)} gzip, au-delà du budget de ${limits.initialKb} kB.`,
    );
  }

  // 2. Pages
  const found = readManifest(dir);
  const pages = [];
  if (found) {
    const initialSet = new Set(initialFiles);
    for (const page of pageEntries(found.manifest)) {
      const files = [...staticClosure(found.manifest, page.key)]
        .map((key) => found.manifest[key]?.file)
        .filter((file) => file && file.endsWith('.js') && existsSync(join(dir, file)));
      const own = [...new Set(files)].filter((file) => !initialSet.has(file));
      const ownGzip = own.reduce((sum, file) => sum + sizeOf(file).gzip, 0);
      const total = initialGzip + ownGzip;
      const overBudget = !page.isDev && total > limits.pageKb * KB;
      pages.push({ ...page, route: PAGE_ROUTES[page.name] ?? '', files: own, ownGzip, total, overBudget });
      if (overBudget) {
        failures.push(
          `Page ${page.name} : ${formatKb(total)} gzip (démarrage compris), au-delà du budget de ${limits.pageKb} kB.`,
        );
      }
    }
  }

  // 3. Images
  const images = walk(dir)
    .filter((file) => IMAGE_EXTENSIONS.test(file))
    .map((file) => ({ file, raw: statSync(join(dir, file)).size }))
    .filter((image) => image.raw > limits.imageKb * KB)
    .map((image) => ({ ...image, phone: !IMAGES_NOT_FOR_PHONES.some((re) => re.test(image.file)) }))
    .sort((a, b) => b.raw - a.raw);
  for (const image of images.filter((i) => i.phone)) {
    failures.push(`Image ${image.file} : ${formatKb(image.raw)}, au-delà de ${limits.imageKb} kB pour un téléphone.`);
  }

  return {
    dir,
    limits,
    errors,
    failures,
    initial,
    initialGzip,
    manifestFile: found?.file ?? null,
    pages,
    images,
  };
}

export function formatKb(bytes) {
  return `${(bytes / KB).toFixed(2)} kB`;
}

function pad(value, width, alignRight = false) {
  const text = String(value);
  if (text.length >= width) return text;
  return alignRight ? text.padStart(width) : text.padEnd(width);
}

/** Compte rendu lisible d'une mesure. */
export function formatReport(result) {
  const lines = [];
  lines.push(`Poids du build : ${result.dir}`);
  lines.push('Tailles gzip (zlib niveau 9), 1 kB = 1000 octets.');
  if (result.errors.length > 0 && !result.initial) {
    lines.push('', ...result.errors.map((e) => `ERREUR  ${e}`));
    return lines.join('\n');
  }

  const nameWidth = Math.max(40, ...result.initial.map((f) => f.file.length + 2));
  lines.push('', `1. JavaScript de démarrage (index.html : module + modulepreload), ${result.initial.length} fichiers`);
  lines.push(`   ${pad('Fichier', nameWidth)}${pad('brut', 12, true)}${pad('gzip', 12, true)}`);
  for (const f of result.initial) {
    lines.push(`   ${pad(f.file, nameWidth)}${pad(formatKb(f.raw), 12, true)}${pad(formatKb(f.gzip), 12, true)}`);
  }
  const initialOk = result.initialGzip <= result.limits.initialKb * KB;
  lines.push(
    `   ${pad('Total', nameWidth)}${pad('', 12)}${pad(formatKb(result.initialGzip), 12, true)}` +
      `   budget ${result.limits.initialKb} kB : ${initialOk ? 'OK' : 'DÉPASSÉ'}`,
  );

  lines.push('', '2. JavaScript par page (démarrage + morceau de la page et ses imports statiques)');
  if (!result.manifestFile) {
    lines.push('   Estimation sautée : manifeste de build absent (build.manifest dans vite.config.ts).');
  } else if (result.pages.length === 0) {
    lines.push(`   Aucune page trouvée dans ${result.manifestFile}.`);
  } else {
    const pageWidth = Math.max(26, ...result.pages.map((p) => p.name.length + 2));
    lines.push(`   ${pad('Page', pageWidth)}${pad('propre', 12, true)}${pad('total', 12, true)}   adresse`);
    for (const p of [...result.pages].sort((a, b) => b.total - a.total)) {
      const flag = p.isDev ? ' (hors budget)' : p.overBudget ? '  DÉPASSÉ' : '';
      lines.push(
        `   ${pad(p.name, pageWidth)}${pad(formatKb(p.ownGzip), 12, true)}${pad(formatKb(p.total), 12, true)}` +
          `   ${p.route}${flag}`,
      );
    }
    lines.push(`   Budget par page : ${result.limits.pageKb} kB. Les éléments ouverts plus tard (fenêtres, visionneuse…) ne sont pas comptés.`);
  }

  lines.push('', `3. Images de plus de ${result.limits.imageKb} kB`);
  if (result.images.length === 0) {
    lines.push('   Aucune.');
  } else {
    for (const image of result.images) {
      lines.push(`   ${pad(image.file, 48)}${pad(formatKb(image.raw), 12, true)}   ${image.phone ? 'DÉPASSÉ' : 'jamais servie à un téléphone'}`);
    }
  }

  lines.push('');
  if (result.errors.length > 0) lines.push(...result.errors.map((e) => `ERREUR  ${e}`));
  if (result.failures.length > 0) lines.push(...result.failures.map((f) => `ÉCHEC  ${f}`));
  if (result.errors.length === 0 && result.failures.length === 0) lines.push('Tous les budgets sont respectés.');
  return lines.join('\n');
}

function parseArgs(argv) {
  const budgets = {};
  let distDir = 'dist';
  for (const arg of argv) {
    const match = /^--(initial|page|image)-budget=(\d+(?:\.\d+)?)$/.exec(arg);
    if (match) budgets[`${match[1]}Kb`] = Number(match[2]);
    else if (!arg.startsWith('--')) distDir = arg;
    else throw new Error(`Option inconnue : ${arg}`);
  }
  return { distDir, budgets };
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 2;
  }
  const result = measureBuild(args.distDir, args.budgets);
  process.stdout.write(`${formatReport(result)}\n`);
  if (result.errors.length > 0) return 2;
  return result.failures.length > 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main();
}
