/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, open, test } from '../../support/fixtures'
import { byId, expectLoaded } from './widget-support'

for (const omitted of [false, true]) {
  test(`[WID-073] report preview preserves saved joined data while ${omitted ? 'omitting' : 'offering'} joined field choices`, async ({ page, backend, diagnostics }) => {
    void diagnostics
    const columns = ['id', 'name', 'person.firstName', 'code']
    expect((await backend.api.put('/data/savedReport/1', { multipart: {
      tableName: 'qryItem',
      queryFilterJson: JSON.stringify({ criteria: [{ fieldName: 'person.firstName', operator: 'EQUALS', values: ['Blair'] }], orderBys: [{ fieldName: 'id', isAscending: true }] }),
      columnsJson: JSON.stringify({ columns: columns.map(name => ({ name, isVisible: true })) }),
    } })).status()).toBe(200)
    const before = await backend.sql('select query_filter_json, columns_json from saved_report where id = 1')
    // Override only the widget configuration. Metadata, queries, counts and records use the real backend.
    if (omitted) await page.route('**/qqq/v1/widget/reportSetupWidget*', async route => {
      const response = await route.fetch()
      await route.fulfill({ response, json: { ...await response.json(), omitExposedJoins: ['person'] } })
    })
    await open(page, '/app/savedReport/1')
    await expectLoaded(page, 'reportSetupWidget')
    const preview = byId(page, 'filter-preview-reportSetupWidget')
    const cells = (field: string) => preview.getByRole('gridcell').and(preview.locator(`[data-qqq-id="grid-cell-${field}"]`))
    const expected = await backend.sql("select i.name, p.first_name from qry_item i join person p on p.id = i.owner_id where p.first_name = 'Blair' order by i.id")
    expect(expected.length).toBeGreaterThan(0)
    await expect(cells('name')).toHaveText(expected.map(row => row.name!))
    await expect(cells('person.firstName')).toHaveText(expected.map(row => row.first_name!))
    await preview.getByRole('button', { name: 'Configure preview columns' }).click()
    const choices = preview.getByRole('group', { name: 'Configure columns', exact: true })
    await expect(choices.getByRole('button', { name: 'Hide column Person: First Name', exact: true })).toHaveCount(omitted ? 0 : 1)
    if (omitted) {
      await choices.getByRole('button', { name: 'Drag to reorder Code', exact: true }).press('ArrowUp')
      await expect.poll(() => preview.locator('[data-qqq-id^="grid-header-"]').evaluateAll(headers => headers.map(header => header.getAttribute('data-qqq-id')))).toEqual(['grid-header-id', 'grid-header-code', 'grid-header-person.firstName', 'grid-header-name'])
    }
    await preview.getByRole('button', { name: 'Configure preview columns' }).click()
    await preview.getByRole('button', { name: 'Name column menu', exact: true }).press('Enter')
    await page.getByRole('menuitem', { name: 'Filter', exact: true }).click()
    await expect(preview.getByRole('textbox', { name: 'Filter value for Person: First Name', exact: true })).toHaveValue('Blair')
    const newField = preview.getByLabel('Filter field', { exact: true }).nth(1)
    await expect(newField.locator('option[value="person.firstName"]')).toHaveCount(omitted ? 0 : 1)
    // Remove the temporary base-field condition, then exercise the preserved joined criterion.
    await preview.getByRole('button', { name: 'Remove filter condition 2', exact: true }).click()
    await preview.getByRole('textbox', { name: 'Filter value for Person: First Name', exact: true }).fill('Avery')
    const changed = await backend.sql("select i.name, p.first_name from qry_item i join person p on p.id = i.owner_id where p.first_name = 'Avery' order by i.id")
    expect(changed.length).toBeGreaterThan(0)
    await expect(cells('name')).toHaveText(changed.map(row => row.name!))
    await expect(cells('person.firstName')).toHaveText(changed.map(row => row.first_name!))
    expect(await backend.sql('select query_filter_json, columns_json from saved_report where id = 1')).toEqual(before)
    await page.reload()
    await expect(cells('name')).toHaveText(expected.map(row => row.name!))
    await expect(cells('person.firstName')).toHaveText(expected.map(row => row.first_name!))
  })
}
