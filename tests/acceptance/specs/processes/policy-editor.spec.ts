/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, test } from '../../support/fixtures'
import { advance, expectScreen, openProcess, viewValue } from './process-helpers'

const SAVED = '{"PolicySpec":"qqq-iam","PolicyVersion":"1.0.0","Statement":['
  + '{"Effect":"Allow","Action":["hasAccess"],"Resource":["content","publishPage"]},'
  + '{"Effect":"Allow","Action":["read"],"Resource":["cms_audit","cms_page"]},'
  + '{"Effect":"Allow","Action":["insert"],"Resource":["cms_page"]},'
  + '{"Effect":"Allow","Action":["edit"],"Resource":["cms_page"]},'
  + '{"Effect":"Allow","Action":["delete"],"Resource":["cms_page"]}]}'

test.describe('Policy Editor Lab', () => {
  test('[PRC-067] the policy editor edits a matrix and submits the generated document @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'prcPolicyEditor')
    const edit = await expectScreen(page, 'edit', 'Edit Policy')
    const editor = edit.locator('[data-qqq-id="policy-editor-prcPolicyEditorWidget"]')
    await expect(editor).toBeVisible()

    // the existing document opens in the matrix; a resource the app no longer has is listed
    await expect(editor.getByLabel('Read: Pages', { exact: true })).toBeChecked()
    await expect(editor.getByLabel('Edit: Pages', { exact: true })).not.toBeChecked()
    const unknown = editor.getByRole('region', { name: 'Not in this app (1)' })
    await expect(unknown).toContainText('gone_table.read')
    await unknown.getByRole('button', { name: 'Remove gone_table.read' }).click()
    await expect(editor.getByRole('region', { name: /Not in this app/ })).toHaveCount(0)

    // row, app and search
    await editor.getByLabel('All actions: Pages', { exact: true }).check()
    await editor.getByLabel('Everything in Content', { exact: true }).check()
    await editor.getByLabel('Find a resource', { exact: true }).fill('audit')
    await expect(editor.getByLabel('Read: Pages', { exact: true })).toHaveCount(0)
    await editor.getByLabel('Read: Audit Log', { exact: true }).check()
    await editor.getByLabel('Find a resource', { exact: true }).fill('')
    await expect(editor.locator('[data-qqq-id="policy-editor-count"]')).toHaveText('7 permissions selected')

    // the live preview is the canonical document
    const preview = editor.getByLabel('Policy document JSON', { exact: true })
    await expect(preview).toContainText('"Resource": [\n        "cms_audit",\n        "cms_page"\n      ]')
    await expect(editor.locator('[data-qqq-id="policy-editor-valid"]')).toHaveText('5 statements; checked')

    // readable at this width: no horizontal page scroll
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)

    await edit.getByLabel('Reason').fill('editors manage pages')
    await advance(page, 'Submit')
    const done = await expectScreen(page, 'done', 'Saved Policy')
    await expect(viewValue(done, 'policyDocument')).toContainText('"PolicySpec":"qqq-iam"')
    expect(await backend.sql('select reason, document from prc_policy_log')).toEqual([{ reason: 'editors manage pages', document: SAVED }])
  })

  test('[PRC-067] clearing the matrix submits an empty document @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openProcess(page, 'prcPolicyEditor')
    const edit = await expectScreen(page, 'edit', 'Edit Policy')
    await edit.getByRole('button', { name: 'Clear all' }).click()
    await expect(edit.locator('[data-qqq-id="policy-editor-count"]')).toHaveText('0 permissions selected')
    await edit.getByLabel('Reason').fill('nothing')
    await advance(page, 'Submit')
    await expectScreen(page, 'done', 'Saved Policy')
    expect(await backend.sql('select document from prc_policy_log')).toEqual([{ document: '{"PolicySpec":"qqq-iam","PolicyVersion":"1.0.0","Statement":[]}' }])
  })
})
