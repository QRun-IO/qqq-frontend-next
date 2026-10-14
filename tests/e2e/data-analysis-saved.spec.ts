// Mocked phase (e/f) acceptance: core CRUD, saved reruns, file export and SQL draft handoff.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { METADATA, setupApiMocks } from './api-mocks'
import { pivotCapabilities, pivotRequest, pivotResult, column } from '../fixtures/data-analysis'
import { watchPreview } from '../fixtures/data-analysis-saved'
const ROOT = '**/qqq/v1/qbit/data-analysis'
const sql = 'SELECT COUNT(*) FROM person'

async function setup(page: Page) {
  await setupApiMocks(page)
  await page.route('**/qqq/v1/version', (route) =>
    route.fulfill({
      json: {
        apiVersion: '1.4.0',
        basePath: '/qqq/v1',
        supportedMajorVersions: [1],
        features: [],
        extensions: [
          { name: 'data-analysis', version: '1.4.0', pathPrefix: '/qbit/data-analysis' },
        ],
      },
    })
  )
  // Override only the exact root: authentication and per-table metadata retain their handlers.
  await page.route(
    (url) => url.pathname === '/qqq/v1/metaData',
    (route) =>
      route.fulfill({
        json: {
          ...METADATA,
          apps: {
            ...METADATA.apps,
            sqlWorkbench: {
              name: 'sqlWorkbench',
              label: 'SQL Workbench',
              iconName: 'terminal',
              widgets: ['sqlWorkbenchWidget'],
              children: [],
              sections: [],
            },
          },
          appTree: [
            ...METADATA.appTree,
            { name: 'sqlWorkbench', label: 'SQL Workbench', type: 'APP', children: [] },
          ],
          widgets: {
            sqlWorkbenchWidget: {
              name: 'sqlWorkbenchWidget',
              label: 'SQL Workbench',
              type: 'SQL_WORKBENCH',
              gridColumns: 12,
              isCard: false,
              hasPermission: true,
            },
          },
        },
      })
  )
  await page.route(`${ROOT}/tables/person/capabilities`, (route) =>
    route.fulfill({ json: { ...pivotCapabilities, sqlWorkbenchAvailable: true } })
  )
  await page.route(`${ROOT}/tables/person/pivot`, (route) => route.fulfill({ json: pivotResult }))
  await page.route(`${ROOT}/tables/person/column-profile`, (route) =>
    route.fulfill({ json: column })
  )
  await page.route(`${ROOT}/tables/person/sql`, (route) => {
    expect(route.request().method()).toBe('POST')
    return route.fulfill({ json: { available: true, sql } })
  })
  await page.route('**/qqq/v1/widget/sqlWorkbenchWidget**', (route) =>
    route.fulfill({ json: { type: 'SQL_WORKBENCH' } })
  )
  await page.route('**/qqq/v1/sql-workbench/capabilities', (route) =>
    route.fulfill({
      json: {
        version: '1.0.0',
        canWrite: false,
        canShare: false,
        writeModeEnabled: false,
        limits: {
          maxRows: 10000,
          pageSize: 500,
          maxPageSize: 2000,
          maxResultBytes: 20971520,
          statementTimeoutSeconds: 30,
          writeStatementTimeoutSeconds: 60,
          maxAffectedRowsWithoutAcknowledgement: 1000,
          maxAffectedRows: 100000,
          maxSqlLength: 100000,
          maxStatementsPerRun: 50,
        },
        backends: [
          {
            name: 'postgres',
            label: 'Postgres',
            vendor: 'postgres',
            dialect: 'postgresql',
            readOnlyCredentials: true,
            readOnlyEnforced: true,
            transactionalDdl: true,
            writeAllowed: false,
          },
        ],
      },
    })
  )
  await page.route('**/qqq/v1/sql-workbench/schema/**', (route) =>
    route.fulfill({
      json: {
        backendName: 'postgres',
        dialect: 'postgresql',
        schemas: [],
        truncated: false,
        keywords: [],
      },
    })
  )
  await page.route('**/qqq/v1/sql-workbench/notebooks**', (route) =>
    route.fulfill({ json: { notebooks: [] } })
  )
  await page.route('**/qqq/v1/sql-workbench/history**', (route) =>
    route.fulfill({ json: { executions: [] } })
  )
  const executes: string[] = []
  await page.route('**/qqq/v1/sql-workbench/execute', (route) => {
    executes.push(route.request().postData() ?? '')
    return route.fulfill({ status: 500 })
  })
  await page.addInitScript(() => localStorage.setItem('qqq-person-view-mode', 'grid'))
  return executes
}

async function readable(page: Page, selector: string) {
  for (const dark of [false, true]) {
    await page.evaluate((value) => document.documentElement.classList.toggle('dark', value), dark)
    expect(await page.locator(selector).evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true)
    expect(
      (
        await new AxeBuilder({ page })
          .include(selector)
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations
    ).toEqual([])
  }
}

test('saves a pivot, opens its saved result, stars, downloads CSV, and opens a SQL draft', async ({
  page,
}) => {
  const executes = await setup(page)
  const values = {
    id: 42,
    name: 'Monthly people',
    description: 'Review',
    shared: true,
    table_name: 'person',
    kind: 'PIVOT',
    definition_json: JSON.stringify(pivotRequest),
    chart_kind: 'BAR',
  }
  await page.route('**/qqq/v1/table/data_analysis_saved', (route) => {
    expect(route.request().method()).toBe('POST')
    const body = route.request().postData() ?? ''
    expect(body).toContain('name="definition_json"')
    expect(body).toContain('"rows":[{"field":"status"}]')
    expect(body).toContain('name="shared"')
    return route.fulfill({ json: { record: { tableName: 'data_analysis_saved', values } } })
  })
  await page.route('**/qqq/v1/table/data_analysis_saved/42*', (route) =>
    route.fulfill({ json: { record: { tableName: 'data_analysis_saved', values } } })
  )
  await page.route(`${ROOT}/saved`, (route) =>
    route.fulfill({
      json: {
        analyses: [
          { id: 42, name: values.name, shared: true, starred: false, tableName: 'person' },
        ],
      },
    })
  )
  await page.route(`${ROOT}/saved/42/run`, (route) => {
    expect(route.request().method()).toBe('POST')
    return route.fulfill({
      json: {
        kind: 'PIVOT',
        pivot: pivotResult,
        warnings: ['Some fields are not available to you'],
      },
    })
  })
  await page.route(`${ROOT}/saved/42/star`, (route) => {
    expect(route.request().method()).toBe('PUT')
    return route.fulfill({ json: { starred: true } })
  })
  await page.route(`${ROOT}/saved/42/export?format=csv`, (route) =>
    route.fulfill({
      contentType: 'text/csv',
      body: 'Status,Count\nActive,14\n',
      headers: { 'Content-Disposition': 'attachment; filename="analysis.csv"' },
    })
  )
  await page.goto(
    `/app/person?${new URLSearchParams({ view: 'pivot', pivot: Buffer.from(JSON.stringify(pivotRequest)).toString('base64') })}`
  )
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Save analysis' })
  await dialog.getByLabel('Name', { exact: true }).fill(values.name)
  await dialog.getByLabel('Description').fill('Review')
  await dialog.getByLabel('Shared').check()
  await dialog.getByRole('button', { name: 'Save analysis', exact: true }).click()
  await expect(page.getByText('Analysis saved', { exact: true })).toBeVisible()
  await page.goto('/app/person?view=saved&saved=42')
  const viewer = page.locator('[data-qqq-id="saved-analysis-viewer"]')
  await expect(viewer.getByRole('heading', { name: values.name })).toBeVisible()
  await expect(viewer.getByText('Some fields are not available to you')).toBeVisible()
  await viewer.getByRole('button', { name: 'Star', exact: true }).click()
  await expect(viewer.getByRole('button', { name: 'Unstar' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  const downloadEvent = page.waitForEvent('download')
  await viewer.getByRole('button', { name: 'CSV', exact: true }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe('analysis.csv')
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  expect(Buffer.concat(chunks).toString()).toContain('Active,14')
  const drill = viewer.locator('[data-qqq-id="analysis-drill"]').first()
  const targetFilter = new URL((await drill.getAttribute('href'))!, page.url()).searchParams.get(
    'filter'
  )
  await drill.click()
  await expect(viewer).toHaveCount(0)
  await expect.poll(() => new URL(page.url()).searchParams.get('filter')).toBe(targetFilter)
  await page.goto('/app/person?view=saved&saved=42')
  await expect(viewer.getByRole('heading', { name: values.name })).toBeVisible()
  await page.setViewportSize({ width: 360, height: 844 })
  await readable(page, '[data-qqq-id="saved-analysis-viewer"]')
  await viewer.getByRole('button', { name: 'Open in SQL Workbench' }).click()
  await expect(page.locator('.cm-content').filter({ hasText: sql })).toBeVisible({ timeout: 30000 })
  expect(executes).toEqual([])
})

test('creates a watch from a profile and previews the persisted metric with its baseline', async ({
  page,
}) => {
  await setup(page)
  await page.route('**/qqq/v1/table/data_analysis_watch', (route) => {
    const body = route.request().postData() ?? ''
    expect(body).toContain('"operator":"COUNT"')
    expect(body).toContain('name="date_field"')
    expect(body).toContain('createdAt')
    return route.fulfill({
      json: { record: { tableName: 'data_analysis_watch', values: { id: 9 } } },
    })
  })
  await page.route(`${ROOT}/watches/9/preview`, (route) => {
    expect(route.request().method()).toBe('POST')
    return route.fulfill({ json: watchPreview })
  })
  await page.setViewportSize({ width: 360, height: 844 })
  await page.goto('/app/person')
  await page.locator('[data-qqq-id="grid-column-menu-status"]').click()
  await page.locator('[data-qqq-id="column-menu-analyze"]').click()
  await page.getByRole('button', { name: 'Watch', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Watch this metric' })
  await expect(dialog.getByRole('button', { name: 'Preview' })).toBeDisabled()
  await dialog.getByLabel('Name', { exact: true }).fill('Count watch')
  await readable(page, '[data-qqq-id="analysis-dialog"]')
  await dialog.getByRole('button', { name: 'Save watch' }).click()
  await dialog.getByRole('button', { name: 'Preview' }).click()
  await expect(
    dialog.getByText('Count is within the baseline band.', { exact: true })
  ).toBeVisible()
  await expect(dialog.locator('.recharts-reference-area')).toBeVisible()
  await expect(dialog.getByText('Baseline band: 8 to 14.')).toBeVisible()
})
