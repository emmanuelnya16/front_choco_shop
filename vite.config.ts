import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, loadEnv, type PluginOption } from 'vite';
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

export default defineConfig(({ mode, command }) => {
  // `vite build --mode analyze` fonctionne sous Windows comme sous Linux (pas de variable en ligne).
  const isAnalyze = mode === 'analyze' || process.env.ANALYZE === 'true';
  const fileEnv = loadEnv(mode, process.cwd(), 'VITE_');
  const pwaFlag = (fileEnv.VITE_PWA_ENABLED ?? '').trim().toLowerCase();
  // HYPOTHÈSE: VITE_PWA_ENABLED absent = vrai pour un build de production, faux en développement (M6 §3.2)
  const pwaEnabled = pwaFlag ? pwaFlag === 'true' || pwaFlag === '1' : command === 'build';

  const plugins: PluginOption[] = [
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
        globPatterns: ['**/*.{js,css,html,woff2,svg}', 'pwa-192x192.png', 'badge-96.png'],
        globIgnores: [
          '**/*.map',
          '**/stats.html',
          'mockServiceWorker.js',
          'assets/mocks-*',
          'assets/dev-*',
          'assets/admin-*',
          // Polices rarement utilisées : chargées à la demande puis gardées (cache « fonts »)
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
