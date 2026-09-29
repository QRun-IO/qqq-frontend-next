/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, open, test } from '../../support/fixtures'
import { byId } from './widget-support'

test('[WID-073] count-only report preview never queries rows, including refresh @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  expect((await backend.api.put('/data/savedReport/1', { multipart: {
    tableName: 'qryItem', queryFilterJson: JSON.stringify({ orderBys: [{ fieldName: 'id', isAscending: true }] }),
    columnsJson: JSON.stringify({ columns: [{ name: 'id', isVisible: true }, { name: 'name', isVisible: true }] }),
  } })).status()).toBe(200)
  const before = await backend.sql('select query_filter_json, columns_json from saved_report where id = 1')
  const rows = await backend.sql('select count(*) as n from qry_item')
  await page.route(/\/qqq\/v1\/metaData\/table\/qryItem(?:\?|$)/, async route => {
    const response = await route.fetch()
    const payload = await response.json()
    expect(payload.capabilities).toContain('TABLE_QUERY')
    expect(payload.capabilities).toContain('TABLE_COUNT')
    payload.capabilities = payload.capabilities.filter((capability: string) => capability !== 'TABLE_QUERY')
    await route.fulfill({ response, json: payload })
  })
  const queries: string[] = []
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/qqq/v1/table/qryItem/query') queries.push(request.url())
  })
  await open(page, '/app/savedReport/1/edit')
  const count = page.waitForResponse(response => new URL(response.url()).pathname === '/qqq/v1/table/qryItem/count')
  await page.getByRole('button', { name: 'Edit Filters and Columns' }).click()
  expect((await (await count).json()).count).toBe(Number(rows[0].n))
  const preview = byId(page, 'filter-preview-reportSetupWidget')
  await expect(preview.getByRole('button', { name: 'Refresh preview' })).toBeEnabled()
  expect(queries).toEqual([])
  await expect(preview.getByRole('gridcell')).toHaveCount(0)
  const recount = page.waitForResponse(response => new URL(response.url()).pathname === '/qqq/v1/table/qryItem/count')
  await preview.getByRole('button', { name: 'Refresh preview' }).click()
  expect((await (await recount).json()).count).toBe(Number(rows[0].n))
  await expect(preview.getByRole('button', { name: 'Refresh preview' })).toBeEnabled()
  expect(queries).toEqual([])
  await page.getByRole('dialog', { name: 'Edit Filters and Columns' }).getByRole('button', { name: 'Cancel' }).click()
  expect(await backend.sql('select query_filter_json, columns_json from saved_report where id = 1')).toEqual(before)
})
