/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Column statistics (aggregates) through the backend columnStats process.
import { expect, open, test } from '../../support/fixtures'
import { addCondition, closeFilterSheet, expectColumn, grid, openFilter, showTable, sqlColumn } from './query-helpers'

test('[QRY-022] column statistics aggregate the filtered rows, per value and overall @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  await showTable(page)
  await expectColumn(page, 'id', await sqlColumn(backend, 'select id from qry_item order by id desc'))
  await grid(page, 'Query Item').getByRole('button', { name: 'Column statistics for Species' }).click()
  const dialog = page.locator('[data-qqq-id="dialog-column-stats"]')
  await expect(dialog.getByRole('heading')).toHaveText('Column Statistics for Species')
  const distribution = await backend.sql("select case species_id when 1 then 'Dog' when 2 then 'Cat' else '—' end as label, count(*) as n from qry_item group by species_id order by count(*) desc")
  await expect(dialog.locator('[data-qqq-id="column-stats-value"]')).toHaveText(distribution.map((r) => String(r.label)))
  await expect(dialog.locator('[data-qqq-id="column-stats-count"]')).toHaveText(distribution.map((r) => String(r.n)))
  const total = Number((await backend.sql('select count(*) as n from qry_item'))[0].n)
  await expect(dialog.locator('[data-qqq-id="column-stats-percent"]').first()).toHaveText(`${(Number(distribution[0].n) * 100 / total).toFixed(2)}%`)
  await expect(dialog.locator('[data-qqq-id="column-stats-count"]').first()).toBeVisible()
  // Sorting the distribution by count ascending
  await dialog.getByRole('button', { name: 'Count' }).click()
  await expect(dialog.locator('[data-qqq-id="column-stats-count"]')).toHaveText([...distribution].reverse().map((r) => String(r.n)))
  await dialog.getByRole('button', { name: 'Close' }).click()

  // Numeric statistics respect the active filter
  await openFilter(page)
  const row = await addCondition(page, 'Quantity', 'greater than')
  await row.getByLabel('Filter value for Quantity').fill('5')
  await expectColumn(page, 'id', await sqlColumn(backend, 'select id from qry_item where quantity > 5 order by id desc'))
  await closeFilterSheet(page)
  await grid(page, 'Query Item').getByRole('button', { name: 'Column statistics for Quantity' }).click()
  const [stats] = await backend.sql('select count(quantity) as c, sum(quantity) as s, min(quantity) as mn, max(quantity) as mx from qry_item where quantity > 5')
  await expect(dialog.locator('[data-qqq-id="column-stats-stat-sum"]')).toHaveText(Number(stats.s).toLocaleString('en-US'))
  await expect(dialog.locator('[data-qqq-id="column-stats-stat-min"]')).toHaveText(String(stats.mn))
  await expect(dialog.locator('[data-qqq-id="column-stats-stat-max"]')).toHaveText(String(stats.mx))
  await expect(dialog.locator('[data-qqq-id="column-stats-count"]')).toHaveCount(Number(stats.c))
})

test('[QRY-023] tables without the QUERY_STATS capability offer no column statistics @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/person')
  await showTable(page)
  await expectColumn(page, 'id', await sqlColumn(backend, 'select id from person order by id desc'))
  await expect(grid(page, 'Person').getByRole('button', { name: /^Column statistics for/ })).toHaveCount(0)
})
