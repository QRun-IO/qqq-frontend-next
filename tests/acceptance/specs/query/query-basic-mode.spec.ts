/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Basic/Advanced mode over real QQQ metadata and SQL-backed records.
import { expect, open, test } from '../../support/fixtures'
import { expectWithinViewport } from '../../support/touch'
import { addCondition, captureQueries, closeFilterSheet, expectColumn, filterUrl, openFilter, showBasicFilters, showTable, sqlColumn } from './query-helpers'

test('[QRY-080] Basic mode offers metadata quick filters and queries the selected value @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/person')
  await showTable(page)
  await showBasicFilters(page)
  await expect(page.getByRole('button', { name: 'Basic', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const chip = page.locator('[data-qqq-id="quick-filter-firstName"]')
  await expect(chip).toBeVisible()
  await chip.click()
  await page.getByRole('textbox', { name: 'Filter value for First Name' }).fill('Avery')
  await page.getByRole('button', { name: 'Apply quick filter' }).click()
  await expectColumn(page, 'firstName', await sqlColumn(backend, "select first_name from person where first_name = 'Avery' order by id desc"))
  await expect(chip).toContainText('Avery')
})

test('[QRY-081] Add quick filter offers a metadata field and remembers it across reload @mobile', async ({ page, diagnostics }) => {
  void diagnostics
  await open(page, '/app/person')
  await showBasicFilters(page)
  const picker = page.getByRole('combobox', { name: 'Add quick filter' })
  const option = picker.locator('option:not([value=""])').first()
  const fieldName = await option.getAttribute('value')
  expect(fieldName).toBeTruthy()
  await picker.selectOption(fieldName!)
  const chip = page.locator(`[data-qqq-id="quick-filter-${fieldName}"]`)
  await expect(chip).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.reload()
  await showBasicFilters(page)
  await expect(chip).toBeVisible()
  await expect(page.getByRole('button', { name: 'Basic', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('[QRY-081] a joined quick filter queries its exposed field @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  await showTable(page)
  await showBasicFilters(page)
  await page.getByRole('combobox', { name: 'Add quick filter' }).selectOption('person.firstName')
  const chip = page.locator('[data-qqq-id="quick-filter-person.firstName"]')
  await expect(chip).toContainText('Person: First Name')
  await page.getByRole('textbox', { name: 'Filter value for Person: First Name' }).fill('Blair')
  await page.getByRole('button', { name: 'Apply quick filter' }).click()
  await expectColumn(page, 'name', await sqlColumn(backend,
    "select i.name from qry_item i join person p on p.id = i.owner_id where p.first_name = 'Blair' order by i.id desc"))
})

test('[QRY-081] a virtual quick filter queries its field function @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryCaseItem')
  await showTable(page)
  await showBasicFilters(page)
  await page.getByRole('combobox', { name: 'Add quick filter' }).selectOption('codeLength')
  await expect(page.locator('[data-qqq-id="quick-filter-codeLength"]')).toContainText('Code Length')
  await page.getByRole('spinbutton', { name: 'Filter value for Code Length' }).fill('4')
  await page.getByRole('button', { name: 'Apply quick filter' }).click()
  await expectColumn(page, 'code', await sqlColumn(backend,
    'select code from qry_case_item where length(code) = 4 order by id desc'))
})

test('[QRY-080] quick filter operators start from field-type defaults @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  await showTable(page)
  await showBasicFilters(page)
  const picker = page.getByRole('combobox', { name: 'Add quick filter' })
  await picker.selectOption('isActive')
  const booleanEditor = page.getByRole('group', { name: 'Is Active quick filter' })
  const booleanOperator = booleanEditor.getByRole('combobox', { name: 'Operator for Is Active' })
  await expect(booleanOperator).toHaveValue('')
  await expect(booleanEditor.getByRole('button', { name: 'Apply quick filter' })).toBeDisabled()
  await booleanOperator.selectOption({ label: 'equals yes' })
  await booleanEditor.getByRole('button', { name: 'Apply quick filter' }).click()
  await expectColumn(page, 'name', await sqlColumn(backend,
    'select name from qry_item where is_active = true order by id desc'))
  await page.getByRole('button', { name: 'Remove Is Active quick filter' }).click()

  await picker.selectOption('ownerId')
  const pvsEditor = page.getByRole('group', { name: 'Owner quick filter' })
  await expect(pvsEditor.getByRole('combobox', { name: 'Operator for Owner' }).locator('option:checked')).toHaveText('is any of')
  await pvsEditor.getByRole('button', { name: 'Cancel' }).click()

  await picker.selectOption('checkedAt')
  const dateTimeEditor = page.getByRole('group', { name: 'Checked At quick filter' })
  await expect(dateTimeEditor.getByRole('combobox', { name: 'Operator for Checked At' }).locator('option:checked')).toHaveText('is after')
})

test('[QRY-080] a quick-filter chip summarizes multiple values while retaining the full query @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  await showTable(page)
  await showBasicFilters(page)
  const chip = page.locator('[data-qqq-id="quick-filter-name"]')
  await chip.click()
  const editor = page.getByRole('group', { name: 'Name quick filter' })
  await editor.getByRole('combobox', { name: 'Operator for Name' }).selectOption({ label: 'is any of' })
  const values = editor.getByRole('textbox', { name: 'Filter values for Name' })
  await values.fill('Alpha Widget,Beta Gadget,Gamma Widget')
  await values.press('Enter')
  await editor.getByRole('button', { name: 'Apply quick filter' }).click()
  await expect(chip).toContainText('Alpha Widget +2')
  await expectColumn(page, 'name', await sqlColumn(backend,
    "select name from qry_item where name in ('Alpha Widget', 'Beta Gadget', 'Gamma Widget') order by id desc"))
})

test('[QRY-082] URL criteria become quick filters and OR links open Advanced mode @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, filterUrl('qryItem', { criteria: [{ fieldName: 'quantity', operator: 'EQUALS', values: [10] }] }))
  await showTable(page)
  await showBasicFilters(page)
  await expect(page.getByRole('button', { name: 'Basic', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-qqq-id="quick-filter-quantity"]')).toBeVisible()
  await expectColumn(page, 'name', await sqlColumn(backend,
    'select name from qry_item where quantity = 10 order by id desc'))

  await open(page, filterUrl('qryItem', { booleanOperator: 'OR', criteria: [
    { fieldName: 'quantity', operator: 'EQUALS', values: [10] },
    { fieldName: 'code', operator: 'EQUALS', values: ['BG-2'] },
  ] }))
  await showBasicFilters(page)
  await expect(page.getByRole('button', { name: 'Advanced', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const basic = page.getByRole('button', { name: 'Basic', exact: true })
  await expect(basic).toHaveAttribute('aria-disabled', 'true')
  await basic.focus()
  await expect(page.getByRole('tooltip')).toContainText("uses the 'OR' operator")
  await expectColumn(page, 'name', await sqlColumn(backend,
    "select name from qry_item where quantity = 10 or code = 'BG-2' order by id desc"))
})

test('[QRY-080] a saved view restores Basic mode and its added quick filter @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  await showTable(page)
  await showBasicFilters(page)
  const picker = page.getByRole('combobox', { name: 'Add quick filter' })
  await picker.selectOption('quantity')
  const chip = page.locator('[data-qqq-id="quick-filter-quantity"]')
  await page.getByRole('spinbutton', { name: 'Filter value for Quantity' }).fill('10')
  await page.getByRole('button', { name: 'Apply quick filter' }).click()
  await expectColumn(page, 'name', await sqlColumn(backend,
    'select name from qry_item where quantity = 10 order by id desc'))
  await closeFilterSheet(page)
  await page.getByRole('button', { name: 'Save View As...' }).click()
  const dialog = page.getByRole('dialog', { name: 'Save View As' })
  await dialog.getByLabel('Enter a name for this view').fill('Basic Quantity View')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('[data-qqq-id="button-saved-views"]')).toContainText('Basic Quantity View')
  const rows = await backend.sql("select id, view_json from saved_view where label = 'Basic Quantity View'")
  expect(rows).toHaveLength(1)
  const stored = JSON.parse(String(rows[0].view_json))
  expect(stored.mode).toBe('basic')
  expect(stored.quickFilterFieldNames).toContain('quantity')
  expect(stored.queryFilter.criteria).toEqual(expect.arrayContaining([
    expect.objectContaining({ fieldName: 'quantity', operator: 'EQUALS', values: ['10'] }),
  ]))
  await expect(page).toHaveURL(new RegExp(`/app/qryItem/savedView/${rows[0].id}/?`))
  await page.reload()
  await showBasicFilters(page)
  await expect(page.getByRole('button', { name: 'Basic', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(chip).toContainText('10')
  await expectColumn(page, 'name', await sqlColumn(backend,
    'select name from qry_item where quantity = 10 order by id desc'))
  await expect(page.locator('[data-qqq-id="saved-view-unsaved"]')).toHaveCount(0)
})

test('[QRY-082] Basic mode explains filters with repeated conditions @mobile', async ({ page, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  await openFilter(page)
  await addCondition(page, 'Name', 'equals')
  await addCondition(page, 'Name', 'equals')
  await closeFilterSheet(page)
  await showBasicFilters(page)
  const basic = page.getByRole('button', { name: 'Basic', exact: true })
  await expect(basic).toHaveAttribute('aria-disabled', 'true')
  await basic.focus()
  await expect(page.getByRole('tooltip')).toContainText('more than 1 condition')
  await expect(page.getByRole('button', { name: 'Advanced', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('[QRY-083] Advanced preview removes its condition without clearing the query @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  await showTable(page)
  await openFilter(page)
  const row = await addCondition(page, 'Name', 'contains')
  await row.getByRole('textbox', { name: 'Filter value for Name' }).fill('a')
  await closeFilterSheet(page)
  await expectColumn(page, 'name', await sqlColumn(backend, "select name from qry_item where name like '%a%' order by id desc"))
  await showBasicFilters(page)
  await page.getByRole('button', { name: 'Remove Name contains a' }).click()
  await expectColumn(page, 'name', await sqlColumn(backend, 'select name from qry_item order by id desc'))
})

test('[QRY-084] Sort picker and confirmed clear keep the selected sort @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  await showTable(page)
  await openFilter(page)
  const row = await addCondition(page, 'Name', 'contains')
  await row.getByRole('textbox', { name: 'Filter value for Name' }).fill('a')
  await closeFilterSheet(page)
  await showBasicFilters(page)
  await page.getByRole('combobox', { name: 'Sort field' }).selectOption('name')
  await page.getByRole('button', { name: 'Sort ascending' }).click()
  await expectColumn(page, 'name', await sqlColumn(backend, "select name from qry_item where name like '%a%' order by name asc"))
  await page.getByRole('button', { name: 'Clear all filters' }).click()
  const confirmation = page.getByRole('alertdialog', { name: 'Clear all filters?' })
  await confirmation.getByRole('button', { name: 'Cancel' }).click()
  await expectColumn(page, 'name', await sqlColumn(backend, "select name from qry_item where name like '%a%' order by name asc"))
  await page.getByRole('button', { name: 'Clear all filters' }).click()
  await confirmation.getByRole('button', { name: 'Clear filters' }).click()
  await expectColumn(page, 'name', await sqlColumn(backend, 'select name from qry_item order by name asc'))
  await expect(page.getByRole('combobox', { name: 'Sort field' })).toHaveValue('name')
})

test('[QRY-084] condition status explains missing values and completed filters on keyboard focus @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  await showTable(page)
  await openFilter(page)
  const row = await addCondition(page, 'Name', 'equals')
  const status = row.locator('[data-qqq-id="filter-status-0-0"]')
  await expect(status).toHaveAttribute('data-valid', 'false')
  await status.focus()
  await expect(page.getByRole('tooltip')).toContainText('You must enter a value')
  await row.getByRole('textbox', { name: 'Filter value for Name' }).fill('Alpha Widget')
  await expect(status).toHaveAttribute('data-valid', 'true')
  await status.focus()
  await expect(page.getByRole('tooltip')).toContainText('fully defined and is part of your filter')
  await closeFilterSheet(page)
  await expectColumn(page, 'name', await sqlColumn(backend,
    "select name from qry_item where name = 'Alpha Widget' order by id desc"))
})

test('[QRY-085] Weekday filter sends a field function and returns matching dates @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const rows = await backend.sql('select name, received_date from qry_item where received_date is not null order by id desc')
  const firstDate = String(rows[0].received_date).slice(0, 10)
  const selectedDay = new Date(`${firstDate}T12:00:00Z`).getUTCDay()
  const isoDay = selectedDay === 0 ? 7 : selectedDay
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${firstDate}T12:00:00Z`))
  const expected = rows.filter((row) => {
    const date = String(row.received_date).slice(0, 10)
    const day = new Date(`${date}T12:00:00Z`).getUTCDay()
    return (day === 0 ? 7 : day) === isoDay
  }).map((row) => String(row.name))
  await open(page, '/app/qryItem')
  await showTable(page)
  const requests = captureQueries(page, 'qryItem')
  await openFilter(page)
  const row = await addCondition(page, 'Received Date', 'day is any of')
  await row.getByRole('combobox', { name: 'Filter weekdays for Received Date' }).click()
  await page.getByRole('option', { name: weekday, exact: true }).click()
  await closeFilterSheet(page)
  await expectColumn(page, 'name', expected)
  expect(requests.at(-1)).toMatchObject({ filter: { criteria: expect.arrayContaining([
    expect.objectContaining({ fieldName: 'receivedDate', operator: 'IN', values: [isoDay],
      fieldFunction: expect.objectContaining({ functionTypeIdentifierName: 'WeekdayOfDate' }) }),
  ]) } })
})

test('[QRY-085] date-time weekday filter uses configured time-zone arguments @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  await showTable(page)
  const requests = captureQueries(page, 'qryItem')
  await openFilter(page)
  const row = await addCondition(page, 'Checked At', 'day is any of')
  await row.getByRole('combobox', { name: 'Filter weekdays for Checked At' }).click()
  await page.getByRole('option', { name: 'Monday', exact: true }).click()
  await closeFilterSheet(page)
  await expectColumn(page, 'name', await sqlColumn(backend,
    'select name from qry_item where checked_at is not null and WEEKDAY(CAST(checked_at AS DATE)) + 1 = 1 order by id desc'))
  expect(requests.at(-1)).toMatchObject({ filter: { criteria: expect.arrayContaining([
    expect.objectContaining({ fieldName: 'checkedAt', operator: 'IN', values: [1],
      fieldFunction: expect.objectContaining({ functionTypeIdentifierName: 'WeekdayOfDateTime',
        arguments: expect.objectContaining({ timeZoneId: 'UTC', useSessionZoneId: false }) }) }),
  ]) } })
})

test('[QRY-086] Relative date preset shows its evaluated value and queries recent records @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  await showTable(page)
  await openFilter(page)
  const row = await addCondition(page, 'Received Date', 'is after')
  await row.getByRole('button', { name: 'Common relative date expressions for Received Date' }).click()
  await expectWithinViewport(page.locator('[data-qqq-id="relative-date-menu"]'))
  await page.getByRole('menuitem', { name: /7 days ago/ }).click()
  const expression = row.locator('[data-qqq-id="filter-value-0-0-expression"]')
  await expect(expression).toContainText('7 days ago')
  await expression.locator('[tabindex="0"]').focus()
  await expect(page.getByRole('tooltip')).toContainText(/\d{4}-\d{2}-\d{2}/)
  await closeFilterSheet(page)
  await expectColumn(page, 'name', await sqlColumn(backend,
    "select name from qry_item where received_date > DATEADD('DAY', -7, CURRENT_DATE) order by id desc"))
})

test('[QRY-086] relative date-time preset evaluates live and queries recent records @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  await showTable(page)
  await openFilter(page)
  const row = await addCondition(page, 'Checked At', 'is after')
  await row.getByRole('button', { name: 'Common relative date-time expressions for Checked At' }).click()
  await page.getByRole('menuitem', { name: /7 days ago/ }).click()
  const expression = row.locator('[data-qqq-id="filter-value-0-0-expression"]')
  await expect(expression).toContainText('7 days ago')
  await expression.locator('[tabindex="0"]').focus()
  await expect(page.getByRole('tooltip')).toContainText(/\d{4}-\d{2}-\d{2}/)
  await closeFilterSheet(page)
  await expectColumn(page, 'name', await sqlColumn(backend,
    "select name from qry_item where checked_at > DATEADD('DAY', -7, LOCALTIMESTAMP) order by id desc"))
})

test('[QRY-087] Bulk pasted values filter the SQL-backed records @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  await showTable(page)
  await openFilter(page)
  const row = await addCondition(page, 'Name', 'is any of')
  await row.getByRole('button', { name: 'Bulk add filter values for Name' }).click()
  const dialog = page.getByRole('dialog', { name: 'Bulk Add Filter Values' })
  await dialog.getByRole('textbox', { name: 'Paste text' }).fill('Alpha Widget\nBeta Gadget')
  await dialog.getByRole('combobox', { name: 'Separator' }).selectOption('Newline')
  await expect(dialog.locator('[data-qqq-id="filter-paster-review"]')).toContainText('Alpha Widget')
  await dialog.getByRole('button', { name: 'Add Values' }).click()
  await closeFilterSheet(page)
  await expectColumn(page, 'name', await sqlColumn(backend,
    "select name from qry_item where name in ('Alpha Widget', 'Beta Gadget') order by id desc"))
})

test('[QRY-087] pasted possible-value labels resolve to IDs and unknown labels are skipped @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  await showTable(page)
  await openFilter(page)
  const row = await addCondition(page, 'Owner', 'is any of')
  await row.getByRole('button', { name: 'Bulk add filter values for Owner' }).click()
  const dialog = page.getByRole('dialog', { name: 'Bulk Add Filter Values' })
  await dialog.getByRole('textbox', { name: 'Paste text' }).fill('Avery Sample\nUnknown Person')
  await expect(dialog.locator('[data-qqq-id="filter-paster-detected"]')).toContainText('Space Detected')
  await dialog.getByRole('combobox', { name: 'Separator' }).selectOption('Newline')
  await expect(dialog.locator('[data-qqq-id="filter-paster-error"]')).toContainText('1 value was not found')
  await expect(dialog.locator('[data-qqq-id="filter-paster-count"]')).toContainText('2 values (2 unique)')
  await dialog.getByRole('button', { name: 'Add Values' }).click()
  await closeFilterSheet(page)
  await expectColumn(page, 'name', await sqlColumn(backend,
    'select name from qry_item where owner_id = 1 order by id desc'))
})

test('[QRY-088] Instance query help appears inside the bulk paste dialog @mobile', async ({ page, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  await openFilter(page)
  const row = await addCondition(page, 'Name', 'is any of')
  await row.getByRole('button', { name: 'Bulk add filter values for Name' }).click()
  await expect(page.locator('[data-qqq-id="filter-paster-help"]')).toContainText('Paste one value per line to add several query values.')
})

test('[QRY-089] Case behavior from field metadata normalizes a typed filter value @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryCaseItem')
  await showTable(page)
  await openFilter(page)
  const row = await addCondition(page, 'Code', 'equals')
  const value = row.getByRole('textbox', { name: 'Filter value for Code' })
  await value.fill('ZG-6')
  await expect(value).toHaveValue('zg-6')
  await closeFilterSheet(page)
  await expectColumn(page, 'code', await sqlColumn(backend, "select code from qry_case_item where code = 'zg-6' order by id desc"))
})
