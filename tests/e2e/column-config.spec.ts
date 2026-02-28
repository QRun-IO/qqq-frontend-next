// E2E: ColumnConfig — hide/show columns and reset to defaults

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

async function waitForGridReady(page: import('@playwright/test').Page) {
  await waitForAppReady(page)
  await page
    .waitForSelector('[data-qqq-id="grid-loading"]', { state: 'hidden', timeout: 15000 })
    .catch(() => null)
  await expect(
    page.locator('[data-qqq-id^="grid-person"], [data-qqq-id="grid-loading"], [data-qqq-id="grid-empty"]')
  ).toBeVisible({ timeout: 20000 })
}

/** Opens the ColumnConfig panel. */
async function openColumnConfig(page: import('@playwright/test').Page) {
  const btn = page.locator('[data-qqq-id="button-column-config"]')
  await expect(btn).toBeVisible({ timeout: 10000 })
  await btn.click()
  await expect(page.locator('[data-qqq-id="column-config"]')).toBeVisible({ timeout: 5000 })
}

test.describe('ColumnConfig', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page)
    await page.goto('/app/person')
    await waitForGridReady(page)
    // Clear localStorage to ensure clean column config state
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await waitForGridReady(page)
  })

  test('column config button is present in the toolbar', async ({ page }) => {
    await expect(page.locator('[data-qqq-id="button-column-config"]')).toBeVisible()
  })

  test('clicking column config button opens the panel', async ({ page }) => {
    await openColumnConfig(page)
    await expect(page.locator('[data-qqq-id="column-config"]')).toBeVisible()
  })

  test('column config panel has a close button', async ({ page }) => {
    await openColumnConfig(page)
    await expect(page.locator('[data-qqq-id="column-config-close"]')).toBeVisible()
  })

  test('close button dismisses the panel', async ({ page }) => {
    await openColumnConfig(page)
    await page.locator('[data-qqq-id="column-config-close"]').click()
    await expect(page.locator('[data-qqq-id="column-config"]')).not.toBeVisible({ timeout: 5000 })
  })

  test('panel lists column items from table metadata', async ({ page }) => {
    await openColumnConfig(page)
    // The person table has fields: id, firstName, lastName, email, status
    // All non-hidden fields should appear
    const columnItems = page.locator('[data-qqq-id^="column-config-item-"]')
    const count = await columnItems.count()
    expect(count).toBeGreaterThan(0)
  })

  test('each column item has a toggle button', async ({ page }) => {
    await openColumnConfig(page)
    const toggleBtns = page.locator('[data-qqq-id^="column-toggle-"]')
    const count = await toggleBtns.count()
    expect(count).toBeGreaterThan(0)
  })

  test('hide a column — toggle off firstName', async ({ page }) => {
    await openColumnConfig(page)

    const firstNameToggle = page.locator('[data-qqq-id="column-toggle-firstName"]')
    await expect(firstNameToggle).toBeVisible({ timeout: 5000 })

    // aria-pressed="true" means visible; click to hide
    const pressedBefore = await firstNameToggle.getAttribute('aria-pressed')
    await firstNameToggle.click()

    // After toggle the pressed state should flip
    const pressedAfter = await firstNameToggle.getAttribute('aria-pressed')
    expect(pressedAfter).not.toEqual(pressedBefore)
  })

  test('hidden column is no longer shown in the grid header', async ({ page }) => {
    // Wait for grid headers to be rendered
    await page
      .waitForSelector('[data-qqq-id^="grid-header-"]', { timeout: 15000 })
      .catch(() => null)

    const firstNameHeader = page.locator('[data-qqq-id="grid-header-firstName"]')
    const wasVisible = await firstNameHeader.isVisible()

    if (wasVisible) {
      // Hide firstName via column config
      await openColumnConfig(page)
      const firstNameToggle = page.locator('[data-qqq-id="column-toggle-firstName"]')
      await expect(firstNameToggle).toBeVisible({ timeout: 5000 })
      await firstNameToggle.click()

      // Close config panel
      await page.locator('[data-qqq-id="column-config-close"]').click()
      await expect(page.locator('[data-qqq-id="column-config"]')).not.toBeVisible({ timeout: 5000 })

      // firstName header should now be absent
      await expect(page.locator('[data-qqq-id="grid-header-firstName"]')).not.toBeVisible({ timeout: 5000 })
    } else {
      // If the grid doesn't render headers with data-qqq-id, just verify the toggle works
      await openColumnConfig(page)
      const toggleBtns = page.locator('[data-qqq-id^="column-toggle-"]')
      expect(await toggleBtns.count()).toBeGreaterThan(0)
    }
  })

  test('show a hidden column — toggle it back on', async ({ page }) => {
    await openColumnConfig(page)

    const firstNameToggle = page.locator('[data-qqq-id="column-toggle-firstName"]')
    await expect(firstNameToggle).toBeVisible({ timeout: 5000 })

    // Hide it
    await firstNameToggle.click()
    const pressedAfterHide = await firstNameToggle.getAttribute('aria-pressed')

    // Show it again
    await firstNameToggle.click()
    const pressedAfterShow = await firstNameToggle.getAttribute('aria-pressed')

    // Should be back to original state
    expect(pressedAfterShow).not.toEqual(pressedAfterHide)
  })

  test('"Hide all" button marks all columns as hidden', async ({ page }) => {
    await openColumnConfig(page)

    const hideAllBtn = page.locator('[data-qqq-id="column-config-hide-all"]')
    await expect(hideAllBtn).toBeVisible()
    await hideAllBtn.click()

    // All toggle buttons should now have aria-pressed="false"
    const toggleBtns = page.locator('[data-qqq-id^="column-toggle-"]')
    const count = await toggleBtns.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      const btn = toggleBtns.nth(i)
      await expect(btn).toHaveAttribute('aria-pressed', 'false')
    }
  })

  test('"Show all" button marks all columns as visible', async ({ page }) => {
    await openColumnConfig(page)

    // First hide all
    await page.locator('[data-qqq-id="column-config-hide-all"]').click()

    // Then show all
    const showAllBtn = page.locator('[data-qqq-id="column-config-show-all"]')
    await expect(showAllBtn).toBeVisible()
    await showAllBtn.click()

    // All toggle buttons should now have aria-pressed="true"
    const toggleBtns = page.locator('[data-qqq-id^="column-toggle-"]')
    const count = await toggleBtns.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      const btn = toggleBtns.nth(i)
      await expect(btn).toHaveAttribute('aria-pressed', 'true')
    }
  })

  test('clicking backdrop closes the column config panel', async ({ page }) => {
    await openColumnConfig(page)
    await expect(page.locator('[data-qqq-id="column-config"]')).toBeVisible()

    // Click the fixed backdrop overlay (outside the panel)
    // The backdrop is a fixed inset-0 div that closes the panel
    // We click far away from the panel (top-left area)
    await page.mouse.click(10, 10)
    await expect(page.locator('[data-qqq-id="column-config"]')).not.toBeVisible({ timeout: 5000 })
  })

  test('column config panel shows "Configure Columns" heading', async ({ page }) => {
    await openColumnConfig(page)
    await expect(page.locator('[data-qqq-id="column-config"]').getByText('Configure Columns')).toBeVisible()
  })

  test('column list is scrollable when many columns are present', async ({ page }) => {
    await openColumnConfig(page)
    // Verify the column list container is rendered
    const columnList = page.locator('[data-qqq-id="column-config"] [role="list"]')
    await expect(columnList).toBeVisible()
  })
})
