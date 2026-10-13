// E2E: date-first filtering on DATE_TIME and DATE fields, with a mock backend that applies the
// filter it is sent (including StartOfPeriod expressions, in the zone from X-QQQ-UserTimezone).
// The browser is pinned to America/Chicago and the clock to Wed 2026-10-14 10:30 CDT.

import { test, expect, type Page } from '@playwright/test'
import { NOW, PEOPLE, TOMORROW, setNow, setupDateMocks } from './date-filter-mocks'

test.use({ timezoneId: 'America/Chicago', locale: 'en-US' })

async function openPage(page: Page, path = '/app/person') {
  await page.goto(path)
  await expect(page.locator('[data-qqq-id="main-content"]')).toBeVisible({ timeout: 30000 })
  await expect(page.locator('[data-qqq-id^="grid-person"]')).toBeVisible({ timeout: 20000 })
}

async function openAdvancedFilter(page: Page) {
  await page.locator('[data-qqq-id="button-filter"]').click()
  await page.getByRole('button', { name: 'Advanced', exact: true }).click()
  await expect(page.locator('[data-qqq-id="filter-builder"]')).toBeVisible({ timeout: 10000 })
}

async function visibleNames(page: Page): Promise<string[]> {
  const text = (await page.locator('[data-qqq-id^="grid-person"]').first().innerText())
  return PEOPLE.map((p) => p.firstName).filter((name) => text.includes(name))
}

test.describe('date filters', () => {
  test.beforeEach(async ({ page }) => {
    setNow(NOW)
    await page.clock.setFixedTime(NOW)
    await page.addInitScript(() => localStorage.clear())
  })

  test('"Between Oct 1 and Oct 12" on a datetime field includes 23:59 on Oct 12 and excludes Oct 13 00:00', async ({ page }) => {
    const seen = await setupDateMocks(page)
    await openPage(page)
    await openAdvancedFilter(page)
    await page.locator('[data-qqq-id="filter-add-criterion-0"]').click()
    await page.locator('[data-qqq-id="filter-field-0-0"]').selectOption('createdAt')

    // a datetime field starts on dates: "is on", no time pickers, no 23:59:59 anywhere
    await expect(page.locator('[data-qqq-id="filter-0-0-operator"]')).toHaveValue('on')
    await page.locator('[data-qqq-id="filter-0-0-operator"]').selectOption('between')
    await page.locator('[data-qqq-id="filter-0-0-from"]').fill('2026-10-01')
    await page.locator('[data-qqq-id="filter-0-0-to"]').fill('2026-10-12')
    await page.locator('[data-qqq-id="button-apply-filter"]').click()

    await expect.poll(() => seen.queries.at(-1)).toEqual([
      { fieldName: 'createdAt', operator: 'GREATER_THAN_OR_EQUALS', values: ['2026-10-01T05:00:00Z'] },
      { fieldName: 'createdAt', operator: 'LESS_THAN', values: ['2026-10-13T05:00:00Z'] },
    ])
    expect(seen.headers.at(-1)).toBe('America/Chicago')
    await expect.poll(() => visibleNames(page)).toEqual(['FirstEdge', 'Middle', 'LastEdge'])
  })

  test('a quick filter shows the range in plain language and reopens on the same dates', async ({ page }) => {
    const seen = await setupDateMocks(page)
    await openPage(page)
    await page.locator('[data-qqq-id="button-filter"]').click()
    await page.locator('[data-qqq-id="quick-filter-createdAt"]').click()
    const editor = page.locator('[data-qqq-id="quick-filter-editor-createdAt"]')
    await expect(editor.locator('[data-qqq-id="quick-filter-createdAt-operator"]')).toHaveValue('between')
    await editor.locator('[data-qqq-id="quick-filter-createdAt-from"]').fill('2026-10-01')
    await editor.locator('[data-qqq-id="quick-filter-createdAt-to"]').fill('2026-10-12')
    await editor.getByRole('button', { name: 'Apply quick filter' }).click()

    await expect(page.locator('[data-qqq-id="quick-filter-createdAt"]')).toHaveText('Created: Oct 1 – Oct 12, 2026')
    await expect.poll(() => visibleNames(page)).toEqual(['FirstEdge', 'Middle', 'LastEdge'])
    expect(seen.queries.at(-1)).toHaveLength(2)

    await page.locator('[data-qqq-id="quick-filter-createdAt"]').click()
    await expect(editor.locator('[data-qqq-id="quick-filter-createdAt-from"]')).toHaveValue('2026-10-01')
    await expect(editor.locator('[data-qqq-id="quick-filter-createdAt-to"]')).toHaveValue('2026-10-12')
  })

  test('presets are relative: "Last 7 days" is sent as expressions, and saved views stay relative tomorrow', async ({ page }) => {
    const seen = await setupDateMocks(page)
    const viewFilter = {
      criteria: [
        { fieldName: 'createdAt', operator: 'GREATER_THAN_OR_EQUALS', values: [{ type: 'StartOfPeriod', unit: 'DAYS', offset: -6 }] },
        { fieldName: 'createdAt', operator: 'LESS_THAN', values: [{ type: 'StartOfPeriod', unit: 'DAYS', offset: 1 }] },
      ],
    }
    const filterParam = Buffer.from(JSON.stringify(viewFilter)).toString('base64')

    // today (Oct 14): the window is Oct 8 to Oct 14, so Oct 8 at 00:00 is in
    await openPage(page, `/app/person?filter=${encodeURIComponent(filterParam)}`)
    await expect.poll(() => visibleNames(page)).toEqual(['Middle', 'LastEdge', 'AfterEdge', 'Recent'])
    expect(seen.queries.at(-1)).toEqual(viewFilter.criteria)
    await page.locator('[data-qqq-id="button-filter"]').click()
    await expect(page.locator('[data-qqq-id="quick-filter-createdAt"]')).toHaveText('Created: Last 7 days')

    // tomorrow (Oct 15): the same saved filter now means Oct 9 to Oct 15, so Oct 8 has aged out; the stored form did not change
    setNow(TOMORROW)
    await page.clock.setFixedTime(TOMORROW)
    seen.queries.length = 0
    await page.reload()
    await expect(page.locator('[data-qqq-id^="grid-person"]')).toBeVisible({ timeout: 20000 })
    await expect.poll(() => seen.queries.at(-1)).toEqual(viewFilter.criteria)
    await expect.poll(() => visibleNames(page)).toEqual(['LastEdge', 'AfterEdge', 'Recent'])
    const aWeekOn = new Date('2026-10-21T15:30:00Z') // a week on, Oct 14 has aged out of the window
    setNow(aWeekOn)
    await page.clock.setFixedTime(aWeekOn)
    await page.reload()
    await expect(page.getByText('No records found')).toBeVisible({ timeout: 20000 })
  })

  test('picking a preset in the builder writes StartOfPeriod bounds and names the days', async ({ page }) => {
    const seen = await setupDateMocks(page)
    await openPage(page)
    await openAdvancedFilter(page)
    await page.locator('[data-qqq-id="filter-add-criterion-0"]').click()
    await page.locator('[data-qqq-id="filter-field-0-0"]').selectOption('createdAt')
    await page.locator('[data-qqq-id="filter-0-0-operator"]').selectOption('within')
    await expect(page.locator('[data-qqq-id="filter-0-0-range"]')).toHaveValue('last7')
    await expect(page.locator('[data-qqq-id="filter-0-0-range-days"]')).toHaveText('Oct 8 – Oct 14, 2026')
    await page.locator('[data-qqq-id="filter-0-0-range"]').selectOption('lastMonth')
    await expect(page.locator('[data-qqq-id="filter-0-0-range-days"]')).toHaveText('Sep 1 – Sep 30, 2026')
    await page.locator('[data-qqq-id="button-apply-filter"]').click()
    await expect.poll(() => seen.queries.at(-1)).toEqual([
      { fieldName: 'createdAt', operator: 'GREATER_THAN_OR_EQUALS', values: [{ type: 'StartOfPeriod', unit: 'MONTHS', offset: -1 }] },
      { fieldName: 'createdAt', operator: 'LESS_THAN', values: [{ type: 'StartOfPeriod', unit: 'MONTHS', offset: 0 }] },
    ])
  })

  test('"Include time" switches to exact date-time pickers and back', async ({ page }) => {
    const seen = await setupDateMocks(page)
    await openPage(page)
    await openAdvancedFilter(page)
    await page.locator('[data-qqq-id="filter-add-criterion-0"]').click()
    await page.locator('[data-qqq-id="filter-field-0-0"]').selectOption('createdAt')
    await page.locator('[data-qqq-id="filter-0-0-operator"]').selectOption('between')
    await page.locator('[data-qqq-id="filter-0-0-from"]').fill('2026-10-01')
    await page.locator('[data-qqq-id="filter-0-0-to"]').fill('2026-10-12')

    await page.getByRole('checkbox', { name: 'Include time for Created' }).check()
    const from = page.locator('[data-qqq-id="filter-value-from-0-0"]')
    const to = page.locator('[data-qqq-id="filter-value-to-0-0"]')
    await expect(from).toHaveAttribute('type', 'datetime-local')
    await expect(from).toHaveValue('2026-10-01T00:00')
    // the same days, as one exact criterion; now narrow it to noon on Oct 12
    await to.fill('2026-10-12T12:00')
    await page.locator('[data-qqq-id="button-apply-filter"]').click()
    await expect.poll(() => seen.queries.at(-1)).toEqual([
      { fieldName: 'createdAt', operator: 'BETWEEN', values: ['2026-10-01T05:00:00.000Z', '2026-10-12T17:00:00.000Z'] },
    ])
    await expect.poll(() => visibleNames(page)).toEqual(['FirstEdge', 'Middle'])

    // and back to dates
    await page.locator('[data-qqq-id="button-filter"]').click()
    await page.getByRole('checkbox', { name: 'Include time for Created' }).uncheck()
    await expect(page.locator('[data-qqq-id="filter-0-0-from"]')).toHaveValue('2026-10-01')
    await expect(page.locator('[data-qqq-id="filter-0-0-to"]')).toHaveValue('2026-10-12')
  })

  test('a DATE field gets the same comparisons and presets, without Include time', async ({ page }) => {
    const seen = await setupDateMocks(page)
    await openPage(page)
    await openAdvancedFilter(page)
    await page.locator('[data-qqq-id="filter-add-criterion-0"]').click()
    await page.locator('[data-qqq-id="filter-field-0-0"]').selectOption('dueDate')
    await expect(page.getByRole('checkbox', { name: /Include time/ })).toHaveCount(0)
    await page.locator('[data-qqq-id="filter-0-0-operator"]').selectOption('between')
    await page.locator('[data-qqq-id="filter-0-0-from"]').fill('2026-10-01')
    await page.locator('[data-qqq-id="filter-0-0-to"]').fill('2026-10-12')
    await page.locator('[data-qqq-id="button-apply-filter"]').click()
    await expect.poll(() => seen.queries.at(-1)).toEqual([{ fieldName: 'dueDate', operator: 'BETWEEN', values: ['2026-10-01', '2026-10-12'] }])
    await expect.poll(() => visibleNames(page)).toEqual(['FirstEdge', 'Middle', 'LastEdge'])
  })

  test('plain datetime bounds from an older saved view still work and open with Include time on', async ({ page }) => {
    const seen = await setupDateMocks(page)
    const legacy = { criteria: [{ fieldName: 'createdAt', operator: 'BETWEEN', values: ['2026-10-01T05:00:00Z', '2026-10-13T04:59:59Z'] }] }
    await openPage(page, `/app/person?filter=${encodeURIComponent(Buffer.from(JSON.stringify(legacy)).toString('base64'))}`)
    await expect.poll(() => visibleNames(page)).toEqual(['FirstEdge', 'Middle', 'LastEdge'])
    expect(seen.queries.at(-1)).toEqual(legacy.criteria)
    await openAdvancedFilter(page)
    await expect(page.getByRole('checkbox', { name: 'Include time for Created' })).toBeChecked()
  })
})
