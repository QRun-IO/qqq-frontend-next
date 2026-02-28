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

/** The search results that the mock API returns for any query of 2+ chars. */
const SEARCH_RESULTS = [
  { tableName: 'person', tableLabel: 'People', recordId: '1', recordLabel: 'Alice Johnson' },
  { tableName: 'person', tableLabel: 'People', recordId: '2', recordLabel: 'Bob Martinez' },
]

/** Overrides the globalSearch route to return SEARCH_RESULTS (must be called after setupApiMocks). */
async function mockSearchWithResults(page: import('@playwright/test').Page) {
  await page.route('**/qqq/v1/globalSearch**', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ results: SEARCH_RESULTS }),
    })
  })
}

/** Types a query into the search input and waits for the dropdown to appear. */
async function typeAndWaitForResults(page: import('@playwright/test').Page, query: string) {
  await searchInput(page).fill(query)
  // Wait for the debounce (300ms) + network + render
  await expect(searchDropdown(page)).toBeVisible({ timeout: 8000 })
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
    await mockSearchWithResults(page)
    await typeAndWaitForResults(page, 'Ali')
    await expect(searchDropdown(page)).toBeVisible()
  })

  test('search results contain record labels', async ({ page }) => {
    await mockSearchWithResults(page)
    await typeAndWaitForResults(page, 'Ali')

    // "Alice Johnson" should be present
    await expect(searchDropdown(page).getByText('Alice Johnson')).toBeVisible({ timeout: 5000 })
  })

  test('results are grouped by table label', async ({ page }) => {
    await mockSearchWithResults(page)
    await typeAndWaitForResults(page, 'Ali')

    // "People" table label should appear as a section heading
    await expect(searchDropdown(page).getByText('People')).toBeVisible({ timeout: 5000 })
  })

  test('clicking a result navigates to the correct record route', async ({ page }) => {
    await mockSearchWithResults(page)
    await typeAndWaitForResults(page, 'Ali')

    // Click the first result option
    const firstResult = searchDropdown(page).locator('[role="option"]').first()
    await expect(firstResult).toBeVisible({ timeout: 5000 })
    await firstResult.click()

    // Dropdown should close
    await expect(searchDropdown(page)).not.toBeVisible({ timeout: 5000 })
    // URL should contain the expected record path
    await expect(page).toHaveURL(/\/app\/person\/1/, { timeout: 10000 })
  })

  test('pressing Escape closes the dropdown', async ({ page }) => {
    await mockSearchWithResults(page)
    await typeAndWaitForResults(page, 'Ali')
    await expect(searchDropdown(page)).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(searchDropdown(page)).not.toBeVisible({ timeout: 5000 })
  })

  test('shows empty state when no results match', async ({ page }) => {
    // Override to return empty results
    await page.route('**/qqq/v1/globalSearch**', (route) => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ results: [] }),
      })
    })

    await typeAndWaitForResults(page, 'zzznoresults')

    // "No results found" message
    await expect(searchDropdown(page).getByText(/no results found/i)).toBeVisible({ timeout: 5000 })
  })

  test('shows "Search unavailable" on API error', async ({ page }) => {
    // Override to return a 500 error
    await page.route('**/qqq/v1/globalSearch**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      })
    })

    await searchInput(page).fill('error')

    // Wait for debounce + 1 TanStack Query retry (retry: 1 in query-client.ts → 2 attempts)
    // Give extra time for retries
    await expect(searchDropdown(page)).toBeVisible({ timeout: 10000 })
    await expect(searchDropdown(page).getByText('Search unavailable')).toBeVisible({ timeout: 10000 })
  })

  test('typing fewer than 2 characters does not trigger search API call', async ({ page }) => {
    let searchApiCalled = false
    await page.route('**/qqq/v1/globalSearch**', (route) => {
      searchApiCalled = true
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ results: [] }) })
    })

    // Type only 1 character — should not trigger the API
    await searchInput(page).fill('A')

    // Wait longer than the debounce (300ms) to confirm no call was made
    await page.waitForTimeout(600)
    expect(searchApiCalled).toBe(false)
  })

  test('shows "Press Enter to search all records" hint when results exist', async ({ page }) => {
    await mockSearchWithResults(page)
    await typeAndWaitForResults(page, 'Ali')

    // Footer hint should be visible
    await expect(
      page.locator('[data-qqq-id="header-search"]').getByText(/press enter to search all records/i)
    ).toBeVisible({ timeout: 5000 })
  })

  test('pressing Enter with no result selected navigates to search page', async ({ page }) => {
    await page.route('**/qqq/v1/globalSearch**', (route) => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ results: [] }),
      })
    })

    await typeAndWaitForResults(page, 'testquery')

    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/app\/search\?q=testquery/, { timeout: 10000 })
  })

  test('keyboard arrow navigation moves selection through items', async ({ page }) => {
    await mockSearchWithResults(page)
    await typeAndWaitForResults(page, 'Ali')

    // Wait for result items to be visible
    const firstOption = searchDropdown(page).locator('[role="option"]').first()
    await expect(firstOption).toBeVisible({ timeout: 5000 })

    // Press ArrowDown to select the first item
    await page.keyboard.press('ArrowDown')

    // The first option should be selected
    await expect(firstOption).toHaveAttribute('aria-selected', 'true', { timeout: 3000 })
  })

  test('clicking outside the dropdown closes it', async ({ page }) => {
    await mockSearchWithResults(page)
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
