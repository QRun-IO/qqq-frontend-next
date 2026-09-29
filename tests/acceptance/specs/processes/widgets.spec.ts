/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, test } from '../../support/fixtures'
import { installGoogleDriveProvider } from '../../support/google-drive-provider'
import { advance, expectRunTouchReady, expectScreen, openProcess, viewValue } from './process-helpers'

test.describe('Widget Lab', () => {
  test('[PRC-035] a named widget is fetched with the process UUID and values @mobile', async ({ page, diagnostics }) => {
    void diagnostics
    const widgetRequests: string[] = []
    page.on('request', (request) => { if (request.url().includes('/widget/')) widgetRequests.push(request.url()) })
    await openProcess(page, 'prcWidgets')
    const interact = await expectScreen(page, 'interact', 'Interact')
    const widget = interact.getByRole('region', { name: 'Lab Status Widget' })
    await expect(widget).toContainText('Lab status for Casey Operator (linked)')
    await expectRunTouchReady(page, 'prcWidgets')
    expect(widgetRequests).toHaveLength(1)
    const url = new URL(widgetRequests[0])
    expect(url.pathname).toBe('/qqq/v1/widget/prcHtmlWidget')
    expect(url.searchParams.get('operator')).toBe('Casey Operator')
    expect(url.searchParams.get('processUUID')).toMatch(/^[0-9a-f-]{36}$/)
  })

  test('[PRC-036] a named composite widget renders the data seeded in process values @mobile', async ({ page, diagnostics }) => {
    void diagnostics
    const widgetRequests: string[] = []
    page.on('request', (request) => { if (request.url().includes('/widget/prcCompositeWidget')) widgetRequests.push(request.url()) })
    await openProcess(page, 'prcWidgets')
    const interact = await expectScreen(page, 'interact', 'Interact')
    const widget = interact.getByRole('region', { name: 'Lab Composite Widget' })
    await expect(widget).toContainText('Seeded composite for Casey Operator')
    await expect(widget).not.toContainText('Fetched composite')
    expect(widgetRequests).toEqual([])
  })

  test('[PRC-037] ad hoc widget blocks interpolate, hide conditionals and submit actions @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'prcWidgets')
    const interact = await expectScreen(page, 'interact', 'Interact')
    const adhoc = interact.locator('[data-qqq-id="process-adhoc-widget-2"]')
    await expect(adhoc).toContainText('Scan or choose for Casey Operator')
    await expect(adhoc).not.toContainText('Secret block that must stay hidden')
    await expect(adhoc.getByPlaceholder('Scan a code')).toBeVisible()
    await expectRunTouchReady(page, 'prcWidgets')
    const approve = adhoc.getByRole('button', { name: 'Approve' })
    const buttonBounds = await approve.boundingBox()
    const containerBounds = await adhoc.boundingBox()
    expect(buttonBounds).not.toBeNull()
    expect(containerBounds).not.toBeNull()
    expect(buttonBounds!.width).toBeLessThan(containerBounds!.width * 0.8)
    await approve.click()
    const decided = await expectScreen(page, 'decided', 'Decided')
    await expect(viewValue(decided, 'decision')).toHaveText('approve')
    expect(await backend.sql('select action_code, scan_code from prc_decision_log')).toEqual([{ action_code: 'approve', scan_code: null }])

    await openProcess(page, 'prcWidgets')
    await expectScreen(page, 'interact', 'Interact')
    const input = page.getByLabel('Scan Code')
    await input.fill('ABC-123')
    await input.press('Enter')
    const scanned = await expectScreen(page, 'decided', 'Decided')
    await expect(viewValue(scanned, 'decision')).toHaveText('scanned')
    await expect(viewValue(scanned, 'scanCode')).toHaveText('ABC-123')
    expect(await backend.sql('select action_code, scan_code from prc_decision_log order by id')).toEqual([
      { action_code: 'approve', scan_code: null }, { action_code: null, scan_code: 'ABC-123' },
    ])
  })
})

test.describe('Drive Export', () => {
  test('[PRC-038] a Google Drive folder step still collects and submits its other inputs @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'prcDrive')
    const pick = await expectScreen(page, 'pickFolder', 'Pick Folder')
    const types = await pick.locator('[data-component-type]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-component-type')))
    expect(types).toEqual(['HELP_TEXT', 'GOOGLE_DRIVE_SELECT_FOLDER', 'EDIT_FORM'])
    await expect(pick.getByText('Choose a destination folder and describe the export.')).toBeVisible()
    await expect(pick.getByRole('button', { name: 'Select Google Drive Folder' })).toBeDisabled()
    await expect(pick.locator('[data-qqq-id="process-google-drive-note"]')).toHaveText('Google Drive folder selection is not configured for this application.')
    await advance(page, 'Submit')
    await expect(pick.getByText('Export Note is required')).toBeVisible()
    await expectRunTouchReady(page, 'prcDrive')
    await pick.getByLabel('Export Note').fill('Quarterly export')
    await advance(page, 'Submit')
    const exported = await expectScreen(page, 'exported', 'Exported')
    await expect(viewValue(exported, 'exportNote')).toHaveText('Quarterly export')
    expect(await backend.sql('select note, folder_id from prc_drive_log')).toEqual([{ note: 'Quarterly export', folder_id: '' }])
  })
})


test('[PRC-065] configured Drive folder and other inputs reach the backend together @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  expect((await backend.api.post('/acceptance/google-drive')).status()).toBe(200)
  await installGoogleDriveProvider(page)
  await openProcess(page, 'prcDrive')
  const pick = await expectScreen(page, 'pickFolder', 'Pick Folder')
  await advance(page, 'Submit')
  await expect(pick.getByText('Export Note is required')).toBeVisible()
  await pick.getByRole('button', { name: 'Select Google Drive Folder' }).click()
  await page.getByRole('dialog', { name: 'Google provider fixture' }).getByRole('button', { name: 'Exports folder' }).click()
  await expect(pick.getByText('Selected folder: Exports')).toBeVisible()
  await pick.getByLabel('Export Note').fill('Configured export')
  await advance(page, 'Submit')
  await expectScreen(page, 'exported', 'Exported')
  expect(await backend.sql("select note, folder_id, folder_name, case when token_present then 'yes' else 'no' end as token_present from prc_drive_log")).toEqual([
    { note: 'Configured export', folder_id: 'folder-owned', folder_name: 'Exports', token_present: 'yes' },
  ])
})

test('[PRC-065] invalid file recovers and cancelling a replacement clears the destination @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  expect((await backend.api.post('/acceptance/google-drive')).status()).toBe(200)
  await installGoogleDriveProvider(page)
  await openProcess(page, 'prcDrive')
  const pick = await expectScreen(page, 'pickFolder', 'Pick Folder')
  const select = pick.getByRole('button', { name: 'Select Google Drive Folder' })
  const provider = page.getByRole('dialog', { name: 'Google provider fixture' })
  await select.click()
  await provider.getByRole('button', { name: 'A file', exact: true }).click()
  await expect(pick.getByRole('alert')).toContainText('folder is required')
  await select.click()
  await provider.getByRole('button', { name: 'Exports folder' }).click()
  await expect(pick.getByText('Selected folder: Exports')).toBeVisible()
  await expect(pick.getByRole('alert')).toHaveCount(0)
  await select.click()
  await provider.getByRole('button', { name: 'Cancel selection' }).click()
  await expect(pick.getByText('Selected folder: Exports')).toHaveCount(0)
  await pick.getByLabel('Export Note').fill('Cancelled destination')
  await advance(page, 'Submit')
  await expectScreen(page, 'exported', 'Exported')
  expect(await backend.sql("select note, folder_id, folder_name, case when token_present then 'yes' else 'no' end as token_present from prc_drive_log")).toEqual([
    { note: 'Cancelled destination', folder_id: '', folder_name: '', token_present: 'no' },
  ])
})
