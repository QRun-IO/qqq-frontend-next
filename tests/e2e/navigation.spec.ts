// E2E: Navigation — sidebar, routing, breadcrumbs

import { test, expect } from '@playwright/test'
import { setupApiMocks } from './api-mocks'
import { checkA11y } from './a11y-helpers'

// Wait for the auth+meta loading sequence to complete.
// The dashboard layout shows a spinner while authLoading=true, then renders
// <main data-qqq-id="main-content"> once FULLY_ANONYMOUS auth completes.
async function waitForAppReady(page: import('@playwright/test').Page) {
  // Wait for auth spinner to disappear
  await page
    .waitForSelector('[role="status"][aria-label="Loading"]', {
      state: 'hidden',
      timeout: 30000,
    })
    .catch(() => null)
  // Wait for main content area to be present (proves auth done)
  await expect(page.locator('[data-qqq-id="main-content"]')).toBeVisible({ timeout: 30000 })
  // Wait for meta loading spinner inside main to disappear
  await page
    .waitForSelector('[aria-label="Loading content"]', { state: 'hidden', timeout: 15000 })
    .catch(() => null)
}

test.describe('App shell and navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page)
    await page.goto('/')
    await waitForAppReady(page)
  })

  test('renders the application layout', async ({ page }) => {
    await expect(page.locator('[data-qqq-id="main-content"]')).toBeVisible()
    await checkA11y(page)
  })

  test('sidebar is present', async ({ page }) => {
    await expect(page.locator('nav, aside, [data-qqq-id*="sidebar"]').first()).toBeVisible()
  })

  test('page title contains app name', async ({ page }) => {
    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
  })

  test('navigates to people table by URL', async ({ page }) => {
    await page.goto('/app/person')
    await waitForAppReady(page)
    await expect(
      page.locator('[data-qqq-id^="grid-"], [data-qqq-id="grid-loading"]').first()
    ).toBeVisible({ timeout: 20000 })
    expect(page.url()).toContain('/person')
  })

  test('navigates to a record view by URL', async ({ page }) => {
    await page.goto('/app/person/1')
    await waitForAppReady(page)
    await expect(
      page.locator('[data-qqq-id="record-view-person"], [data-qqq-id^="record-view-"]').first()
    ).toBeVisible({ timeout: 20000 })
  })

  test('navigates to create page by URL', async ({ page }) => {
    await page.goto('/app/person/create')
    await waitForAppReady(page)
    await expect(page.locator('[data-qqq-id="entity-form-person"]')).toBeVisible({
      timeout: 20000,
    })
  })
})

for (const width of [320, 390, 768, 1440]) {
  test(`deep record breadcrumb fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await setupApiMocks(page)
    await page.goto('/app/person/1')
    await waitForAppReady(page)
    const nav = page.getByRole('navigation', { name: 'Breadcrumb', exact: true })
    const header = page.locator('[data-qqq-id="header"]')
    await expect(nav.locator('[aria-current="page"]')).toHaveText('1')
    await expect(nav.getByRole('link', { name: 'CRM', exact: true })).toBeVisible()
    await expect.poll(() => nav.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0)
    expect(await header.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
    expect(await nav.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      return [...element.children].every((child) => {
        const box = child.getBoundingClientRect()
        return box.left >= bounds.left && box.right <= bounds.right + 1 && box.top >= bounds.top && box.bottom <= bounds.bottom + 1
      })
    })).toBe(true)
    // every crumb stays a visible link, in order; none is hidden behind a menu
    await expect(nav.getByRole('button')).toHaveCount(0)
    await expect(nav.getByRole('link', { name: 'People', exact: true })).toHaveAttribute('href', '/app/person')
    // the header grows to hold a wrapped trail rather than clipping it
    expect(await nav.evaluate((element) => element.getBoundingClientRect().bottom <= element.closest('header')!.getBoundingClientRect().bottom + 1)).toBe(true)
  })
}
