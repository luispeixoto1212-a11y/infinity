import { test, expect, openRoute, expectNoHorizontalScroll } from './fixtures';

const ROUTES = ['#/sistema-solar', '#/objeto/saturno', '#/planetario', '#/missoes', '#/missoes/perseverance', '#/linha-temporal', '#/fenomenos-extremos', '#/espaco-profundo', '#/exoplanetas', '#/dados', '#/asteroides-e-cometas', '#/asteroides-e-cometas/bennu'];

for (const hash of ROUTES) {
  test(`sem deslocamento horizontal em ${hash}`, async ({ page, consoleErrors }) => {
    void consoleErrors;
    await openRoute(page, hash);
    await page.waitForTimeout(800);
    await expectNoHorizontalScroll(page);
  });
}

test('menu móvel mostra todas as secções', async ({ page, consoleErrors }) => {
  void consoleErrors;
  await openRoute(page, '#/sistema-solar');
  await page.locator('.nav-toggle').click();
  for (const href of ['#/planetario', '#/missoes', '#/linha-temporal', '#/favoritos', '#/dados']) {
    await expect(page.locator(`.nav.is-open a[href="${href}"]`)).toBeVisible();
  }
});
