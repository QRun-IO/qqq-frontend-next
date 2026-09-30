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
    await input.fill('  SPEC-42  ')
    await input.press('Enter')
    const scanned = await expectScreen(page, 'scanned', 'Scanned')
    await expect(viewValue(scanned, 'scanCode')).toHaveText('SPEC-42')
    await expect(scanned.locator('[data-qqq-id="process-step-heading"]')).toBeVisible()
    expect(await backend.sql('select action_code, scan_code from prc_decision_log')).toEqual([{ action_code: null, scan_code: 'SPEC-42' }])
  })

  test('[PRC-063] later input blocks retain configured focus and validate trimmed Enter values @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'prcInputFocus')
    await expectScreen(page, 'intro', 'Start')
    await advance(page)
    const plain = await expectScreen(page, 'plain', 'Plain Input')
    const code = plain.getByLabel('Plain Code')
    await expect(code).toBeFocused()
    await expect(code).toHaveAttribute('placeholder', 'Scan plain code')
    await code.press('Tab')
    await expect(plain.getByRole('alert')).toHaveCount(0)
    await code.fill('   ')
    await code.press('Enter')
    await expect(code).toHaveAttribute('aria-invalid', 'true')
    await expect(plain).toBeVisible()
    await code.fill('  PLAIN-1  ')
    await code.press('Enter')
    const formatted = await expectScreen(page, 'formatted', 'Formatted Input')
    const nextCode = formatted.getByLabel('Formatted Code')
    await expect(nextCode).toBeFocused()
    await expect(nextCode).toHaveAttribute('placeholder', 'Scan formatted code')
    await expect(nextCode).toHaveValue('PLAIN-1')
    await nextCode.fill('   ')
    await nextCode.press('Enter')
    await expect(nextCode).toHaveAttribute('aria-invalid', 'true')
    await expect(formatted).toBeVisible()
    await nextCode.fill('  SPEC-42  ')
    await nextCode.press('Enter')
    const done = await expectScreen(page, 'done', 'Done')
    await expect(done.locator('[data-qqq-id="process-step-heading"]')).toBeFocused()
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

for (const submission of ['Enter', 'Submit'] as const) {
  test(`[PRC-066] backend case behaviors persist block edits through ${submission} @mobile`, async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'prcInputCase')
    const edit = await expectScreen(page, 'edit', 'Edit Codes')
    for (const [label, expected] of [['Upper Code', 'ABXD'], ['Lower Code', 'abxd']]) {
      const input = edit.getByRole('textbox', { name: label, exact: true })
      await expect(input).toHaveValue('abCd')
      await input.focus()
      await input.evaluate((node: HTMLInputElement) => node.setSelectionRange(2, 3))
      await input.pressSequentially('X')
      await expect(input).toHaveValue(expected)
      expect(await input.evaluate((node: HTMLInputElement) => [node.selectionStart, node.selectionEnd])).toEqual([3, 3])
    }
    expect(await backend.sql('select action_code, scan_code from prc_decision_log')).toEqual([])
    if (submission === 'Enter') await edit.getByRole('textbox', { name: 'Lower Code', exact: true }).press('Enter')
    else await advance(page, 'Submit')
    const done = await expectScreen(page, 'done', 'Stored Codes')
    await expect(viewValue(done, 'upperCode')).toHaveText('ABXD')
    await expect(viewValue(done, 'lowerCode')).toHaveText('abxd')
    expect(await backend.sql('select action_code, scan_code from prc_decision_log order by action_code')).toEqual([
      { action_code: 'lowerCode', scan_code: 'abxd' },
      { action_code: 'upperCode', scan_code: 'ABXD' },
    ])
  })
}

test('[PRC-066] multiline case behaviors preserve newlines and persist transformed process values @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await openProcess(page, 'prcTextCase')
  const edit = await expectScreen(page, 'edit', 'Edit Codes')
  for (const [label, expected] of [['Upper Code', 'ABX\nED'], ['Lower Code', 'abx\ned']]) {
    const input = edit.getByRole('textbox', { name: label, exact: true })
    await expect(input).toHaveValue('abCd')
    await input.focus()
    await input.evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(2, 3))
    await input.pressSequentially('X')
    expect(await input.evaluate((node: HTMLTextAreaElement) => [node.selectionStart, node.selectionEnd])).toEqual([3, 3])
    await input.press('Enter')
    await input.pressSequentially('E')
    await expect(input).toHaveValue(expected)
  }
  await expect(edit).toBeVisible()
  expect(await backend.sql('select action_code, scan_code from prc_decision_log')).toEqual([])
  await advance(page, 'Submit')
  await expectScreen(page, 'done', 'Stored Codes')
  expect(await backend.sql('select action_code, scan_code from prc_decision_log order by action_code')).toEqual([
    { action_code: 'lowerCode', scan_code: 'abx\ned' },
    { action_code: 'upperCode', scan_code: 'ABX\nED' },
  ])
})

for (const process of ['prcInputCase', 'prcTextCase']) {
  test(`[PRC-066] Unicode case expansion preserves continued typing and persisted values in ${process} @mobile`, async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openProcess(page, process)
    const edit = await expectScreen(page, 'edit', 'Edit Codes')
    for (const [label, inserted, expanded, continued] of [
      ['Upper Code', 'ß', 'ASSCD', 'ASSXCD'],
      ['Lower Code', 'İ', 'ai\u0307cd', 'ai\u0307xcd'],
    ]) {
      const input = edit.getByRole('textbox', { name: label, exact: true })
      await input.fill('abcd')
      await input.focus()
      await input.evaluate((node: HTMLInputElement | HTMLTextAreaElement) => node.setSelectionRange(1, 2))
      await page.keyboard.insertText(inserted)
      await expect(input).toHaveValue(expanded)
      expect(await input.evaluate((node: HTMLInputElement | HTMLTextAreaElement) => [node.selectionStart, node.selectionEnd])).toEqual([3, 3])
      await input.pressSequentially('X')
      await expect(input).toHaveValue(continued)
      expect(await input.evaluate((node: HTMLInputElement | HTMLTextAreaElement) => [node.selectionStart, node.selectionEnd])).toEqual([4, 4])
    }
    await advance(page, 'Submit')
    const done = await expectScreen(page, 'done', 'Stored Codes')
    await expect(viewValue(done, 'upperCode')).toHaveText('ASSXCD')
    await expect(viewValue(done, 'lowerCode')).toHaveText('ai\u0307xcd')
    expect(await backend.sql('select action_code, scan_code from prc_decision_log order by action_code')).toEqual([
      { action_code: 'lowerCode', scan_code: 'ai\u0307xcd' },
      { action_code: 'upperCode', scan_code: 'ASSXCD' },
    ])
  })
}
