/*
 * Copyright 2026 QRun.IO, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// E2E: the assistant's conversation list against mocked /qqq/v1/assistant routes: working and
// unread rows, Archive/Delete on every row (keyboard reachable), the delete confirmation, the
// manage link, and the panel readable from a phone to an ultra-wide screen.
// Set QQQ_ASSISTANT_SCREENSHOTS to keep screenshots per viewport.

import { test, expect, type Page, type Route } from '@playwright/test'
import { METADATA, setupApiMocks } from './api-mocks'
import { checkA11y } from './a11y-helpers'

const SCREENSHOT_DIR = process.env.QQQ_ASSISTANT_SCREENSHOTS

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
  { name: '3200', width: 3200, height: 1800 },
]

/**
 * Builds a conversation.
 *
 * @param id - The id.
 * @param title - The title.
 * @param extra - Other fields.
 * @returns The conversation.
 */
function conversation(id: number, title: string, extra: Record<string, unknown> = {}) {
  return { id, title, status: 'ACTIVE', pinned: false, lastMessageAt: null, unreadCount: 0, createDate: '2026-10-12T00:00:00Z', ...extra }
}

/**
 * Mocks the assistant routes with a list that archive and delete change.
 *
 * @param page - The page.
 * @param options - The tables named by the probe.
 * @param options.conversationsTable - The probe's `conversationsTable`.
 * @returns The recorded writes.
 */
async function mockAssistant(page: Page, options: { conversationsTable?: string } = {}) {
  let active = [
    conversation(1, 'Quarterly sales by region and product line', { running: true }),
    conversation(2, 'Open invoices', { unreadCount: 2 }),
    conversation(3, 'Weekly summary', { pinned: true }),
    conversation(4, 'Overdue shipments', { running: true, unreadCount: 1 }),
    conversation(5, 'Who is active?'),
  ]
  let archived = [conversation(9, 'Old inventory check', { status: 'ARCHIVED' })]
  const writes: Array<{ method: string; path: string; body?: unknown }> = []
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  await page.route('**/qqq/v1/version', (route) => json(route, { apiVersion: '1.4.0', features: [], extensions: [{ name: 'assistant', version: '1.0.0' }] }))
  await page.route(/\/qqq\/v1\/metaData(\?|$)/, (route) => json(route, { ...METADATA, supplementalInstanceMetaData: { assistant: {} } }))
  await page.route('**/qqq/v1/assistant/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace('/qqq/v1/assistant', '')
    const method = request.method()
    if (path === '/config') return json(route, { enabled: true, shortcut: 'mod+j', ...options })
    if (path === '/conversations' && method === 'GET') return json(route, { conversations: url.searchParams.get('status') === 'ARCHIVED' ? archived : active })
    const match = /^\/conversations\/(\d+)$/.exec(path)
    if (match && method === 'DELETE') {
      writes.push({ method, path })
      active = active.filter((item) => item.id !== Number(match[1]))
      return route.fulfill({ status: 204 })
    }
    if (match && method === 'PATCH') {
      const body = request.postDataJSON() as { status?: string }
      writes.push({ method, path, body })
      const item = active.find((entry) => entry.id === Number(match[1]))
      if (item && body.status === 'ARCHIVED') {
        active = active.filter((entry) => entry !== item)
        archived = [{ ...item, status: 'ARCHIVED' }, ...archived]
      }
      return json(route, item ?? {})
    }
    if (match && method === 'GET') return json(route, { conversation: active.find((entry) => entry.id === Number(match[1])) ?? archived[0], messages: [] })
    return json(route, { error: 'not mocked' }, 404)
  })
  return writes
}

/**
 * Waits for the dashboard shell.
 *
 * @param page - The page.
 */
async function waitForAppReady(page: Page) {
  await page.waitForSelector('[role="status"][aria-label="Loading"]', { state: 'hidden', timeout: 30000 }).catch(() => null)
  await expect(page.locator('[data-qqq-id="main-content"]')).toBeVisible({ timeout: 30000 })
  await page.waitForSelector('[aria-label="Loading content"]', { state: 'hidden', timeout: 15000 }).catch(() => null)
}

/**
 * Opens the assistant panel (from the account menu on a phone) and its conversation list.
 *
 * @param page - The page.
 * @param width - The viewport width.
 */
async function openRail(page: Page, width: number) {
  const button = page.locator('[data-qqq-id="button-assistant"]')
  if (width < 640) {
    await page.locator('[data-qqq-id="button-account"]').click()
    await page.getByRole('menuitem', { name: 'Ask the assistant' }).click()
  } else {
    await button.click()
  }
  const panel = page.locator('[data-qqq-id="assistant-panel"]')
  await expect(panel).toBeVisible()
  await panel.locator('[data-qqq-id="assistant-rail-toggle"]').click()
  await expect(panel.locator('[data-qqq-id="assistant-conversation"]').first()).toBeVisible()
  return panel
}

test.describe('Assistant conversation list', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('archives and deletes from the keyboard, with a confirmation naming the conversation', async ({ page }) => {
    await setupApiMocks(page)
    const writes = await mockAssistant(page, { conversationsTable: 'person' })
    await page.goto('/app/person')
    await waitForAppReady(page)
    const panel = await openRail(page, 1440)

    // working and unread are visible at a glance
    await expect(panel.locator('[data-qqq-id="assistant-conversation-running"]')).toHaveCount(2)
    await expect(panel.locator('[data-qqq-id="assistant-conversation-unread"]')).toHaveCount(2)
    await expect(panel.locator('[data-qqq-id="assistant-rail-toggle-dot"]')).toHaveCount(1)
    await expect(panel.getByRole('link', { name: 'Manage all conversations' })).toHaveAttribute('href', '/app/person')

    // keyboard: Down to a row, Right to its actions, Enter archives
    await panel.getByRole('button', { name: 'Weekly summary', exact: true }).focus()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowRight')
    const archive = panel.locator('[data-conversation-action]:focus')
    await expect(archive).toBeVisible()
    await expect(archive).toHaveAccessibleName(/^Archive /)
    await archive.press('Enter')
    await expect.poll(() => writes.filter((write) => write.method === 'PATCH').length).toBe(1)
    await expect(panel.locator('[data-conversation-row]')).toHaveCount(4)

    // delete asks first
    await panel.getByRole('button', { name: 'Delete Open invoices' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Open invoices and its messages are deleted')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    expect(writes.filter((write) => write.method === 'DELETE')).toEqual([])
    await panel.getByRole('button', { name: 'Delete Open invoices' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await expect(panel.locator('[data-conversation-row]')).toHaveCount(3)

    await panel.getByRole('button', { name: 'Archived' }).click()
    await expect(panel.getByRole('button', { name: /^Restore / }).first()).toBeVisible()
    await checkA11y(page)
  })

  test('the manage link is absent when the server names no table', async ({ page }) => {
    await setupApiMocks(page)
    await mockAssistant(page)
    await page.goto('/app/person')
    await waitForAppReady(page)
    const panel = await openRail(page, 1440)
    await expect(panel.getByRole('link', { name: 'Manage all conversations' })).toHaveCount(0)
  })
})

for (const viewport of VIEWPORTS) {
  test.describe(`Assistant conversation list at ${viewport.name}px`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.width < 640 })

    test('rows, focused actions and the delete confirmation stay readable and unclipped', async ({ page }) => {
      await setupApiMocks(page)
      await mockAssistant(page, { conversationsTable: 'person' })
      await page.goto('/app/person')
      await waitForAppReady(page)
      const panel = await openRail(page, viewport.width)

      // nothing in the rail is clipped sideways, and the page does not scroll sideways
      const clipped = await panel.locator('[data-qqq-id="assistant-rail"]').evaluate((rail) => {
        const box = rail.getBoundingClientRect()
        return Array.from(rail.querySelectorAll<HTMLElement>('button, a')).filter((node) => {
          const rect = node.getBoundingClientRect()
          return rect.width > 0 && (rect.left < box.left - 1 || rect.right > box.right + 1)
        }).map((node) => node.getAttribute('aria-label') ?? node.textContent)
      })
      expect(clipped).toEqual([])
      expect(await page.evaluate(() => document.scrollingElement!.scrollWidth <= window.innerWidth + 1)).toBe(true)
      if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/${viewport.name}-rail.png` })

      const first = panel.getByRole('button', { name: /^Working: Quarterly sales/ })
      await first.focus()
      await page.keyboard.press('ArrowRight')
      await expect(panel.locator('[data-conversation-action]:focus')).toBeVisible()
      if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/${viewport.name}-actions-focused.png` })

      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('Enter')
      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toContainText('Quarterly sales by region and product line and its messages are deleted')
      if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/${viewport.name}-delete-confirm.png` })
      await dialog.getByRole('button', { name: 'Cancel' }).click()
    })
  })
}
