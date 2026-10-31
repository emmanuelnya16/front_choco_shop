import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fireEvent, render } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import { SmartImage } from '@/components/ui/SmartImage';
import { ProductSeo } from '@/features/catalog/product/ProductSeo';
import { env } from '@/lib/env';
import {
  canonicalFor,
  DEFAULT_DESCRIPTION,
  DEFAULT_SITE_URL,
  DEFAULT_TITLE,
  isNoindexPath,
  normalizeDescription,
  resolveSeo,
  siteOrigin,
} from '@/lib/seo/seo';
import { useSeo } from '@/lib/seo/useSeo';
import { cloudinaryResponsive } from '@/lib/utils/cloudinary';
import { useDocumentTitle } from '@/lib/utils/useDocumentTitle';
import { mockProducts } from '@/mocks/fixtures/products';

/** M7 §7 : référencement (titre, description, adresse canonique, noindex) et contrôle du poids. */

const ORIGIN = 'https://drchoco.com';
const head = () => document.head;
const metaContent = (name: string) => head().querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? null;
const canonicalHref = () => head().querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;

afterEach(() => {
  document.head.innerHTML = '';
  document.title = '';
});

describe('M7 · Référencement · canonicalFor', () => {
  it('retire les paramètres de filtre et l’ancre', () => {
    expect(canonicalFor('/explorer/vetements?sub=t-shirts&price=0-15000&sort=price-asc#grille', ORIGIN)).toBe(
      `${ORIGIN}/explorer/vetements`,
    );
    expect(canonicalFor('/explorer?q=hoodie', ORIGIN)).toBe(`${ORIGIN}/explorer`);
    expect(canonicalFor('/produit/hoodie-noir?taille=L&couleur=noir', ORIGIN)).toBe(`${ORIGIN}/produit/hoodie-noir`);
  });

  it('ramène /categorie/x à /explorer/x (même page sous deux adresses)', () => {
    expect(canonicalFor('/categorie/babouches?sub=cuir-lisse', ORIGIN)).toBe(`${ORIGIN}/explorer/babouches`);
    expect(canonicalFor('/categorie', ORIGIN)).toBe(`${ORIGIN}/explorer`);
  });

  it('normalise le chemin : « / » final, « // », majuscules, adresse complète', () => {
    expect(canonicalFor('/', ORIGIN)).toBe(`${ORIGIN}/`);
    expect(canonicalFor('', ORIGIN)).toBe(`${ORIGIN}/`);
    expect(canonicalFor('/Explorer/Chaussures/', ORIGIN)).toBe(`${ORIGIN}/explorer/chaussures`);
    expect(canonicalFor('//aide//comment-reserver', ORIGIN)).toBe(`${ORIGIN}/aide/comment-reserver`);
    expect(canonicalFor('http://localhost:3000/pages/confidentialite?x=1', ORIGIN)).toBe(
      `${ORIGIN}/pages/confidentialite`,
    );
    expect(canonicalFor('/aide', `${ORIGIN}/`)).toBe(`${ORIGIN}/aide`);
  });

  it('prend l’origine de VITE_SITE_URL, sinon celle de la page', () => {
    expect(siteOrigin('https://drchoco.com/boutique/')).toBe(ORIGIN);
    expect(siteOrigin('ftp://drchoco.com')).toBe(window.location.origin);
    expect(siteOrigin('pas une adresse')).toBe(window.location.origin);
    expect(siteOrigin(undefined)).toBe(window.location.origin);
    expect(DEFAULT_SITE_URL).toBe(ORIGIN);
    // Par défaut (VITE_SITE_URL absent des tests), l'origine de la page affichée
    expect(canonicalFor('/explorer')).toBe(`${window.location.origin}/explorer`);
  });
});

describe('M7 · Référencement · pages privées', () => {
  it.each([
    '/reservation',
    '/reservation/RES-000124/paiement',
    '/reservation/RES-000124/preuve',
    '/reservation/RES-000124/merci',
    '/reservations',
    '/reservations/RES-000124',
    '/profil',
    '/profil/adresses',
    '/profil/informations',
    '/panier',
    '/panier/',
    '/_dev',
    '/Reservations/RES-000124?onglet=suivi',
  ])('%s n’est jamais indexée', (path) => {
    expect(isNoindexPath(path)).toBe(true);
    const tags = resolveSeo({ title: 'Page' }, path, ORIGIN);
    expect(tags.robots).toBe('noindex');
    expect(tags.canonical).toBeNull();
  });

  it.each(['/', '/explorer', '/explorer/babouches', '/produit/hoodie-noir', '/aide', '/aide/comment-reserver', '/pages/mentions-legales', '/reservationsx', '/profile-x'])(
    '%s reste indexable',
    (path) => {
      expect(isNoindexPath(path)).toBe(false);
      const tags = resolveSeo({ title: 'Page' }, path, ORIGIN);
      expect(tags.robots).toBeNull();
      expect(tags.canonical).toBe(canonicalFor(path, ORIGIN));
    },
  );

  it('accepte une consigne explicite (page introuvable, fiche toujours indexable)', () => {
    expect(resolveSeo({ title: 'Page introuvable', noindex: true }, '/nimporte-quoi', ORIGIN).robots).toBe('noindex');
    expect(resolveSeo({ title: 'Panier', noindex: false }, '/panier', ORIGIN).robots).toBeNull();
    expect(resolveSeo({ title: 'X', canonicalPath: '/produit/x' }, '/produit/x/', ORIGIN).canonical).toBe(
      `${ORIGIN}/produit/x`,
    );
  });
});

describe('M7 · Référencement · titre et description', () => {
  const parsed = new DOMParser().parseFromString(indexHtml, 'text/html');
  const htmlMeta = (selector: string) => parsed.head.querySelector(selector)?.getAttribute('content');

  it('index.html porte le titre et la description de la boutique (identiques au code)', () => {
    expect(parsed.title).toBe(DEFAULT_TITLE);
    expect(htmlMeta('meta[name="description"]')).toBe(DEFAULT_DESCRIPTION);
    expect(htmlMeta('meta[property="og:description"]')).toBe(DEFAULT_DESCRIPTION);
    expect(htmlMeta('meta[property="og:title"]')).toBe(DEFAULT_TITLE);
    expect(htmlMeta('meta[name="theme-color"]')).toBeTruthy();
    // Pas d'adresse canonique commune à toutes les pages
    expect(parsed.head.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it('la description par défaut tient dans un résultat de recherche', () => {
    expect(DEFAULT_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(normalizeDescription(undefined)).toBe(DEFAULT_DESCRIPTION);
    expect(normalizeDescription('   ')).toBe(DEFAULT_DESCRIPTION);
    const long = normalizeDescription(`${'Babouche en cuir cousue main. '.repeat(10)}`);
    expect(long.length).toBeLessThanOrEqual(160);
    expect(long.endsWith('…')).toBe(true);
    expect(normalizeDescription('Hoodie\n  noir,   coton épais.')).toBe('Hoodie noir, coton épais.');
  });
});

function TitleProbe({ title, description }: { title: string; description?: string }) {
  useDocumentTitle(title, description ? { description } : undefined);
  return null;
}

function SeoProbe(props: Parameters<typeof useSeo>[0]) {
  useSeo(props);
  return null;
}

const inRouter = (path: string, node: ReactNode) =>
  createElement(MemoryRouter, { initialEntries: [path] }, node);

describe('M7 · Référencement · useDocumentTitle et useSeo', () => {
  it('reste compatible avec les appels existants et ajoute « noindex » sur une page privée', () => {
    const { unmount } = render(inRouter('/reservations/RES-000124', createElement(TitleProbe, { title: 'Réservation RES-000124' })));
    expect(document.title).toBe('Réservation RES-000124 · DR Choco');
    expect(metaContent('robots')).toBe('noindex');
    expect(canonicalHref()).toBeNull();
    expect(metaContent('description')).toBe(DEFAULT_DESCRIPTION);

    // En quittant la page, rien ne reste pour la suivante
    unmount();
    expect(metaContent('robots')).toBeNull();
  });

  it('écrit une adresse canonique sans filtres et la description de la page', () => {
    render(
      inRouter(
        '/explorer/vetements?sub=hoodies&sort=price-asc',
        createElement(TitleProbe, { title: 'Vêtements', description: 'Hoodies, t-shirts et pantalons pour hommes.' }),
      ),
    );
    expect(document.title).toBe('Vêtements · DR Choco');
    expect(canonicalHref()).toBe(`${window.location.origin}/explorer/vetements`);
    expect(metaContent('robots')).toBeNull();
    expect(metaContent('description')).toBe('Hoodies, t-shirts et pantalons pour hommes.');
  });

  it('fonctionne hors routeur (chemin de la barre d’adresse) et accepte un titre vide', () => {
    render(createElement(SeoProbe, { title: '' }));
    expect(document.title).toBe(DEFAULT_TITLE);
    expect(canonicalHref()).toBe(canonicalFor(window.location.pathname));
  });
});

describe('M7 · Référencement · fiche produit', () => {
  it('adresse canonique sans paramètres, données structurées, balises retirées en quittant', () => {
    const product = mockProducts[0];
    const { unmount } = render(
      inRouter(`/produit/${product.slug}?taille=L#avis`, createElement(ProductSeo, { product })),
    );
    const expected = `${window.location.origin}/produit/${product.slug}`;
    expect(canonicalHref()).toBe(expected);
    expect(head().querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(expected);
    expect(metaContent('robots')).toBeNull();
    expect(document.title).toContain(product.name);
    const jsonLd = JSON.parse(head().querySelector('#product-jsonld-schema')?.textContent ?? '{}');
    expect(jsonLd['@type']).toBe('Product');
    expect(jsonLd.offers.url).toBe(expected);

    unmount();
    expect(head().querySelector('#product-jsonld-schema')).toBeNull();
    expect(head().querySelector('meta[property="og:url"]')).toBeNull();
    expect(canonicalHref()).toBeNull();
    expect(metaContent('description')).toBe(DEFAULT_DESCRIPTION);
  });
});

describe('M7 · Images', () => {
  it('une photo Cloudinary est servie en plusieurs largeurs, jamais telle quelle', () => {
    const set = cloudinaryResponsive('https://res.cloudinary.com/drchoco/image/upload/v1730000000/products/hoodie.jpg');
    expect(set?.src).toBe('https://res.cloudinary.com/drchoco/image/upload/f_auto,q_auto,c_limit,w_640/v1730000000/products/hoodie.jpg');
    expect(set?.srcSet.split(', ')).toHaveLength(5);
    expect(set?.srcSet).toContain('/f_auto,q_auto,c_limit,w_320/v1730000000/products/hoodie.jpg 320w');

    expect(cloudinaryResponsive('products/hoodie-noir', [480])?.srcSet).toBe(
      `https://res.cloudinary.com/${env.cloudinaryCloudName}/image/upload/f_auto,q_auto,c_limit,w_480/products/hoodie-noir 480w`,
    );
    // Fichier local, adresse déjà transformée ou signée : laissée telle quelle
    expect(cloudinaryResponsive('/images/hero/hero-mobile.webp')).toBeNull();
    expect(cloudinaryResponsive('https://res.cloudinary.com/drchoco/image/upload/f_auto,q_auto,w_600/products/x.jpg')).toBeNull();
    expect(cloudinaryResponsive('https://res.cloudinary.com/drchoco/image/upload/s--Ab12Cd34--/v1/packages/x.jpg')).toBeNull();
    expect(cloudinaryResponsive('https://res.cloudinary.com/drchoco/image/private/s--Ab12Cd34--/proofs/x.jpg')).toBeNull();
  });

  it('image prioritaire : une seule téléchargée selon l’écran, en priorité haute', () => {
    const { container } = render(
      createElement(SmartImage, {
        src: '/images/hero/hero-mobile.webp',
        sources: [{ media: '(min-width: 64rem)', srcSet: '/images/hero/hero-desktop.webp', type: 'image/webp' }],
        fallback: '/images/fallback/mood-hero.svg',
        alt: '',
        priority: true,
        sizes: '100vw',
      }),
    );
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0].getAttribute('fetchpriority')).toBe('high');
    expect(imgs[0].getAttribute('loading')).toBe('eager');
    expect(imgs[0].getAttribute('decoding')).toBe('async');
    expect(container.querySelector('picture source')?.getAttribute('media')).toBe('(min-width: 64rem)');

    // Photo absente : visuel de repli, sans les variantes
    fireEvent.error(imgs[0]);
    expect(container.querySelector('picture')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/images/fallback/mood-hero.svg');
  });

  it('photo Cloudinary : srcset ajouté automatiquement, chargement différé hors écran', () => {
    const { container } = render(
      createElement(SmartImage, {
        src: 'https://res.cloudinary.com/drchoco/image/upload/v1/products/tee.jpg',
        alt: 'T-shirt',
        sizes: '48vw',
      }),
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('srcset')).toContain('w_320/v1/products/tee.jpg 320w');
    expect(img?.getAttribute('loading')).toBe('lazy');
  });
});

describe('M7 · Plan du site et consignes aux robots', () => {
  const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

  it('robots.txt exclut les pages privées et déclare le plan du site', () => {
    const robots = read('public/robots.txt');
    for (const path of ['/admin', '/reservation', '/reservations', '/profil', '/panier', '/_dev']) {
      expect(robots).toMatch(new RegExp(`^Disallow: ${path}$`, 'm'));
    }
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).toMatch(/^Sitemap: https:\/\/drchoco\.com\/sitemap\.xml$/m);
    expect(robots).toContain('HYPOTHÈSE');
  });

  it('sitemap.xml liste les pages fixes, toutes indexables', () => {
    const doc = new DOMParser().parseFromString(read('public/sitemap.xml'), 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    const locs = [...doc.getElementsByTagName('loc')].map((el) => el.textContent ?? '');
    const paths = locs.map((loc) => new URL(loc).pathname);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/',
        '/explorer',
        '/explorer/vetements',
        '/explorer/chaussures',
        '/explorer/babouches',
        '/aide',
        '/aide/comment-reserver',
        '/aide/paiement-mobile-money',
        '/aide/livraison-retrait',
        '/aide/suivre-ma-reservation',
        '/pages/conditions-generales',
        '/pages/annulation-retours',
        '/pages/confidentialite',
        '/pages/mentions-legales',
      ]),
    );
    expect(new Set(locs).size).toBe(locs.length);
    for (const loc of locs) {
      expect(loc.startsWith(`${DEFAULT_SITE_URL}/`)).toBe(true);
      expect(canonicalFor(loc, DEFAULT_SITE_URL)).toBe(loc);
      expect(isNoindexPath(loc)).toBe(false);
    }
  });
});

describe('M7 · Contrôle du poids (scripts/check-size.mjs)', () => {
  // Dossier de travail sous node_modules/.cache (jamais versionné), supprimé à la fin
  const cacheDir = resolve(process.cwd(), 'node_modules/.cache');
  mkdirSync(cacheDir, { recursive: true });
  const root = mkdtempSync(join(cacheDir, 'check-size-test-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  /** Contenu incompressible : sa taille gzip est connue à quelques octets près. */
  const noise = (bytes: number) => randomBytes(bytes);

  function makeDist(name: string, files: Record<string, Buffer | string>, html: string): string {
    const dir = join(root, name);
    for (const [file, content] of Object.entries({ ...files, 'index.html': html })) {
      mkdirSync(dirname(join(dir, file)), { recursive: true });
      writeFileSync(join(dir, file), content);
    }
    return dir;
  }

  const startupHtml = (preloads: string[]) =>
    `<!doctype html><html><head><script type="module" crossorigin src="/assets/index-a1.js"></script>${preloads
      .map((file) => `<link rel="modulepreload" crossorigin href="/assets/${file}">`)
      .join('')}<link rel="stylesheet" href="/assets/index.css"></head><body></body></html>`;

  function checkSize(dir: string) {
    const result = spawnSync(process.execPath, [resolve(process.cwd(), 'scripts/check-size.mjs'), dir], {
      encoding: 'utf8',
    });
    return { code: result.status, out: `${result.stdout}${result.stderr}` };
  }

  it('passe sous 180 kB de JavaScript de démarrage', () => {
    const dir = makeDist(
      'sous-budget',
      {
        'assets/index-a1.js': noise(80_000),
        'assets/react-b2.js': noise(70_000),
        // Hors démarrage : ni module ni modulepreload
        'assets/HomePage-c3.js': noise(150_000),
        'assets/index.css': noise(60_000),
      },
      startupHtml(['react-b2.js']),
    );
    const { code, out } = checkSize(dir);
    expect(out).toContain('assets/index-a1.js');
    expect(out).toContain('assets/react-b2.js');
    expect(out).not.toContain('HomePage-c3');
    expect(out).toMatch(/Total\s+15\d\.\d\d kB\s+budget 180 kB : OK/);
    expect(code).toBe(0);
  });

  it('échoue (code 1) au-dessus de 180 kB', () => {
    const dir = makeDist(
      'hors-budget',
      {
        'assets/index-a1.js': noise(80_000),
        'assets/react-b2.js': noise(70_000),
        'assets/vendor-d4.js': noise(40_000),
      },
      startupHtml(['react-b2.js', 'vendor-d4.js']),
    );
    const { code, out } = checkSize(dir);
    expect(out).toMatch(/Total\s+19\d\.\d\d kB\s+budget 180 kB : DÉPASSÉ/);
    expect(out).toContain('ÉCHEC');
    expect(code).toBe(1);
  });

  it('estime chaque page avec le manifeste de build et échoue au-delà de 300 kB', () => {
    const manifest = {
      'index.html': { file: 'assets/index-a1.js', src: 'index.html', isEntry: true, imports: ['_react.js'] },
      '_react.js': { file: 'assets/react-b2.js' },
      '_gallery.js': { file: 'assets/gallery-e5.js' },
      'src/pages/HomePage.tsx': {
        file: 'assets/HomePage-c3.js',
        src: 'src/pages/HomePage.tsx',
        isDynamicEntry: true,
        imports: ['_react.js'],
      },
      'src/pages/ProductPage.tsx': {
        file: 'assets/ProductPage-f6.js',
        src: 'src/pages/ProductPage.tsx',
        isDynamicEntry: true,
        imports: ['_react.js', '_gallery.js'],
        // Chargé plus tard : non compté
        dynamicImports: ['src/features/Lightbox.tsx'],
      },
      'src/features/Lightbox.tsx': { file: 'assets/Lightbox-g7.js', isDynamicEntry: true },
    };
    const dir = makeDist(
      'pages',
      {
        'assets/index-a1.js': noise(60_000),
        'assets/react-b2.js': noise(60_000),
        'assets/HomePage-c3.js': noise(100_000),
        'assets/ProductPage-f6.js': noise(100_000),
        'assets/gallery-e5.js': noise(50_000),
        'assets/Lightbox-g7.js': noise(200_000),
        '.vite/manifest.json': JSON.stringify(manifest),
      },
      startupHtml(['react-b2.js']),
    );
    const { code, out } = checkSize(dir);
    // Démarrage 120 kB + page 100 kB = 220 kB : dans le budget
    expect(out).toMatch(/HomePage\s+100\.\d\d kB\s+220\.\d\d kB\s+\/\s/);
    // Démarrage 120 kB + page 100 kB + galerie 50 kB = 270 kB : dans le budget, la visionneuse non comptée
    expect(out).toMatch(/ProductPage\s+150\.\d\d kB\s+270\.\d\d kB/);
    expect(code).toBe(0);

    writeFileSync(join(dir, 'assets/gallery-e5.js'), noise(90_000));
    const over = checkSize(dir);
    expect(over.out).toMatch(/ÉCHEC\s+Page ProductPage : 310\.\d\d kB/);
    expect(over.code).toBe(1);
  });

  it('signale une image trop lourde pour un téléphone, et un dossier sans build (code 2)', () => {
    const dir = makeDist(
      'images',
      {
        'assets/index-a1.js': noise(10_000),
        'images/hero/hero-mobile.webp': noise(260_000),
        // Capture de la fenêtre d'installation sur ordinateur : jamais servie à un téléphone
        'screenshots/accueil-wide.png': noise(300_000),
      },
      startupHtml([]),
    );
    const { code, out } = checkSize(dir);
    expect(out).toMatch(/ÉCHEC\s+Image images\/hero\/hero-mobile\.webp/);
    expect(out).not.toMatch(/ÉCHEC\s+Image screenshots/);
    expect(code).toBe(1);

    expect(checkSize(join(root, 'absent')).code).toBe(2);
  });
});
