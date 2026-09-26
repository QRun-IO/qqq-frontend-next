/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Reports: run through the basic report process in each format, input fields, permissions, navigation.
import type { Download, Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { downloadBytes, downloadText, parseCsv, readZip, sqlRows, xlsxRows } from './widget-support'

/** Runs a report in a format and returns the downloaded file. */
async function runReport(page: Page, reportName: string, format: 'CSV' | 'XLSX' | 'JSON'): Promise<Download> {
  await open(page, `/app/${reportName}`)
  await page.getByLabel('Output format').selectOption(format)
  await page.getByRole('button', { name: 'Run Report' }).click()
  return downloadResult(page)
}

/** Waits for the finished report and downloads it. */
async function downloadResult(page: Page): Promise<Download> {
  const link = page.getByRole('link', { name: /^Download / })
  await expect(page.getByRole('status').filter({ hasText: 'Report complete' })).toBeVisible()
  const [download] = await Promise.all([page.waitForEvent('download'), link.click()])
  return download
}

const PEOPLE = 'select id, first_name, last_name, email from person order by id'

test('[RPT-001] a table report downloads CSV with every row from the database', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const people = await sqlRows(backend, PEOPLE)
  const download = await runReport(page, 'accPersonReport', 'CSV')
  expect(download.suggestedFilename()).toMatch(/^Owned Person Report - \d{4}-\d{2}-\d{2}-\d{4}\.csv$/)
  const rows = parseCsv(await downloadText(download))
  expect(rows[0]).toEqual(['Id', 'First Name', 'Last Name', 'Email'])
  expect(rows.slice(1)).toEqual(people.map((person) => [person.id, person.first_name, person.last_name, person.email]))
})

test('[RPT-002] a table report downloads XLSX with the same rows', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const people = await sqlRows(backend, PEOPLE)
  const download = await runReport(page, 'accPersonReport', 'XLSX')
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/)
  const rows = xlsxRows(await downloadBytes(download))
  expect(rows[0]).toEqual(['Id', 'First Name', 'Last Name', 'Email'])
  // ids are numeric cells
  expect(rows.slice(1).map((row) => [Number(row[0]), ...row.slice(1)])).toEqual(people.map((person) => [Number(person.id), person.first_name, person.last_name, person.email]))
})

test('[RPT-003] a table report downloads JSON with the same rows', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const people = await sqlRows(backend, PEOPLE)
  const download = await runReport(page, 'accPersonReport', 'JSON')
  expect(download.suggestedFilename()).toMatch(/\.json$/)
  expect(JSON.parse(await downloadText(download))).toEqual(people.map((person) => ({ id: Number(person.id), firstName: person.first_name, lastName: person.last_name, email: person.email })))
})

test('[RPT-004] a summary report counts pets per owner with a totals row', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const groups = await sqlRows(backend, "select p.first_name || ' ' || p.last_name as owner, count(*) as pets from pet join person p on p.id = pet.person_id group by p.id, p.first_name, p.last_name order by p.id")
  const [total] = await sqlRows(backend, 'select count(*) as pets from pet')
  const rows = parseCsv(await downloadText(await runReport(page, 'accPetSummaryReport', 'CSV')))
  expect(rows[0]).toEqual(['Person', 'Pet Count'])
  expect(rows.slice(1, -1)).toEqual(groups.map((group) => [group.owner, group.pets]))
  expect(rows.at(-1)).toEqual(['Totals', total.pets])
})

test('[RPT-005] a pivot report produces a native pivot table in XLSX and plain rows in CSV', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const pets = await sqlRows(backend, 'select id, name from pet order by id')
  const xlsx = await downloadBytes(await runReport(page, 'accPetPivotReport', 'XLSX'))
  const zip = readZip(xlsx)
  const workbook = zip.get('xl/workbook.xml')!.toString('utf8')
  expect(workbook).toContain('name="Pet Rows"')
  expect(workbook).toContain('name="Pets By Owner"')
  const pivot = [...zip.keys()].find((name) => /^xl\/pivotTables\/pivotTable\d+\.xml$/.test(name))
  expect(pivot, 'a native pivot table part').toBeDefined()
  const pivotXml = zip.get(pivot!)!.toString('utf8')
  expect(pivotXml).toMatch(/<rowFields[^>]*>/)
  expect(pivotXml).toMatch(/<dataField[^>]*subtotal="count"/)
  const cache = [...zip.keys()].find((name) => /^xl\/pivotCache\/pivotCacheDefinition\d+\.xml$/.test(name))
  expect(zip.get(cache!)!.toString('utf8')).toContain('sheet="Pet Rows"')
  expect(xlsxRows(xlsx, 'xl/worksheets/sheet1.xml').slice(1).map((row) => [Number(row[0]), row[1]]))
    .toEqual(pets.map((pet) => [Number(pet.id), pet.name]))
  // CSV has no native pivot tables: only the rows view is written
  const csv = parseCsv(await downloadText(await runReport(page, 'accPetPivotReport', 'CSV')))
  expect(csv[0]).toEqual(['Id', 'Name', 'Species', 'Owner'])
  expect(csv.slice(1).map((row) => [row[0], row[1]])).toEqual(pets.map((pet) => [pet.id, pet.name]))
})

test('[RPT-006] report input fields are required and filter the rows', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const people = await sqlRows(backend, 'select id, first_name from person where id >= 3 order by id')
  await open(page, '/app/accPersonInputReport')
  await page.getByRole('button', { name: 'Run Report' }).click()
  const form = page.getByRole('form', { name: 'Owned Person Input Report inputs' })
  const input = form.getByLabel(/Minimum Id/)
  await expect(input).toHaveAttribute('aria-required', 'true')
  let stepRequests = 0
  page.on('request', (request) => { if (request.url().includes('/step/input')) stepRequests++ })
  await form.getByRole('button', { name: 'Generate Report' }).click()
  await expect(form.getByText('Minimum Id is required.')).toBeVisible()
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  expect(stepRequests).toBe(0)
  await input.fill('3')
  await form.getByRole('button', { name: 'Generate Report' }).click()
  const rows = parseCsv(await downloadText(await downloadResult(page)))
  expect(rows[0]).toEqual(['Id', 'First Name'])
  expect(rows.slice(1)).toEqual(people.map((person) => [person.id, person.first_name]))
})

test('[RPT-011] a report without a process streams from the report route', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const pets = await sqlRows(backend, 'select id, name from pet order by id')
  await open(page, '/app/accStreamedReport')
  await page.getByLabel('Output format').selectOption('CSV')
  await page.getByRole('button', { name: 'Run Report' }).click()
  const link = page.getByRole('link', { name: /^Download / })
  await expect(link).toHaveAttribute('href', /^\/qqq\/v1\/reports\/accStreamedReport\?format=csv$/)
  const [download] = await Promise.all([page.waitForEvent('download'), link.click()])
  const rows = parseCsv(await downloadText(download))
  expect(rows[0]).toEqual(['Id', 'Name'])
  expect(rows.slice(1)).toEqual(pets.map((pet) => [pet.id, pet.name]))
})

test('[RPT-008] reports appear in app navigation and open their run page', async ({ page, diagnostics }) => {
  diagnostics.allow('/missing-extension.js 404')
  diagnostics.allow('Failed to load resource: the server responded with a status of 404')
  await open(page, '/app/widgetGallery')
  const nav = page.getByRole('navigation', { name: 'App navigation' })
  await nav.getByRole('button', { name: 'Expand Acceptance Reports' }).click()
  await nav.getByRole('link', { name: 'Owned Person Report' }).click()
  await expect(page).toHaveURL(/\/app\/accPersonReport\/?$/)
  await expect(page.getByRole('heading', { name: 'Owned Person Report' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Run Report' })).toBeEnabled()
})

test('[RPT-007] an administrator can run the restricted report', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const people = await sqlRows(backend, 'select id, first_name from person order by id')
  const rows = parseCsv(await downloadText(await runReport(page, 'accRestrictedReport', 'CSV')))
  expect(rows.slice(1)).toEqual(people.map((person) => [person.id, person.first_name]))
})

test.describe('without the report permission', () => {
  test.use({ persona: 'noPets' })

  test('[RPT-007] the restricted report is denied in the UI and by the server', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const meta = await (await backend.api.get('/metaData')).json()
    expect(meta.reports.accPersonReport.hasPermission).toBe(true)
    // a report the user may not run is omitted from their metadata
    expect(Object.keys(meta.reports)).not.toContain('accRestrictedReport')
    // both server entry points refuse, and no file is generated
    expect((await backend.api.get('/reports/accRestrictedReport?format=csv')).status()).toBe(403)
    const viaProcess = await backend.api.post('/qqq/v1/processes/reports.basic/init', { multipart: { values: JSON.stringify({ reportName: 'accRestrictedReport', reportFormat: 'CSV' }) } })
    expect(viaProcess.status()).toBe(403)
    expect(JSON.stringify(await viaProcess.json())).not.toContain('serverFilePath')
    // a direct link does not reveal or run it, and navigation does not list it
    await open(page, '/app/accRestrictedReport')
    await expect(page.locator('[data-qqq-id="not-found-state"]')).toContainText('There is no app, table, process or report named accRestrictedReport that you can open.')
    await expect(page.getByRole('button', { name: 'Run Report' })).toHaveCount(0)
    const nav = page.getByRole('navigation', { name: 'App navigation' })
    await nav.getByRole('button', { name: 'Expand Acceptance Reports' }).click()
    await expect(nav.getByRole('link', { name: 'Owned Person Report' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Owned Restricted Report' })).toHaveCount(0)
  })
})
