/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { readFileSync } from 'node:fs'
import type { APIRequestContext, Page } from '@playwright/test'
import { expect, test } from '../../support/fixtures'
import { advance, expectScreen, openProcess } from './process-helpers'

/**
 * Insert a person through the backend (independent of the UI under test).
 * @param api - Backend request context.
 * @param firstName - First name.
 * @returns The new id.
 */
async function insertPerson(api: APIRequestContext, firstName: string): Promise<number> {
  const response = await api.post('/data/person', { multipart: { firstName, lastName: 'Lab', email: `${firstName.replace(/\W+/g, '').toLowerCase()}@example.invalid` } })
  expect(response.status()).toBe(200)
  return (await response.json()).records[0].values.id
}

/**
 * Text of each summary line with its status.
 * @param page - The page.
 * @returns `STATUS text` per line.
 */
async function summaryLines(page: Page): Promise<string[]> {
  const lines = page.locator('[data-qqq-id^="process-summary-line-"]')
  const count = await lines.count()
  const result: string[] = []
  for (let i = 0; i < count; i++) {
    const line = lines.nth(i)
    result.push(`${await line.getAttribute('data-status')} ${(await line.innerText()).replace(/^(OK|Info|Warning|Error):\s*/, '').trim()}`)
  }
  return result
}

/**
 * Upload a CSV on the bulk upload screen.
 * @param page - The page.
 * @param csv - File content.
 */
async function uploadCsv(page: Page, csv: string) {
  await page.locator('input[type="file"]').setInputFiles({ name: 'people.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await expect(page.getByText('people.csv')).toBeVisible()
}

test.describe('Streamed ETL review and results (clonePeople)', () => {
  test('[PRC-026] the review screen counts input, offers validation and previews records', async ({ page, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'clonePeople', { recordIds: [1, 2] })
    const review = await expectScreen(page, 'review', 'Review')
    await expect(review.locator('[data-qqq-id="process-validation-input"]')).toHaveText('Input: 2 Person records.')
    const validate = review.getByRole('radio', { name: /Perform Validation on all records before processing/ })
    const skip = review.getByRole('radio', { name: /Skip Validation\. Submit the records for immediate processing/ })
    await expect(validate).toBeChecked()
    await expect(page.locator('[data-qqq-id="button-next"]')).toHaveText('Next')
    await skip.check()
    await expect(page.locator('[data-qqq-id="button-next"]')).toHaveText('Submit')
    await validate.check()
    await expect(page.locator('[data-qqq-id="button-next"]')).toHaveText('Next')

    const preview = review.getByRole('region', { name: 'Preview' })
    await expect(preview.getByText('This is a preview of what the clones will look like.')).toBeVisible()
    await expect(preview.locator('[data-qqq-id="process-preview-field-firstName"]')).toHaveText('First Name: Clone of: Avery')
    await expect(preview.locator('[data-qqq-id="process-preview-position"]')).toHaveText('Preview 1 of 2')
    await expect(preview.getByRole('button', { name: 'Previous preview record' })).toBeDisabled()
    await preview.getByRole('button', { name: 'Next preview record' }).click()
    await expect(preview.locator('[data-qqq-id="process-preview-field-firstName"]')).toHaveText('First Name: Clone of: Blair')
    await expect(preview.locator('[data-qqq-id="process-preview-position"]')).toHaveText('Preview 2 of 2')
  })

  test('[PRC-027] full validation reports OK, warning and error lines from the transform', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const cloneId = await insertPerson(backend.api, 'Clone of: Quinn')
    const nestedId = await insertPerson(backend.api, 'Clone of: Clone of: Riley')
    await openProcess(page, 'clonePeople', { recordIds: [1, 5, cloneId, nestedId] })
    await expectScreen(page, 'review', 'Review')
    await advance(page, 'Next')
    const validated = await expectScreen(page, 'review', 'Review')
    await expect(validated.locator('[data-qqq-id="process-validation-complete"]')).toHaveText('Validation complete on 4 Person records.')
    await expect.poll(() => summaryLines(page)).toEqual([
      'OK 1 can be cloned with no issues.',
      'WARNING 1 can be cloned, but because are already a clone, their clone cannot be cloned in the future.',
      'ERROR 1 declined cloning in this sample scenario',
      'ERROR 1 are already a clone of a clone, so they can\'t be cloned again.',
    ])
    const link = page.locator('[data-qqq-id="process-summary-records-link-2"]')
    await expect(link).toHaveAttribute('target', '_blank')
    const href = await link.getAttribute('href')
    expect(href).toMatch(/^\/app\/person\?filter=/)
    const filter = JSON.parse(Buffer.from(decodeURIComponent(href!.split('filter=')[1]), 'base64').toString('utf8'))
    expect(filter.criteria).toEqual([{ fieldName: 'id', operator: 'IN', values: [5] }])
    await expect(page.locator('[data-qqq-id="button-next"]')).toHaveText('Submit')
    expect(await backend.sql("select count(*) as n from person where first_name like 'Clone of: Avery'")).toEqual([{ n: '0' }])
  })

  test('[PRC-028] executing shows the process summary and persists the clones', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const cloneId = await insertPerson(backend.api, 'Clone of: Quinn')
    const nestedId = await insertPerson(backend.api, 'Clone of: Clone of: Riley')
    await openProcess(page, 'clonePeople', { recordIds: [1, 5, cloneId, nestedId] })
    await expectScreen(page, 'review', 'Review')
    await advance(page, 'Next')
    await expectScreen(page, 'review', 'Review')
    await advance(page, 'Submit')
    const result = await expectScreen(page, 'result', 'Result')
    await expect(result.getByRole('heading', { name: 'Process Summary' })).toBeVisible()
    await expect(result.locator('[data-qqq-id="process-summary-record-count"]')).toHaveText('4 Person records were processed.')
    await expect.poll(() => summaryLines(page)).toEqual([
      'OK 1 were cloned',
      'WARNING 1 were already a clone, so they were cloned again now, but their clones cannot be cloned after this.',
      'ERROR 1 declined cloning in this sample scenario',
      'ERROR 1 are already a clone of a clone, so they weren\'t cloned again.',
    ])
    await expect(page.getByRole('button', { name: 'Return' })).toBeVisible()
    expect(await backend.sql("select first_name from person where first_name like 'Clone of%' order by id")).toEqual([
      { first_name: 'Clone of: Quinn' }, { first_name: 'Clone of: Clone of: Riley' },
      { first_name: 'Clone of: Avery' }, { first_name: 'Clone of: Clone of: Quinn' },
    ])

    // skipping validation executes immediately
    await openProcess(page, 'clonePeople', { recordIds: [2] })
    const review = await expectScreen(page, 'review', 'Review')
    await review.getByRole('radio', { name: /Skip Validation/ }).check()
    await advance(page, 'Submit')
    await expectScreen(page, 'result', 'Result')
    await expect.poll(() => summaryLines(page)).toEqual(['OK 1 were cloned'])
    expect(await backend.sql("select count(*) as n from person where first_name = 'Clone of: Blair'")).toEqual([{ n: '1' }])
  })
})

test.describe('Bulk edit and delete', () => {
  test('[PRC-029] bulk edit updates only the switched-on fields of the selected records', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const steps: string[] = []
    page.on('request', (request) => { if (request.url().includes('/step/')) steps.push(request.postData() ?? '') })
    await openProcess(page, 'person.bulkEdit', { recordIds: [1, 2] })
    const edit = await expectScreen(page, 'edit', 'Edit Values')
    const types = await edit.locator('[data-component-type]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-component-type')))
    expect(types).toEqual(['HELP_TEXT', 'BULK_EDIT_FORM'])
    await expect(edit.locator('[data-qqq-id="process-help-text-0"]')).toContainText('Flip the switches next to the fields that you want to edit.')
    await expect(edit.getByLabel('Days Worked', { exact: true })).toBeDisabled()
    await advance(page, 'Next')
    await expect(edit.getByText('You must edit at least one field to continue.')).toBeVisible()
    expect(steps).toEqual([])

    await edit.getByRole('switch', { name: 'Edit Days Worked' }).check()
    await edit.getByLabel('Days Worked', { exact: true }).fill('4242')
    await edit.getByRole('switch', { name: 'Edit Is Employed' }).check()
    // the boolean input cycles unset -> yes -> no
    const employed = edit.getByRole('checkbox', { name: 'Is Employed', exact: true })
    await employed.click()
    await employed.click()
    await expect(employed).toHaveAttribute('aria-checked', 'false')
    await advance(page, 'Next')
    const review = await expectScreen(page, 'review', 'Review')
    await expect(review.locator('[data-qqq-id="process-validation-input"]')).toHaveText('Input: 2 Person records.')
    const enabled = /name="bulkEditEnabledFields"\r\n\r\n([^\r]*)/.exec(steps[0])?.[1]
    expect(enabled?.split(',').sort()).toEqual(['daysWorked', 'isEmployed'])
    expect(steps[0]).not.toContain('name="firstName"')
    await review.getByRole('radio', { name: /Skip Validation/ }).check()
    await advance(page, 'Submit')
    await expectScreen(page, 'result', 'Result')
    // one INFO line per edited field, in the backend's field order
    await expect.poll(async () => { const [first, ...rest] = await summaryLines(page); return [first, ...rest.sort()] }).toEqual([
      'OK 2 Person records were edited.',
      'INFO Days Worked was set to: 4,242',
      'INFO Is Employed was set to: No',
    ])
    expect(await backend.sql('select id, first_name, days_worked, is_employed from person where id <= 3 order by id')).toEqual([
      { id: '1', first_name: 'Avery', days_worked: '4242', is_employed: 'FALSE' },
      { id: '2', first_name: 'Blair', days_worked: '4242', is_employed: 'FALSE' },
      { id: '3', first_name: 'Casey', days_worked: '100100', is_employed: 'TRUE' },
    ])
  })

  test('[PRC-030] bulk delete removes only the selected records', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'person.bulkDelete', { recordIds: [4, 5] })
    const review = await expectScreen(page, 'review', 'Review')
    await expect(review.locator('[data-qqq-id="process-validation-input"]')).toHaveText('Input: 2 Person records.')
    await expect(review.getByText('This is a preview of the records that will be deleted.')).toBeVisible()
    await advance(page, 'Next')
    await expectScreen(page, 'review', 'Review')
    await expect.poll(() => summaryLines(page)).toEqual(['OK 2 Person records will be deleted.'])
    expect(await backend.sql('select count(*) as n from person')).toEqual([{ n: '5' }])
    await advance(page, 'Submit')
    await expectScreen(page, 'result', 'Result')
    await expect.poll(() => summaryLines(page)).toEqual(['OK 2 Person records were deleted.'])
    expect(await backend.sql('select id from person order by id')).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }])
  })
})

test.describe('Bulk load', () => {
  const CSV = 'First Name,Last Name,Email,Is Employed\nQuinn,Lab,quinn@example.invalid,Yes\nRiley,Lab,riley@example.invalid,No\n'

  test('[PRC-031] bulk insert uploads, maps columns and values, reviews and inserts', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'person.bulkInsert')
    const upload = await expectScreen(page, 'upload', 'Upload File')
    await expect(upload.locator('[data-qqq-id="process-html-0"] summary')).toHaveText('File Upload Instructions')
    await advance(page, 'Next')
    await expect(upload.getByText('Person File is required')).toBeVisible()
    await uploadCsv(page, CSV)
    await advance(page, 'Next')

    const mapping = await expectScreen(page, 'fileMapping', 'File Mapping')
    await expect(mapping.locator('[data-qqq-id="bulk-load-file-name"]')).toHaveText('File Name: people.csv')
    await expect(mapping.locator('[data-qqq-id="bulk-load-file-details"]')).toHaveText('File Details: 4 columns')
    await expect(mapping.getByRole('table', { name: 'File preview' })).toContainText('quinn@example.invalid')
    await expect(mapping.getByLabel('Does the file have a header row? *')).toBeChecked()
    await expect(mapping.locator('[data-qqq-id="select-bulk-load-layout"]')).toHaveValue('FLAT')
    await expect(mapping.getByLabel('Column for First Name')).toHaveValue('0')
    await expect(mapping.getByLabel('Column for Email')).toHaveValue('2')
    await expect(mapping.locator('[data-qqq-id="bulk-load-preview-firstName"]')).toHaveText('Preview: Quinn, Riley')
    await mapping.locator('[data-qqq-id="checkbox-bulk-load-map-values-isEmployed"]').check()
    await advance(page, 'Next')

    const values = await expectScreen(page, 'valueMapping', 'Value Mapping: Is Employed (1 of 1)')
    await values.getByLabel('Is Employed value for Yes').selectOption('true')
    await values.getByLabel('Is Employed value for No').selectOption('false')
    await advance(page, 'Next')

    const review = await expectScreen(page, 'review', 'Review')
    const types = await review.locator('[data-component-type]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-component-type')))
    expect(types).toEqual(['BULK_LOAD_PROFILE_FORM', 'VALIDATION_REVIEW_SCREEN'])
    await expect(review.locator('[data-qqq-id="bulk-load-profile-name"]')).toHaveText('You are not using a saved bulk load profile.')
    await expect(review.locator('[data-qqq-id="bulk-load-profile-fields"]')).toContainText('Is Employed from Is Employed (values mapped)')
    const preview = review.getByRole('region', { name: 'Preview' })
    await expect(preview.getByText('This is a preview of the records that will be created.')).toBeVisible()
    await expect(preview.getByRole('heading', { name: 'Identity' })).toBeVisible()
    await expect(preview.locator('[data-qqq-id="process-preview-field-firstName"]')).toHaveText('First Name: Quinn')
    await advance(page, 'Next')
    await expectScreen(page, 'review', 'Review')
    await expect.poll(() => summaryLines(page)).toEqual(['INFO 2 records were processed from the file.', 'OK 2 Person records will be inserted.'])
    await advance(page, 'Submit')
    await expectScreen(page, 'result', 'Result')
    await expect.poll(() => summaryLines(page)).toEqual([
      'INFO 2 records were processed from the file.', 'OK 2 Person records were inserted.', 'INFO Inserted Id values between 6 and 7',
    ])
    expect(await backend.sql('select id, first_name, email, is_employed from person where id > 5 order by id')).toEqual([
      { id: '6', first_name: 'Quinn', email: 'quinn@example.invalid', is_employed: 'TRUE' },
      { id: '7', first_name: 'Riley', email: 'riley@example.invalid', is_employed: 'FALSE' },
    ])
  })

  test('[PRC-032] bulk mapping validates required mappings and back returns to the mapping', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const steps: string[] = []
    page.on('request', (request) => { if (request.url().includes('/step/fileMapping')) steps.push(request.url()) })
    await openProcess(page, 'person.bulkInsert')
    await expectScreen(page, 'upload', 'Upload File')
    await uploadCsv(page, CSV)
    await advance(page, 'Next')
    const mapping = await expectScreen(page, 'fileMapping', 'File Mapping')
    await mapping.getByLabel('Column for Email').selectOption('')
    await advance(page, 'Next')
    await expect(mapping.locator('[data-qqq-id="bulk-load-field-email"]').getByRole('alert')).toHaveText('You must select a column.')
    expect(steps).toEqual([])
    await mapping.getByLabel('Column for Email').selectOption('2')
    await advance(page, 'Next')
    await expectScreen(page, 'review', 'Review')
    await page.getByRole('button', { name: 'Back' }).click()
    const again = await expectScreen(page, 'fileMapping', 'File Mapping')
    await expect(again.getByLabel('Column for Email')).toHaveValue('2')
    await page.getByRole('button', { name: 'Back' }).click()
    await expectScreen(page, 'upload', 'Upload File')
    expect(await backend.sql('select count(*) as n from person')).toEqual([{ n: '5' }])
  })

  test('[PRC-033] bulk edit with a file updates the records matched by the key field', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'person.bulkEditWithFile')
    await expectScreen(page, 'upload', 'Upload File')
    await uploadCsv(page, 'Id,Days Worked\n1,11\n3,33\n')
    await advance(page, 'Next')
    const mapping = await expectScreen(page, 'fileMapping', 'File Mapping')
    await mapping.locator('[data-qqq-id="select-bulk-load-key-fields"]').selectOption('id')
    await expect(mapping.getByLabel('Column for Id')).toHaveValue('0')
    await expect(mapping.getByLabel('Column for Days Worked')).toHaveValue('1')
    await advance(page, 'Next')
    const review = await expectScreen(page, 'review', 'Review')
    await review.getByRole('radio', { name: /Skip Validation/ }).check()
    await advance(page, 'Submit')
    await expectScreen(page, 'result', 'Result')
    expect(await backend.sql('select id, days_worked from person order by id')).toEqual([
      { id: '1', days_worked: '11' }, { id: '2', days_worked: '10100' }, { id: '3', days_worked: '33' }, { id: '4', days_worked: '75' }, { id: '5', days_worked: '1' },
    ])
  })

  test('[PRC-046] saved bulk load profiles are saved, chosen for a later load, and deleted', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'person.bulkInsert')
    await expectScreen(page, 'upload', 'Upload File')
    await uploadCsv(page, CSV)
    await advance(page, 'Next')
    const mapping = await expectScreen(page, 'fileMapping', 'File Mapping')
    const profiles = mapping.getByRole('region', { name: 'Saved Bulk Load Profiles' })
    await expect(profiles.locator('[data-qqq-id="saved-bulk-load-profile-current"]')).toHaveText('You are not using a saved bulk load profile.')
    await mapping.locator('[data-qqq-id="checkbox-bulk-load-map-values-isEmployed"]').check()
    await profiles.getByRole('button', { name: 'Save As...' }).click()
    await profiles.getByLabel('Profile Name').fill('Lab People CSV')
    await profiles.getByRole('button', { name: 'Save Profile' }).click()
    await expect(profiles.locator('[data-qqq-id="saved-bulk-load-profile-message"]')).toHaveText('Profile Saved.')
    await expect(page.locator('[data-qqq-id="process-step-heading"]')).toHaveText('File Mapping / Lab People CSV')
    const [saved] = await backend.sql('select id, label, table_name, user_id, is_bulk_edit, mapping_json from saved_bulk_load_profile')
    expect(saved).toMatchObject({ label: 'Lab People CSV', table_name: 'person', user_id: 'sample:alice', is_bulk_edit: 'FALSE' })
    expect(JSON.parse(saved.mapping_json!).fieldList).toContainEqual(expect.objectContaining({ fieldName: 'isEmployed', columnIndex: 3, doValueMapping: true }))

    // the same name again is refused by the backend
    await profiles.getByRole('button', { name: 'Save As...' }).click()
    await profiles.getByLabel('Profile Name').fill('Lab People CSV')
    await profiles.getByRole('button', { name: 'Save Profile' }).click()
    await expect(profiles.locator('[data-qqq-id="saved-bulk-load-profile-error"]')).toHaveText('You already have a saved Bulk Load Profile on this table with this name.')
    expect(await backend.sql('select count(*) as n from saved_bulk_load_profile')).toEqual([{ n: '1' }])

    // a later load chooses the saved profile, which restores its mapping and names it on review
    await openProcess(page, 'person.bulkInsert')
    await expectScreen(page, 'upload', 'Upload File')
    await uploadCsv(page, CSV)
    await advance(page, 'Next')
    const again = await expectScreen(page, 'fileMapping', 'File Mapping')
    await expect(again.locator('[data-qqq-id="checkbox-bulk-load-map-values-isEmployed"]')).not.toBeChecked()
    await again.getByLabel('Saved bulk load profile', { exact: true }).selectOption({ label: 'Lab People CSV' })
    await expect(again.locator('[data-qqq-id="checkbox-bulk-load-map-values-isEmployed"]')).toBeChecked()
    await advance(page, 'Next')
    const values = await expectScreen(page, 'valueMapping', 'Value Mapping: Is Employed (1 of 1)')
    await values.getByLabel('Is Employed value for Yes').selectOption('true')
    await values.getByLabel('Is Employed value for No').selectOption('false')
    await advance(page, 'Next')
    const review = await expectScreen(page, 'review', 'Review')
    await expect(review.locator('[data-qqq-id="bulk-load-profile-name"]')).toHaveText('You are using the bulk load profile: Lab People CSV')

    // deleting from the mapping screen removes it
    await page.getByRole('button', { name: 'Back' }).click()
    const back = await expectScreen(page, 'fileMapping', 'File Mapping / Lab People CSV')
    await back.getByRole('button', { name: 'Delete...' }).click()
    await back.getByRole('button', { name: 'Delete Profile' }).click()
    await expect(back.locator('[data-qqq-id="saved-bulk-load-profile-message"]')).toHaveText('Profile Deleted.')
    expect(await backend.sql('select count(*) as n from saved_bulk_load_profile')).toEqual([{ n: '0' }])
  })

  test('[PRC-034] upload instructions offer a downloadable template file', async ({ page, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'person.bulkInsert')
    const upload = await expectScreen(page, 'upload', 'Upload File')
    await upload.getByText('File Upload Instructions').click()
    const template = upload.getByRole('link', { name: 'Person - Flat.csv' })
    const [download] = await Promise.all([page.waitForEvent('download'), template.click()])
    expect(download.suggestedFilename()).toBe('Person - Flat.csv')
    expect(readFileSync(await download.path(), 'utf8').split('\n')[0]).toBe('Email,First Name,Last Name,Annual Salary,Birth Date,Days Worked,Is Employed')
  })
})
