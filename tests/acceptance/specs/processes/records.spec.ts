/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, open, test } from '../../support/fixtures'
import { advance, expectScreen, openProcess, recordRows, run, viewValue } from './process-helpers'

const NOBODY = { criteria: [{ fieldName: 'firstName', operator: 'EQUALS', values: ['Nobody'] }], booleanOperator: 'AND' }

test.describe('Record selection', () => {
  test('[PRC-002] a filter selection with no criteria runs on every record', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'greetInteractive', { filter: { criteria: [] } })
    await expectScreen(page, 'setup', 'Setup')
    await page.getByLabel('Greeting Prefix').fill('Hi')
    await advance(page, 'Submit')
    const results = await expectScreen(page, 'results', 'Results')
    const people = await backend.sql('select id, first_name from person order by id')
    await expect(viewValue(results, 'noOfPeopleGreeted')).toHaveText(String(people.length))
    await expect.poll(async () => (await recordRows(results)).map((row) => row[1])).toEqual(people.map((person) => person.first_name))
  })

  test('[PRC-003] a selection that matches no records runs with zero records', async ({ page, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'clonePeople', { filter: NOBODY })
    const review = await expectScreen(page, 'review', 'Review')
    await expect(review.locator('[data-qqq-id="process-validation-input"]')).toHaveText('Input: 0 Person records.')
    await expect(review.getByText('No record previews are available at this time.')).toBeVisible()
    await advance(page, 'Next')
    const validated = await expectScreen(page, 'review', 'Review')
    await expect(validated.locator('[data-qqq-id="process-validation-complete"]')).toHaveText('Validation complete on 0 Person records.')
    await expect(validated.locator('[data-qqq-id="process-summary-lines"]')).toHaveCount(0)
    await advance(page, 'Submit')
    const result = await expectScreen(page, 'result', 'Result')
    await expect(result.locator('[data-qqq-id="process-summary-record-count"]')).toHaveText('0 Person records were processed.')

    // a record-list step with no input records is refused by the backend
    await openProcess(page, 'greetInteractive', { filter: NOBODY })
    await expectScreen(page, 'setup', 'Setup')
    await advance(page, 'Submit')
    await expect(page.locator('[data-qqq-id="process-error-message"]')).toHaveText('Missing input records.')
  })

  test('[PRC-004] processes launched from an app run without records @mobile', async ({ page, diagnostics }) => {
    void diagnostics
    await open(page, '/app/prcLab')
    await page.locator('[data-qqq-id="app-section-process-prcComponents"]').click()
    await expect(page).toHaveURL(/\/app\/prcComponents\/?$/)
    await expectScreen(page, 'mixed', 'Mixed Components')

    // a table process that loads its input records at init refuses to start without any
    await openProcess(page, 'greetInteractive')
    await expect(page.locator('[data-qqq-id="process-error-message"]')).toHaveText('Missing input records.')
  })

  test('[PRC-005] a process launched from selected table rows receives them', async ({ page, diagnostics }) => {
    void diagnostics
    await open(page, '/app/person')
    const grid = page.getByRole('grid', { name: 'Person records' })
    await expect(grid.getByRole('gridcell', { name: 'Blair', exact: true })).toBeVisible()
    await page.getByRole('checkbox', { name: 'Select Avery Sample' }).check()
    await page.getByRole('checkbox', { name: 'Select Casey Sample' }).check()
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByRole('menu', { name: 'Actions' }).getByRole('menuitem', { name: 'Greet Interactive' }).click()
    await expectScreen(page, 'setup', 'Setup')
    await page.getByLabel('Greeting Prefix').fill('Yo')
    await advance(page, 'Submit')
    const results = await expectScreen(page, 'results', 'Results')
    await expect.poll(() => recordRows(results)).toEqual([['1', 'Avery', 'Yo Avery null'], ['3', 'Casey', 'Yo Casey null']])
  })

  test('[PRC-006] minimum and maximum input records are enforced', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const inits: string[] = []
    page.on('request', (request) => { if (request.url().includes('/processes/prcBounds/init')) inits.push(request.url()) })
    await openProcess(page, 'prcBounds')
    const error = page.locator('[data-qqq-id="process-error-prcBounds"]')
    await expect(error.locator('[data-qqq-id="process-error-message"]')).toHaveText('This process requires at least 1 record to be selected, but none were selected.')
    await openProcess(page, 'prcBounds', { recordIds: [1, 2, 3] })
    await expect(error.locator('[data-qqq-id="process-error-message"]')).toHaveText('This process allows at most 2 records to be selected, but 3 were selected.')
    expect(inits).toEqual([])

    await openProcess(page, 'prcBounds', { recordIds: [1, 3] })
    const picked = await expectScreen(page, 'picked', 'Picked Specimens')
    await expect(viewValue(picked, 'selectedCount')).toHaveText('2')
    await expect(viewValue(picked, 'selectedNames')).toHaveText('Alpha, Gamma')
    await expect.poll(() => recordRows(picked)).toEqual([['1', 'Alpha'], ['3', 'Gamma']])

    // a filter selection cannot be counted in the browser; the backend refuses it
    await openProcess(page, 'prcBounds', { filter: { criteria: [] } })
    await expect(error.locator('[data-qqq-id="process-error-message"]')).toHaveText('Too many records were selected for this process.  At most, only 2 can be selected.')
    const tooFew = await backend.api.post('/processes/prcBounds/init', { multipart: { recordsParam: 'filterJSON', filterJSON: JSON.stringify({ criteria: [{ fieldName: 'name', operator: 'EQUALS', values: ['Nobody'] }], booleanOperator: 'AND' }), tableName: 'prcSpecimen' } })
    expect((await tooFew.json()).userFacingError).toBe('Too few records were selected for this process.  At least 1 must be selected.')
  })

  test('[PRC-025] record lists page through the process records', async ({ page, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'prcManyRows')
    const rows = await expectScreen(page, 'rows', 'Rows')
    await expect(viewValue(rows, 'rowCount')).toHaveText('23')
    const range = rows.locator('[data-qqq-id="process-record-list-range"]')
    await expect(range).toHaveText('1–10 of 23')
    await expect.poll(async () => (await recordRows(rows)).map((row) => row[1])).toEqual(Array.from({ length: 10 }, (_, i) => `Row ${i + 1}`))
    await rows.getByRole('button', { name: 'Next page of records' }).click()
    await expect(range).toHaveText('11–20 of 23')
    await rows.getByRole('button', { name: 'Next page of records' }).click()
    await expect(range).toHaveText('21–23 of 23')
    await expect.poll(async () => (await recordRows(rows)).map((row) => row[1])).toEqual(['Row 21', 'Row 22', 'Row 23'])
    await expect(rows.getByRole('button', { name: 'Next page of records' })).toBeDisabled()
    await rows.getByRole('button', { name: 'Previous page of records' }).click()
    await expect(range).toHaveText('11–20 of 23')
    await rows.getByLabel('Rows per page').selectOption('25')
    await expect(range).toHaveText('1–23 of 23')
    await expect.poll(async () => (await recordRows(rows)).length).toBe(23)
  })

  test('[PRC-043] default process values from the link preset inputs', async ({ page, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'sleepInteractive', undefined, { defaultProcessValues: JSON.stringify({ sleepMillis: 3500 }) })
    await expectScreen(page, 'screen0', 'Screen 0')
    await advance(page, 'Submit')
    await expect(page.locator('[data-qqq-id="process-working"]')).toBeVisible()
    await expectScreen(page, 'screen1', 'Screen 1')
    await expect(page.getByRole('button', { name: 'Return' })).toBeVisible()

    await openProcess(page, 'prcComponents', undefined, { defaultProcessValues: JSON.stringify({ labName: 'Preset Lab' }) })
    const mixed = await expectScreen(page, 'mixed', 'Mixed Components')
    await expect(mixed.getByLabel('Lab Name')).toHaveValue('Preset Lab')
    await expect(run(page, 'prcComponents')).toHaveAttribute('data-process-phase', 'step')
  })
})
