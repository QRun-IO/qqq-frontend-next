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

// E2E: a dashboard of table and HTML widgets stays readable from a phone to an ultra-wide
// screen: widgets pair only when each gets its declared minimum width, tables become stacked
// cards when narrow, table content stops growing at its max width, and nothing scrolls sideways.
// Set QQQ_E2E_SCREENSHOT_DIR to keep a full-page screenshot per viewport.

import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { METADATA, setupApiMocks } from './api-mocks'

const REM = 16
/** gridMinWidth of the paired tables, and the grid width from which two of them share a row. */
const PAIR_MIN_REM = 28
const PAIR_FROM_PX = 57.5 * REM

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024-sidebar', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
  { name: '3200', width: 3200, height: 1800 },
]

const TABLE = {
  type: 'table',
  columns: [
    { header: 'Order', accessor: 'order' },
    { header: 'Customer', accessor: 'customer' },
    { header: 'Status', accessor: 'status' },
    { header: 'Total', accessor: 'total', align: 'right' },
  ],
  rows: Array.from({ length: 5 }, (_, index) => ({
    order: `SO-10${index}`,
    customer: ['Acme Corporation', 'Globex', 'Initech Holdings', 'Umbrella', 'Hooli'][index],
    status: index % 2 ? 'Shipped' : 'Awaiting fulfilment',
    total: 1250 * (index + 1),
  })),
}

const WIDE_TABLE = {
  type: 'table',
  columns: [
    { header: 'Day', accessor: 'day' },
    { header: 'Visits', accessor: 'visits', align: 'right' },
    { header: 'Signups', accessor: 'signups', align: 'right' },
  ],
  rows: [{ day: 'Monday', visits: 1204, signups: 31 }, { day: 'Tuesday', visits: 1388, signups: 42 }],
}

const DECLARED_TABLE = {
  type: 'table',
  columns: [
    { header: 'Sku', accessor: 'sku', width: '200px' },
    { header: 'Description', accessor: 'description', width: '2fr' },
    { header: 'Warehouse', accessor: 'warehouse', width: '1fr' },
    { header: 'On hand', accessor: 'onHand', width: '120px', align: 'right' },
  ],
  rows: [{ sku: 'WIDGET-0001-BLUE-LARGE', description: 'A very long product description that must wrap', warehouse: 'Main', onHand: 42 }],
}

const HTML = { type: 'html', html: '<p>Summary text for the dashboard, long enough to wrap onto more than one line in a narrow column.</p>' }

const WIDGETS = {
  ordersTable: { name: 'ordersTable', label: 'Open Orders', type: 'table', gridColumns: 6, defaultValues: { gridMinWidth: PAIR_MIN_REM } },
  returnsTable: { name: 'returnsTable', label: 'Returns', type: 'table', gridColumns: 6, defaultValues: { gridMinWidth: PAIR_MIN_REM } },
  notesHtml: { name: 'notesHtml', label: 'Notes', type: 'html', gridColumns: 6 },
  helpHtml: { name: 'helpHtml', label: 'Help', type: 'html', gridColumns: 6 },
  trafficTable: { name: 'trafficTable', label: 'Traffic', type: 'table', gridColumns: 12 },
  stockTable: { name: 'stockTable', label: 'Stock', type: 'table', gridColumns: 6 },
}
const PAYLOADS: Record<string, unknown> = {
  ordersTable: TABLE, returnsTable: TABLE, notesHtml: HTML, helpHtml: HTML, trafficTable: WIDE_TABLE, stockTable: DECLARED_TABLE,
}

/**
 * Adds two dashboards to the mocked backend: `widthLab` (uncapped) and `cappedLab`, whose app
 * caps the page with `supplementalAppMetaData.dashboardLayout.maxContentWidth`.
 *
 * @param page - The page.
 */
async function setupDashboard(page: Page) {
  await setupApiMocks(page)
  const app = (name: string, label: string, extra: Record<string, unknown> = {}) => ({
    name, label, iconName: 'dashboard', widgets: Object.keys(WIDGETS), children: [], sections: [], ...extra,
  })
  const metaData = {
    ...METADATA,
    apps: {
      ...METADATA.apps,
      widthLab: app('widthLab', 'Width Lab'),
      cappedLab: app('cappedLab', 'Capped Lab', { supplementalAppMetaData: { dashboardLayout: { maxContentWidth: 120 } } }),
    },
    appTree: [
      ...METADATA.appTree,
      { name: 'widthLab', label: 'Width Lab', type: 'APP', iconName: 'dashboard', children: [] },
      { name: 'cappedLab', label: 'Capped Lab', type: 'APP', iconName: 'dashboard', children: [] },
    ],
    widgets: Object.fromEntries(Object.entries(WIDGETS).map(([name, widget]) => [name, { isCard: true, hasPermission: true, ...widget }])),
  }
  await page.route('**/qqq/v1/metaData**', (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/metaData/authentication')) return route.fallback()
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(metaData) })
  })
  await page.route('**/qqq/v1/widget/**', (route) => {
    const name = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop() ?? '')
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(PAYLOADS[name] ?? {}) })
  })
}

/** Box of an element (by data-qqq-id). */
async function box(page: Page, qqqId: string) {
  const handle = page.locator(`[data-qqq-id="${qqqId}"]`)
  const bounds = await handle.boundingBox()
  expect(bounds, qqqId).not.toBeNull()
  return bounds!
}

/** Widths that overflow sideways: the page, and any table widget's scroll area. */
async function sidewaysOverflow(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = []
    const root = document.scrollingElement ?? document.documentElement
    if (root.scrollWidth > root.clientWidth + 1) problems.push(`page ${root.scrollWidth} > ${root.clientWidth}`)
    for (const element of Array.from(document.querySelectorAll('main, main *'))) {
      const style = getComputedStyle(element)
      const scrolls = /auto|scroll/.test(style.overflowX)
      if (element.tagName === 'MAIN' || scrolls) {
        if (element.scrollWidth > element.clientWidth + 1) {
          const id = element.getAttribute('data-qqq-id') ?? element.closest('[data-qqq-id]')?.getAttribute('data-qqq-id') ?? element.tagName
          problems.push(`${id} ${element.scrollWidth} > ${element.clientWidth}`)
        }
      }
    }
    return problems
  })
}

test.describe('Dashboard widths', () => {
  for (const viewport of VIEWPORTS) {
    test(`readable at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await setupDashboard(page)
      await page.goto('/app/widthLab')
      for (const name of Object.keys(WIDGETS)) {
        await expect(page.locator(`[data-qqq-id="widget-grid-item-${name}"]`)).toBeVisible()
      }
      await expect(page.locator('[data-qqq-id="table-widget-ordersTable"] tbody tr')).toHaveCount(5)
      await expect(page.locator('[data-qqq-id="table-widget-stockTable"] tbody tr')).toHaveCount(1)

      // never sideways scroll, at any width
      expect(await sidewaysOverflow(page)).toEqual([])

      // the 28rem tables share a row only when each gets 28rem
      const grid = await box(page, 'widget-grid')
      const orders = await box(page, 'widget-grid-item-ordersTable')
      const returns = await box(page, 'widget-grid-item-returnsTable')
      const paired = Math.abs(orders.y - returns.y) < 1
      expect(paired).toBe(grid.width >= PAIR_FROM_PX)
      expect(orders.width).toBeGreaterThanOrEqual(Math.min(grid.width, PAIR_MIN_REM * REM) - 1)

      // a table widget narrower than 30rem or its declared columns shows cards, never a cramped table
      for (const name of ['ordersTable', 'stockTable']) {
        const table = page.locator(`[data-qqq-id="table-widget-${name}"]`)
        const width = (await table.boundingBox())!.width
        const needs = name === 'stockTable' ? Math.max(30 * REM, 200 + 2 * 6 * REM + 120) : 30 * REM
        await expect(table).toHaveAttribute('data-qqq-table-layout', width < needs ? 'cards' : 'table')
      }

      // the full-width table's content stops at 96rem
      expect((await box(page, 'table-widget-trafficTable')).width).toBeLessThanOrEqual(96 * REM + 1)

      const dir = process.env.QQQ_E2E_SCREENSHOT_DIR
      if (dir) await page.screenshot({ path: path.join(dir, `dashboard-${viewport.name}.png`), fullPage: true })
    })
  }

  test('a phone shows table rows as labelled cards', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupDashboard(page)
    await page.goto('/app/widthLab')
    const table = page.locator('[data-qqq-id="table-widget-ordersTable"]')
    await expect(table).toHaveAttribute('data-qqq-table-layout', 'cards')
    // headers are screen-reader only: still column headers, but clipped to 1px
    await expect(table.getByRole('columnheader')).toHaveText(['Order', 'Customer', 'Status', 'Total'])
    expect((await table.locator('thead').boundingBox())!.height).toBeLessThanOrEqual(1)
    const label = await table.locator('tbody td').first().evaluate((cell) => getComputedStyle(cell, '::before').content)
    expect(label).toBe('"Order"')
  })

  test('an app can cap the dashboard width on an ultra-wide screen', async ({ page }) => {
    await page.setViewportSize({ width: 3200, height: 1800 })
    await setupDashboard(page)
    await page.goto('/app/cappedLab')
    await expect(page.locator('[data-qqq-id="widget-grid-item-ordersTable"]')).toBeVisible()
    const home = await box(page, 'app-home-cappedLab')
    expect(home.width).toBeLessThanOrEqual(120 * REM + 1)
    const dir = process.env.QQQ_E2E_SCREENSHOT_DIR
    if (dir) await page.screenshot({ path: path.join(dir, 'dashboard-3200-capped.png'), fullPage: true })
  })
})
