/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, open, test } from '../../support/fixtures'
import { byId } from './widget-support'

for (const { copy, offscreen } of [{ copy: 'page', offscreen: false }, { copy: 'full query', offscreen: false }, { copy: 'full query', offscreen: true }]) {
  test(`[WID-073] report column ${copy} copy${offscreen ? ' from an offscreen trigger' : ''} preserves keyboard focus after its notice`, async ({ page, backend, diagnostics }) => {
    void diagnostics
    await page.setViewportSize({ width: 1280, height: 720 })
    expect((await backend.api.put('/data/savedReport/1', { multipart: {
      tableName: 'person', queryFilterJson: JSON.stringify({ orderBys: [{ fieldName: 'id', isAscending: true }] }),
      columnsJson: JSON.stringify({ columns: ['id', 'firstName'].map(name => ({ name, isVisible: true })) }),
    } })).status()).toBe(200)
    const people = await backend.sql('select first_name from person order by id')
    await open(page, '/app/savedReport/1')
    const preview = byId(page, 'filter-preview-reportSetupWidget')
    const cells = preview.getByRole('gridcell').and(preview.locator('[data-qqq-id="grid-cell-firstName"]'))
    await expect(cells).toHaveText(people.map(row => row.first_name!))
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async (text: string) => { document.documentElement.dataset.copiedReportValues = text },
    } }))
    const navigation = await page.evaluate(() => ({ url: location.href, length: history.length }))
    const trigger = preview.getByRole('button', { name: 'First Name column menu', exact: true })
    await trigger.scrollIntoViewIfNeeded()
    await trigger.focus()
    const triggerId = await trigger.getAttribute('id')
    if (offscreen) {
      const main = page.getByRole('main')
      const bounds = await main.boundingBox()
      expect(bounds).not.toBeNull()
      await page.mouse.move(bounds!.x + 20, bounds!.y + 20)
      await page.mouse.wheel(0, -2000)
      await expect.poll(() => main.evaluate(element => element.scrollTop)).toBe(0)
      await expect(trigger).toBeFocused()
      expect((await trigger.boundingBox())!.y).toBeGreaterThan(720)
    }
    await page.keyboard.press('Enter')
    const menu = page.getByRole('menu', { name: 'First Name column menu', exact: true })
    await expect(menu).toBeVisible()
    await page.keyboard.press('End')
    await expect(menu.getByRole('menuitem', { name: 'Copy full query values', exact: true })).toBeFocused()
    if (copy === 'page') await page.keyboard.press('ArrowUp')
    await expect(menu.getByRole('menuitem', { name: `Copy ${copy} values`, exact: true })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('html')).toHaveAttribute('data-copied-report-values', people.map(row => row.first_name!).join('\n') + '\n')
    await expect(preview.getByText(`Copied ${people.length} First Name values.`, { exact: true })).toBeVisible()
    await expect(menu).toBeHidden()
    await expect(trigger).toBeFocused()
    await expect(trigger).toHaveAttribute('id', triggerId!)
    await page.keyboard.press('Enter')
    await expect(menu).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(trigger).toBeFocused()
    await expect(cells).toHaveText(people.map(row => row.first_name!))
    expect(await page.evaluate(() => ({ url: location.href, length: history.length }))).toEqual(navigation)
  })
}
