/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, test } from '../../support/fixtures'
import { control, openForm } from './helpers'

/** The same sample server supplies v1 supplemental metadata and executes the Material adjuster route. */
test('[REC-060] table and field form adjusters update a real form; field rules clear values and a server lock disables save @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const metaResponse = await backend.api.get('/qqq/v1/metaData/table/adjusterLab')
  expect(metaResponse.status()).toBe(200)
  const table = await metaResponse.json() as {
    supplementalMetaData?: { materialDashboard?: { onLoadFormAdjuster?: unknown; fieldRules?: unknown[] } }
    fields?: { name?: { supplementalMetaData?: { materialDashboard?: { formAdjusterIdentifier?: string } } } }
  }
  expect(table.supplementalMetaData?.materialDashboard?.onLoadFormAdjuster).toBeTruthy()
  expect(table.supplementalMetaData?.materialDashboard?.fieldRules).toHaveLength(1)
  expect(table.fields?.name?.supplementalMetaData?.materialDashboard?.formAdjusterIdentifier).toBe('table:adjusterLab;field:name')

  await openForm(page, '/app/adjusterLab/create', 'Create Adjuster Lab')
  await expect(control(page, 'note')).toHaveValue('Loaded by table adjuster')
  await control(page, 'status').fill('Temporary')
  await control(page, 'name').fill('label clear')
  await control(page, 'name').blur()
  await expect(page.getByText('Adjusted note', { exact: true })).toBeVisible()
  await expect(control(page, 'note')).toHaveValue('')
  await expect(control(page, 'status')).toHaveValue('')

  // A hash-only navigation keeps the current client form mounted; start a fresh create page.
  await page.goto('/app/')
  await openForm(page, `/app/adjusterLab/create#/defaultValues=${encodeURIComponent(JSON.stringify({ name: 'Locked' }))}`, 'Create Adjuster Lab')
  await expect(page.locator('[data-qqq-id="entity-form-disabled-adjusterLab"]')).toHaveText('Locked by the server')
  await expect(page.locator('[data-qqq-id="button-save"]')).toBeDisabled()
})
