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

/** @file Mocked Quick Search suggestions, keyboard navigation and responsive theme evidence. */

import { test, expect, type Page, type Locator } from '@playwright/test'
import { METADATA, setupApiMocks } from './api-mocks'

const SEARCHABLE_METADATA = {
  ...METADATA,
  tables: {
    ...METADATA.tables,
    person: { ...METADATA.tables.person, searchFields: ['firstName', 'lastName'] },
    pet: { ...METADATA.tables.person, name: 'pet', label: 'Pets', searchFields: ['firstName'] },
  },
}

const SUGGESTIONS = {
  query: 'alice',
  groups: [
    {
      tableName: 'person', tableLabel: 'People', hasMore: true,
      items: [
        { recordId: '1', label: 'Alice Johnson', subtitle: 'Springfield office · Customer success' },
        { recordId: '2', label: 'Malice Aforethought', subtitle: 'A very long subtitle that must truncate within the narrow viewport without causing any horizontal scrolling' },
      ],
    },
    { tableName: 'pet', tableLabel: 'Pets', hasMore: false, items: [{ recordId: '4', label: 'Biscuit', subtitle: 'Alice’s golden retriever' }] },
  ],
  truncated: false,
}

/**
 * Installs the extension contract and both search endpoints.
 * @param page - Browser page.
 * @param installed - Whether version discovery lists Quick Search.
 * @param fail - Whether suggest returns a server error.
 * @returns Recorded suggestion requests and core search bodies.
 */
async function setupSuggest(page: Page, installed = true, fail = false) {
  const suggestions: URL[] = []
  const core: unknown[] = []
  await setupApiMocks(page)
  await page.route(/\/qqq\/v1\/metaData(\?.*)?$/, (route) => route.fulfill({ json: SEARCHABLE_METADATA }))
  await page.route('**/qqq/v1/version', (route) => route.fulfill({
    json: {
      apiVersion: '1.1.0', features: [],
      extensions: installed ? [{ name: 'quick-search', version: '1.0.0', pathPrefix: '/qbit/quick-search' }] : [],
    },
  }))
  await page.route('**/qqq/v1/qbit/quick-search/suggest*', (route) => {
    expect(route.request().method()).toBe('GET')
    suggestions.push(new URL(route.request().url()))
    return fail ? route.fulfill({ status: 500, json: { error: 'Unavailable' } }) : route.fulfill({ json: SUGGESTIONS })
  })
  await page.route('**/qqq/v1/search', (route) => {
    core.push(route.request().postDataJSON())
    return route.fulfill({ json: { results: [{ tableName: 'person', tableLabel: 'People', recordId: '1', recordLabel: 'Core Alice' }] } })
  })
  return { suggestions, core }
}

/**
 * Opens the app and waits for its header search.
 * @param page - Browser page.
 * @returns The desktop header combobox.
 */
async function openHeader(page: Page) {
  await page.goto('/')
  await expect(page.locator('[data-qqq-id="main-content"]')).toBeVisible({ timeout: 30000 })
  return page.locator('[data-qqq-id="header-search"]').getByRole('combobox')
}

/**
 * Checks that the results panel fits the viewport and has no horizontal scrolling.
 * @param page - Browser page.
 * @param panel - Visible search surface.
 */
async function expectNoHorizontalScroll(page: Page, panel: Locator) {
  const bounds = await panel.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  const overflowing = await panel.evaluate((element) => [element, ...element.querySelectorAll('*')].filter((node) => {
    const style = getComputedStyle(node)
    return ['auto', 'scroll'].includes(style.overflowX) && node.scrollWidth > node.clientWidth + 1
  }).length)
  expect(overflowing).toBe(0)
}

test('header suggestions retain grouped subtitles, ARIA selection and keyboard record navigation', async ({ page }) => {
  const requests = await setupSuggest(page)
  const input = await openHeader(page)
  await input.fill('alice')
  const list = page.locator('#header-search-results')
  const first = list.getByRole('option').filter({ hasText: 'Alice Johnson' })
  await expect(first).toContainText('Springfield office')
  await expect(list.getByRole('group', { name: /^People/ })).toContainText('Malice Aforethought')
  await expect(list.getByRole('group', { name: /^Pets/ })).toContainText('Alice’s golden retriever')
  await expect(first).toHaveAttribute('aria-selected', 'true')
  await expect(input).toHaveAttribute('aria-controls', 'header-search-results')
  await expect(input).toHaveAttribute('aria-activedescendant', await first.getAttribute('id') as string)
  await input.press('ArrowDown')
  await expect(list.getByRole('option').filter({ hasText: 'Malice Aforethought' })).toHaveAttribute('aria-selected', 'true')
  await input.press('ArrowUp')
  await expect(first).toHaveAttribute('aria-selected', 'true')
  expect(requests.suggestions.at(-1)?.searchParams.get('q')).toBe('alice')
  expect(requests.suggestions.at(-1)?.searchParams.get('limitPerTable')).toBe('6')
  expect(requests.suggestions.at(-1)?.searchParams.get('tables')).toBe('person,pet')
  expect(requests.core).toHaveLength(0)
  await input.press('Enter')
  await expect(page).toHaveURL(/\/app\/person\/1\/?$/)
})

for (const mode of ['absent', 'failure'] as const) {
  test(`core search works when suggest is ${mode}`, async ({ page }) => {
    const requests = await setupSuggest(page, mode !== 'absent', mode === 'failure')
    const input = await openHeader(page)
    await input.fill('alice')
    await expect(page.locator('#header-search-results')).toContainText('Core Alice')
    expect(requests.suggestions.length).toBe(mode === 'absent' ? 0 : 1)
    expect(requests.core).toHaveLength(1)
  })
}

for (const width of [390, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`suggestions fit ${width}px in ${theme} mode`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ colorScheme: theme })
      // The app uses an explicit saved theme, rather than the OS preference.
      await page.addInitScript((dark) => localStorage.setItem('qqq-dark-mode', String(dark)), theme === 'dark')
      await setupSuggest(page)
      let input = await openHeader(page)
      let panel = page.locator('[data-qqq-id="header-search-dropdown"]')
      if (width < 768) {
        // The existing mobile header opens the shared search dialog.
        await page.getByRole('button', { name: 'Open search', exact: true }).click()
        panel = page.getByRole('dialog', { name: 'Search', exact: true })
        input = panel.getByRole('combobox')
      }
      await input.fill('alice')
      await expect(panel).toContainText('Springfield office')
      await expect(panel.getByRole('group', { name: /^Pets/ })).toContainText('Biscuit')
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await expectNoHorizontalScroll(page, panel)
      await page.screenshot({ path: `test-results/suggest-shots/suggest-${width}-${theme}.png`, animations: 'disabled' })
    })
  }
}
