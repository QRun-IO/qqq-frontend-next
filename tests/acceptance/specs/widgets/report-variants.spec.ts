/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, open, test } from '../../support/fixtures'
import { byId } from './widget-support'

for (const versioned of [false, true]) {
  test(`[WID-073] report previews choose and remember backend variants (${versioned ? 'application API' : 'plain'}) @mobile`, async ({ page, backend, diagnostics }) => {
    void diagnostics
    expect((await backend.api.put('/data/savedReport/1', { multipart: {
      tableName: 'qryStock', queryFilterJson: JSON.stringify({ criteria: [], orderBys: [{ fieldName: 'id', isAscending: true }] }),
      columnsJson: JSON.stringify({ columns: [{ name: 'id', isVisible: true }, { name: 'sku', isVisible: true }, { name: 'quantity', isVisible: true }] }),
    } })).status()).toBe(200)
    const before = await backend.sql('select query_filter_json, columns_json from saved_report where id = 1')
    if (versioned) await page.route('**/qqq/v1/widget/reportSetupWidget*', async route => {
      const response = await route.fetch()
      await route.fulfill({ response, json: { ...await response.json(), isApiVersioned: true,
        apiName: 'acceptanceApi', apiPath: 'acceptance-api', apiVersion: '2026.Q3' } })
    })
    const prefix = versioned ? '/qqq/v1/acceptance-api/2026.Q3' : '/qqq/v1'
    const requests: { kind: string; body: { tableVariant?: { id: string; type: string }; filter: { skip: number } } }[] = []
    page.on('request', request => {
      const path = new URL(request.url()).pathname
      if (request.method() === 'POST' && path.startsWith(`${prefix}/table/qryStock/`)) requests.push({ kind: path.split('/').slice(-1)[0], body: request.postDataJSON() })
    })
    await open(page, '/app/savedReport/1/edit')
    await page.getByRole('button', { name: 'Edit Filters and Columns' }).click()
    const picker = byId(page, 'variant-picker-dialog')
    await expect(picker.getByRole('heading', { name: 'Store' })).toBeVisible()
    expect(requests).toEqual([])
    await picker.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(byId(page, 'filter-preview-needs-variant-reportSetupWidget')).toContainText('Select a Store')
    expect(requests).toEqual([])
    await byId(page, 'filter-preview-variant-reportSetupWidget').click()
    await picker.getByRole('option', { name: 'South Store' }).click()
    await picker.getByRole('button', { name: 'Select', exact: true }).click()
    const preview = byId(page, 'filter-preview-reportSetupWidget')
    await expect(preview.getByRole('gridcell').and(preview.locator('[data-qqq-id="grid-cell-sku"]'))).toHaveText(['S-KIWI'])
    await expect(preview.locator('[data-qqq-id="pagination-total"]')).toContainText('1')
    expect(requests.filter(r => r.kind === 'query' || r.kind === 'count').every(r => r.body.tableVariant?.id === '2' && r.body.tableVariant.type === 'qryStore')).toBe(true)
    await preview.getByRole('button', { name: 'Quantity column menu' }).press('Enter')
    await page.getByRole('menuitem', { name: 'Column statistics' }).click()
    const stats = page.getByRole('dialog', { name: 'Column Statistics for Quantity' })
    await expect(stats.locator('[data-qqq-id="column-stats-stat-min"]')).toHaveText('13')
    await expect(stats.locator('[data-qqq-id="column-stats-stat-max"]')).toHaveText('13')
    await stats.getByRole('button', { name: 'Close', exact: true }).click()
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async (text: string) => { document.documentElement.dataset.copiedReportValues = text },
    } }))
    await preview.getByRole('button', { name: 'SKU column menu' }).press('Enter')
    await page.getByRole('menuitem', { name: 'Copy full query values' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-copied-report-values', 'S-KIWI\n')
    expect(requests[requests.length - 1]?.body.tableVariant).toMatchObject({ id: '2', type: 'qryStore' })
    await byId(page, 'filter-preview-variant-reportSetupWidget').click()
    await picker.getByRole('option', { name: 'North Store' }).click()
    await picker.getByRole('button', { name: 'Select', exact: true }).click()
    await expect(preview.getByRole('gridcell').and(preview.locator('[data-qqq-id="grid-cell-sku"]'))).toHaveText(['N-APPLE', 'N-PEAR'])
    await expect(preview.locator('[data-qqq-id="pagination-total"]')).toContainText('2')
    expect(requests[requests.length - 1]?.body.tableVariant).toMatchObject({ id: '1', type: 'qryStore' })
    expect(requests.filter(r => r.kind === 'query').slice(-1)[0]?.body.filter.skip).toBe(0)
    await preview.getByRole('button', { name: 'Quantity column menu' }).press('Enter')
    await page.getByRole('menuitem', { name: 'Column statistics' }).click()
    await expect(stats.locator('[data-qqq-id="column-stats-stat-min"]')).toHaveText('5')
    await expect(stats.locator('[data-qqq-id="column-stats-stat-max"]')).toHaveText('8')
    await stats.getByRole('button', { name: 'Close', exact: true }).click()

    await page.getByRole('dialog', { name: 'Edit Filters and Columns' }).getByRole('button', { name: 'Cancel', exact: true }).click()
    expect(await backend.sql('select query_filter_json, columns_json from saved_report where id = 1')).toEqual(before)
    await open(page, '/app/savedReport/1')
    await expect(preview.getByRole('gridcell').and(preview.locator('[data-qqq-id="grid-cell-sku"]'))).toHaveText(['N-APPLE', 'N-PEAR'])
    await expect(picker).toHaveCount(0)
    await byId(page, 'filter-preview-variant-reportSetupWidget').click()
    await picker.getByRole('option', { name: 'Empty Store' }).click()
    await picker.getByRole('button', { name: 'Select', exact: true }).click()
    await expect(preview.getByText('No records found', { exact: true })).toBeVisible()
    await page.reload()
    await expect(preview.getByText('No records found', { exact: true })).toBeVisible()
    await expect(picker).toHaveCount(0)
    expect(await backend.sql('select query_filter_json, columns_json from saved_report where id = 1')).toEqual(before)
  })
}

test('[WID-073] switching report variants discards an unfinished copy from the previous store @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  expect((await backend.api.put('/data/savedReport/1', { multipart: {
    tableName: 'qryStock', queryFilterJson: JSON.stringify({ orderBys: [{ fieldName: 'id', isAscending: true }] }),
    columnsJson: JSON.stringify({ columns: [{ name: 'id', isVisible: true }, { name: 'sku', isVisible: true }] }),
  } })).status()).toBe(200)
  await page.addInitScript(() => localStorage.setItem('qqq.tableVariant.qryStock', JSON.stringify({ type: 'qryStore', id: '2', name: 'South Store' })))
  await open(page, '/app/savedReport/1')
  const preview = byId(page, 'filter-preview-reportSetupWidget')
  await expect(preview.getByRole('gridcell').and(preview.locator('[data-qqq-id="grid-cell-sku"]'))).toHaveText(['S-KIWI'])
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    writeText: async (text: string) => { document.documentElement.dataset.copiedReportValues = text },
  } }))
  let releaseSouth: (() => void) | undefined
  const pending = new Promise<void>(resolve => { releaseSouth = resolve })
  let southCopyStarted = false
  await page.route('**/qqq/v1/table/qryStock/query', async route => {
    const body = route.request().postDataJSON()
    if (body.tableVariant?.id === '2' && body.filter.limit === 250) {
      const response = await route.fetch()
      southCopyStarted = true
      await pending
      await route.fulfill({ response })
    } else await route.continue()
  })
  try {
    await preview.getByRole('button', { name: 'SKU column menu' }).press('Enter')
    await page.getByRole('menuitem', { name: 'Copy full query values' }).click()
    await expect.poll(() => southCopyStarted).toBe(true)
    await byId(page, 'filter-preview-variant-reportSetupWidget').click()
    const picker = byId(page, 'variant-picker-dialog')
    await picker.getByRole('option', { name: 'North Store' }).click()
    await picker.getByRole('button', { name: 'Select', exact: true }).click()
    await expect(preview.getByRole('gridcell').and(preview.locator('[data-qqq-id="grid-cell-sku"]'))).toHaveText(['N-APPLE', 'N-PEAR'])
    await preview.getByRole('button', { name: 'SKU column menu' }).press('Enter')
    await page.getByRole('menuitem', { name: 'Copy full query values' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-copied-report-values', 'N-APPLE\nN-PEAR\n')
    const oldResponse = page.waitForResponse(response => response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/qqq/v1/table/qryStock/query' && response.request().postDataJSON().tableVariant?.id === '2')
    releaseSouth!()
    await (await oldResponse).finished()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('html')).toHaveAttribute('data-copied-report-values', 'N-APPLE\nN-PEAR\n')
  } finally { releaseSouth!() }
})
