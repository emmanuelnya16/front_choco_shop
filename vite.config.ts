import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync, rmSync } from 'fs';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, loadEnv, type Plugin, type PluginOption } from 'vite';
import { configDefaults } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import { pwaManifest } from './pwa-manifest';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};
// Version unique de l'app (profil, /_dev et service worker) : lue par Vite comme les autres VITE_*
process.env.VITE_APP_VERSION = pkg.version;

/** Nom des morceaux qui ne doivent jamais entrer dans le précache (M6 §4.5). */
function chunkFileName(chunk: { facadeModuleId: string | null; moduleIds: string[] }): string {
  const ids = chunk.facadeModuleId ? [chunk.facadeModuleId] : chunk.moduleIds;
  const all = (re: RegExp) => ids.length > 0 && ids.every((id) => re.test(id.replace(/\\/g, '/')));
  if (all(/\/src\/(pages|features)\/admin\//)) return 'assets/admin-[name]-[hash].js';
  if (all(/\/src\/dev\//)) return 'assets/dev-[name]-[hash].js';
  if (all(/\/src\/mocks\/|\/node_modules\/(msw|@mswjs|@open-draft|headers-polyfill|outvariant|strict-event-emitter|is-node-process|graphql|until-async|rettime|tough-cookie|tldts|type-fest|statuses)\//)) {
    return 'assets/mocks-[name]-[hash].js';
  }
  return 'assets/[name]-[hash].js';
}

/**
 * Police Archivo (M7 §7) : seuls les sous-ensembles latin et latin étendu sont gardés. Le français
 * n'utilise que le latin ; le latin étendu (ɛ, ɔ, ŋ des noms camerounais…) n'est téléchargé que si
 * un tel caractère s'affiche. Le vietnamien, fourni par @fontsource, n'est plus jamais émis.
 */
const ARCHIVO_SUBSETS = ['latin', 'latin-ext'];

function archivoSubsetsOnly(): Plugin {
  return {
    name: 'drchoco:archivo-subsets',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]@fontsource-variable[\\/]archivo[\\/][^?]*\.css(?:\?|$)/.test(id)) return null;
      return {
        code: code.replace(/(?:\/\*[^*]*\*\/\s*)?@font-face\s*\{[^}]*\}\s*/g, (block) => {
          const subset = /archivo-([a-z-]+?)-(?:wdth|wght|standard)-/.exec(block)?.[1];
          return subset && !ARCHIVO_SUBSETS.includes(subset) ? '' : block;
        }),
        map: null,
      };
    },
  };
}

/** Fichier principal de la police : latin, axes graisse et largeur, style droit. */
const MAIN_FONT_FILE = /(?:^|\/)archivo-latin-wdth-normal-[\w-]+\.woff2$/;

/**
 * Préchargement de la police principale (M7 §7) : `<link rel="preload" as="font">` avec le nom
 * haché du build, pour que le texte s'affiche dans la bonne police dès le premier rendu.
 * Le même fichier est précaché par le service worker (globPatterns ci-dessous).
 */
function preloadMainFont(): Plugin {
  let base = '/';
  let warn: (message: string) => void = () => undefined;
  return {
    name: 'drchoco:preload-main-font',
    apply: 'build',
    configResolved(config) {
      base = config.base;
      warn = (message) => config.logger.warn(message);
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const font = Object.keys(ctx.bundle ?? {}).find((fileName) => MAIN_FONT_FILE.test(fileName));
        if (!font) {
          warn('[drchoco:preload-main-font] police Archivo latine introuvable dans le build : pas de préchargement.');
          return undefined;
        }
        return [
          {
            tag: 'link',
            attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `${base}${font}`, crossorigin: true },
            injectTo: 'head',
          },
        ];
      },
    },
  };
}

/**
 * Modules du serveur de démonstration et d'AI Studio (M7 §7) : utiles au poste de développement,
 * jamais dans l'application envoyée au téléphone. Un import depuis le code client fait échouer le build.
 */
const SERVER_ONLY_PACKAGES = /^(?:@google\/genai|express|dotenv|tsx)(?:\/|$)/;

function forbidServerModules(): Plugin {
  // Dossier server/ du projet (à côté de ce fichier), quel que soit le dossier racine du build
  const serverDir = `${path.resolve(import.meta.dirname, 'server').replace(/\\/g, '/')}/`;
  return {
    name: 'drchoco:forbid-server-modules',
    apply: 'build',
    enforce: 'pre',
    resolveId(source, importer) {
      if (importer && SERVER_ONLY_PACKAGES.test(source)) {
        this.error(`« ${source} » est réservé au serveur ou à AI Studio : interdit dans l'application (importé par ${importer}).`);
      }
      return null;
    },
    load(id) {
      if (id.replace(/\\/g, '/').startsWith(serverDir)) {
        this.error(`${id} appartient au serveur de démonstration : interdit dans l'application.`);
      }
      return null;
    },
  };
}

/**
 * Fichiers de public/ qui servent de source mais ne doivent pas être mis en ligne (M7 §7) :
 * le logo original (178 Ko, décliné en icônes par `npm run icons`) et la notice des photos.
 * Ils restent dans public/ ; seule la copie du build est retirée.
 */
const SOURCE_ONLY_PUBLIC_FILES = ['images/logo_choco.jpg', 'images/README.md'];

function stripSourceOnlyPublicFiles(): Plugin {
  let outDir = 'dist';
  return {
    name: 'drchoco:strip-source-only-public-files',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    writeBundle: {
      order: 'post',
      handler() {
        for (const file of SOURCE_ONLY_PUBLIC_FILES) rmSync(path.join(outDir, file), { force: true });
      },
    },
  };
}

export default defineConfig(({ mode, command }) => {
  // `vite build --mode analyze` fonctionne sous Windows comme sous Linux (pas de variable en ligne).
  const isAnalyze = mode === 'analyze' || process.env.ANALYZE === 'true';
  const fileEnv = loadEnv(mode, process.cwd(), 'VITE_');
  const pwaFlag = (fileEnv.VITE_PWA_ENABLED ?? '').trim().toLowerCase();
  // HYPOTHÈSE: VITE_PWA_ENABLED absent = vrai pour un build de production, faux en développement (M6 §3.2)
  const pwaEnabled = pwaFlag ? pwaFlag === 'true' || pwaFlag === '1' : command === 'build';

  const plugins: PluginOption[] = [
    forbidServerModules(),
    archivoSubsetsOnly(),
    preloadMainFont(),
    stripSourceOnlyPublicFiles(),
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      // Enregistrement fait à la main dans src/pwa/registerSW.ts (workbox-window)
      injectRegister: false,
      // Jamais pendant les tests, ni en développement avec MSW (un seul service worker par portée)
      disable: !pwaEnabled || mode === 'test',
      devOptions: { enabled: false },
      manifestFilename: 'manifest.webmanifest',
      manifest: pwaManifest,
      includeManifestIcons: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,woff2,svg}', 'assets/logo-choco-*.webp', 'pwa-192x192.png', 'badge-96.png'],
        globIgnores: [
          '**/*.map',
          '**/stats.html',
          'mockServiceWorker.js',
          'assets/mocks-*',
          'assets/dev-*',
          'assets/admin-*',
          // Polices rarement utilisées : chargées à la demande puis gardées (cache « fonts »).
          // La police latine, préchargée par index.html, est précachée. Le vietnamien n'est plus émis
          // (archivoSubsetsOnly) : la règle reste en garde-fou.
          'assets/*latin-ext*.woff2',
          'assets/*vietnamese*.woff2',
          // Médias privés de démonstration (preuves et photos de colis) : jamais enregistrés
          'mock/colis-*',
          'mock/preuve-*',
          // Captures du manifeste et écrans de démarrage iPhone : utiles une seule fois
          'screenshots/**',
          'splash/**',
          'brand/**',
          // Icônes lues par le système à l'installation, jamais par l'app hors connexion
          // (seules pwa-192x192.png et badge-96.png, utilisées par les notifications, sont précachées)
          'shortcuts/**',
          'pwa-64x64.png',
          'pwa-512x512.png',
          'maskable-icon-*.png',
          'apple-touch-icon-*.png',
          'favicon.ico',
        ],
        maximumFileSizeToCacheInBytes: 600 * 1024,
        sourcemap: false,
      },
    }) as PluginOption,
  ];
  if (isAnalyze) {
    plugins.push(
      visualizer({
        filename: 'stats.html',
        gzipSize: true,
        brotliSize: true,
        open: false,
      }) as PluginOption,
    );
  }

  return {
    plugins,
    // Dossier de cache du serveur de développement, isolable pour lancer plusieurs serveurs en parallèle
    cacheDir: process.env.VITE_CACHE_DIR ?? 'node_modules/.vite',
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      port: 3000,
      host: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      port: 4173,
      host: true,
    },
    build: {
      target: 'es2020',
      sourcemap: true,
      // .vite/manifest.json : lu par scripts/check-size.mjs pour le poids de chaque page (M7 §7).
      // Fichier caché : jamais précaché, et refusé par public/.htaccess comme tout fichier en « . ».
      manifest: true,
      rolldownOptions: {
        output: {
          chunkFileNames: chunkFileName,
          codeSplitting: {
            groups: [
              // React d'abord : sinon le groupe gsap l'emporte avec @gsap/react et le précharge au démarrage
              { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 3 },
              { name: 'gsap', test: /[\\/]node_modules[\\/](gsap|@gsap)[\\/]/, priority: 2 },
            ],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      globals: true,
      // Tests d'intégration qui rendent des pages entières (routes chargées à la demande, mocks MSW) :
      // 5 s ne suffisent pas toujours quand 13 fichiers tournent en parallèle sur un poste chargé.
      testTimeout: 15_000,
      // Copies de travail des agents (git worktree) rangées dans .claude/ : jamais testées ici
      exclude: [...configDefaults.exclude, '.claude/**'],
    },
  };
});
