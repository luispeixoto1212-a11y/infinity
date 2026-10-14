import { defineConfig, devices } from '@playwright/test';

/**
 * Testes de interface num navegador real (Chromium), sobre a versão de produção (vite build + vite preview).
 * Correr com `npm run test:e2e`. Na primeira vez: `npx playwright install chromium`.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    trace: 'retain-on-failure',
    locale: 'pt-PT',
    timezoneId: 'Europe/Lisbon',
    // WebGL por software, para a vista 3D funcionar em máquinas sem GPU (como a integração contínua)
    launchOptions: { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  projects: [
    { name: 'computador', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'telemovel', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
