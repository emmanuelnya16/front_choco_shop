import type { Locator } from '@playwright/test';
import { expect, finalScreenshot, test } from './fixtures/test';

/**
 * Parcours 6 (M7 §8) : recherche « babouche » → suggestions → résultats.
 * La recherche ignore les accents : « imperiale » trouve la « Babouche Croco Impériale ».
 */
test('« babouche » → suggestions → résultats ; « imperiale » sans accent trouve « Impériale »', async ({
  page,
  isMobile,
}, testInfo) => {
  await page.goto('/');

  let searchBox: Locator;
  let suggestions: Locator;
  if (isMobile) {
    // Téléphone : loupe de l'en-tête → écran de recherche
    await page.getByRole('banner').getByRole('link', { name: 'Rechercher' }).click();
    await expect(page).toHaveURL(/\/recherche$/);
    searchBox = page.getByRole('main').getByRole('combobox', { name: 'Rechercher un article dans le catalogue' });
    suggestions = page.getByRole('region', { name: 'Suggestions directes' }).getByRole('listbox');
  } else {
    // Ordinateur : champ de recherche de l'en-tête, suggestions en liste déroulante
    searchBox = page.getByRole('banner').getByRole('combobox', { name: 'Rechercher un article' });
    suggestions = page.getByRole('listbox', { name: 'Suggestions de recherche' });
  }

  await searchBox.fill('imperiale');
  await expect(suggestions.getByRole('option', { name: /^Babouche Croco Impériale/ })).toBeVisible();

  await searchBox.fill('babouche');
  await expect(searchBox).toHaveAttribute('aria-expanded', 'true');
  await expect(suggestions.getByRole('option')).toHaveCount(6);
  await page.getByRole('button', { name: 'Voir les 6 résultats pour « babouche »' }).click();

  await expect(page).toHaveURL(/\/explorer\?q=babouche$/);
  const main = page.getByRole('main');
  await expect(main.getByText('Recherche : “babouche”')).toBeVisible();
  const results = main.getByRole('link', { name: /, \d+ FCFA$/ });
  await expect(results).toHaveCount(6);
  for (const result of await results.all()) {
    await expect(result).toHaveAccessibleName(/^Babouche /);
  }

  await finalScreenshot(page, testInfo, '06-recherche');
});
