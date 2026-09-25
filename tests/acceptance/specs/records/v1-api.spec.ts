/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import type { Page, Request } from '@playwright/test'
import { expect, test } from '../../support/fixtures'
import { VIEWER, control, fieldValue, openForm, sqlOne } from './helpers'

test.use(VIEWER)

/** Records every request whose path contains a segment, for asserting which routes the page used. */
function requestsMatching(page: Page, pattern: RegExp): Request[] {
  const requests: Request[] = []
  page.on('request', (request) => { if (pattern.test(new URL(request.url()).pathname)) requests.push(request) })
  return requests
}

test('[REC-049] table-field possible values search and resolve through the v1 API', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const lookups = requestsMatching(page, /\/possibleValues\//)
  await openForm(page, '/app/recordLab/1/edit', 'Edit Record Lab')
  await expect(control(page, 'ownerId')).toHaveText(/^Avery Sample/)
  await control(page, 'ownerId').click()
  await page.getByRole('textbox', { name: 'Search Owner options' }).fill('Casey')
  await expect(page.getByRole('listbox', { name: 'Owner options' }).getByRole('option')).toHaveText(['Casey Sample'])
  await page.getByRole('option', { name: 'Casey Sample', exact: true }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(fieldValue(page, 'ownerId')).toHaveText('Casey Sample')
  expect(await sqlOne(backend, 'select owner_id from record_lab where id = 1')).toEqual({ owner_id: '3' })

  // Every lookup the page made was a v1 POST with a JSON body; the search sent the typed term.
  expect(lookups.length).toBeGreaterThan(0)
  for (const request of lookups) {
    expect(`${request.method()} ${new URL(request.url()).pathname}`).toMatch(/^POST \/qqq\/v1\/table\/recordLab\/possibleValues\/(ownerId|status)$/)
  }
  expect(lookups.map((request) => request.postDataJSON())).toContainEqual(expect.objectContaining({ searchTerm: 'Casey' }))

  // The v1 route resolves ids (table source) and labels (enum source) exactly.
  const owners = '/qqq/v1/table/recordLab/possibleValues/ownerId'
  expect((await (await backend.api.post(owners, { data: { ids: ['3'] } })).json()).options).toEqual([{ id: 3, label: 'Casey Sample' }])
  const statuses = '/qqq/v1/table/recordLab/possibleValues/status'
  expect((await (await backend.api.post(statuses, { data: { labels: ['Active'] } })).json()).options).toEqual([{ id: 'ACTIVE', label: 'Active' }])
})

test.describe('persona without pet access', () => {
  test.use({ persona: 'noPets' })

  test('[REC-049] the v1 possible-value route refuses a source table the user cannot read', async ({ backend, diagnostics }) => {
    void diagnostics
    const denied = await backend.api.post('/qqq/v1/table/petNote/possibleValues/petId', { data: { searchTerm: '' } })
    expect(denied.status()).toBe(403)
    expect(await denied.text()).not.toContain('"options"')
    const unknown = await backend.api.post('/qqq/v1/table/recordLab/possibleValues/noSuchField', { data: {} })
    expect(unknown.status()).toBe(404)
  })
})
