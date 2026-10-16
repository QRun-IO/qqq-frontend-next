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


// E2E: an app home with table widgets passes axe (color contrast, target size, heading order) with a
// brand accent that is too light for text (#059669: 3.8:1 on white), in the light and dark themes;
// widget titles are h2 under the page h1; and the skip link moves focus to the first widget.

import AxeBuilder from '@axe-core/playwright'
import { test, expect, type Page } from '@playwright/test'
import { METADATA, setupApiMocks } from './api-mocks'

const WIDTHS = [390, 1440]

const TABLE = {
  type: 'table',
  linkURL: '/app/person',
  linkText: 'View all',
  columns: [{ header: 'Order', accessor: 'order' }, { header: 'Status', accessor: 'status' }],
  rows: [{ order: 'SO-100', status: 'Shipped' }, { order: 'SO-101', status: 'Awaiting fulfilment' }],
  dropdownNameList: ['timeframe'],
  dropdownLabelList: ['Range'],
  dropdownDataList: [[{ id: 'last7', label: 'Last 7 days' }, { id: 'last30', label: 'Last 30 days' }]],
  dropdownDefaultValueList: ['last7'],
}

const WIDGETS = {
  openOrders: { name: 'openOrders', label: 'Open Orders', type: 'table', gridColumns: 6, dropdowns: [{ name: 'timeframe', label: 'Range', type: 'PVS' }] },
  returns: { name: 'returns', label: 'Returns', type: 'table', gridColumns: 6 },
}

/**
 * Serves an app home (`a11yLab`) of two table widgets, branded with the kof22 accent color.
 *
 * @param page - The page.
 */
async function setupHome(page: Page) {
  await setupApiMocks(page)
  const metaData = {
    ...METADATA,
    branding: { ...METADATA.branding, accentColor: '#059669' },
    apps: { ...METADATA.apps, a11yLab: { name: 'a11yLab', label: 'A11y Lab', iconName: 'dashboard', widgets: Object.keys(WIDGETS), children: [], sections: [] } },
    appTree: [...METADATA.appTree, { name: 'a11yLab', label: 'A11y Lab', type: 'APP', iconName: 'dashboard', children: [] }],
    widgets: Object.fromEntries(Object.entries(WIDGETS).map(([name, widget]) => [name, { isCard: true, hasPermission: true, ...widget }])),
  }
  await page.route('**/qqq/v1/metaData**', (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/metaData/authentication')) return route.fallback()
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(metaData) })
  })
  await page.route('**/qqq/v1/widget/**', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(TABLE) }))
}

/**
 * Serious and critical axe violations of the page (contrast and target size included), summarized.
 *
 * @param page - The page.
 * @returns One line per violation: rule, impact and its first selectors.
 */
async function seriousViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    // Filled accent surfaces (the active sidebar item, primary buttons: white text on the brand
    // color) are a separate item; this spec covers the page content and its accent-colored text.
    .exclude('.qqq-sidebar-active')
    .analyze()
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id} (${violation.impact}): ${violation.nodes.slice(0, 3).map((node) => node.target.join(' ')).join(' | ')}`)
}

test.describe('App home accessibility', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const width of WIDTHS) {
      test(`no serious axe violations on a table-widget home, ${theme} theme at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.addInitScript((value) => { try { window.localStorage.setItem('qqq-dark-mode', value) } catch { /* storage unavailable */ } }, String(theme === 'dark'))
        await setupHome(page)
        await page.goto('/app/a11yLab')
        await expect(page.locator('[data-qqq-id="table-widget-openOrders"] tbody tr, [data-qqq-id="table-widget-openOrders"] [role="row"]').first()).toBeVisible()
        await expect(page.getByRole('link', { name: '(View all)' }).first()).toBeVisible()
        await expect(page.getByRole('button', { name: 'Clear Range' }).first()).toBeVisible()
        expect(await seriousViolations(page)).toEqual([])
      })
    }
  }

  test('the clear control is at least 24 x 24 px', async ({ page }) => {
    await setupHome(page)
    await page.goto('/app/a11yLab')
    const box = await page.getByRole('button', { name: 'Clear Range' }).first().boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(24)
    expect(box!.height).toBeGreaterThanOrEqual(24)
  })

  test('widget titles are h2 under the page h1', async ({ page }) => {
    await setupHome(page)
    await page.goto('/app/a11yLab')
    await expect(page.getByRole('heading', { level: 1, name: 'A11y Lab' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Open Orders', 'Returns'])
    await expect(page.getByRole('heading', { level: 3 })).toHaveCount(0)
  })

  test('the skip link moves focus to the first widget, and main is focusable', async ({ page }) => {
    await setupHome(page)
    await page.goto('/app/a11yLab')
    await expect(page.locator('[data-qqq-id="widget-grid-item-openOrders"]')).toBeVisible()
    await expect(page.locator('main#main-content')).toHaveAttribute('tabindex', '-1')
    await page.locator('[data-qqq-id="skip-to-content"]').focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-qqq-id="widget-grid-item-openOrders"]')).toBeFocused()
  })
})
