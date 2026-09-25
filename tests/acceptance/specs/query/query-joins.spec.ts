/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Exposed joins on the Query Item fixture: joined columns, filters, sorts and many-side counts.
import { expect, open, test } from '../../support/fixtures'
import { addCondition, captureQueries, closeFilterSheet, columnCells, expectColumn, grid, nextQuery, openFilter, showTable, sqlColumn } from './query-helpers'

test('[QRY-020] a one-side exposed join adds labelled columns, filters and sorts that match SQL @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  await showTable(page)
  await expectColumn(page, 'id', await sqlColumn(backend, 'select id from qry_item order by id desc'))
  const bodies = captureQueries(page, 'qryItem')
  await page.getByRole('button', { name: 'Configure columns' }).click()
  const config = page.getByRole('dialog', { name: 'Configure columns' })
  await expect(config.getByRole('group', { name: 'Person Fields' })).toBeVisible()
  await config.getByRole('button', { name: 'Show column Person: First Name' }).click()
  await page.keyboard.press('Escape')
  const table = grid(page, 'Query Item')
  await expect(table.getByRole('button', { name: 'Sort by Person: First Name' })).toBeVisible()
  // LEFT join, so items without an owner stay listed with an empty joined value
  await expectColumn(page, 'person.firstName', await sqlColumn(backend,
    "select coalesce(p.first_name, '—') from qry_item i left join person p on p.id = i.owner_id order by i.id desc"))
  await expect.poll(() => (bodies.at(-1) as { joins?: unknown[] } | undefined)?.joins).toEqual([{ joinTable: 'person', select: true, type: 'LEFT', joinName: 'qryItemJoinPerson' }])

  // Filter on a joined field ("Person: Last Name" style labels, joinTable.field names)
  await openFilter(page)
  const row = await addCondition(page, 'Person: First Name', 'equals')
  const sent = nextQuery(page, 'qryItem')
  await row.getByLabel('Filter value for Person: First Name').fill('Blair')
  expect(JSON.stringify((await sent).filter)).toContain('"fieldName":"person.firstName"')
  await expectColumn(page, 'name', await sqlColumn(backend,
    "select i.name from qry_item i join person p on p.id = i.owner_id where p.first_name = 'Blair' order by i.id desc"))
  await page.getByRole('button', { name: 'Remove filter condition 1' }).click()
  await closeFilterSheet(page)

  // Sort by the joined column
  await table.getByRole('button', { name: 'Sort by Person: First Name' }).click()
  await expectColumn(page, 'person.firstName', await sqlColumn(backend,
    "select coalesce(p.first_name, '—') from qry_item i left join person p on p.id = i.owner_id order by p.first_name asc nulls first, i.id desc"))

  // Hiding the column and dropping the sort stops joining
  await table.getByRole('button', { name: 'Sort by Person: First Name' }).click()
  await table.getByRole('button', { name: 'Sort by Person: First Name' }).click()
  await page.getByRole('button', { name: 'Configure columns' }).click()
  await page.getByRole('dialog', { name: 'Configure columns' }).getByRole('button', { name: 'Hide column Person: First Name' }).click()
  await page.keyboard.press('Escape')
  await expect(table.getByRole('button', { name: 'Sort by Person: First Name' })).toHaveCount(0)
  // (the unjoined first page is cached, so ask for a new page size to see a fresh request)
  const fresh = nextQuery(page, 'qryItem')
  await page.getByLabel('Rows per page').selectOption('10')
  expect((await fresh).joins).toBeUndefined()
})

test('[QRY-021] a many-side exposed join repeats rows and reports the distinct count @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  await showTable(page)
  await expectColumn(page, 'id', await sqlColumn(backend, 'select id from qry_item order by id desc'))
  const countUrls: string[] = []
  page.on('request', (r) => { if (r.url().includes('/qqq/v1/table/qryItem/count')) countUrls.push(r.url()) })
  await page.getByRole('button', { name: 'Configure columns' }).click()
  await page.getByRole('dialog', { name: 'Configure columns' }).getByRole('button', { name: 'Show column Item Note: Note' }).click()
  await page.keyboard.press('Escape')
  const expected = await backend.sql("select i.name as name, coalesce(n.note, '—') as note from qry_item i left join qry_item_note n on n.item_id = i.id order by i.id desc")
  await expect(columnCells(page, 'qryItemNote.note')).toHaveCount(expected.length)
  const shown = await page.locator('tbody tr').evaluateAll((rows) => rows.map((r) =>
    `${r.querySelector('[data-qqq-id="grid-cell-name"]')?.textContent}|${r.querySelector('[data-qqq-id="grid-cell-qryItemNote.note"]')?.textContent}`))
  expect(shown.sort()).toEqual(expected.map((r) => `${r.name}|${r.note}`).sort())
  const distinct = (await backend.sql('select count(*) as n from qry_item'))[0].n
  await expect(page.locator('[data-qqq-id="pagination"]')).toContainText(`of ${expected.length} (${distinct} distinct)`)
  // the count request asks for the distinct count
  expect(countUrls.some((url) => url.includes('includeDistinct=true'))).toBe(true)
  // Selecting everything counts distinct records
  await page.getByRole('button', { name: 'Selection', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: /Full query result/ })).toHaveText(`Full query result (${distinct} distinct records)`)
})
