import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.SMOKE_PORT || 3200);
const BASE = process.env.SMOKE_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'tests/smoke',
  timeout: 30_000,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/smoke.json' }]],
  use: { baseURL: BASE, trace: 'off' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.SMOKE_BASE_URL ? undefined : {
    command: `npx next start -p ${PORT}`, url: `${BASE}/api/health`, reuseExistingServer: false, timeout: 60_000,
    env: { CI_ENV: 'preview' },
  },
});
