/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, test } from '../../support/fixtures'
import { advance, expectRunTouchReady, expectScreen, openProcess, viewValue } from './process-helpers'

test.describe('Screen formats and step flows', () => {
  test('[PRC-044] scanner-format screens show only their components and submit from the input @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'prcScanner')
    const scan = await expectScreen(page, 'scan', 'Scan')
    // the heading stays for assistive technology only
    await expect(scan.locator('.sr-only [data-qqq-id="process-step-heading"]')).toHaveCount(1)
    await expect(page.locator('[data-qqq-id="process-actions"]')).toHaveCount(0)
    await expect(scan.getByText('Scan a specimen code')).toBeVisible()
    const input = scan.getByLabel('Specimen Code')
    await expect(input).toBeFocused()
    await expectRunTouchReady(page, 'prcScanner')
    await input.fill('SPEC-42')
    await input.press('Enter')
    const scanned = await expectScreen(page, 'scanned', 'Scanned')
    await expect(viewValue(scanned, 'scanCode')).toHaveText('SPEC-42')
    await expect(scanned.locator('[data-qqq-id="process-step-heading"]')).toBeVisible()
    expect(await backend.sql('select action_code, scan_code from prc_decision_log')).toEqual([{ action_code: null, scan_code: 'SPEC-42' }])
  })

  test('[PRC-045] state-machine processes repeat screens without a linear stepper @mobile', async ({ page, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'prcLoop')
    const ask = await expectScreen(page, 'askScreen', 'Another Round?')
    await expect(page.locator('[data-qqq-id="step-wizard"]')).toHaveCount(0)
    await expect(page.getByText(/^Step \d+ of \d+$/)).toHaveCount(0)
    await ask.getByLabel('Go again').check()
    await advance(page, 'Next')
    const again = await expectScreen(page, 'askScreen', 'Another Round?')
    await expect(viewValue(again, 'rounds')).toHaveText('1')
    await expect(again.getByLabel('Go again')).toHaveAttribute('aria-checked', 'mixed')
    await expectRunTouchReady(page, 'prcLoop')
    await again.getByLabel('Go again').check()
    await advance(page, 'Next')
    const third = await expectScreen(page, 'askScreen', 'Another Round?')
    await expect(viewValue(third, 'rounds')).toHaveText('2')
    await advance(page, 'Next')
    const finish = await expectScreen(page, 'finishScreen', 'Finished Looping')
    await expect(viewValue(finish, 'rounds')).toHaveText('3')
    await expect(page.getByRole('button', { name: 'Return' })).toBeVisible()
  })
})
