/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import type { Page } from '@playwright/test'
import { expect, test, type Backend } from '../../support/fixtures'
import {
  VIEWER, control, expandOnPhone, fieldValue, multipartFields, openForm, openRecord, recordIdFromUrl, recordRequests, showSection, shown, sqlCount,
  sqlOne, toasts,
} from './helpers'

test.use(VIEWER)

const FIELD_LAB_ERRORS = ['/qqq/v1/table/fieldLab 400', 'Failed to load resource: the server responded with a status of 400']

/** Opens the Field Lab create form, fills text/number inputs by field name and saves. */
async function createFieldLab(page: Page, values: Record<string, string>) {
  await openForm(page, '/app/fieldLab/create', 'Create Field Lab')
  for (const [name, value] of Object.entries(values)) await control(page, name).fill(value)
  await page.getByRole('button', { name: 'Save' }).click()
}

/** Creates a Field Lab row directly (bypassing the UI) and returns its id. */
async function insertFieldLab(backend: Backend, values: Record<string, string>): Promise<string> {
  const response = await backend.api.post('/data/fieldLab', { multipart: values })
  expect(response.status(), await response.text()).toBe(200)
  return String((await response.json()).records[0].values.id)
}

test('[REC-014] STRING and TEXT editors round-trip single and multi-line text @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await openForm(page, '/app/fieldLab/create', 'Create Field Lab')
  await expect(control(page, 'name')).toHaveAttribute('type', 'text')
  await expect(page.locator('textarea#field-textValue')).toBeVisible()
  await control(page, 'name').fill('Text Round Trip')
  await control(page, 'textValue').fill('first line\nsecond line')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Text Round Trip' })).toBeVisible()
  const id = recordIdFromUrl(page, 'fieldLab')
  // Multipart form encoding submits line breaks as CRLF, as every HTML form does.
  expect(await sqlOne(backend, `select name, text_value from field_lab where id = ${id}`)).toEqual({ name: 'Text Round Trip', text_value: 'first line\r\nsecond line' })
  await expandOnPhone(page, 'Field Types')
  expect((await fieldValue(page, 'textValue').innerText()).split(/\r?\n/)).toEqual(['first line', 'second line'])
})

test('[REC-015] INTEGER, LONG and DECIMAL editors keep exact values @mobile', async ({ page, backend, diagnostics }) => {
  diagnostics.allow('/qqq/v1/table/fieldLab 500')
  diagnostics.allow('Failed to load resource: the server responded with a status of 500')
  const writes = recordRequests(page, '/qqq/v1/table/fieldLab')
  await openForm(page, '/app/fieldLab/create', 'Create Field Lab')
  await expect(control(page, 'longValue')).toHaveAttribute('type', 'number')
  await control(page, 'name').fill('Numbers')
  await control(page, 'longValue').fill('1.5')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('#field-longValue-error')).toHaveText('Long Value must be a whole number')
  expect(writes.filter((request) => request.method() === 'POST')).toHaveLength(0)

  // Beyond 2^53: a JavaScript number would silently change the last digit.
  await control(page, 'longValue').fill('9007199254740993')
  await control(page, 'decimalValue').fill('1234.5678')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Numbers' })).toBeVisible()
  const id = recordIdFromUrl(page, 'fieldLab')
  expect(multipartFields(writes.find((request) => request.method() === 'POST')!).longValue).toBe('9007199254740993')
  expect(await sqlOne(backend, `select long_value, decimal_value from field_lab where id = ${id}`)).toEqual({ long_value: '9007199254740993', decimal_value: '1234.5678' })
  await expandOnPhone(page, 'Field Types')
  await expect(fieldValue(page, 'longValue')).toHaveText('9007199254740993')
  await expect(fieldValue(page, 'decimalValue')).toHaveText('1234.5678')

  // The backend rejects a fractional LONG sent without the UI and writes nothing.
  const before = await sqlCount(backend, 'select count(*) as n from field_lab')
  const response = await backend.api.post('/data/fieldLab', { multipart: { name: 'Fraction', longValue: '1.5' } })
  expect(response.status()).toBeGreaterThanOrEqual(400)
  expect((await response.json()).error).toContain('Value [1.5] could not be converted to a Long.')
  expect(await sqlCount(backend, 'select count(*) as n from field_lab')).toBe(before)
})

test('[REC-016] BOOLEAN editor applies the metadata default and saves true and false @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const writes = recordRequests(page, '/qqq/v1/table/fieldLab')
  await openForm(page, '/app/fieldLab/create', 'Create Field Lab')
  const toggle = page.getByRole('checkbox', { name: 'Boolean Value' })
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await control(page, 'name').fill('Default True')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Default True' })).toBeVisible()
  const defaultId = recordIdFromUrl(page, 'fieldLab')
  expect((await sqlOne(backend, `select boolean_value from field_lab where id = ${defaultId}`)).boolean_value).toBe('TRUE')
  await expandOnPhone(page, 'Field Types')
  await expect(fieldValue(page, 'booleanValue')).toHaveText('Yes')

  await openForm(page, '/app/fieldLab/create', 'Create Field Lab')
  await control(page, 'name').fill('Switched False')
  await page.getByRole('checkbox', { name: 'Boolean Value' }).click()
  await expect(page.getByRole('checkbox', { name: 'Boolean Value' })).toHaveAttribute('aria-checked', 'false')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Switched False' })).toBeVisible()
  const falseId = recordIdFromUrl(page, 'fieldLab')
  expect((await sqlOne(backend, `select boolean_value from field_lab where id = ${falseId}`)).boolean_value).toBe('FALSE')
  await expandOnPhone(page, 'Field Types')
  await expect(fieldValue(page, 'booleanValue')).toHaveText('No')

  // Editing another field re-sends the stored boolean unchanged.
  await openForm(page, `/app/fieldLab/${falseId}/edit`, 'Edit Field Lab')
  await expect(page.getByRole('checkbox', { name: 'Boolean Value' })).toHaveAttribute('aria-checked', 'false')
  await control(page, 'name').fill('Still False')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Still False' })).toBeVisible()
  expect(multipartFields(writes.filter((request) => request.method() === 'PATCH')[0]).booleanValue).toBe('false')
  expect((await sqlOne(backend, `select boolean_value from field_lab where id = ${falseId}`)).boolean_value).toBe('FALSE')
})

test('[REC-017] DATE and TIME editors round-trip values and clearing @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await openForm(page, '/app/fieldLab/create', 'Create Field Lab')
  await expect(control(page, 'dateValue')).toHaveAttribute('type', 'date')
  await expect(control(page, 'timeValue')).toHaveAttribute('type', 'time')
  await control(page, 'name').fill('Calendar')
  await control(page, 'dateValue').fill('2024-02-29')
  await control(page, 'timeValue').fill('13:45:30')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible()
  const id = recordIdFromUrl(page, 'fieldLab')
  expect(await sqlOne(backend, `select date_value, time_value from field_lab where id = ${id}`)).toEqual({ date_value: '2024-02-29', time_value: '13:45:30' })
  await expandOnPhone(page, 'Field Types')
  await expect(fieldValue(page, 'dateValue')).toHaveText('2024-02-29')
  await expect(fieldValue(page, 'timeValue')).toHaveText('1:45:30 PM')

  await openForm(page, `/app/fieldLab/${id}/edit`, 'Edit Field Lab')
  await expect(control(page, 'dateValue')).toHaveValue('2024-02-29')
  await expect(control(page, 'timeValue')).toHaveValue('13:45:30')
  await control(page, 'dateValue').fill('')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible()
  await expandOnPhone(page, 'Field Types')
  await expect(fieldValue(page, 'dateValue')).toHaveText('—')
  expect(await sqlOne(backend, `select date_value, time_value from field_lab where id = ${id}`)).toEqual({ date_value: null, time_value: '13:45:30' })
})

test('[REC-018] DATE_TIME is entered and shown in the viewer zone and stored in UTC @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const writes = recordRequests(page, '/qqq/v1/table/fieldLab')
  await openForm(page, '/app/fieldLab/create', 'Create Field Lab')
  await expect(control(page, 'dateTimeValue')).toHaveAttribute('type', 'datetime-local')
  await expect(page.locator('#field-dateTimeValue-tz-hint')).toHaveText('Your local time (America/New_York)')
  await control(page, 'name').fill('Instant')
  await control(page, 'dateTimeValue').fill('2024-07-04T09:15')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Instant' })).toBeVisible()
  const id = recordIdFromUrl(page, 'fieldLab')
  expect(multipartFields(writes.find((request) => request.method() === 'POST')!).dateTimeValue).toBe('2024-07-04T13:15:00Z')
  expect((await sqlOne(backend, `select date_time_value from field_lab where id = ${id}`)).date_time_value).toBe('2024-07-04 13:15:00')
  await expandOnPhone(page, 'Field Types')
  await expect(fieldValue(page, 'dateTimeValue')).toHaveText('2024-07-04 09:15:00 AM EDT')

  await openForm(page, `/app/fieldLab/${id}/edit`, 'Edit Field Lab')
  await expect(control(page, 'dateTimeValue')).toHaveValue('2024-07-04T09:15')
  await control(page, 'name').fill('Instant Renamed')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Instant Renamed' })).toBeVisible()
  // An unchanged date-time is not rewritten (it would lose sub-second precision).
  const put = writes.filter((request) => request.method() === 'PATCH')
  expect(multipartFields(put[0])).not.toHaveProperty('dateTimeValue')
  expect((await sqlOne(backend, `select date_time_value from field_lab where id = ${id}`)).date_time_value).toBe('2024-07-04 13:15:00')

  // Winter time: the same wall-clock hour is a different UTC instant.
  await openForm(page, `/app/fieldLab/${id}/edit`, 'Edit Field Lab')
  await control(page, 'dateTimeValue').fill('2024-01-15T09:15')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Instant Renamed' })).toBeVisible()
  await expandOnPhone(page, 'Field Types')
  await expect(fieldValue(page, 'dateTimeValue')).toHaveText('2024-01-15 09:15:00 AM EST')
  expect((await sqlOne(backend, `select date_time_value from field_lab where id = ${id}`)).date_time_value).toBe('2024-01-15 14:15:00')
})

test('[REC-019] fixed-zone and per-record-zone date-times display in their declared zones @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const newYork = await insertFieldLab(backend, { name: 'Zone NY', timeZone: 'America/New_York', fixedZoneDateTime: '2024-03-10T08:30:00Z', recordZoneDateTime: '2024-03-10T08:30:00Z' })
  const beforeDst = await insertFieldLab(backend, { name: 'Zone Before DST', timeZone: 'America/New_York', recordZoneDateTime: '2024-03-10T06:30:00Z' })
  const invalid = await insertFieldLab(backend, { name: 'Zone Invalid', timeZone: 'Not/AZone', recordZoneDateTime: '2024-11-03T06:30:00Z' })

  await openRecord(page, 'fieldLab', newYork, 'Zone NY')
  await showSection(page, 'Time Zones')
  await expect(fieldValue(page, 'fixedZoneDateTime')).toHaveText('2024-03-10 03:30:00 AM CDT')
  await expect(fieldValue(page, 'recordZoneDateTime')).toHaveText('2024-03-10 04:30:00 AM EDT')

  await openRecord(page, 'fieldLab', beforeDst, 'Zone Before DST')
  await expandOnPhone(page, 'Time Zones')
  await expect(fieldValue(page, 'recordZoneDateTime')).toHaveText('2024-03-10 01:30:00 AM EST')

  await openRecord(page, 'fieldLab', invalid, 'Zone Invalid')
  await expandOnPhone(page, 'Time Zones')
  await expect(fieldValue(page, 'recordZoneDateTime')).toHaveText('2024-11-03 06:30:00 AM UTC')
  expect((await sqlOne(backend, `select record_zone_date_time from field_lab where id = ${invalid}`)).record_zone_date_time).toBe('2024-11-03 06:30:00')
})

test('[REC-020] HTML field edits in the rich-text editor and renders sanitized @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await openForm(page, '/app/fieldLab/create', 'Create Field Lab')
  await control(page, 'name').fill('Rich Text')
  const editor = page.getByRole('textbox', { name: 'Html Value' })
  await editor.click()
  await page.keyboard.type('Plain ')
  await page.getByRole('button', { name: 'Bold' }).click()
  await page.keyboard.type('Strong')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Rich Text' })).toBeVisible()
  const id = recordIdFromUrl(page, 'fieldLab')
  const stored = (await sqlOne(backend, `select html_value from field_lab where id = ${id}`)).html_value!
  expect(stored).toMatch(/^Plain (<b>|<strong>)Strong(<\/b>|<\/strong>)$/)
  await expandOnPhone(page, 'Field Types')
  await expect(fieldValue(page, 'htmlValue').locator('b, strong')).toHaveText('Strong')

  // Stored markup with script and event handlers renders without executing either.
  const unsafe = await insertFieldLab(backend, { name: 'Unsafe Html', htmlValue: '<p>Safe <em>text</em></p><script>window.fieldLabXss = 1</script><img src="x" onerror="window.fieldLabXss = 2">' })
  await openRecord(page, 'fieldLab', unsafe, 'Unsafe Html')
  await expandOnPhone(page, 'Field Types')
  await expect(fieldValue(page, 'htmlValue').locator('em')).toHaveText('text')
  await expect(fieldValue(page, 'htmlValue').locator('script')).toHaveCount(0)
  expect(await fieldValue(page, 'htmlValue').locator('img').getAttribute('onerror')).toBeNull()
  expect(await page.evaluate(() => (window as unknown as { fieldLabXss?: number }).fieldLabXss)).toBeUndefined()
})

test('[REC-021] PASSWORD is masked on read and never overwritten by the mask @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const writes = recordRequests(page, '/qqq/v1/table/fieldLab')
  await createFieldLab(page, { name: 'Secret', passwordValue: 'secret-one' })
  await expect(page.getByRole('heading', { level: 1, name: 'Secret' })).toBeVisible()
  const id = recordIdFromUrl(page, 'fieldLab')
  expect((await sqlOne(backend, `select password_value from field_lab where id = ${id}`)).password_value).toBe('secret-one')
  await expandOnPhone(page, 'Field Types')
  await expect(fieldValue(page, 'passwordValue')).toHaveText('************')
  await expect(page.getByText('secret-one')).toHaveCount(0)

  await openForm(page, `/app/fieldLab/${id}/edit`, 'Edit Field Lab')
  await expect(control(page, 'passwordValue')).toHaveValue('')
  await expect(control(page, 'passwordValue')).toHaveAttribute('placeholder', 'Unchanged — type to replace')
  await control(page, 'name').fill('Secret Renamed')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Secret Renamed' })).toBeVisible()
  expect(multipartFields(writes.filter((request) => request.method() === 'PATCH')[0])).not.toHaveProperty('passwordValue')
  expect((await sqlOne(backend, `select password_value from field_lab where id = ${id}`)).password_value).toBe('secret-one')

  await openForm(page, `/app/fieldLab/${id}/edit`, 'Edit Field Lab')
  await control(page, 'passwordValue').fill('secret-two')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Secret Renamed' })).toBeVisible()
  expect((await sqlOne(backend, `select password_value from field_lab where id = ${id}`)).password_value).toBe('secret-two')
})

test('[REC-022] BLOB upload stores the bytes and the view downloads them @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await openForm(page, '/app/fieldLab/create', 'Create Field Lab')
  await control(page, 'name').fill('Binary')
  await expect(page.getByRole('button', { name: /Blob Value Choose file to upload/ })).toBeVisible()
  await page.locator('[data-qqq-id="blobValue-file-input"]').setInputFiles({ name: 'hello.bin', mimeType: 'application/octet-stream', buffer: Buffer.from('hello blob\u0000ÿ') })
  await expect(page.locator('[data-qqq-id="blobValue-selected-file"]')).toContainText('hello.bin')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Binary' })).toBeVisible()
  const id = recordIdFromUrl(page, 'fieldLab')
  const stored = (await sqlOne(backend, `select blob_value from field_lab where id = ${id}`)).blob_value!
  expect(Buffer.from(stored, 'base64').toString('latin1')).toBe('hello blob\u0000Ã¿')

  await expandOnPhone(page, 'Field Types')
  const downloadPromise = page.waitForEvent('download')
  await shown(page, '[data-qqq-id="field-value-blobValue-download"]').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe(`Field Lab ${id} Blob Value`)
  const chunks: Buffer[] = []
  for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer)
  expect(Buffer.concat(chunks).equals(Buffer.from(stored, 'base64'))).toBe(true)
})

test('[REC-023] dynamic defaults fill the user and dates; NONE stays empty @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await createFieldLab(page, { name: 'Defaults' })
  await expect(page.getByRole('heading', { level: 1, name: 'Defaults' })).toBeVisible()
  const id = recordIdFromUrl(page, 'fieldLab')
  const today = new Date().toISOString().slice(0, 10)
  const row = await sqlOne(backend, `select user_id_value, created_day, modified_day, manual_date_time from field_lab where id = ${id}`)
  expect(row).toEqual({ user_id_value: 'sample:alice', created_day: today, modified_day: today, manual_date_time: null })
  await expect(fieldValue(page, 'userIdValue')).toHaveText('sample:alice')
  await expect(fieldValue(page, 'manualDateTime')).toHaveText('—')

  // An explicit user id is kept when the record is edited by someone else's session.
  const explicit = await insertFieldLab(backend, { name: 'Explicit User', userIdValue: 'sample:bob' })
  await openForm(page, `/app/fieldLab/${explicit}/edit`, 'Edit Field Lab')
  await expect(control(page, 'userIdValue')).toHaveValue('sample:bob')
  await control(page, 'name').fill('Explicit User Edited')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Explicit User Edited' })).toBeVisible()
  expect(await sqlOne(backend, `select user_id_value, created_day, modified_day from field_lab where id = ${explicit}`))
    .toEqual({ user_id_value: 'sample:bob', created_day: today, modified_day: today })
})

test('[REC-024] max-length policies truncate, add an ellipsis, pass through or reject @mobile', async ({ page, backend, diagnostics }) => {
  for (const pattern of FIELD_LAB_ERRORS) diagnostics.allow(pattern)
  const before = await sqlCount(backend, 'select count(*) as n from field_lab')
  await createFieldLab(page, { name: 'Too Long', rejectLongValue: 'abcdefghij' })
  await expect(page.getByRole('alert').filter({ hasText: 'Error inserting Field Lab: The value for Reject Long Value is too long (max allowed length=8)' })).toBeVisible()
  await expect(control(page, 'rejectLongValue')).toHaveValue('abcdefghij')
  expect(await sqlCount(backend, 'select count(*) as n from field_lab')).toBe(before)

  await control(page, 'rejectLongValue').fill('abcdefgh')
  for (const name of ['truncateValue', 'ellipsisValue', 'passThroughValue']) await control(page, name).fill('abcdefghij')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Too Long' })).toBeVisible()
  const id = recordIdFromUrl(page, 'fieldLab')
  expect(await sqlOne(backend, `select truncate_value, ellipsis_value, pass_through_value, reject_long_value from field_lab where id = ${id}`))
    .toEqual({ truncate_value: 'abcdefgh', ellipsis_value: 'abcde...', pass_through_value: 'abcdefghij', reject_long_value: 'abcdefgh' })
  await expandOnPhone(page, 'Length Policies')
  await expect(fieldValue(page, 'ellipsisValue')).toHaveText('abcde...')
})

test('[REC-025] case and whitespace normalization is applied on save @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await createFieldLab(page, {
    name: 'Normalize', upperValue: 'Mixed Case', lowerValue: 'Mixed Case', unchangedValue: 'Keep  Me', trimValue: '  pad  ',
    trimLeftValue: '  left  ', trimRightValue: '  right  ', removeSpaceValue: 'a b  c', normalizedKey: '  key one  ',
  })
  await expect(page.getByRole('heading', { level: 1, name: 'Normalize' })).toBeVisible()
  const id = recordIdFromUrl(page, 'fieldLab')
  expect(await sqlOne(backend, `select upper_value, lower_value, unchanged_value, trim_value, trim_left_value, trim_right_value, remove_space_value, normalized_key from field_lab where id = ${id}`))
    .toEqual({ upper_value: 'MIXED CASE', lower_value: 'mixed case', unchanged_value: 'Keep  Me', trim_value: 'pad', trim_left_value: 'left  ',
      trim_right_value: '  right', remove_space_value: 'abc', normalized_key: 'KEY ONE' })
  await expandOnPhone(page, 'Case and Whitespace')
  await expect(fieldValue(page, 'upperValue')).toHaveText('MIXED CASE')
  await expect(fieldValue(page, 'normalizedKey')).toHaveText('KEY ONE')
})

test('[REC-026] numeric range policies reject or clip as declared @mobile', async ({ page, backend, diagnostics }) => {
  for (const pattern of FIELD_LAB_ERRORS) diagnostics.allow(pattern)
  const before = await sqlCount(backend, 'select count(*) as n from field_lab')
  await createFieldLab(page, { name: 'Ranges', boundedValue: '150' })
  await expect(page.getByRole('alert').filter({ hasText: 'Error inserting Field Lab: The value for Bounded Value is too large (maximum allowed value is 100)' })).toBeVisible()
  await control(page, 'boundedValue').fill('100')
  await control(page, 'exclusiveBoundedValue').fill('0')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Error inserting Field Lab: The value for Exclusive Bounded Value is too small (minimum allowed value is greater than 0)' })).toBeVisible()
  expect(await sqlCount(backend, 'select count(*) as n from field_lab')).toBe(before)

  await control(page, 'exclusiveBoundedValue').fill('99.5')
  await control(page, 'inclusiveClippedValue').fill('-5')
  await control(page, 'clippedValue').fill('150')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Ranges' })).toBeVisible()
  const id = recordIdFromUrl(page, 'fieldLab')
  expect(await sqlOne(backend, `select bounded_value, exclusive_bounded_value, inclusive_clipped_value, clipped_value from field_lab where id = ${id}`))
    .toEqual({ bounded_value: '100.00', exclusive_bounded_value: '99.50', inclusive_clipped_value: '0.00', clipped_value: '99.99' })

  const clippedLow = await insertFieldLab(backend, { name: 'Ranges Low', inclusiveClippedValue: '250', clippedValue: '0' })
  expect(await sqlOne(backend, `select inclusive_clipped_value, clipped_value from field_lab where id = ${clippedLow}`))
    .toEqual({ inclusive_clipped_value: '100.00', clipped_value: '0.01' })
})

test('[REC-027] unique keys are enforced with the backend message on create and edit @mobile', async ({ page, backend, diagnostics }) => {
  for (const pattern of FIELD_LAB_ERRORS) diagnostics.allow(pattern)
  diagnostics.allow(/\/qqq\/v1\/table\/fieldLab\/\d+ 400/)
  const first = await insertFieldLab(backend, { name: 'Unique One', normalizedKey: 'KEY ONE' })
  const second = await insertFieldLab(backend, { name: 'Unique Two', normalizedKey: 'KEY TWO' })
  const before = await sqlCount(backend, 'select count(*) as n from field_lab')

  await createFieldLab(page, { name: 'Unique One' })
  await expect(page.getByRole('alert').filter({ hasText: 'Error inserting Field Lab: Another record already exists with this Name' })).toBeVisible()
  await expect(control(page, 'name')).toHaveValue('Unique One')
  expect(await sqlCount(backend, 'select count(*) as n from field_lab')).toBe(before)

  // The key is normalized (trim + upper case) before the uniqueness check.
  await openForm(page, `/app/fieldLab/${second}/edit`, 'Edit Field Lab')
  await control(page, 'normalizedKey').fill('  key one ')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Error updating Field Lab: Another record already exists with this Normalized Key' })).toBeVisible()
  await expect(control(page, 'normalizedKey')).toHaveValue('  key one ')
  expect(await sqlOne(backend, `select normalized_key from field_lab where id = ${second}`)).toEqual({ normalized_key: 'KEY TWO' })
  expect(await sqlOne(backend, `select normalized_key from field_lab where id = ${first}`)).toEqual({ normalized_key: 'KEY ONE' })
})

test('[REC-048] a server validation error is shown once with the backend message and keeps the form @mobile', async ({ page, backend, diagnostics }) => {
  for (const pattern of FIELD_LAB_ERRORS) diagnostics.allow(pattern)
  await createFieldLab(page, { name: 'Kept Values', decimalValue: '42.25', boundedValue: '101' })
  const message = 'Error inserting Field Lab: The value for Bounded Value is too large (maximum allowed value is 100)'
  await expect(page.getByRole('alert').filter({ hasText: message })).toBeVisible()
  await expect(toasts(page).filter({ hasText: `Failed to create Field Lab: ${message}` })).toBeVisible()
  await expect(toasts(page)).toHaveCount(1)
  await expect(toasts(page).filter({ hasText: 'Something went wrong' })).toHaveCount(0)
  await expect(toasts(page).filter({ hasText: 'Request failed with status code' })).toHaveCount(0)
  await expect(control(page, 'name')).toHaveValue('Kept Values')
  await expect(control(page, 'decimalValue')).toHaveValue('42.25')
  await expect(page).toHaveURL(/\/app\/fieldLab\/create\/?$/)
  expect(await sqlCount(backend, "select count(*) as n from field_lab where name = 'Kept Values'")).toBe(0)
})
