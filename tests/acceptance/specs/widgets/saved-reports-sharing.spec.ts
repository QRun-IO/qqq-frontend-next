/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Saved reports (setup widgets, rendering), scheduled reports, and record sharing.
import type { Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import type { Backend } from '../../support/fixtures'
import { byId, downloadText, expectLoaded, parseCsv, sqlRows } from './widget-support'

async function openShare(page: Page, path: string) {
  await open(page, path)
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('[data-qqq-id="share-status"]')).toHaveCount(0)
  return dialog
}

/** Runs a sharing process directly with the test's session. */
async function shareViaApi(backend: Backend, processName: string, values: Record<string, unknown>) {
  const response = await backend.api.post(`/qqq/v1/processes/${processName}/init`, { multipart: { values: JSON.stringify(values) } })
  return { status: response.status(), body: await response.json() }
}

test('[WID-030] filter and columns setup shows the saved filter, sort and visible columns by label', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const [report] = await sqlRows(backend, 'select query_filter_json, columns_json from saved_report where id = 102')
  expect(JSON.parse(report.query_filter_json).criteria).toHaveLength(2)
  await open(page, '/app/savedReport/102')
  await expectLoaded(page, 'reportSetupWidget')
  await expect(byId(page, 'filter-boolean-operator-reportSetupWidget-0')).toHaveText('Match all of:')
  await expect(byId(page, 'filter-criterion-reportSetupWidget-0-0')).toHaveText('First Name starts with A')
  await expect(byId(page, 'filter-criterion-reportSetupWidget-0-1')).toHaveText('Annual Salary greater than 1000')
  await expect(byId(page, 'filter-sort-reportSetupWidget')).toHaveText('Sorted by Last Name descending')
  await expect(byId(page, 'report-columns-reportSetupWidget').locator('li')).toHaveText(['Id', 'First Name', 'Last Name'])
  await open(page, '/app/savedReport/1')
  await expectLoaded(page, 'reportSetupWidget')
  await expect(byId(page, 'filter-none-reportSetupWidget')).toHaveText('No filters')
  await expect(byId(page, 'report-columns-reportSetupWidget').locator('li')).toHaveText(['ID', 'Species'])
})

test('[WID-029] pivot table setup shows the saved rows, columns and values by label', async ({ page, diagnostics }) => {
  void diagnostics
  await open(page, '/app/savedReport/102')
  await expectLoaded(page, 'pivotTableSetupWidget')
  await expect(byId(page, 'pivot-rows-pivotTableSetupWidget')).toContainText('Last Name')
  await expect(byId(page, 'pivot-columns-pivotTableSetupWidget')).toContainText('Is Employed')
  await expect(byId(page, 'pivot-values-pivotTableSetupWidget')).toContainText('Count of Id')
  await expect(byId(page, 'pivot-values-pivotTableSetupWidget')).toContainText('Sum of Annual Salary')
  await open(page, '/app/savedReport/1')
  await expectLoaded(page, 'pivotTableSetupWidget')
  await expect(byId(page, 'widget-pivotTableSetup-pivotTableSetupWidget')).toContainText('This report does not use a pivot table.')
})

test('[RPT-009] a saved report record shows its full definition', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const [report] = await sqlRows(backend, 'select label, table_name from saved_report where id = 102')
  await open(page, '/app/savedReport/102')
  await expect(page.getByRole('heading', { level: 1, name: report.label })).toBeVisible()
  await expectLoaded(page, 'reportSetupWidget')
  await expectLoaded(page, 'pivotTableSetupWidget')
  await expect(byId(page, 'report-columns-reportSetupWidget').locator('li')).toHaveCount(3)
  await expect(byId(page, 'pivot-values-pivotTableSetupWidget')).toContainText('Count of Id')
})

test('[RPT-010] a saved report renders to a CSV with its saved columns and rows', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const species = (await (await backend.api.get('/data/petSpecies')).json()).records as Array<{ values: { possibleValueId: number; possibleValueLabel: string } }>
  expect(species.length).toBeGreaterThan(0)
  await open(page, '/app/savedReport/1')
  await page.getByRole('button', { name: 'Actions' }).click()
  await page.getByRole('menuitem', { name: 'Render Report' }).click()
  await expect(page).toHaveURL(/\/app\/renderSavedReport/)
  await page.getByLabel(/Report Format/).click()
  await page.getByRole('option', { name: 'CSV' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  const link = page.locator('[data-qqq-id="button-download-file"]')
  await expect(link).toContainText('Pet Species Report')
  const [download] = await Promise.all([page.waitForEvent('download'), link.click()])
  const rows = parseCsv(await downloadText(download))
  expect(rows[0]).toEqual(['ID', 'Species'])
  expect(rows.slice(1)).toEqual(species.map((record) => [String(record.values.possibleValueId), record.values.possibleValueLabel]))
})

/** Opens the scheduled-report create form from the saved report's Schedules section and fills it. */
async function fillSchedule(page: Page, cronExpression: string) {
  await open(page, '/app/savedReport/1')
  await expectLoaded(page, 'scheduledReportJoinSavedReport')
  await byId(page, 'child-record-add-scheduledReportJoinSavedReport').click()
  await expect(page).toHaveURL(/\/app\/scheduledReport\/create\/?$/)
  const form = page.locator('form')
  await form.getByLabel(/^Saved Report/).click()
  await page.getByRole('option', { name: 'Pet Species Report' }).click()
  await form.getByRole('checkbox', { name: 'Is Active' }).click()
  await form.getByLabel(/^Format/).click()
  await page.getByRole('option', { name: /^CSV/ }).click()
  await form.getByLabel(/^To Addresses/).fill('owned-schedule@example.com')
  await form.getByLabel(/^Subject/).fill('Owned schedule')
  await form.getByLabel(/^Cron Time Zone/).click()
  await page.getByRole('option', { name: /^UTC$/ }).first().click()
  await form.getByLabel(/^Cron Expression/).fill(cronExpression)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
}

test('[RPT-012] a scheduled report is created for a saved report and shows its schedule', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await fillSchedule(page, '0 0 9 * * ?')
  await expect(page).toHaveURL(/\/app\/scheduledReport\/\d+\/?$/)
  const id = /\/scheduledReport\/(\d+)/.exec(page.url())![1]
  const saved = await (await backend.api.get(`/data/scheduledReport/${id}`)).json()
  expect(saved.values).toMatchObject({ savedReportId: 1, isActive: true, toAddresses: 'owned-schedule@example.com', subject: 'Owned schedule',
    cronExpression: '0 0 9 * * ?', cronDescription: 'Every day, at 9:00 am', cronTimeZoneId: 'UTC' })
  await expectLoaded(page, 'scheduledReportCronWidget')
  await expect(byId(page, 'cron-expression-scheduledReportCronWidget')).toHaveText('0 0 9 * * ?')
  await expect(byId(page, 'cron-description-scheduledReportCronWidget')).toHaveText('Every day, at 9:00 am')
  await open(page, '/app/savedReport/1')
  await expectLoaded(page, 'scheduledReportJoinSavedReport')
  await expect(byId(page, `child-record-row-scheduledReportJoinSavedReport-${id}`)).toBeVisible()
})

test('[RPT-012] an invalid cron expression is rejected with the backend message and nothing is saved', async ({ page, backend, diagnostics }) => {
  diagnostics.allow('/data/scheduledReport 400')
  diagnostics.allow('Failed to load resource: the server responded with a status of 400')
  await fillSchedule(page, 'not a cron')
  await expect(page).toHaveURL(/\/app\/scheduledReport\/create\/?$/)
  expect((await (await backend.api.get('/data/scheduledReport')).json()).records ?? []).toEqual([])
  await expect(page.getByRole('alert').filter({ hasText: /Cron Expression \[not a cron\] is not valid/ }).first()).toBeVisible()
})

test('[RPT-013] the owner shares a saved report read-only with a user', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const dialog = await openShare(page, '/app/savedReport/1')
  await expect(dialog.getByRole('heading', { name: 'Share Report: Pet Species Report' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Current Shares (0)' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Share' })).toBeDisabled()
  expect(await dialog.getByLabel('User or Group').locator('option').allTextContents()).toEqual(['Select a user or group', 'Alice', 'Bob', 'Casey'])
  await dialog.getByLabel('User or Group').selectOption({ label: 'Bob' })
  await expect(dialog.getByLabel('Scope', { exact: true })).toHaveValue('READ_ONLY')
  await dialog.getByRole('button', { name: 'Share' }).click()
  await expect(dialog.getByRole('heading', { name: 'Current Shares (1)' })).toBeVisible()
  await expect(dialog.getByRole('list')).toContainText('Bob')
  // the whole recipient id is stored (it contains a colon; see #444)
  expect(await sqlRows(backend, 'select saved_report_id, user_id, scope from shared_saved_report where saved_report_id = 1')).toEqual([{ saved_report_id: '1', user_id: 'sample:bob', scope: 'READ_ONLY' }])
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(dialog).toBeHidden()
})

test('[RPT-014] the owner changes a share to read and edit', async ({ page, backend, diagnostics }) => {
  void diagnostics
  expect((await shareViaApi(backend, 'insertSharedRecord', { tableName: 'savedReport', recordId: 1, audienceType: 'user', audienceId: 'sample:bob', scopeId: 'READ_ONLY' })).status).toBe(200)
  const [share] = await sqlRows(backend, "select id from shared_saved_report where saved_report_id = 1 and user_id = 'sample:bob'")
  const dialog = await openShare(page, '/app/savedReport/1')
  await dialog.getByLabel('Scope for Bob').selectOption('READ_WRITE')
  await expect.poll(async () => (await sqlRows(backend, `select scope from shared_saved_report where id = ${share.id}`))[0].scope).toBe('READ_WRITE')
  await expect(dialog.getByLabel('Scope for Bob')).toHaveValue('READ_WRITE')
})

test('[RPT-015] the owner removes a share', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await shareViaApi(backend, 'insertSharedRecord', { tableName: 'savedReport', recordId: 1, audienceType: 'user', audienceId: 'sample:casey', scopeId: 'READ_ONLY' })
  const dialog = await openShare(page, '/app/savedReport/1')
  await expect(dialog.getByRole('heading', { name: 'Current Shares (1)' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Remove share with Casey' }).click()
  await expect(dialog.getByRole('heading', { name: 'Current Shares (0)' })).toBeVisible()
  await expect(dialog.getByText('This record is not shared.')).toBeVisible()
  expect(await sqlRows(backend, 'select id from shared_saved_report where saved_report_id = 1')).toEqual([])
})

test('[RPT-018] a saved view is shared through the same dialog', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const dialog = await openShare(page, '/app/savedView/1')
  await expect(dialog.getByRole('heading', { name: /^Share View: / })).toBeVisible()
  await dialog.getByLabel('User or Group').selectOption({ label: 'Casey' })
  await dialog.getByLabel('Scope', { exact: true }).selectOption('READ_WRITE')
  await dialog.getByRole('button', { name: 'Share' }).click()
  await expect(dialog.getByRole('list')).toContainText('Casey')
  expect(await sqlRows(backend, 'select saved_view_id, user_id, scope from shared_saved_view')).toEqual([{ saved_view_id: '1', user_id: 'sample:casey', scope: 'READ_WRITE' }])
})

test('[RPT-017] only the owner may share: the button is disabled for others and the server refuses', async ({ page, backend, diagnostics }) => {
  void diagnostics
  // alice can read casey's report through its read-only share, but does not own it
  await open(page, '/app/savedReport/101')
  await expect(page.getByRole('heading', { level: 1, name: 'Casey Shared People Report' })).toBeVisible()
  const share = page.getByRole('button', { name: 'Share', exact: true })
  await expect(share).toBeDisabled()
  await expect(share).toHaveAccessibleDescription('Only the owner of a Report may share it.')
  const refused = await shareViaApi(backend, 'insertSharedRecord', { tableName: 'savedReport', recordId: 101, audienceType: 'user', audienceId: 'sample:bob', scopeId: 'READ_ONLY' })
  expect(refused.body.type).toBe('ERROR')
  expect(refused.body.error).toContain('You are not the owner of this record')
  expect(await sqlRows(backend, "select user_id from shared_saved_report where saved_report_id = 101 order by user_id")).toEqual([{ user_id: 'sample:alice' }])
  // alice's own report is shareable
  await open(page, '/app/savedReport/1')
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeEnabled()
})

test.describe('as another user', () => {
  test.use({ user: 'bob' })

  test('[RPT-016] an unshared report is invisible to another user until it is shared', async ({ page, backend, diagnostics }) => {
    diagnostics.allow('/data/savedReport/1 404')
    diagnostics.allow('/qqq/v1/table/savedReport/1 404')
    diagnostics.allow('Failed to load resource: the server responded with a status of 404')
    const [report] = await sqlRows(backend, "select label from saved_report where id = 1 and user_id = 'sample:alice'")
    expect((await backend.api.get('/data/savedReport/1')).status()).toBe(404)
    await open(page, '/app/savedReport')
    // bob owns no reports and nothing is shared with him yet
    await expect(page.getByRole('heading', { name: 'No records found' })).toBeVisible()
    await expect(page.getByText(report.label, { exact: true })).toHaveCount(0)
    // alice shares it with bob
    await backend.setPersona('admin', 'alice')
    expect((await shareViaApi(backend, 'insertSharedRecord', { tableName: 'savedReport', recordId: 1, audienceType: 'user', audienceId: 'sample:bob', scopeId: 'READ_ONLY' })).status).toBe(200)
    await backend.setPersona('admin', 'bob')
    expect((await backend.api.get('/data/savedReport/1')).status()).toBe(200)
    await page.reload()
    await expect(page.getByRole('grid', { name: 'Report records' }).getByRole('gridcell', { name: report.label, exact: true })).toBeVisible()
    await open(page, '/app/savedReport/1')
    await expect(page.getByRole('heading', { level: 1, name: report.label })).toBeVisible()
    expect(await sqlRows(backend, "select user_id from shared_saved_report where saved_report_id = 1")).toEqual([{ user_id: 'sample:bob' }])
  })
})
