/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Widgets embedded in record-view sections (not association editors).
import type { Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { expectTouchReady } from '../../support/touch'
import { byId, expectLoaded, openRecord, sqlRows, widgetBody } from './widget-support'

async function openHost(page: Page, id: number) {
  await openRecord(page, `/app/accWidgetHost/${id}`)
}

test('[WID-060] section widgets receive the hosting record id and table @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  for (const id of [1, 2]) {
    const [host] = await sqlRows(backend, `select owner, zero from acc_widget_host where id = ${id}`)
    await openHost(page, id)
    await expectLoaded(page, 'accHostHtml')
    await expect(widgetBody(page, 'accHostHtml')).toHaveText(`Host record ${id} in accWidgetHost`)
    await expect(byId(page, 'field-value-accHostFieldValues-owner')).toHaveText(`Owner:${host.owner}`)
    await expect(byId(page, 'field-value-accHostFieldValues-zero')).toHaveText(`Zero:${host.zero}`)
  }
})

test('[WID-026] cron widget shows the record expression, backend description and time zone @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const [host] = await sqlRows(backend, 'select cron_expression, cron_time_zone_id from acc_widget_host where id = 1')
  const description = (await (await backend.api.get('/widget/accHostCron?id=1&tableName=accWidgetHost')).json()).cronDescription
  expect(description).toBe('Every day, at 9:00 am')
  await openHost(page, 1)
  await expectLoaded(page, 'accHostCron')
  await expect(byId(page, 'cron-expression-accHostCron')).toHaveText(host.cron_expression)
  await expect(byId(page, 'cron-description-accHostCron')).toHaveText(description)
  await expect(byId(page, 'cron-time-zone-accHostCron')).toHaveText(host.cron_time_zone_id)
  await openHost(page, 3)
  await expectLoaded(page, 'accHostCron')
  await expect(byId(page, 'cron-empty-accHostCron')).toHaveText('No schedule set')
})

test('[WID-027] dynamic form widget shows labeled values including zero @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const [host] = await sqlRows(backend, 'select owner, zero from acc_widget_host where id = 1')
  await openHost(page, 1)
  await expectLoaded(page, 'accHostDynamicForm')
  await expect(byId(page, 'dynamic-form-field-accHostDynamicForm-owner')).toHaveText(`Owner${host.owner}`)
  await expect(byId(page, 'dynamic-form-field-accHostDynamicForm-zero')).toHaveText('Zero0')
})

test('[WID-024] child record list without an association lists joined records with paging and links @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const children = await sqlRows(backend, 'select id, name from acc_widget_host_child where host_id = 1 order by id')
  expect(children).toHaveLength(3)
  await openHost(page, 1)
  await expectLoaded(page, 'accWidgetHostJoinChild')
  const list = byId(page, 'widget-childRecordList-accWidgetHostJoinChild')
  await expect(list.getByRole('columnheader')).toHaveText(['Id', 'Name'])
  for (const child of children.slice(0, 2)) {
    await expect(byId(page, `child-record-row-accWidgetHostJoinChild-${child.id}`)).toHaveText(`${child.id}${child.name}`)
  }
  await expect(byId(page, `child-record-row-accWidgetHostJoinChild-${children[2].id}`)).toHaveCount(0)
  await expect(list).toContainText('Showing 2 of 3')
  await expect(byId(page, 'child-record-view-all-accWidgetHostJoinChild')).toHaveAttribute('href', /\/app\/accWidgetHostChild\/?\?filter=/)
  await list.getByRole('link', { name: String(children[0].id), exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/app/accWidgetHostChild/${children[0].id}/?$`))
  await expect(page.getByRole('heading', { level: 1, name: children[0].name })).toBeVisible()
  // a host without children shows an empty state
  await openRecord(page, '/app/accWidgetHost/3')
  await expectLoaded(page, 'accWidgetHostJoinChild')
  await expect(byId(page, 'widget-empty-accWidgetHostJoinChild')).toHaveText('No Widget Host Child records found')
})

test('[WID-031] row builder without an association shows its rows read-only @mobile', async ({ page, diagnostics }) => {
  void diagnostics
  await openHost(page, 1)
  await expectLoaded(page, 'accHostRows')
  const table = byId(page, 'widget-rowBuilder-accHostRows')
  await expect(table.getByRole('columnheader')).toHaveText(['Row Name', 'Row Quantity'])
  await expect(byId(page, 'row-builder-row-accHostRows-0')).toHaveText('Owned row one3')
  await expect(byId(page, 'row-builder-row-accHostRows-1')).toHaveText('Owned row two0')
  await expect(table.getByRole('textbox')).toHaveCount(0)
})

test('[WID-028] data bag viewer lists versions newest first and shows the selected contents @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const versions = await sqlRows(backend, 'select id, sequence_no, commit_message, data from data_bag_version where data_bag_id = 1 order by sequence_no desc')
  await openRecord(page, '/app/dataBag/1')
  await expectLoaded(page, 'accDataBagViewer')
  const newest = byId(page, `data-bag-version-${versions[0].id}`)
  await expect(newest).toContainText(`Version ${versions[0].sequence_no}`)
  await expect(newest).toContainText('CURRENT')
  await expect(newest).toContainText(versions[0].commit_message)
  await expect(newest).toHaveAttribute('aria-pressed', 'true')
  const contents = byId(page, 'data-bag-contents-accDataBagViewer')
  expect(JSON.parse((await contents.textContent())!)).toEqual(JSON.parse(versions[0].data))
  await byId(page, `data-bag-version-${versions[1].id}`).click()
  await expect.poll(async () => JSON.parse((await contents.textContent()) ?? 'null')).toEqual(JSON.parse(versions[1].data))
  await openRecord(page, '/app/dataBag/2')
  await expectLoaded(page, 'accDataBagViewer')
  await expect(byId(page, 'widget-empty-accDataBagViewer')).toHaveText('There are not any versions of this data bag.')
})

test('[WID-032] script viewer marks the current revision and shows each revision file @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const script = await (await backend.api.get('/data/script/1')).json()
  expect(script.values.currentScriptRevisionId).toBe(2)
  await openRecord(page, '/app/script/1')
  await expectLoaded(page, 'scriptViewer')
  const current = byId(page, 'script-revision-2')
  await expect(current).toContainText('Version 2')
  await expect(current).toContainText('CURRENT')
  await expect(current).toContainText('Owned second revision')
  const files = page.locator('[data-qqq-id^="script-file-"]').filter({ visible: true })
  await expect(files).toHaveCount(1)
  await expect(files).toContainText(['return \'owned two\';'])
  await expect(files.first()).toContainText('Script.js')
  await byId(page, 'script-revision-1').click()
  await expect(files.first()).toContainText('return \'owned one\';')
})

/** The v1 widget data route prefix (the UI calls no unversioned route; the diagnostics fixture enforces it). */
const WIDGET_ROUTE = '/qqq/v1/widget/'

/** Records the widget data requests the page makes, by widget name. */
function widgetRequests(page: Page): Map<string, number> {
  const counts = new Map<string, number>()
  page.on('request', (request) => {
    const { pathname } = new URL(request.url())
    if (!pathname.startsWith(WIDGET_ROUTE)) return
    const name = decodeURIComponent(pathname.slice(WIDGET_ROUTE.length))
    counts.set(name, (counts.get(name) ?? 0) + 1)
  })
  return counts
}

const HOST_SECTION_WIDGETS = ['accHostCron', 'accHostFieldValues', 'accHostHtml', 'accHostDynamicForm', 'accWidgetHostJoinChild', 'accHostRows']

test('[WID-065] a record view mounts each section widget once and requests its data once', async ({ page, diagnostics }) => {
  void diagnostics
  const requests = widgetRequests(page)
  await openHost(page, 1)
  for (const name of HOST_SECTION_WIDGETS) await expectLoaded(page, name)
  await expect(page.locator('[data-qqq-id="record-view-accordion"]')).toHaveCount(0)
  for (const name of HOST_SECTION_WIDGETS) {
    await expect(page.locator(`[data-qqq-id="widget-${name}"]`), `${name} mounted once`).toHaveCount(1)
    expect(requests.get(name), `${name} requested once`).toBe(1)
  }
})

test.describe('at phone width', () => {
  test.use({ viewport: { width: 412, height: 839 }, hasTouch: true })

  test('[WID-065] the accordion mounts only open sections and requests each widget once @mobile', async ({ page, diagnostics }) => {
    void diagnostics
    const requests = widgetRequests(page)
    // opened as a user lands on it: openHost expands every section, which is what this test must not do
    await page.goto('/app/accWidgetHost/1', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // the first section (the schedule) starts open; the desktop tab layout is not mounted
    await expectLoaded(page, 'accHostCron')
    await expect(page.locator('[data-qqq-id="record-view-tabs"]')).toHaveCount(0)
    await expect(page.locator('[data-qqq-id="widget-accHostHtml"]')).toHaveCount(0)
    expect(requests.get('accHostHtml')).toBeUndefined()
    await page.getByRole('button', { name: 'Owned Record Html' }).click()
    await expectLoaded(page, 'accHostHtml')
    await expect(widgetBody(page, 'accHostHtml')).toHaveText('Host record 1 in accWidgetHost')
    for (const name of ['accHostCron', 'accHostHtml']) {
      await expect(page.locator(`[data-qqq-id="widget-${name}"]`), `${name} mounted once`).toHaveCount(1)
      expect(requests.get(name), `${name} requested once`).toBe(1)
    }
  })
})

test('[WID-064] the schedule editor edits an existing expression in Advanced mode with live validation and the backend description @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const expression = '0 */15 8-17 ? * MON-FRI'
  const backendDescription = (await (await backend.api.get(`/widget/accHostCron?cronExpression=${encodeURIComponent(expression)}`)).json()).cronDescription
  expect(backendDescription).toBe('Every week, every day between Monday and Friday, every hour between 8am and 5pm, every 15 minutes between 00 and 59')
  await open(page, '/app/accWidgetHost/1/edit')
  const editor = byId(page, 'cron-editor-accHostCron')
  const live = byId(page, 'cron-editor-description-accHostCron')
  // the stored 0 0 9 * * ? opens in Basic mode
  await expect(editor.getByRole('button', { name: 'Basic' })).toHaveAttribute('aria-pressed', 'true')
  await expect(editor.getByRole('button', { name: /^Days/ })).toHaveText('Every day')
  await expect(editor.getByRole('button', { name: /^Hours/ })).toHaveText('9am')
  await expect(editor.getByRole('button', { name: /^Minutes/ })).toHaveText('00')
  await expect(live).toHaveText('Every day, at 9:00 am')

  await editor.getByRole('button', { name: 'Advanced' }).click()
  const input = editor.getByLabel(/^Schedule Expression/)
  await expect(input).toHaveValue('0 0 9 * * ?')
  await input.fill('0 75 9 * * ?')
  await expect(byId(page, 'cron-editor-error-accHostCron')).toHaveText('Minute values must be between 0 and 59')
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expectTouchReady(page, editor)
  await input.fill(expression)
  await expect(live).toHaveText(backendDescription)
  await expect(input).not.toHaveAttribute('aria-invalid')
  await expect(editor.getByRole('button', { name: 'Basic' })).toBeDisabled()
  await expect(byId(page, 'cron-basic-reason-accHostCron')).toHaveText('To use Basic mode each part must be *, single values, lists or ranges')
  await page.getByLabel(/^Time Zone/).fill('America/New_York')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/accWidgetHost\/1\/?$/)
  expect(await sqlRows(backend, 'select cron_expression, cron_time_zone_id from acc_widget_host where id = 1')).toEqual([{ cron_expression: expression, cron_time_zone_id: 'America/New_York' }])
  await expectLoaded(page, 'accHostCron')
  await expect(byId(page, 'cron-description-accHostCron')).toHaveText(backendDescription)
  await expect(byId(page, 'cron-time-zone-accHostCron')).toHaveText('America/New_York')
})
