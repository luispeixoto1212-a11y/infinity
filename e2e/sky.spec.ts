import { test, expect, openRoute } from './fixtures';

test.describe('planetário', () => {
  test('mostra o céu, o painel "Esta noite" e permite mudar a data', async ({ page, consoleErrors }) => {
    void consoleErrors;
    await openRoute(page, '#/planetario');
    await expect(page.locator('.planetarium-canvas')).toBeVisible();
    await expect(page.locator('.tonight-table tbody tr')).toHaveCount(8);
    await page.locator('input[type=datetime-local]').fill('2026-10-14T22:00');
    await expect(page.locator('.planetarium-hud').first()).toContainText('22:00');
    await page.getByRole('button', { name: '+1 dia' }).click();
    await expect(page.locator('.planetarium-hud').first()).toContainText('15/10/2026');
  });

  test('alvo vindo de uma ficha abre a informação do astro', async ({ page, consoleErrors }) => {
    void consoleErrors;
    await openRoute(page, '#/planetario/sirius');
    await expect(page.locator('.sky-info-title')).toHaveText('Sirius');
    await openRoute(page, '#/planetario/m42');
    await expect(page.locator('.sky-info-title')).toContainText('M42');
    await openRoute(page, '#/planetario/ngc5139');
    await expect(page.locator('.sky-info-title')).toContainText('Omega Centauri');
  });

  test('comparação de dois lugares e animação do tempo', async ({ page, consoleErrors }) => {
    void consoleErrors;
    await openRoute(page, '#/planetario');
    await page.locator('button.compare-toggle').click();
    await expect(page.locator('.planetarium-view canvas')).toHaveCount(2);
    await page.getByRole('button', { name: 'Avançar o tempo' }).click();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Pausar' }).click();
  });

  test('teclado move e aproxima a vista', async ({ page, consoleErrors }) => {
    void consoleErrors;
    await openRoute(page, '#/planetario');
    const stage = page.locator('.planetarium-stage').first();
    await stage.focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('+');
    await expect(page.locator('#planetarium-help')).toContainText('Campo de visão: 144');
  });
});

test.describe('espaço profundo', () => {
  test('catálogo Messier, ficha e mapa do céu', async ({ page, consoleErrors }) => {
    void consoleErrors;
    await openRoute(page, '#/espaco-profundo');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await openRoute(page, '#/espaco-profundo/m31');
    await expect(page.locator('a[href="#/planetario/m31"]')).toBeVisible();
  });

  test('objetos para além do catálogo Messier', async ({ page, consoleErrors }) => {
    void consoleErrors;
    await openRoute(page, '#/espaco-profundo');
    await expect(page.getByRole('heading', { name: 'Para além do catálogo Messier' })).toBeVisible();
    await page.locator('.dso-beyond-group a[href="#/espaco-profundo/gnm"]').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Grande Nuvem de Magalhães');
    await expect(page.locator('.facts-table')).toContainText('162 000 anos-luz');
    await openRoute(page, '#/espaco-profundo/psr-b1919');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('PSR B1919+21');
    await expect(page.locator('.facts-table')).toContainText('1,33730 s');
    await page.getByRole('link', { name: 'PSR B1913+16 →' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pulsar de Hulse–Taylor');
  });

  test('estrelas e buracos negros', async ({ page, consoleErrors }) => {
    void consoleErrors;
    await openRoute(page, '#/estrelas/sirius');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sirius');
    await openRoute(page, '#/buracos-negros');
    await page.locator('.space-tabs a', { hasText: 'Fenómenos extremos' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fenómenos extremos');
  });

  test('exoplanetas', async ({ page, consoleErrors }) => {
    void consoleErrors;
    await openRoute(page, '#/exoplanetas');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
