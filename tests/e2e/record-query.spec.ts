// E2E: Record Query — list view, filtering, pagination

import { test, expect } from '@playwright/test'
import { setupApiMocks } from './api-mocks'

async function waitForAppReady(page: import('@playwright/test').Page) {
  await page
    .waitForSelector('[role="status"][aria-label="Loading"]', {
      state: 'hidden',
      timeout: 30000,
    })
    .catch(() => null)
  await expect(page.locator('[data-qqq-id="main-content"]')).toBeVisible({ timeout: 30000 })
  await page
    .waitForSelector('[aria-label="Loading content"]', { state: 'hidden', timeout: 15000 })
    .catch(() => null)
}

test.describe('Record Query (list view)', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page)
    await page.goto('/app/person')
    await waitForAppReady(page)
    // Wait for the grid to appear — either loading or populated state
    await expect(
      page.locator('[data-qqq-id^="grid-person"], [data-qqq-id="grid-loading"], [data-qqq-id="grid-empty"]')
    ).toBeVisible({ timeout: 20000 })
  })

  test('renders the data grid container', async ({ page }) => {
    const grid = page.locator('[data-qqq-id^="grid-"]').first()
    await expect(grid).toBeVisible()
  })

  test('shows column headers once data is loaded', async ({ page }) => {
    await page
      .waitForSelector('[data-qqq-id="grid-loading"]', { state: 'hidden', timeout: 15000 })
      .catch(() => null)
    const headers = page.locator('[data-qqq-id^="grid-header-"]')
    const count = await headers.count()
    expect(count).toBeGreaterThan(0)
  })

  test('shows data rows once loaded', async ({ page }) => {
    await page
      .waitForSelector('[data-qqq-id="grid-loading"]', { state: 'hidden', timeout: 15000 })
      .catch(() => null)
    const rows = page.locator('[data-qqq-id^="grid-row-"]')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
  })

  test('toolbar contains action buttons', async ({ page }) => {
    const buttons = page.getByRole('button')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(0)
  })

  test('page loads without JavaScript errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await setupApiMocks(page)
    await page.goto('/app/person')
    await waitForAppReady(page)
    await page.waitForLoadState('networkidle')
    const criticalErrors = errors.filter(
      (e) => !e.includes('Warning:') && !e.includes('React')
    )
    expect(criticalErrors).toHaveLength(0)
  })
})
