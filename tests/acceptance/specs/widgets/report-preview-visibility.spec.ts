/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, open, test } from '../../support/fixtures'
import { byId, expectLoaded } from './widget-support'

for (const hidePreview of [true, false]) {
  test(`[WID-073] report editor retains its query when the summary preview is ${hidePreview ? 'hidden' : 'shown'}`, async ({ page, backend, diagnostics }) => {
    void diagnostics
    expect((await backend.api.put('/data/savedReport/1', { multipart: {
      tableName: 'person',
      queryFilterJson: JSON.stringify({ orderBys: [{ fieldName: 'id', isAscending: true }] }),
      columnsJson: JSON.stringify({ columns: ['id', 'firstName'].map(name => ({ name, isVisible: true })) }),
    } })).status()).toBe(200)
    const before = await backend.sql('select query_filter_json, columns_json from saved_report where id = 1')
    const people = await backend.sql('select first_name from person order by id')
    // Only configuration is overridden; metadata, query/count and persistence use the real backend.
    await page.route('**/qqq/v1/widget/reportSetupWidget*', async route => {
      const response = await route.fetch()
      await route.fulfill({ response, json: { ...await response.json(), hidePreview } })
    })
    await open(page, '/app/savedReport/1')
    await expectLoaded(page, 'reportSetupWidget')
    const preview = byId(page, 'filter-preview-reportSetupWidget')
    const cells = preview.getByRole('gridcell').and(preview.locator('[data-qqq-id="grid-cell-firstName"]'))
    if (hidePreview) await expect(preview).toHaveCount(0)
    else await expect(cells).toHaveText(people.map(row => row.first_name!))

    await open(page, '/app/savedReport/1/edit')
    await page.getByRole('button', { name: 'Edit Filters and Columns', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Edit Filters and Columns' })
    await expect(cells).toHaveText(people.map(row => row.first_name!))
    await dialog.getByLabel('Ascending', { exact: true }).uncheck()
    await expect(cells).toHaveText(people.map(row => row.first_name!).reverse())
    const refresh = page.waitForResponse(response => new URL(response.url()).pathname === '/qqq/v1/table/person/query')
    await preview.getByRole('button', { name: 'Refresh preview' }).click()
    expect((await refresh).status()).toBe(200)
    await expect(cells).toHaveText(people.map(row => row.first_name!).reverse())
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect(await backend.sql('select query_filter_json, columns_json from saved_report where id = 1')).toEqual(before)

    await page.getByRole('button', { name: 'Edit Filters and Columns', exact: true }).click()
    await expect(cells).toHaveText(people.map(row => row.first_name!))
    await dialog.getByLabel('Ascending', { exact: true }).uncheck()
    await expect(cells).toHaveText(people.map(row => row.first_name!).reverse())
    await dialog.getByRole('button', { name: 'OK', exact: true }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page).toHaveURL(/\/app\/savedReport\/1\/?$/)
    const saved = await backend.sql('select query_filter_json from saved_report where id = 1')
    expect(JSON.parse(saved[0].query_filter_json!).orderBys).toEqual([{ fieldName: 'id', isAscending: false }])
    await expectLoaded(page, 'reportSetupWidget')
    if (hidePreview) await expect(preview).toHaveCount(0)
    else await expect(cells).toHaveText(people.map(row => row.first_name!).reverse())
    await open(page, '/app/savedReport/1/edit')
    await page.getByRole('button', { name: 'Edit Filters and Columns', exact: true }).click()
    await expect(cells).toHaveText(people.map(row => row.first_name!).reverse())
    await expect(dialog.getByLabel('Ascending', { exact: true })).not.toBeChecked()
  })
}
