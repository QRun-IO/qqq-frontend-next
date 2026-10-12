// E2E: record search UX — header search-as-you-type with a mocked record search API
// (highlights, counts, top hits, failure class, provider fallback), keyboard navigation
// (arrows, Enter, Ctrl+Enter new tab), the "/" dialog, and the URL-addressable search page.

import { test, expect, type Page, type Route } from '@playwright/test'
import { METADATA, setupApiMocks } from './api-mocks'
import { checkA11y } from './a11y-helpers'

/** METADATA with record search advertised on the person table. */
const SEARCHABLE_METADATA = {
  ...METADATA,
  tables: {
    ...METADATA.tables,
    person: { ...METADATA.tables.person, searchFields: ['firstName', 'lastName', 'email'] },
  },
}

/** An extended-contract response: highlights, details, dates, per-table summary. */
const ALICE_RESPONSE = {
  results: [
    {
      tableName: 'person', tableLabel: 'People', recordId: '1', recordLabel: 'Alice Johnson', score: 9.1,
      updatedAt: '2026-10-10T15:00:00Z',
      highlights: [{ fieldName: 'email', fieldLabel: 'Email', text: 'alice@example.com', matches: [{ start: 0, end: 5 }] }],
      details: [{ fieldName: 'status', fieldLabel: 'Status', displayValue: 'Active' }],
    },
    {
      tableName: 'person', tableLabel: 'People', recordId: '4', recordLabel: 'Malice Aforethought', score: 3.2,
      highlights: [{ fieldName: 'lastName', fieldLabel: 'Last Name', text: 'Aforethought', matches: [] }],
    },
  ],
  tables: [{ tableName: 'person', tableLabel: 'People', resultCount: 2, hasMore: true, totalCount: 17, source: 'PROVIDER' }],
  provider: { status: 'OK' },
}

/**
 * Mocks metadata with searchable tables and the record search endpoint.
 *
 * @param page - The page.
 * @param handler - Answers `POST /search` (the request body is passed).
 */
async function setupSearch(page: Page, handler: (route: Route, body: Record<string, unknown>) => Promise<void> | void) {
  await setupApiMocks(page)
  await page.route(/\/qqq\/v1\/metaData(\?.*)?$/, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(SEARCHABLE_METADATA) }))
  await page.route('**/qqq/v1/search', (route) => handler(route, JSON.parse(route.request().postData() ?? '{}')))
}

/**
 * Waits for the app shell.
 *
 * @param page - The page.
 */
async function waitForAppReady(page: Page) {
  await expect(page.locator('[data-qqq-id="main-content"]')).toBeVisible({ timeout: 30000 })
}

const headerInput = (page: Page) => page.locator('[data-qqq-id="header-search"]').getByRole('combobox', { name: 'Search pages and records' })
const headerResults = (page: Page) => page.locator('#header-search-results')

test.describe('Record search (header)', () => {
  test('lists grouped, highlighted results with counts and opens the top hit with Enter', async ({ page }) => {
    const bodies: Record<string, unknown>[] = []
    await setupSearch(page, (route, body) => {
      bodies.push(body)
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(ALICE_RESPONSE) })
    })
    await page.goto('/')
    await waitForAppReady(page)

    await headerInput(page).fill('alice')
    const people = headerResults(page).getByRole('group', { name: /^People/ })
    await expect(people).toBeVisible()
    await expect(people).toHaveAccessibleName('People 17 matches')
    const top = headerResults(page).getByRole('group', { name: 'Top hits' })
    await expect(top.getByRole('option').first()).toContainText('Alice Johnson')
    await expect(top.getByRole('option').first()).toContainText('Email: alice@example.com')
    await expect(top.locator('mark').first()).toHaveText('Alice')
    await expect(people.getByRole('option').filter({ hasText: 'See all 17 matches in People' })).toHaveAttribute('href', '/app/search?q=alice&tables=person')
    expect(bodies.at(-1)).toEqual({ searchTerm: 'alice', tableNames: ['person'], limitPerTable: 6 })

    // the top hit is selected while typing
    await expect(top.getByRole('option').first()).toHaveAttribute('aria-selected', 'true')
    await headerInput(page).press('Enter')
    await expect(page).toHaveURL(/\/app\/person\/1\/?$/)
  })

  test('arrow keys move through results; Ctrl+Enter opens a new tab', async ({ page, context }) => {
    await setupSearch(page, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(ALICE_RESPONSE) }))
    await page.goto('/')
    await waitForAppReady(page)

    await headerInput(page).fill('alice')
    const options = headerResults(page).getByRole('option')
    await expect(options.first()).toHaveAttribute('aria-selected', 'true')
    await headerInput(page).press('ArrowDown')
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true')
    await expect(headerInput(page)).toHaveAttribute('aria-activedescendant', (await options.nth(1).getAttribute('id'))!)
    await headerInput(page).press('ArrowUp')
    const [popup] = await Promise.all([context.waitForEvent('page'), headerInput(page).press('Control+Enter')])
    await expect(popup).toHaveURL(/\/app\/person\/1\/?$/)
    // this tab stays on the search
    await expect(headerResults(page)).toBeVisible()
  })

  test('names the failure class and keeps page results when record search fails', async ({ page }) => {
    await setupSearch(page, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Error in record search provider' }) }))
    await page.goto('/')
    await waitForAppReady(page)

    await headerInput(page).fill('peo')
    const failure = page.locator('[data-qqq-id="header-search"] [data-qqq-id="search-failure"]')
    await expect(failure).toContainText('Record search failed: server error (HTTP 500)')
    await expect(failure).toContainText('Error in record search provider')
    await expect(failure).toHaveAttribute('data-failure-kind', 'server')
    await expect(headerResults(page).getByRole('option').filter({ hasText: 'People' }).first()).toBeVisible()
  })

  test('shows fallback results under a provider failure notice', async ({ page }) => {
    await setupSearch(page, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      ...ALICE_RESPONSE,
      tables: [{ ...ALICE_RESPONSE.tables[0], source: 'FALLBACK' }],
      provider: { status: 'FAILED', failureClass: 'ConnectException', message: 'Connection refused' },
    }) }))
    await page.goto('/')
    await waitForAppReady(page)

    await headerInput(page).fill('alice')
    const fallback = page.locator('[data-qqq-id="header-search"] [data-qqq-id="search-fallback"]')
    await expect(fallback).toContainText('Search index unavailable — showing basic matches instead')
    await expect(fallback).toContainText('ConnectException: Connection refused')
    await expect(headerResults(page).getByRole('option').filter({ hasText: 'Alice Johnson' }).first()).toBeVisible()
  })

  test('cancels superseded requests while typing', async ({ page }) => {
    const terms: string[] = []
    await setupSearch(page, async (route, body) => {
      terms.push(String(body.searchTerm))
      // slow answers: the next keystroke supersedes the request in flight
      await new Promise((resolve) => setTimeout(resolve, 600))
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(ALICE_RESPONSE) }).catch(() => undefined)
    })
    await page.goto('/')
    await waitForAppReady(page)

    await headerInput(page).pressSequentially('al', { delay: 50 })
    await page.waitForTimeout(350)
    await headerInput(page).pressSequentially('ice', { delay: 50 })
    // debounced: one request per pause, not per keystroke
    await expect.poll(() => terms).toEqual(['al', 'alice'])
    await expect(headerResults(page).getByRole('option').filter({ hasText: 'Alice Johnson' }).first()).toBeVisible()
  })

  test('the open dropdown has no axe violations', async ({ page }) => {
    await setupSearch(page, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(ALICE_RESPONSE) }))
    await page.goto('/')
    await waitForAppReady(page)
    await headerInput(page).fill('alice')
    await expect(headerResults(page).getByRole('group', { name: /^People/ })).toBeVisible()
    await checkA11y(page)
  })
})

test.describe('Record search ("/" dialog)', () => {
  test('searches records and navigates by keyboard', async ({ page }) => {
    await setupSearch(page, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(ALICE_RESPONSE) }))
    await page.goto('/')
    await waitForAppReady(page)

    await page.locator('body').press('/')
    const dialog = page.getByRole('dialog', { name: 'Search' })
    const input = dialog.getByRole('combobox')
    await expect(input).toBeFocused()
    await input.fill('alice')
    await expect(dialog.getByRole('group', { name: /^People/ })).toBeVisible()
    await input.press('ArrowDown')
    await input.press('Enter')
    await expect(page).toHaveURL(/\/app\/person\/4\/?$/)
    await expect(dialog).not.toBeVisible()
  })
})

test.describe('Search page', () => {
  test('is URL-addressable: filters, counts, sort and paging', async ({ page }) => {
    const bodies: Record<string, unknown>[] = []
    await setupSearch(page, (route, body) => {
      bodies.push(body)
      if (body.offset === 25) {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
          results: [{ tableName: 'person', tableLabel: 'People', recordId: '99', recordLabel: 'Alice Page Two' }],
          tables: [{ tableName: 'person', resultCount: 1, hasMore: false, totalCount: 26 }],
        }) })
      }
      if (body.limitPerTable === 25) {
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
          results: Array.from({ length: 25 }, (_, index) => ({ tableName: 'person', tableLabel: 'People', recordId: String(index + 1), recordLabel: `Alice ${index + 1}` })),
          tables: [{ tableName: 'person', resultCount: 25, hasMore: true, totalCount: 26 }],
        }) })
      }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(ALICE_RESPONSE) })
    })
    await page.goto('/app/search?q=alice')
    await waitForAppReady(page)

    const people = page.getByRole('region', { name: 'People' })
    await expect(people.getByRole('listitem').first()).toContainText('Alice Johnson')
    await expect(people.getByRole('listitem').first()).toContainText('Status: Active')
    const filters = page.getByRole('navigation', { name: 'Filter results' })
    await expect(filters.getByRole('link', { name: /People/ })).toContainText('17')

    await filters.getByRole('link', { name: /People/ }).click()
    await expect(page).toHaveURL(/\/app\/search\/?\?q=alice&tables=person$/)
    await expect(people.getByRole('listitem')).toHaveCount(25)
    await expect(people).toContainText('25 of 26')
    await page.getByRole('button', { name: 'Show more' }).click()
    await expect(people.getByRole('listitem')).toHaveCount(26)
    expect(bodies.some((body) => body.offset === 25 && body.limitPerTable === 25)).toBe(true)

    await page.getByRole('combobox', { name: 'Sort' }).selectOption('recent')
    await expect(page).toHaveURL(/sort=recent/)
    await expect.poll(() => bodies.some((body) => body.sort === 'RECENT')).toBe(true)
  })

  test('opens a result in a new tab and has no axe violations', async ({ page, context }) => {
    await setupSearch(page, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(ALICE_RESPONSE) }))
    await page.goto('/app/search?q=alice')
    await waitForAppReady(page)

    const people = page.getByRole('region', { name: 'People' })
    await expect(people.getByRole('listitem').first()).toBeVisible()
    await checkA11y(page)
    const [popup] = await Promise.all([context.waitForEvent('page'), people.getByRole('link', { name: 'Open Alice Johnson in a new tab' }).click()])
    await expect(popup).toHaveURL(/\/app\/person\/1\/?$/)
  })

  test('has no horizontal overflow at phone width', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 760 })
    await setupSearch(page, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(ALICE_RESPONSE) }))
    await page.goto('/app/search?q=alice')
    await waitForAppReady(page)
    await expect(page.getByRole('region', { name: 'People' }).getByRole('listitem').first()).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
