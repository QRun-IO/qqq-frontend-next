/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, open, test } from '../../support/fixtures'
import { advance, choosePossibleValue, expectScreen, openProcess } from './process-helpers'

test.describe('Refresh and session', () => {
  test('[PRC-040] reloading mid-process starts a fresh run from the first screen @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const runs: string[] = []
    page.on('response', async (response) => {
      if (response.url().includes('/processes/prcComponents/init')) runs.push((await response.json()).processUUID)
    })
    await openProcess(page, 'prcComponents')
    const mixed = await expectScreen(page, 'mixed', 'Mixed Components')
    await mixed.getByLabel('Lab Name').fill('Before Reload')
    await choosePossibleValue(page, 'Lab Color', 'Red')
    await advance(page, 'Next')
    await expectScreen(page, 'review', 'Review Lab')
    await page.reload({ waitUntil: 'domcontentloaded' })
    const fresh = await expectScreen(page, 'mixed', 'Mixed Components')
    await expect(fresh.getByLabel('Lab Name')).toHaveValue('')
    await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0)
    await expect.poll(() => runs.length).toBe(2)
    expect(runs[0]).not.toBe(runs[1])
    expect(await backend.sql('select name from prc_lab_run')).toEqual([{ name: 'Before Reload' }])
  })

  test('[PRC-041] an expired session mid-process returns the user to sign in @mobile', async ({ page, backend, diagnostics }) => {
    diagnostics.allow(/ 401$/)
    diagnostics.allow('the server responded with a status of 401')
    await openProcess(page, 'prcComponents')
    const mixed = await expectScreen(page, 'mixed', 'Mixed Components')
    await mixed.getByLabel('Lab Name').fill('Expired')
    await backend.setPersona('expired')
    // Mock sign-in succeeds at once and returns to the process, so watch for the visit to
    // the sign-in page (with the process as returnTo) instead of polling the current URL.
    const signIn = page.waitForURL(/\/login\/?\?returnTo=%2Fapp%2FprcComponents/, { waitUntil: 'commit' })
    await advance(page, 'Next')
    await signIn
    expect(await backend.sql('select count(*) as n from prc_lab_run')).toEqual([{ n: '0' }])
  })

  test('[PRC-042] processes without permission cannot be run and the backend refuses them @mobile', async ({ page, backend, diagnostics }) => {
    diagnostics.allow('/processes/prcComponents/')
    diagnostics.allow('the server responded with a status of 403')
    await openProcess(page, 'prcComponents')
    const mixed = await expectScreen(page, 'mixed', 'Mixed Components')
    await mixed.getByLabel('Lab Name').fill('Revoked')
    // permissions revoked while the screen is open: the step is refused
    await backend.setPersona('noProcesses')
    await advance(page, 'Next')
    const error = page.locator('[data-qqq-id="process-error-prcComponents"]')
    await expect(error.locator('[data-qqq-id="process-error-message"]')).toHaveText('You do not have permission to run this process.')
    expect(await backend.sql('select count(*) as n from prc_lab_run')).toEqual([{ n: '0' }])

    // a fresh page no longer offers the process at all
    await open(page, '/app/prcComponents')
    await expect(page.locator('[data-qqq-id="not-found-state"]')).toContainText('There is no app, table, process or report named prcComponents that you can open.')
    await expect(page.locator('[data-qqq-id="process-run-prcComponents"]')).toHaveCount(0)
    const refused = await backend.api.post('/processes/prcComponents/init', { multipart: {} })
    expect(refused.status()).toBe(403)
  })
})
