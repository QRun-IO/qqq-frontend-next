/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import AxeBuilder from '@axe-core/playwright'
import { expect, open, test } from '../../support/fixtures'
import { VIEWER, sqlOne, toasts } from './helpers'

test.use(VIEWER)

for (const mode of ['light', 'dark'] as const) {
  test(`[REC-054] script suggestions preserve editing, undo and saved revision contents in ${mode} mode @mobile`, async ({ page, backend, diagnostics }, testInfo) => {
    void diagnostics
    await page.addInitScript(dark => localStorage.setItem('qqq-dark-mode', String(dark)), mode === 'dark')
    await open(page, '/app/scriptLab/1/dev')
    await page.locator('[data-qqq-id="button-edit-script-greetingScriptId"]').click()
    const dialog = page.locator('[data-qqq-id="dialog-script-editor-greetingScriptId"]')
    const editor = dialog.getByLabel('Script.js', { exact: true })
    // Start from loaded code: native WebKit groups consecutive edits in one undo transaction.
    const original = "return 'Hello, ' + input.name + '!';"
    const completed = "api.query( 'Hello, ' + input.name + '!';"
    await expect(editor).toHaveValue(original)
    await editor.focus()
    await editor.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(0, 0))
    await editor.press('Control+Space')
    await dialog.getByRole('option', { name: /api.query/ }).click()
    await expect(editor).toHaveValue(completed)
    await editor.press('ControlOrMeta+z')
    await expect(editor).toHaveValue(original)
    await editor.press('ControlOrMeta+Shift+z')
    await expect(editor).toHaveValue(completed)

    await editor.fill('const result = api.qu')
    await editor.press('Control+Space')
    await expect(dialog.getByRole('option', { name: /api.query/ })).toBeVisible()
    await editor.press('Enter')
    await expect(editor).toHaveValue('const result = api.query(')

    await editor.fill('const result = api.query("person");')
    await editor.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(21, 21))
    await editor.press('Control+Space')
    await dialog.getByRole('option', { name: /api.query/ }).click()
    await expect(editor).toHaveValue('const result = api.query("person");')
    expect(await editor.evaluate((element: HTMLTextAreaElement) => element.selectionStart)).toBe(25)
    await expect(editor).toBeFocused()

    await editor.fill('api.bu')
    await editor.press('Control+Space')
    const suggestions = dialog.getByRole('listbox', { name: 'Code suggestions' })
    await expect(suggestions.getByRole('option')).toHaveCount(3)
    const popup = (await suggestions.boundingBox())!
    const input = (await editor.boundingBox())!
    const viewport = page.viewportSize()!
    expect(popup.x).toBeGreaterThanOrEqual(input.x)
    expect(popup.y).toBeGreaterThanOrEqual(input.y)
    expect(popup.x + popup.width).toBeLessThanOrEqual(Math.min(input.x + input.width, viewport.width) + 1)
    expect(popup.y + popup.height).toBeLessThanOrEqual(Math.min(input.y + input.height, viewport.height) + 1)
    const accessibility = await new AxeBuilder({ page }).include('[data-qqq-id="dialog-script-editor-greetingScriptId"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(accessibility.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }))).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`script-suggestions-${mode}.png`), fullPage: true })
    await editor.press('ArrowDown')
    await editor.press('Tab')
    await expect(editor).toHaveValue('api.bulkUpdate(')
    await editor.fill('logger.')
    await editor.press('Control+Space')
    const log = dialog.getByRole('option', { name: /logger.log/ })
    if (testInfo.project.use.hasTouch) await log.tap()
    else await log.click()
    await expect(editor).toHaveValue('logger.log(')

    await editor.fill('retu')
    await editor.press('Control+Space')
    await editor.press('Enter')
    await editor.pressSequentially(" 'Hello, ' + input.name + '!';")
    const code = "return 'Hello, ' + input.name + '!';"
    await expect(editor).toHaveValue(code)
    await editor.press('Escape')
    await editor.press('Tab')
    await expect(editor).not.toBeFocused()
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Commit message').fill('Autocomplete acceptance')
    await dialog.getByRole('combobox', { name: 'API Name', exact: true }).selectOption('acceptanceApi')
    await dialog.getByRole('combobox', { name: 'API Version', exact: true }).selectOption('2026.Q3')
    await page.locator('[data-qqq-id="button-save-script-greetingScriptId"]').click()
    await expect(toasts(page).filter({ hasText: 'Saved New Script Version' })).toBeVisible()
    const revision = await sqlOne(backend, 'select id, sequence_no, commit_message from script_revision where script_id = 101 order by sequence_no desc limit 1')
    expect(revision.sequence_no).toBe('3')
    expect(revision.commit_message).toBe('Autocomplete acceptance')
    const file = await sqlOne(backend, `select contents from script_revision_file where script_revision_id = ${revision.id}`)
    expect(file.contents).toBe(code)
    expect((await sqlOne(backend, 'select current_script_revision_id from script where id = 101')).current_script_revision_id).toBe(revision.id)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-qqq-id="script-code-greetingScriptId-Script.js"]')).toHaveText(code)
  })
}
