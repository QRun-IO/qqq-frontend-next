/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, open, test } from '../../support/fixtures'
import { advance, expectScreen, openProcess } from './process-helpers'

test.use({ timezoneId: 'America/New_York' })

test('[WID-075] standalone timestamp blocks show seeded instants in the viewer zone with seconds @mobile', async ({ page, diagnostics }) => {
  void diagnostics
  await open(page, '/app/widgetInputEditors')
  await expect(page.getByLabel('Owned Stamp', { exact: true })).toHaveValue('2024-03-10T01:30:07')
})

for (const edit of [false, true]) {
  test(`[PRC-064] process timestamp inputs preserve instants across daylight saving (edit=${edit}) @mobile`, async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'prcInputDateTimes')
    const form = await expectScreen(page, 'edit', 'Edit Timestamps')
    for (const label of ['Plain Timestamp', 'Shared Timestamp', 'Form Timestamp']) {
      const input = form.getByLabel(label, { exact: true })
      await expect(input).toHaveValue('2024-03-10T01:30:07')
      if (edit) await input.fill('2024-03-10T03:30:09')
    }
    for (const label of ['Plain Clock', 'Shared Clock', 'Form Clock']) {
      const input = form.getByLabel(label, { exact: true })
      await expect(input).toHaveValue('09:30:07')
      expect(await input.evaluate((node: HTMLInputElement) => node.validity.stepMismatch)).toBe(false)
      if (edit) await input.fill('14:25:43')
      expect(await input.evaluate((node: HTMLInputElement) => node.checkValidity())).toBe(true)
    }
    await expect(form.getByLabel('Repeated Hour Timestamp', { exact: true })).toHaveValue('2024-11-03T01:30:07')
    await advance(page, 'Submit')
    await expectScreen(page, 'done', 'Stored Timestamps')
    expect(await backend.sql('select action_code, scan_code from prc_decision_log order by action_code')).toEqual([
      { action_code: 'foldStamp', scan_code: '2024-11-03T06:30:07Z' },
      { action_code: 'formClock', scan_code: edit ? '14:25:43' : '09:30:07' },
      { action_code: 'formStamp', scan_code: edit ? '2024-03-10T07:30:09Z' : '2024-03-10T06:30:07Z' },
      { action_code: 'plainClock', scan_code: edit ? '14:25:43' : '09:30:07' },
      { action_code: 'plainStamp', scan_code: edit ? '2024-03-10T07:30:09Z' : '2024-03-10T06:30:07Z' },
      { action_code: 'sharedClock', scan_code: edit ? '14:25:43' : '09:30:07' },
      { action_code: 'sharedStamp', scan_code: edit ? '2024-03-10T07:30:09Z' : '2024-03-10T06:30:07Z' },
    ])
  })
}
