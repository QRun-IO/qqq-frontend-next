/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, open, test } from '../../support/fixtures'
import { grid } from './query-helpers'

for (const mode of ['light', 'dark']) {
  test(`[QRY-001] original Next row appearance preserves selection and opaque pinned cells in ${mode} mode`, async ({ page, backend, diagnostics }) => {
    void backend
    void diagnostics
    await page.addInitScript((dark) => localStorage.setItem('qqq-dark-mode', String(dark)), mode === 'dark')
    await open(page, '/app/qryItem')
    const table = grid(page, 'Query Item')
    const rows = table.locator('tbody tr')
    await expect(rows).toHaveCount(8)
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode)
    await page.mouse.move(0, 0)
    const colors = await rows.evaluateAll((items) => items.map((row) => getComputedStyle(row).backgroundColor))
    expect(new Set(colors).size, 'Default rows retain the original uniform Next background').toBe(1)

    await page.getByRole('button', { name: 'Name column menu', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Pin to left', exact: true }).click()
    const pinned = rows.locator('td[data-qqq-id="grid-cell-name"]')
    await expect(pinned).toHaveCount(8)
    await expect(pinned.first()).toHaveCSS('position', 'sticky')
    await page.mouse.move(0, 0)
    await expect.poll(() => pinned.evaluateAll((cells) => new Set(cells.map((cell) => getComputedStyle(cell).backgroundColor)).size)).toBe(1)
    const pinnedColors = await pinned.evaluateAll((cells) => cells.map((cell) => getComputedStyle(cell).backgroundColor))
    expect(new Set(pinnedColors).size).toBe(1)
    expect(pinnedColors[0]).not.toBe('rgba(0, 0, 0, 0)')

    await rows.first().getByRole('checkbox').check()
    await page.mouse.move(0, 0)
    await expect.poll(() => rows.first().evaluate((row) => getComputedStyle(row).backgroundColor)).not.toBe(colors[0])
    await rows.first().getByRole('checkbox').uncheck()
    await page.mouse.move(0, 0)
    await expect.poll(() => rows.first().evaluate((row) => getComputedStyle(row).backgroundColor)).toBe(colors[0])
  })
}
