/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, open, test } from '../../support/fixtures'
import { byId } from './widget-support'

for (const height of [320, 720]) {
  test(`[WID-073] report column actions stay reachable in a ${height}px-high window`, async ({ page, backend, diagnostics }, testInfo) => {
    void diagnostics
    await page.setViewportSize({ width: 1280, height })
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
    const trigger = preview.getByRole('button', { name: 'First Name column menu', exact: true })
    await trigger.press('Enter')
    const menu = page.getByRole('menu', { name: 'First Name column menu', exact: true })
    await expect.poll(async () => {
      const bounds = await menu.boundingBox()
      return Boolean(bounds && bounds.y >= 8 && bounds.y + bounds.height <= height - 8)
    }).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('column-menu.png'), animations: 'disabled' })
    // End reaches the last action through the menu's own scrolling; Escape restores focus.
    await page.keyboard.press('End')
    await expect(menu.getByRole('menuitem', { name: 'Copy full query values', exact: true })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(trigger).toBeFocused()
    await trigger.press('Enter')
    await menu.getByRole('menuitem', { name: 'Copy full query values', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-copied-report-values', people.map(row => row.first_name!).join('\n') + '\n')
    await expect(menu).toBeHidden()
    await trigger.press('Enter')
    await menu.getByRole('menuitem', { name: 'Sort descending', exact: true }).click()
    const sorted = await backend.sql('select first_name from person order by first_name desc')
    await expect(cells).toHaveText(sorted.map(row => row.first_name!))
  })
}

// Focus can remain on a column header after the user scrolls its container away.
// Opening with the keyboard must bring the reference back before positioning the menu.
test('[WID-073] a focused report column scrolled out of view still opens a reachable menu', async ({ page, backend, diagnostics }, testInfo) => {
  void diagnostics
  await page.setViewportSize({ width: 1280, height: 720 })
  expect((await backend.api.put('/data/savedReport/1', { multipart: {
    tableName: 'person', queryFilterJson: JSON.stringify({ orderBys: [{ fieldName: 'id', isAscending: true }] }),
    columnsJson: JSON.stringify({ columns: ['id', 'firstName'].map(name => ({ name, isVisible: true })) }),
  } })).status()).toBe(200)
  const people = await backend.sql('select first_name from person order by id')
  await open(page, '/app/savedReport/1')
  const preview = byId(page, 'filter-preview-reportSetupWidget')
  await expect(preview.getByRole('gridcell').and(preview.locator('[data-qqq-id="grid-cell-firstName"]'))).toHaveText(people.map(row => row.first_name!))
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    writeText: async (text: string) => { document.documentElement.dataset.copiedReportValues = text },
  } }))
  const trigger = preview.getByRole('button', { name: 'First Name column menu', exact: true })
  const main = byId(page, 'main-content')
  const menu = page.getByRole('menu', { name: 'First Name column menu', exact: true })
  const navigation = await page.evaluate(() => ({ url: location.href, length: history.length }))
  await trigger.scrollIntoViewIfNeeded()
  await trigger.focus()
  await expect(trigger).toBeInViewport()
  const visibleScroll = await main.evaluate(element => element.scrollTop)
  await page.keyboard.press('Enter')
  await expect(menu).toBeVisible()
  expect(await main.evaluate(element => element.scrollTop)).toBe(visibleScroll)
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(trigger).toBeFocused()

  // A wheel gesture changes scroll without refocusing the offscreen trigger.
  const mainBounds = await main.boundingBox()
  expect(mainBounds).not.toBeNull()
  await page.mouse.move(mainBounds!.x + 20, mainBounds!.y + 20)
  await page.mouse.wheel(0, -2000)
  await expect.poll(() => main.evaluate(element => element.scrollTop)).toBe(0)
  await expect(trigger).toBeFocused()
  expect((await trigger.boundingBox())!.y).toBeGreaterThan(720)
  await page.keyboard.press('Enter')
  await expect(menu).toBeVisible()
  try {
    await expect.poll(async () => {
      const bounds = await menu.boundingBox()
      return Boolean(bounds && bounds.y >= 8 && bounds.y + bounds.height <= 712)
    }).toBe(true)
  } finally {
    await testInfo.attach('scrolled-column-menu-bounds', { body: JSON.stringify({
      trigger: await trigger.boundingBox(), menu: await menu.boundingBox(),
      scrollTop: await main.evaluate(element => element.scrollTop),
    }), contentType: 'application/json' })
  }
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(trigger).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(menu).toBeVisible()
  await menu.getByRole('menuitem', { name: 'Copy full query values', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-copied-report-values', people.map(row => row.first_name!).join('\n') + '\n')
  await expect(menu).toBeHidden()
  expect(await page.evaluate(() => ({ url: location.href, length: history.length }))).toEqual(navigation)
})
