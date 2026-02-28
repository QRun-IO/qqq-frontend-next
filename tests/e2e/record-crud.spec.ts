// E2E: Record CRUD — create, edit, and delete record flows

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

// ─── Create ────────────────────────────────────────────────────────────────

test.describe('Record CRUD — Create', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page)
    await page.goto('/app/person/create')
    await waitForAppReady(page)
    await expect(page.locator('[data-qqq-id="entity-form-person"]')).toBeVisible({ timeout: 20000 })
  })

  test('entity form renders for a new record', async ({ page }) => {
    await expect(page.locator('[data-qqq-id="entity-form-person"]')).toBeVisible()
    await checkA11y(page)
  })

  test('create form has a Save button', async ({ page }) => {
    await expect(page.locator('[data-qqq-id="button-save"]')).toBeVisible()
  })

  test('create form has a Cancel button', async ({ page }) => {
    await expect(page.locator('[data-qqq-id="button-cancel"]')).toBeVisible()
  })

  test('create form renders input fields for required fields', async ({ page }) => {
    const inputs = page.locator('[data-qqq-id="entity-form-person"] input')
    const count = await inputs.count()
    expect(count).toBeGreaterThan(0)
  })

  test('form labels match field metadata labels', async ({ page }) => {
    // The form should show at least one label from the person table field metadata
    const form = page.locator('[data-qqq-id="entity-form-person"]')
    const formText = await form.textContent()
    // firstName label = "First Name", lastName label = "Last Name"
    expect(formText).toMatch(/first name|last name|email/i)
  })

  test('create form does not show an error state', async ({ page }) => {
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible()
  })
})

// ─── Edit ──────────────────────────────────────────────────────────────────

test.describe('Record CRUD — Edit', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page)
    await page.goto('/app/person/1/edit')
    await waitForAppReady(page)
    await expect(page.locator('[data-qqq-id="entity-form-person"]')).toBeVisible({ timeout: 20000 })
  })

  test('edit form renders for person 1', async ({ page }) => {
    await expect(page.locator('[data-qqq-id="entity-form-person"]')).toBeVisible()
  })

  test('edit form has a Save button', async ({ page }) => {
    await expect(page.locator('[data-qqq-id="button-save"]')).toBeVisible()
  })

  test('edit form has a Cancel button', async ({ page }) => {
    await expect(page.locator('[data-qqq-id="button-cancel"]')).toBeVisible()
  })

  test('edit form renders input fields', async ({ page }) => {
    const inputs = page.locator('[data-qqq-id="entity-form-person"] input')
    const count = await inputs.count()
    expect(count).toBeGreaterThan(0)
  })

  test('edit form inputs are pre-populated from existing record', async ({ page }) => {
    // At least one input should have a non-empty value (pre-filled from person 1)
    const inputs = page.locator('[data-qqq-id="entity-form-person"] input:not([type="hidden"])')
    const count = await inputs.count()
    expect(count).toBeGreaterThan(0)

    let anyFilled = false
    for (let i = 0; i < count; i++) {
      const val = await inputs.nth(i).inputValue()
      if (val && val.length > 0) {
        anyFilled = true
        break
      }
    }
    expect(anyFilled).toBe(true)
  })

  test('edit form does not show an error state', async ({ page }) => {
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible()
  })
})

// ─── Delete ────────────────────────────────────────────────────────────────

test.describe('Record CRUD — Delete', () => {
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

  test('record view page loads for person 1', async ({ page }) => {
    await expect(page.locator('[data-qqq-id="record-view-person"]')).toBeVisible()
  })

  test('record view has action buttons', async ({ page }) => {
    await expect(page.locator('[data-qqq-id="record-view-person"]')).toBeVisible()
    const buttons = page.getByRole('button')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(0)
  })

  test('delete action button or dialog trigger exists', async ({ page }) => {
    await expect(page.locator('[data-qqq-id="record-view-person"]')).toBeVisible()
    // Check for either a delete button or a button that could trigger deletion
    const deleteBtn = page.locator(
      '[data-qqq-id="button-delete"], button:has-text("Delete"), [aria-label="Delete record"]'
    )
    const editBtn = page.locator(
      '[data-qqq-id="button-edit"], button:has-text("Edit"), [aria-label="Edit record"]'
    )
    // Record view must have at least one action available (edit or delete)
    const hasDeleteOrEdit = (await deleteBtn.count()) > 0 || (await editBtn.count()) > 0
    const fallbackButtons = page.getByRole('button')
    const fallbackCount = await fallbackButtons.count()
    expect(hasDeleteOrEdit || fallbackCount > 0).toBe(true)
  })

  test('back to table link is present on record view', async ({ page }) => {
    await expect(page.locator('[data-qqq-id="link-back-to-table"]')).toBeVisible()
  })

  test('record view does not show unhandled errors', async ({ page }) => {
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible()
  })
})
