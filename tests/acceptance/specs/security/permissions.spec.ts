/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Permission enforcement on the stock sample with the shared acceptance personas:
// the UI must not offer what is denied, direct links must not load or run it, and
// the backend must refuse it with nothing written.
import type { Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { allowExternalQuickSightWidget, listCell, listRows, navigation, recordRequests } from './support/ui'

const personGrid = (page: Page) => page.getByRole('grid', { name: 'Person records' })
const personCount = async (sql: (query: string) => Promise<Record<string, string | null>[]>) => Number((await sql('select count(*) as n from person'))[0].n)

test.describe('viewer persona (read only, no processes)', () => {
  test.use({ persona: 'viewer' })

  test('[SEC-003] create is not offered, the create link is refused and the backend writes nothing', async ({ page, backend, diagnostics }) => {
    allowExternalQuickSightWidget(diagnostics)
    const before = await personCount(backend.sql)
    await open(page, '/app/person')
    await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create new Person record' })).toHaveCount(0)

    await open(page, '/app/person/create')
    await expect(page.locator('[data-qqq-id="permission-denied"]')).toHaveText('You do not have permission to create Person records.')
    await expect(page.getByRole('textbox')).toHaveCount(0)

    await open(page, '/app')
    await expect(page.locator('[data-qqq-id="dashboard-home"]')).toBeVisible()
    await expect(page.locator('[data-qqq-id="dashboard-create-person"]')).toHaveCount(0)

    const insert = await backend.api.post('/data/person', { multipart: { firstName: 'Mallory', lastName: 'Denied', email: 'mallory@example.invalid' } })
    expect(insert.status()).toBe(403)
    expect(await personCount(backend.sql)).toBe(before)
    expect(await backend.sql("select id from person where first_name = 'Mallory'")).toEqual([])
  })

  test('[SEC-004] edit is not offered, the edit link is refused and the backend changes nothing', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const reads = recordRequests(page)
    await open(page, '/app/person/1')
    await expect(page.getByRole('heading', { name: /Avery/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit Person record' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Edit Person record' })).toHaveCount(0)

    reads.length = 0
    await open(page, '/app/person/1/edit')
    await expect(page.locator('[data-qqq-id="permission-denied"]')).toHaveText('You do not have permission to edit Person records.')
    await expect(page.getByRole('textbox')).toHaveCount(0)
    expect(reads.filter((url) => url.includes('/data/person/1'))).toEqual([])

    const update = await backend.api.put('/data/person/1', { multipart: { firstName: 'Mallory' } })
    expect(update.status()).toBe(403)
    expect(await backend.sql('select first_name from person where id = 1')).toEqual([{ first_name: 'Avery' }])
  })

  test('[SEC-005] delete is not offered on the record or the list and the backend deletes nothing', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await open(page, '/app/person/1')
    await expect(page.getByRole('heading', { name: /Avery/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete Person record' })).toHaveCount(0)

    await open(page, '/app/person')
    await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
    await page.getByRole('checkbox', { name: 'Select Avery Sample' }).check()
    await expect(page.locator('[data-qqq-id="bulk-action-bar"]')).toBeVisible()
    await expect(page.locator('[data-qqq-id="bulk-delete"]')).toHaveCount(0)

    // the table's bulk delete process follows the table delete permission
    await open(page, '/app/person.bulkDelete?recordsParam=recordIds&recordIds=1')
    await expect(page.locator('[data-qqq-id="not-found-state"]', { hasText: 'person.bulkDelete' })).toBeVisible()

    const removal = await backend.api.delete('/data/person/1')
    expect(removal.status()).toBe(403)
    expect((await backend.api.post('/processes/person.bulkDelete/init?recordsParam=recordIds&recordIds=1')).status()).toBe(403)
    expect(await backend.sql('select id from person where id = 1')).toEqual([{ id: '1' }])
  })

  test('[SEC-006] copy is not offered and the copy link is refused', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const before = await personCount(backend.sql)
    await open(page, '/app/person/1')
    await expect(page.getByRole('heading', { name: /Avery/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy Person record' })).toHaveCount(0)
    await open(page, '/app/person/1/copy')
    await expect(page.locator('[data-qqq-id="permission-denied"]')).toHaveText('You do not have permission to create Person records.')
    await expect(page.getByRole('textbox')).toHaveCount(0)
    expect(await personCount(backend.sql)).toBe(before)
  })

  test('[SEC-007] processes are not offered, their links do not start them and the backend refuses them', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const before = await personCount(backend.sql)
    const processCalls: string[] = []
    page.on('request', (request) => { if (/\/processes\//.test(request.url())) processCalls.push(request.url()) })
    await open(page, '/app/person')
    await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
    await expect(page.locator('[data-qqq-id="process-launcher-trigger"]')).toHaveCount(0)
    const nav = await navigation(page)
    await expect(nav.getByRole('link', { name: 'Person', exact: true })).toBeVisible()
    await expect(nav.getByText('Clone People')).toHaveCount(0)
    await expect(nav.getByText('Greet Interactive')).toHaveCount(0)

    await open(page, '/app/clonePeople?recordsParam=recordIds&recordIds=1')
    await expect(page.locator('[data-qqq-id="not-found-state"]', { hasText: 'clonePeople' })).toBeVisible()
    expect(processCalls).toEqual([])

    const init = await backend.api.post('/processes/clonePeople/init?recordsParam=recordIds&recordIds=1')
    expect(init.status()).toBe(403)
    const v1 = await backend.api.post('/qqq/v1/processes/clonePeople/init', { data: { recordsParam: 'recordIds', recordIds: '1' } })
    expect(v1.status()).toBe(403)
    expect(await personCount(backend.sql)).toBe(before)
  })
})

test.describe('noProcesses persona (full table rights, no processes)', () => {
  test.use({ persona: 'noProcesses' })

  test('[SEC-007] standalone processes are not offered or started while table rights stay intact', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const before = await personCount(backend.sql)
    await open(page, '/app/person')
    await expect(listCell(page, 'Person', 'Avery')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create new Person record' })).toBeVisible()
    // The Actions menu keeps only the table's bulk actions (they follow the table rights this
    // persona keeps, like Create); it offers no standalone process.
    await page.locator('[data-qqq-id="process-launcher-trigger"]').click()
    const actionItems = page.locator('[data-qqq-id="process-launcher-menu"] [role="menuitem"]')
    await expect(actionItems.first()).toBeVisible()
    const offered = await actionItems.evaluateAll((items) => items.map((item) => item.getAttribute('data-qqq-id')))
    expect(offered.length).toBeGreaterThan(0)
    for (const id of offered) expect(id).toMatch(/^process-launcher-item-person\.bulk[A-Za-z]+$/)
    await expect(page.getByRole('menuitem', { name: 'Clone People' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    const nav = await navigation(page)
    await expect(nav.getByText('Clone People')).toHaveCount(0)
    await open(page, '/app/greetInteractive')
    await expect(page.locator('[data-qqq-id="not-found-state"]', { hasText: 'greetInteractive' })).toBeVisible()
    expect((await backend.api.post('/processes/clonePeople/init?recordsParam=recordIds&recordIds=1')).status()).toBe(403)
    expect((await backend.api.post('/processes/greetInteractive/init')).status()).toBe(403)
    expect(await personCount(backend.sql)).toBe(before)
  })
})

test.describe('noPets persona (pet tables hidden)', () => {
  test.use({ persona: 'noPets' })

  test('[SEC-001] a hidden table is absent from navigation, its link loads nothing and the backend refuses it', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const reads = recordRequests(page)
    await open(page, '/app/person/1')
    await expect(page.getByRole('heading', { name: /Avery/ }).first()).toBeVisible()
    // the person record never asks for (or shows) the hidden pet association
    await expect(page.locator('[data-qqq-id="associated-records-pets"]')).toHaveCount(0)
    expect(reads.filter((url) => /\/pet(\/|\?|$)|includeAssociations=true/.test(url))).toEqual([])

    const nav = await navigation(page)
    await expect(nav.getByRole('link', { name: 'Person', exact: true })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Pet', exact: true })).toHaveCount(0)
    await expect(nav.getByRole('link', { name: 'Pet Note', exact: true })).toHaveCount(0)

    reads.length = 0
    await open(page, '/app/pet')
    await expect(page.locator('[data-qqq-id="not-found-state"]', { hasText: 'pet' })).toBeVisible()
    await expect(page.getByRole('grid')).toHaveCount(0)
    expect(reads.filter((url) => /pet/i.test(url))).toEqual([])

    expect((await backend.api.post('/qqq/v1/table/pet/query', { data: {} })).status()).toBe(403)
    expect((await backend.api.get('/data/pet/1')).status()).toBe(403)
    expect((await backend.api.get('/qqq/v1/metaData/table/pet')).status()).toBe(404)
  })
})

test.describe('record-level security (sharing demo)', () => {
  test('[SEC-011] alice lists and opens her own saved view and report', async ({ page, backend, diagnostics }) => {
    void diagnostics
    void backend
    await open(page, '/app/savedView')
    await expect(listCell(page, 'View', 'Alice People View')).toBeVisible()
    await open(page, '/app/savedView/1')
    await expect(page.getByRole('heading', { name: 'Alice People View' }).first()).toBeVisible()
    await open(page, '/app/savedReport/1')
    await expect(page.getByRole('heading', { name: 'Pet Species Report' }).first()).toBeVisible()
  })

  test.describe('bob', () => {
    test.use({ user: 'bob' })

    test("[SEC-011] bob cannot list, open, change or delete alice's saved view and report", async ({ page, backend, diagnostics }) => {
      diagnostics.allow('/data/savedReport/1 404')
      diagnostics.allow('status of 404')
      // Alice saves a view she shares with nobody (other areas share her stock view with bob).
      await backend.setPersona('admin', 'alice')
      const stored = await backend.api.post('/qqq/v1/processes/storeSavedView/init', {
        multipart: { values: JSON.stringify({ tableName: 'person', label: 'Alice Private View', viewJson: '{}' }) },
      })
      expect((await stored.json()).type).not.toBe('ERROR')
      const [privateView] = await backend.sql("select id, user_id from saved_view where label = 'Alice Private View'")
      expect(privateView).toMatchObject({ user_id: 'sample:alice' })
      expect(await backend.sql(`select id from shared_saved_view where saved_view_id = ${privateView.id}`)).toEqual([])
      diagnostics.allow(`/data/savedView/${privateView.id} 404`)
      const savedViews = 'select id, label, user_id from saved_view order by id'
      const savedReports = 'select id, label, user_id from saved_report order by id'
      const viewsBefore = await backend.sql(savedViews)
      const reportsBefore = await backend.sql(savedReports)
      expect(reportsBefore).toContainEqual({ id: '1', label: 'Pet Species Report', user_id: 'sample:alice' })
      await backend.setPersona('admin', 'bob')

      // bob's list holds exactly the views shared with him, never alice's private one
      const sharedWithBob = (await backend.sql(
        "select v.label from saved_view v join shared_saved_view s on s.saved_view_id = v.id where s.user_id = 'sample:bob' order by v.id"
      )).map((row) => String(row.label))
      await open(page, '/app/savedView')
      if (sharedWithBob.length === 0) await expect(page.getByRole('heading', { name: 'No records found' })).toBeVisible()
      else await expect(listCell(page, 'View', sharedWithBob[0])).toBeVisible()
      await expect(listRows(page)).toHaveCount(sharedWithBob.length)
      await expect(page.getByText('Alice Private View')).toHaveCount(0)

      await open(page, `/app/savedView/${privateView.id}`)
      await expect(page.locator('[data-qqq-id="record-view-not-found-savedView"]')).toContainText('Record Not Found')
      await expect(page.getByText('Alice Private View')).toHaveCount(0)
      await open(page, '/app/savedReport/1')
      await expect(page.locator('[data-qqq-id="record-view-not-found-savedReport"]')).toContainText('Record Not Found')

      expect((await backend.api.get(`/data/savedView/${privateView.id}`)).status()).toBe(404)
      expect((await backend.api.put(`/data/savedView/${privateView.id}`, { multipart: { label: 'Taken by Bob' } })).ok()).toBe(false)
      expect(await (await backend.api.delete(`/data/savedView/${privateView.id}`)).json()).toMatchObject({ deletedRecordCount: 0 })
      expect((await backend.api.get('/data/savedReport/1')).status()).toBe(404)
      expect(await backend.sql(savedViews)).toEqual(viewsBefore)
      expect(await backend.sql(savedReports)).toEqual(reportsBefore)
    })
  })
})

test.describe('permission revoked mid-session', () => {
  test('[SEC-015] a stale edit form is refused by the backend with a clear message and nothing is written', async ({ page, backend, diagnostics }) => {
    diagnostics.allow('/data/person/1 403')
    diagnostics.allow('status of 403')
    await open(page, '/app/person/1/edit')
    const firstName = page.getByRole('textbox', { name: 'First Name' })
    await expect(firstName).toHaveValue('Avery')
    await backend.setPersona('viewer')
    await firstName.fill('Revoked')
    await page.getByRole('button', { name: /^Save/ }).click()
    // one clear explanation, from the form, carrying the backend's reason
    await expect(page.getByText(/^Failed to save Person: .*permission/i)).toBeVisible()
    await expect(page).toHaveURL(/\/app\/person\/1\/edit\/?$/)
    expect(await backend.sql('select first_name from person where id = 1')).toEqual([{ first_name: 'Avery' }])

    // a fresh load reflects the reduced rights
    await page.reload()
    await expect(page.locator('[data-qqq-id="permission-denied"]')).toHaveText('You do not have permission to edit Person records.')
  })
})
