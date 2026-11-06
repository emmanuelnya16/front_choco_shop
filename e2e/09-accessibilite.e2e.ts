import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import {
  addToCart,
  cartReserveButton,
  chooseVariant,
  completeLogin,
  confirmReservation,
  expectCheckoutPage,
  goToProofFromPayment,
  KNOWN_CUSTOMER,
  PRODUCT,
  uploadProofAndSend,
} from './fixtures/app';
import { expect, test } from './fixtures/test';

/**
 * Parcours 9 (M7 §8) : audit axe-core (WCAG 2.0 et 2.1, niveaux A et AA) de 12 écrans.
 * Le test échoue s'il reste une violation d'impact « serious » ou « critical » ; toutes les violations
 * (toutes gravités) sont écrites dans e2e/reports/axe-<projet>.json pour la phase accessibilité.
 */

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

// HYPOTHÈSE: audit en mode « animations réduites » : les écrans sont audités dans leur état final, sans
// éléments à mi-chemin d'une animation (opacité partielle) qui fausseraient le calcul des contrastes.
test.use({ reducedMotion: 'reduce' });

interface AuditedNode {
  target: string[];
  html: string;
  failureSummary?: string;
}

interface AuditedViolation {
  id: string;
  impact: string | null;
  help: string;
  description: string;
  helpUrl: string;
  tags: string[];
  nodes: AuditedNode[];
}

interface ScreenAudit {
  screen: string;
  url: string;
  violations: AuditedViolation[];
  incomplete: number;
  passes: number;
}

test('12 écrans sans violation « serious » ou « critical » (WCAG 2.1 AA)', async ({ page, isMobile }, testInfo) => {
  test.setTimeout(300_000);
  const audits: ScreenAudit[] = [];

  async function audit(screen: string): Promise<void> {
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const result = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    const violations: AuditedViolation[] = result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact ?? null,
      help: violation.help,
      description: violation.description,
      helpUrl: violation.helpUrl,
      tags: violation.tags,
      nodes: violation.nodes.map((node) => ({
        target: node.target.map((selector) => String(selector)),
        html: node.html.slice(0, 400),
        failureSummary: node.failureSummary,
      })),
    }));
    audits.push({
      screen,
      url: new URL(page.url()).pathname + new URL(page.url()).search,
      violations,
      incomplete: result.incomplete.length,
      passes: result.passes.length,
    });
    const blocking = violations
      .filter((violation) => BLOCKING_IMPACTS.has(violation.impact ?? ''))
      .map((violation) => `${violation.id} (${violation.impact}, ${violation.nodes.length} élément(s))`);
    expect.soft(blocking, `violations graves sur l’écran « ${screen} »`).toEqual([]);
  }

  try {
    await test.step('accueil', async () => {
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      // Sections chargées par l'API (« Les plus réservés », « Nouveautés ») affichées avant l'audit
      const main = page.getByRole('main');
      await expect(main.getByRole('heading', { level: 2, name: 'Les plus réservés' })).toBeVisible();
      await expect(main.getByRole('heading', { level: 2, name: 'Nouveautés' })).toBeVisible();
      // Cartes produit des trois carrousels (plus réservés, nouveautés, babouches) : 13 dans les mocks
      await expect.poll(() => main.getByRole('link', { name: /, \d+ FCFA$/ }).count()).toBeGreaterThanOrEqual(10);
      await audit('accueil');
    });

    await test.step('Explorer', async () => {
      await page.goto('/explorer');
      await expect(page.getByRole('heading', { level: 1, name: 'EXPLORER' })).toBeVisible();
      await expect(page.getByRole('main').getByRole('link', { name: /, \d+ FCFA$/ }).first()).toBeVisible();
      await audit('explorer');
    });

    await test.step('recherche', async () => {
      await page.goto('/recherche');
      await page.getByRole('main').getByRole('combobox', { name: 'Rechercher un article dans le catalogue' }).fill('babouche');
      await expect(page.getByRole('region', { name: 'Suggestions directes' }).getByRole('option').first()).toBeVisible();
      await audit('recherche');
    });

    await test.step('fiche', async () => {
      await page.goto(`/produit/${PRODUCT.slug}`);
      await expect(page.getByRole('heading', { level: 1, name: PRODUCT.name })).toBeVisible();
      await audit('fiche');
    });

    await test.step('panier', async () => {
      await chooseVariant(page, { size: '42' });
      await addToCart(page, isMobile);
      await page.goto('/panier');
      await expect(page.getByRole('heading', { level: 1, name: 'MON PANIER' })).toBeVisible();
      await expect(page.getByRole('main').getByRole('link', { name: PRODUCT.name }).first()).toBeVisible();
      await audit('panier');
    });

    await test.step('feuille de connexion', async () => {
      await cartReserveButton(page).click();
      await expect(page.getByRole('dialog', { name: 'Connexion par SMS' })).toBeVisible();
      await audit('feuille de connexion');
      await completeLogin(page, KNOWN_CUSTOMER);
    });

    await test.step('réservation', async () => {
      // Défaut D1 : après la connexion, le client reste sur le panier ; ouverture directe de l'écran
      await page.goto('/reservation');
      await expectCheckoutPage(page);
      await expect(page.getByText('Livraison à Douala — Bonamoussadi')).toBeVisible();
      await audit('réservation');
    });

    await test.step('paiement', async () => {
      await confirmReservation(page, { reducedMotion: true });
      await audit('paiement');
    });

    await test.step('preuve', async () => {
      await goToProofFromPayment(page);
      await expect(page.getByRole('region', { name: /^Ajouter ma capture d(’|')écran/ })).toBeVisible();
      await audit('preuve');
    });

    await test.step('merci', async () => {
      await uploadProofAndSend(page);
      await audit('merci');
    });

    await test.step('mes réservations', async () => {
      await page.goto('/reservations');
      await expect(page.getByRole('heading', { level: 1, name: 'Mes réservations' })).toBeVisible();
      await expect(page.getByRole('article').first()).toBeVisible();
      await audit('mes réservations');
    });

    await test.step('détail', async () => {
      // Réservation de démonstration « Prête pour retrait », avec les photos du colis
      await page.goto('/reservations/RES-000102');
      await expect(page.getByRole('heading', { level: 2, name: 'Votre colis est prêt' }).first()).toBeVisible();
      await expect(page.getByRole('img', { name: /^Photo de votre colis emballé/ }).first()).toBeVisible();
      await audit('détail');
    });
  } finally {
    const report = buildReport(testInfo.project.name, audits);
    const file = path.join(testInfo.project.testDir, 'reports', `axe-${testInfo.project.name}.json`);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await testInfo.attach(`axe-${testInfo.project.name}.json`, { path: file, contentType: 'application/json' });
  }

  expect(audits).toHaveLength(12);
});

function buildReport(project: string, audits: ScreenAudit[]) {
  const byImpact: Record<string, number> = {};
  const byRule: Record<string, { impact: string | null; help: string; screens: string[]; nodes: number }> = {};
  for (const screenAudit of audits) {
    for (const violation of screenAudit.violations) {
      const impact = violation.impact ?? 'inconnu';
      byImpact[impact] = (byImpact[impact] ?? 0) + 1;
      const rule = (byRule[violation.id] ??= { impact: violation.impact, help: violation.help, screens: [], nodes: 0 });
      rule.screens.push(screenAudit.screen);
      rule.nodes += violation.nodes.length;
    }
  }
  return {
    project,
    generatedAt: new Date().toISOString(),
    tags: WCAG_TAGS,
    blockingImpacts: [...BLOCKING_IMPACTS],
    summary: {
      screensAudited: audits.length,
      violationsByImpact: byImpact,
      rules: byRule,
    },
    screens: audits,
  };
}
