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
