/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Table variants (qryStock on a memory backend keyed by qryStore) and table capabilities.
import { readFileSync } from 'node:fs'
import { expect, open, test } from '../../support/fixtures'
import { captureQueries, expectColumn, sqlColumn } from './query-helpers'

test('[QRY-060] a variant table asks for a variant, queries with it and remembers it', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const queries = captureQueries(page, 'qryStock')
  await open(page, '/app/qryStock')
  const picker = page.locator('[data-qqq-id="variant-picker-dialog"]')
  await expect(picker.getByRole('heading', { name: 'Store' })).toBeVisible()
  // Options come from the backend's variant options table
  await expect(picker.getByRole('option')).toHaveText(await sqlColumn(backend, 'select name from qry_store order by id'))
  // Nothing is queried before a variant is chosen
  expect(queries).toEqual([])
  await picker.getByRole('option', { name: 'South Store' }).click()
  await picker.getByRole('button', { name: 'Select' }).click()
  await expectColumn(page, 'sku', ['S-KIWI'])
  // v1 variant ids are strings (the v1 TableVariant contract)
  expect(queries.at(-1)?.tableVariant).toEqual({ id: '2', type: 'qryStore', name: 'South Store' })
  await expect(page.locator('[data-qqq-id="button-variant-picker"]')).toContainText('South Store')

  // Switch store: different data from the same table
  await page.locator('[data-qqq-id="button-variant-picker"]').click()
  await picker.getByLabel('Filter Store options').fill('north')
  await expect(picker.getByRole('option')).toHaveText(['North Store'])
  await picker.getByRole('option', { name: 'North Store' }).dblclick()
  await expectColumn(page, 'sku', ['N-PEAR', 'N-APPLE'])
  await expect(page.locator('[data-qqq-id="pagination"]')).toContainText('of 2')

  // Remembered per table across reloads
  await page.reload()
  await expectColumn(page, 'sku', ['N-PEAR', 'N-APPLE'])
  await expect(page.locator('[data-qqq-id="variant-picker-dialog"]')).toHaveCount(0)

  // Exports read the chosen variant too
  await page.getByRole('button', { name: 'Export records' }).click()
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /^Export CSV/ }).click()])
  const csv = readFileSync((await file.path())!, 'utf8')
  expect(csv).toContain('N-PEAR')
  expect(csv).toContain('N-APPLE')
  expect(csv).not.toContain('S-KIWI')

  // An empty variant shows the empty state
  await page.locator('[data-qqq-id="button-variant-picker"]').click()
  await picker.getByRole('option', { name: 'Empty Store' }).click()
  await picker.getByRole('button', { name: 'Select' }).click()
  await expect(page.getByText('No records found', { exact: true })).toBeVisible()
})

test('[QRY-061] dismissing the variant prompt queries nothing; the backend requires a variant', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const queries = captureQueries(page, 'qryStock')
  await open(page, '/app/qryStock')
  await page.locator('[data-qqq-id="variant-picker-dialog"]').getByRole('button', { name: 'Cancel' }).click()
  await expect(page.locator('[data-qqq-id="query-needs-variant"]')).toContainText('Select a Store to view Stock records.')
  expect(queries).toEqual([])
  const withoutVariant = await backend.api.post('/qqq/v1/table/qryStock/query', { data: { filter: {} } })
  expect(withoutVariant.ok()).toBe(false)
  expect(await withoutVariant.text()).toContain('Could not find Backend Variant information')
  await page.locator('[data-qqq-id="button-choose-variant"]').click()
  await page.locator('[data-qqq-id="variant-picker-dialog"]').getByRole('option', { name: 'North Store' }).dblclick()
  await expectColumn(page, 'sku', ['N-PEAR', 'N-APPLE'])
})

test('[QRY-062] a table without count, export or write capabilities offers none of them', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const counts = captureQueries(page, 'qryLedger', 'count')
  await open(page, '/app/qryLedger')
  await expectColumn(page, 'entry', await sqlColumn(backend, 'select entry from qry_ledger order by id desc'))
  await expect(page.locator('[data-qqq-id="pagination"]')).toContainText('Showing 1–3')
  await expect(page.locator('[data-qqq-id="pagination-total"]')).toHaveCount(0)
  expect(counts).toEqual([])
  await expect(page.getByRole('button', { name: /Create new/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /exports are not allowed/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Actions' })).toHaveCount(0)
  // Writes are refused by the backend too
  const insert = await backend.api.post('/data/qryLedger', { multipart: { entry: 'Sneaky' } })
  expect(insert.ok()).toBe(false)
  expect(await sqlColumn(backend, "select count(*) from qry_ledger where entry = 'Sneaky'")).toEqual(['0'])
})

test('[QRY-064] the backend refuses count and export for a table without those capabilities', async ({ backend, diagnostics }) => {
  void diagnostics
  const count = await backend.api.post('/qqq/v1/table/qryLedger/count', { data: { filter: {} } })
  expect(count.status()).toBe(403)
  const legacyCount = await backend.api.get('/data/qryLedger/count')
  expect(legacyCount.status()).toBe(403)
  const exported = await backend.api.post('/data/qryLedger/export/ledger.csv', { form: { fields: 'id,entry', filter: '{}' } })
  expect(exported.status()).toBe(403)
  expect(await exported.text()).not.toContain('Opening balance')
  // Queries still work
  const query = await backend.api.post('/qqq/v1/table/qryLedger/query', { data: { filter: {} } })
  expect(query.status()).toBe(200)
})

test('[QRY-063] the enum-backed Pet Species table is read-only', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/petSpecies')
  await expectColumn(page, 'possibleValueLabel', ['Cat', 'Dog'])
  await expect(page.getByRole('button', { name: /Create new/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Actions' })).toHaveCount(0)
  const insert = await backend.api.post('/data/petSpecies', { multipart: { possibleValueLabel: 'Bird' } })
  expect(insert.ok()).toBe(false)
})

test('[QRY-071] a process launched from a variant table runs with the chosen variant on init and every step', async ({ page, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryStock')
  const picker = page.locator('[data-qqq-id="variant-picker-dialog"]')
  await picker.getByRole('option', { name: 'South Store' }).click()
  await picker.getByRole('button', { name: 'Select' }).click()
  await expectColumn(page, 'sku', ['S-KIWI'])

  const processRequests: { path: string; body: string }[] = []
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (request.method() === 'POST' && path.startsWith('/qqq/v1/processes/qryStock.bulkDelete/')) processRequests.push({ path, body: request.postData() ?? '' })
  })
  const variantOf = (body: string) => body.match(/name="tableVariant"\r\n\r\n([^\r]*)/)?.[1]

  await page.getByRole('button', { name: 'Selection', exact: true }).click()
  await page.getByRole('menuitem', { name: /^Full query result/ }).click()
  // the review preview reads the run's records, which also needs the variant
  const previewRecords = page.waitForResponse((response) => new URL(response.url()).pathname.startsWith('/qqq/v1/processes/qryStock.bulkDelete/')
    && new URL(response.url()).pathname.endsWith('/records'))
  await page.getByRole('button', { name: 'Actions' }).click()
  await page.getByRole('menuitem', { name: 'Bulk Delete' }).click()
  // the backend counted the South store's one record, which it can only do with the variant
  await expect(page.locator('[data-qqq-id="process-validation-input"]')).toHaveText('Input: 1 Stock record.')
  const records = await previewRecords
  expect(records.status()).toBe(200)
  expect(new URL(records.url()).searchParams.get('tableVariant')).toBe(JSON.stringify({ type: 'qryStore', id: 2 }))
  await page.getByRole('radio', { name: /^Skip Validation/ }).check()
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByRole('button', { name: 'Return' })).toBeVisible()

  const initAndSteps = processRequests.filter((request) => request.path.endsWith('/init') || request.path.includes('/step/'))
  expect(initAndSteps.length).toBeGreaterThanOrEqual(2)
  for (const request of initAndSteps) {
    expect(JSON.parse(variantOf(request.body) ?? 'null'), request.path).toEqual({ type: 'qryStore', id: 2 })
  }

  // Return lands back on the variant query, which now has no South rows; North is untouched
  await page.getByRole('button', { name: 'Return' }).click()
  await expect(page).toHaveURL(/\/app\/qryStock\/?(\?.*)?$/)
  await expect(page.getByText('No records found', { exact: true })).toBeVisible()
  await page.locator('[data-qqq-id="button-variant-picker"]').click()
  await picker.getByRole('option', { name: 'North Store' }).click()
  await picker.getByRole('button', { name: 'Select' }).click()
  await expectColumn(page, 'sku', ['N-PEAR', 'N-APPLE'])
})
