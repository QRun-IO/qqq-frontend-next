/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, test } from '../../support/fixtures'
import { VIEWER, control, fieldValue, openForm, openRecord, sqlOne } from './helpers'

test.use(VIEWER)

test('[REC-028] LINK adornments open the referenced record or the URL', async ({ page, backend, diagnostics }) => {
  void diagnostics
  expect(await sqlOne(backend, 'select owner_id, website from record_lab where id = 1')).toEqual({ owner_id: '1', website: 'https://example.invalid/alpha' })
  await openRecord(page, 'recordLab', 1, 'Lab: Alpha')

  const website = fieldValue(page, 'website')
  await expect(website).toHaveAttribute('href', 'https://example.invalid/alpha')
  await expect(website).toHaveAttribute('target', '_blank')
  await expect(website).toHaveAttribute('rel', 'noopener noreferrer')

  const owner = fieldValue(page, 'ownerId')
  await expect(owner).toHaveText('Avery Sample')
  await owner.click()
  await expect(page.getByRole('heading', { level: 1, name: 'Avery Sample' })).toBeVisible()
  await expect(page).toHaveURL(/\/app\/person\/1\/?\?/)

  // A value that is not an http(s) URL or a same-origin path is shown as text, not a link.
  const updated = await backend.api.put('/data/recordLab/2', { multipart: { website: 'javascript:alert(1)' } })
  expect(updated.status()).toBe(200)
  await openRecord(page, 'recordLab', 2, 'Lab: Beta')
  await expect(fieldValue(page, 'website')).toHaveText('javascript:alert(1)')
  expect(await fieldValue(page, 'website').evaluate((element) => element.tagName)).toBe('SPAN')
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0)
})

test('[REC-029] CHIP adornments color and label values by their stored value', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await openRecord(page, 'recordLab', 1, 'Lab: Alpha')
  const active = fieldValue(page, 'status')
  await expect(active).toHaveText('Active')
  await expect(active).toHaveAttribute('data-chip-color', 'success')
  await expect(active).toHaveAttribute('data-chip-icon', 'check_circle')
  await expect(active).toHaveClass(/bg-emerald-100/)

  await openRecord(page, 'recordLab', 2, 'Lab: Beta')
  await expect(fieldValue(page, 'status')).toHaveText('Draft')
  await expect(fieldValue(page, 'status')).toHaveAttribute('data-chip-color', 'info')
  await expect(fieldValue(page, 'status')).not.toHaveAttribute('data-chip-icon', /.+/)

  // A value without a declared color falls back to the default chip color.
  expect((await backend.api.put('/data/recordLab/2', { multipart: { status: 'UNLISTED' } })).status()).toBe(200)
  expect((await sqlOne(backend, 'select status from record_lab where id = 2')).status).toBe('UNLISTED')
  await openRecord(page, 'recordLab', 2, 'Lab: Beta')
  await expect(fieldValue(page, 'status')).toHaveAttribute('data-chip-color', 'default')
})

test('[REC-030] SIZE adornment sets the query grid column width', async ({ page, diagnostics }) => {
  void diagnostics
  await page.goto('/app/recordLab', { waitUntil: 'domcontentloaded' })
  const grid = page.getByRole('grid', { name: 'Record Lab records' })
  await expect(grid.getByRole('gridcell', { name: 'ALPHA-01', exact: true })).toBeVisible()
  const header = (label: string) => grid.getByRole('columnheader').filter({ hasText: label }).first()
  expect(await header('Short Code').evaluate((element) => element.getBoundingClientRect().width)).toBe(100)
  expect(await header('Website').evaluate((element) => element.getBoundingClientRect().width)).toBe(150)
})

test('[REC-031] CODE_EDITOR shows formatted code and edits it with a code editor', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await openRecord(page, 'recordLab', 1, 'Lab: Alpha')
  const code = fieldValue(page, 'config')
  await expect(code).toHaveAttribute('data-language-mode', 'json')
  await expect(code.locator('code')).toHaveText('{"enabled":true,"limit":3}')
  await page.getByRole('button', { name: 'Format JSON' }).click()
  await expect(code.locator('code')).toHaveText('{\n  "enabled": true,\n  "limit": 3\n}')
  await page.getByRole('button', { name: 'Reset Format' }).click()
  await expect(code.locator('code')).toHaveText('{"enabled":true,"limit":3}')

  await openForm(page, '/app/recordLab/1/edit', 'Edit Record Lab')
  const editor = page.locator('[data-qqq-id="script-editor-field-config"]')
  await expect(editor).toContainText('JSON')
  await expect(control(page, 'config')).toHaveValue('{"enabled":true,"limit":3}')
  await control(page, 'config').fill('{"enabled":false}')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Lab: Alpha' })).toBeVisible()
  expect((await sqlOne(backend, 'select config from record_lab where id = 1')).config).toBe('{"enabled":false}')

  // Formatting invalid JSON reports the problem instead of changing the text.
  expect((await backend.api.put('/data/recordLab/2', { multipart: { config: '{not json' } })).status()).toBe(200)
  await openRecord(page, 'recordLab', 2, 'Lab: Beta')
  await page.getByRole('button', { name: 'Format JSON' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Error formatting code:' })).toBeVisible()
  await expect(fieldValue(page, 'config').locator('code')).toHaveText('{not json')
})

test('[REC-032] RENDER_HTML renders markup and drops scripts', async ({ page, backend, diagnostics }) => {
  void diagnostics
  expect((await sqlOne(backend, 'select html_note from record_lab where id = 1')).html_note).toContain('<script>')
  await openRecord(page, 'recordLab', 1, 'Lab: Alpha')
  const note = fieldValue(page, 'htmlNote')
  await expect(note.locator('i')).toHaveText('Italic')
  await expect(note).toHaveText('Italic note')
  await expect(note.locator('script')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { recordLabXss?: boolean }).recordLabXss)).toBeUndefined()
})

test('[REC-033] REVEAL masks the value until the user reveals it', async ({ page, backend, diagnostics }) => {
  void diagnostics
  expect((await sqlOne(backend, 'select api_token from record_lab where id = 1')).api_token).toBe('tok-alpha-123')
  await openRecord(page, 'recordLab', 1, 'Lab: Alpha')
  const token = fieldValue(page, 'apiToken')
  await expect(token).toHaveText('••••••••')
  await expect(page.getByText('tok-alpha-123')).toHaveCount(0)
  await page.getByRole('button', { name: 'Show API Token' }).click()
  await expect(token).toHaveText('tok-alpha-123')
  await expect(page.getByRole('button', { name: 'Copy API Token' })).toBeVisible()
  await page.getByRole('button', { name: 'Hide API Token' }).click()
  await expect(token).toHaveText('••••••••')

  // REVEAL on a PASSWORD field means the backend returns (and the edit form shows) the value.
  await openForm(page, '/app/recordLab/1/edit', 'Edit Record Lab')
  await expect(control(page, 'apiToken')).toHaveValue('tok-alpha-123')
})

test('[REC-034] FILE_DOWNLOAD links to the stored file under its declared name', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await openRecord(page, 'recordLab', 1, 'Lab: Alpha')
  await page.getByRole('tab', { name: 'Files' }).click()
  const attachment = fieldValue(page, 'attachment')
  await expect(attachment).toContainText('alpha.txt')
  await expect(page.locator('[data-qqq-id="field-value-attachment-open"]')).toHaveAttribute('href', '/data/recordLab/1/attachment/alpha.txt')
  await expect(page.locator('[data-qqq-id="field-value-attachment-download"]')).toHaveAttribute('href', '/data/recordLab/1/attachment/alpha.txt?download=1')
  await expect(fieldValue(page, 'notesFile')).toContainText('Record 1 Notes')
  await expect(page.locator('[data-qqq-id="field-value-notesFile-open"]')).toHaveAttribute('href', '/data/recordLab/1/notesFile/Record%201%20Notes')

  const downloadPromise = page.waitForEvent('download')
  await page.locator('[data-qqq-id="field-value-attachment-download"]').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('alpha.txt')
  const chunks: Buffer[] = []
  for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer)
  expect(Buffer.concat(chunks).toString('utf8')).toBe('alpha attachment bytes')
  const stored = (await sqlOne(backend, 'select attachment from record_lab where id = 1')).attachment!
  expect(Buffer.from(stored, 'base64').toString('utf8')).toBe('alpha attachment bytes')

  const notes = await backend.api.get('/data/recordLab/1/notesFile/Record%201%20Notes')
  expect(notes.status()).toBe(200)
  expect(await notes.text()).toBe('alpha notes')

  // A record without files shows no download link.
  await openRecord(page, 'recordLab', 2, 'Lab: Beta')
  await page.getByRole('tab', { name: 'Files' }).click()
  await expect(fieldValue(page, 'attachment')).toHaveText('—')
  await expect(page.locator('[data-qqq-id="field-value-attachment-download"]')).toHaveCount(0)
})

test('[REC-035] FILE_UPLOAD replaces and removes stored files in either format', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await openForm(page, '/app/recordLab/1/edit', 'Edit Record Lab')
  await expect(page.locator('[data-qqq-id="attachment"]')).toHaveAttribute('data-upload-format', 'dragAndDrop')
  await expect(page.locator('[data-qqq-id="attachment"]')).toContainText('Drag and drop a file')
  await expect(page.getByRole('button', { name: 'Browse files' })).toBeVisible()
  await expect(page.locator('[data-qqq-id="notesFile"]')).toHaveAttribute('data-upload-format', 'button')
  await expect(page.getByRole('button', { name: /Notes File Choose file to upload/ })).toBeVisible()
  const current = page.locator('[data-qqq-id="attachment-current-file"]')
  await expect(current).toContainText('Current File:')
  await expect(current.getByRole('link', { name: 'alpha.txt' })).toHaveAttribute('href', '/data/recordLab/1/attachment/alpha.txt')

  await page.locator('[data-qqq-id="attachment-file-input"]').setInputFiles({ name: 'replacement.txt', mimeType: 'text/plain', buffer: Buffer.from('replaced bytes') })
  await expect(page.locator('[data-qqq-id="attachment-selected-file"]')).toContainText('replacement.txt')
  await page.getByRole('button', { name: 'Remove current file Record 1 Notes' }).click()
  await expect(page.getByText('The current file will be removed when you save.')).toBeVisible()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Lab: Alpha' })).toBeVisible()

  const row = await sqlOne(backend, 'select attachment, attachment_name, notes_file from record_lab where id = 1')
  expect(Buffer.from(row.attachment!, 'base64').toString('utf8')).toBe('replaced bytes')
  expect(row.attachment_name).toBe('replacement.txt')
  expect(row.notes_file).toBeNull()
  await page.getByRole('tab', { name: 'Files' }).click()
  await expect(fieldValue(page, 'attachment')).toContainText('replacement.txt')
  await expect(fieldValue(page, 'notesFile')).toHaveText('—')
})

test('[REC-036] TOOLTIP shows its text on hover and keyboard focus', async ({ page, diagnostics }) => {
  void diagnostics
  await openRecord(page, 'recordLab', 1, 'Lab: Alpha')
  const trigger = page.locator('[data-qqq-id="field-value-tooltip-trigger-hint"]')
  await expect(trigger).toContainText('Check twice')
  await trigger.focus()
  await expect(page.getByRole('tooltip')).toHaveText('Hints are advisory only.')
  await page.keyboard.press('Escape')
  await trigger.blur()
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await trigger.hover()
  await expect(page.getByRole('tooltip')).toHaveText('Hints are advisory only.')
})

test('[REC-037] WIDGET adornment renders the field value as its widget', async ({ page, diagnostics }) => {
  void diagnostics
  await openRecord(page, 'recordLab', 1, 'Lab: Alpha')
  const summary = fieldValue(page, 'summaryWidget')
  await expect(summary.locator('p.record-lab-summary')).toHaveText('Summary for Alpha')
  await expect(page.getByText('RawHTML@')).toHaveCount(0)

  await openForm(page, '/app/recordLab/1/edit', 'Edit Record Lab')
  await expect(control(page, 'summaryWidget')).toHaveCount(0)
})

test('[REC-038] ERROR adornment highlights the value', async ({ page, backend, diagnostics }) => {
  void diagnostics
  expect((await sqlOne(backend, 'select problem from record_lab where id = 1')).problem).toBe('Needs review')
  await openRecord(page, 'recordLab', 1, 'Lab: Alpha')
  const problem = fieldValue(page, 'problem')
  await expect(problem).toHaveText('Needs review')
  await expect(problem).toHaveAttribute('role', 'note')
  await expect(problem).toHaveClass(/text-red-800/)
})
