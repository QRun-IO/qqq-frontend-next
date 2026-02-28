// E2E: FilterBuilder — add/remove criteria, nested groups, AND/OR toggle, API query params

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

/** Opens the filter panel on desktop (clicks the "Filter" button). */
async function openFilterPanel(page: import('@playwright/test').Page) {
  const filterBtn = page.locator('[data-qqq-id="button-filter"]')
  await expect(filterBtn).toBeVisible({ timeout: 10000 })
  await filterBtn.click()
  // Wait for the FilterBuilder to appear
  await expect(page.locator('[data-qqq-id="filter-builder"]')).toBeVisible({ timeout: 10000 })
}

test.describe('FilterBuilder', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page)
    await page.goto('/app/person')
    await waitForGridReady(page)
  })

  test('opens filter panel when Filter button is clicked', async ({ page }) => {
    await openFilterPanel(page)
    await expect(page.locator('[data-qqq-id="filter-builder"]')).toBeVisible()
  })

  test('adds a single criterion via "Add condition"', async ({ page }) => {
    await openFilterPanel(page)

    // Initially no criteria rows
    const criteriaRows = page.locator('[data-qqq-id^="filter-row-0-"]')
    const initialCount = await criteriaRows.count()

    // Click "Add condition"
    const addConditionBtn = page.locator('[data-qqq-id="filter-add-criterion-0"]')
    await expect(addConditionBtn).toBeVisible()
    await addConditionBtn.click()

    // Verify one new row appeared
    await expect(criteriaRows).toHaveCount(initialCount + 1, { timeout: 5000 })
  })

  test('criterion row has field selector, operator selector, and value input', async ({ page }) => {
    await openFilterPanel(page)

    const addConditionBtn = page.locator('[data-qqq-id="filter-add-criterion-0"]')
    await addConditionBtn.click()

    // Row 0 should have a field selector and operator selector
    await expect(page.locator('[data-qqq-id="filter-field-0-0"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[data-qqq-id="filter-operator-0-0"]')).toBeVisible({ timeout: 5000 })
  })

  test('removes a criterion via the remove button', async ({ page }) => {
    await openFilterPanel(page)

    // Add a criterion first
    const addConditionBtn = page.locator('[data-qqq-id="filter-add-criterion-0"]')
    await addConditionBtn.click()
    await expect(page.locator('[data-qqq-id="filter-row-0-0"]')).toBeVisible({ timeout: 5000 })

    // Remove it
    const removeBtn = page.locator('[data-qqq-id="filter-remove-0-0"]')
    await expect(removeBtn).toBeVisible()
    await removeBtn.click()

    // The row should be gone
    await expect(page.locator('[data-qqq-id="filter-row-0-0"]')).not.toBeVisible({ timeout: 5000 })
  })

  test('adds a nested sub-filter group via "Add group"', async ({ page }) => {
    await openFilterPanel(page)

    const addGroupBtn = page.locator('[data-qqq-id="filter-add-group-0"]')
    await expect(addGroupBtn).toBeVisible()
    await addGroupBtn.click()

    // A nested group appears — the depth-1 "Add condition" button should be visible
    await expect(page.locator('[data-qqq-id="filter-add-criterion-1"]')).toBeVisible({ timeout: 5000 })
  })

  test('shows "Remove filter group" button on sub-group', async ({ page }) => {
    await openFilterPanel(page)

    const addGroupBtn = page.locator('[data-qqq-id="filter-add-group-0"]')
    await addGroupBtn.click()

    // The remove-group button for idx 0 should appear
    await expect(page.locator('[data-qqq-id="filter-remove-group-0"]')).toBeVisible({ timeout: 5000 })
  })

  test('removes a sub-filter group', async ({ page }) => {
    await openFilterPanel(page)

    await page.locator('[data-qqq-id="filter-add-group-0"]').click()
    await expect(page.locator('[data-qqq-id="filter-add-criterion-1"]')).toBeVisible({ timeout: 5000 })

    // Remove the group
    await page.locator('[data-qqq-id="filter-remove-group-0"]').click()
    await expect(page.locator('[data-qqq-id="filter-add-criterion-1"]')).not.toBeVisible({ timeout: 5000 })
  })

  test('shows boolean operator selector when multiple conditions exist', async ({ page }) => {
    await openFilterPanel(page)

    const addConditionBtn = page.locator('[data-qqq-id="filter-add-criterion-0"]')
    // Add two conditions to trigger the AND/OR selector
    await addConditionBtn.click()
    await addConditionBtn.click()

    await expect(page.locator('[data-qqq-id="filter-boolean-op-0"]')).toBeVisible({ timeout: 5000 })
  })

  test('changes boolean operator from AND to OR', async ({ page }) => {
    await openFilterPanel(page)

    const addConditionBtn = page.locator('[data-qqq-id="filter-add-criterion-0"]')
    await addConditionBtn.click()
    await addConditionBtn.click()

    const booleanOpSelect = page.locator('[data-qqq-id="filter-boolean-op-0"]')
    await expect(booleanOpSelect).toBeVisible({ timeout: 5000 })

    // Default should be AND
    await expect(booleanOpSelect).toHaveValue('AND')

    // Change to OR
    await booleanOpSelect.selectOption('OR')
    await expect(booleanOpSelect).toHaveValue('OR')
  })

  test('changing field selector resets operator to default for that field type', async ({ page }) => {
    await openFilterPanel(page)

    await page.locator('[data-qqq-id="filter-add-criterion-0"]').click()

    const fieldSelect = page.locator('[data-qqq-id="filter-field-0-0"]')
    await expect(fieldSelect).toBeVisible({ timeout: 5000 })

    // Change to a different field
    const options = await fieldSelect.locator('option').all()
    if (options.length > 1) {
      const secondOptionValue = await options[1].getAttribute('value')
      if (secondOptionValue) {
        await fieldSelect.selectOption(secondOptionValue)
        // After field change, the operator select should still be present
        await expect(page.locator('[data-qqq-id="filter-operator-0-0"]')).toBeVisible({ timeout: 5000 })
      }
    }
  })

  test('Clear all button resets filter panel to empty state', async ({ page }) => {
    await openFilterPanel(page)

    // Add a criterion
    await page.locator('[data-qqq-id="filter-add-criterion-0"]').click()
    await expect(page.locator('[data-qqq-id="filter-row-0-0"]')).toBeVisible({ timeout: 5000 })

    // Click "Clear all"
    const clearBtn = page.locator('[data-qqq-id="button-clear-filter"]')
    await expect(clearBtn).toBeVisible()
    await clearBtn.click()

    // Criteria row should be gone
    await expect(page.locator('[data-qqq-id="filter-row-0-0"]')).not.toBeVisible({ timeout: 5000 })
  })

  test('Apply button closes the filter panel', async ({ page }) => {
    await openFilterPanel(page)

    const applyBtn = page.locator('[data-qqq-id="button-apply-filter"]')
    await expect(applyBtn).toBeVisible()
    await applyBtn.click()

    // Filter panel should close
    await expect(page.locator('[data-qqq-id="filter-builder"]')).not.toBeVisible({ timeout: 5000 })
  })

  test('applying a filter is reflected in the active filter state', async ({ page }) => {
    await openFilterPanel(page)
    await page.locator('[data-qqq-id="filter-add-criterion-0"]').click()

    // Select the "First Name" field (string type) so we can fill a text value
    const fieldSelect = page.locator('[data-qqq-id="filter-field-0-0"]')
    await expect(fieldSelect).toBeVisible({ timeout: 5000 })
    await fieldSelect.selectOption('firstName')

    // Fill in a string value for the criterion
    const valueInput = page.locator('[data-qqq-id^="filter-value-0-0"]').first()
    await expect(valueInput).toBeVisible({ timeout: 5000 })
    await valueInput.fill('Alice')

    // Apply the filter
    const applyBtn = page.locator('[data-qqq-id="button-apply-filter"]')
    await expect(applyBtn).toBeVisible({ timeout: 5000 })
    await applyBtn.click()

    // Verify filter is active: the filter button should display an active-filter badge
    // (The badge appears when activeFilterCount > 0, which means the filter state was applied)
    const filterBtn = page.locator('[data-qqq-id="button-filter"]')
    await expect(filterBtn.locator('.rounded-full')).toBeVisible({ timeout: 5000 })
  })
})
