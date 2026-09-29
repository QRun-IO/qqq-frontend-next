/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, open, test } from '../../support/fixtures'
import { expectLoaded, widget } from './widget-support'

test('[WID-074] standalone blocks preserve scalar inputs and render metadata editors @mobile', async ({ page, diagnostics }) => {
  void diagnostics
  await open(page, '/app/widgetInputEditors')
  await expectLoaded(page, 'accTypedInputs')
  const card = widget(page, 'accTypedInputs')
  await expect(card.getByLabel('Owned Text', { exact: true })).toHaveValue('Owned seeded text')
  await expect(card.getByLabel('Owned Count', { exact: true })).toHaveValue('7')
  await expect(card.getByLabel('Owned Day', { exact: true })).toHaveValue('2026-03-04')
  await expect(card.getByLabel('Owned Flag', { exact: true })).toBeChecked()
  await expect(card.getByLabel('Owned File', { exact: true })).toHaveAttribute('type', 'file')
  await card.getByLabel('Owned Amount', { exact: true }).fill('19.95')
  await expect(card.getByText('$', { exact: true })).toBeVisible()
  const choice = card.getByRole('combobox', { name: 'Owned Choice' })
  await expect(choice).toContainText('Alpha')
  const choiceBounds = await choice.boundingBox()
  const scalarBounds = await card.getByLabel('Owned Text', { exact: true }).boundingBox()
  expect(choiceBounds).not.toBeNull()
  expect(scalarBounds).not.toBeNull()
  expect(choiceBounds!.width).toBeGreaterThanOrEqual(scalarBounds!.width - 0.5)
  await choice.click()
  await page.getByRole('option', { name: 'Beta', exact: true }).click()
  await expect(choice).toContainText('Beta')
  await expect(card.getByText('JavaScript', { exact: true })).toBeVisible()
  const code = card.getByRole('textbox', { name: 'Owned Script', exact: true })
  await code.fill('const sample = 1;')
  await code.press('End')
  await code.press('Enter')
  await code.pressSequentially('// line two')
  await expect(code).toHaveValue('const sample = 1;\n// line two')
  await expect(page.getByRole('heading', { name: 'Widget Input Editors', exact: true })).toBeVisible()
})
