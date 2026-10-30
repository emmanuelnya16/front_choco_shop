import type { ManifestOptions } from 'vite-plugin-pwa';

/**
 * Manifeste de l'application installable (M6 §4.1).
 * Les icônes et écrans de démarrage sont générés par `npm run icons`,
 * les captures par `npm run screenshots`.
 */
export const pwaManifest: Partial<ManifestOptions> = {
  id: '/',
  name: "DR Choco L'Incompris",
  short_name: 'DR Choco',
  description:
    'Vêtements, chaussures et babouches pour hommes. Réservez en ligne, payez par Mobile Money.',
  lang: 'fr',
  dir: 'ltr',
  start_url: '/?source=pwa',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  theme_color: '#1A1A18',
  background_color: '#1A1A18',
  categories: ['shopping', 'lifestyle'],
  icons: [
    { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: '/badge-96.png', sizes: '96x96', type: 'image/png', purpose: 'monochrome' },
  ],
  // HYPOTHÈSE: captures générées depuis l'app elle-même (npm run screenshots) ; à refaire avec les
  // vraies photos du client avant la mise en ligne.
  screenshots: [
    {
      src: '/screenshots/accueil-narrow.png',
      sizes: '1080x1920',
      type: 'image/png',
      form_factor: 'narrow',
      label: 'Accueil : la nouvelle collection DR Choco',
    },
    {
      src: '/screenshots/produit-narrow.png',
      sizes: '1080x1920',
      type: 'image/png',
      form_factor: 'narrow',
      label: 'Fiche produit : choisissez votre taille et réservez',
    },
    {
      src: '/screenshots/suivi-narrow.png',
      sizes: '1080x1920',
      type: 'image/png',
      form_factor: 'narrow',
      label: 'Suivi : la photo de votre colis avant l’envoi',
    },
    {
      src: '/screenshots/accueil-wide.png',
      sizes: '1920x1080',
      type: 'image/png',
      form_factor: 'wide',
      label: 'DR Choco sur ordinateur',
    },
  ],
  shortcuts: [
    {
      name: 'Explorer',
      short_name: 'Explorer',
      url: '/explorer?source=pwa-shortcut',
      icons: [{ src: '/shortcuts/explorer-96.png', sizes: '96x96', type: 'image/png' }],
    },
    {
      name: 'Mes réservations',
      short_name: 'Réservations',
      url: '/reservations?source=pwa-shortcut',
      icons: [{ src: '/shortcuts/reservations-96.png', sizes: '96x96', type: 'image/png' }],
    },
    {
      name: 'Mon panier',
      short_name: 'Panier',
      url: '/panier?source=pwa-shortcut',
      icons: [{ src: '/shortcuts/panier-96.png', sizes: '96x96', type: 'image/png' }],
    },
  ],
};
