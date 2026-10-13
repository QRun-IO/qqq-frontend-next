// Mocked acceptance of the data-analysis UI API extension; no backend processes or SQL.
import AxeBuilder from '@axe-core/playwright'
import { test, expect, type Page } from '@playwright/test'
import { setupApiMocks } from './api-mocks'
import {
  capabilities,
  column,
  distinctPage,
  duplicatesResult,
  exactColumn,
  table,
} from '../fixtures/data-analysis'

const ROOT = '**/qqq/v1/qbit/data-analysis'
const PANEL = '[data-qqq-id="data-analysis-panel"]'

/** Installs only the contracted extension operations. */
async function mockAnalysis(page: Page) {
  await setupApiMocks(page)
  await page.route(`${ROOT}/tables/*/capabilities`, (route) =>
    route.fulfill({ json: capabilities })
  )
  await page.route(`${ROOT}/tables/*/column-profile`, (route) => {
    expect(route.request().method()).toBe('POST')
    expect(route.request().postDataJSON()).toMatchObject({ fieldName: 'status' })
    return route.fulfill({ json: column })
  })
  await page.route(`${ROOT}/tables/*/table-profile`, (route) => route.fulfill({ json: table }))
  await page.route(`${ROOT}/tables/*/distinct-values`, (route) => {
    const request = route.request().postDataJSON()
    expect(request.pageSize).toBe(50)
    return route.fulfill({
      json: {
        ...distinctPage,
        page: request.page,
        hasMore: request.page === 0,
        values: request.page === 0 ? distinctPage.values : [column.topValues[1]],
      },
    })
  })
  await page.route(`${ROOT}/tables/*/duplicates`, (route) => {
    expect(route.request().postDataJSON().fields).toEqual(['status'])
    return route.fulfill({ json: duplicatesResult })
  })
  let polls = 0
  let runs = 0
  let operation = 'COLUMN_PROFILE'
  await page.route(`${ROOT}/runs`, (route) => {
    operation = route.request().postDataJSON().operation
    polls = 0
    runs += 1
    return route.fulfill({ json: { runId: `run-${runs}`, status: 'RUNNING' } })
  })
  await page.route(`${ROOT}/runs/*`, (route) =>
    route.fulfill({
      json:
        ++polls < 2
          ? { status: 'RUNNING' }
          : {
              status: 'COMPLETE',
              columnProfile: operation === 'COLUMN_PROFILE' ? exactColumn : null,
              tableProfile: operation === 'TABLE_PROFILE' ? table : null,
            },
    })
  )
  await page.addInitScript(() => localStorage.setItem('qqq-person-view-mode', 'grid'))
}

/** Opens the status column's additive menu action. */
async function openColumn(page: Page) {
  await page.locator('[data-qqq-id="grid-column-menu-status"]').click()
  await page.locator('[data-qqq-id="column-menu-analyze"]').click()
  await expect(
    page.locator(PANEL).getByRole('heading', { name: 'Status', exact: true })
  ).toBeVisible()
}

test('profiles a column, switches charts, runs exact, drills and profiles the table', async ({
  page,
}) => {
  await mockAnalysis(page)
  await page.goto('/app/person')
  await expect(page.getByRole('button', { name: 'Analyze table', exact: true })).toBeVisible()
  await openColumn(page)
  const panel = page.locator(PANEL)
  await expect(panel.getByRole('link', { name: '1,000', exact: true })).toBeVisible()
  await expect(panel.getByText('Hidden', { exact: true })).toBeVisible()
  await panel.getByRole('combobox', { name: 'Chart kind' }).selectOption('PARETO')
  await expect(panel.getByRole('img', { name: 'Pareto: Status distribution' })).toBeVisible()
  await panel.getByRole('button', { name: 'Show as table' }).click()
  await expect(panel.getByRole('table')).toContainText('Active')
  expect(
    (
      await new AxeBuilder({ page })
        .include(PANEL)
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations
  ).toEqual([])
  await panel.getByRole('button', { name: 'Show all values' }).click()
  await panel.locator('[data-qqq-id="analysis-values-next"]').click()
  await expect(panel.getByText('Page 2', { exact: true })).toBeVisible()
  await expect(panel.locator('[data-qqq-id="analysis-values-next"]')).toBeDisabled()
  await panel.getByRole('button', { name: 'Run exact', exact: true }).click()
  await expect(panel.getByText('Exact analysis running…')).toBeVisible()
  await expect(panel.getByRole('link', { name: '12,500', exact: true })).toBeVisible()
  await expect(panel.getByText('Estimate', { exact: true })).toHaveCount(0)
  await panel.getByRole('link', { name: '12,498', exact: true }).click()
  await expect(page).toHaveURL(/filter=/)
  await expect(panel).toHaveCount(0)
  const serialized = new URL(page.url()).searchParams.get('filter')!
  expect(JSON.parse(Buffer.from(serialized, 'base64').toString()).criteria).toEqual([
    { fieldName: 'status', operator: 'IS_NOT_BLANK', values: [] },
  ])
  await page.getByRole('button', { name: 'Analyze table', exact: true }).click()
  await expect(panel.getByRole('table', { name: 'Field completeness' })).toBeVisible()
  await expect(panel.getByText('Filtered: 1 conditions')).toBeVisible()
  await expect(panel.getByText('Candidate key', { exact: true })).toBeVisible()
  await panel.getByRole('checkbox', { name: 'Status', exact: true }).check()
  await panel.getByRole('button', { name: 'Find duplicates' }).click()
  await expect(panel.getByRole('link', { name: 'Active 800' })).toBeVisible()
  await panel.getByRole('button', { name: 'Run exact' }).click()
  await expect(panel.getByText('Exact analysis complete')).toBeVisible()
})

for (const width of [390, 768, 1024]) {
  test(`single scrolling sheet at ${width}px in light and dark`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await mockAnalysis(page)
    await page.goto('/app/person')
    // Mobile defaults to cards; the toolbar action is available in either view.
    await page.getByRole('button', { name: 'Analyze table', exact: true }).click()
    await expect(
      page.locator(PANEL).getByRole('table', { name: 'Field completeness' })
    ).toBeVisible()
    for (const dark of [false, true]) {
      await page.evaluate((value) => document.documentElement.classList.toggle('dark', value), dark)
      const box = await page.locator(PANEL).boundingBox()
      expect(box?.width).toBe(width < 900 ? width : 560)
      expect(
        await page
          .locator('[data-qqq-id="analysis-body"]')
          .evaluate((e) => e.scrollWidth <= e.clientWidth)
      ).toBe(true)
      expect(
        (
          await new AxeBuilder({ page })
            .include(PANEL)
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze()
        ).violations
      ).toEqual([])
    }
  })
}

test('an unavailable extension leaves Analyze hidden', async ({ page }) => {
  await setupApiMocks(page)
  await page.route(`${ROOT}/tables/*/capabilities`, (route) =>
    route.fulfill({ status: 404, json: {} })
  )
  await page.addInitScript(() => localStorage.setItem('qqq-person-view-mode', 'grid'))
  await page.goto('/app/person')
  await page.locator('[data-qqq-id="grid-column-menu-status"]').click()
  await expect(page.locator('[data-qqq-id="column-menu-analyze"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Analyze table' })).toHaveCount(0)
})
