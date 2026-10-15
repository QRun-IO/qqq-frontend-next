// E2E: Keyboard shortcuts — '.', '/', '?', Cmd+K, Escape

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

test.describe('Keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page)
    await page.route('**/qqq/v1/preferences/keyboard', (route) => route.fulfill({ status: 404, json: { error: 'No keyboard section' } }))
    await page.goto('/app/person')
    await waitForAppReady(page)
    // Ensure no input is focused so single-key shortcuts fire
    await page.locator('body').click()
  })

  // ── '.' key — opens command palette ──────────────────────────────────────

  test("pressing '.' opens the command palette", async ({ page }) => {
    await page.keyboard.press('.')
    await expect(page.locator('[data-qqq-id="command-menu"]')).toBeVisible({ timeout: 5000 })
  })

  test('command palette has a search input', async ({ page }) => {
    await page.keyboard.press('.')
    await expect(page.locator('[data-qqq-id="command-menu-search"]')).toBeVisible({ timeout: 5000 })
  })

  test('Escape closes the command palette opened via "."', async ({ page }) => {
    await page.keyboard.press('.')
    await expect(page.locator('[data-qqq-id="command-menu"]')).toBeVisible({ timeout: 5000 })

    await page.keyboard.press('Escape')
    await expect(page.locator('[data-qqq-id="command-menu"]')).not.toBeVisible({ timeout: 5000 })
  })

  test('close button closes the command palette', async ({ page }) => {
    await page.keyboard.press('.')
    await expect(page.locator('[data-qqq-id="command-menu"]')).toBeVisible({ timeout: 5000 })

    await page.locator('[data-qqq-id="button-command-menu-close"]').click()
    await expect(page.locator('[data-qqq-id="command-menu"]')).not.toBeVisible({ timeout: 5000 })
  })

  test('Cmd+K opens the command palette', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await expect(page.locator('[data-qqq-id="command-menu"]')).toBeVisible({ timeout: 5000 })
  })

  test('Ctrl+K opens the command palette', async ({ page }) => {
    await page.keyboard.press('Control+k')
    await expect(page.locator('[data-qqq-id="command-menu"]')).toBeVisible({ timeout: 5000 })
  })

  test('command palette search filters navigation items', async ({ page }) => {
    await page.keyboard.press('.')
    const searchInput = page.locator('[data-qqq-id="command-menu-search"]')
    await expect(searchInput).toBeVisible({ timeout: 5000 })

    // Type something that matches at least "People" from our mock metadata
    await searchInput.fill('People')
    // Command list should still be visible
    await expect(page.locator('[data-qqq-id="command-menu-results"]')).toBeVisible({ timeout: 5000 })
  })

  // ── '/' key — opens command palette ────────────────────────────────────────

  test("pressing '/' opens the command palette", async ({ page }) => {
    await page.keyboard.press('/')
    await expect(page.locator('[data-qqq-id="command-menu"]')).toBeVisible({ timeout: 5000 })
  })

  test('command palette has an input field', async ({ page }) => {
    await page.keyboard.press('/')
    await expect(page.locator('[data-qqq-id="command-menu-search"]')).toBeVisible({ timeout: 5000 })
  })

  test('Escape closes the command palette', async ({ page }) => {
    await page.keyboard.press('/')
    await expect(page.locator('[data-qqq-id="command-menu"]')).toBeVisible({ timeout: 5000 })

    await page.keyboard.press('Escape')
    await expect(page.locator('[data-qqq-id="command-menu"]')).not.toBeVisible({ timeout: 5000 })
  })

  // ── '?' key — opens keyboard shortcuts help dialog ────────────────────────

  test("pressing '?' opens the keyboard shortcuts help dialog", async ({ page }) => {
    await page.keyboard.press('?')
    await expect(page.locator('[data-qqq-id="keyboard-shortcuts-dialog"]')).toBeVisible({ timeout: 5000 })
  })

  test('keyboard shortcuts dialog has a close button', async ({ page }) => {
    await page.keyboard.press('?')
    await expect(page.locator('[data-qqq-id="button-keyboard-shortcuts-close"]')).toBeVisible({ timeout: 5000 })
  })

  test('Escape closes the keyboard shortcuts dialog', async ({ page }) => {
    await page.keyboard.press('?')
    await expect(page.locator('[data-qqq-id="keyboard-shortcuts-dialog"]')).toBeVisible({ timeout: 5000 })

    await page.keyboard.press('Escape')
    await expect(page.locator('[data-qqq-id="keyboard-shortcuts-dialog"]')).not.toBeVisible({ timeout: 5000 })
  })

  test('clicking close button dismisses the keyboard shortcuts dialog', async ({ page }) => {
    await page.keyboard.press('?')
    await expect(page.locator('[data-qqq-id="keyboard-shortcuts-dialog"]')).toBeVisible({ timeout: 5000 })

    await page.locator('[data-qqq-id="button-keyboard-shortcuts-close"]').click()
    await expect(page.locator('[data-qqq-id="keyboard-shortcuts-dialog"]')).not.toBeVisible({ timeout: 5000 })
  })

  // ── Suppression — shortcuts don't fire while typing in a text input ────────

  test("'/' does not open command palette when an input is focused", async ({ page }) => {
    const quickSearch = page.locator('input[data-qqq-id="quick-search"]')
    await expect(quickSearch).toBeVisible()
    await quickSearch.click()
    await page.keyboard.press('/')
    await expect(quickSearch).toHaveValue('/')
    await expect(page.locator('[data-qqq-id="command-menu"]')).not.toBeVisible()
  })

  test("'?' does not open help dialog when an input is focused", async ({ page }) => {
    const quickSearch = page.locator('input[data-qqq-id="quick-search"]')
    await expect(quickSearch).toBeVisible()
    await quickSearch.click()
    await page.keyboard.press('?')
    await expect(quickSearch).toHaveValue('?')
    await expect(page.locator('[data-qqq-id="keyboard-shortcuts-dialog"]')).not.toBeVisible()
  })

  // ── Escape closes all overlays ────────────────────────────────────────────

  test('Escape closes command palette and does not bubble to other handlers', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await expect(page.locator('[data-qqq-id="command-menu"]')).toBeVisible({ timeout: 5000 })
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-qqq-id="command-menu"]')).not.toBeVisible({ timeout: 5000 })
    // No other dialog should have accidentally opened
    await expect(page.locator('[data-qqq-id="keyboard-shortcuts-dialog"]')).not.toBeVisible()
  })

  test('Help menu opens shortcuts and disabling single-key shortcuts leaves Ctrl+K working', async ({ page }) => {
    await page.getByRole('button', { name: 'Help', exact: true }).click()
    const help = page.getByRole('menu', { name: 'Help', exact: true })
    await help.getByRole('menuitem', { name: 'Keyboard shortcuts' }).click()
    const shortcuts = page.locator('[data-qqq-id="keyboard-shortcuts-dialog"]')
    await expect(shortcuts).toBeVisible()
    await shortcuts.getByRole('switch', { name: /Single-key shortcuts/ }).uncheck()
    await expect(shortcuts.getByRole('switch', { name: /Single-key shortcuts/ })).not.toBeChecked()
    await page.keyboard.press('Escape')
    for (const key of ['/', '.', '?', 'n', 'r', 'f']) {
      await page.locator('body').press(key)
      await expect(page.locator('[role="dialog"], [role="alertdialog"]')).toHaveCount(0)
      await expect(page).toHaveURL(/\/app\/person\/?$/)
    }
    await page.keyboard.press('Control+k')
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.goto('/app/person/1')
    await waitForAppReady(page)
    for (const key of ['n', 'e', 'c', 'a', 'Shift+D']) {
      await page.locator('body').press(key)
      await expect(page.locator('[role="dialog"], [role="alertdialog"]')).toHaveCount(0)
      await expect(page).toHaveURL(/\/app\/person\/1\/?$/)
    }
  })

  test('record delete uses Shift+D and still requires confirmation', async ({ page }) => {
    await page.goto('/app/person/1')
    await waitForAppReady(page)
    // the record (and with it the delete permission) has loaded
    await expect(page.getByRole('heading', { name: 'Alice Johnson', level: 1 })).toBeVisible()
    await page.locator('body').press('d')
    await expect(page.locator('[role="dialog"], [role="alertdialog"]')).toHaveCount(0)
    await page.locator('body').press('Shift+D')
    await expect(page.locator('[data-qqq-id="delete-confirm-dialog"]')).toContainText('Are you sure')
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/app\/person\/1\/?$/)
  })
})
