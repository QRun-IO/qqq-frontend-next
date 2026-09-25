/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Relationships: possible-value links, declared associations (canonical, aliased, composite),
// related-record navigation, child creation and edits/deletes without stale screens.
import type { Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { columnCells, expectColumn, sqlColumn } from './query-helpers'

/** A visible association panel on a record view. */
function panel(page: Page, association: string) {
  return page.locator(`[data-qqq-id="associated-records-${encodeURIComponent(association)}"]:visible`)
}

/** Names listed in an association panel, in row order. */
async function panelNames(page: Page, association: string, column = 'name') {
  return panel(page, association).locator(`tbody td[data-qqq-id="grid-cell-${column}"]`).allTextContents()
}

test('[REL-001] possible-value cells show the related record label and link to that record', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  const rows = await backend.sql("select i.id as id, i.owner_id as owner, p.first_name || ' ' || p.last_name as label from qry_item i left join person p on p.id = i.owner_id order by i.id desc")
  await expectColumn(page, 'id', rows.map((r) => String(r.id)))
  for (const [index, row] of rows.entries()) {
    const link = columnCells(page, 'ownerId').nth(index).getByRole('link')
    if (row.owner === null) {
      await expect(link).toHaveCount(0)
      continue
    }
    await expect(link).toHaveText(String(row.label))
    await expect(link).toHaveAttribute('href', new RegExp(`/app/person/${row.owner}/?$`))
  }
  // Following the link opens the owner, not the item
  const casey = rows.find((r) => r.label === 'Casey Sample')!
  await columnCells(page, 'ownerId').nth(rows.indexOf(casey)).getByRole('link').click()
  await expect(page).toHaveURL(new RegExp(`/app/person/${casey.owner}/?$`))
  await expect(page.getByText('casey@example.invalid').first()).toBeVisible()
})

test('[REL-002] a parent lists exactly its own children, with View All opening the filtered child list', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/person/1?tab=related')
  const pets = await sqlColumn(backend, 'select name from pet where person_id = 1 order by id')
  await expect.poll(() => panelNames(page, 'pets')).toEqual(pets)
  // At most six columns, labelled from metadata
  expect(await panel(page, 'pets').locator('thead th[data-qqq-id^="grid-header-"]').count()).toBeLessThanOrEqual(6)
  await expect(panel(page, 'pets').locator('thead')).toContainText('Name')
  await panel(page, 'pets').getByRole('link', { name: 'View All' }).click()
  await expect(page).toHaveURL(/\/app\/pet\/?\?(.+&)?filter=/)
  const linked = JSON.parse(Buffer.from(new URL(page.url()).searchParams.get('filter') ?? '', 'base64').toString('utf8'))
  expect(linked.criteria).toEqual([{ fieldName: 'personId', operator: 'EQUALS', values: [1] }])
  await expectColumn(page, 'name', await sqlColumn(backend, 'select name from pet where person_id = 1 order by id desc'))
  await page.getByRole('link', { name: /^Back to/ }).click()
  await expect(page).toHaveURL(/\/app\/person\/1/)
  // A parent without children shows an empty (not unavailable) panel
  await open(page, '/app/person/4?tab=related')
  await expect(panel(page, 'pets')).toContainText(/No pets records/)
  await expect(panel(page, 'pets')).not.toContainText('Related records are unavailable.')
})

test('[REL-003] adding a child from its parent links it to that parent and shows it immediately', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const before = await backend.sql('select id, name, person_id, species_id from pet order by id')
  await open(page, '/app/person/2?tab=related')
  await expect.poll(() => panelNames(page, 'pets')).toEqual(await sqlColumn(backend, 'select name from pet where person_id = 2 order by id'))
  await panel(page, 'pets').locator('[data-qqq-id="button-create-association-pets"]').click()
  const dialog = page.locator('[data-qqq-id="dialog-create-association-pets"]')
  await expect(dialog.locator('input[name="personId"]')).toHaveCount(0)
  await dialog.getByRole('textbox', { name: /^Name/ }).fill('Acceptance Pup')
  await dialog.getByRole('combobox', { name: /Species/ }).click()
  await page.getByRole('option', { name: 'Dog', exact: true }).click()
  await dialog.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect.poll(() => panelNames(page, 'pets')).toContain('Acceptance Pup')
  const after = await backend.sql('select id, name, person_id, species_id from pet order by id')
  expect(after).toHaveLength(before.length + 1)
  expect(after.find((p) => p.name === 'Acceptance Pup')).toMatchObject({ person_id: '2', species_id: '1' })
  expect(after.filter((p) => p.name !== 'Acceptance Pup')).toEqual(before)
})

test('[REL-004] three-level associations: each pet shows only its own notes', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/pet/1?tab=related')
  await expect.poll(() => panelNames(page, 'notes', 'note')).toEqual(await sqlColumn(backend, 'select note from pet_note where pet_id = 1 order by id'))
  await open(page, '/app/pet/5?tab=related')
  await expect.poll(() => panelNames(page, 'notes', 'note')).toEqual(await sqlColumn(backend, 'select note from pet_note where pet_id = 5 order by id'))
  await expect(panel(page, 'notes')).not.toContainText('Target note')
})

test('[REL-005] editing and deleting a child leaves no stale parent, list or unexpected rows', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/person/1?tab=related')
  await expect.poll(() => panelNames(page, 'pets')).toEqual(await sqlColumn(backend, 'select name from pet where person_id = 1 order by id'))
  // Visit the pet list first so it is cached
  await open(page, '/app/pet')
  await expect(columnCells(page, 'name').first()).toBeVisible()
  // Edit Coco (pet 2) through the UI
  await open(page, '/app/pet/2/edit')
  const name = page.getByRole('textbox', { name: /^Name/ })
  await expect(name).toHaveValue('Coco')
  await name.fill('Coco Renamed')
  await page.getByRole('button', { name: /^Save/ }).click()
  await expect(page).toHaveURL(/\/app\/pet\/2\/?$/)
  expect(await sqlColumn(backend, 'select name from pet where id = 2')).toEqual(['Coco Renamed'])
  await page.goto('/app/person/1?tab=related')
  await expect.poll(() => panelNames(page, 'pets')).toContain('Coco Renamed')
  await page.goto('/app/pet')
  await expect(columnCells(page, 'name')).toContainText(['Coco Renamed'])

  // Deleting a pet removes its notes (declared association) and nothing else
  const others = await backend.sql('select id, name, person_id from pet where id <> 1 order by id')
  const otherNotes = await backend.sql('select id, note from pet_note where pet_id <> 1 order by id')
  const removed = await backend.api.delete('/data/pet/1')
  expect(removed.status()).toBe(200)
  expect(await backend.sql('select id from pet_note where pet_id = 1')).toEqual([])
  expect(await backend.sql('select id, name, person_id from pet where id <> 1 order by id')).toEqual(others)
  expect(await backend.sql('select id, note from pet_note where pet_id <> 1 order by id')).toEqual(otherNotes)
  await page.goto('/app/person/1?tab=related')
  await expect.poll(() => panelNames(page, 'pets')).toEqual(await sqlColumn(backend, 'select name from pet where person_id = 1 order by id'))
})

test.describe('without pet permissions', () => {
  test.use({ persona: 'noPets' })

  test('[REL-006] denied child reads show an unavailable panel without data or actions', async ({ page, backend, diagnostics }) => {
    // The pet table's metadata is withheld from this persona
    diagnostics.allow('/qqq/v1/metaData/table/pet 404')
    diagnostics.allow('Failed to load resource: the server responded with a status of 404')
    // The record read with associations is refused (the view then loads without them)
    diagnostics.allow('/data/person/1 403')
    diagnostics.allow('Failed to load resource: the server responded with a status of 403')
    await open(page, '/app/person/1?tab=related')
    await expect(panel(page, 'pets')).toContainText(/unavailable/)
    await expect(panel(page, 'pets')).not.toContainText('Charlie')
    await expect(panel(page, 'pets').getByRole('link', { name: 'View All' })).toHaveCount(0)
    await expect(panel(page, 'pets').locator('[data-qqq-id="button-create-association-pets"]')).toHaveCount(0)
    const denied = await backend.api.post('/qqq/v1/table/pet/query', { data: { filter: {} } })
    expect(denied.status()).toBe(403)
    expect(await denied.text()).not.toContain('Charlie')
  })
})

test('[REL-007] aliased and composite associations bind to their widgets and list the right members', async ({ page, backend, diagnostics }) => {
  void diagnostics
  // Maple House: members by id are Ari and Bo; the composite (code, review date) join matches only Bo
  await open(page, '/app/qryHousehold/1?tab=section-companions')
  await expect.poll(() => panelNames(page, 'care group / primary')).toEqual(await sqlColumn(backend, 'select name from qry_member where household_id = 1 order by id'))
  await open(page, '/app/qryHousehold/1?tab=section-reviewSchedule')
  await expect.poll(() => panelNames(page, 'scheduled reviews')).toEqual(await sqlColumn(backend,
    'select m.name from qry_member m join qry_household h on h.code = m.household_code and h.review_date = m.review_date where h.id = 1 order by m.id'))
  // Cedar House: the composite join finds Ari (a Maple member) and Cy
  await open(page, '/app/qryHousehold/2?tab=section-reviewSchedule')
  await expect.poll(() => panelNames(page, 'scheduled reviews')).toEqual(await sqlColumn(backend,
    'select m.name from qry_member m join qry_household h on h.code = m.household_code and h.review_date = m.review_date where h.id = 2 order by m.id'))
  // The canonical association is listed under Related
  await open(page, '/app/qryHousehold/2?tab=related')
  await expect.poll(() => panelNames(page, 'members')).toEqual(await sqlColumn(backend, 'select name from qry_member where household_id = 2 order by id'))
  // A household without members
  await open(page, '/app/qryHousehold/3?tab=related')
  await expect(panel(page, 'members')).toContainText(/No .* records/)
})

test('[REL-008] adding through a composite association stores every join value from the parent', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const before = await backend.sql('select id, name, household_id, household_code, review_date from qry_member order by id')
  await open(page, '/app/qryHousehold/1?tab=section-reviewSchedule')
  await expect.poll(() => panelNames(page, 'scheduled reviews')).toEqual(['Bo'])
  await panel(page, 'scheduled reviews').locator(`[data-qqq-id="button-create-association-${encodeURIComponent('scheduled reviews')}"]`).click()
  const dialog = page.locator(`[data-qqq-id="dialog-create-association-${encodeURIComponent('scheduled reviews')}"]`)
  await expect(dialog.locator('input[name="householdCode"]')).toHaveCount(0)
  await expect(dialog.locator('input[name="reviewDate"]')).toHaveCount(0)
  await dialog.getByRole('textbox', { name: /^Name/ }).fill('Ez')
  await dialog.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect.poll(() => panelNames(page, 'scheduled reviews')).toEqual(['Bo', 'Ez'])
  const after = await backend.sql('select id, name, household_id, household_code, review_date from qry_member order by id')
  expect(after.find((m) => m.name === 'Ez')).toMatchObject({ household_code: 'MH', review_date: '2026-03-01', household_id: null })
  expect(after.filter((m) => m.name !== 'Ez')).toEqual(before)
  // The aliased association of the same join does not gain the unlinked member
  await open(page, '/app/qryHousehold/1?tab=section-companions')
  await expect.poll(() => panelNames(page, 'care group / primary')).toEqual(['Ari', 'Bo'])
})

test('[REL-009] deleting a parent removes its associated children and leaves other parents intact', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const otherPets = await backend.sql('select id, name, person_id from pet where person_id <> 3 order by id')
  const otherNotes = await backend.sql('select id, note from pet_note order by id')
  await open(page, '/app/person/3')
  await expect(page.getByText('casey@example.invalid').first()).toBeVisible()
  const response = await backend.api.delete('/data/person/3')
  expect(response.status()).toBe(200)
  expect(await backend.sql('select id from person where id = 3')).toEqual([])
  expect(await backend.sql('select id from pet where person_id = 3')).toEqual([])
  expect(await backend.sql('select id, name, person_id from pet where person_id <> 3 order by id')).toEqual(otherPets)
  expect(await backend.sql('select id, note from pet_note order by id')).toEqual(otherNotes)
  await open(page, '/app/pet')
  await expectColumn(page, 'name', await sqlColumn(backend, 'select name from pet order by id desc'))
})
