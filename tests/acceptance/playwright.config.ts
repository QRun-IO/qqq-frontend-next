/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { defineConfig, devices } from '@playwright/test'
import { ACCEPTANCE_BACKEND_PORT, ACCEPTANCE_FRONTEND_PORT, ACCEPTANCE_MODE, ACCEPTANCE_UI_URL } from './support/ports'

/**
 * Real-backend acceptance: the owned sample JAR on loopback serving the production
 * Next build (see ACCEPTANCE_MODE). Started by `scripts/acceptance.mjs`, which builds first.
 * Retries stay at zero so a flaky scenario fails the gate instead of passing silently.
 */
const browsers = (process.env.QQQ_ACCEPTANCE_BROWSERS ?? 'chromium').split(',')
const MOBILE_TAG = /@mobile\b/
const deviceFor: Record<string, (typeof devices)[string]> = {
  chromium: devices['Desktop Chrome'],
  firefox: devices['Desktop Firefox'],
  webkit: devices['Desktop Safari'],
  mobile: devices['Pixel 7'],
}

export default defineConfig({
  testDir: './specs',
  outputDir: '../../test-results/acceptance/artifacts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: '../../test-results/acceptance/report.json' }],
    ['html', { outputFolder: '../../test-results/acceptance/html', open: 'never' }],
  ],
  use: {
    baseURL: ACCEPTANCE_UI_URL,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // The phone project runs the specs that prove phone behavior (tagged @mobile in the title):
  // navigation drawer, card list, record view, form, process run, dialogs and sign-in. The
  // desktop projects run everything; desktop-only layouts (grid columns, resizing, grid
  // keyboard navigation) are not phone scenarios. See docs/acceptance/browser-matrix.md.
  projects: browsers.map((name) => ({ name, use: { ...deviceFor[name] }, ...(name === 'mobile' ? { grep: MOBILE_TAG } : {}) })),
  webServer: [
    {
      command: 'node scripts/acceptance-backend.mjs',
      cwd: '../..',
      url: `http://127.0.0.1:${ACCEPTANCE_BACKEND_PORT}/acceptance/ready`,
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    ...(ACCEPTANCE_MODE === 'standalone'
      ? [{
          command: 'node scripts/acceptance-frontend.mjs',
          cwd: '../..',
          url: `http://127.0.0.1:${ACCEPTANCE_FRONTEND_PORT}/login`,
          timeout: 120_000,
          reuseExistingServer: false,
          stdout: 'pipe' as const,
          stderr: 'pipe' as const,
        }]
      : []),
  ],
})
