/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, open, test } from '../../support/fixtures'
import { showTable } from './query-helpers'

test.use({ hasTouch: true })

test('[QRY-030] pinned grid selection targets remain fully exposed at every density @mobile', async ({ page, backend, diagnostics }) => {
  void backend
  void diagnostics
  await open(page, '/app/qryItem')
  await showTable(page)
  for (const density of ['compact', 'standard', 'comfortable']) {
    await page.locator('[data-qqq-id="button-density"]').tap()
    await page.locator(`[data-qqq-id="density-option-${density}"]`).tap()
    for (const id of ['grid-select-all', 'grid-select-row-0']) {
      const checkbox = page.locator(`[data-qqq-id="${id}"]`)
      const label = checkbox.locator('..')
      const cell = checkbox.locator('xpath=ancestor::*[self::td or self::th]')
      await label.scrollIntoViewIfNeeded()
      const box = (await label.boundingBox())!
      const cellBox = (await cell.boundingBox())!
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.x).toBeGreaterThanOrEqual(cellBox.x)
      expect(box.x + box.width).toBeLessThanOrEqual(cellBox.x + cellBox.width + 1)
      const original = await checkbox.isChecked()
      // Both sides of the target must toggle selection instead of opening the pinned record.
      await page.touchscreen.tap(box.x + 2, box.y + box.height / 2)
      await expect(checkbox).toBeChecked({ checked: !original })
      const selectedBox = (await label.boundingBox())!
      await page.touchscreen.tap(selectedBox.x + selectedBox.width - 2, selectedBox.y + selectedBox.height / 2)
      await expect(checkbox).toBeChecked({ checked: original })
      await expect(page).toHaveURL(/\/app\/qryItem\/?(?:\?.*)?$/)
    }
  }
})
