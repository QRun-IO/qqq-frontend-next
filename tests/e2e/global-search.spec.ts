// E2E: GlobalSearch (header search bar) — results dropdown, navigation, Escape, error state

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

/** Locator for the GlobalSearch text input in the header. */
const searchInput = (page: import('@playwright/test').Page) =>
  page.locator('[data-qqq-id="header-search"] input[aria-label="Search records"]')

/** Locator for the results dropdown listbox. */
const searchDropdown = (page: import('@playwright/test').Page) =>
  page.locator('[data-qqq-id="header-search"] [role="listbox"]')

/**
 * Types a query into the search input and waits for the dropdown to appear with results.
 * MSW's search handler does real fixture data matching, so results appear when there are matches.
 */
async function typeAndWaitForResults(page: import('@playwright/test').Page, query: string) {
  await searchInput(page).fill(query)
  // Wait for the debounce (300ms) + network + render — the dropdown appears once the query fires
  await expect(searchDropdown(page)).toBeVisible({ timeout: 8000 })
}

/**
 * Types a query and waits for result OPTIONS (not just the dropdown).
 * Use this when tests need to interact with individual search results.
 */
async function typeAndWaitForOptions(page: import('@playwright/test').Page, query: string) {
  await searchInput(page).fill(query)
  // Wait for [role="option"] items to appear (requires both dropdown and results)
  await expect(
    searchDropdown(page).locator('[role="option"]').first()
  ).toBeVisible({ timeout: 10000 })
}

test.describe('GlobalSearch (header search)', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page)
    await page.goto('/')
    await waitForAppReady(page)
  })

  test('search input is visible in the header', async ({ page }) => {
    await expect(searchInput(page)).toBeVisible({ timeout: 10000 })
  })

  test('typing at least 2 characters triggers a search and shows the dropdown', async ({ page }) => {
    // MSW search handler matches 'Ali' against Alice Johnson in fixture data
    await typeAndWaitForResults(page, 'Ali')
    await expect(searchDropdown(page)).toBeVisible()
  })

  test('search results contain record labels', async ({ page }) => {
    // MSW fixture has Alice Johnson — searching 'Ali' should return her
    await typeAndWaitForOptions(page, 'Ali')
    await expect(searchDropdown(page).getByText('Alice Johnson')).toBeVisible({ timeout: 5000 })
  })

  test('results are grouped by table label', async ({ page }) => {
    // MSW fixture has person records → tableLabel = 'People'
    await typeAndWaitForOptions(page, 'Ali')
    // "People" appears as both a group heading and a subtitle in result items — match the first occurrence
    await expect(searchDropdown(page).getByText('People').first()).toBeVisible({ timeout: 5000 })
  })

  test('clicking a result navigates to the correct record route', async ({ page }) => {
    await typeAndWaitForOptions(page, 'Ali')

    // Click the first result option
    const firstResult = searchDropdown(page).locator('[role="option"]').first()
    await expect(firstResult).toBeVisible({ timeout: 5000 })
    await firstResult.click()

    // Dropdown should close
    await expect(searchDropdown(page)).not.toBeVisible({ timeout: 5000 })
    // URL should contain a record path for a person
    await expect(page).toHaveURL(/\/app\/person\/\d+/, { timeout: 10000 })
  })

  test('pressing Escape closes the dropdown', async ({ page }) => {
    await typeAndWaitForResults(page, 'Ali')
    await expect(searchDropdown(page)).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(searchDropdown(page)).not.toBeVisible({ timeout: 5000 })
  })

  test('shows empty state when no results match', async ({ page }) => {
    // This string matches nothing in the MSW fixtures
    await searchInput(page).fill('zzznoresults')
    await expect(searchDropdown(page)).toBeVisible({ timeout: 8000 })

    // "No results found" message
    await expect(searchDropdown(page).getByText(/no results found/i)).toBeVisible({ timeout: 8000 })
  })

  test('shows "Search unavailable" on API error', async ({ page }) => {
    // MSW search handler returns 500 for the magic term '__error__'
    await searchInput(page).fill('__error__')

    // Wait for debounce + 1 TanStack Query retry (retry: 1 in query-client.ts → 2 attempts)
    await expect(searchDropdown(page)).toBeVisible({ timeout: 10000 })
    await expect(searchDropdown(page).getByText('Search unavailable')).toBeVisible({ timeout: 15000 })
  })

  test('typing fewer than 2 characters does not show search results', async ({ page }) => {
    // Type only 1 character — should not trigger the search API (debounce min: 2 chars)
    await searchInput(page).fill('A')

    // The dropdown should not show search results (no [role="option"] items)
    // Wait briefly for any debounce-triggered render
    await page.waitForTimeout(600)
    // Either dropdown is not visible, or visible but shows no [role="option"] items
    const dropdown = searchDropdown(page)
    const isVisible = await dropdown.isVisible()
    if (isVisible) {
      const options = await dropdown.locator('[role="option"]').count()
      expect(options).toBe(0)
    }
  })

  test('shows "Press Enter to search all records" hint when results exist', async ({ page }) => {
    await typeAndWaitForOptions(page, 'Ali')

    // Footer hint should be visible
    await expect(
      page.locator('[data-qqq-id="header-search"]').getByText(/press enter to search all records/i)
    ).toBeVisible({ timeout: 5000 })
  })

  test('pressing Enter with no result selected navigates to search page', async ({ page }) => {
    // Search for something that matches nothing → empty state → press Enter
    await searchInput(page).fill('zzznoresults')
    await expect(searchDropdown(page)).toBeVisible({ timeout: 8000 })

    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/app\/search\?q=zzznoresults/, { timeout: 10000 })
  })

  test('keyboard arrow navigation moves selection through items', async ({ page }) => {
    await typeAndWaitForOptions(page, 'Ali')

    const firstOption = searchDropdown(page).locator('[role="option"]').first()
    await expect(firstOption).toBeVisible({ timeout: 5000 })

    // Press ArrowDown to select the first item
    await page.keyboard.press('ArrowDown')

    // The first option should be selected
    await expect(firstOption).toHaveAttribute('aria-selected', 'true', { timeout: 3000 })
  })

  test('clicking outside the dropdown closes it', async ({ page }) => {
    await typeAndWaitForResults(page, 'Ali')
    await expect(searchDropdown(page)).toBeVisible()

    // Click somewhere well outside the search bar — use main content area
    await page.locator('[data-qqq-id="main-content"]').click({ position: { x: 50, y: 300 } })

    await expect(searchDropdown(page)).not.toBeVisible({ timeout: 5000 })
  })

  test('search input has correct ARIA attributes', async ({ page }) => {
    const input = searchInput(page)
    await expect(input).toHaveAttribute('role', 'combobox')
    await expect(input).toHaveAttribute('aria-haspopup', 'listbox')
    await expect(input).toHaveAttribute('aria-autocomplete', 'list')
  })
})
