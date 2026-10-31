import { describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import { pwaManifest } from '../../pwa-manifest';
import { NOTIFICATION_BADGE, NOTIFICATION_ICON } from '@/pwa/pushPayload';

/**
 * M6 §4.2 et §4.3 : le manifeste, index.html et les fichiers générés par `npm run icons` et
 * `npm run screenshots` doivent rester d'accord (un fichier renommé ou oublié casse l'installation
 * sans erreur visible dans l'app).
 */

// Liste des fichiers de public/ (aucun n'est chargé : seules les clés servent)
const PUBLIC_FILES = new Set(
  Object.keys(import.meta.glob('../../public/**/*.{png,ico,svg}')).map((key) =>
    key.replace('../../public', ''),
  ),
);

const html = new DOMParser().parseFromString(indexHtml, 'text/html');
const meta = (name: string) =>
  html.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.getAttribute('content');
const links = (rel: string) =>
  [...html.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`)].map((link) => ({
    href: link.getAttribute('href') ?? '',
    media: link.getAttribute('media') ?? '',
    type: link.getAttribute('type'),
  }));

describe('M6 · Icônes · manifeste', () => {
  const icons = pwaManifest.icons ?? [];
  const screenshots = pwaManifest.screenshots ?? [];
  const shortcuts = pwaManifest.shortcuts ?? [];

  it('déclare les icônes 192 et 512 « any », la 512 masquable et la pastille monochrome', () => {
    const declared = icons.map((icon) => `${icon.sizes} ${icon.purpose}`);
    expect(declared).toEqual(
      expect.arrayContaining(['192x192 any', '512x512 any', '512x512 maskable', '96x96 monochrome']),
    );
  });

  it('chaque icône, capture et icône de raccourci existe dans public/', () => {
    const sources = [
      ...icons.map((icon) => icon.src),
      ...screenshots.map((shot) => shot.src),
      ...shortcuts.flatMap((shortcut) => (shortcut.icons ?? []).map((icon) => icon.src)),
    ];
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.filter((src) => !PUBLIC_FILES.has(src))).toEqual([]);
  });

  it('les noms des icônes portent la taille déclarée', () => {
    const all = [...icons, ...shortcuts.flatMap((shortcut) => shortcut.icons ?? [])];
    for (const icon of all) {
      const [width] = (icon.sizes ?? '').split('x');
      expect(icon.src).toMatch(new RegExp(`-${width}(x${width})?\\.png$`));
    }
  });

  it('3 captures étroites 1080 × 1920 et 1 large 1920 × 1080, avec un libellé', () => {
    const narrow = screenshots.filter((shot) => shot.form_factor === 'narrow');
    const wide = screenshots.filter((shot) => shot.form_factor === 'wide');
    expect(narrow.map((shot) => shot.sizes)).toEqual(['1080x1920', '1080x1920', '1080x1920']);
    expect(wide.map((shot) => shot.sizes)).toEqual(['1920x1080']);
    for (const shot of screenshots) expect(shot.label?.trim()).toBeTruthy();
  });

  it('3 raccourcis avec une icône de 96 px chacun', () => {
    expect(shortcuts.map((shortcut) => shortcut.name)).toEqual(['Explorer', 'Mes réservations', 'Mon panier']);
    for (const shortcut of shortcuts) {
      expect(shortcut.icons?.map((icon) => icon.sizes)).toEqual(['96x96']);
    }
  });

  it('les notifications utilisent des icônes présentes dans le manifeste et dans public/', () => {
    const sources = icons.map((icon) => icon.src);
    expect(sources).toContain(NOTIFICATION_ICON);
    expect(sources).toContain(NOTIFICATION_BADGE);
    expect(PUBLIC_FILES.has(NOTIFICATION_ICON)).toBe(true);
    expect(PUBLIC_FILES.has(NOTIFICATION_BADGE)).toBe(true);
  });
});

describe('M6 · Icônes · index.html', () => {
  it('contient les balises de l’application installable (§4.3)', () => {
    expect(meta('theme-color')).toBe('#1A1A18');
    expect(meta('application-name')).toBe('DR Choco');
    expect(meta('mobile-web-app-capable')).toBe('yes');
    expect(meta('apple-mobile-web-app-capable')).toBe('yes');
    expect(meta('apple-mobile-web-app-status-bar-style')).toBe('black-translucent');
    expect(meta('apple-mobile-web-app-title')).toBe('DR Choco');
    expect(meta('format-detection')).toBe('telephone=no');
    expect(meta('viewport')).toContain('viewport-fit=cover');
  });

  it('favicon.ico, icône 64 px et apple-touch-icon pointent vers des fichiers existants', () => {
    const icons = links('icon');
    expect(icons.map((icon) => icon.href)).toEqual(['/favicon.ico', '/pwa-64x64.png']);
    expect(icons[1].type).toBe('image/png');
    const apple = links('apple-touch-icon');
    expect(apple.map((icon) => icon.href)).toEqual(['/apple-touch-icon-180x180.png']);
    for (const { href } of [...icons, ...apple]) expect(PUBLIC_FILES.has(href)).toBe(true);
  });

  it('chaque écran de démarrage existe et correspond à sa requête média', () => {
    const splash = links('apple-touch-startup-image');
    expect(splash.length).toBeGreaterThan(0);
    for (const { href, media } of splash) {
      const match =
        /device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\) and \(orientation: (portrait|landscape)\)/.exec(
          media,
        );
      expect(match, media).not.toBeNull();
      const [, width, height, ratio, orientation] = match!;
      const w = Number(width) * Number(ratio);
      const h = Number(height) * Number(ratio);
      const expected = orientation === 'portrait' ? `${w}x${h}` : `${h}x${w}`;
      expect(href).toBe(`/splash/apple-splash-${orientation}-${expected}.png`);
      expect(PUBLIC_FILES.has(href), href).toBe(true);
    }
  });

  it('tous les écrans de démarrage générés sont référencés', () => {
    const linked = new Set(links('apple-touch-startup-image').map((link) => link.href));
    const files = [...PUBLIC_FILES].filter((file) => file.startsWith('/splash/'));
    expect(files.filter((file) => !linked.has(file))).toEqual([]);
  });

  it('couvre les iPhone courants, en portrait et en paysage', () => {
    const media = links('apple-touch-startup-image').map((link) => link.media);
    // Taille d'écran CSS et densité : SE 1re gén., 8 et SE, X/XS/11 Pro, XR/11, 12 à 14,
    // 12 à 14 Pro Max (et 14 Plus), 14 Pro et 15/15 Pro, 16 Pro, 15 Pro Max, 16 Pro Max
    const devices = [
      [320, 568, 2],
      [375, 667, 2],
      [375, 812, 3],
      [414, 896, 2],
      [390, 844, 3],
      [428, 926, 3],
      [393, 852, 3],
      [402, 874, 3],
      [430, 932, 3],
      [440, 956, 3],
    ];
    for (const [width, height, ratio] of devices) {
      for (const orientation of ['portrait', 'landscape']) {
        const query = `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: ${orientation})`;
        expect(
          media.some((m) => m.includes(query)),
          query,
        ).toBe(true);
      }
    }
  });
});
