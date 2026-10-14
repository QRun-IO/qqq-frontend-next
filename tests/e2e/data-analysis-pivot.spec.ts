// Mocked phase (c) pivot acceptance, including query-owned filters and browser history.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { METADATA, setupApiMocks } from './api-mocks'
import { pivotCapabilities, pivotRequest, pivotResult } from '../fixtures/data-analysis'

const ROOT = '**/qqq/v1/qbit/data-analysis'
const EXPLORER = '[data-qqq-id="pivot-explorer"]'
const baseFilter = {
  booleanOperator: 'AND',
  criteria: [{ fieldName: 'status', operator: 'IS_NOT_BLANK', values: [] }],
}

async function mockPivot(page: Page) {
  await setupApiMocks(page)
  await page.route('**/qqq/v1/version', (route) =>
    route.fulfill({ json: { apiVersion: '1.1.0', basePath: '/qqq/v1', supportedMajorVersions: [1], features: [], extensions: [{ name: 'data-analysis', version: '1.1.0', pathPrefix: '/qbit/data-analysis' }] } })
  )
  const person = {
    ...METADATA.tables.person,
    fields: {
      ...METADATA.tables.person.fields,
      createdAt: {
        ...METADATA.tables.person.fields.email,
        name: 'createdAt',
        label: 'Created at',
        type: 'DATE_TIME',
      },
      amount: {
        ...METADATA.tables.person.fields.email,
        name: 'amount',
        label: 'Amount',
        type: 'DECIMAL',
      },
    },
  }
  await page.route((url) => url.pathname === '/qqq/v1/metaData', (route) =>
    route.fulfill({ json: { ...METADATA, tables: { ...METADATA.tables, person } } })
  )
  await page.route('**/qqq/v1/metaData/table/person**', (route) => route.fulfill({ json: person }))
  await page.route(`${ROOT}/tables/*/capabilities`, (route) =>
    route.fulfill({ json: pivotCapabilities })
  )
  const requests: unknown[] = []
  await page.route(`${ROOT}/tables/person/pivot`, (route) => {
    expect(route.request().method()).toBe('POST')
    const body = route.request().postDataJSON()
    requests.push(body)
    expect(body).toMatchObject(pivotRequest)
    return route.fulfill({ json: pivotResult })
  })
  await page.addInitScript(() => localStorage.setItem('qqq-person-view-mode', 'grid'))
  return requests
}

async function buildPivot(page: Page) {
  await page.getByRole('button', { name: 'Explore', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Pivot', exact: true }).click()
  const explorer = page.locator(EXPLORER)
  await explorer.getByLabel('Rows 1 field').selectOption('status')
  await explorer.getByRole('button', { name: 'Add column', exact: true }).click()
  await explorer.getByLabel('Columns 1 field').selectOption('createdAt')
  await explorer.getByLabel('Columns 1 bucket').selectOption('MONTH')
  await explorer.getByRole('button', { name: 'Add value', exact: true }).click()
  await explorer.getByLabel('Value 2 operator').selectOption('AVG')
  await explorer.getByLabel('Value 2 field').selectOption('amount')
  await explorer.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(explorer.getByRole('link', { name: '14', exact: true })).toBeVisible()
}

test('builds, reloads, drills in place and returns to records with a shareable pivot', async ({
  page,
}) => {
  const requests = await mockPivot(page)
  const filter = Buffer.from(JSON.stringify(baseFilter)).toString('base64')
  await page.goto(`/app/person?${new URLSearchParams({ filter })}`)
  await buildPivot(page)
  const sharedUrl = page.url()
  expect(new URL(sharedUrl).searchParams.get('view')).toBe('pivot')
  const layout = JSON.parse(
    Buffer.from(new URL(sharedUrl).searchParams.get('pivot')!, 'base64').toString()
  )
  expect(layout).toEqual(pivotRequest)
  expect(layout.filter).toBeUndefined()
  expect(requests[0]).toMatchObject({ ...pivotRequest, filter: baseFilter })
  await page.reload()
  const explorer = page.locator(EXPLORER)
  await expect(explorer.getByRole('link', { name: '14', exact: true })).toBeVisible()
  await expect(explorer.getByLabel('Columns 1 bucket')).toHaveValue('MONTH')
  await expect(explorer.getByLabel('Value 2 operator')).toHaveValue('AVG')
  await expect(explorer.getByRole('note')).toContainText('Small groups')
  await explorer.getByRole('button', { name: 'Chart', exact: true }).click()
  await expect(explorer.getByRole('img').first()).toHaveAttribute('aria-label', /Grouped bar/)
  await explorer.getByRole('link', { name: '6', exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get('filter')).not.toBe(filter)
  const applied = JSON.parse(
    Buffer.from(new URL(page.url()).searchParams.get('filter')!, 'base64').toString()
  )
  expect(applied.criteria).toEqual(pivotResult.cells[0].values[0].drill!.filter.criteria)
  await expect(explorer).toBeVisible()
  await explorer.getByRole('button', { name: 'Back to records' }).click()
  await expect(explorer).toHaveCount(0)
  expect(new URL(page.url()).searchParams.has('view')).toBe(false)
  expect(new URL(page.url()).searchParams.has('pivot')).toBe(false)
  await expect(page.getByRole('button', { name: 'Explore', exact: true })).toBeVisible()
  await page.goto(sharedUrl)
  await expect(page.locator(EXPLORER).getByRole('link', { name: '14', exact: true })).toBeVisible()
})

test('browser Back returns to the grid and Forward restores the layout', async ({ page }) => {
  await mockPivot(page)
  await page.goto('/app/person')
  await buildPivot(page)
  await page.goBack()
  await expect(page.locator(EXPLORER)).toHaveCount(0)
  await page.goForward()
  await expect(page.locator(EXPLORER).getByLabel('Columns 1 bucket')).toHaveValue('MONTH')
  await expect(page.locator(EXPLORER).getByRole('link', { name: '14', exact: true })).toBeVisible()
})

for (const width of [390, 768, 1440]) {
  test(`pivot stays within ${width}px and passes axe in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await mockPivot(page)
    await page.goto('/app/person')
    await buildPivot(page)
    const explorer = page.locator(EXPLORER)
    await expect(explorer.locator('[data-qqq-id="pivot-cards"]')).toHaveCount(width < 640 ? 1 : 0)
    await expect(explorer.getByRole('table')).toHaveCount(width < 640 ? 0 : 1)
    for (const dark of [false, true]) {
      await page.evaluate((value) => document.documentElement.classList.toggle('dark', value), dark)
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
      if (width >= 640)
        expect(
          await explorer
            .locator('tbody th')
            .first()
            .evaluate((e) => getComputedStyle(e).position)
        ).toBe('sticky')
      expect(
        (
          await new AxeBuilder({ page })
            .include(EXPLORER)
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze()
        ).violations
      ).toEqual([])
    }
  })
}

test('does not offer Pivot without the analysis capability', async ({ page }) => {
  await setupApiMocks(page)
  await page.route('**/qqq/v1/version', (route) =>
    route.fulfill({ json: { apiVersion: '1.1.0', basePath: '/qqq/v1', supportedMajorVersions: [1], features: [], extensions: [{ name: 'data-analysis', version: '1.1.0', pathPrefix: '/qbit/data-analysis' }] } })
  )
  await page.route(`${ROOT}/tables/*/capabilities`, (route) =>
    route.fulfill({ json: { canAnalyze: false, fields: [] } })
  )
  await page.goto('/app/person')
  await expect(page.getByRole('button', { name: 'Explore', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Analyze table', exact: true })).toHaveCount(0)
})
