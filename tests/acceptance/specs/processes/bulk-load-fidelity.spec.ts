/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Bulk load fidelity with the Material dashboard (QRun-IO/qqq#726): saved profile management and
// ownership, the file mapping form (header row, repeated headers, column tooltips, key fields,
// help, first-error scrolling), typed default values, searchable value mapping and the grouped
// Add Fields menu.
import type { APIRequestContext, Locator, Page, Request } from '@playwright/test'
import { expect, test } from '../../support/fixtures'
import { expectTouchReady } from '../../support/touch'
import { advance, expectRunTouchReady, expectScreen, openProcess } from './process-helpers'

const PEOPLE_CSV = 'First Name,Last Name,Email,Is Employed\nQuinn,Lab,quinn@example.invalid,Yes\nRiley,Lab,riley@example.invalid,No\n'
const PERSON_TABLE = 'person'

/**
 * Upload a CSV on the bulk upload screen and continue to the file mapping screen.
 * @param page - The page.
 * @param processName - The bulk process.
 * @param csv - File content.
 * @returns The file mapping screen.
 */
async function uploadToMapping(page: Page, processName: string, csv: string): Promise<Locator> {
  await openProcess(page, processName)
  await expectScreen(page, 'upload', 'Upload File')
  await page.locator('input[type="file"]').setInputFiles({ name: 'upload.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await expect(page.getByText('upload.csv')).toBeVisible()
  await advance(page, 'Next')
  return expectScreen(page, 'fileMapping', 'File Mapping')
}

/**
 * The v1 bulk load profile of a person CSV mapped by header (First Name, Last Name, Email).
 * @param extra - More profile fields.
 * @returns Mapping JSON.
 */
function personProfileJson(extra: Record<string, unknown>[] = []): string {
  return JSON.stringify({
    version: 'v1', hasHeaderRow: true, layout: 'FLAT', isBulkEdit: false, keyFields: null,
    fieldList: [
      { fieldName: 'firstName', columnIndex: 0, headerName: 'First Name', doValueMapping: false, clearIfEmpty: false },
      { fieldName: 'lastName', columnIndex: 1, headerName: 'Last Name', doValueMapping: false, clearIfEmpty: false },
      { fieldName: 'email', columnIndex: 2, headerName: 'Email', doValueMapping: false, clearIfEmpty: false },
      ...extra,
    ],
  })
}

/**
 * Store a saved bulk load profile through the backend's store process, as the session user.
 * @param api - Backend request context.
 * @param label - Profile name.
 * @param mappingJson - The v1 profile.
 * @returns The new profile id.
 */
async function storeProfile(api: APIRequestContext, label: string, mappingJson: string): Promise<number> {
  const response = await api.post('/qqq/v1/processes/storeSavedBulkLoadProfile/init', {
    multipart: { values: JSON.stringify({ tableName: PERSON_TABLE, label, isBulkEdit: 'false', mappingJson }), stepTimeoutMillis: '60000' },
  })
  expect(response.status()).toBe(200)
  const body = await response.json()
  return body.values.savedBulkLoadProfileList[0].values.id
}

/**
 * The saved profile controls of a bulk load screen.
 * @param scope - The screen.
 * @returns Locator.
 */
function profileControls(scope: Locator): Locator {
  return scope.locator('[data-qqq-id="saved-bulk-load-profiles"]')
}

/**
 * Open the saved profile menu.
 * @param scope - The screen.
 * @returns The menu.
 */
async function openProfileMenu(scope: Locator): Promise<Locator> {
  await profileControls(scope).getByRole('button', { name: 'Saved Bulk Load Profiles' }).click()
  const menu = scope.page().getByRole('menu', { name: 'Saved bulk load profiles' })
  await expect(menu).toBeVisible()
  return menu
}

/**
 * Open a hover/tap tooltip by tapping (or clicking) its trigger and return the tooltip.
 * @param page - The page.
 * @param trigger - Element inside the tooltip trigger.
 * @param qqqId - The tooltip's data-qqq-id.
 * @returns The visible tooltip.
 */
async function openTooltip(page: Page, trigger: Locator, qqqId: string): Promise<Locator> {
  await trigger.click()
  const tooltip = page.locator(`[data-qqq-id="${qqqId}"]`)
  await expect(tooltip).toBeVisible()
  return tooltip
}

/**
 * Close an open tooltip by tapping (or clicking) elsewhere, as a phone user does.
 * @param page - The page.
 * @param tooltip - The open tooltip.
 */
async function closeTooltip(page: Page, tooltip: Locator) {
  await page.locator('[data-qqq-id="process-step-heading"]').click()
  await expect(tooltip).toBeHidden()
}

/**
 * The `values` JSON of a v1 process step request.
 * @param request - The request.
 * @returns The screen values.
 */
function stepValues(request: Request): Record<string, string> {
  return JSON.parse(/name="values"\r\n\r\n([^\r]*)/.exec(request.postData() ?? '')?.[1] ?? '{}') as Record<string, string>
}

test.describe('Saved bulk load profiles', () => {
  test('[PRC-058] profile menus fit the viewport and support keyboard navigation and editor focus return @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    for (let index = 1; index <= 8; index++) await storeProfile(backend.api, `Review Profile ${index}`, personProfileJson())
    const mapping = await uploadToMapping(page, 'person.bulkInsert', PEOPLE_CSV)
    const controls = profileControls(mapping)
    const trigger = controls.getByRole('button', { name: 'Saved Bulk Load Profiles', exact: true })
    await trigger.focus()
    await page.keyboard.press('ArrowDown')
    const menu = page.getByRole('menu', { name: 'Saved bulk load profiles', exact: true })
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Review Profile 8', exact: true })).toBeAttached()
    const bounds = await menu.boundingBox()
    const viewport = page.viewportSize()!
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height)
    await expect(menu.getByRole('menuitem', { name: 'Save As...', exact: true })).toBeFocused()
    await page.keyboard.press('End')
    await expect(menu.getByRole('menuitem', { name: 'Review Profile 8', exact: true })).toBeFocused()
    await page.keyboard.press('Home')
    await expect(menu.getByRole('menuitem', { name: 'Save As...', exact: true })).toBeFocused()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('group', { name: 'Save New Bulk Load Profile', exact: true })
    await expect(dialog.getByPlaceholder('Bulk Load Profile Name')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()

    const saveNew = controls.getByRole('button', { name: 'Save Bulk Load Profile As…', exact: true })
    await saveNew.click()
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(saveNew).toBeFocused()
  })

  test('[PRC-058] saved profile actions: a new profile named with Enter, update after the confirm, rename, save as a copy and delete only with the button @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const mapping = await uploadToMapping(page, 'person.bulkInsert', PEOPLE_CSV)
    const controls = profileControls(mapping)
    await expect(controls.getByRole('button', { name: 'Saved Bulk Load Profiles' })).toHaveAttribute('data-profile-state', 'none')

    // a new profile: its inline name editor saves without submitting the mapping step
    await controls.getByRole('button', { name: 'Save Bulk Load Profile As…' }).click()
    let dialog = page.getByRole('group', { name: 'Save New Bulk Load Profile' })
    await expect(controls.getByRole('group', { name: 'Save New Bulk Load Profile' })).toBeVisible()
    await expect(dialog.getByLabel('Profile Name', { exact: true })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expectTouchReady(page, dialog)
    await dialog.getByPlaceholder('Bulk Load Profile Name').fill('Lab People CSV')
    await dialog.getByPlaceholder('Bulk Load Profile Name').press('Enter')
    await expect(dialog).toBeHidden()
    await expect(controls.locator('[data-qqq-id="saved-bulk-load-profile-message"]')).toHaveText('Profile Saved.')
    await expect(page.locator('[data-qqq-id="process-step-heading"]')).toHaveText('File Mapping / Lab People CSV')
    const [created] = await backend.sql('select id, label, user_id from saved_bulk_load_profile')
    expect(created).toMatchObject({ label: 'Lab People CSV', user_id: 'sample:alice' })

    // a change is counted and listed; saving it asks to update the existing profile, and Enter confirms
    await mapping.locator('[data-qqq-id="checkbox-bulk-load-map-values-isEmployed"]').check()
    await expect(controls.getByRole('button', { name: 'Saved Bulk Load Profiles' })).toHaveAttribute('data-profile-state', 'modified')
    const count = controls.locator('[data-qqq-id="saved-bulk-load-profile-change-count"]')
    await expect(count).toHaveText('1 Unsaved Change')
    const changes = await openTooltip(page, count, 'saved-bulk-load-profile-changes')
    await expect(changes).toHaveText('Unsaved ChangesChanged Is Employed to map values')
    await expectRunTouchReady(page, 'person.bulkInsert')
    await closeTooltip(page, changes)
    await controls.getByRole('button', { name: 'Save…' }).click()
    dialog = page.getByRole('dialog', { name: 'Update Existing Bulk Load Profile' })
    await expect(dialog).toContainText("Are you sure you want to update the bulk load profile 'Lab People CSV'?")
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
    await expect(count).toBeHidden()
    const [updated] = await backend.sql('select id, label, mapping_json from saved_bulk_load_profile')
    expect(updated.id).toBe(created.id)
    expect(JSON.parse(updated.mapping_json!).fieldList).toContainEqual(expect.objectContaining({ fieldName: 'isEmployed', columnIndex: 3, doValueMapping: true }))

    // rename keeps the profile (same id) under a new name
    let menu = await openProfileMenu(mapping)
    await menu.getByRole('menuitem', { name: 'Rename...' }).click()
    dialog = page.getByRole('group', { name: 'Rename Bulk Load Profile' })
    const name = dialog.getByPlaceholder('Bulk Load Profile Name')
    await expect(name).toHaveValue('Lab People CSV')
    await name.fill('Lab People Renamed')
    await name.press('Enter')
    await expect(page.locator('[data-qqq-id="process-step-heading"]')).toHaveText('File Mapping / Lab People Renamed')
    expect(await backend.sql('select id, label from saved_bulk_load_profile')).toEqual([{ id: created.id, label: 'Lab People Renamed' }])

    // save as makes a separate copy, which is then in use
    menu = await openProfileMenu(mapping)
    await expectTouchReady(page, menu)
    await menu.getByRole('menuitem', { name: 'Save As...' }).click()
    dialog = page.getByRole('group', { name: 'Save Bulk Load Profile As' })
    await dialog.getByPlaceholder('Bulk Load Profile Name').fill('Lab People Copy')
    await dialog.getByRole('button', { name: 'Save Profile' }).click()
    await expect(page.locator('[data-qqq-id="process-step-heading"]')).toHaveText('File Mapping / Lab People Copy')
    expect(await backend.sql('select label, user_id from saved_bulk_load_profile order by id')).toEqual([
      { label: 'Lab People Renamed', user_id: 'sample:alice' }, { label: 'Lab People Copy', user_id: 'sample:alice' },
    ])

    // Enter does not delete: only the Delete button does, and the screen starts a new (empty) mapping
    menu = await openProfileMenu(mapping)
    await menu.getByRole('menuitem', { name: 'Delete...' }).click()
    dialog = page.getByRole('dialog', { name: 'Delete Bulk Load Profile' })
    await expect(dialog).toContainText("Are you sure you want to delete the bulk load profile 'Lab People Copy'?")
    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
    expect(await backend.sql('select count(*) as n from saved_bulk_load_profile')).toEqual([{ n: '2' }])
    menu = await openProfileMenu(mapping)
    await menu.getByRole('menuitem', { name: 'Delete...' }).click()
    await page.getByRole('dialog', { name: 'Delete Bulk Load Profile' }).getByRole('button', { name: 'Delete' }).click()
    await expect(controls.locator('[data-qqq-id="saved-bulk-load-profile-message"]')).toHaveText('Profile Deleted.')
    await expect(page.locator('[data-qqq-id="process-step-heading"]')).toHaveText('File Mapping')
    await expect(mapping.getByLabel('Column for First Name')).toHaveValue('')
    expect(await backend.sql('select label from saved_bulk_load_profile')).toEqual([{ label: 'Lab People Renamed' }])
  })

  test('[PRC-058] unsaved changes are listed and reset, and the mapping resets to empty or suggested @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await storeProfile(backend.api, 'Team People CSV', personProfileJson([{ fieldName: 'isEmployed', columnIndex: 3, headerName: 'Is Employed', doValueMapping: true, clearIfEmpty: false }]))
    const mapping = await uploadToMapping(page, 'person.bulkInsert', PEOPLE_CSV)
    let menu = await openProfileMenu(mapping)
    await expect(menu.getByRole('group', { name: 'Bulk Load Profiles Shared with you' })).toContainText('You do not have any bulk load profiles shared with you for this table.')
    await menu.getByRole('group', { name: 'Your Saved Bulk Load Profiles' }).getByRole('menuitem', { name: 'Team People CSV' }).click()
    await expect(page.locator('[data-qqq-id="process-step-heading"]')).toHaveText('File Mapping / Team People CSV')
    const controls = profileControls(mapping)
    await expect(controls.getByRole('button', { name: 'Saved Bulk Load Profiles' })).toHaveAttribute('data-profile-state', 'saved')
    await expect(mapping.locator('[data-qqq-id="checkbox-bulk-load-map-values-isEmployed"]')).toBeChecked()

    await mapping.getByLabel('Column for Email').selectOption('')
    await mapping.getByLabel('Does the file have a header row? *').uncheck()
    const count = controls.locator('[data-qqq-id="saved-bulk-load-profile-change-count"]')
    await expect(count).toHaveText('2 Unsaved Changes')
    const changes = await openTooltip(page, count, 'saved-bulk-load-profile-changes')
    await expect(changes.locator('li')).toHaveText([
      'Changed does the file have a header row? from Yes to No',
      'Changed Email file column from (Column C) to --',
    ])
    await expectRunTouchReady(page, 'person.bulkInsert')
    await closeTooltip(page, changes)
    await controls.getByRole('button', { name: 'Reset All Changes' }).click()
    await expect(count).toBeHidden()
    await expect(mapping.getByLabel('Column for Email')).toHaveValue('2')
    await expect(mapping.getByLabel('Does the file have a header row? *')).toBeChecked()

    // New Bulk Load Profile leaves the saved profile for an empty mapping
    menu = await openProfileMenu(mapping)
    await menu.getByRole('menuitem', { name: 'New Bulk Load Profile' }).click()
    await expect(page.locator('[data-qqq-id="process-step-heading"]')).toHaveText('File Mapping')
    await expect(mapping.getByLabel('Column for Email')).toHaveValue('')
    await expect(mapping.locator('[data-qqq-id="bulk-load-field-isEmployed"]')).toHaveCount(0)

    // without a profile: reset to the suggested mapping, or to an empty one
    await controls.getByRole('button', { name: 'Suggested Mapping' }).click()
    await expect(mapping.getByLabel('Column for First Name')).toHaveValue('0')
    await expect(mapping.getByLabel('Column for Email')).toHaveValue('2')
    await controls.getByRole('button', { name: 'Empty Mapping' }).click()
    await expect(mapping.getByLabel('Column for First Name')).toHaveValue('')
    await controls.getByRole('button', { name: 'Suggested Mapping' }).click()
    await advance(page, 'Next')
    const review = await expectScreen(page, 'review', 'Review')
    await expect(review.locator('[data-qqq-id="bulk-load-profile-name"]')).toHaveText('You are not using a saved bulk load profile.')
    await expect(review.locator('[data-qqq-id="bulk-load-profile-fields"]')).toContainText('Email from Email')
    expect(await backend.sql('select label from saved_bulk_load_profile')).toEqual([{ label: 'Team People CSV' }])
  })

  test('[PRC-059] a profile another user shares is listed as shared, and only its owner may save, rename or delete it @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await backend.setPersona('admin', 'bob')
    const bobsId = await storeProfile(backend.api, 'Bob Team CSV', personProfileJson())
    const share = await backend.api.post('/data/sharedSavedBulkLoadProfile', { multipart: { savedBulkLoadProfileId: String(bobsId), userId: 'sample:alice', scope: 'READ_ONLY' } })
    expect(share.status()).toBe(200)
    await backend.setPersona('admin', 'alice')
    await storeProfile(backend.api, 'Alice CSV', personProfileJson())
    const bobsRow = await backend.sql(`select label, user_id, mapping_json from saved_bulk_load_profile where id = ${bobsId}`)
    expect(bobsRow).toEqual([{ label: 'Bob Team CSV', user_id: 'sample:bob', mapping_json: expect.any(String) }])

    // the server lists both, with their owners; the menu splits them by owner
    const listed = await backend.api.post('/qqq/v1/processes/querySavedBulkLoadProfile/init', { multipart: { values: JSON.stringify({ tableName: PERSON_TABLE, isBulkEdit: 'false' }) } })
    expect((await listed.json()).values.savedBulkLoadProfileList.map((record: { values: { label: string; userId: string } }) => [record.values.label, record.values.userId]))
      .toEqual([['Alice CSV', 'sample:alice'], ['Bob Team CSV', 'sample:bob']])
    const profileRequests: string[] = []
    page.on('request', (request) => {
      if (/\/processes\/(storeSavedBulkLoadProfile|deleteSavedBulkLoadProfile)\/init/.test(request.url())) profileRequests.push(`${new URL(request.url()).pathname} ${request.postData() ?? ''}`)
    })
    const mapping = await uploadToMapping(page, 'person.bulkInsert', PEOPLE_CSV)
    let menu = await openProfileMenu(mapping)
    await expect(menu.getByRole('group', { name: 'Your Saved Bulk Load Profiles' }).getByRole('menuitem')).toHaveText(['Alice CSV'])
    await expect(menu.getByRole('group', { name: 'Bulk Load Profiles Shared with you' }).getByRole('menuitem')).toHaveText(['Bob Team CSV'])
    await menu.getByRole('menuitem', { name: 'Bob Team CSV' }).click()
    await expect(page.locator('[data-qqq-id="process-step-heading"]')).toHaveText('File Mapping / Bob Team CSV')

    // the owner-only actions are disabled with the reason; Save As (a copy) is not
    menu = await openProfileMenu(mapping)
    for (const action of ['Save...', 'Rename...', 'Delete...']) {
      const item = menu.getByRole('menuitem', { name: action })
      await expect(item).toBeDisabled()
      await expect(item).toHaveAttribute('title', 'You may not save changes to this bulk load profile, because you are not its owner.')
    }
    await expect(menu.getByRole('menuitem', { name: 'Save As...' })).toBeEnabled()
    await expectTouchReady(page, menu)
    await profileControls(mapping).getByRole('button', { name: 'Saved Bulk Load Profiles' }).click()

    // a change is counted, but there is no Save for a profile the user does not own
    await mapping.locator('[data-qqq-id="checkbox-bulk-load-map-values-firstName"]').check()
    const count = profileControls(mapping).locator('[data-qqq-id="saved-bulk-load-profile-change-count"]')
    await expect(count).toHaveText('1 Unsaved Change')
    await expect(profileControls(mapping).getByRole('button', { name: 'Save…' })).toHaveCount(0)
    const changes = await openTooltip(page, count, 'saved-bulk-load-profile-changes')
    await expect(changes).toContainText('You may not save changes to this bulk load profile, because you are not its owner.')
    await expectRunTouchReady(page, 'person.bulkInsert')
    await closeTooltip(page, changes)

    // the user saves their own copy instead
    menu = await openProfileMenu(mapping)
    await menu.getByRole('menuitem', { name: 'Save As...' }).click()
    const dialog = page.getByRole('group', { name: 'Save Bulk Load Profile As' })
    await dialog.getByPlaceholder('Bulk Load Profile Name').fill('Alice Copy of Bob')
    await dialog.getByPlaceholder('Bulk Load Profile Name').press('Enter')
    await expect(page.locator('[data-qqq-id="process-step-heading"]')).toHaveText('File Mapping / Alice Copy of Bob')
    expect(await backend.sql('select label, user_id from saved_bulk_load_profile order by id')).toEqual([
      { label: 'Bob Team CSV', user_id: 'sample:bob' }, { label: 'Alice CSV', user_id: 'sample:alice' }, { label: 'Alice Copy of Bob', user_id: 'sample:alice' },
    ])
    // the owner's profile is untouched, and no request tried to change or delete it
    expect(await backend.sql(`select label, user_id, mapping_json from saved_bulk_load_profile where id = ${bobsId}`)).toEqual(bobsRow)
    expect(profileRequests).toHaveLength(1)
    expect(profileRequests[0]).toContain('/qqq/v1/processes/storeSavedBulkLoadProfile/init')
    expect(profileRequests[0]).toContain('Alice Copy of Bob')
    expect(profileRequests[0]).not.toContain(`"id":"${bobsId}"`)
  })
})

test.describe('Bulk load file mapping form', () => {
  // the Note header repeats; nothing is mapped to it in the end (the backend reads a repeated header's last column, see #726)
  const DUPLICATE_CSV = 'First Name,Last Name,Email,Note,Note\nQuinn,Lab,quinn@example.invalid,first,second\nRiley,Lab,riley@example.invalid,first,second\n'

  test('[PRC-060] help, column tooltips, repeated headers, the header-row toggle re-mapping by header name, and scrolling to the first error @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const steps: Request[] = []
    page.on('request', (request) => { if (request.url().includes('/step/fileMapping')) steps.push(request) })
    const mapping = await uploadToMapping(page, 'person.bulkInsert', DUPLICATE_CSV)

    // per-field help from the step's field metadata (help content keys process:person.bulkInsert;field:*)
    await expect(mapping.locator('[data-qqq-id="bulk-load-help-hasHeaderRow"]')).toHaveText('Uncheck this box when the first row of the file holds data instead of column headers.')
    await expect(mapping.getByLabel('Does the file have a header row? *')).toHaveAccessibleDescription('Uncheck this box when the first row of the file holds data instead of column headers.')
    await expect(mapping.locator('[data-qqq-id="bulk-load-help-layout"]')).toHaveText('Flat files hold one person per row.')

    // mapped columns name their fields; the repeated Note header is flagged and offered once
    const preview = mapping.getByRole('table', { name: 'File preview' })
    const columnA = await openTooltip(page, preview.locator('[data-qqq-id="bulk-load-preview-column-A"] [data-tooltip-trigger]'), 'bulk-load-column-tooltip-A')
    await expect(columnA).toHaveText('This column is mapped to the field:First Name')
    await closeTooltip(page, columnA)
    await expect(preview.locator('[data-qqq-id="bulk-load-duplicate-header-D"]')).toHaveCount(0)
    const duplicate = await openTooltip(page, preview.locator('[data-qqq-id="bulk-load-preview-column-E"] [data-tooltip-trigger]'), 'bulk-load-duplicate-header-E')
    await expect(duplicate).toHaveText('This column header is a duplicate. Only the first occurrence of it will be used.')
    await closeTooltip(page, duplicate)
    await expect(mapping.getByLabel('Column for Email').locator('option')).toHaveText(['Select a column', 'First Name', 'Last Name', 'Email', 'Note'])
    await expectRunTouchReady(page, 'person.bulkInsert')

    // without a header row columns are letters; a mapping to the repeated header is cleared (with a warning) when headers come back
    await mapping.getByLabel('Does the file have a header row? *').uncheck()
    await expect(mapping.getByLabel('Column for Email').locator('option')).toHaveText(['Select a column', 'Column A', 'Column B', 'Column C', 'Column D', 'Column E'])
    await expect(preview.locator('[data-qqq-id="bulk-load-duplicate-header-E"]')).toHaveCount(0)
    await mapping.getByLabel('Column for Email').selectOption({ label: 'Column E' })
    await mapping.getByLabel('Does the file have a header row? *').check()
    await expect(mapping.getByLabel('Column for Email')).toHaveValue('')
    await expect(mapping.locator('[data-qqq-id="bulk-load-field-warning-email"]')).toHaveText('This field was assigned to a column with a duplicated header')
    await mapping.getByLabel('Column for Email').selectOption({ label: 'Email' })

    // the first error is brought into view when the mapping cannot be submitted
    await mapping.getByRole('button', { name: 'Add Fields' }).click()
    const fieldList = mapping.getByRole('listbox', { name: 'Fields to add' })
    for (const label of ['Annual Salary', 'Birth Date', 'Days Worked', 'Is Employed']) await fieldList.getByRole('option', { name: label }).click()
    await page.keyboard.press('Escape')
    await mapping.getByLabel('Column for First Name').selectOption('')
    await page.locator('[data-qqq-id="button-next"]').scrollIntoViewIfNeeded()
    await expect(mapping.locator('[data-qqq-id="bulk-load-field-firstName"]')).not.toBeInViewport()
    await advance(page, 'Next')
    const firstError = mapping.locator('[data-qqq-id="bulk-load-field-firstName"]').getByRole('alert')
    await expect(firstError).toHaveText('You must select a column.')
    await expect(firstError).toBeInViewport()
    expect(steps).toHaveLength(0)
    for (const name of ['annualSalary', 'birthDate', 'daysWorked', 'isEmployed']) await mapping.locator(`[data-qqq-id="button-remove-bulk-load-field-${name}"]`).click()

    // turning the header row off and on again maps by header name, and the mapped columns are read
    await mapping.getByLabel('Column for First Name').selectOption({ label: 'First Name' })
    await mapping.getByLabel('Does the file have a header row? *').uncheck()
    await mapping.getByLabel('Does the file have a header row? *').check()
    await advance(page, 'Next')
    const review = await expectScreen(page, 'review', 'Review')
    const sent = stepValues(steps[0])
    expect(sent.hasHeaderRow).toBe('true')
    const sentFields = (JSON.parse(sent.fieldListJSON) as Array<{ fieldName: string }>).sort((a, b) => a.fieldName.localeCompare(b.fieldName))
    expect(sentFields).toEqual([
      { fieldName: 'email', columnIndex: 2, headerName: 'Email', doValueMapping: false, clearIfEmpty: false },
      { fieldName: 'firstName', columnIndex: 0, headerName: 'First Name', doValueMapping: false, clearIfEmpty: false },
      { fieldName: 'lastName', columnIndex: 1, headerName: 'Last Name', doValueMapping: false, clearIfEmpty: false },
    ])
    await review.getByRole('radio', { name: /Skip Validation/ }).check()
    await advance(page, 'Submit')
    await expectScreen(page, 'result', 'Result')
    expect(await backend.sql('select first_name, email from person where id > 5 order by id')).toEqual([
      { first_name: 'Quinn', email: 'quinn@example.invalid' }, { first_name: 'Riley', email: 'riley@example.invalid' },
    ])
  })

  test('[PRC-060] bulk edit: Key Fields and Fields To Update, key field help and the unmapped key field error @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const mapping = await uploadToMapping(page, 'person.bulkEditWithFile', 'Record,Days Worked\n1,11\n3,33\n')
    const keys = mapping.getByRole('region', { name: 'Key Fields' })
    await expect(keys.getByRole('heading', { name: 'Key Fields' })).toBeVisible()
    await expect(keys.locator('[data-qqq-id="bulk-load-required-fields-empty"]')).toHaveText('Select table key fields to continue.')
    const updates = mapping.getByRole('region', { name: 'Fields To Update' })
    await expect(updates.getByRole('heading', { name: 'Fields To Update' })).toBeVisible()
    await expect(updates.getByLabel('Column for Days Worked')).toHaveValue('1')
    await expect(updates.locator('[data-qqq-id="checkbox-bulk-load-clear-if-empty-daysWorked"]')).toBeVisible()
    const keySelect = mapping.locator('[data-qqq-id="select-bulk-load-key-fields"]')
    await expect(mapping.locator('[data-qqq-id="bulk-load-help-tableKeyFields"]')).toHaveText('The key fields find the person each row of the file updates.')
    await expect(keySelect).toHaveAccessibleDescription('The key fields find the person each row of the file updates.')

    await keySelect.selectOption('id')
    await expect(mapping.locator('[data-qqq-id="bulk-load-key-fields-error"]')).toHaveText('The following key fields are not mapped: Id')
    await expect(keys.getByLabel('Column for Id')).toHaveValue('')
    await expect(keys.locator('[data-qqq-id="checkbox-bulk-load-clear-if-empty-id"]')).toHaveCount(0)
    await expectRunTouchReady(page, 'person.bulkEditWithFile')
    await advance(page, 'Next')
    await expect(keys.locator('[data-qqq-id="bulk-load-field-id"]').getByRole('alert')).toHaveText('You must select a column.')
    await keys.getByLabel('Column for Id').selectOption({ label: 'Record' })
    await expect(mapping.locator('[data-qqq-id="bulk-load-key-fields-error"]')).toHaveCount(0)
    await advance(page, 'Next')
    const review = await expectScreen(page, 'review', 'Review')
    await review.getByRole('radio', { name: /Skip Validation/ }).check()
    await advance(page, 'Submit')
    await expectScreen(page, 'result', 'Result')
    expect(await backend.sql('select id, days_worked from person where id in (1, 2, 3) order by id')).toEqual([
      { id: '1', days_worked: '11' }, { id: '2', days_worked: '10100' }, { id: '3', days_worked: '33' },
    ])
  })
})

test.describe('Typed values and the Add Fields menu', () => {
  test('[PRC-061] pets load with a searchable possible-value default, a date default, mapped species and repeated WIDE notes from the grouped Add Fields menu @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const mapping = await uploadToMapping(page, 'pet.bulkInsert', 'Name,Species,Note A,Note B\nRex,Doggo,Good boy,Likes walks\nTom,Kitty,Sleepy,Hungry\n')
    await mapping.locator('[data-qqq-id="select-bulk-load-layout"]').selectOption('WIDE')

    // Person: a default value chosen by searching the person possible values
    const person = mapping.locator('[data-qqq-id="bulk-load-field-personId"]')
    await person.getByRole('radio', { name: 'Default value' }).check()
    await person.getByRole('combobox', { name: 'Default value for Person' }).click()
    await page.getByRole('textbox', { name: 'Search Default value for Person options' }).fill('Cas')
    await page.getByRole('option', { name: 'Casey Sample', exact: true }).click()
    await expect(person.getByRole('combobox', { name: 'Default value for Person' })).toHaveText('Casey Sample')
    await mapping.locator('[data-qqq-id="checkbox-bulk-load-map-values-speciesId"]').check()

    // the Add Fields menu groups the pet's fields and its notes, searches, and repeats notes in a WIDE layout
    await mapping.getByRole('button', { name: 'Add Fields' }).click()
    const fieldList = mapping.getByRole('listbox', { name: 'Fields to add' })
    await expect(fieldList.getByRole('group')).toHaveCount(2)
    await expect(fieldList.getByRole('group', { name: 'Pet', exact: true }).getByRole('option')).toHaveText(['Birth Date', 'Name', 'Person', 'Species'])
    await expect(fieldList.getByRole('option', { name: 'Name', exact: true })).toHaveAttribute('aria-disabled', 'true')
    await expect(fieldList.getByRole('option', { name: 'Name', exact: true })).toHaveAttribute('title', 'This field has already been added to your mapping.')
    await expect(fieldList.getByRole('option', { name: 'Birth Date' })).toHaveAttribute('title', 'Click to add this field to your mapping.')
    const notes = fieldList.getByRole('group', { name: 'Pet Note' })
    await expect(notes.getByRole('option', { name: 'Note' })).toHaveAttribute('title', 'Click to add this field to your mapping as many times as you need.')
    await expectTouchReady(page, mapping.locator('[data-qqq-id="bulk-load-add-fields-menu"]'))
    await notes.getByRole('option', { name: 'Note' }).click()
    await notes.getByRole('option', { name: 'Note' }).click()
    await mapping.getByRole('combobox', { name: 'Search fields' }).fill('birth')
    await expect(fieldList.getByRole('option')).toHaveText(['Birth Date'])
    await mapping.getByRole('combobox', { name: 'Search fields' }).press('Enter')
    await expect(fieldList.getByRole('option', { name: 'Birth Date' })).toHaveAttribute('aria-disabled', 'true')
    await page.keyboard.press('Escape')
    await expect(fieldList).toBeHidden()

    await mapping.getByLabel('Column for Pet Note: Note (1)').selectOption({ label: 'Note A' })
    await mapping.getByLabel('Column for Pet Note: Note (2)').selectOption({ label: 'Note B' })
    const birth = mapping.locator('[data-qqq-id="bulk-load-field-birthDate"]')
    await birth.getByRole('radio', { name: 'Default value' }).check()
    await expect(birth.getByLabel('Default value for Birth Date')).toHaveAttribute('type', 'date')
    await birth.getByLabel('Default value for Birth Date').fill('2020-05-01')
    await expectRunTouchReady(page, 'pet.bulkInsert')
    await advance(page, 'Next')

    // value mapping searches the species possible values
    const values = await expectScreen(page, 'valueMapping', 'Value Mapping: Species (1 of 1)')
    await values.getByRole('combobox', { name: 'Species value for Doggo' }).click()
    await page.getByRole('textbox', { name: 'Search Species value for Doggo options' }).fill('Do')
    await page.getByRole('option', { name: 'Dog', exact: true }).click()
    await values.getByRole('combobox', { name: 'Species value for Kitty' }).click()
    await page.getByRole('textbox', { name: 'Search Species value for Kitty options' }).fill('Ca')
    await page.getByRole('option', { name: 'Cat', exact: true }).click()
    await expectRunTouchReady(page, 'pet.bulkInsert')
    await advance(page, 'Next')

    const review = await expectScreen(page, 'review', 'Review')
    await expect(review.locator('[data-qqq-id="bulk-load-profile-fields"]')).toContainText('Person = 3')
    await review.getByRole('radio', { name: /Skip Validation/ }).check()
    await advance(page, 'Submit')
    await expectScreen(page, 'result', 'Result')
    expect(await backend.sql('select name, person_id, species_id, birth_date from pet where id > 6 order by id')).toEqual([
      { name: 'Rex', person_id: '3', species_id: '1', birth_date: '2020-05-01' },
      { name: 'Tom', person_id: '3', species_id: '2', birth_date: '2020-05-01' },
    ])
    expect(await backend.sql('select p.name, n.note from pet_note n join pet p on p.id = n.pet_id where p.id > 6 order by n.id')).toEqual([
      { name: 'Rex', note: 'Good boy' }, { name: 'Rex', note: 'Likes walks' }, { name: 'Tom', note: 'Sleepy' }, { name: 'Tom', note: 'Hungry' },
    ])
  })

  test('[PRC-061] people load with a yes/no default value @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const steps: string[] = []
    page.on('request', (request) => { if (request.url().includes('/step/fileMapping')) steps.push(request.url()) })
    const mapping = await uploadToMapping(page, 'person.bulkInsert', 'First Name,Last Name,Email\nQuinn,Lab,quinn@example.invalid\n')
    await mapping.getByRole('button', { name: 'Add Fields' }).click()
    await mapping.getByRole('listbox', { name: 'Fields to add' }).getByRole('option', { name: 'Is Employed' }).click()
    await page.keyboard.press('Escape')
    const employed = mapping.locator('[data-qqq-id="bulk-load-field-isEmployed"]')
    await employed.getByRole('radio', { name: 'Default value' }).check()
    await expect(employed.getByLabel('Default value for Is Employed').locator('option')).toHaveText(['Select a value', 'Yes', 'No'])
    await advance(page, 'Next')
    await expect(employed.getByRole('alert')).toHaveText('A value is required.')
    expect(steps).toEqual([])
    await employed.getByLabel('Default value for Is Employed').selectOption({ label: 'No' })
    await expectRunTouchReady(page, 'person.bulkInsert')
    await advance(page, 'Next')
    const review = await expectScreen(page, 'review', 'Review')
    await review.getByRole('radio', { name: /Skip Validation/ }).check()
    await advance(page, 'Submit')
    await expectScreen(page, 'result', 'Result')
    expect(await backend.sql('select first_name, is_employed from person where id > 5')).toEqual([{ first_name: 'Quinn', is_employed: 'FALSE' }])
  })
})
