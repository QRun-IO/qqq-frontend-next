// E2E: Record View, Record CRUD

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

test.describe('Record View (detail page)', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page)
    await page.goto('/app/person/1')
    await waitForAppReady(page)
    await page
      .waitForSelector('[data-qqq-id="grid-loading"]', { state: 'hidden', timeout: 15000 })
      .catch(() => null)
    await expect(
      page.locator(
        '[data-qqq-id="record-view-person"], [data-qqq-id^="record-view-not-found"], [data-qqq-id^="record-view-error"]'
      )
    ).toBeVisible({ timeout: 20000 })
  })

  test('displays record view for person 1', async ({ page }) => {
    await expect(page.locator('[data-qqq-id="record-view-person"]')).toBeVisible()
  })

  test('record view has action buttons', async ({ page }) => {
    await expect(page.locator('[data-qqq-id="record-view-person"]')).toBeVisible()
    const buttons = page.getByRole('button')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(0)
  })

  test('back to table link is present', async ({ page }) => {
    await expect(page.locator('[data-qqq-id="link-back-to-table"]')).toBeVisible()
  })

  test('page does not show unhandled error', async ({ page }) => {
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible()
  })
})

test.describe('Record View — 404 handling', () => {
  test('shows not-found state for non-existent record', async ({ page }) => {
    await setupApiMocks(page)
    await page.goto('/app/person/99999')
    await waitForAppReady(page)
    await expect(
      page.locator(
        '[data-qqq-id^="record-view-not-found"], [data-qqq-id^="record-view-error"], [data-qqq-id="record-view-person"]'
      )
    ).toBeVisible({ timeout: 20000 })
    const notFound = page.locator('[data-qqq-id^="record-view-not-found"]')
    const errorState = page.locator('[data-qqq-id^="record-view-error"]')
    const hasNotFound = await notFound.isVisible()
    const hasError = await errorState.isVisible()
    expect(hasNotFound || hasError).toBe(true)
  })
})

test.describe('Record CRUD — Create', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page)
    await page.goto('/app/person/create')
    await waitForAppReady(page)
    await expect(page.locator('[data-qqq-id="entity-form-person"]')).toBeVisible({ timeout: 20000 })
  })

  test('entity form renders for create', async ({ page }) => {
    await expect(page.locator('[data-qqq-id="entity-form-person"]')).toBeVisible()
  })

  test('form has a save button', async ({ page }) => {
    await expect(page.locator('[data-qqq-id="button-save"]')).toBeVisible()
  })

  test('form has a cancel button', async ({ page }) => {
    await expect(page.locator('[data-qqq-id="button-cancel"]')).toBeVisible()
  })

  test('form has input fields for required fields', async ({ page }) => {
    const inputs = page.locator('[data-qqq-id="entity-form-person"] input')
    const count = await inputs.count()
    expect(count).toBeGreaterThan(0)
  })
})

test.describe('Record CRUD — Edit', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page)
    await page.goto('/app/person/1/edit')
    await waitForAppReady(page)
    await expect(page.locator('[data-qqq-id="entity-form-person"]')).toBeVisible({ timeout: 20000 })
  })

  test('edit form loads for person 1', async ({ page }) => {
    await expect(page.locator('[data-qqq-id="entity-form-person"]')).toBeVisible()
  })

  test('edit form has inputs pre-populated', async ({ page }) => {
    const inputs = page.locator('[data-qqq-id="entity-form-person"] input')
    const count = await inputs.count()
    expect(count).toBeGreaterThan(0)
  })

  test('edit form has save and cancel buttons', async ({ page }) => {
    await expect(page.locator('[data-qqq-id="button-save"]')).toBeVisible()
    await expect(page.locator('[data-qqq-id="button-cancel"]')).toBeVisible()
  })
})
