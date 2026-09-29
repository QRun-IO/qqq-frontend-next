/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, open, test } from '../../support/fixtures'
import { byId } from './widget-support'

for (const edit of [false, true]) {
  test(`[WID-073] ${edit ? 'editor' : 'read-only'} report filter indicators open nested criteria without changing the saved report @mobile`, async ({ page, backend, diagnostics }, testInfo) => {
    void diagnostics
    const queryFilterJson = JSON.stringify({ booleanOperator: 'AND', criteria: [],
      subFilters: [{ booleanOperator: 'AND', criteria: [{ fieldName: 'quantity', operator: 'GREATER_THAN', values: [5] }] }],
      orderBys: [{ fieldName: 'id', isAscending: true }],
    })
    const columnsJson = JSON.stringify({ columns: [{ name: 'id', isVisible: true, width: 180 }, { name: 'quantity', isVisible: true, width: 220 }] })
    expect((await backend.api.put('/data/savedReport/1', { multipart: { tableName: 'qryItem', queryFilterJson, columnsJson } })).status()).toBe(200)
    const before = await backend.sql('select query_filter_json, columns_json from saved_report where id = 1')
    await open(page, `/app/savedReport/1${edit ? '/edit' : ''}`)
    if (edit) {
      await page.getByRole('button', { name: 'Edit Filters and Columns' }).click()
      await page.getByRole('tab', { name: 'Columns', exact: true }).click()
    }
    const preview = byId(page, 'filter-preview-reportSetupWidget')
    await expect(preview.getByRole('button', { name: 'Id is filtered. Show the filter' })).toHaveCount(0)
    await preview.getByRole('button', { name: 'Quantity is filtered. Show the filter' }).click()
    const filterScope = edit ? page.getByRole('dialog', { name: 'Edit Filters and Columns' }) : preview
    if (edit) await expect(page.getByRole('tab', { name: 'Filters and sort' })).toHaveAttribute('aria-selected', 'true')
    await expect(filterScope.getByLabel('Filter field', { exact: true })).toHaveCount(1)
    await expect(filterScope.getByLabel('Filter value for Quantity')).toHaveValue('5')
    await filterScope.getByLabel('Filter value for Quantity').fill('10')
    const expected = await backend.sql('select quantity from qry_item where quantity > 10 order by id')
    expect(expected.length).toBeGreaterThan(0)
    await expect(preview.getByRole('gridcell').and(preview.locator('[data-qqq-id="grid-cell-quantity"]'))).toHaveText(expected.map(row => row.quantity!))
    await page.screenshot({ path: testInfo.outputPath('report-filter-indicator.png'), fullPage: true })
    if (edit) await filterScope.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect(await backend.sql('select query_filter_json, columns_json from saved_report where id = 1')).toEqual(before)
  })
}
