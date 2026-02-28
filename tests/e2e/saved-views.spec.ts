// E2E: SavedViews — save, recall, and delete named filter/column configurations

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

/** The saved views dropdown panel locator. */
const savedViewsPanel = (page: import('@playwright/test').Page) =>
  page.locator('[data-qqq-id="saved-views-menu"] [role="dialog"]')

/** Opens the saved views dropdown, waiting for it to appear. */
async function openSavedViewsMenu(page: import('@playwright/test').Page) {
  // If already open, do nothing
  if (await savedViewsPanel(page).isVisible()) return

  const btn = page.locator('[data-qqq-id="button-saved-views"]')
  await expect(btn).toBeVisible({ timeout: 10000 })
  await btn.click()
  await expect(savedViewsPanel(page)).toBeVisible({ timeout: 5000 })
}

/** Closes the saved views dropdown by clicking outside. */
async function closeSavedViewsMenu(page: import('@playwright/test').Page) {
  if (!(await savedViewsPanel(page).isVisible())) return
  // Click the backdrop (fixed inset-0 overlay behind the dropdown)
  await page.keyboard.press('Escape')
  // Fallback: click outside the menu
  await page.locator('body').click({ position: { x: 10, y: 10 }, force: true })
  // Small wait for close animation
  await page.waitForTimeout(100)
}

/** Saves the current view with the given name. Assumes the menu is open and in default (non-save) mode. */
async function saveCurrentView(page: import('@playwright/test').Page, name: string) {
  await page.locator('[data-qqq-id="saved-views-save-current"]').click()
  const nameInput = page.locator('[data-qqq-id="saved-views-name-input"]')
  await expect(nameInput).toBeVisible({ timeout: 5000 })
  await nameInput.fill(name)
  await page.locator('[data-qqq-id="saved-views-confirm-save"]').click()
  // After confirming, name input disappears and save-current button reappears (dropdown stays open)
  await expect(page.locator('[data-qqq-id="saved-views-name-input"]')).not.toBeVisible({ timeout: 5000 })
}

test.describe('SavedViews', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage on every page load so saved views don't persist between tests.
    await page.addInitScript(() => {
      localStorage.clear()
    })
    await setupApiMocks(page)
    await page.goto('/app/person')
    await waitForGridReady(page)
  })

  test('saved views button is present in the toolbar', async ({ page }) => {
    await expect(page.locator('[data-qqq-id="button-saved-views"]')).toBeVisible()
  })

  test('clicking saved views button opens the dropdown', async ({ page }) => {
    await openSavedViewsMenu(page)
    await expect(savedViewsPanel(page)).toBeVisible()
  })

  test('shows "No saved views yet" when there are no saved views', async ({ page }) => {
    await openSavedViewsMenu(page)
    await expect(page.getByText('No saved views yet')).toBeVisible()
  })

  test('save current view — enters name input mode', async ({ page }) => {
    await openSavedViewsMenu(page)
    await page.locator('[data-qqq-id="saved-views-save-current"]').click()
    await expect(page.locator('[data-qqq-id="saved-views-name-input"]')).toBeVisible({ timeout: 5000 })
  })

  test('save current view — confirm button is disabled when name is blank', async ({ page }) => {
    await openSavedViewsMenu(page)
    await page.locator('[data-qqq-id="saved-views-save-current"]').click()

    const confirmBtn = page.locator('[data-qqq-id="saved-views-confirm-save"]')
    await expect(confirmBtn).toBeVisible({ timeout: 5000 })
    await expect(confirmBtn).toBeDisabled()
  })

  test('save current view — enabled after typing a name', async ({ page }) => {
    await openSavedViewsMenu(page)
    await page.locator('[data-qqq-id="saved-views-save-current"]').click()

    const nameInput = page.locator('[data-qqq-id="saved-views-name-input"]')
    await nameInput.fill('My Test View')

    const confirmBtn = page.locator('[data-qqq-id="saved-views-confirm-save"]')
    await expect(confirmBtn).not.toBeDisabled({ timeout: 5000 })
  })

  test('save current view — saves and shows the view in the list', async ({ page }) => {
    await openSavedViewsMenu(page)
    await saveCurrentView(page, 'E2E Test View')

    // The dropdown is still open after saving; verify the view is listed
    await expect(page.getByText('E2E Test View')).toBeVisible({ timeout: 5000 })
  })

  test('save current view — pressing Enter confirms the save', async ({ page }) => {
    await openSavedViewsMenu(page)
    await page.locator('[data-qqq-id="saved-views-save-current"]').click()

    const nameInput = page.locator('[data-qqq-id="saved-views-name-input"]')
    await nameInput.fill('Enter Key View')
    await nameInput.press('Enter')

    // The dropdown stays open; the new view should appear in the list
    await expect(page.getByText('Enter Key View')).toBeVisible({ timeout: 5000 })
  })

  test('save current view — pressing Escape cancels name entry', async ({ page }) => {
    await openSavedViewsMenu(page)
    await page.locator('[data-qqq-id="saved-views-save-current"]').click()

    const nameInput = page.locator('[data-qqq-id="saved-views-name-input"]')
    await nameInput.fill('Should Not Save')
    await nameInput.press('Escape')

    // "Save current view..." entry should reappear (save mode cancelled)
    await expect(page.locator('[data-qqq-id="saved-views-save-current"]')).toBeVisible({ timeout: 5000 })
    // Name input should be gone
    await expect(page.locator('[data-qqq-id="saved-views-name-input"]')).not.toBeVisible()
  })

  test('recall a saved view — clicking a view loads it and closes dropdown', async ({ page }) => {
    await openSavedViewsMenu(page)
    await saveCurrentView(page, 'Recall Test View')

    // Dropdown is still open with the saved view listed
    const loadBtn = page.locator('[data-qqq-id^="saved-view-load-"]').first()
    await expect(loadBtn).toBeVisible({ timeout: 5000 })
    await loadBtn.click()

    // Dropdown should close after loading
    await expect(savedViewsPanel(page)).not.toBeVisible({ timeout: 5000 })
  })

  test('delete a saved view — removes it from the list', async ({ page }) => {
    await openSavedViewsMenu(page)
    await saveCurrentView(page, 'Delete Me View')

    // Dropdown is still open; hover to reveal the delete button
    const listItem = page.locator('[data-qqq-id^="saved-view-item-"]').first()
    await expect(listItem).toBeVisible({ timeout: 5000 })
    await listItem.hover()

    const deleteBtn = page.locator('[data-qqq-id^="saved-view-delete-"]').first()
    await expect(deleteBtn).toBeVisible({ timeout: 5000 })
    await deleteBtn.click()

    // After deletion, "No saved views yet" should appear
    await expect(page.getByText('No saved views yet')).toBeVisible({ timeout: 5000 })
  })

  test('saved views count badge updates after saving', async ({ page }) => {
    await openSavedViewsMenu(page)
    await saveCurrentView(page, 'Badge Test View')

    // Close dropdown by clicking the backdrop
    await closeSavedViewsMenu(page)

    // The button should now show a count badge
    const badge = page.locator('[data-qqq-id="button-saved-views"] span.rounded-full')
    await expect(badge).toBeVisible({ timeout: 5000 })
    await expect(badge).toContainText('1')
  })
})
