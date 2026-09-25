// E2E: GlobalSearch (header "jump to" search) — local matches over pages and recent records, keyboard, Escape

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

/** Locator for the GlobalSearch combobox in the header. */
const searchInput = (page: import('@playwright/test').Page) =>
  page.locator('[data-qqq-id="header-search"]').getByRole('combobox', { name: 'Search pages and recent records' })

/** Locator for the GlobalSearch results listbox. */
const searchDropdown = (page: import('@playwright/test').Page) =>
  page.locator('[data-qqq-id="header-search"] [role="listbox"]')

test.describe('GlobalSearch (header search)', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page)
    await page.goto('/')
    await waitForAppReady(page)
  })

  test('search input is visible in the header', async ({ page }) => {
    await expect(searchInput(page)).toBeVisible({ timeout: 10000 })
  })

  test('typing a label lists matching pages with their app', async ({ page }) => {
    await searchInput(page).fill('peo')
    const pages = searchDropdown(page).getByRole('group', { name: 'Pages' })
    await expect(pages.getByRole('option').first()).toContainText('People')
    await expect(pages.getByRole('option').first()).toContainText('CRM')
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
    await expect(searchDropdown(page).getByText(/No pages or recent records match/)).toBeVisible({ timeout: 5000 })
  })

  test('pressing Enter with no result selected opens the search page', async ({ page }) => {
    await searchInput(page).fill('zzznoresults')
    await expect(searchDropdown(page)).toBeVisible({ timeout: 5000 })
    await searchInput(page).press('Enter')
    await expect(page).toHaveURL(/\/app\/search\/?\?q=zzznoresults/, { timeout: 10000 })
  })

  test('arrow keys move the selection and Enter opens it', async ({ page }) => {
    await searchInput(page).fill('crm')
    const first = searchDropdown(page).getByRole('option').first()
    await expect(first).toBeVisible({ timeout: 5000 })
    await searchInput(page).press('ArrowDown')
    await expect(first).toHaveAttribute('aria-selected', 'true', { timeout: 3000 })
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
})
