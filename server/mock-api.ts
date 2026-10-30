/**
 * Serveur de mocks pour tester l'application installable (M6 §3.2).
 *
 * Le service worker de MSW et celui de l'app ne peuvent pas contrôler la même page : pour tester
 * la PWA, l'API simulée tourne ici, sous Node, avec EXACTEMENT les mêmes gestionnaires MSW
 * (src/mocks/handlers.ts), simulateur boutique (/_mock/...) compris.
 *
 * Lancement : `npm run mock:api` (port 8787 par défaut), puis `npm run preview:pwa`.
 *
 * Écart avec le prompt : @mswjs/http-middleware 0.10.3 appelle `msw.handleRequest`, qui n'existe
 * plus dans MSW 3 ; le pont ci-dessous utilise `getResponse` de MSW 3 avec Express (déjà présent).
 */
import express, { type NextFunction, type Request as ExpressRequest, type Response as ExpressResponse } from 'express';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { getResponse, type RequestHandler } from 'msw';
import { loadEnv, runnerImport } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Même mode que `npm run preview:pwa` : lit .env.pwa (VITE_API_BASE_URL=http://127.0.0.1:8787/api)
const mode = process.env.MOCK_API_MODE ?? 'pwa';

function log(message: string) {
  process.stdout.write(`[mock-api] ${message}\n`);
}

// runnerImport ne lit que .env et .env.local, quel que soit le mode : on charge .env.pwa ici.
// Vite fait passer les variables VITE_* du processus avant celles des fichiers ; une variable
// déjà définie dans le terminal garde la priorité.
for (const [key, value] of Object.entries(loadEnv(mode, root, 'VITE_'))) {
  process.env[key] ??= value;
}

// Les gestionnaires lisent import.meta.env et l'alias « @ » : on les charge avec le chargeur de
// modules de Vite, qui fournit les deux (sans fenêtre : ni sessionStorage ni BroadcastChannel).
const { module: mocks } = await runnerImport<{ handlers: RequestHandler[] }>('/src/mocks/handlers.ts', {
  root,
  mode,
  configFile: false,
  logLevel: 'warn',
  resolve: { alias: { '@': path.join(root, 'src') } },
});
const { module: envModule } = await runnerImport<{ env: { apiBaseUrl: string } }>('/src/lib/env.ts', {
  root,
  mode,
  configFile: false,
  logLevel: 'warn',
});

const apiBase = new URL(envModule.env.apiBaseUrl);
const port = Number(process.env.MOCK_API_PORT ?? (apiBase.port || 8787));

const app = express();
app.disable('x-powered-by');

// CORS : le front (3000 ou 4173) appelle une autre origine, avec Authorization et
// credentials: 'include' pour /auth/refresh. Outil de développement : l'origine est renvoyée en écho.
app.use((req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      req.headers['access-control-request-headers'] ?? 'Content-Type, Authorization, Idempotency-Key',
    );
    res.setHeader('Access-Control-Max-Age', '600');
    res.status(204).end();
    return;
  }
  next();
});

// Fichiers de démonstration (photos de colis, preuves, visuels produits)
app.use('/mock', express.static(path.join(root, 'public', 'mock'), { fallthrough: false }));

// Pont Express → gestionnaires MSW
app.all('*', async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    // Les gestionnaires sont enregistrés sur l'origine exacte de VITE_API_BASE_URL : on réécrit
    // l'URL entrante sur cette origine (127.0.0.1, localhost ou IP du réseau local).
    const target = new URL(req.originalUrl, apiBase.origin);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers.set(key, value);
      else if (Array.isArray(value)) headers.set(key, value.join(', '));
    }
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const request = new Request(target, {
      method: req.method,
      headers,
      body: hasBody ? (Readable.toWeb(req) as ReadableStream<Uint8Array>) : undefined,
      duplex: 'half',
    } as RequestInit);

    const response = await getResponse(mocks.handlers, request);
    if (!response) {
      res.status(404).json({ code: 'NOT_FOUND', message: `Aucun mock pour ${req.method} ${target.pathname}` });
      return;
    }
    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key !== 'content-length' && key !== 'content-encoding') res.setHeader(key, value);
    });
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    log(`erreur sur ${req.method} ${req.originalUrl} : ${String(error)}`);
    if (!res.headersSent) res.status(500).json({ code: 'MOCK_SERVER_ERROR', message: String(error) });
  }
});

app.listen(port, '0.0.0.0', () => {
  log(`${mocks.handlers.length} gestionnaires MSW chargés (mode « ${mode} »)`);
  log(`API simulée : ${apiBase.origin}${apiBase.pathname} (écoute sur le port ${port})`);
  log('Simulateur boutique : routes /_mock/... ; remise à zéro complète : POST /api/_mock/reset');
});
