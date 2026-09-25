/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Backend saved views (querySavedView / storeSavedView / deleteSavedView), owned and shared.
import type { Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { addCondition, closeFilterSheet, expectColumn, grid, openFilter, showTable, sqlColumn } from './query-helpers'

const ALICE_VIEW = 'Alice People View'

/** Opens the saved views menu. */
async function openViews(page: Page) {
  await page.locator('[data-qqq-id="button-saved-views"]').click()
  return page.getByRole('menu', { name: 'Saved views' })
}

/** Reads a saved view row from SQL. */
async function savedViewRow(backend: Parameters<typeof sqlColumn>[0], label: string) {
  const rows = await backend.sql(`select id, label, table_name, user_id, view_json from saved_view where label = '${label.replace(/'/g, "''")}'`)
  const row = rows[0]
  if (!row) return undefined
  return { id: String(row.id), label: row.label, table_name: row.table_name, user_id: row.user_id, view: JSON.parse(String(row.view_json)) }
}

test('[QRY-050] your saved views are listed and open on their own route @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const seed = await savedViewRow(backend, ALICE_VIEW)
  expect(seed?.user_id).toBe('sample:alice')
  await open(page, '/app/person')
  await expectColumn(page, 'firstName', await sqlColumn(backend, 'select first_name from person order by id desc'))
  const menu = await openViews(page)
  await expect(menu.getByRole('group', { name: 'Your Saved Views' }).getByRole('menuitem')).toHaveText([ALICE_VIEW])
  await expect(menu.getByRole('group', { name: 'Views Shared with you' })).toHaveText('You do not have any views shared with you for this table.')
  await menu.getByRole('menuitem', { name: ALICE_VIEW }).click()
  await expect(page).toHaveURL(new RegExp(`/app/person/savedView/${seed!.id}/?`))
  await expectColumn(page, 'firstName', await sqlColumn(backend, "select first_name from person where first_name = 'Avery' order by id desc"))
  await expect(page.locator('[data-qqq-id="button-saved-views"]')).toContainText(ALICE_VIEW)
  await expect(page.locator('[data-qqq-id="saved-view-unsaved"]')).toHaveCount(0)
  // Direct link and reload
  await page.reload()
  await expectColumn(page, 'firstName', ['Avery'])
  await open(page, `/app/person/savedView/${seed!.id}`)
  await expectColumn(page, 'firstName', ['Avery'])
  // New View returns to the table's default view
  await (await openViews(page)).getByRole('menuitem', { name: 'New View' }).click()
  await expect(page).toHaveURL(/\/app\/person\/?$/)
  await expectColumn(page, 'firstName', await sqlColumn(backend, 'select first_name from person order by id desc'))
})

test('[QRY-051] saving a new view stores the filter, sort, columns and page size @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/person')
  await openFilter(page)
  const row = await addCondition(page, 'Last Name', 'contains')
  await row.getByLabel('Filter value for Last Name').fill('Sam')
  await closeFilterSheet(page)
  await showTable(page)
  await grid(page, 'Person').getByRole('button', { name: 'Sort by First Name', exact: true }).click()
  await page.getByRole('button', { name: 'Configure columns' }).click()
  await page.getByRole('dialog', { name: 'Configure columns' }).getByRole('button', { name: 'Hide column Email' }).click()
  await page.keyboard.press('Escape')
  await page.getByLabel('Rows per page').selectOption('10')
  await expect(page.locator('[data-qqq-id="saved-view-unsaved"]')).toContainText('Unsaved Changes')
  await page.getByRole('button', { name: 'Save View As...' }).click()
  const dialog = page.getByRole('dialog', { name: 'Save View As' })
  await dialog.getByLabel('Enter a name for this view').fill('Sample People')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toHaveCount(0)
  const stored = await savedViewRow(backend, 'Sample People')
  expect(stored).toMatchObject({ table_name: 'person', user_id: 'sample:alice' })
  await expect(page).toHaveURL(new RegExp(`/app/person/savedView/${stored!.id}/?`))
  expect(stored!.view.queryFilter.criteria).toEqual([{ fieldName: 'lastName', operator: 'CONTAINS', values: ['Sam'] }])
  expect(stored!.view.queryFilter.orderBys).toEqual([{ fieldName: 'firstName', isAscending: true }])
  expect(stored!.view.rowsPerPage).toBe(10)
  const email = stored!.view.queryColumns.columns.find((c: { name: string }) => c.name === 'email')
  expect(email.isVisible).toBe(false)
  // Reopening the stored view from a fresh start restores it
  await open(page, '/app/person')
  await (await openViews(page)).getByRole('menuitem', { name: 'Sample People' }).click()
  await expectColumn(page, 'firstName', await sqlColumn(backend, "select first_name from person where last_name like '%Sam%' order by first_name asc limit 10"))
  await expect(grid(page, 'Person').getByRole('button', { name: 'Sort by Email' })).toHaveCount(0)
  await expect(page.getByLabel('Rows per page')).toHaveValue('10')
})

test('[QRY-052] update, rename and delete your view @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const seed = await savedViewRow(backend, ALICE_VIEW)
  await open(page, `/app/person/savedView/${seed!.id}`)
  await expectColumn(page, 'firstName', ['Avery'])
  // Change the filter: the view reports an unsaved change until saved
  await openFilter(page)
  await page.locator('[data-qqq-id="filter-row-0-0"]').getByLabel('Filter operator').selectOption({ label: 'starts with' })
  await page.locator('[data-qqq-id="filter-row-0-0"]').getByLabel('Filter value for First Name').fill('B')
  await expectColumn(page, 'firstName', ['Blair'])
  await closeFilterSheet(page)
  await expect(page.locator('[data-qqq-id="saved-view-unsaved"]')).toContainText('1 Unsaved Change')
  await page.locator('[data-qqq-id="saved-view-save-changes"]').click()
  await page.getByRole('dialog', { name: 'Update Existing View' }).getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('[data-qqq-id="saved-view-unsaved"]')).toHaveCount(0)
  const updated = await savedViewRow(backend, ALICE_VIEW)
  expect(updated!.id).toBe(seed!.id)
  expect(updated!.view.queryFilter.criteria).toEqual([{ fieldName: 'firstName', operator: 'STARTS_WITH', values: ['B'] }])

  // Rename
  await (await openViews(page)).getByRole('menuitem', { name: 'Rename...' }).click()
  const rename = page.getByRole('dialog', { name: 'Rename View' })
  await expect(rename.getByLabel('Enter a new name for this view')).toHaveValue(ALICE_VIEW)
  await rename.getByLabel('Enter a new name for this view').fill('B People')
  await rename.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('[data-qqq-id="button-saved-views"]')).toContainText('B People')
  expect(await sqlColumn(backend, `select label from saved_view where id = ${seed!.id}`)).toEqual(['B People'])

  // Delete
  await (await openViews(page)).getByRole('menuitem', { name: 'Delete...' }).click()
  const confirm = page.getByRole('dialog', { name: 'Delete View' })
  await expect(confirm).toContainText("Are you sure you want to delete the view 'B People'?")
  await confirm.getByRole('button', { name: 'Delete' }).click()
  await expect(page).toHaveURL(/\/app\/person\/?$/)
  expect(await backend.sql(`select id from saved_view where id = ${seed!.id}`)).toEqual([])
  await expect((await openViews(page)).getByRole('group', { name: 'Your Saved Views' })).toHaveText('You do not have any saved views for this table.')
})

test('[QRY-053] duplicate names and unknown views are reported without changes @mobile', async ({ page, backend, diagnostics }) => {
  diagnostics.allow('The requested view was not found.')
  await open(page, '/app/person')
  await openFilter(page)
  const row = await addCondition(page, 'First Name', 'equals')
  await row.getByLabel('Filter value for First Name').fill('Casey')
  await closeFilterSheet(page)
  await page.getByRole('button', { name: 'Save View As...' }).click()
  const dialog = page.getByRole('dialog', { name: 'Save View As' })
  await dialog.getByLabel('Enter a name for this view').fill(ALICE_VIEW)
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('You already have a saved view on this table with this name.')
  expect(await sqlColumn(backend, 'select count(*) from saved_view')).toEqual(['1'])
  await dialog.getByRole('button', { name: 'Cancel' }).click()

  await open(page, '/app/person/savedView/9999')
  await expect(page.locator('[data-qqq-id="saved-view-load-error"]')).toContainText('The requested view was not found.')
})

test.describe('as bob', () => {
  test.use({ user: 'bob' })

  test('[QRY-054] a view shared with you opens read-only and the backend refuses changes @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const seed = await savedViewRow(backend, ALICE_VIEW)
    await open(page, '/app/person')
    await expectColumn(page, 'firstName', await sqlColumn(backend, 'select first_name from person order by id desc'))
    const menu = await openViews(page)
    await expect(menu.getByRole('group', { name: 'Views Shared with you' }).getByRole('menuitem')).toHaveText([ALICE_VIEW])
    await expect(menu.getByRole('group', { name: 'Your Saved Views' })).toHaveText('You do not have any saved views for this table.')
    await menu.getByRole('menuitem', { name: ALICE_VIEW }).click()
    await expectColumn(page, 'firstName', ['Avery'])
    const actions = await openViews(page)
    await expect(actions.getByRole('menuitem', { name: 'Save...' })).toBeDisabled()
    await expect(actions.getByRole('menuitem', { name: 'Rename...' })).toBeDisabled()
    await expect(actions.getByRole('menuitem', { name: 'Delete...' })).toBeDisabled()
    // The backend enforces ownership: an update or delete by bob changes nothing
    const store = await backend.api.post('/qqq/v1/processes/storeSavedView/init', { multipart: { values: JSON.stringify({ id: seed!.id, tableName: 'person', label: 'Hijacked', viewJson: '{}' }) } })
    expect((await store.json()).type).toBe('ERROR')
    const remove = await backend.api.post('/qqq/v1/processes/deleteSavedView/init', { multipart: { values: JSON.stringify({ id: seed!.id }) } })
    expect((await remove.json()).type).toBe('ERROR')
    expect(await sqlColumn(backend, `select label from saved_view where id = ${seed!.id}`)).toEqual([ALICE_VIEW])
    // Save As makes bob's own copy
    await actions.getByRole('menuitem', { name: 'Save As...' }).click()
    const dialog = page.getByRole('dialog', { name: 'Save View As' })
    await dialog.getByLabel('Enter a name for this view').fill('Bob Copy')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toHaveCount(0)
    expect(await backend.sql("select user_id from saved_view where label = 'Bob Copy'")).toEqual([{ user_id: 'sample:bob' }])
  })
})
