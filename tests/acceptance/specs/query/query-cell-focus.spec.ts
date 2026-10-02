/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, open, test } from '../../support/fixtures'
import { expectColumn, sqlColumn } from './query-helpers'

for (const action of ['selection', 'refresh']) {
  test(`[QRY-030] body checkbox retains keyboard focus after ${action}`, async ({ page, backend, diagnostics }, testInfo) => {
    void diagnostics
    await page.setViewportSize({ width: 1280, height: 720 })
    await open(page, '/app/qryItem')
    const ids = await sqlColumn(backend, 'select id from qry_item order by id desc')
    await expectColumn(page, 'id', ids)
    const checkbox = page.locator('[data-qqq-id="grid-select-row-0"]')
    await expect(checkbox).not.toBeChecked()
    await checkbox.focus()
    await expect(checkbox).toBeFocused()
    const original = await checkbox.elementHandle()
    expect(original).not.toBeNull()
    const navigation = await page.evaluate(() => ({ url: location.href, length: history.length }))
    if (action === 'selection') {
      await page.keyboard.press('Space')
      await expect(checkbox).toBeChecked()
      await expect(page.locator('[data-qqq-id="bulk-selection-text"]')).toHaveText('1 record is selected.')
    } else {
      const query = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/qqq/v1/table/qryItem/query')
      await page.keyboard.press('r')
      const response = await query
      expect(response.status()).toBe(200)
      expect(await response.finished()).toBeNull()
      await expectColumn(page, 'id', ids)
      await expect(checkbox).not.toBeChecked()
    }
    await testInfo.attach('cell-focus-boundary', { body: JSON.stringify({
      action,
      original: await original!.evaluate(element => ({ connected: element.isConnected, focused: document.activeElement === element })),
      current: await checkbox.evaluate(element => ({ focused: document.activeElement === element, checked: (element as HTMLInputElement).checked })),
      navigationUnchanged: JSON.stringify(await page.evaluate(() => ({ url: location.href, length: history.length }))) === JSON.stringify(navigation),
    }), contentType: 'application/json' })
    expect(await page.evaluate(() => ({ url: location.href, length: history.length }))).toEqual(navigation)
    await expect(checkbox).toBeFocused()
    expect(await original!.evaluate(element => element.isConnected)).toBe(true)
  })
}
