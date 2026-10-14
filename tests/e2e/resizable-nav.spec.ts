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

// E2E: the desktop navigation is resizable from the handle on its right edge (drag, double-click
// to reset, arrow/Home/End keys), remembers its width across reloads, and never makes the page
// scroll sideways or grow a second scrollbar. Set QQQ_E2E_SCREENSHOT_DIR to keep a screenshot of
// each layout in light and dark mode at the default and a widened width.

import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { METADATA, setupApiMocks } from './api-mocks'

const HANDLE = '[data-qqq-id="sidebar-resize-handle"]'
const PANEL = '[data-qqq-id="sidebar-desktop"]'
const SCREENSHOTS = process.env.QQQ_E2E_SCREENSHOT_DIR

/** Adds an app whose home is the SQL Workbench widget, with an empty workbench backend. */
async function setupWorkbench(page: Page): Promise<void> {
  const metaData = {
    ...METADATA,
    apps: {
      ...METADATA.apps,
      sqlWorkbench: { name: 'sqlWorkbench', label: 'SQL Workbench', iconName: 'terminal', widgets: ['sqlWorkbenchWidget'], children: [], sections: [] },
    },
    appTree: [...METADATA.appTree, { name: 'sqlWorkbench', label: 'SQL Workbench', type: 'APP', iconName: 'terminal', children: [] }],
    widgets: {
      ...METADATA.widgets,
      sqlWorkbenchWidget: { name: 'sqlWorkbenchWidget', label: 'SQL Workbench', type: 'SQL_WORKBENCH', gridColumns: 12, isCard: false, hasPermission: true },
    },
  }
  const json = (body: unknown) => ({ contentType: 'application/json', body: JSON.stringify(body) })
  await page.route(/\/qqq\/v1\/metaData(\?|$)/, (route) => route.fulfill(json(metaData)))
  await page.route('**/qqq/v1/widget/sqlWorkbenchWidget**', (route) => route.fulfill(json({ type: 'SQL_WORKBENCH' })))
  await page.route('**/qqq/v1/sql-workbench/capabilities', (route) => route.fulfill(json({
    enabled: true, canWrite: false, canShare: false, writeModeEnabled: false,
    limits: { maxRows: 10000, pageSize: 500, maxPageSize: 2000, maxResultBytes: 20971520, statementTimeoutSeconds: 30, writeStatementTimeoutSeconds: 60, maxAffectedRowsWithoutAcknowledgement: 1000, maxAffectedRows: 100000, maxSqlLength: 100000, maxStatementsPerRun: 50 },
    backends: [{ name: 'postgres', label: 'postgres', vendor: 'postgres', dialect: 'postgresql', readOnlyCredentials: true, readOnlyEnforced: true, transactionalDdl: true, writeAllowed: false }],
  })))
  await page.route('**/qqq/v1/sql-workbench/schema/**', (route) => route.fulfill(json({ backendName: 'postgres', dialect: 'postgresql', schemas: [], truncated: false, keywords: [], functions: [], qqqTables: [], cachedAt: '' })))
  await page.route('**/qqq/v1/sql-workbench/notebooks**', (route) => route.fulfill(json({ notebooks: [] })))
  await page.route('**/qqq/v1/sql-workbench/history**', (route) => route.fulfill(json({ executions: [] })))
}

async function waitForMain(page: Page): Promise<void> {
  await expect(page.locator('[data-qqq-id="main-content"]')).toBeVisible({ timeout: 30000 })
  await page.waitForSelector('[aria-label="Loading content"]', { state: 'hidden', timeout: 15000 }).catch(() => null)
}

async function openApp(page: Page, url = '/app/person'): Promise<void> {
  await page.goto(url)
  await waitForMain(page)
  await expect(page.locator(HANDLE)).toBeVisible()
}

/** The desktop navigation's rendered width in px. */
async function navWidth(page: Page): Promise<number> {
  return Math.round((await page.locator(PANEL).boundingBox())!.width)
}

/** Drags the handle horizontally by `dx` px with the mouse, in several moves. */
async function dragHandle(page: Page, dx: number): Promise<void> {
  const box = (await page.locator(HANDLE).boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let step = 1; step <= 5; step++) await page.mouse.move(x + (dx * step) / 5, y)
  await page.mouse.up()
}

/** Horizontal overflow of the document and of main, and every vertical scroller outside the navigation. */
async function scrollState(page: Page): Promise<{ docOverflowX: number; mainOverflowX: number; scrollers: string[] }> {
  return page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement
    const main = document.querySelector<HTMLElement>('[data-qqq-id="main-content"]')!
    const scrollers: string[] = []
    if (root.scrollHeight > root.clientHeight + 1) scrollers.push('document')
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      if (el.closest('[data-qqq-id^="sidebar"], aside, nav')) continue
      const overflowY = getComputedStyle(el).overflowY
      if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
        scrollers.push(el.dataset.qqqId ?? el.id ?? el.tagName.toLowerCase())
      }
    }
    return {
      docOverflowX: root.scrollWidth - root.clientWidth,
      mainOverflowX: main.scrollWidth - main.clientWidth,
      scrollers,
    }
  })
}

test.describe('resizable navigation', () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page)
  })

  test('drags to a new width that survives a reload', async ({ page }) => {
    await openApp(page)
    expect(await navWidth(page)).toBe(256)
    await dragHandle(page, 120)
    expect(await navWidth(page)).toBe(376)
    await expect(page.locator(HANDLE)).toHaveAttribute('aria-valuenow', '376')
    expect(await page.evaluate(() => localStorage.getItem('qqq-nav-width'))).toBe('376')

    await page.reload()
    await waitForMain(page)
    expect(await navWidth(page)).toBe(376)
    await expect(page.locator(HANDLE)).toHaveAttribute('aria-valuenow', '376')
  })

  test('drag stops at the minimum and maximum', async ({ page }) => {
    await openApp(page)
    await dragHandle(page, -200)
    expect(await navWidth(page)).toBe(200)
    await dragHandle(page, 600)
    expect(await navWidth(page)).toBe(480)
  })

  test('double-click resets to the default width', async ({ page }) => {
    await openApp(page)
    await dragHandle(page, 100)
    expect(await navWidth(page)).toBe(356)
    await page.locator(HANDLE).dblclick()
    expect(await navWidth(page)).toBe(256)
    await expect(page.locator(HANDLE)).toHaveAttribute('aria-valuenow', '256')
    expect(await page.evaluate(() => localStorage.getItem('qqq-nav-width'))).toBeNull()
  })

  test('resizes from the keyboard', async ({ page }) => {
    await openApp(page)
    const handle = page.locator(HANDLE)
    await handle.focus()
    await expect(handle).toBeFocused()
    await expect(handle).toHaveAttribute('aria-valuemin', '200')
    await expect(handle).toHaveAttribute('aria-valuemax', '480')

    await page.keyboard.press('ArrowRight')
    expect(await navWidth(page)).toBe(272)
    await page.keyboard.press('Shift+ArrowRight')
    expect(await navWidth(page)).toBe(336)
    await page.keyboard.press('ArrowLeft')
    expect(await navWidth(page)).toBe(320)
    await page.keyboard.press('Home')
    expect(await navWidth(page)).toBe(200)
    await page.keyboard.press('End')
    expect(await navWidth(page)).toBe(480)
    await expect(handle).toHaveAttribute('aria-valuenow', '480')
  })

  test('the stored width shows on the first paint, without the default first', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('qqq-nav-width', '400'))
    // Record every width the navigation is painted at, from its first appearance
    await page.addInitScript(() => {
      const seen: number[] = []
      ;(window as unknown as { navWidths: number[] }).navWidths = seen
      const watch = () => {
        const panel = document.querySelector('[data-qqq-id="sidebar-desktop"]')
        if (panel) seen.push(Math.round(panel.getBoundingClientRect().width))
        requestAnimationFrame(watch)
      }
      requestAnimationFrame(watch)
    })
    await openApp(page)
    const widths = await page.evaluate(() => (window as unknown as { navWidths: number[] }).navWidths)
    expect(widths.length).toBeGreaterThan(0)
    expect(new Set(widths)).toEqual(new Set([400]))
  })
})

test.describe('resizable navigation on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('has no resize handle (the navigation is a drawer)', async ({ page }) => {
    await setupApiMocks(page)
    await page.goto('/app/person')
    await waitForMain(page)
    await expect(page.locator(HANDLE)).toBeHidden()
  })
})

const LAYOUTS = [
  { name: 'dashboard', url: '/app/crm', ready: '[data-qqq-id="main-content"] h1, [data-qqq-id="main-content"] h2' },
  { name: 'table', url: '/app/person', ready: '[data-qqq-id^="grid-"]' },
  { name: 'record', url: '/app/person/1', ready: '[data-qqq-id^="record-view-"]' },
  { name: 'developer', url: '/app/developer', ready: '[data-qqq-id="main-content"] h1' },
  { name: 'search', url: '/app/search?q=alice', ready: '[data-qqq-id="main-content"] h1' },
  { name: 'sql-workbench', url: '/app/sqlWorkbench', ready: '[data-qqq-id="widget-sqlWorkbenchWidget"]', workbench: true },
]

for (const width of [1024, 1440]) {
  test.describe(`navigation widths at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    for (const layout of LAYOUTS) {
      test(`${layout.name}: no sideways scroll or second scrollbar at the default and widest navigation`, async ({ page }) => {
        await setupApiMocks(page)
        if (layout.workbench) await setupWorkbench(page)
        for (const mode of ['light', 'dark'] as const) {
          await page.addInitScript((dark) => localStorage.setItem('qqq-dark-mode', String(dark)), mode === 'dark')
          await page.goto(layout.url)
          await waitForMain(page)
          await expect(page.locator(layout.ready).first()).toBeVisible({ timeout: 20000 })

          for (const nav of ['default', 'widened'] as const) {
            const handle = page.locator(HANDLE)
            if (nav === 'default') await handle.dblclick()
            else {
              await handle.focus()
              await page.keyboard.press('End')
              await handle.blur()
            }
            expect(await navWidth(page)).toBe(nav === 'default' ? 256 : Math.min(480, Math.floor(width * 0.4)))
            const state = await scrollState(page)
            expect(state.docOverflowX, 'document scrolls sideways').toBeLessThanOrEqual(0)
            expect(state.mainOverflowX, 'main scrolls sideways').toBeLessThanOrEqual(0)
            expect(state.scrollers.filter((s) => s !== 'main-content'), 'a second scrollbar').toEqual([])
            if (SCREENSHOTS) {
              await page.mouse.move(width / 2, 450)
              await page.screenshot({ path: path.join(SCREENSHOTS, `nav-${layout.name}-${width}-${mode}-${nav}.png`) })
            }
          }
        }
      })
    }
  })
}
