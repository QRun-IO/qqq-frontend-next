import { defineConfig, devices } from '@playwright/test'

// Mocked e2e suite: every API call is answered by page.route mocks (tests/e2e/api-mocks.ts),
// so no backend runs.
// - QQQ_E2E_PORT: the frontend port (default 3000).
// - QQQ_E2E_SERVER=production: serve the standalone build from `pnpm build` (what CI runs:
//   no on-demand compilation, so no first-hit timeouts); otherwise `pnpm dev`.
const port = Number(process.env.QQQ_E2E_PORT || 3000)
const baseURL = `http://127.0.0.1:${port}`
const production = process.env.QQQ_E2E_SERVER === 'production'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries: a test that needs one is flaky and must be fixed, not re-run.
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'html',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: production ? 'node scripts/e2e-server.mjs' : `pnpm dev --port ${port}`,
    url: baseURL,
    env: { QQQ_E2E_PORT: String(port) },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
