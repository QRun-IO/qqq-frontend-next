/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Material grid and saved-view parity against the owned QQQ sample server.
import { expect, open, test } from '../../support/fixtures'
import { closeFilterSheet, columnCells, expectColumn, grid, openFilter, showTable, sqlColumn } from './query-helpers'

test('[QRY-090] the column menu sorts, pins, opens a field filter and hides a column @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  await showTable(page)
  const menuButton = page.getByRole('button', { name: 'Name column menu' })
  await menuButton.click()
  await page.getByRole('menuitem', { name: 'Sort ascending' }).click()
  await expectColumn(page, 'name', await sqlColumn(backend, 'select name from qry_item order by name asc'))

  await menuButton.click()
  await page.getByRole('menuitem', { name: 'Pin to right' }).click()
  await expect(grid(page, 'Query Item').locator('th[data-col="name"]')).toHaveAttribute('data-pinned', 'right')
  await menuButton.click()
  await page.getByRole('menuitem', { name: 'Filter', exact: true }).click()
  await expect(page.locator('[data-qqq-id="filter-builder"]')).toBeVisible()
  await expect(page.locator('[data-qqq-id="filter-row-0-0"]')).toContainText('Name')
  await closeFilterSheet(page)

  await menuButton.click()
  await page.getByRole('menuitem', { name: 'Hide column' }).click()
  await expect(grid(page, 'Query Item').getByRole('button', { name: 'Sort by Name' })).toHaveCount(0)
})

test('[QRY-091] copying page values and the full query uses the ordered backend rows @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (value: string) => { (window as Window & { __qqqCopied?: string }).__qqqCopied = value } },
    })
  })
  const ids = await sqlColumn(backend, 'select id from carrier order by id desc')
  await open(page, '/app/carrier?pageSize=10')
  await showTable(page)
  const menuButton = page.getByRole('button', { name: 'Id column menu' })
  await menuButton.click()
  await page.getByRole('menuitem', { name: 'Copy page values' }).click()
  await expect.poll(() => page.evaluate(() => (window as Window & { __qqqCopied?: string }).__qqqCopied)).toBe(`${ids.slice(0, 10).join('\n')}\n`)
  await menuButton.click()
  await page.getByRole('menuitem', { name: 'Copy full query values' }).click()
  await expect.poll(() => page.evaluate(() => (window as Window & { __qqqCopied?: string }).__qqqCopied)).toBe(`${ids.join('\n')}\n`)
})

test('[QRY-092] the column chooser searches, groups, counts and marks a changed layout @mobile', async ({ page, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  await showTable(page)
  const button = page.getByRole('button', { name: 'Configure columns' })
  await expect(button).toHaveAttribute('data-button-state', 'empty')
  await button.click()
  const panel = page.getByRole('dialog', { name: 'Configure columns' })
  const search = panel.getByRole('searchbox', { name: 'Search Fields' })
  await search.fill('Notes')
  await expect(panel.getByRole('listitem')).toHaveCount(1)
  await search.fill('no field has this label')
  await expect(panel.locator('[data-qqq-id="column-config-no-match"]')).toBeVisible()
  await search.clear()
  const group = panel.getByRole('group', { name: 'Query Item Fields' })
  await expect(group.getByRole('switch')).toContainText('Query Item Fields')
  await group.getByRole('button', { name: 'Collapse Query Item Fields' }).click()
  await expect(group.getByRole('listitem')).toHaveCount(0)
  await group.getByRole('button', { name: 'Expand Query Item Fields' }).click()
  await group.getByRole('button', { name: 'Hide column Notes' }).click()
  await expect(button).toHaveAttribute('data-button-state', 'dirty')
})

test('[QRY-093] the last saved view and its unsaved filter survive reopening and reload @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const rows = await backend.sql("select id from saved_view where label = 'Alice People View'")
  const id = rows[0]?.id
  expect(id).toBeTruthy()
  await open(page, `/app/person/savedView/${id}`)
  await expectColumn(page, 'firstName', ['Avery'])
  await openFilter(page)
  const row = page.locator('[data-qqq-id="filter-row-0-0"]')
  await row.getByLabel('Filter operator').selectOption({ label: 'starts with' })
  await row.getByLabel('Filter value for First Name').fill('B')
  await expectColumn(page, 'firstName', ['Blair'])
  await closeFilterSheet(page)
  await page.reload()
  await expectColumn(page, 'firstName', ['Blair'])
  await open(page, '/app/person')
  await expect(page).toHaveURL(new RegExp(`/app/person/savedView/${id}/?`))
  await expectColumn(page, 'firstName', ['Blair'])
  await page.locator('[data-qqq-id="saved-view-reset"]').click()
  await expectColumn(page, 'firstName', ['Avery'])
})

test('[QRY-094] a counted quick view uses the backend filter and opens its saved-view route @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await backend.seedQuickView()
  const ids = await backend.sql("select id from saved_view where label = 'Alice People View'")
  await open(page, '/app/person')
  const quick = page.getByRole('group', { name: 'Quick views' }).getByRole('button', { name: /Avery People/ })
  await expect(quick).toContainText('(1)')
  await quick.click()
  await expect(page).toHaveURL(new RegExp(`/app/person/savedView/${ids[0].id}/?`))
  await expectColumn(page, 'firstName', ['Avery'])
})

test('[QRY-095] a new query defaults to fifty rows per page @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryManyRow')
  await expect(page.getByLabel('Rows per page')).toHaveValue('50')
  await expect(columnCells(page, 'id')).toHaveCount(50)
  expect(await sqlColumn(backend, 'select count(*) from qry_many_row')).toEqual(['1234'])
  await expect(page.locator('[data-qqq-id="pagination"]')).toContainText('Showing 1–50 of 1,234')
})

test('[QRY-096] a saved view drops removed fields and explains the repair @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await backend.seedStaleView()
  const ids = await backend.sql("select id from saved_view where label = 'Alice People View'")
  await open(page, `/app/person/savedView/${ids[0].id}`)
  await expect(page.locator('[data-qqq-id="query-heading"]')).toContainText('Person / Alice People View')
  await expect(page.locator('[data-qqq-id="query-view-warning"]')).toContainText('retiredField')
  await expectColumn(page, 'firstName', await sqlColumn(backend, 'select first_name from person order by id desc'))
})
