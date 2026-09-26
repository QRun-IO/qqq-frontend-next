/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, test } from '../../support/fixtures'
import { expectTouchReady } from '../../support/touch'
import { advance, choosePossibleValue, expectRunTouchReady, expectScreen, openProcess, recordRows, run, viewValue } from './process-helpers'

test.describe('Route Wizard', () => {
  test('[PRC-017] the backend replaces the step list for the chosen route @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'prcWizard')
    const wizard = page.locator('[data-qqq-id="step-wizard"]')
    await expectScreen(page, 'chooseRoute', 'Choose Route')
    await expect(wizard.locator('li')).toHaveText(['1Choose Route', '2Long Route Details', '3Confirm Route'])
    await choosePossibleValue(page, 'Route', 'Short route')
    await page.getByLabel('Route Note').fill('Quick trip')
    await advance(page, 'Next')

    const confirm = await expectScreen(page, 'confirm', 'Confirm Route')
    await expect(wizard.locator('li')).toHaveCount(2)
    await expect(wizard).not.toContainText('Long Route Details')
    await expect(page.getByText('Step 2 of 2')).toBeVisible()
    await expectRunTouchReady(page, 'prcWizard')
    await expect(viewValue(confirm, 'route')).toHaveText('Short route')
    await expect(viewValue(confirm, 'routeNote')).toHaveText('Quick trip')
    await expect(page.getByRole('button', { name: 'Return' })).toBeVisible()
    expect(await backend.sql('select route, note, detail from prc_route_log')).toEqual([{ route: 'short', note: 'Quick trip', detail: null }])
  })

  test('[PRC-018] updated field metadata relabels and requires a later input @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'prcWizard')
    await expectScreen(page, 'chooseRoute', 'Choose Route')
    await choosePossibleValue(page, 'Route', 'Long route')
    await advance(page, 'Next')
    const details = await expectScreen(page, 'longDetails', 'Long Route Details')
    await expect(details.getByLabel('Detail', { exact: true })).toHaveCount(0)
    const detail = details.getByLabel('Long Route Detail')
    await expect(detail).toHaveAttribute('aria-required', 'true')
    await advance(page, 'Submit')
    await expect(details.getByText('Long Route Detail is required')).toBeVisible()
    await expectRunTouchReady(page, 'prcWizard')
    expect(await backend.sql('select count(*) as n from prc_route_log')).toEqual([{ n: '0' }])
    await detail.fill('Scenic coast')
    await advance(page, 'Submit')
    const confirm = await expectScreen(page, 'confirm', 'Confirm Route')
    await expect(viewValue(confirm, 'detail')).toHaveText('Scenic coast')
    expect(await backend.sql('select route, detail from prc_route_log')).toEqual([{ route: 'long', detail: 'Scenic coast' }])
  })

  test('[PRC-016] back is offered only where the backend names a back step @mobile', async ({ page, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'prcWizard')
    await expectScreen(page, 'chooseRoute', 'Choose Route')
    await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0)
    await choosePossibleValue(page, 'Route', 'Long route')
    await page.getByLabel('Route Note').fill('Take the long way')
    await advance(page, 'Next')
    await expectScreen(page, 'longDetails', 'Long Route Details')
    await page.getByRole('button', { name: 'Back' }).click()
    const choose = await expectScreen(page, 'chooseRoute', 'Choose Route')
    await expect(choose.getByLabel('Route Note')).toHaveValue('Take the long way')
    await expect(choose.getByRole('combobox', { name: 'Route' })).toContainText('Long route')

    await openProcess(page, 'greetInteractive', { recordIds: [1] })
    await expectScreen(page, 'setup', 'Setup')
    await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0)
    await advance(page, 'Submit')
    await expectScreen(page, 'results', 'Results')
    await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0)
  })
})

test.describe('Progress Lab', () => {
  test('[PRC-019] a long step reports progress while it runs, then continues @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'prcProgress')
    const configure = await expectScreen(page, 'configure', 'Configure')
    await expect(configure.getByLabel('Item Count')).toHaveValue('4')
    await configure.getByLabel('Item Count').fill('5')
    await configure.getByLabel('Delay Millis').fill('1500')
    await advance(page, 'Submit')

    const working = page.locator('[data-qqq-id="process-working"]')
    await expect(working.getByRole('heading', { name: 'Working' })).toBeVisible()
    await expect(working.locator('[data-qqq-id="process-working-message"]')).toHaveText(/^Processing item [2-5] of 5$/, { timeout: 20_000 })
    await expect(working.locator('[data-qqq-id="process-working-counts"]')).toHaveText(/^[2-5] of 5$/)
    const progress = working.getByRole('progressbar', { name: 'Process progress' })
    await expect(progress).toHaveAttribute('aria-valuemax', '5')
    await expect(working.locator('[data-qqq-id="process-working-updated"]')).toHaveText(/^Updated at /)
    await expectRunTouchReady(page, 'prcProgress')

    const finished = await expectScreen(page, 'finished', 'Finished')
    await expect(viewValue(finished, 'processedCount')).toHaveText('5')
    expect(await backend.sql('select item_count from prc_progress_log')).toEqual([{ item_count: '5' }])
  })

  test('[PRC-020] cancelling from a screen and mid-job runs the cancel step and leaves @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'prcProgress')
    await expectScreen(page, 'configure', 'Configure')
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Cancel Process?' })
    await expect(dialog).toBeVisible()
    await expectTouchReady(page, dialog)
    await dialog.getByRole('button', { name: 'Stay on Page' }).click()
    await expect(dialog).toBeHidden()
    expect(await backend.sql('select count(*) as n from prc_cancel_log')).toEqual([{ n: '0' }])
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await dialog.getByRole('button', { name: 'Cancel Process' }).click()
    await expect(page).toHaveURL(/\/app\/prcLab\/?$/)
    // the cancel step sees the screen's default value, the only input the backend holds so far
    await expect.poll(() => backend.sql('select item_count, note from prc_cancel_log')).toEqual([{ item_count: '4', note: 'cancelled by user' }])

    await openProcess(page, 'prcProgress')
    const configure = await expectScreen(page, 'configure', 'Configure')
    await configure.getByLabel('Item Count').fill('8')
    await configure.getByLabel('Delay Millis').fill('1500')
    await advance(page, 'Submit')
    const working = page.locator('[data-qqq-id="process-working"]')
    await working.getByRole('button', { name: 'Cancel' }).click()
    await dialog.getByRole('button', { name: 'Cancel Process' }).click()
    await expect(page).toHaveURL(/\/app\/prcLab\/?$/)
    await expect.poll(() => backend.sql('select item_count from prc_cancel_log order by id')).toEqual([{ item_count: '4' }, { item_count: '8' }])
    await expect(run(page, 'prcProgress')).toHaveCount(0)
  })
})

test.describe('Failures and retry', () => {
  test('[PRC-021] internal errors sit behind a detail toggle; user-facing errors show directly @mobile', async ({ page, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'prcFailures')
    await expectScreen(page, 'chooseFailure', 'Choose Failure')
    await choosePossibleValue(page, 'Failure Mode', 'Internal failure')
    await advance(page, 'Submit')
    const error = page.locator('[data-qqq-id="process-error-prcFailures"]')
    await expect(error).toContainText('An error occurred while running the process: Failure Lab')
    const detail = error.locator('[data-qqq-id="process-error-detail"]')
    await expect(detail).toBeHidden()
    await error.getByRole('button', { name: 'Show detailed error message' }).click()
    await expect(detail).toHaveText('Error message: Lab internals failed at stage 7')
    await expectRunTouchReady(page, 'prcFailures')
    await error.getByRole('button', { name: 'Hide detailed error message' }).click()
    await expect(detail).toBeHidden()

    await openProcess(page, 'prcFailures')
    await expectScreen(page, 'chooseFailure', 'Choose Failure')
    await choosePossibleValue(page, 'Failure Mode', 'User-facing failure')
    await advance(page, 'Submit')
    await expect(page.locator('[data-qqq-id="process-error-message"]')).toHaveText('The lab rejected this input.')

    await page.locator('[data-qqq-id="process-error-prcFailures"]').getByRole('button', { name: 'Close' }).click()
    await expect(page).toHaveURL(/\/app\/prcLab\/?$/)

    // the sample's thrower sleeps for sleepMillis before throwing
    await openProcess(page, 'simpleThrow', undefined, { defaultProcessValues: JSON.stringify({ sleepMillis: 10 }) })
    const thrown = page.locator('[data-qqq-id="process-error-simpleThrow"]')
    await thrown.getByRole('button', { name: 'Show detailed error message' }).click()
    await expect(thrown.locator('[data-qqq-id="process-error-detail"]')).toHaveText('Error message: I always throw.')
  })

  test('[PRC-022] retry restarts the run with the original record selection @mobile', async ({ page, diagnostics }) => {
    void diagnostics
    const inits: string[] = []
    page.on('request', (request) => { if (request.url().includes('/processes/prcFlaky/init')) inits.push(request.postData() ?? '') })
    await openProcess(page, 'prcFlaky', { recordIds: [2, 4] })
    const error = page.locator('[data-qqq-id="process-error-prcFlaky"]')
    await expect(error.locator('[data-qqq-id="process-error-message"]')).toHaveText('The lab loader is warming up. Please retry.')
    await expectRunTouchReady(page, 'prcFlaky')
    await error.getByRole('button', { name: 'Retry' }).click()
    const loaded = await expectScreen(page, 'loaded', 'Loaded')
    await expect(viewValue(loaded, 'loadedNames')).toHaveText('Beta, Delta')
    await expect.poll(() => recordRows(loaded)).toEqual([['2', 'Beta'], ['4', 'Delta']])
    expect(inits).toHaveLength(2)
    for (const body of inits) {
      expect(body).toContain('name="recordIds"\r\n\r\n2,4')
      expect(body).toMatch(/name="values"\r\n\r\n[^\r]*"tableName":"prcSpecimen"/)
    }
  })
})

test.describe('Completion', () => {
  test('[PRC-023] a noMoreSteps value ends a linear process early with Return @mobile', async ({ page, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'prcEarlyFinish')
    const notice = await expectScreen(page, 'notice', 'Notice')
    await expect(viewValue(notice, 'notice')).toHaveText('This process stops here by design.')
    await expect(page.getByText('Step 1 of 2')).toBeVisible()
    await expect(page.locator('[data-qqq-id="button-next"]')).toHaveCount(0)
    await expectRunTouchReady(page, 'prcEarlyFinish')
    await page.getByRole('button', { name: 'Return' }).click()
    await expect(page).toHaveURL(/\/app\/prcLab\/?$/)
  })

  test('[PRC-047] a run with no screens completes with a completion screen @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'prcQuickTask')
    const result = page.locator('[data-qqq-id="process-result-step"]')
    await expect(result.getByRole('heading', { name: 'Quick Task Complete' })).toBeVisible()
    await expect(result).toContainText('Process completed successfully.')
    await expectRunTouchReady(page, 'prcQuickTask')
    await expect(page.locator('[data-qqq-id="process-run-prcQuickTask"]')).toHaveAttribute('data-process-phase', 'complete')
    expect(await backend.sql('select name, lab_count from prc_lab_run')).toEqual([{ name: 'quick', lab_count: '1' }])
  })

  test('[PRC-023] Next becomes Submit on the step before the last screen @mobile', async ({ page, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'prcWizard')
    await expectScreen(page, 'chooseRoute', 'Choose Route')
    await expect(page.locator('[data-qqq-id="button-next"]')).toHaveText('Next')
    await choosePossibleValue(page, 'Route', 'Long route')
    await advance(page, 'Next')
    await expectScreen(page, 'longDetails', 'Long Route Details')
    await expect(page.locator('[data-qqq-id="button-next"]')).toHaveText('Submit')
  })
})
