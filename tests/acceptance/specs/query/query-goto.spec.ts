/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Material "Go To" record lookup: qryBin configures gotoFieldNames [[code], [aisle, shelf]];
// qryLocker can be read by key but not queried, so its query screen opens Go To.
import type { Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { expectTouchReady } from '../../support/touch'
import { captureQueries, columnCells, expectColumn, sqlColumn } from './query-helpers'

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Go To...' })
const goButton = (page: Page, table: string, key: string) => dialog(page).getByRole('button', { name: `Go to the ${table} record with this ${key}` })

test.describe('Go To record', () => {
  test('[QRY-067] Go To opens a record by primary key or by either unique key @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    // the v1 table metadata carries the Material supplemental metadata the button reads
    const table = await (await backend.api.get('/qqq/v1/metaData/table/qryBin')).json()
    expect(table.supplementalMetaData.materialDashboard.gotoFieldNames).toEqual([['code'], ['aisle', 'shelf']])

    const queries = captureQueries(page, 'qryBin')
    await open(page, '/app/qryBin')
    await expectColumn(page, 'contents', await sqlColumn(backend, 'select contents from qry_bin order by id desc'))
    const gotoButton = page.locator('[data-qqq-id="button-goto"]')
    await expect(gotoButton).toHaveText('Go To...')

    // Options: the primary key, then each configured key; fields labelled by their labels
    await gotoButton.click()
    await expect(dialog(page).locator('form')).toHaveCount(3)
    // the dialog fits a phone and its controls are touch-sized (no-op checks with a mouse)
    await expectTouchReady(page, dialog(page))
    await expect(dialog(page).getByRole('form', { name: 'Go to by Id' })).toBeVisible()
    await expect(dialog(page).getByRole('form', { name: 'Go to by Bin Code' })).toBeVisible()
    await expect(dialog(page).getByRole('form', { name: 'Go to by Aisle and Shelf' })).toBeVisible()
    await expect(dialog(page).getByLabel('Id', { exact: true })).toBeFocused()
    await expect(goButton(page, 'Storage Bin', 'Id')).toBeDisabled()

    // primary key
    await dialog(page).getByLabel('Id', { exact: true }).fill('3')
    await goButton(page, 'Storage Bin', 'Id').click()
    await expect(page).toHaveURL(/\/app\/qryBin\/3\/?$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Washers' })).toBeVisible()
    await expect(dialog(page)).toHaveCount(0)
    const byId = queries.at(-1) as { filter: { criteria: unknown[] } }
    expect(byId.filter.criteria).toEqual([{ fieldName: 'id', operator: 'EQUALS', values: ['3'] }])

    // one unique key, from the record view header's Go To
    await page.locator('[data-qqq-id="button-goto"]').click()
    await dialog(page).getByLabel('Bin Code', { exact: true }).fill('B-200')
    await goButton(page, 'Storage Bin', 'Bin Code').click()
    const [nuts] = await sqlColumn(backend, "select id from qry_bin where code = 'B-200'")
    await expect(page).toHaveURL(new RegExp(`/app/qryBin/${nuts}/?$`))
    await expect(page.getByRole('heading', { level: 1, name: 'Nuts' })).toBeVisible()

    // the two-field unique key
    await page.locator('[data-qqq-id="button-goto"]').click()
    await dialog(page).getByLabel('Aisle', { exact: true }).fill('B')
    await dialog(page).getByLabel('Shelf', { exact: true }).fill('1')
    await goButton(page, 'Storage Bin', 'Aisle and Shelf').click()
    const [washers] = await sqlColumn(backend, "select id from qry_bin where aisle = 'B' and shelf = '1'")
    await expect(page).toHaveURL(new RegExp(`/app/qryBin/${washers}/?$`))
    expect((queries.at(-1) as { filter: { criteria: unknown[] } }).filter.criteria).toEqual([
      { fieldName: 'aisle', operator: 'EQUALS', values: ['B'] },
      { fieldName: 'shelf', operator: 'EQUALS', values: ['1'] },
    ])
  })

  test('[QRY-067] Go To reports no match and more than one match, and Enter submits @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await open(page, '/app/qryBin')
    await page.locator('[data-qqq-id="button-goto"]').click()
    const message = dialog(page).getByRole('alert')

    // keyboard only: type a code and press Enter
    await dialog(page).getByLabel('Bin Code', { exact: true }).fill('B-999')
    await dialog(page).getByLabel('Bin Code', { exact: true }).press('Enter')
    await expect(message).toHaveText('Record not found.')
    expect(await sqlColumn(backend, "select count(*) from qry_bin where code = 'B-999'")).toEqual(['0'])
    await expect(page).toHaveURL(/\/app\/qryBin\/?$/)

    // part of the two-field key: aisle A holds two bins
    await dialog(page).getByLabel('Aisle', { exact: true }).fill('A')
    await dialog(page).getByLabel('Aisle', { exact: true }).press('Enter')
    await expect(message).toHaveText('More than 1 record was found...')
    expect(await sqlColumn(backend, "select count(*) from qry_bin where aisle = 'A'")).toEqual(['2'])
    await expect(page).toHaveURL(/\/app\/qryBin\/?$/)

    // Enter on a real code opens it
    await dialog(page).getByLabel('Bin Code', { exact: true }).fill('B-400')
    await dialog(page).getByLabel('Bin Code', { exact: true }).press('Enter')
    await expect(page).toHaveURL(/\/app\/qryBin\/4\/?$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Screws' })).toBeVisible()

    // opened from the keyboard, Escape closes it and returns focus to the Go To button
    await page.locator('[data-qqq-id="button-goto"]').focus()
    await page.keyboard.press('Enter')
    await expect(dialog(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toHaveCount(0)
    await expect(page.locator('[data-qqq-id="button-goto"]')).toBeFocused()
  })

  test('[QRY-067] a table that is not queryable opens Go To, which cannot be dismissed @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await open(page, '/app/qryLocker')
    await expect(page.locator('[data-qqq-id="query-not-supported"]')).toHaveText('Locker records cannot be queried.')
    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page).getByRole('button', { name: 'Close' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toBeVisible()
    await dialog(page).getByLabel('Locker Code', { exact: true }).fill('L-02')
    await dialog(page).getByLabel('Locker Code', { exact: true }).press('Enter')
    const [bo] = await sqlColumn(backend, "select id from qry_locker where code = 'L-02'")
    await expect(page).toHaveURL(new RegExp(`/app/qryLocker/${bo}/?$`))
    await expect(page.getByRole('heading', { level: 1, name: 'Bo Locker' })).toBeVisible()
    await expect(dialog(page)).toHaveCount(0)
  })

  test('[QRY-067] tables without gotoFieldNames offer no Go To @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const table = await (await backend.api.get('/qqq/v1/metaData/table/qryItem')).json()
    expect(table.supplementalMetaData?.materialDashboard?.gotoFieldNames ?? null).toBeNull()
    await open(page, '/app/qryItem')
    await expect(columnCells(page, 'name').first()).toBeVisible()
    await expect(page.locator('[data-qqq-id="button-goto"]')).toHaveCount(0)
    await open(page, '/app/qryItem/1')
    await expect(page.getByRole('heading', { level: 1, name: 'Alpha Widget' })).toBeVisible()
    await expect(page.locator('[data-qqq-id="button-goto"]')).toHaveCount(0)
    await expect(page.getByRole('dialog', { name: 'Go To...' })).toHaveCount(0)
  })
})
