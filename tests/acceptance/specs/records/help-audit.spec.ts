/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, test } from '../../support/fixtures'
import { VIEWER, control, expandOnPhone, openForm, openRecord, recordAction, recordRequests, shown, sqlCount } from './helpers'

test.use(VIEWER)

test('[REC-039] field help follows the screen roles and renders each format @mobile', async ({ page, diagnostics }) => {
  void diagnostics
  // View screen: READ_SCREENS text on the title label, VIEW_SCREEN HTML on the website label.
  await openRecord(page, 'recordLab', 1, 'Lab: Alpha')
  await page.getByRole('radio', { name: 'List view' }).click()
  const titleLabel = page.locator('[data-qqq-id="field-label-title"]').first()
  await titleLabel.focus()
  await expect(page.getByRole('tooltip')).toContainText('The headline shown for this record.')
  await page.keyboard.press('Escape')
  const websiteLabel = page.locator('[data-qqq-id="field-label-website"]').first()
  await websiteLabel.focus()
  const viewTip = page.getByRole('tooltip')
  await expect(viewTip.locator('em')).toHaveText('outside')
  await expect(viewTip).toContainText('Opens outside this application.')
  await expect(viewTip).not.toContainText('Include the https:// prefix.')
  await expect(page.locator('[data-qqq-id="field-label-ownerId"]').first()).not.toHaveAttribute('data-has-help', 'true')

  // Edit screen: WRITE_SCREENS markdown (rendered) and EDIT_SCREEN text; INSERT_SCREEN help is not shown.
  await openForm(page, '/app/recordLab/1/edit', 'Edit Record Lab')
  await expect(page.locator('#field-help-content-title strong')).toHaveText('short')
  await expect(page.locator('#field-help-content-title')).toHaveText('Use a short, unique title.')
  await expect(control(page, 'title')).toHaveAttribute('aria-describedby', /field-help-content-title/)
  await expect(page.locator('#field-help-content-website')).toHaveText('Changing the address updates every link.')
  await expect(page.locator('#field-help-content-ownerId')).toHaveCount(0)

  // Create screen: INSERT_SCREEN help for the owner and website.
  await openForm(page, '/app/recordLab/create', 'Create Record Lab')
  await expect(page.locator('#field-help-content-ownerId')).toHaveText('Pick the person who owns this record.')
  await expect(page.locator('#field-help-content-website')).toHaveText('Include the https:// prefix.')
  if ((page.viewportSize()?.width ?? 1280) < 640) {
    // Below the sm breakpoint the help is printed under the field instead of behind an icon.
    await expect(page.locator('[data-qqq-id="field-help-text-website"]')).toBeVisible()
    await expect(page.locator('[data-qqq-id="field-help-website"]')).toBeHidden()
  } else {
    await page.locator('[data-qqq-id="field-help-website"]').focus()
    await expect(page.getByRole('tooltip')).toContainText('Include the https:// prefix.')
  }
})

test('[REC-040] section help appears under the section heading @mobile', async ({ page, diagnostics }) => {
  void diagnostics
  await openRecord(page, 'recordLab', 1, 'Lab: Alpha')
  await expandOnPhone(page, 'Presentation')
  const help = shown(page, '[data-qqq-id="section-help-presentation"]').first()
  await expect(help).toHaveText('These fields show each adornment.')
  await expect(help.locator('b')).toHaveText('adornment')
  await expect(page.locator('[data-qqq-id="section-help-links"]')).toHaveCount(0)
})

test('[REC-041] table help content slots are delivered in table metadata @mobile', async ({ backend, diagnostics }) => {
  void diagnostics
  const response = await backend.api.get('/qqq/v1/metaData/table/recordLab')
  expect(response.status()).toBe(200)
  const table = await response.json()
  expect(table.helpContents).toEqual({ summary: [{ content: 'Record Lab exercises every record screen feature.', format: 'TEXT',
    contentAsHtml: 'Record Lab exercises every record screen feature.' }] })
})

test('[REC-042] audit history lists who changed what, newest first @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  expect(await sqlCount(backend, 'select count(*) as n from audit')).toBe(0)
  const processRuns = recordRequests(page, '/qqq/v1/processes/GetAuditsForRecord')

  await openForm(page, '/app/recordLab/1/edit', 'Edit Record Lab')
  await control(page, 'hint').fill('Check three times')
  await control(page, 'shortCode').fill('')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Lab: Alpha' })).toBeVisible()
  await openForm(page, '/app/recordLab/1/edit', 'Edit Record Lab')
  await control(page, 'title').fill('Alpha Prime')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Lab: Alpha Prime' })).toBeVisible()

  // Independent readback: two FIELD-level audits by the session's user.
  const audits = await backend.sql(`select a.id, a.message, u.name as username, t.name as tablename, d.field_name, d.message as detail
    from audit a join audit_user u on u.id = a.audit_user_id join audit_table t on t.id = a.audit_table_id
    left join audit_detail d on d.audit_id = a.id where a.record_id = 1 order by a.id, d.id`)
  expect(audits.map((row) => [row.message, row.username, row.tablename, row.field_name, row.detail])).toEqual([
    ['Record was Edited', 'Alice (sample)', 'recordLab', 'hint', 'Changed Hint from "Check twice" to "Check three times"'],
    ['Record was Edited', 'Alice (sample)', 'recordLab', 'shortCode', 'Removed "ALPHA-01" from Short Code'],
    ['Record was Edited', 'Alice (sample)', 'recordLab', 'title', 'Changed Title from "Alpha" to "Alpha Prime"'],
  ])

  await page.getByRole('button', { name: 'Audit history for Lab: Alpha Prime' }).click()
  const dialog = page.locator('[data-qqq-id="audit-history-dialog"]')
  await expect(dialog.getByRole('heading', { name: 'Audit for Record Lab: Lab: Alpha Prime' })).toBeVisible()
  await expect(dialog.locator('[data-qqq-id="audit-history-status"]')).toHaveText('Showing the only 2 audits for this record')
  const entries = dialog.locator('li[data-qqq-id^="audit-entry-"]')
  await expect(entries).toHaveCount(2)
  // Newest first: the title change, then the hint/short code change.
  await expect(entries.nth(0).getByRole('list', { name: 'Changes' }).getByRole('listitem')).toHaveText(['Changed Title from "Alpha" to "Alpha Prime"'])
  await expect(entries.nth(1).getByRole('list', { name: 'Changes' }).getByRole('listitem'))
    .toHaveText(['Changed Hint from "Check twice" to "Check three times"', 'Removed "ALPHA-01" from Short Code'])
  await expect(entries.nth(0).locator('[data-qqq-id="audit-entry-user"]')).toHaveText('Alice (sample)')
  await expect(entries.nth(0).locator('[data-qqq-id="audit-entry-message"]')).toHaveText('Record was Edited')
  await expect(entries.nth(0).locator('[data-qqq-id="audit-entry-timestamp"]')).toHaveText(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [AP]M E[DS]T$/)
  expect(processRuns.length).toBe(1)
  await dialog.getByRole('button', { name: 'Close audit history' }).click()
  await expect(dialog).toHaveCount(0)

  // A record without audits says so.
  await openRecord(page, 'person', 2, 'Blair Sample')
  await page.getByRole('button', { name: 'Audit history for Blair Sample' }).click()
  await expect(page.locator('[data-qqq-id="audit-history-status"]')).toHaveText('No audits were found for this record.')
})

test.describe('without process permission', () => {
  test.use({ persona: 'noProcesses' })

  test('[REC-043] audit history reads the audit table when the audit process is not permitted @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const updated = await backend.api.put('/data/recordLab/2', { multipart: { hint: 'First hint' } })
    expect(updated.status()).toBe(200)
    expect(await sqlCount(backend, 'select count(*) as n from audit where record_id = 2')).toBe(1)
    const processRuns = recordRequests(page, '/qqq/v1/processes/')
    const auditQueries = recordRequests(page, '/qqq/v1/table/audit/query')

    await openRecord(page, 'recordLab', 2, 'Lab: Beta')
    await page.getByRole('button', { name: 'Audit history for Lab: Beta' }).click()
    const dialog = page.locator('[data-qqq-id="audit-history-dialog"]')
    await expect(dialog.locator('[data-qqq-id="audit-history-status"]')).toHaveText('Showing the only audit for this record')
    await expect(dialog.locator('[data-qqq-id="audit-detail-hint"]')).toHaveText('Set Hint to "First hint"')
    expect(auditQueries).toHaveLength(1)
    expect(processRuns).toHaveLength(0)
  })
})

test('[REC-044] the record label format titles the record, its dialogs and its audit @mobile', async ({ page, diagnostics }) => {
  void diagnostics
  await openRecord(page, 'recordLab', 2, 'Lab: Beta')
  await expect(page.locator('[data-qqq-id="link-back-to-table"]')).toHaveText('Back to Record Lab')
  await recordAction(page, 'Delete', 'Record Lab')
  await expect(page.locator('[data-qqq-id="delete-confirm-dialog"]')).toContainText('Are you sure you want to delete Lab: Beta?')
  await page.locator('[data-qqq-id="delete-confirm-dialog"]').getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('button', { name: 'Audit history for Lab: Beta' }).click()
  await expect(page.getByRole('heading', { name: 'Audit for Record Lab: Lab: Beta' })).toBeVisible()
})
