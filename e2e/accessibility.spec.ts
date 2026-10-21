import AxeBuilder from '@axe-core/playwright';
import { test, expect, openRoute } from './fixtures';

/**
 * Verificação automática de acessibilidade (axe-core, regras WCAG 2.1 A e AA).
 * Falha com problemas graves ou críticos.
 */
const PAGES = ['#/sistema-solar', '#/objeto/terra', '#/planetario', '#/missoes', '#/missoes/hubble', '#/linha-temporal', '#/fenomenos-extremos', '#/espaco-profundo', '#/estrelas', '#/exoplanetas', '#/dados', '#/favoritos', '#/asteroides-e-cometas', '#/asteroides-e-cometas/67p', '#/espaco-profundo/ngc3372', '#/mapa-estelar'];

for (const hash of PAGES) {
  test(`acessibilidade de ${hash}`, async ({ page, consoleErrors }) => {
    void consoleErrors;
    await openRoute(page, hash);
    await page.waitForTimeout(1200);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(
      serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`),
    ).toEqual([]);
  });
}
