/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Record selection (page, all matching, first N) and launching processes with it.
import type { Page, Response } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { expectColumn, sqlColumn } from './query-helpers'

/** Waits for a process init on the registered process route and returns its multipart fields and JSON response. */
async function processInit(page: Page, processName: string, launch: () => Promise<void>) {
  const [response] = await Promise.all([
    page.waitForResponse((r: Response) => r.request().method() === 'POST' && new URL(r.url()).pathname === `/processes/${processName}/init`),
    launch(),
  ])
  const body = response.request().postData() ?? ''
  const field = (name: string) => body.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`))?.[1]
  return { status: response.status(), json: await response.json() as { values?: Record<string, unknown>; nextStep?: string }, field }
}

test('[QRY-030] the selection menu selects the page, the full query result or the first N', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  const ids = await sqlColumn(backend, 'select id from qry_item order by id desc')
  await expectColumn(page, 'id', ids)
  const banner = page.locator('[data-qqq-id="bulk-selection-text"]')
  const checkboxes = page.locator('[data-qqq-id^="grid-select-row-"]')

  await page.getByRole('button', { name: 'Selection', exact: true }).click()
  await page.getByRole('menuitem', { name: `This page (${ids.length} records)` }).click()
  await expect(banner).toHaveText(`The ${ids.length} records on this page are selected.`)
  for (const box of await checkboxes.all()) await expect(box).toBeChecked()
  await page.getByRole('button', { name: 'Clear selection' }).click()
  await expect(banner).toHaveCount(0)

  await checkboxes.nth(0).check()
  await checkboxes.nth(2).check()
  await expect(banner).toHaveText('2 records are selected.')
  await page.locator('[data-qqq-id="grid-select-all"]').check()
  await expect(banner).toHaveText(`The ${ids.length} records on this page are selected.`)
  await page.locator('[data-qqq-id="grid-select-all"]').uncheck()
  await expect(banner).toHaveCount(0)

  await page.getByRole('button', { name: 'Selection', exact: true }).click()
  await page.getByRole('menuitem', { name: `Full query result (${ids.length} records)` }).click()
  await expect(banner).toHaveText(`All ${ids.length} records matching this query are selected.`)
  for (const box of await checkboxes.all()) await expect(box).toBeChecked()

  await page.getByRole('button', { name: 'Selection', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Subset of the query result...' }).click()
  const dialog = page.getByRole('dialog', { name: 'Subset of the Query Result' })
  const size = dialog.getByLabel('How many records do you want to select?')
  await size.fill('0')
  await expect(dialog.getByRole('alert')).toHaveText('Enter a whole number of at least 1.')
  await expect(dialog.getByRole('button', { name: 'OK' })).toBeDisabled()
  await size.fill('3')
  await dialog.getByRole('button', { name: 'OK' }).click()
  await expect(banner).toHaveText('The first 3 records matching this query are selected.')
  await expect(checkboxes.nth(2)).toBeChecked()
  await expect(checkboxes.nth(3)).not.toBeChecked()
  // Unchecking a row turns a query selection into the checked rows
  await checkboxes.nth(0).uncheck()
  await expect(banner).toHaveText('2 records are selected.')
})

test('[QRY-031] Bulk Edit launches with the checked record ids', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  const ids = await sqlColumn(backend, 'select id from qry_item order by id desc')
  await expectColumn(page, 'id', ids)
  // Without a selection, Bulk Edit explains why nothing happens (Material)
  await page.getByRole('button', { name: 'Actions' }).click()
  await page.getByRole('menuitem', { name: 'Bulk Edit', exact: true }).click()
  await expect(page.locator('[data-qqq-id="query-alert"]')).toHaveText('No records were selected to Bulk Edit.')
  await expect(page).toHaveURL(/\/app\/qryItem\/?$/)

  await page.locator('[data-qqq-id="grid-select-row-0"]').check()
  await page.locator('[data-qqq-id="grid-select-row-1"]').check()
  const init = await processInit(page, 'qryItem.bulkEdit', async () => {
    await page.getByRole('button', { name: 'Actions' }).click()
    await page.getByRole('menuitem', { name: 'Bulk Edit', exact: true }).click()
  })
  await expect(page).toHaveURL(/\/app\/qryItem\.bulkEdit\/?\?recordsParam=recordIds&recordIds=/)
  expect(init.status).toBe(200)
  expect(init.field('recordsParam')).toBe('recordIds')
  expect(init.field('recordIds')?.split(',').sort()).toEqual([ids[0], ids[1]].sort())
  const sent = JSON.parse(String(init.json.values?.queryFilterJson)).criteria[0]
  expect(sent).toMatchObject({ fieldName: 'id', operator: 'IN' })
  expect(sent.values.map(String).sort()).toEqual([ids[0], ids[1]].sort())
})

test('[QRY-032] Bulk Delete of the full query result sends the whole filter, not the current page', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/carrier?pageSize=10&page=2')
  const total = Number((await backend.sql('select count(*) as n from carrier'))[0].n)
  await expectColumn(page, 'id', (await sqlColumn(backend, 'select id from carrier order by id desc')).slice(10))
  await page.getByRole('button', { name: 'Selection', exact: true }).click()
  await page.getByRole('menuitem', { name: `Full query result (${total} records)` }).click()
  const init = await processInit(page, 'carrier.bulkDelete', async () => {
    await page.locator('[data-qqq-id="bulk-delete"]').click()
  })
  expect(init.status).toBe(200)
  expect(init.field('recordsParam')).toBe('filterJSON')
  const sent = JSON.parse(init.field('filterJSON') ?? '{}')
  expect(sent.skip).toBe(0)
  expect(sent.limit).toBeUndefined()
  // The backend counts every matching carrier (the page-2 bug would count only the page)
  expect(init.json.values?.recordCount).toBe(total)
  // Nothing was deleted by launching
  expect(Number((await backend.sql('select count(*) as n from carrier'))[0].n)).toBe(total)
})

test('[QRY-033] a first-N selection under a filter launches with that limit', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, `/app/carrier?filter=${encodeURIComponent(JSON.stringify({ criteria: [{ fieldName: 'company_code', operator: 'EQUALS', values: ['UPS'] }] }))}`)
  const ups = await sqlColumn(backend, "select id from carrier where company_code = 'UPS' order by id desc")
  await expectColumn(page, 'id', ups)
  await page.getByRole('button', { name: 'Selection', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Subset of the query result...' }).click()
  await page.getByLabel('How many records do you want to select?').fill('2')
  await page.getByRole('button', { name: 'OK' }).click()
  const init = await processInit(page, 'carrier.bulkDelete', async () => {
    await page.getByRole('button', { name: 'Actions' }).click()
    await page.getByRole('menuitem', { name: 'Bulk Delete' }).click()
  })
  const sent = JSON.parse(init.field('filterJSON') ?? '{}')
  expect(sent).toMatchObject({ skip: 0, limit: 2, criteria: [{ fieldName: 'company_code', operator: 'EQUALS', values: ['UPS'] }], orderBys: [{ fieldName: 'id', isAscending: false }] })
  expect(init.json.values?.recordCount).toBe(2)
})

test('[QRY-034] the Actions menu offers bulk load and table processes with the selection', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/person')
  const ids = await sqlColumn(backend, 'select id from person order by id desc')
  await expectColumn(page, 'id', ids)
  await page.getByRole('button', { name: 'Actions' }).click()
  const menu = page.getByRole('menu', { name: 'Actions' })
  await expect(menu.getByRole('menuitem')).toHaveText(['Bulk Load', 'Bulk Edit', 'Bulk Edit With File', 'Bulk Delete', 'Clone People', 'Greet Interactive'])
  await menu.getByRole('menuitem', { name: 'Bulk Load' }).click()
  // the run comes back to this query when it ends (Material closes its modal over the query)
  await expect(page).toHaveURL(/\/app\/person\.bulkInsert\/?\?returnTo=%2Fapp%2Fperson$/)
  await page.goBack()
  await expectColumn(page, 'id', ids)
  await page.locator('[data-qqq-id="grid-select-row-0"]').check()
  const init = await processInit(page, 'clonePeople', async () => {
    await page.getByRole('button', { name: 'Actions' }).click()
    await page.getByRole('menuitem', { name: 'Clone People' }).click()
  })
  expect(init.field('recordIds')).toBe(ids[0])
})

test.describe('as a viewer', () => {
  test.use({ persona: 'viewer' })

  test('[QRY-035] viewers get no create, bulk or process actions, and the backend refuses them', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await open(page, '/app/person')
    await expectColumn(page, 'id', await sqlColumn(backend, 'select id from person order by id desc'))
    await expect(page.getByRole('button', { name: /Create new/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Actions' })).toHaveCount(0)
    await page.locator('[data-qqq-id="grid-select-row-0"]').check()
    await expect(page.locator('[data-qqq-id="bulk-delete"]')).toHaveCount(0)
    const denied = await backend.api.post('/qqq/v1/processes/person.bulkDelete/init', { multipart: { recordsParam: 'recordIds', recordIds: '1' } })
    expect(denied.status()).toBe(403)
    expect(Number((await backend.sql('select count(*) as n from person where id = 1'))[0].n)).toBe(1)
  })
})
