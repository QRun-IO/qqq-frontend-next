/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, test } from '../../support/fixtures'
import { advance, expectScreen, openProcess, viewValue } from './process-helpers'

test('[WID-071] a WIDGET-adorned process field edits only its own value @mobile', async ({ page, diagnostics }) => {
  void diagnostics
  const widgetRequests: URL[] = []
  page.on('request', (request) => {
    if (request.url().includes('/qqq/v1/widget/reportSetupWidget')) widgetRequests.push(new URL(request.url()))
  })

  await openProcess(page, 'prcFieldWidget')
  const edit = await expectScreen(page, 'edit', 'Edit Filter')
  await edit.getByRole('textbox', { name: 'Table Name' }).fill('person')
  await expect(edit.locator('[data-qqq-id="field-widget-queryFilterJson"]')).toBeVisible()
  await expect.poll(() => widgetRequests.length).toBeGreaterThan(0)
  expect(widgetRequests[0].searchParams.get('__formFieldAsWidget_FieldName')).toBe('queryFilterJson')

  await edit.getByRole('button', { name: 'Edit Filters and Columns' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit Filters and Columns' })
  await dialog.getByLabel('Sort by', { exact: true }).selectOption('firstName')
  await dialog.getByRole('button', { name: 'OK' }).click()
  await advance(page, 'Submit')

  const review = await expectScreen(page, 'review', 'Review Filter')
  const stored = JSON.parse(await viewValue(review, 'queryFilterJson').textContent() ?? '{}') as { orderBys?: unknown[] }
  expect(stored.orderBys).toEqual([{ fieldName: 'firstName', isAscending: true }])
})


test('[PRC-062] composite metadata editors submit choices, code, filter JSON and uploaded bytes @mobile', async ({ page, diagnostics, isMobile }) => {
  void diagnostics
  await openProcess(page, 'prcBlockEditors')
  const edit = await expectScreen(page, 'edit', 'Edit Blocks')
  await expect(edit.getByLabel('Cost', { exact: true })).toHaveValue('12.50')
  await expect(edit.getByText('$', { exact: true })).toBeVisible()
  await expect(edit.getByText('JavaScript', { exact: true })).toBeVisible()
  await edit.getByRole('combobox', { name: 'Category' }).click()
  await page.getByRole('option', { name: 'Plant', exact: true }).click()
  await edit.getByLabel('Cost', { exact: true }).fill('24.75')
  const quantity = edit.getByLabel('Quantity', { exact: true })
  await expect(quantity).toHaveValue('7')
  // Touch browsers do not have a mouse wheel; mobile WebKit rejects wheel commands.
  if (!isMobile) {
    await quantity.click()
    await quantity.hover()
    await page.mouse.wheel(0, -100)
    await expect(quantity).not.toBeFocused()
    await expect(quantity).toHaveValue('7')
    await quantity.click()
    await quantity.press('ArrowUp')
  } else {
    await quantity.fill('8')
  }
  await expect(quantity).toHaveValue('8')
  const script = edit.getByRole('textbox', { name: 'Script', exact: true })
  await script.fill('const sample = 2;')
  await script.press('End')
  await script.press('Enter')
  await script.pressSequentially('// second line')
  await expect(edit).toBeVisible()
  await expect(script).toHaveValue('const sample = 2;\n// second line')

  await edit.getByRole('button', { name: 'Edit Filters and Columns' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit Filters and Columns' })
  await dialog.getByLabel('Sort by', { exact: true }).selectOption('firstName')
  await dialog.getByRole('button', { name: 'OK', exact: true }).click()
  await advance(page, 'Submit')
  await expect(edit.getByText('Attachment is required', { exact: true })).toBeVisible()
  await expect(edit.getByText('Supporting File is required', { exact: true })).toBeVisible()
  await edit.locator('input[type="file"]').nth(0).setInputFiles({ name: 'attachment.txt', mimeType: 'text/plain', buffer: Buffer.from('owned attachment bytes') })
  await edit.locator('input[type="file"]').nth(1).setInputFiles({ name: 'support.txt', mimeType: 'text/plain', buffer: Buffer.from('owned supporting bytes') })
  await advance(page, 'Submit')

  const review = await expectScreen(page, 'review', 'Review Blocks')
  await expect(viewValue(review, 'category')).toHaveText('Plant')
  await expect(viewValue(review, 'cost')).toHaveText('24.75')
  await expect(viewValue(review, 'quantity')).toHaveText('8')
  await expect(viewValue(review, 'script')).toHaveText('const sample = 2;\n// second line')
  expect(JSON.parse(await viewValue(review, 'queryFilterJson').textContent() ?? '{}').orderBys).toEqual([{ fieldName: 'firstName', isAscending: true }])
  expect(JSON.parse(await viewValue(review, 'columnsJson').textContent() ?? '{}')).toEqual({ columns: [{ name: 'id', isVisible: true }] })
  await expect(viewValue(review, 'attachmentContents')).toHaveText('owned attachment bytes')
  await expect(viewValue(review, 'adornedUploadContents')).toHaveText('owned supporting bytes')
})
