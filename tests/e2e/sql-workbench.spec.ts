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

// E2E: SQL Workbench — the SQL_WORKBENCH widget on the qbit's app page, with a mocked backend

import AxeBuilder from '@axe-core/playwright'
import { test, expect, type Page } from '@playwright/test'
import { METADATA, setupApiMocks } from './api-mocks'
import { checkA11y } from './a11y-helpers'

const BASE = '**/qqq/v1/sql-workbench'
const WIDGET = '[data-qqq-id="widget-sqlWorkbenchWidget"]'

/**
 * Asserts WCAG AA color contrast inside the workbench (the suite-wide check leaves this rule off
 * until the rest of the app passes it; the workbench passes it in both modes).
 *
 * @param page - The page.
 * @param selector - The part of the page to check (default: the workbench widget).
 */
async function expectWorkbenchContrast(page: Page, selector = WIDGET): Promise<void> {
  const results = await new AxeBuilder({ page })
    .include(selector)
    .withRules(['color-contrast'])
    .analyze()
  expect(results.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([])
}

/**
 * The editor's background and text colors.
 *
 * @param page - The page.
 * @returns The computed colors.
 */
async function editorColors(page: Page): Promise<{ background: string; color: string }> {
  return page
    .locator('.cm-editor')
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element)
      return { background: style.backgroundColor, color: style.color }
    })
}

const CAPABILITIES = {
  version: '1.0.0-RC.1',
  canWrite: true,
  canShare: true,
  writeModeEnabled: true,
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
      label: 'postgres',
      vendor: 'postgres',
      dialect: 'postgresql',
      readOnlyCredentials: true,
      readOnlyEnforced: true,
      transactionalDdl: true,
      writeAllowed: true,
    },
  ],
}

const RESULT = {
  executionUuid: 'exec-1',
  status: 'SUCCEEDED',
  mode: 'READ_ONLY',
  backendName: 'postgres',
  durationMs: 7,
  statements: [
    { index: 0, kind: 'READ', leadingKeyword: 'SELECT', text: 'SELECT', affectedRows: null },
  ],
  columns: [
    { name: 'id', label: 'id', typeName: 'int4', jdbcType: 4, kind: 'number' },
    { name: 'first_name', label: 'first_name', typeName: 'text', jdbcType: 12, kind: 'string' },
  ],
  rows: [
    [1, 'Alice'],
    [2, null],
  ],
  rowCount: 2,
  hasMore: false,
  truncated: false,
  truncatedReason: null,
}

const PREVIEW = {
  executionUuid: 'exec-2',
  status: 'PREVIEW',
  mode: 'WRITE_PREVIEW',
  backendName: 'postgres',
  durationMs: 5,
  statements: [
    {
      index: 0,
      kind: 'WRITE',
      leadingKeyword: 'DELETE',
      text: 'DELETE FROM person WHERE id = 2',
      affectedRows: 1,
    },
  ],
  dryRunSupported: true,
  totalAffectedRows: 1,
  rowGuardExceeded: false,
  rowGuardLimit: 1000,
  confirmToken: 'tok',
  expiresAt: '',
}

/**
 * Adds the workbench app, widget and endpoints to the mocked backend.
 *
 * @param page - The page.
 * @param options - Options.
 * @param options.brandAccent - Keep the mocked application's brand accent color (default true).
 * @returns The list of execute request bodies, filled as the page sends them.
 */
async function setupWorkbench(
  page: Page,
  { brandAccent = true }: { brandAccent?: boolean } = {}
): Promise<Record<string, unknown>[]> {
  const executes: Record<string, unknown>[] = []
  const metaData = {
    ...METADATA,
    // without the brand accent, the page uses the theme's own primary color
    branding: brandAccent ? METADATA.branding : { ...METADATA.branding, accentColor: null },
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
      {
        name: 'sqlWorkbench',
        label: 'SQL Workbench',
        type: 'APP',
        iconName: 'terminal',
        children: [],
      },
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
  }
  await page.route('**/qqq/v1/metaData**', (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/metaData/authentication'))
      return route.fallback()
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(metaData) })
  })
  await page.route('**/qqq/v1/widget/sqlWorkbenchWidget**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ type: 'SQL_WORKBENCH' }),
    })
  )
  await page.route(`${BASE}/capabilities`, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(CAPABILITIES) })
  )
  await page.route(`${BASE}/schema/**`, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        backendName: 'postgres',
        dialect: 'postgresql',
        schemas: [],
        truncated: false,
        keywords: [],
        functions: [],
        qqqTables: [],
        cachedAt: '',
      }),
    })
  )
  await page.route(`${BASE}/notebooks**`, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ notebooks: [] }) })
  )
  await page.route(`${BASE}/history**`, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ executions: [] }) })
  )
  await page.route(`${BASE}/execute`, (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>
    executes.push(body)
    const response =
      body.mode === 'WRITE'
        ? body.confirmToken
          ? { ...RESULT, mode: 'WRITE_COMMIT', columns: [], rows: [], rowCount: 0, rowsAffected: 1 }
          : PREVIEW
        : RESULT
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) })
  })
  return executes
}

test.describe('SQL Workbench', () => {
  test('runs read-only SQL from the app page and shows the result grid', async ({ page }) => {
    await setupApiMocks(page)
    const executes = await setupWorkbench(page)
    await page.goto('/app/sqlWorkbench')

    await expect(page.getByRole('button', { name: 'New notebook' })).toBeVisible({
      timeout: 30000,
    })
    const editor = page.getByRole('textbox', { name: 'SQL for cell 1' })
    await editor.click()
    await page.keyboard.type('SELECT id, first_name FROM person')
    await page.getByRole('button', { name: 'Run' }).click()

    const grid = page.getByRole('table', { name: 'Query result' })
    await expect(grid.getByText('Alice')).toBeVisible()
    await expect(grid.getByText('NULL')).toBeVisible()
    expect(executes[0]).toMatchObject({
      backendName: 'postgres',
      mode: 'READ_ONLY',
      sql: 'SELECT id, first_name FROM person',
    })
    await checkA11y(page)
    await page.getByRole('button', { name: 'Export' }).click()
    await expect(page.getByRole('menuitem', { name: /XLSX/ })).toHaveAttribute(
      'href',
      /executions\/exec-1\/export\?format=xlsx/
    )
  })

  test('write mode commits only after the confirmation dialog', async ({ page }) => {
    await setupApiMocks(page)
    const executes = await setupWorkbench(page)
    await page.goto('/app/sqlWorkbench')

    await page.getByRole('textbox', { name: 'SQL for cell 1' }).click()
    await page.keyboard.type('DELETE FROM person WHERE id = 2')
    await page.getByLabel('Write mode').check()
    await page.getByRole('button', { name: 'Preview write' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Dry run (rolled back): 1 row affected.')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Commit write' })).toBeDisabled()
    await dialog.getByLabel(/Type postgres to confirm/).fill('postgres')
    await dialog.getByRole('button', { name: 'Commit write' }).click()

    await expect(page.getByText(/Succeeded · .* · 1 row affected/)).toBeVisible()
    expect(executes.map((e) => e.confirmToken ?? null)).toEqual([null, 'tok'])
  })

  test('follows the light / dark toggle live, with AA contrast in both modes', async ({ page }) => {
    // The theme's own palette: a brand accent is the application's choice (the mocked one,
    // #6366f1, is under 4.5:1 behind white text everywhere in the app; see a11y-helpers.ts).
    await setupApiMocks(page)
    await setupWorkbench(page, { brandAccent: false })
    await page.goto('/app/sqlWorkbench')

    const editor = page.getByRole('textbox', { name: 'SQL for cell 1' })
    await editor.click()
    await page.keyboard.type('SELECT id, first_name FROM person')
    await page.getByRole('button', { name: 'Run' }).click()
    await expect(page.getByRole('table', { name: 'Query result' })).toBeVisible()
    await expectWorkbenchContrast(page)
    const light = await editorColors(page)

    // switch to dark mode from the user menu, without leaving the page
    await page.locator('[data-qqq-id="button-account"]').click()
    await page.locator('[data-qqq-id="menu-item-dark-mode"]').click()
    await page.keyboard.press('Escape')
    await expect(page.locator('html')).toHaveClass(/dark/)

    const dark = await editorColors(page)
    expect(dark.background).not.toBe(light.background)
    expect(dark.color).not.toBe(light.color)
    // the editor surface is the app's input surface, not CodeMirror's built-in light theme
    const appBackground = await page.evaluate(() => {
      const probe = document.createElement('div')
      probe.style.backgroundColor = 'var(--color-background)'
      document.body.appendChild(probe)
      const color = getComputedStyle(probe).backgroundColor
      probe.remove()
      return color
    })
    expect(dark.background).toBe(appBackground)
    await expectWorkbenchContrast(page)

    await page.getByRole('tab', { name: 'Chart' }).click()
    await expect(page.getByLabel('Chart type')).toBeVisible()
    await expectWorkbenchContrast(page)

    await page.getByLabel('Write mode').check()
    await page.getByRole('button', { name: 'Preview write' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectWorkbenchContrast(page, '[data-qqq-id="dialog-sql-write-confirm"]')
  })

  test('fits a phone screen without sideways page scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await setupApiMocks(page)
    await setupWorkbench(page)
    await page.goto('/app/sqlWorkbench')
    await page.getByRole('textbox', { name: 'SQL for cell 1' }).click()
    await page.keyboard.type('SELECT id, first_name FROM person')
    await page.getByRole('button', { name: 'Run' }).click()
    await expect(page.getByRole('table', { name: 'Query result' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Results' })).toBeVisible()
    // nothing in the workbench is wider than the page; only the result grid may scroll inside
    const overflow = await page.evaluate(() => {
      const root = document.documentElement
      return root.scrollWidth - root.clientWidth
    })
    expect(overflow).toBe(0)
  })
})
