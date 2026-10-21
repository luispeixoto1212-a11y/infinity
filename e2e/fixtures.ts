import { test as base, expect, type Page } from '@playwright/test';

/**
 * Página de teste sem dependências externas: as fontes do Google são bloqueadas e a NASA Image and Video
 * Library devolve uma lista vazia. No fim de cada teste, verifica que não houve erros na consola.
 * Salvo indicação em contrário (firstVisit), a visita guiada é dada como vista, para a oferta não tapar a interface.
 */
export const test = base.extend<{ consoleErrors: string[]; firstVisit: boolean }>({
  /** Simula uma primeira visita (com a oferta da visita guiada). Por omissão, a visita já foi vista. */
  firstVisit: [false, { option: true }],
  consoleErrors: async ({ page, firstVisit }, use) => {
    if (!firstVisit) {
      await page.addInitScript(() => {
        try {
          if (localStorage.getItem('universe-infinity:tour') === null) localStorage.setItem('universe-infinity:tour', 'true');
        } catch {
          /* sem armazenamento local */
        }
      });
    }
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.route(/images-api\.nasa\.gov/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"collection":{"items":[]}}' }));
    await use(errors);
    expect(errors, 'erros na consola').toEqual([]);
  },
});

export { expect };

/** Abre uma rota da aplicação (hash) e espera que o conteúdo principal esteja pronto. */
export async function openRoute(page: Page, hash: string) {
  await page.goto(`./${hash}`);
  await expect(page.locator('#main')).toBeVisible();
}

/** Garante que a página não tem deslocamento horizontal. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}
