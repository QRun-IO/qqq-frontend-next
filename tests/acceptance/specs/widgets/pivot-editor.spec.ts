/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, open, test } from '../../support/fixtures'

test('[WID-029] pivot drafts validate, cancel, reorder and persist through host save', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const original = {
    rows: [{ key: 101, fieldName: 'lastName', showTotals: false }],
    columns: [{ key: 102, fieldName: 'isEmployed' }],
    values: [{ key: 103, fieldName: 'id', function: 'COUNT' }],
  }
  expect((await backend.api.put('/data/savedReport/1', { multipart: {
    tableName: 'person', pivotTableJson: JSON.stringify(original), usePivotTable: 'true',
    columnsJson: JSON.stringify({ columns: ['id', 'firstName', 'lastName', 'isEmployed', 'annualSalary'].map(name => ({ name, isVisible: true })) }),
  } })).status()).toBe(200)
  const stored = () => backend.sql('select pivot_table_json from saved_report where id = 1')
  const before = await stored()
  await open(page, '/app/savedReport/1/edit')
  const edit = page.getByRole('button', { name: 'Edit Pivot Table', exact: true })
  await edit.click()
  const dialog = page.getByRole('dialog', { name: 'Edit Pivot Table' })
  await dialog.getByRole('button', { name: 'Add new row', exact: true }).click()
  await dialog.getByRole('button', { name: 'OK', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Missing value in 1 field')
  await expect(dialog.getByLabel('Row 2 field', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  expect(await stored()).toEqual(before)
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(edit).toBeFocused()
  await edit.click()
  await expect(dialog.getByLabel('Row 2 field', { exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Add new row', exact: true }).click()
  const row2 = dialog.getByLabel('Row 2 field', { exact: true })
  await expect(row2.locator('option')).toHaveText(['Select a field', 'Annual Salary', 'First Name'])
  await row2.selectOption('firstName')
  await dialog.getByRole('button', { name: 'Drag to reorder row 2', exact: true }).press('ArrowUp')
  await expect(dialog.getByLabel('Row 1 field', { exact: true })).toHaveValue('firstName')
  await expect(dialog.getByRole('button', { name: 'Drag to reorder row 1', exact: true })).toBeFocused()
  await dialog.getByRole('button', { name: 'Add new value', exact: true }).click()
  await dialog.getByLabel('Value 2 field', { exact: true }).selectOption('annualSalary')
  await dialog.getByLabel('Value 2 function', { exact: true }).selectOption('SUM')
  await dialog.getByRole('button', { name: 'Move value 2 up', exact: true }).click()
  await expect(dialog.getByLabel('Value 1 field', { exact: true })).toHaveValue('annualSalary')
  await dialog.getByRole('button', { name: 'OK', exact: true }).click()
  await expect(dialog).toBeHidden()
  expect(await stored()).toEqual(before)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/savedReport\/1\/?$/)
  const saved = JSON.parse((await stored())[0].pivot_table_json!)
  expect(saved.rows.map((item: { fieldName: string }) => item.fieldName)).toEqual(['firstName', 'lastName'])
  expect(saved.rows[1]).toEqual(original.rows[0])
  expect(saved.columns).toEqual(original.columns)
  expect(saved.values.map((item: { fieldName: string; function: string }) => [item.fieldName, item.function])).toEqual([['annualSalary', 'SUM'], ['id', 'COUNT']])
  await open(page, '/app/savedReport/1/edit')
  await edit.click()
  await expect(dialog.getByLabel('Row 1 field', { exact: true })).toHaveValue('firstName')
  await expect(dialog.getByLabel('Value 1 function', { exact: true })).toHaveValue('SUM')
})

test('[WID-029] pivot field changes clear incompatible aggregates and disabling clears saved definition', async ({ page, backend, diagnostics }) => {
  void diagnostics
  expect((await backend.api.put('/data/savedReport/1', { multipart: {
    tableName: 'person', usePivotTable: 'true',
    pivotTableJson: JSON.stringify({ rows: [{ key: 2, fieldName: 'lastName' }], values: [{ key: 1, fieldName: 'annualSalary', function: 'SUM' }] }),
    columnsJson: JSON.stringify({ columns: ['firstName', 'lastName', 'annualSalary'].map(name => ({ name, isVisible: true })) }),
  } })).status()).toBe(200)
  await open(page, '/app/savedReport/1/edit')
  await page.getByRole('button', { name: 'Edit Pivot Table', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit Pivot Table' })
  await dialog.getByLabel('Value 1 field', { exact: true }).selectOption('firstName')
  const aggregate = dialog.getByLabel('Value 1 function', { exact: true })
  await expect(aggregate).toHaveValue('')
  await expect(aggregate.locator('option')).toHaveText(['Select a function', 'Count'])
  await dialog.getByRole('button', { name: 'OK', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Missing value in 1 field')
  await aggregate.selectOption('COUNT')
  await dialog.getByRole('button', { name: 'OK', exact: true }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/savedReport\/1\/?$/)
  expect(JSON.parse((await backend.sql('select pivot_table_json from saved_report where id = 1'))[0].pivot_table_json!).values[0]).toEqual({ key: 1, fieldName: 'firstName', function: 'COUNT' })
  await open(page, '/app/savedReport/1/edit')
  await page.getByRole('switch', { name: 'Use Pivot Table?', exact: true }).uncheck()
  await expect(page.getByRole('button', { name: 'Edit Pivot Table', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/savedReport\/1\/?$/)
  expect((await backend.sql('select pivot_table_json from saved_report where id = 1'))[0].pivot_table_json).toBeNull()
  await expect(page.getByText('This report does not use a pivot table.', { exact: true })).toBeVisible()
})
