import { chromium } from '@playwright/test';
const b = await chromium.launch();
for (const route of ['#/', '#/missoes', '#/espaco-profundo/m31']) {
  const ctx = await b.newContext();
  await ctx.addInitScript(() => localStorage.setItem('universe-infinity:tour', 'true'));
  const p = await ctx.newPage();
  let js = 0, n = 0;
  p.on('response', async (r) => { if (r.url().endsWith('.js')) { try { js += (await r.body()).length; n++; } catch {} } });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.goto('http://localhost:4180/' + route, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  console.log(route, n, 'ficheiros JS', Math.round(js / 1024), 'KB');
  await ctx.close();
}
await b.close();
