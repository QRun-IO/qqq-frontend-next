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
    await expect(page.locator('[data-qqq-id="command-menu"] [aria-label="Navigation results"]')).toBeVisible({ timeout: 5000 })
  })

  // ── '/' key — opens search dialog ────────────────────────────────────────

  test("pressing '/' opens the search dialog", async ({ page }) => {
    await page.keyboard.press('/')
    await expect(page.locator('[data-qqq-id="search-dialog"]')).toBeVisible({ timeout: 5000 })
  })

  test('search dialog has an input field', async ({ page }) => {
    await page.keyboard.press('/')
    await expect(page.locator('[data-qqq-id="search-dialog-input"]')).toBeVisible({ timeout: 5000 })
  })

  test('Escape closes the search dialog', async ({ page }) => {
    await page.keyboard.press('/')
    await expect(page.locator('[data-qqq-id="search-dialog"]')).toBeVisible({ timeout: 5000 })

    await page.keyboard.press('Escape')
    await expect(page.locator('[data-qqq-id="search-dialog"]')).not.toBeVisible({ timeout: 5000 })
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

  test("'/' does not open search dialog when an input is focused", async ({ page }) => {
    // Focus the quick-search input on the record query page
    const quickSearch = page.locator('[data-qqq-id="quick-search"] input, [data-qqq-id="quick-search"]').first()
    if (await quickSearch.isVisible()) {
      await quickSearch.click()
      await page.keyboard.press('/')
      // The search dialog should NOT open because we are in a text field
      await expect(page.locator('[data-qqq-id="search-dialog"]')).not.toBeVisible({ timeout: 2000 })
    } else {
      // If quick-search input not available, skip the check by passing
      test.skip()
    }
  })

  test("'?' does not open help dialog when an input is focused", async ({ page }) => {
    const quickSearch = page.locator('[data-qqq-id="quick-search"] input, [data-qqq-id="quick-search"]').first()
    if (await quickSearch.isVisible()) {
      await quickSearch.click()
      await page.keyboard.press('?')
      await expect(page.locator('[data-qqq-id="keyboard-shortcuts-dialog"]')).not.toBeVisible({ timeout: 2000 })
    } else {
      test.skip()
    }
  })

  // ── Escape closes all overlays ────────────────────────────────────────────

  test('Escape closes command palette and does not bubble to other handlers', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await expect(page.locator('[data-qqq-id="command-menu"]')).toBeVisible({ timeout: 5000 })
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-qqq-id="command-menu"]')).not.toBeVisible({ timeout: 5000 })
    // No other dialog should have accidentally opened
    await expect(page.locator('[data-qqq-id="keyboard-shortcuts-dialog"]')).not.toBeVisible()
    await expect(page.locator('[data-qqq-id="search-dialog"]')).not.toBeVisible()
  })
})
