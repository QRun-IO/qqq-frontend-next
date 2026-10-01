/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import type { Page, Request } from '@playwright/test'
import { expect, test } from '../../support/fixtures'
import { advance, expectRunTouchReady, expectScreen, openProcess, viewValue } from './process-helpers'

const COMPONENTS = 'prcComponents'

/** Records every request whose path matches, for asserting which routes the page used. */
function requestsMatching(page: Page, pattern: RegExp): Request[] {
  const requests: Request[] = []
  page.on('request', (request) => { if (pattern.test(new URL(request.url()).pathname)) requests.push(request) })
  return requests
}

test('[PRC-048] process-field possible values load and search through the v1 API @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const lookups = requestsMatching(page, /\/possibleValues\//)
  await openProcess(page, COMPONENTS)
  await expectScreen(page, 'mixed', 'Mixed Components')
  await page.getByRole('combobox', { name: 'Lab Color' }).click()
  await expect(page.getByRole('listbox', { name: 'Lab Color options' }).getByRole('option')).toHaveText(['Red', 'Green', 'Blue'])
  await expectRunTouchReady(page, COMPONENTS)
  await page.getByRole('option', { name: 'Green', exact: true }).click()
  await page.getByLabel('Lab Name').fill('Juniper')
  await advance(page, 'Next')
  const review = await expectScreen(page, 'review', 'Review Lab')
  await expect(viewValue(review, 'labColor')).toHaveText('Green')
  expect(await backend.sql('select name, color from prc_lab_run')).toEqual([{ name: 'Juniper', color: 'green' }])

  expect(lookups.length).toBeGreaterThan(0)
  for (const request of lookups) {
    expect(`${request.method()} ${new URL(request.url()).pathname}`).toBe(`POST /qqq/v1/processes/${COMPONENTS}/possibleValues/labColor`)
  }
  const search = await backend.api.post(`/qqq/v1/processes/${COMPONENTS}/possibleValues/labColor`, { data: { searchTerm: 'gr' } })
  expect((await search.json()).options).toEqual([{ id: 'green', label: 'Green' }])
  const unknown = await backend.api.post(`/qqq/v1/processes/${COMPONENTS}/possibleValues/noSuchField`, { data: {} })
  expect(unknown.status()).toBe(404)
})

test('[PRC-049] a bulk load runs on the v1 process routes: upload, step, back step and process records @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const calls = requestsMatching(page, /\/(processes|metaData\/process)\//)
  await openProcess(page, 'person.bulkInsert')
  await expectScreen(page, 'upload', 'Upload File')
  const csv = 'First Name,Last Name,Email,Is Employed\nVera,Upload,vera.upload@example.invalid,Yes\n'
  await page.locator('input[type="file"]').setInputFiles({ name: 'people.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await expect(page.getByText('people.csv')).toBeVisible()
  await advance(page, 'Next')
  const mapping = await expectScreen(page, 'fileMapping', 'File Mapping')
  await expect(mapping.getByRole('table', { name: 'File preview' })).toContainText('vera.upload@example.invalid')
  await expectRunTouchReady(page, 'person.bulkInsert')
  await advance(page, 'Next')
  await expectScreen(page, 'review', 'Review')
  await expectRunTouchReady(page, 'person.bulkInsert')
  await page.getByRole('button', { name: 'Back' }).click()
  await expectScreen(page, 'fileMapping', 'File Mapping')
  await advance(page, 'Next')
  await expectScreen(page, 'review', 'Review')
  await advance(page, 'Next')
  await expectScreen(page, 'review', 'Review')
  await advance(page, 'Submit')
  await expectScreen(page, 'result', 'Result')
  await expect.poll(async () => (await backend.sql("select count(*) as n from person where email = 'vera.upload@example.invalid'"))[0].n).toBe('1')

  // Every process call was a v1 call, the upload step was multipart, and the back step restarted
  // with isStepBack.
  const paths = calls.map((request) => `${request.method()} ${new URL(request.url()).pathname}${new URL(request.url()).search}`)
  expect(paths.every((path) => / \/qqq\/v1\/(processes|metaData\/process)\//.test(path)), paths.join('\n')).toBe(true)
  // (the mapping screen's preview of the uploaded rows above proves the v1 step stored and read the file;
  // Playwright does not expose a multipart body that carries a file)
  const upload = calls.find((request) => /\/step\/upload$/.test(new URL(request.url()).pathname))!
  expect(upload.method()).toBe('POST')
  expect(upload.headers()['content-type']).toMatch(/^multipart\/form-data; boundary=/)
  expect(paths.some((path) => /^POST \/qqq\/v1\/processes\/person\.bulkInsert\/[^/]+\/step\/[^?]+\?isStepBack=true$/.test(path))).toBe(true)
  expect(paths.some((path) => /^GET \/qqq\/v1\/processes\/person\.bulkInsert\/[^/]+\/records\?/.test(path))).toBe(true)
  expect(paths.some((path) => /\/metaData\/process\/person\.bulkInsert$/.test(path))).toBe(true)
})

test('[PRC-049] the v1 process routes refuse unsafe uploads and unknown runs', async ({ backend, diagnostics }) => {
  void diagnostics
  const unsafe = await backend.api.post('/qqq/v1/processes/person.bulkInsert/init', {
    multipart: { values: '{}', theFile: { name: '../people.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n') } },
  })
  expect(unsafe.status()).toBe(400)
  expect(await unsafe.text()).toContain('Uploaded filename must be a nonempty filename')
  expect((await backend.api.get('/qqq/v1/processes/person.bulkInsert/00000000-0000-0000-0000-000000000000/records?skip=0&limit=5')).status()).toBeGreaterThanOrEqual(400)

  // (another session's run is refused 403 by records and cancel: ProcessCancelSpecV1Test and
  // ProcessRecordsSpecV1Test in qqq-middleware-javalin, which can open two sessions)
  const init = await backend.api.post('/qqq/v1/processes/prcComponents/init', { multipart: { values: '{}' } })
  expect(init.status()).toBe(200)
  const processUUID = (await init.json()).processUUID
  expect((await backend.api.post(`/qqq/v1/processes/prcComponents/${processUUID}/cancel`)).status()).toBe(200)
})
