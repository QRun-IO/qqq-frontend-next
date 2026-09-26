/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Large-table budgets: prfWide has 10,000 rows and 40 columns (PerformanceFixtures.java).
import { expect, open, test } from '../../support/fixtures'
import { addCondition, columnCells, grid, nextQuery, openFilter, sqlColumn } from '../query/query-helpers'
import { PERFORMANCE_BUDGET, timed } from './budgets'

const ROWS = 10_000
const KINDS = ['Text', 'Count', 'Amount', 'Day', 'Moment', 'Flag']
/** Field name and label of column n (3..40), as PerformanceFixtures defines them. */
const column = (n: number) => {
  const kind = KINDS[(n - 3) % KINDS.length]
  const suffix = String(n).padStart(2, '0')
  return { name: `${kind.toLowerCase()}${suffix}`, label: `${kind} ${suffix}` }
}
const LABELS = ['Id', 'Name', ...Array.from({ length: 38 }, (_, i) => column(i + 3).label)]
/** Ids from `first` counting down, `count` of them. */
const idsDown = (first: number, count: number) => Array.from({ length: count }, (_, i) => String(first - i))

test('[PRF-001] a 10,000-row, 40-column table opens with every column and the exact first page within budget', async ({ page, diagnostics }) => {
  void diagnostics
  const ids = idsDown(ROWS, 25)
  const elapsed = await timed('first page', () => open(page, '/app/prfWide'), () => expect(columnCells(page, 'id')).toHaveText(ids))
  const table = grid(page, 'Performance Wide')
  // every field is a column (the grid keeps the metadata field-map order, so compare as a set)
  const headers = table.getByRole('button', { name: /^Sort by / })
  await expect(headers).toHaveCount(40)
  expect((await headers.allTextContents()).sort()).toEqual([...LABELS].sort())
  await expect(page.locator('[data-qqq-id="pagination-total"]')).toHaveText('10,000')
  // exact computed values: text 'C<n>-<id>', count (id * n) mod 1000, flag (id + n) even
  await expect(columnCells(page, 'name')).toHaveText(ids.map((id) => `Row ${id.padStart(5, '0')}`))
  await expect(columnCells(page, column(3).name)).toHaveText(ids.map((id) => `C3-${id}`))
  await expect(columnCells(page, column(10).name)).toHaveText(ids.map((id) => String((Number(id) * 10) % 1000)))
  await expect(columnCells(page, column(8).name)).toHaveText(ids.map((id) => ((Number(id) + 8) % 2 === 0 ? 'Yes' : 'No')))
  await expect(columnCells(page, column(39).name)).toHaveText(ids.map((id) => `C39-${id}`))
  // one page in the DOM, not the table
  await expect(table.locator('tbody td[data-qqq-id^="grid-cell-"]:not([data-qqq-id="grid-cell-_select"])')).toHaveCount(25 * 40)
  expect(elapsed, 'first page of 10,000 rows').toBeLessThan(PERFORMANCE_BUDGET.firstPageMs)
})

test('[PRF-002] 250-row pages of 40 columns render, page and reach the last page within budget', async ({ page, diagnostics }) => {
  void diagnostics
  await open(page, '/app/prfWide')
  await expect(columnCells(page, 'id')).toHaveText(idsDown(ROWS, 25))
  const table = grid(page, 'Performance Wide')
  const cells = table.locator('tbody td[data-qqq-id^="grid-cell-"]:not([data-qqq-id="grid-cell-_select"])')

  let sent = nextQuery(page, 'prfWide')
  const resize = await timed('page size 250', () => page.getByLabel('Rows per page').selectOption('250'), () => expect(columnCells(page, 'id')).toHaveText(idsDown(ROWS, 250)))
  expect((await sent).filter).toMatchObject({ skip: 0, limit: 250 })
  await expect(cells).toHaveCount(250 * 40)

  sent = nextQuery(page, 'prfWide')
  const next = await timed('next page', () => page.getByRole('button', { name: 'Next page' }).click(), () => expect(columnCells(page, 'id')).toHaveText(idsDown(9_750, 250)))
  expect((await sent).filter).toMatchObject({ skip: 250, limit: 250 })
  await expect(cells).toHaveCount(250 * 40)

  sent = nextQuery(page, 'prfWide')
  const last = await timed('last page', () => page.getByRole('button', { name: 'Last page' }).click(), () => expect(columnCells(page, 'id')).toHaveText(idsDown(250, 250)))
  expect((await sent).filter).toMatchObject({ skip: 9_750, limit: 250 })
  await expect(cells).toHaveCount(250 * 40)
  await expect(page.locator('[data-qqq-id="pagination"]')).toContainText('Showing 9751–10000 of 10,000')

  for (const [label, elapsed] of [['page size 250', resize], ['next page', next], ['last page', last]] as const) {
    expect(elapsed, label).toBeLessThan(PERFORMANCE_BUDGET.pageMs)
  }
})

test('[PRF-003] sorting and filtering 10,000 rows return exact results within budget', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/prfWide')
  await expect(columnCells(page, 'id')).toHaveText(idsDown(ROWS, 25))
  const table = grid(page, 'Performance Wide')

  const sorted = await timed('sort by Name', () => table.getByRole('button', { name: 'Sort by Name', exact: true }).click(),
    () => expect(columnCells(page, 'name')).toHaveText(Array.from({ length: 25 }, (_, i) => `Row ${String(i + 1).padStart(5, '0')}`)))
  await expect(table.locator('th[aria-sort="ascending"]')).toContainText('Name')

  // the filter keeps the Name sort; zero-padded names sort like their ids
  await openFilter(page)
  const row = await addCondition(page, 'Count 04', 'equals')
  const matching = await sqlColumn(backend, 'select id from prf_wide where count04 = 0 order by name')
  expect(matching).toHaveLength(40)
  const filtered = await timed('filter Count 04 = 0', () => row.getByLabel('Filter value for Count 04').fill('0'),
    () => expect(columnCells(page, 'id')).toHaveText(matching.slice(0, 25)))
  await expect(page.locator('[data-qqq-id="pagination-total"]')).toHaveText('40')

  expect(sorted, 'sort by Name').toBeLessThan(PERFORMANCE_BUDGET.queryMs)
  expect(filtered, 'filter').toBeLessThan(PERFORMANCE_BUDGET.queryMs)
})
