/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import type { Page, Request } from '@playwright/test'
import { expect, test } from '../../support/fixtures'
import { VIEWER, control, fieldValue, multipartFields, openForm, openRecord, recordAction, recordIdFromUrl, sqlCount, sqlOne } from './helpers'

test.use(VIEWER)

/** Records every request whose path contains a segment, for asserting which routes the page used. */
function requestsMatching(page: Page, pattern: RegExp): Request[] {
  const requests: Request[] = []
  page.on('request', (request) => { if (pattern.test(new URL(request.url()).pathname)) requests.push(request) })
  return requests
}

test('[REC-051] table-field possible values search and resolve through the v1 API', async ({ page, backend, diagnostics }) => {
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

  test('[REC-051] the v1 possible-value route refuses a source table the user cannot read', async ({ backend, diagnostics }) => {
    void diagnostics
    const denied = await backend.api.post('/qqq/v1/table/petNote/possibleValues/petId', { data: { searchTerm: '' } })
    expect(denied.status()).toBe(403)
    expect(await denied.text()).not.toContain('"options"')
    const unknown = await backend.api.post('/qqq/v1/table/recordLab/possibleValues/noSuchField', { data: {} })
    expect(unknown.status()).toBe(404)
  })
})

test('[REC-050] create, view, edit and delete run on the v1 record routes', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const records = requestsMatching(page, /^\/(qqq\/v1\/table|data)\/person(\/|$)/)
  await openForm(page, '/app/person/create', 'Create Person')
  await control(page, 'firstName').fill('Vera')
  await control(page, 'lastName').fill('Version')
  await control(page, 'email').fill('vera@example.invalid')
  await page.getByRole('checkbox', { name: 'Is Employed' }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Vera Version' })).toBeVisible()
  const id = recordIdFromUrl(page, 'person')
  expect(await sqlOne(backend, `select first_name, last_name, email from person where id = ${id}`)).toEqual({ first_name: 'Vera', last_name: 'Version', email: 'vera@example.invalid' })

  await openForm(page, `/app/person/${id}/edit`, 'Edit Person')
  await control(page, 'firstName').fill('Verity')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Verity Version' })).toBeVisible()
  expect(await sqlOne(backend, `select first_name from person where id = ${id}`)).toEqual({ first_name: 'Verity' })

  await openRecord(page, 'person', id, 'Verity Version')
  await recordAction(page, 'Delete', 'Person')
  await page.locator('[data-qqq-id="delete-confirm-dialog"]').getByRole('button', { name: 'Delete' }).click()
  await expect(page).toHaveURL(/\/app\/person\/?$/)
  expect(await sqlCount(backend, `select count(*) as n from person where id = ${id}`)).toBe(0)

  // Every record request used the v1 routes: POST insert, GET view, PATCH update, DELETE.
  const calls = records.filter((request) => !/\/(query|count)$/.test(new URL(request.url()).pathname))
    .map((request) => `${request.method()} ${new URL(request.url()).pathname}`)
  expect(calls.every((call) => /^[A-Z]+ \/qqq\/v1\/table\/person(\/|$)/.test(call))).toBe(true)
  expect(calls).toContain('POST /qqq/v1/table/person')
  expect(calls).toContain(`GET /qqq/v1/table/person/${id}`)
  expect(calls).toContain(`PATCH /qqq/v1/table/person/${id}`)
  expect(calls).toContain(`DELETE /qqq/v1/table/person/${id}`)
  const patch = records.find((request) => request.method() === 'PATCH')!
  expect(multipartFields(patch).firstName).toBe('Verity')
})

test('[REC-050] the v1 record routes enforce required fields and write associations', async ({ backend, diagnostics }) => {
  void diagnostics
  const before = await sqlCount(backend, 'select count(*) as n from field_lab')
  const missing = await backend.api.post('/qqq/v1/table/fieldLab', { multipart: { longValue: '5' } })
  expect(missing.status()).toBe(400)
  expect(await missing.json()).toEqual({ error: 'Error inserting Field Lab: Missing value in required field: Name' })
  expect(await sqlCount(backend, 'select count(*) as n from field_lab')).toBe(before)

  const household = await backend.api.post('/qqq/v1/table/qryHousehold', {
    headers: { 'X-QQQ-Association-Format': 'record-v1' },
    multipart: { name: 'Versioned Home', code: 'V1', associations: JSON.stringify({ members: [{ values: { name: 'Nested Member' } }] }) },
  })
  expect(household.status()).toBe(200)
  const saved = (await household.json()).record
  expect(saved.values.name).toBe('Versioned Home')
  expect(saved.associatedRecords.members.map((member: { values: { name: string } }) => member.values.name)).toEqual(['Nested Member'])
  expect(await backend.sql(`select name, household_id from qry_member where household_id = ${saved.values.id}`)).toEqual([{ name: 'Nested Member', household_id: String(saved.values.id) }])

  const fetched = await backend.api.get(`/qqq/v1/table/qryHousehold/${saved.values.id}?includeAssociations=true`)
  expect((await fetched.json()).record.associatedRecords.members.map((member: { values: { name: string } }) => member.values.name)).toEqual(['Nested Member'])
})

test.describe('read-only persona on v1', () => {
  test.use({ persona: 'viewer' })

  test('[REC-050] the v1 record routes refuse writes the persona may not make', async ({ backend, diagnostics }) => {
    void diagnostics
    const before = await sqlOne(backend, 'select first_name from person where id = 1')
    expect((await backend.api.post('/qqq/v1/table/person', { multipart: { firstName: 'Mallory', lastName: 'Denied' } })).status()).toBe(403)
    expect((await backend.api.patch('/qqq/v1/table/person/1', { multipart: { firstName: 'Mallory' } })).status()).toBe(403)
    expect((await backend.api.delete('/qqq/v1/table/person/1')).status()).toBe(403)
    expect(await sqlOne(backend, 'select first_name from person where id = 1')).toEqual(before)
    expect(await sqlCount(backend, "select count(*) as n from person where first_name = 'Mallory'")).toBe(0)
    const read = await backend.api.get('/qqq/v1/table/person/1')
    expect(read.status()).toBe(200)
    expect((await read.json()).record.values.firstName).toBe(before.first_name)
  })
})
