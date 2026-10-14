import { test, expect, openRoute } from './fixtures';

test('missões: filtros e ficha com estado verificado', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await openRoute(page, '#/missoes');
  await expect(page.locator('.mission-timeline')).toBeVisible();
  await page.locator('.chip', { hasText: 'Asteroides e cometas' }).click();
  await page.locator('.chip', { hasText: 'A caminho' }).click();
  await expect(page.locator('.mission-card').first()).toBeVisible();
  await page.locator('.mission-search input').fill('zzzz');
  await expect(page.getByText('Nenhuma missão corresponde aos filtros.')).toBeVisible();
  await openRoute(page, '#/missoes/voyager-1');
  await expect(page.locator('.mission-status-box')).toContainText('Verificado a');
  await expect(page.locator('a[href="#/objeto/jupiter"]')).toBeVisible();
});

test('linha temporal: escalas, seleção e calculadora', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await openRoute(page, '#/linha-temporal');
  await page.getByRole('button', { name: 'Primeiros instantes' }).click();
  await page.getByRole('button', { name: 'Proporções reais' }).click();
  await page.locator('.tl-list summary').click();
  await page.locator('.tl-list-item', { hasText: 'Explosão do Câmbrico' }).click();
  await expect(page.locator('.tl-detail-title')).toContainText('Câmbrico');
  await page.locator('.cosmo-calc .chip', { hasText: 'Radiação cósmica de fundo' }).click();
  await expect(page.locator('.cosmo-results dd').first()).toContainText('mil anos');
});

test('fenómenos extremos: níveis e visualizações', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await openRoute(page, '#/fenomenos-extremos');
  await page.getByRole('button', { name: 'Avançado' }).click();
  await expect(page.locator('#horizonte .body-kicker')).toHaveText('Avançado');
  await page.locator('.chip', { hasText: 'M87*' }).click();
  await expect(page.locator('.viz-results').first()).toContainText('UA');
  await openRoute(page, '#/fenomenos-extremos/energia-escura');
  await expect(page.locator('#energia-escura .viz-chart')).toBeVisible();
});

test('dados e métodos: validação calculada no navegador', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await openRoute(page, '#/dados');
  await expect(page.locator('#planetario table').first()).toBeVisible();
  await expect(page.locator('#validacao table')).toBeVisible();
});
