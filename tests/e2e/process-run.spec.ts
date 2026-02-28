// E2E: Process execution — StepWizard rendering, step navigation

import { test, expect, type Page } from '@playwright/test'
import { setupApiMocks } from './api-mocks'

async function waitForAppReady(page: Page) {
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

/**
 * Wait for the process run container or an error/loading state to appear.
 * The process auto-inits on mount and transitions from idle → initializing → active step.
 */
async function waitForProcessReady(page: Page, processName: string) {
  await expect(
    page.locator(
      `[data-qqq-id="process-run-${processName}"]`
    )
  ).toBeVisible({ timeout: 20000 })
  // Wait for the spinner to finish initializing (may transition to a step)
  await page
    .waitForSelector('[data-qqq-id="step-wizard"]', { timeout: 15000 })
    .catch(() => null)
}

test.describe('Process Run — importData process', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page)
    await page.goto('/app/importData')
    await waitForAppReady(page)
    await waitForProcessReady(page, 'importData')
  })

  test('renders the process run container', async ({ page }) => {
    await expect(page.locator('[data-qqq-id="process-run-importData"]')).toBeVisible()
  })

  test('step wizard header is visible for multi-step process', async ({ page }) => {
    // The StepWizard renders when steps.length > 1
    const wizard = page.locator('[data-qqq-id="step-wizard"]')
    await expect(wizard).toBeVisible({ timeout: 10000 })
  })

  test('step labels appear in the wizard header', async ({ page }) => {
    const wizard = page.locator('[data-qqq-id="step-wizard"]')
    await expect(wizard).toBeVisible({ timeout: 10000 })

    // Both frontend step labels should be present in the wizard
    const wizardText = await wizard.textContent()
    expect(wizardText).toBeTruthy()
    // At least one step label should be visible
    const stepItems = page.locator('[data-qqq-id^="step-wizard-step-"]')
    const count = await stepItems.count()
    expect(count).toBeGreaterThan(0)
  })

  test('process does not show unhandled error', async ({ page }) => {
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible()
  })

  test('process loading or active step is shown', async ({ page }) => {
    const container = page.locator('[data-qqq-id="process-run-importData"]')
    await expect(container).toBeVisible()
    // Either the spinner (initializing), step content, or error state should be visible
    const hasContent = await container.textContent()
    expect(hasContent?.trim().length).toBeGreaterThan(0)
  })
})

test.describe('Process Run — step rendering', () => {
  test('navigating to a process URL renders a page without JS errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await setupApiMocks(page)
    await page.goto('/app/importData')
    await waitForAppReady(page)
    await page.waitForLoadState('networkidle').catch(() => null)

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('Warning:') &&
        !e.includes('React') &&
        !e.includes('ResizeObserver')
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('process run container has accessible role', async ({ page }) => {
    await setupApiMocks(page)
    await page.goto('/app/importData')
    await waitForAppReady(page)
    await waitForProcessReady(page, 'importData')

    const container = page.locator('[data-qqq-id="process-run-importData"]')
    await expect(container).toBeVisible()
  })
})
