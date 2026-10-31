// Captures du manifeste (M6 §4.2), lancé par `npm run screenshots` :
//   3 étroites 1080 × 1920 (360 × 640 CSS à l'échelle 3) : accueil, fiche produit, suivi de réservation ;
//   1 large 1920 × 1080 (1280 × 720 CSS à l'échelle 1,5) : accueil.
// Sortie : public/screenshots/*.png (chemins de pwa-manifest.ts), compressées sous 350 Ko si possible.
//
// Prérequis : serveur de développement avec les mocks (npm run dev), puis
//   npm run screenshots                                  (http://127.0.0.1:3000 par défaut)
//   npm run screenshots -- --url http://127.0.0.1:3101   (ou SCREENSHOTS_URL=…)
// Navigateur : Chrome ou Edge déjà installé, piloté par le protocole DevTools (WebSocket natif de
// Node 22). CHROME_PATH=… pour un autre emplacement.
// HYPOTHÈSE: Playwright n'est pas une dépendance autorisée (M6 §0) : Chrome installé suffit.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'screenshots');
const MAX_BYTES = 350 * 1024;

const urlArg = process.argv.indexOf('--url');
const BASE_URL = (urlArg > 0 ? process.argv[urlArg + 1] : process.env.SCREENSHOTS_URL || 'http://127.0.0.1:3000').replace(
  /\/+$/,
  '',
);

// Client Junior des mocks (src/mocks/fixtures) : profil persisté comme après une connexion
const JUNIOR = {
  id: 'usr-junior-01',
  phone: '+237690000001',
  firstName: 'Junior',
  lastName: 'Mbarga',
  city: 'Douala',
  createdAt: '2026-09-15T10:00:00.000Z',
};

const NARROW = { width: 360, height: 640, scale: 3, mobile: true };
const WIDE = { width: 1280, height: 720, scale: 1.5, mobile: false };

const SHOTS = [
  { file: 'accueil-narrow.png', path: '/', viewport: NARROW },
  { file: 'produit-narrow.png', path: '/produit/hoodie-barbele-noir', viewport: NARROW },
  // Défile jusqu'à la photo du colis (#colis), sujet du libellé du manifeste
  { file: 'suivi-narrow.png', path: '/reservations/RES-000102', viewport: NARROW, signedIn: true, scrollTo: '#colis' },
  { file: 'accueil-wide.png', path: '/', viewport: WIDE },
];

// Outils de développement (TanStack Query) masqués : ils ne font pas partie de l'app
const HIDE_DEV_TOOLS_CSS = '.tsqd-parent-container,.tsqd-open-btn-container{display:none!important}';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findBrowser() {
  const local = process.env.LOCALAPPDATA ?? '';
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    local && join(local, 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error('Chrome introuvable : indiquez son chemin avec CHROME_PATH.');
  return found;
}

async function connect() {
  const port = 9400 + Math.floor(Math.random() * 400);
  // Profil temporaire dans node_modules/.cache (ignoré par git), sur le disque du projet plutôt que
  // dans le dossier temporaire du système
  const profileRoot = join(ROOT, 'node_modules', '.cache', 'screenshots-chrome');
  mkdirSync(profileRoot, { recursive: true });
  const profile = mkdtempSync(join(profileRoot, 'profil-'));
  const browser = spawn(
    findBrowser(),
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--lang=fr-FR',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  let wsUrl;
  for (let i = 0; i < 75 && !wsUrl; i += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      wsUrl = targets.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
    } catch {
      // Le navigateur démarre
    }
    if (!wsUrl) await sleep(200);
  }
  if (!wsUrl) throw new Error('Le navigateur ne répond pas au protocole DevTools.');

  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => {
    ws.addEventListener('open', r, { once: true });
    ws.addEventListener('error', j, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve: ok, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else ok(msg.result);
    } else if (msg.method) {
      for (const listener of listeners) listener(msg);
    }
  });
  const send = (method, params = {}) =>
    new Promise((ok, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve: ok, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  // Profil temporaire (≈ 80 Mo) supprimé une fois le navigateur vraiment arrêté
  const close = async () => {
    // Fermeture propre d'abord : tuer le seul processus principal laisse sous Windows des processus
    // enfants qui verrouillent le profil
    const exited = new Promise((ok) => browser.once('exit', ok));
    await Promise.race([send('Browser.close').catch(() => {}), exited, sleep(3000)]);
    ws.close();
    if (!(await Promise.race([exited.then(() => true), sleep(5000).then(() => false)]))) {
      browser.kill();
      await Promise.race([exited, sleep(5000)]);
    }
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        rmSync(profile, { recursive: true, force: true });
        return;
      } catch {
        await sleep(300);
      }
    }
    console.warn(`Profil temporaire du navigateur non supprimé : ${profile}`);
  };
  return { send, listeners, close };
}

/** Attend la fin du chargement : réseau calme 800 ms, polices et images visibles prêtes (20 s au plus). */
async function waitForIdle(cdp, evaluate) {
  const inflight = new Set();
  let lastActivity = Date.now();
  const onEvent = (msg) => {
    const id = msg.params?.requestId;
    if (msg.method === 'Network.requestWillBeSent') inflight.add(id);
    else if (msg.method === 'Network.loadingFinished' || msg.method === 'Network.loadingFailed') inflight.delete(id);
    else return;
    lastActivity = Date.now();
  };
  cdp.listeners.add(onEvent);
  const deadline = Date.now() + 20000;
  try {
    while (Date.now() < deadline) {
      await sleep(200);
      if (inflight.size > 0 || Date.now() - lastActivity < 800) continue;
      // Images visibles seulement : celles en chargement différé hors de l'écran ne finissent jamais
      const ready = await evaluate(`document.readyState === 'complete' && [...document.images].every((img) => {
        if (img.complete) return true;
        const r = img.getBoundingClientRect();
        return r.width === 0 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth;
      })`);
      if (ready) break;
    }
    await evaluate('document.fonts.ready.then(() => true)');
  } finally {
    cdp.listeners.delete(onEvent);
  }
}

async function capture(cdp, shot) {
  const evaluate = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result?.value;
  };
  const navigate = async (url) => {
    const loaded = new Promise((ok) => {
      const fn = (msg) => {
        if (msg.method === 'Page.loadEventFired') {
          cdp.listeners.delete(fn);
          ok();
        }
      };
      cdp.listeners.add(fn);
    });
    await cdp.send('Page.navigate', { url });
    await loaded;
    await waitForIdle(cdp, evaluate);
  };

  const { width, height, scale, mobile } = shot.viewport;
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 });
  // Animations jouées instantanément : aucune capture prise au milieu d'une transition
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

  // État de départ propre : aucune donnée locale, profil Junior seulement si demandé
  await navigate(`${BASE_URL}/hors-ligne`);
  await evaluate(`localStorage.clear(); sessionStorage.clear();${
    shot.signedIn
      ? ` localStorage.setItem('drchoco-auth', ${JSON.stringify(JSON.stringify({ state: { user: JUNIOR }, version: 1 }))});`
      : ''
  } true`);
  await navigate(`${BASE_URL}${shot.path}`);
  // Notifications passagères (« Votre colis est prêt »…) fermées : elles masqueraient l'écran
  await evaluate(`(() => {
    const s = document.createElement('style');
    s.textContent = ${JSON.stringify(HIDE_DEV_TOOLS_CSS)};
    document.head.append(s);
    document.querySelectorAll('[aria-label="Fermer la notification"]').forEach((b) => b.click());
    return true;
  })()`);
  // Deux passes : les images chargées après le premier défilement décalent la page
  const scrollToTarget = `(() => {
    const target = ${JSON.stringify(shot.scrollTo ?? null)};
    const el = target && document.querySelector(target);
    if (target && !el) throw new Error('Élément ' + target + ' introuvable sur ${shot.path}');
    // scroll-margin-top de la cible : elle s'arrête sous l'en-tête collant, comme dans l'app
    if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' });
    else window.scrollTo({ top: 0, behavior: 'instant' });
    return true;
  })()`;
  for (let pass = 0; pass < 2; pass += 1) {
    await evaluate(scrollToTarget);
    await waitForIdle(cdp, evaluate);
    await sleep(600);
  }

  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  return Buffer.from(data, 'base64');
}

/** PNG à palette, qualité réduite par paliers jusqu'à passer sous 350 Ko. */
async function compress(raw, file) {
  let best = null;
  for (const quality of [90, 80, 70, 60, 50]) {
    const buffer = await sharp(raw).png({ palette: true, quality, compressionLevel: 9, effort: 10 }).toBuffer();
    best = { buffer, quality };
    if (buffer.length <= MAX_BYTES) break;
  }
  writeFileSync(file, best.buffer);
  const { width, height } = await sharp(best.buffer).metadata();
  const ko = (best.buffer.length / 1024).toFixed(0);
  const warning = best.buffer.length > MAX_BYTES ? ' (au-dessus de 350 Ko)' : '';
  console.log(`Créé : ${file} — ${width} × ${height}, ${ko} Ko, qualité ${best.quality}${warning}`);
}

async function main() {
  try {
    const res = await fetch(BASE_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (error) {
    throw new Error(
      `Serveur injoignable sur ${BASE_URL} (${error.message}). Lancez d'abord le serveur de développement avec les mocks (npm run dev), ou indiquez son adresse avec --url.`,
    );
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const cdp = await connect();
  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    for (const shot of SHOTS) {
      const raw = await capture(cdp, shot);
      await compress(raw, join(OUT_DIR, shot.file));
    }
  } finally {
    await cdp.close();
  }
}

main().catch((error) => {
  console.error(`Captures impossibles : ${error.message}`);
  process.exitCode = 1;
});
