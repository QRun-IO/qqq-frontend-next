/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Material dashboard instance metadata: processNamesToAddToAllQueryAndViewScreens adds the
// table-less prcTagRecords process (in no app) to every table's query and record screens. The
// fixture lists that process in metadata only for the sample user casey (a metadata customizer),
// so other areas' screens keep their exact menus; for everyone else it is absent, as for a user
// without permission.
import type { Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { expectScreen, run, viewValue } from './process-helpers'

const TAG = 'prcTagRecords'

/** The rows the tag process wrote, in order. */
async function tagLog(sql: (query: string) => Promise<Record<string, string | null>[]>) {
  return sql('select table_name, record_id from prc_tag_log order by id')
}

/** Checks the tag process's result screen. */
async function expectTagged(page: Page, table: string, ids: string) {
  const tagged = await expectScreen(page, 'tagged', 'Tagged')
  await expect(viewValue(tagged, 'taggedTable')).toHaveText(table)
  await expect(viewValue(tagged, 'taggedCount')).toHaveText(String(ids.split(', ').length))
  await expect(viewValue(tagged, 'taggedIds')).toHaveText(ids)
}

test.describe('Processes added to every query and record screen', () => {
  test.use({ user: 'casey' })

  test('[PRC-050] the instance metadata names the process; it has no table and is in no app', async ({ backend, diagnostics }) => {
    void diagnostics
    // The v1 metadata the UI reads publishes this process setting alongside other allow-listed settings.
    const v1 = await (await backend.api.get('/qqq/v1/metaData')).json()
    expect(v1.supplementalInstanceMetaData).toMatchObject({ materialDashboard: { processNamesToAddToAllQueryAndViewScreens: [TAG] } })
    expect(v1.processes[TAG]).toMatchObject({ label: 'Tag Records', hasPermission: true })
    expect(v1.processes[TAG].tableName ?? null).toBeNull()
    const inApps = JSON.stringify(v1.appTree).includes(`"name":"${TAG}"`)
    expect(inApps).toBe(false)
    // server configuration the unversioned route carries in its supplemental metadata stays off v1
    const full = await (await backend.api.get('/metaData')).json()
    expect(full.supplementalInstanceMetaData.javalin.routeProviders.length).toBeGreaterThan(0)
    expect(JSON.stringify(v1)).not.toMatch(/routeProviders|fileSystemPath|RouteAuthenticator|uploadedFileArchiveTableName/)
  })

  test('[PRC-050] the query Actions menu of an unrelated table runs it on the selected rows', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const inits: string[] = []
    page.on('request', (request) => { if (new URL(request.url()).pathname === `/qqq/v1/processes/${TAG}/init`) inits.push(request.postData() ?? '') })
    await open(page, '/app/person')
    const grid = page.getByRole('grid', { name: 'Person records' })
    await expect(grid.getByRole('gridcell', { name: 'Blair', exact: true })).toBeVisible()
    await page.getByRole('checkbox', { name: 'Select Avery Sample' }).check()
    await page.getByRole('checkbox', { name: 'Select Casey Sample' }).check()
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    const menu = page.getByRole('menu', { name: 'Actions' })
    // after the table's own processes, behind a divider, as in Material
    const items = menu.getByRole('menuitem')
    await expect(items.last()).toHaveText('Tag Records')
    await expect(menu.getByRole('separator').last()).toBeVisible()
    await items.last().click()
    await expect(run(page, TAG)).toBeVisible()
    await expect(page).toHaveURL(/[?&]tableName=person(&|$)/)
    await expectTagged(page, 'Person', '1, 3')
    // v1 carries the launching table in the init values
    const valuesOf = (body: string) => JSON.parse(/name="values"\r\n\r\n([^\r]*)/.exec(body)?.[1] ?? '{}') as Record<string, unknown>
    expect(inits.some((body) => valuesOf(body).tableName === 'person')).toBe(true)
    expect(await tagLog(backend.sql)).toEqual([{ table_name: 'person', record_id: '1' }, { table_name: 'person', record_id: '3' }])
  })

  test('[PRC-050] the record actions menu of a table with no processes of its own runs it on that record', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await open(page, '/app/qryBin/2')
    await expect(page.getByRole('heading', { level: 1, name: 'Nuts' })).toBeVisible()
    await page.getByRole('button', { name: 'Record actions menu' }).click()
    await page.getByRole('menuitem', { name: 'Tag Records' }).click()
    await expectTagged(page, 'Storage Bin', '2')
    expect(await tagLog(backend.sql)).toEqual([{ table_name: 'qryBin', record_id: '2' }])
  })
})

test.describe('Processes added to every screen, on a phone', () => {
  test.use({ user: 'casey', viewport: { width: 412, height: 839 }, hasTouch: true })

  test('[PRC-050] the record action sheet runs it on that record @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await open(page, '/app/person/3')
    await expect(page.getByRole('heading', { level: 1, name: 'Casey Sample' })).toBeVisible()
    await page.getByRole('button', { name: 'Record actions' }).click()
    await page.locator(`[data-qqq-id="mobile-action-${TAG}"]`).click()
    await expectTagged(page, 'Person', '3')
    expect(await tagLog(backend.sql)).toEqual([{ table_name: 'person', record_id: '3' }])
  })
})

test.describe('Processes added to every screen, for a user whose metadata omits it', () => {
  test('[PRC-050] it is not offered on query or record screens', async ({ page, backend, diagnostics }) => {
    void diagnostics
    // the instance names the process, but v1 names only processes this user may see
    const full = await (await backend.api.get('/metaData')).json()
    expect(full.supplementalInstanceMetaData.materialDashboard.processNamesToAddToAllQueryAndViewScreens).toEqual([TAG])
    const v1 = await (await backend.api.get('/qqq/v1/metaData')).json()
    expect(v1.supplementalInstanceMetaData).toMatchObject({ materialDashboard: { processNamesToAddToAllQueryAndViewScreens: [] } })
    expect(v1.processes[TAG]).toBeUndefined()

    await open(page, '/app/person')
    await expect(page.getByRole('grid', { name: 'Person records' }).getByRole('gridcell', { name: 'Blair', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    const items = page.getByRole('menu', { name: 'Actions' }).getByRole('menuitem')
    await expect(items.last()).toHaveText('Greet Interactive')
    await expect(items.filter({ hasText: 'Tag Records' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await open(page, '/app/qryBin/2')
    await expect(page.getByRole('heading', { level: 1, name: 'Nuts' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete Storage Bin record' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Record actions menu' })).toHaveCount(0)
    await open(page, `/app/${TAG}?recordsParam=recordIds&recordIds=1&tableName=person`)
    await expect(page.locator('[data-qqq-id="not-found-state"]', { hasText: TAG })).toBeVisible()
    expect(await tagLog(backend.sql)).toEqual([])
  })
})

test.describe('Processes added to every screen, without process permission', () => {
  test.use({ persona: 'noProcesses', user: 'casey' })

  test('[PRC-050] it is not offered on query or record screens and the backend refuses it', async ({ page, backend, diagnostics }) => {
    void diagnostics
    // still named by the instance metadata, but absent from the metadata this user receives
    const full = await (await backend.api.get('/metaData')).json()
    expect(full.supplementalInstanceMetaData.materialDashboard.processNamesToAddToAllQueryAndViewScreens).toEqual([TAG])
    expect(full.processes[TAG]).toBeUndefined()
    const v1 = await (await backend.api.get('/qqq/v1/metaData')).json()
    expect(v1.supplementalInstanceMetaData).toMatchObject({ materialDashboard: { processNamesToAddToAllQueryAndViewScreens: [] } })
    expect(v1.processes[TAG]).toBeUndefined()

    await open(page, '/app/person')
    await expect(page.getByRole('grid', { name: 'Person records' }).getByRole('gridcell', { name: 'Blair', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    const items = page.getByRole('menu', { name: 'Actions' }).getByRole('menuitem')
    await expect(items.first()).toBeVisible()
    await expect(items.filter({ hasText: 'Tag Records' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await open(page, '/app/qryBin/2')
    await expect(page.getByRole('heading', { level: 1, name: 'Nuts' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit Storage Bin record' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Record actions menu' })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: 'Tag Records' })).toHaveCount(0)

    // the v1 route the UI uses refuses it, as does the unversioned one
    const v1Init = await backend.api.post(`/qqq/v1/processes/${TAG}/init`, {
      multipart: { values: JSON.stringify({ tableName: 'person' }), recordsParam: 'recordIds', recordIds: '1' },
    })
    expect(v1Init.status()).toBe(403)
    const init = await backend.api.post(`/processes/${TAG}/init`, { multipart: { tableName: 'person', recordsParam: 'recordIds', recordIds: '1' } })
    expect(init.status()).toBe(403)
    expect(await tagLog(backend.sql)).toEqual([])
  })
})
