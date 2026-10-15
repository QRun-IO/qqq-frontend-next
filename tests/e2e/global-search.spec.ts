// E2E: Command palette search without record search — local matches over pages and recent records, keyboard, Escape

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

/** Locator for the command palette combobox opened from the header. */
const searchInput = (page: import('@playwright/test').Page) =>
  page.locator('[data-qqq-id="command-menu-search"]')

/** Locator for the command palette results listbox. */
const searchDropdown = (page: import('@playwright/test').Page) =>
  page.locator('[data-qqq-id="command-menu-results"]')

test.describe('Command palette search', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page)
    await page.goto('/')
    await waitForAppReady(page)
    await page.locator('[data-qqq-id="button-search"]').click()
  })

  test('header search button opens the palette input', async ({ page }) => {
    await expect(searchInput(page)).toBeVisible({ timeout: 10000 })
  })

  test('typing a label lists matching pages with their app', async ({ page }) => {
    await searchInput(page).fill('peo')
    // "People" starts with the term: it is the top hit
    const top = searchDropdown(page).getByRole('group', { name: 'Navigation' })
    await expect(top.getByRole('option').first()).toContainText('People')
    await expect(top.getByRole('option').first()).toContainText('CRM')
  })

  test('clicking a page result navigates to it', async ({ page }) => {
    await searchInput(page).fill('Peop')
    await searchDropdown(page).getByRole('option', { name: /People/ }).click()
    await expect(searchDropdown(page)).not.toBeVisible({ timeout: 5000 })
    await expect(page).toHaveURL(/\/app\/person\/?$/, { timeout: 10000 })
  })

  test('pressing Escape closes the dropdown', async ({ page }) => {
    await searchInput(page).fill('peo')
    await expect(searchDropdown(page)).toBeVisible()
    await searchInput(page).press('Escape')
    await expect(searchDropdown(page)).not.toBeVisible({ timeout: 5000 })
  })

  test('shows an empty state when nothing matches', async ({ page }) => {
    await searchInput(page).fill('zzznoresults')
    await expect(searchDropdown(page).getByText(/No results found/)).toBeVisible({ timeout: 5000 })
  })

  test('pressing Enter on Search everything opens the search page', async ({ page }) => {
    await searchInput(page).fill('zzznoresults')
    await expect(searchDropdown(page)).toBeVisible({ timeout: 5000 })
    await searchInput(page).press('Enter')
    await expect(page).toHaveURL(/\/app\/search\/?\?q=zzznoresults/, { timeout: 10000 })
  })

  test('the first result is selected while typing, arrow keys move it, and Enter opens it', async ({ page }) => {
    await searchInput(page).fill('crm')
    const options = searchDropdown(page).getByRole('option')
    await expect(options.first()).toHaveAttribute('aria-selected', 'true', { timeout: 5000 })
    await searchInput(page).press('ArrowDown')
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true', { timeout: 3000 })
    await searchInput(page).press('ArrowUp')
    await searchInput(page).press('Enter')
    await expect(page).toHaveURL(/\/app\/crm\/?$/, { timeout: 10000 })
  })

  test('never calls a backend search endpoint', async ({ page }) => {
    const searches: string[] = []
    page.on('request', (request) => { if (new URL(request.url()).pathname.endsWith('/search')) searches.push(request.url()) })
    await searchInput(page).fill('people')
    await expect(searchDropdown(page).getByRole('option').first()).toBeVisible({ timeout: 5000 })
    expect(searches).toEqual([])
  })

  test('matches label words without aliases and rejects unrelated text', async ({ page }) => {
    await searchInput(page).fill('PEO crm')
    await expect(searchDropdown(page).locator('[data-qqq-id="command-group-navigation"]').getByRole('option')).toHaveText([/People/])
    await searchInput(page).fill('unrelated terminology')
    await expect(searchDropdown(page).locator('[data-qqq-id="command-group-navigation"]')).toHaveCount(0)
    await expect(searchDropdown(page).locator('[data-qqq-id="command-search-all"]')).toBeVisible()
  })

  test('a viewed record is searchable locally and Ctrl+Enter opens it in a new tab', async ({ page, context }) => {
    await page.keyboard.press('Escape')
    await page.goto('/app/person/1')
    await expect(page.locator('[data-qqq-id="record-view-title-person"]')).toHaveText('Alice Johnson')
    await page.goto('/app')
    await waitForAppReady(page)
    await page.locator('[data-qqq-id="button-search"]').click()
    await searchInput(page).fill('alice')
    const recent = page.locator('[data-qqq-id="command-recent-person-1"]')
    await expect(recent).toContainText('Alice Johnson')
    await expect(recent).toContainText('People')
    await expect(recent).toHaveAttribute('aria-selected', 'true')
    const popupPromise = context.waitForEvent('page')
    await searchInput(page).press('Control+Enter')
    const popup = await popupPromise
    await expect(popup).toHaveURL(/\/app\/person\/1\/?$/)
    await expect(searchDropdown(page)).toBeVisible()
  })
})
