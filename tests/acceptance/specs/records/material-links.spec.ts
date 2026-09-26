/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Material Dashboard parity on the record view (QRun-IO/qqq#714): page shortcuts, hash links and
// create-form presets, in the exact formats backend widgets and bookmarks use.
import type { Locator, Page } from '@playwright/test'
import { expect, test } from '../../support/fixtures'
import { expectTouchTargets } from '../../support/touch'
import { listCell } from '../security/support/ui'
import { VIEWER, control, createChildHash, expectNoSidewaysScroll, isPhone, multipartField, nextPost, openForm, openRecord, recordRequests, sqlCount, sqlOne } from './helpers'

test.use(VIEWER)

const deleteDialog = (page: Page) => page.locator('[data-qqq-id="delete-confirm-dialog"]')
const auditDialog = (page: Page) => page.locator('[data-qqq-id="audit-history-dialog"]')
const helpDialog = (page: Page) => page.locator('[data-qqq-id="keyboard-shortcuts-dialog"]')

/** Asserts a dialog lies inside the viewport, with a margin at the screen edges on a phone. */
async function expectFitsScreen(page: Page, dialog: Locator) {
  const box = (await dialog.boundingBox())!
  const viewport = page.viewportSize()!
  const margin = isPhone(page) ? 8 : 0
  expect(box.x, 'left edge on screen, with a margin on a phone').toBeGreaterThanOrEqual(margin)
  expect(box.y, 'top edge on screen').toBeGreaterThanOrEqual(0)
  expect(box.x + box.width, 'right edge on screen, with a margin on a phone').toBeLessThanOrEqual(viewport.width - margin + 1)
  expect(box.y + box.height, 'bottom edge on screen').toBeLessThanOrEqual(viewport.height + 1)
  await expectTouchTargets(dialog)
}

/**
 * Shows that a record section is the one a hash link selected: its tab on wider screens,
 * its expanded accordion item on a phone, scrolled into view either way.
 */
async function expectSectionShown(page: Page, label: string, sectionName: string) {
  if (isPhone(page)) {
    await expect(page.locator('[data-qqq-id="record-view-accordion"]').getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-expanded', 'true')
  } else {
    await expect(page.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'false')
  }
  await expect(page.locator(`[data-qqq-id="record-section-${sectionName}"]`).filter({ visible: true })).toBeInViewport()
}

/** Rows of one section of the keyboard help dialog, as [description, key]. */
async function helpSection(page: Page, title: string): Promise<string[][]> {
  const dialog = page.locator('[data-qqq-id="keyboard-shortcuts-dialog"]')
  await expect(dialog.getByRole('heading', { level: 3, name: title })).toBeVisible()
  return dialog.evaluate((node, heading) => {
    const h3 = Array.from(node.querySelectorAll('h3')).find((element) => element.textContent === heading)
    return Array.from(h3?.nextElementSibling?.children ?? []).map((row) => [row.querySelector('span')?.textContent ?? '', Array.from(row.querySelectorAll('kbd')).map((kbd) => kbd.textContent).join('+')])
  }, title)
}

/** Picks a possible-value option in a combobox by visible labels. */
async function choose(page: Page, scope: ReturnType<Page['locator']>, label: string, option: string) {
  await scope.getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

test('[REC-055] record view shortcuts n, e, c, d and a open create, edit, copy, delete and audit @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await openRecord(page, 'person', 1, 'Avery Sample')
  await page.keyboard.press('e')
  await expect(page).toHaveURL(/\/app\/person\/1\/edit\/?$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Edit Person' })).toBeVisible()
  await expect(control(page, 'firstName')).toHaveValue('Avery')

  await openRecord(page, 'person', 1, 'Avery Sample')
  await page.keyboard.press('c')
  await expect(page).toHaveURL(/\/app\/person\/1\/copy\/?$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Copy Person' })).toBeVisible()
  await expect(control(page, 'email')).toHaveValue('avery@example.invalid')

  await openRecord(page, 'person', 1, 'Avery Sample')
  await page.keyboard.press('n')
  await expect(page).toHaveURL(/\/app\/person\/create\/?$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Create Person' })).toBeVisible()
  await expect(control(page, 'firstName')).toHaveValue('')

  // a opens the audit history; while it is open the other shortcuts do nothing
  await openRecord(page, 'person', 1, 'Avery Sample')
  await page.keyboard.press('a')
  await expect(auditDialog(page).getByRole('heading', { name: 'Audit for Person: Avery Sample' })).toBeVisible()
  await expect(auditDialog(page).locator('[data-qqq-id="audit-history-status"]')).toHaveText('No audits were found for this record.')
  await page.keyboard.press('e')
  await expect(auditDialog(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(auditDialog(page)).toHaveCount(0)
  await expect(page).toHaveURL(/\/app\/person\/1\/?$/)

  // d asks for confirmation: Escape keeps the record, confirming deletes it
  await openRecord(page, 'person', 5, 'Morgan Sample')
  await page.keyboard.press('d')
  await expect(deleteDialog(page)).toContainText('Are you sure you want to delete Morgan Sample? This action cannot be undone.')
  await page.keyboard.press('Escape')
  await expect(deleteDialog(page)).toHaveCount(0)
  expect(await sqlCount(backend, 'select count(*) as n from person where id = 5')).toBe(1)
  await page.keyboard.press('d')
  await deleteDialog(page).getByRole('button', { name: 'Delete' }).click()
  await expect(page).toHaveURL(/\/app\/person\/?$/)
  await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
  await expect(listCell(page, 'Person', 'Morgan')).toHaveCount(0)
  expect(await sqlCount(backend, 'select count(*) as n from person where id = 5')).toBe(0)
})

test('[REC-055] the keyboard help lists the record view shortcuts in Material wording and blocks them while open @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  void backend
  await openRecord(page, 'person', 1, 'Avery Sample')
  await page.keyboard.press('?')
  expect(await helpSection(page, 'Record View Page')).toEqual([
    ['Create a New Record', 'n'],
    ['Edit the current Record', 'e'],
    ['Copy the current Record', 'c'],
    ['Delete the current Record', 'd'],
    ['Audit the current Record', 'a'],
  ])
  await page.keyboard.press('n')
  await page.keyboard.press('d')
  await expect(page.locator('[data-qqq-id="keyboard-shortcuts-dialog"]')).toBeVisible()
  await expect(deleteDialog(page)).toHaveCount(0)
  await expect(page).toHaveURL(/\/app\/person\/1\/?$/)
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-qqq-id="keyboard-shortcuts-dialog"]')).toHaveCount(0)
})

test('[REC-055] keys typed in a text input are text, not shortcuts', async ({ page, backend, diagnostics }) => {
  void diagnostics
  void backend
  await openRecord(page, 'person', 1, 'Avery Sample')
  // the header's page and record search box (its label names records when record search is available)
  const jump = page.locator('[data-qqq-id="header-search"]').getByRole('combobox', { name: /^Search pages and (recent )?records$/ })
  await jump.click()
  await page.keyboard.type('necda')
  await expect(jump).toHaveValue('necda')
  await expect(page).toHaveURL(/\/app\/person\/1\/?$/)
  await expect(deleteDialog(page)).toHaveCount(0)
  await expect(auditDialog(page)).toHaveCount(0)
})

test.describe('read-only persona', () => {
  test.use({ persona: 'viewer' })

  test('[REC-055] a read-only user gets no create, edit, copy or delete shortcut and the backend refuses those writes @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openRecord(page, 'person', 1, 'Avery Sample')
    for (const key of ['n', 'e', 'c', 'd']) await page.keyboard.press(key)
    // the audit shortcut still works, so the keys above were handled and ignored
    await page.keyboard.press('a')
    await expect(auditDialog(page).getByRole('heading', { name: 'Audit for Person: Avery Sample' })).toBeVisible()
    await expect(page).toHaveURL(/\/app\/person\/1\/?$/)
    await expect(deleteDialog(page)).toHaveCount(0)
    const insert = await backend.api.post('/data/person', { multipart: { firstName: 'No', lastName: 'Shortcut', email: 'no@example.invalid' } })
    const remove = await backend.api.delete('/data/person/1')
    expect([insert.status(), remove.status()]).toEqual([403, 403])
    expect(await sqlCount(backend, "select count(*) as n from person where id = 1 or last_name = 'Shortcut'")).toBe(1)
  })
})

test('[REC-055] the header help button opens the shortcut list by tap, and a hardware keyboard drives the record view @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await openRecord(page, 'person', 5, 'Morgan Sample')
  const help = page.getByRole('button', { name: 'Keyboard shortcuts (?)' })
  await expectTouchTargets(help)
  await help.click()
  await expect(helpDialog(page).getByRole('heading', { name: 'Keyboard Shortcuts' })).toBeVisible()
  expect(await helpSection(page, 'Record View Page')).toEqual([
    ['Create a New Record', 'n'],
    ['Edit the current Record', 'e'],
    ['Copy the current Record', 'c'],
    ['Delete the current Record', 'd'],
    ['Audit the current Record', 'a'],
  ])
  await expectFitsScreen(page, helpDialog(page))
  await helpDialog(page).getByRole('button', { name: 'Close keyboard shortcuts' }).click()
  await expect(helpDialog(page)).toHaveCount(0)
  await expect(help).toBeFocused()

  // With a keyboard attached (tablet keyboard, phone Bluetooth keyboard) the shortcuts act on the record
  await page.keyboard.press('a')
  await expect(auditDialog(page).getByRole('heading', { name: 'Audit for Person: Morgan Sample' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(auditDialog(page)).toHaveCount(0)
  await page.keyboard.press('d')
  await expect(deleteDialog(page)).toContainText('Are you sure you want to delete Morgan Sample? This action cannot be undone.')
  await expectFitsScreen(page, deleteDialog(page))
  await deleteDialog(page).getByRole('button', { name: 'Delete' }).click()
  await expect(page).toHaveURL(/\/app\/person\/?$/)
  await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
  expect(await sqlCount(backend, 'select count(*) as n from person where id = 5')).toBe(0)
})

test('[REC-056] #audit opens the audit history and closing it clears the hash @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  void backend
  await page.goto('/app/person/2#audit', { waitUntil: 'domcontentloaded' })
  await expect(auditDialog(page).getByRole('heading', { name: 'Audit for Person: Blair Sample' })).toBeVisible()
  await auditDialog(page).getByRole('button', { name: 'Close audit history' }).click()
  await expect(auditDialog(page)).toHaveCount(0)
  await expect(page).toHaveURL(/\/app\/person\/2\/?$/)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1, name: 'Blair Sample' })).toBeVisible()
  await expect(auditDialog(page)).toHaveCount(0)
})

test('[REC-056] #/launchProcess= opens the process run for the record and returns to it @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  void backend
  const init = nextPost(page, '/qqq/v1/processes/person.bulkEdit/init')
  await page.goto('/app/person/2#/launchProcess=person.bulkEdit', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/app\/person\.bulkEdit\/?\?recordsParam=recordIds&recordIds=2&returnTo=%2Fapp%2Fperson%2F2$/)
  const request = await init
  expect([multipartField(request, 'recordsParam'), multipartField(request, 'recordIds')]).toEqual(['recordIds', '2'])
  const edit = page.locator('[data-qqq-id="process-step-edit"]')
  await expect(edit.locator('[data-qqq-id="process-step-heading"]')).toHaveText('Edit Values')
  await page.locator('[data-qqq-id="button-cancel"]').click()
  await page.getByRole('dialog', { name: 'Cancel Process?' }).getByRole('button', { name: 'Cancel Process' }).click()
  await expect(page).toHaveURL(/\/app\/person\/2\/?$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Blair Sample' })).toBeVisible()
})

test('[REC-056] a section anchor selects that section (tab, or accordion item on a phone) and scrolls to it @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  void backend
  await page.goto('/app/person/1#employmentInfo', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1, name: 'Avery Sample' })).toBeVisible()
  await expectSectionShown(page, 'Employment Info', 'employmentInfo')
  // following an in-page anchor moves to the next section
  await page.evaluate(() => { window.location.hash = 'dates' })
  await expectSectionShown(page, 'Dates', 'dates')
  await expectNoSidewaysScroll(page)
})

test('[REC-057] a #/createChild= link creates a child of the record with the locked join value @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const writes = recordRequests(page, '/qqq/v1/table/pet')
  const before = await sqlCount(backend, 'select count(*) as n from pet where person_id = 3')
  await page.goto(`/app/person/3${createChildHash('pet', { personId: 3 }, ['personId'])}`, { waitUntil: 'domcontentloaded' })
  const dialog = page.locator('[data-qqq-id="dialog-create-child-pet"]')
  await expect(dialog.getByRole('heading', { name: 'Add Pet' })).toBeVisible()
  await expect(control(page, 'name')).toBeVisible()
  await expectFitsScreen(page, dialog)
  // the record stays underneath the modal dialog (hidden from assistive technology while it is open)
  await expect(page.getByRole('heading', { level: 1, name: 'Casey Sample', includeHidden: true })).toBeVisible()
  const person = dialog.getByRole('combobox', { name: 'Person' })
  await expect(person).toBeDisabled()
  await expect(person).toHaveText('Casey Sample')
  await control(page, 'name').fill('Hash Pup')
  await choose(page, dialog, 'Species', 'Dog')
  await dialog.getByRole('button', { name: 'Create' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(/\/app\/person\/3\/?$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Casey Sample' })).toBeVisible()
  // the locked field is submitted with its preset value and the child is linked to the record
  // (possible-value searches also POST, under /qqq/v1/table/pet/possibleValues, and are not writes)
  const post = writes.filter((request) => request.method() === 'POST' && new URL(request.url()).pathname === '/qqq/v1/table/pet')
  expect(post).toHaveLength(1)
  expect(multipartField(post[0], 'personId')).toBe('3')
  expect(await sqlOne(backend, "select person_id, species_id from pet where name = 'Hash Pup'")).toEqual({ person_id: '3', species_id: '1' })
  expect(await sqlCount(backend, 'select count(*) as n from pet where person_id = 3')).toBe(before + 1)
})

test('[REC-057] create page presets from #/defaultValues= and #/disabledFields= are filled, locked and saved @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const encode = (value: unknown) => encodeURIComponent(JSON.stringify(value))
  await openForm(page, `/app/pet/create#/defaultValues=${encode({ name: 'Preset Pet', personId: 2 })}/disabledFields=${encode({ personId: 1 })}`, 'Create Pet')
  const form = page.locator('form')
  await expect(control(page, 'name')).toHaveValue('Preset Pet')
  await expect(control(page, 'name')).toBeEnabled()
  const person = form.getByRole('combobox', { name: 'Person' })
  await expect(person).toBeDisabled()
  await expect(person).toHaveText('Blair Sample')
  await choose(page, form, 'Species', 'Cat')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Preset Pet' })).toBeVisible()
  expect(await sqlOne(backend, "select person_id, species_id from pet where name = 'Preset Pet'")).toEqual({ person_id: '2', species_id: '2' })

  // the linkTableCreateWithDefaultValues form (#defaultValues=, no slash) presets without locking
  await openForm(page, `/app/pet/create#defaultValues=${encode({ speciesId: 2 })}`, 'Create Pet')
  const species = page.locator('form').getByRole('combobox', { name: 'Species' })
  await expect(species).toHaveText('Cat')
  await expect(species).toBeEnabled()
  await expect(page.locator('form').getByRole('combobox', { name: 'Person' })).toBeEnabled()
})
