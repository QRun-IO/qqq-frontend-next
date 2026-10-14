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

// E2E: the page has exactly one vertical scroll container at every width.
//
// The shell is a fixed-height column (header, sidebar, scrolling <main>). Anything that makes
// the document itself taller than the viewport adds a second scrollbar beside main's. The
// classic cause is a `position: absolute` descendant (an `sr-only` label, a tooltip) with no
// positioned ancestor: its containing block is the viewport, `overflow: hidden` wrappers do not
// clip it, and its static position deep inside a long page stretches the document.

import { test, expect, type Page } from '@playwright/test'
import { METADATA, setupApiMocks } from './api-mocks'

const WIDTHS = [390, 1024, 1440, 1920, 3200]

/** A tall HTML table, like a backend-rendered "Recent changes" list. */
function longHtml(rows: number): string {
  const body = Array.from({ length: rows }, (_, i) =>
    `<tr><td>${i + 1} hours ago</td><td>Publisher</td><td><a href="/app/person/1">Record #${i + 1}</a></td><td>Edited during process</td></tr>`).join('')
  return `<table><thead><tr><th>When</th><th>Who</th><th>Record</th><th>Change</th></tr></thead><tbody>${body}</tbody></table>`
}

const OPS_WIDGETS = {
  opsStatus: { name: 'opsStatus', label: 'System Status', type: 'html', gridColumns: 12, hasPermission: true },
  opsHealth: { name: 'opsHealth', label: 'Data Health', type: 'html', gridColumns: 6, hasPermission: true },
  opsChanges: { name: 'opsChanges', label: 'Recent Changes', type: 'html', gridColumns: 6, hasPermission: true },
}

/** The shared mocks plus an "Ops" app home with tall HTML widgets and the company footer. */
async function setupOpsHome(page: Page): Promise<void> {
  await setupApiMocks(page)
  const metaData = {
    ...METADATA,
    branding: { ...METADATA.branding, companyName: 'Test Co', companyUrl: 'https://example.com' },
    apps: {
      ...METADATA.apps,
      ops: { name: 'ops', label: 'Ops', iconName: 'dashboard', widgets: Object.keys(OPS_WIDGETS), children: [], sections: [] },
    },
    appTree: [...METADATA.appTree, { name: 'ops', label: 'Ops', type: 'APP', iconName: 'dashboard', children: [] }],
    widgets: { ...METADATA.widgets, ...OPS_WIDGETS },
  }
  // Only the instance route: the authentication and table metadata routes keep their mocks.
  await page.route(/\/qqq\/v1\/metaData(\?|$)/, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(metaData) }))
  await page.route('**/qqq/v1/widget/**', (route) => {
    const name = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop() ?? '')
    const html = name === 'opsStatus' ? '<p>All systems up</p>' : longHtml(name === 'opsHealth' ? 12 : 40)
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ type: 'html', html }) })
  })
}

async function waitForMain(page: Page): Promise<void> {
  await expect(page.locator('[data-qqq-id="main-content"]')).toBeVisible({ timeout: 30000 })
  await page.waitForSelector('[aria-label="Loading content"]', { state: 'hidden', timeout: 15000 }).catch(() => null)
}

/**
 * Every vertically scrollable box on the page, outside the sidebar: the document when it
 * overflows the viewport, plus each element with `overflow-y: auto|scroll` whose content
 * overflows it.
 */
async function verticalScrollers(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = []
    const root = document.scrollingElement ?? document.documentElement
    if (root.scrollHeight > root.clientHeight + 1) found.push('document')
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      if (el.closest('[data-qqq-id^="sidebar"], aside, nav')) continue
      const overflowY = getComputedStyle(el).overflowY
      if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
        found.push(el.dataset.qqqId ?? el.id ?? el.tagName.toLowerCase())
      }
    }
    return found
  })
}

for (const width of WIDTHS) {
  test.describe(`single page scroll container at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('app home with tall widgets scrolls only in main', async ({ page }) => {
      await setupOpsHome(page)
      await page.goto('/app/ops')
      await waitForMain(page)
      await expect(page.locator('#opsChanges table')).toBeVisible({ timeout: 20000 })
      await expect(page.locator('[data-qqq-id="footer-company"]')).toBeVisible()

      expect(await verticalScrollers(page)).toEqual(['main-content'])

      // Scrolling main to the bottom must not reveal a second, document-level scroll.
      await page.locator('[data-qqq-id="main-content"]').evaluate((el) => el.scrollTo(0, el.scrollHeight))
      expect(await page.evaluate(() => (document.scrollingElement ?? document.documentElement).scrollTop)).toBe(0)
    })

    test('table page never scrolls the document', async ({ page }) => {
      await setupApiMocks(page)
      await page.goto('/app/person')
      await waitForMain(page)
      await expect(page.locator('[data-qqq-id^="grid-"]').first()).toBeVisible({ timeout: 20000 })

      const scrollers = await verticalScrollers(page)
      expect(scrollers).not.toContain('document')
      expect(scrollers.length).toBeLessThanOrEqual(1)
    })
  })
}
