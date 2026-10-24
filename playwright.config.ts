import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env['CI']);

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: 0,
  reporter: CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    // Social tags need an absolute origin; point them at the preview server (FR-132).
    env: { SITE_URL: 'http://localhost:4173' },
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
  // Firefox and WebKit join in T072, once they can be verified locally as well.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
