import AxeBuilder from '@axe-core/playwright';
import { test, expect, openRoute } from './fixtures';

test.describe('visita guiada', () => {
  test.use({ firstVisit: true });

  test('oferecida na primeira visita, navegável e lembrada', async ({ page, consoleErrors }) => {
    void consoleErrors;
    await openRoute(page, '#/sistema-solar');
    const offer = page.locator('.tour-offer');
    await expect(offer).toBeVisible();
    await offer.getByRole('button', { name: 'Fazer a visita' }).click();

    const dialog = page.locator('dialog.tour-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('Bem-vindo ao Universe Infinity');
    const axe = await new AxeBuilder({ page }).include('dialog.tour-dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(axe.violations).toEqual([]);

    await dialog.getByRole('button', { name: 'Seguinte' }).click();
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('Explorar em 3D');
    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('O céu de qualquer lugar');
    await dialog.getByRole('button', { name: 'Abrir o planetário' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/#\/planetario$/);

    // Depois de vista, a oferta não volta a aparecer, mas a visita continua no menu "Mais"
    await page.reload();
    await expect(page.locator('#main')).toBeVisible();
    await expect(page.locator('.tour-offer')).toHaveCount(0);
    await page.getByRole('button', { name: 'Mais' }).click();
    await page.getByRole('button', { name: 'Visita guiada' }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('Bem-vindo ao Universe Infinity');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('na vista 3D a oferta aparece no cartão "Como explorar"', async ({ page, consoleErrors }) => {
    void consoleErrors;
    await openRoute(page, '#/');
    const hint = page.locator('.hint-card');
    await expect(hint).toBeVisible();
    await expect(page.locator('.tour-offer')).toHaveCount(0);
    await hint.getByRole('button', { name: 'Percebi' }).click();
    await expect(hint).toHaveCount(0);
    await expect(page.locator('.tour-offer')).toHaveCount(0);
  });
});
