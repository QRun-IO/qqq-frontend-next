// Mocked phase (d) acceptance: all requests stay in the browser fixture.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { METADATA, setupApiMocks } from './api-mocks'
import {
  compareResult,
  correlationResult,
  crosstabResult,
  scatterResult,
  shiftResult,
  relationshipCapabilities,
} from '../fixtures/data-analysis-compare'

const ROOT = '**/qqq/v1/qbit/data-analysis'
const baseFilter = {
  booleanOperator: 'AND',
  criteria: [{ fieldName: 'status', operator: 'IS_NOT_BLANK', values: [] }],
}
const responses = {
  compare: compareResult,
  correlation: correlationResult,
  crosstab: crosstabResult,
  scatter: scatterResult,
  shift: shiftResult,
}

async function mockRelationships(page: Page) {
  await setupApiMocks(page)
  await page.route('**/qqq/v1/version', (route) =>
    route.fulfill({
      json: {
        apiVersion: '1.4.0',
        basePath: '/qqq/v1',
        supportedMajorVersions: [1],
        features: [],
        extensions: [
          { name: 'data-analysis', version: '1.2.0', pathPrefix: '/qbit/data-analysis' },
        ],
      },
    })
  )
  const person = {
    ...METADATA.tables.person,
    fields: {
      ...METADATA.tables.person.fields,
      amount: {
        ...METADATA.tables.person.fields.email,
        name: 'amount',
        label: 'Amount',
        type: 'DECIMAL',
      },
      createdAt: {
        ...METADATA.tables.person.fields.email,
        name: 'createdAt',
        label: 'Created at',
        type: 'DATE_TIME',
      },
    },
  }
  await page.route(
    (url) => url.pathname === '/qqq/v1/metaData',
    (route) => route.fulfill({ json: { ...METADATA, tables: { ...METADATA.tables, person } } })
  )
  await page.route('**/qqq/v1/metaData/table/person**', (route) => route.fulfill({ json: person }))
  await page.route(`${ROOT}/tables/person/capabilities`, (route) =>
    route.fulfill({ json: relationshipCapabilities })
  )
  const requests: { operation: string; body: Record<string, unknown> }[] = []
  for (const [operation, result] of Object.entries(responses))
    await page.route(`${ROOT}/tables/person/${operation}`, (route) => {
      expect(route.request().method()).toBe('POST')
      requests.push({ operation, body: route.request().postDataJSON() })
      return route.fulfill({ json: result })
    })
  await page.addInitScript(() => localStorage.setItem('qqq-person-view-mode', 'grid'))
  return requests
}

async function open(page: Page, name: string) {
  await page.getByRole('button', { name: 'Explore', exact: true }).click()
  await page.getByRole('menuitem', { name, exact: true }).click()
}

async function build(page: Page, view: 'compare' | 'correlation' | 'crosstab' | 'shift') {
  await open(
    page,
    {
      compare: 'Compare',
      correlation: 'Correlation',
      crosstab: 'Crosstab',
      shift: 'Shift over time',
    }[view]
  )
  const explorer = page.locator(`[data-qqq-id="${view}-explorer"]`)
  if (view === 'compare') {
    await explorer.getByLabel('Side B', { exact: true }).selectOption('whole')
    await explorer.getByRole('checkbox', { name: 'Status', exact: true }).check()
    await explorer.getByRole('checkbox', { name: 'Amount', exact: true }).check()
  } else if (view === 'correlation') {
    await explorer.getByRole('checkbox', { name: 'ID', exact: true }).check()
    await explorer.getByRole('checkbox', { name: 'Amount', exact: true }).check()
  } else if (view === 'crosstab') {
    await explorer.getByLabel('Row field').selectOption('status')
    await explorer.getByLabel('Column field').selectOption('firstName')
  } else {
    await explorer.getByLabel('Field', { exact: true }).selectOption('status')
    await explorer.getByLabel('Date field').selectOption('createdAt')
    await explorer.getByLabel('Bucket').selectOption('MONTH')
  }
  await explorer.getByRole('button', { name: 'Run', exact: true }).click()
  if (view === 'compare')
    await expect(explorer.getByText('A and B differ (p = 0.003).')).toBeVisible()
  if (view === 'correlation')
    await expect(explorer.getByRole('button', { name: 'ID and Amount: r = -0.75' })).toBeVisible()
  if (view === 'crosstab')
    await expect(explorer.getByText(crosstabResult.significance.sentence)).toBeVisible()
  if (view === 'shift') await expect(explorer.getByText(shiftResult.sentence)).toBeVisible()
  return explorer
}

test('Explore compare uses the current query, restores its URL, and drills to records', async ({
  page,
}) => {
  const requests = await mockRelationships(page)
  const filter = Buffer.from(JSON.stringify(baseFilter)).toString('base64')
  await page.goto(`/app/person?${new URLSearchParams({ filter })}`)
  const explorer = await build(page, 'compare')
  expect(requests.find((r) => r.operation === 'compare')?.body).toMatchObject({
    filterA: baseFilter,
    filterB: null,
    fields: ['status', 'amount'],
  })
  const url = page.url()
  expect(new URL(url).searchParams.get('view')).toBe('compare')
  const state = JSON.parse(
    Buffer.from(new URL(url).searchParams.get('compare')!, 'base64').toString()
  )
  expect(state.filterA).toBeUndefined()
  await page.reload()
  await expect(explorer.getByText('A and B differ (p = 0.003).')).toBeVisible()
  await expect(explorer.getByRole('checkbox', { name: 'Amount', exact: true })).toBeChecked()
  await expect(explorer.getByText('Hidden', { exact: true }).first()).toBeVisible()
  await explorer.getByRole('link', { name: '40', exact: true }).first().click()
  await expect.poll(() => new URL(page.url()).searchParams.get('filter')).not.toBe(filter)
  const drill = JSON.parse(
    Buffer.from(new URL(page.url()).searchParams.get('filter')!, 'base64').toString()
  )
  expect(drill.criteria).toEqual([{ fieldName: 'status', operator: 'EQUALS', values: ['active'] }])
  await explorer.getByRole('button', { name: 'Back to records' }).click()
  await expect(explorer).toHaveCount(0)
  expect(new URL(page.url()).searchParams.has('compare')).toBe(false)
  await expect(page.getByRole('button', { name: 'Explore', exact: true })).toBeVisible()
})

test('correlation opens the supplied scatter and browser history restores the builder', async ({
  page,
}) => {
  const requests = await mockRelationships(page)
  await page.goto('/app/person')
  const explorer = await build(page, 'correlation')
  await explorer.getByRole('button', { name: 'ID and Amount: r = -0.75' }).click()
  await expect(
    explorer.getByText('The sample has a Pearson correlation of r = -0.75.')
  ).toBeVisible()
  await expect(explorer.getByRole('group', { name: 'Scatter with trend line' })).toBeVisible()
  expect(requests.find((r) => r.operation === 'scatter')?.body).toEqual(
    correlationResult.cells[1].scatter
  )
  await expect(explorer.locator('.recharts-scatter-line')).toHaveCount(1)
  await page.goBack()
  await expect(explorer).toHaveCount(0)
  await page.goForward()
  await expect(explorer.getByRole('checkbox', { name: 'Amount', exact: true })).toBeChecked()
})

test('crosstab shows shares, Hidden cells, significance and drills', async ({ page }) => {
  await mockRelationships(page)
  await page.goto('/app/person')
  const explorer = await build(page, 'crosstab')
  await explorer.getByLabel('Row shares').check()
  await explorer.getByLabel('Column shares').check()
  await expect(explorer.getByRole('link', { name: '60%' })).toBeVisible()
  await expect(explorer.getByRole('link', { name: '70%' })).toBeVisible()
  await expect(explorer.getByText('Hidden', { exact: true })).toHaveCount(3)
  await expect(explorer.getByText('Cramér’s V: 0.32')).toBeVisible()
  await explorer.getByRole('link', { name: '42' }).click()
  await expect.poll(() => new URL(page.url()).searchParams.has('filter')).toBe(true)
})

test('shift plots every share series with readable bucket labels and point drills', async ({
  page,
}) => {
  await mockRelationships(page)
  await page.goto('/app/person')
  const explorer = await build(page, 'shift')
  await expect(explorer.locator('.recharts-line-curve')).toHaveCount(2)
  await expect(explorer.locator('.recharts-xAxis').getByText('January 2026')).toBeVisible()
  await explorer.locator('[data-qqq-id="shift-chart-point"]').first().focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => new URL(page.url()).searchParams.has('filter')).toBe(true)
})

for (const width of [390, 1440])
  test(`all explorers fit ${width}px and pass axe in light and dark`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await mockRelationships(page)
    await page.goto('/app/person')
    for (const view of ['compare', 'correlation', 'crosstab', 'shift'] as const) {
      const explorer = await build(page, view)
      if (view === 'correlation') {
        await explorer.getByRole('button', { name: 'ID and Amount: r = -0.75' }).click()
        await expect(explorer.getByRole('group', { name: 'Scatter with trend line' })).toBeVisible()
      } else
        await expect(explorer.locator('.recharts-wrapper').first()).toHaveCount(view === 'crosstab' ? 0 : 1)
      for (const dark of [false, true]) {
        await page.evaluate(
          (value) => document.documentElement.classList.toggle('dark', value),
          dark
        )
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
        ).toBe(true)
        expect(
          await page.locator('#main-content').evaluate((e) => e.scrollWidth <= e.clientWidth)
        ).toBe(true)
        expect(
          await explorer.evaluate(
            (root) =>
              [...root.querySelectorAll('*')].filter(
                (e) =>
                  e.scrollHeight > e.clientHeight &&
                  ['auto', 'scroll'].includes(getComputedStyle(e).overflowY)
              ).length
          )
        ).toBe(0)
        if (view === 'crosstab')
          expect(
            await explorer
              .locator('tbody th')
              .first()
              .evaluate((e) => getComputedStyle(e).position)
          ).toBe('sticky')
        expect(
          (
            await new AxeBuilder({ page })
              .include(`[data-qqq-id="${view}-explorer"]`)
              .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
              .analyze()
          ).violations
        ).toEqual([])
      }
      await explorer.getByRole('button', { name: 'Back to records' }).click()
    }
  })

test('Explore is absent without the capability', async ({ page }) => {
  await mockRelationships(page)
  await page.route(`${ROOT}/tables/person/capabilities`, (route) =>
    route.fulfill({ json: { canAnalyze: false, fields: [] } })
  )
  await page.goto('/app/person')
  await expect(page.getByRole('button', { name: 'Toggle advanced filter panel' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Explore', exact: true })).toHaveCount(0)
})
