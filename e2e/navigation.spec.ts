import { test, expect, openRoute } from './fixtures';

test('a vista 3D arranca e mostra os planetas', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await openRoute(page, '#/');
  await expect(page.locator('canvas').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Júpiter/ }).first()).toBeVisible({ timeout: 20_000 });
});

test('menu "Mais" leva às secções secundárias', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await openRoute(page, '#/sistema-solar');
  await page.locator('.nav-more-btn').click();
  await page.locator('.nav-more-list a[href="#/missoes"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Missões espaciais');
  await page.locator('.nav-more-btn').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.nav-more-list')).toBeHidden();
});

test('pesquisa global encontra planetas, missões e conceitos', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await openRoute(page, '#/sistema-solar');
  await page.keyboard.press('Control+k');
  const input = page.locator('dialog input');
  await input.fill('saturno');
  const options = page.locator('dialog').getByRole('option');
  await expect(options.first()).toHaveAccessibleName(/^Saturno Planeta/);
  await input.fill('voyager');
  await expect(options.first()).toHaveAccessibleName(/^Voyager \d.*Missão espacial/);
  await input.fill('anel de einstein');
  await expect(options.filter({ hasText: 'Conceito' }).first()).toBeVisible();
});

test('rota inexistente mostra a página de erro', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await openRoute(page, '#/nada/aqui');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Página não encontrada');
});

test('ficha de Marte com dados, fontes e ligação ao planetário', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await openRoute(page, '#/objeto/marte');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Marte');
  await expect(page.locator('a[href="#/planetario/marte"]')).toBeVisible();
  await page.getByRole('button', { name: /favoritos/i }).first().click();
  await openRoute(page, '#/favoritos');
  await expect(page.getByText('Marte').first()).toBeVisible();
});
