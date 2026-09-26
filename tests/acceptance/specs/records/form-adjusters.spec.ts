/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, test } from '../../support/fixtures'
import { control, multipartFields, openForm, recordRequests, sqlOne } from './helpers'

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

/** A record widget contributes fields to the host form while storing one declared JSON value. */
test('[REC-061] editable dynamic form widget validates and persists a record JSON field @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const writes = recordRequests(page, '/qqq/v1/table/accWidgetHost')
  await openForm(page, '/app/accWidgetHost/1/edit', 'Edit Widget Host')
  const region = control(page, 'region')
  await expect(region).toHaveValue('North')

  await region.fill('')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Region is required')).toBeVisible()
  expect(writes.filter((request) => request.method() === 'PATCH')).toHaveLength(0)

  await region.fill('South')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Owned host one' })).toBeVisible()
  const update = writes.find((request) => request.method() === 'PATCH')
  expect(update).toBeDefined()
  const fields = multipartFields(update!)
  expect(JSON.parse(fields.inputValues)).toEqual({ region: 'South' })
  expect(fields).not.toHaveProperty('region')
  expect(JSON.parse((await sqlOne(backend, 'select input_values from acc_widget_host where id = 1')).input_values!)).toEqual({ region: 'South' })
  const apiRecord = await (await backend.api.get('/qqq/v1/table/accWidgetHost/1')).json() as { record: { values: { inputValues?: string } } }
  expect(apiRecord.record.values.inputValues).toBe('{"region":"South"}')
  const widget = await (await backend.api.post('/qqq/v1/widget/accHostRecordVariables?id=1&tableName=accWidgetHost', { data: {} })).json() as { recordOfFieldValues?: { values?: { region?: string } } }
  expect(widget.recordOfFieldValues?.values?.region).toBe('South')

  await openForm(page, '/app/accWidgetHost/1/edit', 'Edit Widget Host')
  await expect(control(page, 'region')).toHaveValue('South')
})
