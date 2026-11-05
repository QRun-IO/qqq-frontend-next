/*
 * Copyright 2026 QRun.IO, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { setupApiMocks } from './api-mocks'

const order = {
  name: 'order', label: 'Order collection',
  components: [{ type: 'RECORD_LIST', values: { orderFieldName: 'orderedItemIds', identityFieldName: 'id' } }],
  recordListFields: [{ name: 'fileName', label: 'File', type: 'STRING', isEditable: false, isRequired: false, isHidden: false, isHeavy: false, adornments: [] }],
}
const done = { name: 'done', label: 'Saved', components: [{ type: 'VIEW_FORM' }], viewFields: [] }

test('orders named files with keyboard controls and submits exact identities without an ID editor', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await setupApiMocks(page)
  await page.route('**/qqq/v1/metaData/process/importData**', (route) => route.fulfill({ json: {
    name: 'importData', label: 'Order collection', tableName: '', isHidden: false, hasPermission: true,
    stepFlow: 'LINEAR', minInputRecords: 0, frontendSteps: [order, done],
  } }))
  await page.route('**/qqq/v1/processes/importData/init**', (route) => route.fulfill({ json: { processUUID: 'order-run', nextStep: 'order', frontendStep: order, values: {} } }))
  await page.route('**/qqq/v1/processes/importData/order-run/records**', (route) => route.fulfill({ json: {
    totalRecords: 2, records: [
      { tableName: 'items', values: { id: 101, fileName: 'Front photo.jpg' } },
      { tableName: 'items', values: { id: 202, fileName: 'Bill of lading.pdf' } },
    ],
  } }))
  let submission = ''
  await page.route('**/qqq/v1/processes/importData/order-run/step/**', (route) => {
    submission = route.request().postData() ?? ''
    return route.fulfill({ json: { processUUID: 'order-run', nextStep: 'done', frontendStep: done, values: {} } })
  })
  await page.goto('/app/importData')
  const control = page.locator('[data-qqq-id="record-order"]')
  await expect(control).toBeVisible()
  await expect(control.getByRole('button', { name: 'Move Front photo.jpg up' })).toBeDisabled()
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await control.getByRole('button', { name: 'Move Front photo.jpg down' }).focus()
  await page.keyboard.press('Enter')
  await expect(control.getByRole('listitem').first()).toContainText('Bill of lading.pdf')
  await expect(control.getByRole('status')).toContainText('Moved to position 2 of 2')
  const audit = await new AxeBuilder({ page }).include('[data-qqq-id="record-order"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(audit.violations).toEqual([])
  await page.screenshot({ path: 'test-results/record-order-keyboard.png', fullPage: true })
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  await expect.poll(() => submission).toContain('"orderedItemIds":"202,101"')
  expect(errors).toEqual([])
})
