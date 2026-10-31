import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { RouterProvider } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers';
import { createTestRouter } from '@/app/router';
import { splitFaq } from '@/features/content/faq';
import { parseMarkdown, type MdBlock, type MdInline } from '@/features/content/markdown/parse';
import {
  contentPath,
  FAQ_SLUG,
  HELP_CENTER_TITLE,
  HELP_PAGES,
  isValidContentSlug,
  LEGAL_PAGES,
  resolveContentRedirect,
} from '@/features/content/registry';
import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { createAppQueryClient } from '@/lib/api/queryClient';
import { env } from '@/lib/env';
import { handlers } from '@/mocks/handlers';
import { mockContentPages } from '@/mocks/fixtures/pages';
import { classifyRequest, isCacheableResponse } from '@/pwa/cacheRules';

const NBSP = '\u00A0';
const NOT_FOUND_TITLE = `Vous n’avez pas trouvé${NBSP}?`;

const server = setupServer(...handlers);

/**
 * Premier affichage d'une page chargée à la demande : sous forte charge (suite complète en
 * parallèle), il peut dépasser les 4 s par défaut de findBy*, comme dans m6-horsligne.
 */
const LOAD = { timeout: 12_000 };
const SLOW = { timeout: 30_000 };

beforeAll(async () => {
  server.listen();
  // Premier lancement sans cache de transformation : les morceaux chargés à la demande (pages,
  // pied de page) peuvent dépasser le délai de findBy* ; on les prépare une fois ici.
  await Promise.all([
    import('@/pages/ContentPage'),
    import('@/pages/HelpCenterPage'),
    import('@/components/layout/AppFooter'),
  ]);
}, 30_000);
afterEach(() => {
  server.resetHandlers();
  vi.unstubAllGlobals();
});
afterAll(() => server.close());

function renderApp(path: string) {
  const router = createTestRouter([path]);
  const view = render(
    <AppProviders client={createAppQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, ...view };
}

/** IntersectionObserver piloté par le test : on décide quels titres entrent à l'écran. */
class ControlledObserver {
  static instances: ControlledObserver[] = [];
  readonly root = null;
  readonly rootMargin: string;
  readonly thresholds: ReadonlyArray<number> = [];
  readonly elements = new Set<Element>();
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.rootMargin = options?.rootMargin ?? '';
    ControlledObserver.instances.push(this);
  }

  observe = (element: Element) => {
    this.elements.add(element);
  };
  unobserve = (element: Element) => {
    this.elements.delete(element);
  };
  disconnect = () => {
    this.elements.clear();
  };
  takeRecords = () => [];

  trigger(entries: Array<{ target: Element; isIntersecting: boolean; top?: number }>) {
    this.callback(
      entries.map(
        ({ target, isIntersecting, top = 100 }) =>
          ({
            target,
            isIntersecting,
            intersectionRatio: isIntersecting ? 1 : 0,
            boundingClientRect: { top } as DOMRectReadOnly,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: { top: 88, bottom: 400 } as DOMRectReadOnly,
            time: 0,
          }) as IntersectionObserverEntry,
      ),
      this as unknown as IntersectionObserver,
    );
  }

  static watching(element: Element): ControlledObserver | undefined {
    return ControlledObserver.instances.find((observer) => observer.elements.has(element));
  }
}

function collectInternalHrefs(blocks: MdBlock[]): string[] {
  const hrefs: string[] = [];
  const visitInlines = (nodes: MdInline[]) => {
    for (const node of nodes) {
      if (node.type === 'link' && node.kind === 'internal') hrefs.push(node.href);
      if (node.type === 'strong' || node.type === 'em' || node.type === 'link') visitInlines(node.children);
    }
  };
  const visitBlocks = (list: MdBlock[]) => {
    for (const block of list) {
      if (block.type === 'heading' || block.type === 'paragraph') visitInlines(block.children);
      if (block.type === 'blockquote') visitBlocks(block.children);
      if (block.type === 'list') block.items.forEach((item) => (visitInlines(item.children), visitBlocks(item.blocks)));
      if (block.type === 'table') [block.header, ...block.rows].forEach((row) => row.forEach(visitInlines));
    }
  };
  visitBlocks(blocks);
  return hrefs;
}

describe('M7 · Pages · page légale', SLOW, () => {
  it('affiche le titre, la date de mise à jour, l’avertissement et le sommaire, sans bloc WhatsApp', async () => {
    renderApp('/pages/conditions-generales');

    const title = await screen.findByRole('heading', { level: 1, name: 'Conditions générales de réservation' }, LOAD);
    expect(title).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Conditions générales de réservation · DR Choco'));

    const updated = screen.getByText(/Mis à jour le/);
    expect(updated).toHaveTextContent('Mis à jour le 31 octobre 2026');
    expect(updated).toHaveClass('text-small', 'text-text-2');
    expect(within(updated).getByText('31 octobre 2026').tagName).toBe('TIME');
    expect(within(updated).getByText('31 octobre 2026')).toHaveAttribute('datetime', '2026-10-31T09:00:00+01:00');

    expect(screen.getByText('Texte provisoire, à faire valider par un professionnel du droit.').closest('blockquote')).not.toBeNull();

    // Sommaire (ordinateur) généré depuis les h2, chaque entrée pointant vers l'ancre de son titre
    const toc = screen.getByRole('navigation', { name: 'Sommaire' });
    const tocLinks = within(toc).getAllByRole('link');
    const sections = screen.getAllByRole('heading', { level: 2 }).filter((heading) => heading.closest('article'));
    expect(tocLinks.length).toBe(sections.length);
    expect(tocLinks.length).toBeGreaterThanOrEqual(10);
    tocLinks.forEach((link, index) => {
      expect(link).toHaveAttribute('href', `#${sections[index].id}`);
      expect(link.textContent).toBe(sections[index].textContent);
    });
    expect(sections[0]).toHaveAttribute('id', '1-qui-sommes-nous');
    expect(tocLinks[0]).toHaveAttribute('aria-current', 'location');
    expect(tocLinks.filter((link) => link.hasAttribute('aria-current'))).toHaveLength(1);
    // Intertitres longs en casse normale
    expect(sections[0]).toHaveClass('text-h2', 'normal-case');

    // Sommaire repliable sur mobile
    expect(screen.getByText('Sommaire', { selector: 'summary' })).toBeInTheDocument();

    // Pages légales : pas de bloc « Vous n’avez pas trouvé ? »
    expect(screen.queryByRole('heading', { name: NOT_FOUND_TITLE })).not.toBeInTheDocument();
    // Liens internes du texte gérés par le routeur
    expect(screen.getByRole('link', { name: 'politique d’annulation et de retour' })).toHaveAttribute(
      'href',
      '/pages/annulation-retours',
    );
    expect(screen.getByRole('button', { name: 'Retour' })).toBeInTheDocument();
  });

  it('met en évidence la section lue (IntersectionObserver) et suit le sommaire au clic', async () => {
    ControlledObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', ControlledObserver);
    renderApp('/pages/confidentialite');

    await screen.findByRole('heading', { level: 1, name: 'Politique de confidentialité' }, LOAD);
    const toc = screen.getByRole('navigation', { name: 'Sommaire' });
    const links = within(toc).getAllByRole('link');
    const headings = links.map((link) => document.getElementById(link.getAttribute('href')!.slice(1))!);
    expect(headings.every(Boolean)).toBe(true);

    const observer = ControlledObserver.watching(headings[0]);
    expect(observer).toBeDefined();
    // Un seul observateur pour tous les titres, bande haute de l'écran sous l'en-tête
    headings.forEach((heading) => expect(observer!.elements.has(heading)).toBe(true));
    expect(observer!.rootMargin).toMatch(/^-\d+px 0px -60% 0px$/);

    act(() => observer!.trigger([{ target: headings[2], isIntersecting: true }]));
    expect(links[2]).toHaveAttribute('aria-current', 'location');
    expect(links[0]).not.toHaveAttribute('aria-current');

    // En remontant, le titre redescend sous la bande : la section précédente redevient active
    act(() => observer!.trigger([{ target: headings[2], isIntersecting: false, top: 600 }]));
    expect(links[1]).toHaveAttribute('aria-current', 'location');

    // Clic dans le sommaire : défilement jusqu'au titre, focus, entrée active
    const scrollSpy = vi.mocked(Element.prototype.scrollIntoView);
    scrollSpy.mockClear();
    fireEvent.click(links[4]);
    expect(scrollSpy).toHaveBeenCalled();
    expect(scrollSpy.mock.contexts.at(-1)).toBe(headings[4]);
    expect(document.activeElement).toBe(headings[4]);
    expect(links[4]).toHaveAttribute('aria-current', 'location');
    expect(window.location.hash).toBe(`#${headings[4].id}`);
  });

  it('affiche « Page introuvable » pour une adresse inconnue, avec un lien vers l’aide', async () => {
    renderApp('/pages/page-qui-n-existe-pas');
    expect(await screen.findByRole('heading', { level: 1, name: 'Page introuvable' }, LOAD)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aller au centre d’aide' })).toHaveAttribute('href', '/aide');
    expect(screen.getByRole('link', { name: 'Revenir à l’accueil' })).toHaveAttribute('href', '/');
    await waitFor(() => expect(document.title).toBe('Page introuvable · DR Choco'));
  });

  it('refuse un identifiant invalide sans appeler l’API', async () => {
    const requests: string[] = [];
    server.events.on('request:start', ({ request }) => requests.push(new URL(request.url).pathname));
    renderApp('/aide/Pas_Valide');
    expect(await screen.findByRole('heading', { level: 1, name: 'Page introuvable' }, LOAD)).toBeInTheDocument();
    expect(requests.some((path) => path.includes('/pages/'))).toBe(false);
    server.events.removeAllListeners();
  });

  it('l’API simulée répond 404 PAGE_NOT_FOUND pour un identifiant inconnu', async () => {
    await expect(api.get(endpoints.content.page('inconnue'))).rejects.toMatchObject({
      status: 404,
      code: 'PAGE_NOT_FOUND',
      details: { slug: 'inconnue' },
    });
    const page = await api.get<{ slug: string; title: string; updatedAt: string; body: string }>(
      endpoints.content.page('comment-reserver'),
    );
    expect(page).toMatchObject({ slug: 'comment-reserver', title: 'Comment réserver', updatedAt: '2026-10-31T09:00:00+01:00' });
    expect(page.body).toContain('## 1. Choisissez vos articles');
  });

  it('rend sans danger une page piégée renvoyée par l’API', async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/pages/:slug`, () =>
        HttpResponse.json({
          slug: 'piege',
          title: '<img src=x onerror=alert(1)>',
          updatedAt: '2026-10-31T09:00:00+01:00',
          body: [
            '<script>window.__pwned = true</script>',
            '',
            '## Section <b>un</b>',
            '',
            '[cliquez](javascript:alert(1)) [ici](JaVaScRiPt:alert(1)) [là](data:text/html,<script>x</script>)',
            '',
            '<img src=x onerror="window.__pwned = true">',
            '',
            '[Aide](/aide)',
          ].join('\n'),
        }),
      ),
    );
    const { container } = renderApp('/pages/piege');
    const title = await screen.findByRole('heading', { level: 1 }, LOAD);
    expect(title).toHaveTextContent('<img src=x onerror=alert(1)>');

    const article = container.querySelector('article')!;
    expect(article.querySelector('script, img, b')).toBeNull();
    expect(article).toHaveTextContent('<script>window.__pwned = true</script>');
    expect(container.querySelector('a[href^="javascript:" i], a[href^="data:" i]')).toBeNull();
    expect(within(article).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/aide']);
    expect(within(article).getByText(/cliquez ici là/)).toBeInTheDocument();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
  });
});

describe('M7 · Pages · pages d’aide et centre d’aide', SLOW, () => {
  it('page d’aide : titre, sommaire et bloc « Vous n’avez pas trouvé ? » avec WhatsApp', async () => {
    renderApp('/aide/paiement-mobile-money');
    expect(await screen.findByRole('heading', { level: 1, name: 'Payer par Mobile Money' }, LOAD)).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Payer par Mobile Money · DR Choco'));

    const contact = screen.getByRole('region', { name: NOT_FOUND_TITLE });
    const whatsapp = within(contact).getByRole('link', { name: 'Contacter la boutique sur WhatsApp' });
    expect(whatsapp.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect(whatsapp).toHaveAttribute('target', '_blank');
    expect(whatsapp).toHaveAttribute('rel', 'noopener noreferrer');

    expect(within(screen.getByRole('navigation', { name: 'Sommaire' })).getAllByRole('link').length).toBeGreaterThan(3);
    expect(screen.getAllByText(/À COMPLÉTER PAR LA BOUTIQUE/).length).toBeGreaterThan(0);
  });

  it('centre d’aide : guides, questions fréquentes en accordéons accessibles, contact et pages légales', async () => {
    const user = userEvent.setup();
    renderApp('/aide');
    expect(await screen.findByRole('heading', { level: 1, name: HELP_CENTER_TITLE }, LOAD)).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Centre d’aide · DR Choco'));

    const guides = screen.getByRole('region', { name: 'Guides' });
    for (const entry of HELP_PAGES) {
      expect(within(guides).getByRole('link', { name: new RegExp(entry.title) })).toHaveAttribute('href', contentPath(entry));
    }

    const faq = screen.getByRole('region', { name: 'Questions fréquentes' });
    const questions = await within(faq).findAllByRole('button', { expanded: false }, LOAD);
    expect(questions.length).toBeGreaterThanOrEqual(12);
    expect(within(faq).getByRole('button', { name: `Puis-je payer directement en ligne${NBSP}?` })).toBeInTheDocument();

    const first = questions[0];
    const panelId = first.getAttribute('aria-controls')!;
    const panel = document.getElementById(panelId)!;
    expect(panel).toHaveAttribute('role', 'region');
    expect(panel).toHaveAttribute('aria-labelledby', first.id);
    expect(panel).not.toBeVisible();
    expect(first.closest('h3')).not.toBeNull();

    await user.click(first);
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toBeVisible();
    expect(within(panel).getByText(/réservation/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: first.textContent ?? '' })).toBe(panel);

    // Clavier : bouton natif, Entrée et Espace referment puis rouvrent
    first.focus();
    await user.keyboard('{Enter}');
    expect(first).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard(' ');
    expect(first).toHaveAttribute('aria-expanded', 'true');

    expect(screen.getByRole('region', { name: NOT_FOUND_TITLE })).toBeInTheDocument();
    const legal = screen.getByRole('region', { name: 'Informations légales' });
    for (const entry of LEGAL_PAGES) {
      expect(within(legal).getByRole('link', { name: entry.title })).toHaveAttribute('href', contentPath(entry));
    }
  });

  it('ouvre directement la question visée par l’adresse', async () => {
    renderApp('/aide#combien-de-temps-ai-je-pour-payer');
    const button = await screen.findByRole('button', { name: `Combien de temps ai-je pour payer${NBSP}?` }, LOAD);
    await waitFor(() => expect(button).toHaveAttribute('aria-expanded', 'true'));
  });

  it('redirige les anciennes adresses et les pages ouvertes sous la mauvaise rubrique', async () => {
    const cases: Array<[string, string]> = [
      ['/pages/cgv', '/pages/conditions-generales'],
      ['/pages/politique-retour', '/pages/annulation-retours'],
      ['/pages/livraison-et-retrait', '/aide/livraison-retrait'],
      ['/pages/paiement-mobile-money', '/aide/paiement-mobile-money'],
      ['/aide/confidentialite', '/pages/confidentialite'],
    ];
    for (const [from, to] of cases) {
      const { router, unmount } = renderApp(from);
      await waitFor(() => expect(router.state.location.pathname, from).toBe(to), LOAD);
      unmount();
    }
    const { router } = renderApp('/aide/questions-frequentes');
    await waitFor(() => expect(router.state.location.pathname).toBe('/aide'), LOAD);
    expect(router.state.location.hash).toBe('#questions-frequentes');
  });

  it('pied de page : liens vers les 4 pages légales et le centre d’aide', async () => {
    renderApp('/aide');
    const footer = await screen.findByRole('contentinfo', {}, LOAD);
    const expected: Array<[string, string]> = [
      ['Centre d’aide', '/aide'],
      ['Comment réserver', '/aide/comment-reserver'],
      ['Payer par Mobile Money', '/aide/paiement-mobile-money'],
      ['Livraison et retrait', '/aide/livraison-retrait'],
      ['Suivre ma réservation', '/aide/suivre-ma-reservation'],
      ['Conditions générales', '/pages/conditions-generales'],
      ['Politique d’annulation et de retour', '/pages/annulation-retours'],
      ['Confidentialité', '/pages/confidentialite'],
      ['Mentions légales', '/pages/mentions-legales'],
    ];
    for (const [name, href] of expected) {
      expect(within(footer).getByRole('link', { name })).toHaveAttribute('href', href);
    }
    // Chaque lien d'aide ou légal du pied de page mène à une page servie par l'API
    const contentLinks = within(footer)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href') ?? '')
      .filter((href) => /^\/(pages|aide)\//.test(href));
    for (const href of contentLinks) {
      expect(mockContentPages[href.split('/').pop()!], href).toBeDefined();
    }
  });
});

describe('M7 · Pages · données, routes et cache', () => {
  it('chaque page connue de l’app existe dans l’API simulée, avec le titre exact', () => {
    const expectedTitles: Record<string, string> = {
      'conditions-generales': 'Conditions générales de réservation',
      'annulation-retours': 'Politique d’annulation et de retour',
      confidentialite: 'Politique de confidentialité',
      'mentions-legales': 'Mentions légales',
      'comment-reserver': 'Comment réserver',
      'paiement-mobile-money': 'Payer par Mobile Money',
      'livraison-retrait': 'Livraison et retrait',
      'suivre-ma-reservation': 'Suivre ma réservation',
      [FAQ_SLUG]: 'Questions fréquentes',
    };
    for (const entry of [...LEGAL_PAGES, ...HELP_PAGES]) {
      expect(entry.title).toBe(expectedTitles[entry.slug]);
    }
    for (const [slug, title] of Object.entries(expectedTitles)) {
      const page = mockContentPages[slug];
      expect(page, slug).toBeDefined();
      expect(page.slug).toBe(slug);
      expect(page.title).toBe(title);
      expect(page.updatedAt.startsWith('2026-10-31')).toBe(true);
    }
    // Titres de document uniques
    const titles = [...LEGAL_PAGES, ...HELP_PAGES].map((entry) => entry.title).concat(HELP_CENTER_TITLE);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('contenus de démonstration : avertissement juridique, repères à compléter, liens valides, typographie', () => {
    const knownPaths = new Set(['/aide', ...[...LEGAL_PAGES, ...HELP_PAGES].map(contentPath)]);
    for (const entry of LEGAL_PAGES) {
      const body = mockContentPages[entry.slug].body;
      expect(body.startsWith('> **Texte provisoire, à faire valider par un professionnel du droit.**'), entry.slug).toBe(true);
      expect(body, entry.slug).toContain('[À COMPLÉTER');
    }
    for (const page of Object.values(mockContentPages)) {
      for (const href of collectInternalHrefs(parseMarkdown(page.body))) {
        expect(knownPaths.has(href.split('#')[0]), `${page.slug} → ${href}`).toBe(true);
      }
      // Apostrophe typographique et espaces insécables
      expect(page.body, page.slug).not.toContain("'");
      expect(page.body, page.slug).not.toMatch(/ [?!;]| :(?!-)|« | »/);
    }
    const privacy = mockContentPages.confidentialite.body;
    for (const expected of ['Cloudinary', 'prestataire d’envoi des SMS', 'hébergeur', 'aucun cookie publicitaire', 'juriste']) {
      expect(privacy).toContain(expected);
    }
    expect(mockContentPages['mentions-legales'].body).toMatch(/Hébergement[\s\S]*À COMPLÉTER/);
  });

  it('questions fréquentes : au moins 12 questions couvrant le fonctionnement de la boutique', () => {
    const { items } = splitFaq(parseMarkdown(mockContentPages[FAQ_SLUG].body));
    expect(items.length).toBeGreaterThanOrEqual(12);
    const all = items.map((item) => `${item.question} ${JSON.stringify(item.answer)}`).join(' ').toLowerCase();
    for (const topic of [
      'payer directement en ligne',
      '24',
      'orange money',
      'mtn momo',
      'ussd',
      'capture',
      'validation',
      'agence de voyage',
      'douala',
      'retrait en boutique',
      'photo',
      'annuler',
      'guide des tailles',
      'notifications',
    ]) {
      expect(all, topic).toContain(topic);
    }
  });

  it('adresses canoniques et identifiants acceptés', () => {
    expect(resolveContentRedirect('conditions-generales', 'legal')).toBeNull();
    expect(resolveContentRedirect('comment-reserver', 'help')).toBeNull();
    expect(resolveContentRedirect('comment-reserver', 'legal')).toBe('/aide/comment-reserver');
    expect(resolveContentRedirect('cgv', 'legal')).toBe('/pages/conditions-generales');
    expect(resolveContentRedirect('nouvelle-page', 'help')).toBeNull();
    expect(isValidContentSlug('comment-reserver')).toBe(true);
    for (const slug of ['', 'Majuscules', 'a_b', '../secret', 'a--b', '-a', 'a'.repeat(81)]) {
      expect(isValidContentSlug(slug), slug).toBe(false);
    }
  });

  it('POST /client-errors répond 204 sans contenu', async () => {
    const response = await fetch(`${env.apiBaseUrl}${endpoints.clientErrors}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Erreur de test', path: '/aide' }),
    });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });

  it('service worker : les pages déjà lues restent lisibles hors connexion (cache « catalog »)', () => {
    const ctx = { appOrigin: 'https://drchoco.cm', apiBaseUrl: 'https://api.drchoco.cm/api' };
    const get = (url: string, extra: { mode?: string; method?: string } = {}) =>
      classifyRequest({ url: new URL(url), method: extra.method ?? 'GET', mode: extra.mode }, ctx);

    expect(get('https://api.drchoco.cm/api/pages/conditions-generales')).toBe('catalog');
    expect(get('https://api.drchoco.cm/api/pages/questions-frequentes')).toBe('catalog');
    expect(get('https://api.drchoco.cm/api/pages')).toBe('network-only');
    expect(get('https://api.drchoco.cm/api/client-errors', { method: 'POST' })).toBe('network-only');
    expect(get('https://api.drchoco.cm/api/client-errors')).toBe('network-only');
    // Les pages de l'app restent des pages, même quand l'API partage l'origine sans préfixe
    expect(get('https://drchoco.cm/pages/conditions-generales', { mode: 'navigate' })).toBe('pages');
    expect(get('https://drchoco.cm/aide/comment-reserver', { mode: 'navigate' })).toBe('pages');
    const sameOrigin = { appOrigin: 'https://drchoco.cm', apiBaseUrl: 'https://drchoco.cm' };
    expect(classifyRequest({ url: new URL('https://drchoco.cm/pages/mentions-legales'), method: 'GET', mode: 'navigate' }, sameOrigin)).toBe('pages');
    expect(classifyRequest({ url: new URL('https://drchoco.cm/pages/mentions-legales'), method: 'GET', mode: 'cors' }, sameOrigin)).toBe('catalog');

    const json = new Headers({ 'Content-Type': 'application/json' });
    expect(isCacheableResponse({ status: 200, headers: json }, 'catalog')).toBe(true);
    expect(isCacheableResponse({ status: 404, headers: json }, 'catalog')).toBe(false);
  });
});
