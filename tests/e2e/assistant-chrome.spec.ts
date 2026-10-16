// E2E: the assistant panel header (history / new / close buttons with tooltips) and the example
// prompts: long prompts wrap inside their chips at every width, nothing clips, nothing scrolls
// sideways. Set QQQ_ASSISTANT_SCREENSHOTS to a directory to keep a screenshot per viewport.

import { test, expect, type Page, type Route } from '@playwright/test'
import { METADATA, setupApiMocks } from './api-mocks'
import { checkA11y } from './a11y-helpers'

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
  { name: '3200', width: 3200, height: 1800 },
]

const SCREENSHOT_DIR = process.env.QQQ_ASSISTANT_SCREENSHOTS
const CONVERSATION = { id: 4, title: 'Active people', status: 'ACTIVE', pinned: false, lastMessageAt: null, unreadCount: 0, createDate: '2026-10-12T00:00:00Z' }
const PROMPTS = [
  'Which of my open orders have been waiting on a customer reply for more than two weeks, and what was the last thing we said to them?',
  'Summarize last quarter by region and flag anything that moved more than ten percent',
  'Show me every record I changed this week',
]

/**
 * Mocks the assistant routes with three long example prompts and one saved conversation.
 *
 * @param page - The page.
 */
async function mockAssistant(page: Page) {
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  await page.route('**/qqq/v1/version', (route) => json(route, { apiVersion: '1.4.0', features: [], extensions: [{ name: 'assistant', version: '1.0.0' }] }))
  await page.route(/\/qqq\/v1\/metaData(\?|$)/, (route) => json(route, { ...METADATA, supplementalInstanceMetaData: { assistant: {} } }))
  await page.route('**/qqq/v1/assistant/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace('/qqq/v1/assistant', '')
    if (path === '/config') return json(route, { enabled: true, shortcut: 'mod+j', model: 'claude-sonnet-5-5', features: { writes: false }, profile: { starterPrompts: PROMPTS } })
    if (path === '/conversations') return json(route, { conversations: [CONVERSATION] })
    return json(route, { error: 'not mocked' }, 404)
  })
}

for (const viewport of VIEWPORTS) {
  test(`assistant panel chrome and example prompts at ${viewport.name}px`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await setupApiMocks(page)
    await mockAssistant(page)
    await page.goto('/app/person')
    await page.waitForSelector('[role="status"][aria-label="Loading"]', { state: 'hidden', timeout: 30000 }).catch(() => null)
    await expect(page.locator('[data-qqq-id="main-content"]')).toBeVisible({ timeout: 30000 })
    if (viewport.width < 640) {
      // compact header: the assistant opens from the account menu
      await page.locator('[data-qqq-id="button-account"]').click()
      await page.getByRole('menuitem', { name: 'Ask the assistant' }).click()
    } else {
      await page.locator('[data-qqq-id="button-assistant"]').click()
    }
    const panel = page.locator('[data-qqq-id="assistant-panel"]')
    await expect(panel).toBeVisible()
    const starters = panel.locator('[data-qqq-id="assistant-starters"]')
    await expect(starters.getByRole('button')).toHaveCount(3)

    // nothing clipped: each chip's text box fits inside the chip, and the chips fit inside the list
    const clipped = await starters.evaluate((list) => {
      const bad: string[] = []
      const listBox = list.getBoundingClientRect()
      for (const chip of Array.from(list.querySelectorAll('button'))) {
        const box = chip.getBoundingClientRect()
        if (chip.scrollWidth > chip.clientWidth + 1 || chip.scrollHeight > chip.clientHeight + 1) bad.push('overflow')
        if (box.left < listBox.left - 1 || box.right > listBox.right + 1) bad.push('outside')
      }
      return bad
    })
    expect(clipped).toEqual([])
    expect(await page.evaluate(() => document.scrollingElement!.scrollWidth <= window.innerWidth + 1)).toBe(true)
    expect(await panel.locator('[data-qqq-id="assistant-messages"]').evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)

    if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/empty-${viewport.name}.png` })

    // history rail open
    await panel.locator('[data-qqq-id="assistant-rail-toggle"]').click()
    await expect(panel.getByRole('option', { name: /Active people/ })).toBeVisible()
    await panel.locator('[data-qqq-id="assistant-rail-toggle"]').focus()
    await page.waitForTimeout(600)
    if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/history-${viewport.name}.png` })
    await checkA11y(page)
  })
}
