import { defineConfig, devices } from '@playwright/test'

// The acceptance sample does not install qbit-collaboration. Exercise the real browser
// MSW handlers instead, retaining all five acceptance device profiles and zero retries.
// The main e2e suite answers API calls with page.route mocks and never starts MSW, so this
// spec needs its own NEXT_PUBLIC_MOCK_API=true server.
// localhost, not 127.0.0.1: `next dev` serves dev resources only to its own host name and
// blocks them for 127.0.0.1, so the client never hydrates and MSW never starts.
const port = Number(process.env.QQQ_E2E_PORT || 3107)
const baseURL = `http://localhost:${port}`
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['collaboration-favorites.spec.ts', 'collaboration-record-panel.spec.ts', 'collaboration-presence-share-tasks.spec.ts'],
  outputDir: './test-results/collaboration/artifacts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/collaboration/report.json' }]],
  use: {
    baseURL,
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'tablet', use: { ...devices['iPad (gen 7)'] } },
  ],
  webServer: {
    command: `pnpm dev --port ${port}`,
    url: baseURL,
    env: { NEXT_PUBLIC_MOCK_API: 'true' },
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
