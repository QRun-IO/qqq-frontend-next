/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, type Page } from '@playwright/test'

/** Wait for the upstream report setup renderer before clicking a pivot control it can move. */
export async function openReadyPivotEditor(page: Page) {
  const setup = page.locator('[data-qqq-id="form-widget-reportSetupWidget"]')
  const edit = setup.getByRole('button', { name: 'Edit Filters and Columns', exact: true })
  await expect(edit).toBeVisible()
  await expect(edit).toBeEnabled()
  await expect(setup.getByRole('status', { name: 'Loading widget' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Edit Pivot Table', exact: true }).click()
}
