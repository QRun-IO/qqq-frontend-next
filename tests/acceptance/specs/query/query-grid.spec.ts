/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Record list basics: columns, default sort, sorting, pagination, column configuration.
import { expect, open, test } from '../../support/fixtures'
import { columnCells, expectColumn, grid, nextQuery, showTable, sqlColumn } from './query-helpers'

test('[QRY-068] default columns follow the table sections, then fields no section lists (Material order)', async ({ page, backend, diagnostics }) => {
  void diagnostics
  // the fields are declared price, quantity, code, id, name; the sections list id, name, code, then price, then quantity
  await open(page, '/app/qryOrdered')
  const headers = grid(page, 'Ordered Item').locator('thead button[aria-label^="Sort by "]')
  await expect(headers).toHaveCount(5)
  expect(await headers.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')))).toEqual(
    ['Sort by Id', 'Sort by Name', 'Sort by Code', 'Sort by Price', 'Sort by Quantity'])
  await expectColumn(page, 'id', await sqlColumn(backend, 'select id from qry_item order by id desc'))
})

test('[QRY-069] pagination numbers are locale formatted in the range and the total', async ({ page, backend, diagnostics }) => {
  void diagnostics
  expect(await sqlColumn(backend, 'select count(*) from qry_many_row')).toEqual(['1234'])
  await open(page, '/app/qryManyRow?pageSize=250&page=5')
  await expect(page.locator('[data-qqq-id="pagination"]')).toContainText('Showing 1,001–1,234 of 1,234')
  await expectColumn(page, 'id', (await sqlColumn(backend, 'select id from qry_many_row order by id desc')).slice(1000))
})

test('[QRY-001] the list renders metadata labels and every record, newest first @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  await showTable(page)
  const table = grid(page, 'Query Item')
  for (const label of ['Id', 'Name', 'Code', 'Quantity', 'Price', 'Received Date', 'Checked At', 'Is Active', 'Owner', 'Species', 'Notes']) {
    await expect(table.getByRole('button', { name: `Sort by ${label}`, exact: true })).toBeVisible()
  }
  // Join columns are available but hidden by default (Material)
  await expect(table.getByRole('button', { name: 'Sort by Person: First Name' })).toHaveCount(0)
  // Default sort: primary key descending
  await expectColumn(page, 'id', await sqlColumn(backend, 'select id from qry_item order by id desc'))
  await expect(table.locator('th[aria-sort="descending"]')).toContainText('Id')
  // Possible values render their labels; null booleans and blanks render as empty
  const owners = await sqlColumn(backend, "select coalesce(p.first_name || ' ' || p.last_name, '—') from qry_item i left join person p on p.id = i.owner_id order by i.id desc")
  await expectColumn(page, 'ownerId', owners)
  const species = await sqlColumn(backend, "select case species_id when 1 then 'Dog' when 2 then 'Cat' else '—' end from qry_item order by id desc")
  await expectColumn(page, 'speciesId', species)
  const active = await sqlColumn(backend, "select case when is_active is null then '—' when is_active then 'Yes' else 'No' end from qry_item order by id desc")
  await expectColumn(page, 'isActive', active)
  await expect(page.locator('[data-qqq-id="pagination"]')).toContainText('Showing 1–8 of 8')
})

test('[QRY-002] paging through the carrier table, with page size and URL state @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const ids = await sqlColumn(backend, 'select id from carrier order by id desc')
  expect(ids).toHaveLength(11)
  await open(page, '/app/carrier')
  await expectColumn(page, 'id', ids)
  const pageSize = page.getByLabel('Rows per page')
  expect(await pageSize.locator('option').allTextContents()).toEqual(['10', '25', '50', '100', '250'])
  await pageSize.selectOption('10')
  await expectColumn(page, 'id', ids.slice(0, 10))
  await expect(page.locator('[data-qqq-id="pagination"]')).toContainText('Showing 1–10 of 11')
  await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled()
  const sent = nextQuery(page, 'carrier')
  await page.getByRole('button', { name: 'Next page' }).click()
  expect(((await sent).filter as { skip: number; limit: number })).toMatchObject({ skip: 10, limit: 10 })
  await expectColumn(page, 'id', ids.slice(10))
  await expect(page.locator('[data-qqq-id="pagination"]')).toContainText('Showing 11–11 of 11')
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled()
  await expect(page).toHaveURL(/page=2/)
  await expect(page).toHaveURL(/pageSize=10/)
  await page.reload()
  await expectColumn(page, 'id', ids.slice(10))
  await page.getByRole('button', { name: 'First page' }).click()
  await expectColumn(page, 'id', ids.slice(0, 10))
  await page.getByRole('button', { name: 'Last page' }).click()
  await expectColumn(page, 'id', ids.slice(10))
  // Changing the page size returns to the first page
  await pageSize.selectOption('25')
  await expectColumn(page, 'id', ids)
  await expect(page).not.toHaveURL(/page=2/)
  // An out-of-range page link shows no rows rather than failing
  await open(page, '/app/carrier?page=9&pageSize=10')
  await expect(page.getByText('No records found', { exact: true })).toBeVisible()
})

test('[QRY-003] sorting by a column header cycles ascending, descending and the default @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  await showTable(page)
  await expectColumn(page, 'id', await sqlColumn(backend, 'select id from qry_item order by id desc'))
  const header = grid(page, 'Query Item').getByRole('button', { name: 'Sort by Name', exact: true })
  const sent = nextQuery(page, 'qryItem')
  await header.click()
  expect((await sent).filter).toMatchObject({ orderBys: [{ fieldName: 'name', isAscending: true }] })
  await expectColumn(page, 'name', await sqlColumn(backend, 'select name from qry_item order by name asc'))
  await expect(page.locator('th[aria-sort="ascending"]')).toContainText('Name')
  await header.click()
  await expectColumn(page, 'name', await sqlColumn(backend, 'select name from qry_item order by name desc'))
  // The sort is kept in the URL's filter, so it survives a reload
  const urlSort = () => JSON.parse(Buffer.from(new URL(page.url()).searchParams.get('filter') ?? '', 'base64').toString('utf8') || '{}').orderBys
  await expect.poll(urlSort).toEqual([{ fieldName: 'name', isAscending: false }])
  await page.reload()
  await expectColumn(page, 'name', await sqlColumn(backend, 'select name from qry_item order by name desc'))
  await grid(page, 'Query Item').getByRole('button', { name: 'Sort by Name', exact: true }).click()
  await expectColumn(page, 'id', await sqlColumn(backend, 'select id from qry_item order by id desc'))
  // Numeric sort is numeric, not textual; nulls follow the database order
  await grid(page, 'Query Item').getByRole('button', { name: 'Sort by Quantity', exact: true }).click()
  await expectColumn(page, 'name', await sqlColumn(backend, 'select name from qry_item order by quantity asc nulls first'))
})

test('[QRY-004] column visibility and order persist per table @mobile', async ({ page, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  await showTable(page)
  const table = grid(page, 'Query Item')
  await page.getByRole('button', { name: 'Configure columns' }).click()
  const config = page.getByRole('dialog', { name: 'Configure columns' })
  await config.getByRole('button', { name: 'Hide column Notes' }).click()
  await expect(table.getByRole('button', { name: 'Sort by Notes' })).toHaveCount(0)
  // Move "Name" to the front with the keyboard
  const names = config.locator('[data-qqq-id^="column-config-item-"]')
  const nameIndex = (await names.evaluateAll((items) => items.map((i) => i.getAttribute('data-qqq-id')))).indexOf('column-config-item-name')
  const grip = config.getByRole('button', { name: 'Drag to reorder Name' })
  for (let i = 0; i < nameIndex; i++) {
    await grip.focus()
    await grip.press('ArrowUp')
  }
  await expect(table.locator('thead th').nth(1)).toContainText('Name')
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(grid(page, 'Query Item').locator('thead th').nth(1)).toContainText('Name')
  await expect(grid(page, 'Query Item').getByRole('button', { name: 'Sort by Notes' })).toHaveCount(0)
  // Other tables keep their own configuration
  await open(page, '/app/carrier')
  await showTable(page)
  await expect(grid(page, 'Carrier').getByRole('button', { name: 'Sort by Name', exact: true })).toBeVisible()
  // Show all restores hidden base columns
  await open(page, '/app/qryItem')
  await page.getByRole('button', { name: 'Configure columns' }).click()
  await page.getByRole('dialog', { name: 'Configure columns' }).getByRole('button', { name: 'Show all', exact: true }).click()
  await expect(grid(page, 'Query Item').getByRole('button', { name: 'Sort by Notes' })).toBeVisible()
})

test('[QRY-005] column widths, density and card view @mobile', async ({ page, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  await showTable(page)
  const header = grid(page, 'Query Item').locator('thead th').filter({ hasText: 'Name' })
  const before = (await header.boundingBox())!.width
  const handle = page.getByRole('separator', { name: 'Resize Name column' })
  await handle.focus()
  for (let i = 0; i < 5; i++) await handle.press('ArrowRight')
  await expect.poll(async () => Math.round((await header.boundingBox())!.width)).toBe(Math.round(before + 50))
  await page.reload()
  await expect.poll(async () => Math.round((await grid(page, 'Query Item').locator('thead th').filter({ hasText: 'Name' }).boundingBox())!.width)).toBe(Math.round(before + 50))
  // Density
  await page.getByRole('button', { name: 'Select display density' }).click()
  await page.getByRole('option', { name: 'Compact' }).click()
  await expect(page.locator('[data-qqq-id="grid-row-0"]')).toHaveClass(/h-8/)
  // Card view lists the same records
  await page.getByRole('button', { name: 'Card view' }).click()
  await expect(page.getByText('Omega Part').first()).toBeVisible()
  await page.getByRole('button', { name: 'Table view' }).click()
  await expect(columnCells(page, 'name').first()).toHaveText('Omega Part')
})

test('[QRY-006] opening a row and coming back keeps the query; refresh shows backend changes @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem?pageSize=10')
  await showTable(page)
  await page.getByLabel('Quick search Query Item').fill('Widget')
  const widgets = await sqlColumn(backend, "select name from qry_item where name like '%Widget%' or code like '%Widget%' or notes like '%Widget%' order by id desc")
  await expectColumn(page, 'name', widgets)
  await columnCells(page, 'name').first().click()
  await expect(page).toHaveURL(/\/app\/qryItem\/5\/?$/)
  await page.goBack()
  await expectColumn(page, 'name', widgets)
  await expect(page.getByLabel('Quick search Query Item')).toHaveValue('Widget')

  // An API change made elsewhere appears after Refresh (no stale grid)
  const update = await backend.api.put('/data/qryItem/5', { multipart: { name: 'Epsilon Widget Max' } })
  expect(update.status()).toBe(200)
  await page.getByRole('button', { name: 'Refresh data' }).click()
  await expect(columnCells(page, 'name').first()).toHaveText('Epsilon Widget Max')
  expect(await sqlColumn(backend, 'select name from qry_item where id = 5')).toEqual(['Epsilon Widget Max'])
})

test('[QRY-007] a failed query shows the error and a retry @mobile', async ({ page, diagnostics }) => {
  diagnostics.allow('/qqq/v1/table/qryItem/query 500')
  diagnostics.allow('/qqq/v1/table/qryItem/count 500')
  diagnostics.allow('status of 500')
  // An unknown field in a shared link is rejected by the backend
  await open(page, `/app/qryItem?filter=${encodeURIComponent(JSON.stringify({ criteria: [{ fieldName: 'noSuchField', operator: 'EQUALS', values: ['x'] }] }))}`)
  const alert = page.locator('[data-qqq-id="grid-error"]')
  await expect(alert).toContainText('Failed to load records.')
  await expect(alert.getByRole('button', { name: 'Retry' })).toBeVisible()
})
