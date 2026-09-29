/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Saved reports (setup widgets, rendering), scheduled reports, and record sharing.
import type { Locator, Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import type { Backend } from '../../support/fixtures'
import { expectTouchReady } from '../../support/touch'
import { listCell } from '../security/support/ui'
import { byId, downloadText, expectLoaded, openRecord, parseCsv, recordAction, sqlRows } from './widget-support'

async function openShare(page: Page, path: string) {
  await open(page, path)
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('[data-qqq-id="share-status"]')).toHaveCount(0)
  await expectTouchReady(page, dialog)
  return dialog
}

/**
 * Asserts an open schedule editor popover fits the screen: inside the viewport, its body
 * reachable (it scrolls inside when taller than the space), no sideways page scroll, and
 * touch-sized choices on a touch screen.
 */
async function expectPopoverFits(page: Page, popover: Locator) {
  const box = (await popover.boundingBox())!
  const viewport = page.viewportSize()!
  expect(box.x, 'popover left edge on screen').toBeGreaterThanOrEqual(0)
  expect(box.x + box.width, 'popover right edge on screen').toBeLessThanOrEqual(viewport.width + 1)
  expect(box.y, 'popover top edge on screen').toBeGreaterThanOrEqual(0)
  expect(box.y + box.height, 'popover bottom edge on screen').toBeLessThanOrEqual(viewport.height + 1)
  // the choices do not overlap one another
  const overlaps = await popover.locator('label').evaluateAll((labels) => {
    const boxes = labels.map((label) => label.getBoundingClientRect())
    return boxes.filter((a, i) => boxes.some((b, j) => j !== i && a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5)).length
  })
  expect(overlaps, 'overlapping choices').toBe(0)
  await expectTouchReady(page, popover)
}

/** Runs a sharing process directly with the test's session. */
async function shareViaApi(backend: Backend, processName: string, values: Record<string, unknown>) {
  const response = await backend.api.post(`/qqq/v1/processes/${processName}/init`, { multipart: { values: JSON.stringify(values) } })
  return { status: response.status(), body: await response.json() }
}

test('[WID-030] filter and columns setup shows the saved filter, sort and visible columns by label @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const [report] = await sqlRows(backend, 'select query_filter_json, columns_json from saved_report where id = 102')
  expect(JSON.parse(report.query_filter_json).criteria).toHaveLength(2)
  await openRecord(page, '/app/savedReport/102')
  await expectLoaded(page, 'reportSetupWidget')
  await expect(byId(page, 'filter-boolean-operator-reportSetupWidget-0')).toHaveText('Match all of:')
  await expect(byId(page, 'filter-criterion-reportSetupWidget-0-0')).toHaveText('First Name starts with A')
  await expect(byId(page, 'filter-criterion-reportSetupWidget-0-1')).toHaveText('Annual Salary greater than 1000')
  await expect(byId(page, 'filter-sort-reportSetupWidget')).toHaveText('Sorted by Last Name descending')
  await expect(byId(page, 'report-columns-reportSetupWidget').locator('li')).toHaveText(['Id', 'First Name', 'Last Name'])
  await expect(byId(page, 'filter-preview-reportSetupWidget')).toBeVisible()
  await openRecord(page, '/app/savedReport/1')
  await expectLoaded(page, 'reportSetupWidget')
  await expect(byId(page, 'filter-none-reportSetupWidget')).toHaveText('No filters')
  await expect(byId(page, 'report-columns-reportSetupWidget').locator('li')).toHaveText(['ID', 'Species'])
})

test('[WID-070] saved-report filter editor cancels drafts and persists OK through the form @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const before = (await sqlRows(backend, 'select query_filter_json, columns_json from saved_report where id = 1'))[0]
  await open(page, '/app/savedReport/1/edit')
  const edit = page.getByRole('button', { name: 'Edit Filters and Columns' })
  await expect(edit).toBeVisible()
  const addFilters = page.getByRole('button', { name: '+ Add Filters' })
  await expect(addFilters).toBeVisible()
  await addFilters.click()
  const dialog = page.getByRole('dialog', { name: 'Edit Filters and Columns' })
  await expect(dialog.getByRole('tab', { name: 'Filters and sort' })).toHaveAttribute('aria-selected', 'true')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await edit.click()
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Sort by', { exact: true }).selectOption('possibleValueLabel')
  const filters = dialog.getByRole('tab', { name: 'Filters and sort' })
  const columns = dialog.getByRole('tab', { name: 'Columns', exact: true })
  await filters.focus()
  await filters.press('ArrowRight')
  await expect(columns).toBeFocused()
  await expect(columns).toHaveAttribute('aria-selected', 'true')
  const panel = dialog.getByRole('tabpanel', { name: 'Columns', exact: true })
  await expect(panel).toBeVisible()
  await expect(columns).toHaveAttribute('aria-controls', (await panel.getAttribute('id'))!)
  await columns.press('Tab')
  await expect(dialog.getByRole('searchbox', { name: 'Search Fields' })).toBeFocused()
  await columns.focus()
  await columns.press('Home')
  await expect(filters).toBeFocused()
  await expect(dialog.getByLabel('Sort by', { exact: true })).toHaveValue('possibleValueLabel')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)
  expect((await sqlRows(backend, 'select query_filter_json, columns_json from saved_report where id = 1'))[0]).toEqual(before)

  await edit.click()
  await dialog.getByLabel('Sort by', { exact: true }).selectOption('possibleValueLabel')
  await dialog.getByRole('button', { name: '+ Add sort' }).click()
  await dialog.getByLabel('Then by 2').selectOption('possibleValueId')
  await dialog.getByRole('checkbox', { name: 'Ascending' }).nth(1).uncheck()
  await dialog.getByRole('button', { name: 'OK' }).click()
  await expect(dialog).toHaveCount(0)
  expect((await sqlRows(backend, 'select query_filter_json, columns_json from saved_report where id = 1'))[0]).toEqual(before)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/savedReport\/1\/?$/)
  const after = (await sqlRows(backend, 'select query_filter_json, columns_json from saved_report where id = 1'))[0]
  expect(JSON.parse(after.query_filter_json).orderBys).toEqual([
    { fieldName: 'possibleValueLabel', isAscending: true },
    { fieldName: 'possibleValueId', isAscending: false },
  ])
  expect(JSON.parse(after.columns_json).columns.some((column: { name: string }) => column.name === 'possibleValueLabel')).toBe(true)
})

test('[WID-070] report setup assigns a filter variable and saves its expression @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const [before] = await sqlRows(backend, 'select query_filter_json from saved_report where id = 1')
  try {
    await open(page, '/app/savedReport/1/edit')
    await page.getByRole('button', { name: 'Edit Filters and Columns' }).click()
    const dialog = page.getByRole('dialog', { name: 'Edit Filters and Columns' })
    await dialog.getByRole('button', { name: 'Add condition' }).click()
    await byId(page, 'filter-field-0-0').selectOption('possibleValueLabel')
    await byId(page, 'filter-value-0-0-assign-variable').click()
    await expect(byId(page, 'filter-value-0-0-variable')).toHaveText('${VARIABLE}')
    await expect(dialog.getByText('Cannot perform query because of a missing value for a variable.')).toBeVisible()
    const popupQueries: string[] = []
    page.context().on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname.includes('/qqq/v1/table/petSpecies/query')) popupQueries.push(request.url())
    })
    const [queryPage] = await Promise.all([
      page.waitForEvent('popup'),
      dialog.getByRole('link', { name: 'Open in new window' }).click(),
    ])
    await expect(queryPage.getByRole('alert').filter({ hasText: 'Cannot perform query because of a missing value for a variable.' })).toBeVisible()
    expect(popupQueries).toEqual([])
    await queryPage.close()
    await dialog.getByRole('button', { name: 'OK' }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page).toHaveURL(/\/app\/savedReport\/1\/?$/)
    const [after] = await sqlRows(backend, 'select query_filter_json from saved_report where id = 1')
    expect(JSON.parse(after.query_filter_json).criteria[0]).toMatchObject({
      fieldName: 'possibleValueLabel',
      values: [{ type: 'FilterVariableExpression', fieldName: 'possibleValueLabel', valueIndex: 0 }],
    })
  } finally {
    const restored = await backend.api.put('/data/savedReport/1', { multipart: { queryFilterJson: before.query_filter_json } })
    expect(restored.status()).toBe(200)
  }
})

test('[WID-072] API-versioned report setup loads table metadata and previews through the real application API @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const apiRoot = '/qqq/v1/acceptance-api/2026.Q3'
  const metadata = await backend.api.get(`${apiRoot}/metaData/table/person`)
  expect(metadata.status()).toBe(200)
  expect((await metadata.json()).name).toBe('person')
  const unknownVersion = await backend.api.get('/qqq/v1/acceptance-api/2025.Q1/metaData/table/person')
  expect(unknownVersion.status()).toBe(404)

  const versionedRequests: string[] = []
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (path.startsWith(apiRoot)) versionedRequests.push(`${request.method()} ${path}`)
  })
  await page.route('**/qqq/v1/widget/reportSetupWidget*', async (route) => {
    const response = await route.fetch()
    const payload = await response.json()
    await route.fulfill({ response, contentType: 'application/json', body: JSON.stringify({
      ...payload,
      isApiVersioned: true,
      apiName: 'acceptanceApi',
      apiPath: 'acceptance-api',
      apiVersion: '2026.Q3',
    }) })
  })

  await open(page, '/app/savedReport/102/edit')
  await page.getByRole('button', { name: 'Edit Filters and Columns' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit Filters and Columns' })
  await expect(dialog.getByText('Preview', { exact: true })).toBeVisible()
  await expect(dialog.locator('[data-qqq-id="filter-preview-reportSetupWidget"]')).toBeVisible()
  await expect.poll(() => versionedRequests).toContain(`GET ${apiRoot}/metaData/table/person`)
  await expect.poll(() => versionedRequests).toContain(`POST ${apiRoot}/table/person/query`)
  await expect.poll(() => versionedRequests).toContain(`POST ${apiRoot}/table/person/count`)
  const refreshQuery = page.waitForRequest((request) => request.method() === 'POST' && new URL(request.url()).pathname === `${apiRoot}/table/person/query`)
  const refreshCount = page.waitForRequest((request) => request.method() === 'POST' && new URL(request.url()).pathname === `${apiRoot}/table/person/count`)
  await dialog.getByRole('button', { name: 'Refresh preview' }).click()
  await Promise.all([refreshQuery, refreshCount])
})

test('[WID-070] selecting a saved view only changes the report draft @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const before = await backend.sql('select query_filter_json, columns_json from saved_report where id = 102')
  const viewsBefore = await backend.sql('select id, view_json from saved_view order by id')
  const viewWrites: string[] = []
  page.on('request', (request) => {
    if (/processes\/(store|delete)SavedView\//.test(request.url())) viewWrites.push(request.url())
  })
  await open(page, '/app/savedReport/102/edit')
  await page.getByRole('button', { name: 'Edit Filters and Columns' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit Filters and Columns' })
  await dialog.getByRole('button', { name: 'Saved views' }).press('Enter')
  await expect(page.getByRole('menuitem', { name: 'Save As...' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'New View' })).toHaveCount(0)
  await page.getByRole('menuitem', { name: 'Alice People View', exact: true }).click()
  await dialog.getByRole('button', { name: 'Basic', exact: true }).click()
  await expect(byId(page, 'quick-filter-bar')).toBeVisible()
  await dialog.getByRole('button', { name: 'Advanced', exact: true }).click()
  await expect(byId(page, 'filter-builder')).toBeVisible()
  const selectedSort = await dialog.getByLabel('Sort by', { exact: true }).inputValue()
  await dialog.getByLabel('Sort by', { exact: true }).selectOption(selectedSort === 'id' ? 'firstName' : 'id')
  await dialog.getByRole('button', { name: 'Reset Changes', exact: true }).click()
  await expect(dialog.getByLabel('Sort by', { exact: true })).toHaveValue(selectedSort)
  await dialog.getByRole('button', { name: 'Reset to New View' }).click()
  await expect(dialog.getByRole('button', { name: 'Saved views', exact: true })).toBeVisible()
  await expect(dialog.getByLabel('Sort by', { exact: true })).toHaveValue('id')
  await expect(dialog.getByLabel('Ascending', { exact: true })).not.toBeChecked()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  expect(await backend.sql('select query_filter_json, columns_json from saved_report where id = 102')).toEqual(before)
  expect(await backend.sql('select id, view_json from saved_view order by id')).toEqual(viewsBefore)
  expect(viewWrites).toEqual([])
})

test('[WID-073] report preview handles missing count capability and refuses an oversized full-column copy @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  expect((await backend.api.put('/data/savedReport/1', { multipart: {
    tableName: 'qryLedger', queryFilterJson: JSON.stringify({ orderBys: [{ fieldName: 'id', isAscending: true }] }),
    columnsJson: JSON.stringify({ columns: [{ name: 'id', isVisible: true }, { name: 'entry', isVisible: true }] }),
  } })).status()).toBe(200)
  const before = await backend.sql('select query_filter_json, columns_json from saved_report where id = 1')
  await page.route(/\/qqq\/v1\/metaData(?:\?|$)/, async route => {
    const response = await route.fetch()
    const payload = await response.json()
    payload.supplementalInstanceMetaData = { ...payload.supplementalInstanceMetaData,
      materialDashboard: { ...payload.supplementalInstanceMetaData?.materialDashboard, queryScreenCopyFullQueryColumnValuesLimit: 2 } }
    await route.fulfill({ response, json: payload })
  })
  const counts: string[] = []
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/qqq/v1/table/qryLedger/count') counts.push(request.url())
  })
  await open(page, '/app/savedReport/1/edit')
  await page.getByRole('button', { name: 'Edit Filters and Columns' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit Filters and Columns' })
  const preview = byId(page, 'filter-preview-reportSetupWidget')
  const rows = await backend.sql('select entry from qry_ledger order by id')
  await expect(preview.getByRole('gridcell').and(preview.locator('[data-qqq-id="grid-cell-entry"]'))).toHaveText(rows.map(row => row.entry!))
  await expect(preview.locator('[data-qqq-id="pagination-summary"]')).toContainText('Showing 1–3')
  await expect(preview.locator('[data-qqq-id="pagination-total"]')).toHaveCount(0)
  await expect(preview.getByRole('button', { name: 'Next page' })).toBeDisabled()
  expect(counts).toEqual([])
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    writeText: async (text: string) => { document.documentElement.dataset.copiedReportValues = text },
  } }))
  await preview.getByRole('button', { name: 'Entry column menu' }).press('Enter')
  await page.getByRole('menuitem', { name: 'Copy full query values' }).click()
  await expect(byId(page, 'filter-preview-notice-reportSetupWidget')).toContainText('too many rows to copy (limit: 2)')
  await expect(page.locator('html')).not.toHaveAttribute('data-copied-report-values')
  await preview.getByRole('button', { name: 'Entry column menu' }).press('Enter')
  await page.getByRole('menuitem', { name: 'Copy page values' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-copied-report-values', rows.map(row => row.entry).join('\n') + '\n')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  expect(await backend.sql('select query_filter_json, columns_json from saved_report where id = 1')).toEqual(before)
})

test('[WID-073] an empty report preview offers no copy action and leaves the saved report unchanged @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  expect((await backend.api.put('/data/savedReport/1', { multipart: {
    tableName: 'qryItem', queryFilterJson: JSON.stringify({ criteria: [{ fieldName: 'id', operator: 'GREATER_THAN', values: [999] }] }),
    columnsJson: JSON.stringify({ columns: [{ name: 'id', isVisible: true }, { name: 'name', isVisible: true }] }),
  } })).status()).toBe(200)
  expect(await backend.sql('select count(*) as n from qry_item where id > 999')).toEqual([{ n: '0' }])
  const before = await backend.sql('select query_filter_json, columns_json from saved_report where id = 1')
  await open(page, '/app/savedReport/1/edit')
  await page.getByRole('button', { name: 'Edit Filters and Columns' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit Filters and Columns' })
  const preview = byId(page, 'filter-preview-reportSetupWidget')
  await expect(preview.getByText('No records found', { exact: true })).toBeVisible()
  await expect(preview.getByRole('button', { name: 'Next page' })).toBeDisabled()
  await expect(preview.getByRole('button', { name: /column menu$/ })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  expect(await backend.sql('select query_filter_json, columns_json from saved_report where id = 1')).toEqual(before)
})

test('[WID-073] read-only report preview pages and sorts without changing the report @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const queryFilterJson = JSON.stringify({ orderBys: [{ fieldName: 'id', isAscending: true }] })
  const columnsJson = JSON.stringify({ columns: [{ name: 'id', isVisible: true, width: 150 }, { name: 'name', isVisible: true, width: 220 }] })
  expect((await backend.api.put('/data/savedReport/1', { multipart: { tableName: 'carrier', queryFilterJson, columnsJson } })).status()).toBe(200)
  const before = await backend.sql('select query_filter_json, columns_json from saved_report where id = 1')
  await openRecord(page, '/app/savedReport/1')
  await expectLoaded(page, 'reportSetupWidget')
  const preview = byId(page, 'filter-preview-reportSetupWidget')
  await preview.getByLabel('Rows per page').selectOption('10')
  await expect(preview.locator('[data-qqq-id="pagination-summary"]')).toContainText('Showing 1–10 of 11')
  await preview.getByRole('button', { name: 'Next page' }).click()
  await expect(preview.locator('[data-qqq-id="pagination-summary"]')).toContainText('Showing 11–11 of 11')
  await preview.getByRole('button', { name: 'Sort by Name' }).click()
  await expect(preview.locator('[data-qqq-id="pagination-summary"]')).toContainText('Showing 1–10 of 11')
  const names = await backend.sql('select name from carrier order by name asc limit 10')
  await expect(preview.getByRole('gridcell').and(preview.locator('[data-qqq-id="grid-cell-name"]'))).toHaveText(names.map((row) => row.name!))
  const resize = preview.getByRole('separator', { name: 'Resize Name column' })
  await resize.focus()
  await resize.press('ArrowRight')
  await expect(resize).toHaveAttribute('aria-valuenow', '230')
  const saved = await backend.sql('select query_filter_json, columns_json from saved_report where id = 1')
  expect(saved).toEqual(before)
})

test('[WID-073] report editor grid pages, sorts and saves a resized column @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const seeded = await backend.api.put('/data/savedReport/1', { multipart: {
    tableName: 'carrier',
    queryFilterJson: JSON.stringify({ orderBys: [{ fieldName: 'id', isAscending: true }] }),
    columnsJson: JSON.stringify({ columns: [{ name: 'id', isVisible: true, width: 150 }, { name: 'name', isVisible: true, width: 220 }] }),
  } })
  expect(seeded.status()).toBe(200)
  await open(page, '/app/savedReport/1/edit')
  await page.getByRole('button', { name: 'Edit Filters and Columns' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit Filters and Columns' })
  const preview = dialog.locator('[data-qqq-id="filter-preview-reportSetupWidget"]')
  await expect(preview.locator('[data-qqq-id="grid-carrier"]')).toBeVisible()
  await expect(preview.locator('[data-qqq-id="grid-select-all"]')).toHaveCount(0)
  await expect(preview.getByRole('gridcell').and(preview.locator('[data-qqq-id="grid-cell-name"]'))).toHaveCount(11)
  const refresh = page.waitForRequest((request) => request.method() === 'POST' && new URL(request.url()).pathname === '/qqq/v1/table/carrier/query')
  await preview.getByRole('button', { name: 'Refresh preview' }).click()
  await refresh
  await expect(preview.getByRole('button', { name: 'Refresh preview' })).toBeEnabled()
  const firstRow = preview.getByRole('row').nth(1)
  const standardHeight = (await firstRow.boundingBox())!.height
  await preview.getByRole('button', { name: 'Select display density' }).press('Enter')
  await page.getByRole('menuitemradio', { name: 'Compact', exact: true }).click()
  expect((await firstRow.boundingBox())!.height).toBeLessThan(standardHeight)
  await preview.getByRole('button', { name: 'Name column menu' }).press('Enter')
  await page.getByRole('menuitem', { name: 'Pin to right' }).click()

  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    writeText: async (text: string) => { document.documentElement.dataset.copiedReportValues = text },
  } }))
  await preview.getByRole('button', { name: 'Name column menu' }).press('Enter')
  await page.getByRole('menuitem', { name: 'Copy full query values' }).click()
  const allNames = await backend.sql('select name from carrier order by id')
  await expect(page.locator('html')).toHaveAttribute('data-copied-report-values', allNames.map((row) => row.name).join('\n') + '\n')


  const sizedQuery = page.waitForRequest((request) => request.method() === 'POST'
    && new URL(request.url()).pathname === '/qqq/v1/table/carrier/query'
    && (request.postDataJSON() as { filter?: { limit?: number } }).filter?.limit === 10)
  await preview.getByLabel('Rows per page').selectOption('10')
  await sizedQuery
  await expect(preview.locator('[data-qqq-id="pagination-summary"]')).toContainText('Showing 1–10 of 11')
  const nextPage = page.waitForRequest((request) => request.method() === 'POST'
    && new URL(request.url()).pathname === '/qqq/v1/table/carrier/query'
    && (request.postDataJSON() as { filter?: { skip?: number } }).filter?.skip === 10)
  await preview.getByRole('button', { name: 'Next page' }).click()
  await nextPage
  await expect(preview.locator('[data-qqq-id="pagination-summary"]')).toContainText('Showing 11–11 of 11')
  await expect(preview.getByRole('button', { name: 'Next page' })).toBeDisabled()

  const sortedQuery = page.waitForRequest((request) => request.method() === 'POST'
    && new URL(request.url()).pathname === '/qqq/v1/table/carrier/query'
    && (request.postDataJSON() as { filter?: { orderBys?: Array<{ fieldName: string; isAscending: boolean }> } })
      .filter?.orderBys?.[0]?.fieldName === 'name')
  await preview.getByRole('button', { name: 'Sort by Name' }).click()
  const sort = (await sortedQuery).postDataJSON() as { filter: { orderBys: Array<{ fieldName: string; isAscending: boolean }> } }
  expect(sort.filter.orderBys[0]).toEqual({ fieldName: 'name', isAscending: true })
  await expect(preview.locator('[data-qqq-id="pagination-summary"]')).toContainText('Showing 1–10 of 11')

  const resize = preview.getByRole('separator', { name: 'Resize Name column' })
  const before = Number(await resize.getAttribute('aria-valuenow'))
  await resize.focus()
  await resize.press('ArrowRight')
  await expect(resize).toHaveAttribute('aria-valuenow', String(before + 10))
  await dialog.getByRole('button', { name: 'OK' }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/savedReport\/1\/?$/)
  const [saved] = await sqlRows(backend, 'select query_filter_json, columns_json from saved_report where id = 1')
  expect(JSON.parse(saved.query_filter_json).orderBys[0]).toEqual({ fieldName: 'name', isAscending: true })
  expect(JSON.parse(saved.columns_json).columns.find((column: { name: string }) => column.name === 'name').width).toBe(before + 10)
  expect(JSON.parse(saved.columns_json).columns.find((column: { name: string }) => column.name === 'name').pinned).toBe('right')
})

test('[WID-073] report column statistics and CSV honor the filter without saving the draft @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  expect((await backend.api.put('/data/savedReport/1', { multipart: {
    tableName: 'qryItem',
    queryFilterJson: JSON.stringify({ criteria: [{ fieldName: 'quantity', operator: 'GREATER_THAN', values: [5] }] }),
    columnsJson: JSON.stringify({ columns: [{ name: 'id', isVisible: true }, { name: 'quantity', isVisible: true }] }),
  } })).status()).toBe(200)
  const before = await backend.sql('select query_filter_json, columns_json from saved_report where id = 1')
  await open(page, '/app/savedReport/1/edit')
  await page.getByRole('button', { name: 'Edit Filters and Columns' }).click()
  const editor = page.getByRole('dialog', { name: 'Edit Filters and Columns' })
  await editor.getByRole('button', { name: 'Quantity column menu' }).press('Enter')
  await page.getByRole('menuitem', { name: 'Column statistics' }).click()
  const stats = page.getByRole('dialog', { name: 'Column Statistics for Quantity' })
  await expect(stats).toBeVisible()
  await expect(stats.getByText('Calculating statistics...')).toHaveCount(0)
  const [totals] = await sqlRows(backend, 'select sum(quantity) as total, min(quantity) as minimum, max(quantity) as maximum from qry_item where quantity > 5')
  const distribution = await sqlRows(backend, 'select quantity, count(*) as frequency from qry_item where quantity > 5 group by quantity order by quantity')
  await expect(stats.locator('[data-qqq-id="column-stats-stat-sum"]')).toHaveText(Number(totals.total).toLocaleString('en-US'))
  await expect(stats.locator('[data-qqq-id="column-stats-stat-min"]')).toHaveText(totals.minimum)
  await expect(stats.locator('[data-qqq-id="column-stats-stat-max"]')).toHaveText(totals.maximum)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    stats.getByRole('button', { name: 'Export', exact: true }).click(),
  ])
  const rows = parseCsv(await downloadText(download))
  expect(rows[0]).toEqual(['Quantity', 'Count'])
  const exported = rows.slice(1).map(([quantity, count]) => ({ quantity: Number(quantity.replace(/,/g, '')), count: Number(count) }))
    .sort((a, b) => a.quantity - b.quantity)
  expect(exported).toEqual(distribution.map((row) => ({ quantity: Number(row.quantity), count: Number(row.frequency) })))
  await stats.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(stats).toHaveCount(0)
  await expect(editor).toBeVisible()
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(await backend.sql('select query_filter_json, columns_json from saved_report where id = 1')).toEqual(before)
})

test('[WID-029] pivot table setup shows the saved rows, columns and values by label @mobile', async ({ page, diagnostics }) => {
  void diagnostics
  await openRecord(page, '/app/savedReport/102')
  await expectLoaded(page, 'pivotTableSetupWidget')
  await expect(byId(page, 'pivot-rows-pivotTableSetupWidget')).toContainText('Last Name')
  await expect(byId(page, 'pivot-columns-pivotTableSetupWidget')).toContainText('Is Employed')
  await expect(byId(page, 'pivot-values-pivotTableSetupWidget')).toContainText('Count of Id')
  await expect(byId(page, 'pivot-values-pivotTableSetupWidget')).toContainText('Sum of Annual Salary')
  await openRecord(page, '/app/savedReport/1')
  await expectLoaded(page, 'pivotTableSetupWidget')
  await expect(byId(page, 'widget-pivotTableSetup-pivotTableSetupWidget')).toContainText('This report does not use a pivot table.')
})

test('[RPT-009] a saved report record shows its full definition @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const [report] = await sqlRows(backend, 'select label, table_name from saved_report where id = 102')
  await openRecord(page, '/app/savedReport/102')
  await expect(page.getByRole('heading', { level: 1, name: report.label })).toBeVisible()
  await expectLoaded(page, 'reportSetupWidget')
  await expectLoaded(page, 'pivotTableSetupWidget')
  await expect(byId(page, 'report-columns-reportSetupWidget').locator('li')).toHaveCount(3)
  await expect(byId(page, 'pivot-values-pivotTableSetupWidget')).toContainText('Count of Id')
  await expectTouchReady(page, byId(page, 'widget-reportSetupWidget'))
  await expectTouchReady(page, byId(page, 'widget-pivotTableSetupWidget'))
})

test('[WID-073] create a report from a query, switch tables, save, reopen and render @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/navDeepItem')
  await page.locator('[data-qqq-id="button-saved-views"]').click()
  const createReport = page.getByRole('menuitem', { name: 'Create Report from Current View' })
  const href = await createReport.getAttribute('href')
  const presets = JSON.parse(decodeURIComponent(href!.split('#defaultValues=')[1]))
  expect(JSON.parse(presets.columnsJson).columns.some((column: { name: string }) => column.name === '__check__')).toBe(false)
  await createReport.click()
  await page.getByLabel('Report Name', { exact: false }).fill('Audit RC depth report')
  await page.getByRole('combobox', { name: /^Table/ }).click()
  await page.getByRole('textbox', { name: 'Search Table options' }).fill('Audit')
  await page.getByRole('option', { name: 'Audit', exact: true }).click()
  const columns = byId(page, 'report-columns-reportSetupWidget').locator('li')
  await expect(columns).toHaveText(['Id'])
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/savedReport\/\d+\/?$/)
  const id = new URL(page.url()).pathname.split('/').filter(Boolean).at(-1)!
  const stored = (await sqlRows(backend, `select table_name, columns_json from saved_report where id = ${Number(id)}`))[0]
  expect(stored.table_name).toBe('audit')
  expect(JSON.parse(stored.columns_json).columns.some((column: { name: string }) => ['__check__', 'code', 'shelf', 'name'].includes(column.name))).toBe(false)
  await page.reload()
  await expect(byId(page, 'report-columns-reportSetupWidget').locator('li')).toHaveText(['Id'])
  await recordAction(page, 'Render Report')
  await page.getByLabel(/Report Format/).click()
  await page.getByRole('option', { name: 'CSV', exact: true }).click()
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  const link = page.locator('[data-qqq-id="link-process-download"]')
  await expect(link).toBeVisible()
  const [download] = await Promise.all([page.waitForEvent('download'), link.click()])
  const rows = parseCsv(await downloadText(download))
  expect(rows[0]).toEqual(['Id'])
  expect(rows.length).toBeGreaterThan(1)
})

test('[RPT-010] a saved report renders to a CSV with its saved columns and rows @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const species = (await (await backend.api.get('/data/petSpecies')).json()).records as Array<{ values: { possibleValueId: number; possibleValueLabel: string } }>
  expect(species.length).toBeGreaterThan(0)
  await openRecord(page, '/app/savedReport/1')
  await recordAction(page, 'Render Report')
  await expect(page).toHaveURL(/\/app\/renderSavedReport/)
  await page.getByLabel(/Report Format/).click()
  await page.getByRole('option', { name: 'CSV' }).click()
  await page.getByRole('button', { name: 'Submit' }).click()
  // the process download form component (#649 processes) delivers the report file
  const link = page.locator('[data-qqq-id="link-process-download"]')
  await expect(link).toContainText('Pet Species Report')
  const [download] = await Promise.all([page.waitForEvent('download'), link.click()])
  const rows = parseCsv(await downloadText(download))
  expect(rows[0]).toEqual(['ID', 'Species'])
  expect(rows.slice(1)).toEqual(species.map((record) => [String(record.values.possibleValueId), record.values.possibleValueLabel]))
})

/**
 * Opens the scheduled-report create form from the saved report's Schedules section and fills it,
 * except the schedule. As in Material, "Add new" opens the child create form over the saved report
 * (a `#/createChild=` link) with the Saved Report preset to this report and locked (QRun-IO/qqq#714).
 */
async function openScheduleForm(page: Page) {
  await openRecord(page, '/app/savedReport/1')
  await expectLoaded(page, 'scheduledReportJoinSavedReport')
  await byId(page, 'child-record-add-scheduledReportJoinSavedReport').click()
  await expect(page).toHaveURL(/\/app\/savedReport\/1\/?#\/createChild=scheduledReport\/defaultValues=/)
  const dialog = page.locator('[data-qqq-id="dialog-create-child-scheduledReport"]')
  await expect(dialog.getByRole('heading', { name: 'Add Scheduled Report' })).toBeVisible()
  // the saved report stays underneath the modal dialog (hidden from assistive technology while it is open)
  await expect(page.getByRole('heading', { level: 1, name: 'Pet Species Report', includeHidden: true })).toBeVisible()
  const savedReport = dialog.getByRole('combobox', { name: 'Saved Report' })
  await expect(savedReport).toBeDisabled()
  await expect(savedReport).toHaveText('Pet Species Report')
  // Is Active defaults to on from its metadata default (#649 records); make sure it ends checked
  await dialog.getByRole('checkbox', { name: 'Is Active' }).check()
  await dialog.getByLabel(/^Format/).click()
  await page.getByRole('option', { name: /^CSV/ }).click()
  await expect(dialog.getByLabel(/^Format/)).toContainText('CSV')
  await dialog.getByLabel(/^To Addresses/).fill('owned-schedule@example.com')
  await dialog.getByLabel(/^Subject/).fill('Owned schedule')
  await dialog.getByLabel(/^Cron Time Zone/).click()
  await page.getByRole('option', { name: /^UTC$/ }).first().click()
  return dialog
}

/** Fills the scheduled-report create form, typing the expression in the schedule editor's Advanced mode, and creates it. */
async function fillSchedule(page: Page, cronExpression: string) {
  const dialog = await openScheduleForm(page)
  await byId(page, 'cron-mode-advanced-scheduledReportCronWidget').click()
  await dialog.getByLabel(/^Cron Expression/).fill(cronExpression)
  const insert = page.waitForRequest((request) => request.method() === 'POST' && new URL(request.url()).pathname === '/qqq/v1/table/scheduledReport')
  await dialog.getByRole('button', { name: 'Create', exact: true }).click()
  // the locked Saved Report is always submitted with its preset value
  expect(/name="savedReportId"\r\n\r\n([^\r]*)/.exec((await insert).postData() ?? '')?.[1]).toBe('1')
  return dialog
}

test('[WID-064] the schedule editor builds a weekly schedule in Basic mode; the live description is the one QQQ stores @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const dialog = await openScheduleForm(page)
  const editor = byId(page, 'cron-editor-scheduledReportCronWidget')
  const live = byId(page, 'cron-editor-description-scheduledReportCronWidget')
  await expect(editor.getByRole('button', { name: 'Basic' })).toHaveAttribute('aria-pressed', 'true')
  await expect(editor.getByRole('button', { name: /^Days/ })).toHaveText('Not set')
  await expectTouchReady(page, editor)

  await editor.getByRole('button', { name: /^Days/ }).click()
  const days = page.getByRole('dialog', { name: 'Days' })
  await days.getByRole('radio', { name: 'Selected Weekdays' }).check()
  await days.getByRole('checkbox', { name: 'Monday' }).check()
  await days.getByRole('checkbox', { name: 'Friday' }).check()
  await expectPopoverFits(page, days)
  await page.keyboard.press('Escape')
  await expect(days).toBeHidden()
  await expect(editor.getByRole('button', { name: /^Days/ })).toBeFocused()
  await expect(editor.getByRole('button', { name: /^Days/ })).toHaveText('Mon, Fri')

  // a new schedule starts at midnight, as in Material
  await editor.getByRole('button', { name: /^Hours/ }).click()
  const hours = page.getByRole('dialog', { name: 'Hours' })
  await expect(hours.getByRole('checkbox', { name: '12am' })).toBeChecked()
  await hours.getByRole('checkbox', { name: '9am' }).check()
  await hours.getByRole('checkbox', { name: '12am' }).uncheck()
  await expectPopoverFits(page, hours)
  await page.keyboard.press('Escape')
  await editor.getByRole('button', { name: /^Minutes/ }).click()
  const minutes = page.getByRole('dialog', { name: 'Minutes' })
  await minutes.getByRole('checkbox', { name: '30' }).check()
  await minutes.getByRole('checkbox', { name: '00' }).uncheck()
  await expectPopoverFits(page, minutes)
  await page.keyboard.press('Escape')
  await expect(editor.getByRole('button', { name: /^Hours/ })).toHaveText('9am')
  await expect(editor.getByRole('button', { name: /^Minutes/ })).toHaveText('30')
  await expect(live).toHaveText('Every week, on Monday and Friday, at 9:30 am')

  await editor.getByRole('button', { name: 'Advanced' }).click()
  await expect(editor.getByLabel(/^Cron Expression/)).toHaveValue('0 30 9 ? * MON,FRI')
  await dialog.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(/\/app\/savedReport\/1\/?$/)
  // scheduled reports live in the sample memory backend (no SQL table): read them back over the API
  const records = (await (await backend.api.get('/data/scheduledReport')).json()).records as Array<{ values: { id: number } }>
  expect(records).toHaveLength(1)
  const id = records[0].values.id
  const saved = await (await backend.api.get(`/data/scheduledReport/${id}`)).json()
  expect(saved.values).toMatchObject({ cronExpression: '0 30 9 ? * MON,FRI', cronDescription: 'Every week, on Monday and Friday, at 9:30 am', cronTimeZoneId: 'UTC' })
  await openRecord(page, `/app/scheduledReport/${id}`)
  await expectLoaded(page, 'scheduledReportCronWidget')
  await expect(byId(page, 'cron-description-scheduledReportCronWidget')).toHaveText('Every week, on Monday and Friday, at 9:30 am')
})

test('[WID-064] a schedule is required: saving without one shows the error in the editor and nothing is saved @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const dialog = await openScheduleForm(page)
  await dialog.getByRole('button', { name: 'Create', exact: true }).click()
  const editor = byId(page, 'cron-editor-scheduledReportCronWidget')
  await expect(editor.getByRole('alert')).toHaveText('Cron Expression is required')
  await expect(editor.getByRole('button', { name: /^Days/ })).toBeFocused()
  // the create form stays open over the saved report
  await expect(dialog).toBeVisible()
  await expect(page).toHaveURL(/\/app\/savedReport\/1\/?#\/createChild=scheduledReport\//)
  expect((await (await backend.api.get('/data/scheduledReport')).json()).records ?? []).toEqual([])
})

test('[RPT-019] the render report input step shows only its fields, without a stray no-fields message @mobile', async ({ page, diagnostics }) => {
  void diagnostics
  await openRecord(page, '/app/savedReport/1')
  await recordAction(page, 'Render Report')
  await expect(page).toHaveURL(/\/app\/renderSavedReport/)
  await expect(page.getByLabel(/^Report Format/)).toBeVisible()
  await expect(page.getByLabel(/^Email To/)).toBeVisible()
  await expect(page.getByLabel(/^Email Subject/)).toBeVisible()
  // the report has no variables: its values widget loads and renders nothing
  const values = page.locator('[data-qqq-id="process-widget-renderReportProcessValuesWidget"]')
  await expect(values).toHaveCount(1)
  await expect(values).toHaveText('')
  await expect(page.getByText('No fields', { exact: true })).toHaveCount(0)
  await expectTouchReady(page, page.locator('[data-qqq-id="process-run-renderSavedReport"]'))
})

test('[RPT-012] a scheduled report is created for a saved report and shows its schedule @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const dialog = await fillSchedule(page, '0 0 9 * * ?')
  // the dialog closes over the saved report, the link's hash is cleared and the child list reloads
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(/\/app\/savedReport\/1\/?$/)
  // scheduled reports live in the sample memory backend (no SQL table): read them back over the API
  const records = (await (await backend.api.get('/data/scheduledReport')).json()).records as Array<{ values: { id: number } }>
  expect(records).toHaveLength(1)
  const id = records[0].values.id
  const saved = await (await backend.api.get(`/data/scheduledReport/${id}`)).json()
  expect(saved.values).toMatchObject({ savedReportId: 1, isActive: true, toAddresses: 'owned-schedule@example.com', subject: 'Owned schedule',
    cronExpression: '0 0 9 * * ?', cronDescription: 'Every day, at 9:00 am', cronTimeZoneId: 'UTC' })
  await expect(byId(page, `child-record-row-scheduledReportJoinSavedReport-${id}`)).toBeVisible()
  await openRecord(page, `/app/scheduledReport/${id}`)
  await expectLoaded(page, 'scheduledReportCronWidget')
  await expect(byId(page, 'cron-expression-scheduledReportCronWidget')).toHaveText('0 0 9 * * ?')
  await expect(byId(page, 'cron-description-scheduledReportCronWidget')).toHaveText('Every day, at 9:00 am')
  await openRecord(page, '/app/savedReport/1')
  await expectLoaded(page, 'scheduledReportJoinSavedReport')
  await expect(byId(page, `child-record-row-scheduledReportJoinSavedReport-${id}`)).toBeVisible()
})

test('[RPT-012] an invalid cron expression is rejected with the backend message and nothing is saved @mobile', async ({ page, backend, diagnostics }) => {
  diagnostics.allow('/qqq/v1/table/scheduledReport 400')
  diagnostics.allow('Failed to load resource: the server responded with a status of 400')
  const dialog = await fillSchedule(page, 'not a cron')
  await expect(page.getByRole('alert').filter({ hasText: /Cron Expression \[not a cron\] is not valid/ }).first()).toBeVisible()
  // the form stays open over the saved report with the entered values
  await expect(dialog.getByLabel(/^Cron Expression/)).toHaveValue('not a cron')
  await expect(page).toHaveURL(/\/app\/savedReport\/1\/?#\/createChild=scheduledReport\//)
  expect((await (await backend.api.get('/data/scheduledReport')).json()).records ?? []).toEqual([])
})

test('[RPT-013] the owner shares a saved report read-only with a user @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const dialog = await openShare(page, '/app/savedReport/1')
  await expect(dialog.getByRole('heading', { name: 'Share Report: Pet Species Report' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Current Shares (0)' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Share' })).toBeDisabled()
  await dialog.getByRole('combobox', { name: 'User or Group' }).click()
  const audienceOptions = dialog.getByRole('listbox', { name: 'User or Group options' })
  await expect(audienceOptions.getByRole('option')).toHaveText(['Alice', 'Bob', 'Casey'])
  await audienceOptions.getByRole('option', { name: 'Bob' }).click()
  await expect(dialog.getByLabel('Scope', { exact: true })).toHaveValue('READ_ONLY')
  await dialog.getByRole('button', { name: 'Share' }).click()
  await expect(dialog.getByRole('heading', { name: 'Current Shares (1)' })).toBeVisible()
  await expect(dialog.getByRole('list')).toContainText('Bob')
  // the whole recipient id is stored (it contains a colon; see #444)
  expect(await sqlRows(backend, 'select saved_report_id, user_id, scope from shared_saved_report where saved_report_id = 1')).toEqual([{ saved_report_id: '1', user_id: 'sample:bob', scope: 'READ_ONLY' }])
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(dialog).toBeHidden()
})

test('[RPT-014] the owner changes a share to read and edit @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  expect((await shareViaApi(backend, 'insertSharedRecord', { tableName: 'savedReport', recordId: 1, audienceType: 'user', audienceId: 'sample:bob', scopeId: 'READ_ONLY' })).status).toBe(200)
  const [share] = await sqlRows(backend, "select id from shared_saved_report where saved_report_id = 1 and user_id = 'sample:bob'")
  const dialog = await openShare(page, '/app/savedReport/1')
  await dialog.getByLabel('Scope for Bob').selectOption('READ_WRITE')
  await expect.poll(async () => (await sqlRows(backend, `select scope from shared_saved_report where id = ${share.id}`))[0].scope).toBe('READ_WRITE')
  await expect(dialog.getByLabel('Scope for Bob')).toHaveValue('READ_WRITE')
})

test('[RPT-015] the owner removes a share @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await shareViaApi(backend, 'insertSharedRecord', { tableName: 'savedReport', recordId: 1, audienceType: 'user', audienceId: 'sample:casey', scopeId: 'READ_ONLY' })
  const dialog = await openShare(page, '/app/savedReport/1')
  await expect(dialog.getByRole('heading', { name: 'Current Shares (1)' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Remove share with Casey' }).click()
  await expect(dialog.getByRole('heading', { name: 'Current Shares (0)' })).toBeVisible()
  await expect(dialog.getByText('This record is not shared.')).toBeVisible()
  expect(await sqlRows(backend, 'select id from shared_saved_report where saved_report_id = 1')).toEqual([])
})

test('[RPT-018] a saved view is shared through the same dialog @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  // other areas may seed shares on the same stock view (the query fixture shares it with bob)
  const sharesSql = 'select saved_view_id, user_id, scope from shared_saved_view order by id'
  const before = await sqlRows(backend, sharesSql)
  expect(before.map((row) => row.user_id)).not.toContain('sample:casey')
  const dialog = await openShare(page, '/app/savedView/1')
  await expect(dialog.getByRole('heading', { name: /^Share View: / })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: `Current Shares (${before.filter((row) => row.saved_view_id === '1').length})` })).toBeVisible()
  await dialog.getByRole('combobox', { name: 'User or Group' }).click()
  await dialog.getByRole('listbox', { name: 'User or Group options' }).getByRole('option', { name: 'Casey' }).click()
  await dialog.getByLabel('Scope', { exact: true }).selectOption('READ_WRITE')
  await dialog.getByRole('button', { name: 'Share', exact: true }).click()
  await expect(dialog.getByRole('list')).toContainText('Casey')
  expect(await sqlRows(backend, sharesSql)).toEqual([...before, { saved_view_id: '1', user_id: 'sample:casey', scope: 'READ_WRITE' }])
})

test('[RPT-017] only the owner may share: the button is disabled for others and the server refuses @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  // alice can read casey's report through its read-only share, but does not own it
  await open(page, '/app/savedReport/101')
  await expect(page.getByRole('heading', { level: 1, name: 'Casey Shared People Report' })).toBeVisible()
  const share = page.getByRole('button', { name: 'Share', exact: true })
  await expect(share).toBeDisabled()
  await expect(share).toHaveAccessibleDescription('Only the owner of a Report may share it.')
  const refused = await shareViaApi(backend, 'insertSharedRecord', { tableName: 'savedReport', recordId: 101, audienceType: 'user', audienceId: 'sample:bob', scopeId: 'READ_ONLY' })
  expect(refused.body.type).toBe('ERROR')
  expect(refused.body.error).toContain('You are not the owner of this record')
  expect(await sqlRows(backend, "select user_id from shared_saved_report where saved_report_id = 101 order by user_id")).toEqual([{ user_id: 'sample:alice' }])
  // alice's own report is shareable
  await page.waitForLoadState('networkidle')
  await open(page, '/app/savedReport/1')
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeEnabled()
})

test.describe('as another user', () => {
  test.use({ user: 'bob' })

  test('[RPT-016] an unshared report is invisible to another user until it is shared @mobile', async ({ page, backend, diagnostics }) => {
    diagnostics.allow('/qqq/v1/table/savedReport/1 404')
    diagnostics.allow('/qqq/v1/table/savedReport/1 404')
    diagnostics.allow('Failed to load resource: the server responded with a status of 404')
    const [report] = await sqlRows(backend, "select label from saved_report where id = 1 and user_id = 'sample:alice'")
    expect((await backend.api.get('/data/savedReport/1')).status()).toBe(404)
    await open(page, '/app/savedReport')
    // bob owns no reports and nothing is shared with him yet
    await expect(page.getByRole('heading', { name: 'No records found' })).toBeVisible()
    await expect(page.getByText(report.label, { exact: true })).toHaveCount(0)
    // alice shares it with bob
    await backend.setPersona('admin', 'alice')
    expect((await shareViaApi(backend, 'insertSharedRecord', { tableName: 'savedReport', recordId: 1, audienceType: 'user', audienceId: 'sample:bob', scopeId: 'READ_ONLY' })).status).toBe(200)
    await backend.setPersona('admin', 'bob')
    expect((await backend.api.get('/data/savedReport/1')).status()).toBe(200)
    await page.reload()
    await expect(listCell(page, 'Report', report.label)).toBeVisible()
    await open(page, '/app/savedReport/1')
    await expect(page.getByRole('heading', { level: 1, name: report.label })).toBeVisible()
    expect(await sqlRows(backend, "select user_id from shared_saved_report where saved_report_id = 1")).toEqual([{ user_id: 'sample:bob' }])
  })
})
