/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Phone and tablet record screens (QRun-IO/qqq#708): the record header and action sheet, tap
// equivalents of hover tooltips, dialogs that fit a phone, and forms with every editor type.
import type { Locator, Page } from '@playwright/test'
import { expect, test } from '../../support/fixtures'
import { expectTouchReady, expectTouchTargets } from '../../support/touch'
import { listCell, tabKey } from '../security/support/ui'
import {
  VIEWER, control, expandOnPhone, expectNoSidewaysScroll, isPhone, openForm, openRecord, recordIdFromUrl, shown, sqlCount, sqlOne,
} from './helpers'

test.use(VIEWER)

const PHONE = { viewport: { width: 412, height: 839 }, hasTouch: true }

/** Asserts a dialog or sheet lies fully inside the viewport. */
async function expectInViewport(page: Page, region: Locator) {
  const box = (await region.boundingBox())!
  const viewport = page.viewportSize()!
  expect(box.x, 'left edge on screen').toBeGreaterThanOrEqual(0)
  expect(box.y, 'top edge on screen').toBeGreaterThanOrEqual(0)
  expect(box.x + box.width, 'right edge on screen').toBeLessThanOrEqual(viewport.width + 1)
  expect(box.y + box.height, 'bottom edge on screen').toBeLessThanOrEqual(viewport.height + 1)
}

/** Whether keyboard focus is inside a region. */
function focusInside(region: Locator): Promise<boolean> {
  return region.evaluate((node) => node.contains(document.activeElement))
}

test('[REC-058] the record header keeps the title readable and wraps its controls on phones and tablets @mobile', async ({ page, diagnostics }) => {
  void diagnostics
  await openRecord(page, 'recordLab', 1, 'Lab: Alpha')
  const title = page.getByRole('heading', { level: 1, name: 'Lab: Alpha' })
  const controls = page.locator('[data-qqq-id="record-view-controls"]')
  await expect(controls.getByRole('button', { name: 'Audit history for Lab: Alpha' })).toBeVisible()
  await expect(controls.getByRole('radio', { name: 'List view' })).toBeVisible()
  const heading = (await title.boundingBox())!
  const bar = (await controls.boundingBox())!
  const main = (await page.locator('#main-content').boundingBox())!
  // The title stays on one line instead of being squeezed under the view toggle
  expect(heading.height, 'title on a single line').toBeLessThan(48)
  const overlap = heading.x < bar.x + bar.width && bar.x < heading.x + heading.width && heading.y < bar.y + bar.height && bar.y < heading.y + heading.height
  expect(overlap, 'title and controls overlap').toBe(false)
  expect(bar.x + bar.width, 'controls end inside the content area').toBeLessThanOrEqual(main.x + main.width)
  await expectNoSidewaysScroll(page)
  await expectTouchReady(page, page.locator('[data-qqq-id="record-view-recordLab"]'))

  // The controls work by tap: list view shows every section at once
  await controls.getByRole('radio', { name: 'List view' }).click()
  await expect(page.locator('[data-qqq-id="record-view-list-mode"]').getByRole('heading', { name: 'Files' })).toBeVisible()
  await expectNoSidewaysScroll(page)
})

test('[REC-059] record forms fit phones and tablets with touch-sized editors of every type @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await openForm(page, '/app/fieldLab/create', 'Create Field Lab')
  const form = page.locator('[data-qqq-id="entity-form-fieldLab"]')
  await expect(page.locator('#field-dateTimeValue-tz-hint')).toBeVisible()
  await expectNoSidewaysScroll(page)
  await expectTouchReady(page, form)
  // On a phone the Save / Cancel bar stays on screen while the long form scrolls
  if (isPhone(page)) await expect(page.getByRole('button', { name: 'Save' })).toBeInViewport()

  await control(page, 'name').fill('Touch Editors')
  await page.getByRole('checkbox', { name: 'Boolean Value' }).click()
  await expect(page.getByRole('checkbox', { name: 'Boolean Value' })).toHaveAttribute('aria-checked', 'false')
  await control(page, 'dateValue').fill('2024-05-06')
  await control(page, 'timeValue').fill('07:08:09')
  await control(page, 'textValue').fill('two\nlines')
  await page.getByRole('textbox', { name: 'Html Value' }).click()
  await page.keyboard.type('Rich')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Touch Editors' })).toBeVisible()
  const id = recordIdFromUrl(page, 'fieldLab')
  expect(await sqlOne(backend, `select boolean_value, date_value, time_value, text_value, html_value from field_lab where id = ${id}`))
    .toEqual({ boolean_value: 'FALSE', date_value: '2024-05-06', time_value: '07:08:09', text_value: 'two\r\nlines', html_value: 'Rich' })

  // Possible values, code editor, password reveal and file uploads on the Record Lab edit form
  await openForm(page, '/app/recordLab/1/edit', 'Edit Record Lab')
  const labForm = page.locator('[data-qqq-id="entity-form-recordLab"]')
  await expect(page.locator('[data-qqq-id="script-editor-field-config"]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Browse files' })).toBeVisible()
  await expectNoSidewaysScroll(page)
  await expectTouchReady(page, labForm)
  await control(page, 'ownerId').click()
  const options = page.getByRole('listbox', { name: 'Owner options' })
  await expect(options.getByRole('option', { name: 'Casey Sample', exact: true })).toBeVisible()
  const list = (await options.boundingBox())!
  const width = page.viewportSize()!.width
  expect(list.x).toBeGreaterThanOrEqual(0)
  expect(list.x + list.width).toBeLessThanOrEqual(width + 1)
  await expectTouchTargets(options)
  await options.getByRole('option', { name: 'Casey Sample' }).click()
  await expect(control(page, 'ownerId')).toHaveText(/^Casey Sample/)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Lab: Alpha' })).toBeVisible()
  expect((await sqlOne(backend, 'select owner_id from record_lab where id = 1')).owner_id).toBe('3')
})

test.describe('on a phone', () => {
  test.use(PHONE)

  test('[REC-058] the phone action sheet fits the screen, keeps focus inside and returns it @mobile', async ({ page, diagnostics }) => {
    void diagnostics
    await openRecord(page, 'recordLab', 1, 'Lab: Alpha')
    const trigger = page.getByRole('button', { name: 'Record actions', exact: true })
    await trigger.click()
    const sheet = page.getByRole('dialog', { name: 'Record actions' })
    await expect(sheet.getByRole('button', { name: 'Close actions menu' })).toBeFocused()
    for (const action of ['Edit Record Lab', 'Copy Record Lab', 'Delete Record Lab']) await expect(sheet.getByRole('button', { name: action, exact: true })).toBeVisible()
    await expectInViewport(page, sheet)
    await expectTouchTargets(sheet)

    // Tab and Shift+Tab stay inside the sheet
    const buttons = await sheet.getByRole('button').count()
    for (let press = 0; press <= buttons; press++) {
      await page.keyboard.press(tabKey(page))
      expect(await focusInside(sheet), `focus inside after ${press + 1} Tab presses`).toBe(true)
    }
    await page.keyboard.press(`Shift+${tabKey(page)}`)
    expect(await focusInside(sheet)).toBe(true)

    // Escape and the backdrop close it and focus returns to the trigger
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await trigger.click()
    await expect(sheet).toBeVisible()
    await page.touchscreen.tap(206, 300)
    await expect(sheet).toHaveCount(0)
    await expect(trigger).toBeFocused()

    // An action from the sheet
    await trigger.click()
    await sheet.getByRole('button', { name: 'Edit Record Lab', exact: true }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'Edit Record Lab' })).toBeVisible()
  })

  test('[REC-036] a tap shows the tooltip text, a second tap or a tap elsewhere hides it @mobile', async ({ page, diagnostics }) => {
    void diagnostics
    await openRecord(page, 'recordLab', 1, 'Lab: Alpha')
    await expandOnPhone(page, 'Presentation')
    const trigger = shown(page, '[data-qqq-id="field-value-tooltip-trigger-hint"]')
    await expect(trigger).toContainText('Check twice')
    await trigger.tap()
    await expect(page.getByRole('tooltip')).toHaveText('Hints are advisory only.')
    await trigger.tap()
    await expect(page.getByRole('tooltip')).toHaveCount(0)
    await trigger.tap()
    await expect(page.getByRole('tooltip')).toHaveText('Hints are advisory only.')
    await page.getByRole('heading', { level: 1, name: 'Lab: Alpha' }).tap()
    await expect(page.getByRole('tooltip')).toHaveCount(0)
  })

  test('[REC-039] a tap on a field label shows its help; forms print the help under the field @mobile', async ({ page, diagnostics }) => {
    void diagnostics
    await openRecord(page, 'recordLab', 1, 'Lab: Alpha')
    await page.getByRole('radio', { name: 'List view' }).click()
    const label = page.locator('[data-qqq-id="field-label-website"]').first()
    await label.tap()
    await expect(page.getByRole('tooltip')).toContainText('Opens outside this application.')
    await label.tap()
    await expect(page.getByRole('tooltip')).toHaveCount(0)

    await openForm(page, '/app/recordLab/create', 'Create Record Lab')
    const help = page.locator('[data-qqq-id="field-help-text-website"]')
    await expect(help).toBeVisible()
    await expect(help).toHaveText('Include the https:// prefix.')
    await expect(control(page, 'website')).toHaveAttribute('aria-describedby', /field-help-content-website/)
  })

  test('[REC-042] the audit history dialog fits a phone, scrolls inside and closes with Escape @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    for (let change = 1; change <= 10; change++) {
      expect((await backend.api.put('/data/recordLab/2', { multipart: { hint: `Hint ${change}` } })).status()).toBe(200)
    }
    expect(await sqlCount(backend, 'select count(*) as n from audit where record_id = 2')).toBe(10)
    await openRecord(page, 'recordLab', 2, 'Lab: Beta')
    const button = page.getByRole('button', { name: 'Audit history for Lab: Beta' })
    await button.click()
    const dialog = page.locator('[data-qqq-id="audit-history-dialog"]')
    await expect(dialog.locator('[data-qqq-id="audit-history-status"]')).toHaveText('Showing all 10 audits for this record')
    const entries = dialog.locator('li[data-qqq-id^="audit-entry-"]')
    await expect(entries).toHaveCount(10)
    await expect(entries.first().getByRole('list', { name: 'Changes' }).getByRole('listitem')).toHaveText(['Changed Hint from "Hint 9" to "Hint 10"'])
    await expectInViewport(page, dialog)
    await expectTouchTargets(dialog)
    expect(await focusInside(dialog)).toBe(true)
    const body = dialog.getByRole('list', { name: 'Audits' }).locator('xpath=..')
    expect(await body.evaluate((node) => node.scrollHeight > node.clientHeight), 'the audit list scrolls inside the dialog').toBe(true)
    await body.evaluate((node) => { node.scrollTop = node.scrollHeight })
    await expect(entries.last()).toBeInViewport()
    await expect(dialog.getByRole('button', { name: 'Close audit history' })).toBeInViewport()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(button).toBeFocused()
  })

  test('[REC-012] the delete dialog fits a phone, takes focus, and deletes from the action sheet @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openRecord(page, 'person', 5, 'Morgan Sample')
    const trigger = page.getByRole('button', { name: 'Record actions', exact: true })
    await trigger.click()
    await page.getByRole('dialog', { name: 'Record actions' }).getByRole('button', { name: 'Delete Person', exact: true }).click()
    const dialog = page.locator('[data-qqq-id="delete-confirm-dialog"]')
    await expect(dialog).toContainText('Are you sure you want to delete Morgan Sample? This action cannot be undone.')
    await expectInViewport(page, dialog)
    const box = (await dialog.boundingBox())!
    expect(box.x, 'the dialog keeps a margin at the screen edge').toBeGreaterThanOrEqual(8)
    await expectTouchTargets(dialog)
    await expect.poll(() => focusInside(dialog)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    expect(await sqlCount(backend, 'select count(*) as n from person where id = 5')).toBe(1)

    await trigger.click()
    await page.getByRole('dialog', { name: 'Record actions' }).getByRole('button', { name: 'Delete Person', exact: true }).click()
    await dialog.getByRole('button', { name: 'Delete' }).click()
    await expect(page).toHaveURL(/\/app\/person\/?$/)
    await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
    await expect(listCell(page, 'Person', 'Morgan')).toHaveCount(0)
    expect(await sqlCount(backend, 'select count(*) as n from person where id = 5')).toBe(0)
  })

  test('[REC-008] the unsaved-changes dialog fits a phone and Escape keeps the edits @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const original = await sqlOne(backend, 'select first_name, modify_date from person where id = 2')
    await openForm(page, '/app/person/2/edit', 'Edit Person')
    await control(page, 'firstName').fill('Changed')
    const cancel = page.getByRole('button', { name: 'Cancel' })
    await cancel.click()
    const dialog = page.locator('[data-qqq-id="unsaved-changes-dialog"]')
    await expect(dialog).toContainText('You have unsaved changes.')
    await expectInViewport(page, dialog)
    expect((await dialog.boundingBox())!.x, 'the dialog keeps a margin at the screen edge').toBeGreaterThanOrEqual(8)
    await expectTouchTargets(dialog)
    await expect.poll(() => focusInside(dialog)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(control(page, 'firstName')).toHaveValue('Changed')
    await expect(cancel).toBeFocused()

    await cancel.click()
    await dialog.getByRole('button', { name: 'Leave' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Blair Sample' })).toBeVisible()
    expect(await sqlOne(backend, 'select first_name, modify_date from person where id = 2')).toEqual(original)
  })
})

test.describe('on a tablet', () => {
  test.use({ viewport: { width: 810, height: 1080 }, hasTouch: true })

  test('[REC-039] a tap on a form help icon shows the help on a tablet @mobile', async ({ page, diagnostics }) => {
    void diagnostics
    await openForm(page, '/app/recordLab/create', 'Create Record Lab')
    const icon = page.locator('[data-qqq-id="field-help-website"]')
    await expect(icon).toBeVisible()
    await expectTouchTargets(icon.locator('xpath=..'))
    await icon.tap()
    await expect(page.getByRole('tooltip')).toContainText('Include the https:// prefix.')
    await icon.tap()
    await expect(page.getByRole('tooltip')).toHaveCount(0)
  })
})
