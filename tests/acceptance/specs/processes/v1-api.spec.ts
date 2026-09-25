/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import type { Page, Request } from '@playwright/test'
import { expect, test } from '../../support/fixtures'
import { advance, expectScreen, openProcess, viewValue } from './process-helpers'

const COMPONENTS = 'prcComponents'

/** Records every request whose path matches, for asserting which routes the page used. */
function requestsMatching(page: Page, pattern: RegExp): Request[] {
  const requests: Request[] = []
  page.on('request', (request) => { if (pattern.test(new URL(request.url()).pathname)) requests.push(request) })
  return requests
}

test('[PRC-048] process-field possible values load and search through the v1 API', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const lookups = requestsMatching(page, /\/possibleValues\//)
  await openProcess(page, COMPONENTS)
  await expectScreen(page, 'mixed', 'Mixed Components')
  await page.getByRole('combobox', { name: 'Lab Color' }).click()
  await expect(page.getByRole('listbox', { name: 'Lab Color options' }).getByRole('option')).toHaveText(['Red', 'Green', 'Blue'])
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
