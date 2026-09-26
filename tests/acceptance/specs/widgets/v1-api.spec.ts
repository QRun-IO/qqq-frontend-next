/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, open, test } from '../../support/fixtures'
import { downloadText, expectLoaded, parseCsv, sqlRows } from './widget-support'

test('[RPT-020] report files download from the v1 download and report routes, which enforce access', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const people = await sqlRows(backend, 'select id, first_name, last_name, email from person order by id')

  // Through the report process: the finished file is a v1 download link.
  await open(page, '/app/accPersonReport')
  await page.getByLabel('Output format').selectOption('CSV')
  await page.getByRole('button', { name: 'Run Report' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Report complete' })).toBeVisible()
  const link = page.getByRole('link', { name: /^Download / })
  await expect(link).toHaveAttribute('href', /^\/qqq\/v1\/download\/[^?]+\.csv\?filePath=/)
  const [download] = await Promise.all([page.waitForEvent('download'), link.click()])
  expect(parseCsv(await downloadText(download)).slice(1)).toEqual(people.map((person) => [person.id, person.first_name, person.last_name, person.email]))

  // Without a process: the v1 streaming report route.
  const pets = await sqlRows(backend, 'select id, name from pet order by id')
  await open(page, '/app/accStreamedReport')
  await page.getByLabel('Output format').selectOption('CSV')
  await page.getByRole('button', { name: 'Run Report' }).click()
  const streamed = page.getByRole('link', { name: /^Download / })
  await expect(streamed).toHaveAttribute('href', '/qqq/v1/reports/accStreamedReport?format=csv')
  const [file] = await Promise.all([page.waitForEvent('download'), streamed.click()])
  expect(parseCsv(await downloadText(file)).slice(1)).toEqual(pets.map((pet) => [pet.id, pet.name]))

  // The v1 routes refuse what nobody may have: a file no process registered for the
  // session, an unknown report, and a run without a format.
  const hosts = await backend.api.get('/qqq/v1/download/hosts.txt?filePath=%2Fetc%2Fhosts')
  expect(hosts.status()).toBe(403)
  expect(await hosts.text()).not.toContain('localhost')
  expect((await backend.api.get('/qqq/v1/download/x.csv?storageTableName=person&storageReference=x.csv')).status()).toBe(403)
  expect((await backend.api.get('/qqq/v1/reports/noSuchReport?format=csv')).status()).toBe(404)
  expect((await backend.api.get('/qqq/v1/reports/accStreamedReport')).status()).toBe(400)
})

test.describe('persona without pet permissions', () => {
  test.use({ persona: 'noPets' })

  test('[WID-066] widget metadata and data come from v1, which refuses a denied widget without rendering it', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const renders = async () => Number(/renders=(\d+)/.exec((await (await backend.api.post('/qqq/v1/widget/accDenied')).json()).html)![1])
    await backend.setPersona('admin')
    const before = await renders()
    await backend.setPersona('noPets')
    const meta = await (await backend.api.get('/qqq/v1/metaData')).json()
    expect(Object.keys(meta.widgets)).not.toContain('accDenied')
    expect(meta.widgets.accHealthy).toMatchObject({ name: 'accHealthy', hasPermission: true })
    expect(meta.reports.accPersonReport).toMatchObject({ name: 'accPersonReport', hasPermission: true })
    expect(Object.keys(meta.reports)).not.toContain('accRestrictedReport')
    expect((await backend.api.post('/qqq/v1/widget/accDenied')).status()).toBe(403)

    const requests: string[] = []
    page.on('request', (request) => { if (/\/(metaData|widget\/)/.test(new URL(request.url()).pathname)) requests.push(`${request.method()} ${new URL(request.url()).pathname}`) })
    await open(page, '/app/widgetPermissions')
    await expectLoaded(page, 'accHealthy')
    expect(requests).toContain('POST /qqq/v1/widget/accHealthy')
    expect(requests.every((request) => request.includes(' /qqq/v1/'))).toBe(true)
    expect(requests).not.toContain('POST /qqq/v1/widget/accDenied')
    await backend.setPersona('admin')
    expect(await renders()).toBe(before + 1)
  })

  test('[RPT-020] the v1 report route refuses a report the persona may not run', async ({ backend, diagnostics }) => {
    void diagnostics
    const refused = await backend.api.get('/qqq/v1/reports/accRestrictedReport?format=csv')
    expect(refused.status()).toBe(403)
    expect(await refused.text()).not.toContain('Id')
  })
})
