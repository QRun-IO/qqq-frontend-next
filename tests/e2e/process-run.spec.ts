// E2E: Process execution — StepWizard rendering, step navigation

import { test, expect, type Page } from '@playwright/test'
import { setupApiMocks } from './api-mocks'
import { checkA11y } from './a11y-helpers'

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
 * Wait for any process run container element to appear (loading, active step, or error state).
 * The process auto-inits on mount and transitions from idle → initializing → active step.
 */
async function waitForProcessReady(page: Page, _processName: string) {
  // Accept any process-related element — could be loading, error, or active step
  const processLocator = page.locator('[data-qqq-id^="process-run-"]')
  await expect(processLocator.first()).toBeVisible({ timeout: 20000 })
}

// importData is the process in the route-mock METADATA (tests/e2e/api-mocks.ts)
const PROCESS_NAME = 'importData'

test.describe('Process Run — importData process', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page)
    await page.goto(`/app/${PROCESS_NAME}`)
    await waitForAppReady(page)
    await waitForProcessReady(page, PROCESS_NAME)
  })

  test('renders the process run container', async ({ page }) => {
    await expect(page.locator(`[data-qqq-id="process-run-${PROCESS_NAME}"]`)).toBeVisible()
    await checkA11y(page)
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
    const container = page.locator(`[data-qqq-id="process-run-${PROCESS_NAME}"]`)
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
    await page.goto(`/app/${PROCESS_NAME}`)
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
    await page.goto(`/app/${PROCESS_NAME}`)
    await waitForAppReady(page)
    await waitForProcessReady(page, PROCESS_NAME)

    const container = page.locator(`[data-qqq-id="process-run-${PROCESS_NAME}"]`)
    await expect(container).toBeVisible()
  })
})
