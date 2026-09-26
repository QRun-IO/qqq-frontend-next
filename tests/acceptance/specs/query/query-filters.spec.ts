/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Filters and operators on the Query Item fixture (qqq_item), proven against SQL.
import { expect, open, test } from '../../support/fixtures'
import {
  addCondition, captureQueries, clearFilter, conditionRow, expectColumn, filterUrl, nextQuery, openFilter,
  pickPossibleValues, setOperator, sqlColumn, typeTags, clearTags, closeValuePopup, closeFilterSheet, showTable,
} from './query-helpers'

const names = (backend: Parameters<typeof sqlColumn>[0], where: string) =>
  sqlColumn(backend, `select name from qry_item where ${where} order by id desc`)

test.describe('filter operators', () => {
  test('[QRY-010] text operators match the backend semantics for every Material option @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await open(page, '/app/qryItem')
    await showTable(page)
    await expectColumn(page, 'name', await names(backend, '1 = 1'))
    await openFilter(page)
    const row = await addCondition(page, 'Code', 'equals')
    // Typing key by key keeps focus in the value input (the row is not remounted per keystroke)
    await row.getByLabel('Filter value for Code').pressSequentially('BG-2')
    await expect(row.getByLabel('Filter value for Code')).toBeFocused()
    await expect(row.getByLabel('Filter value for Code')).toHaveValue('BG-2')
    await expectColumn(page, 'name', await names(backend, "code = 'BG-2'"))
    const cases: [string, string | string[] | null, string][] = [
      ['equals', 'BG-2', "code = 'BG-2'"],
      ['does not equal', 'BG-2', "(code is null or code <> 'BG-2')"],
      ['contains', 'W', "code like '%W%'"],
      ['does not contain', 'W', "code not like '%W%'"],
      ['starts with', 'G', "code like 'G%'"],
      ['does not start with', 'G', "code not like 'G%'"],
      ['ends with', '-6', "code like '%-6'"],
      ['does not end with', '-6', "code not like '%-6'"],
      ['is empty', null, "(code is null or code = '')"],
      ['is not empty', null, "(code is not null and code <> '')"],
      ['is any of', ['AW-1', 'OP-8'], "code in ('AW-1', 'OP-8')"],
      ['is none of', ['AW-1', 'OP-8'], "code not in ('AW-1', 'OP-8')"],
    ]
    for (const [operator, value, where] of cases) {
      await setOperator(row, operator)
      if (Array.isArray(value)) {
        const chips = row.locator('[data-qqq-id="filter-value-chip"]')
        if (await chips.count() === 0) await typeTags(row, value)
      } else if (value !== null) {
        await row.getByLabel('Filter value for Code').fill(value)
      }
      await expectColumn(page, 'name', await names(backend, where))
    }
    // The badge counts complete conditions; an empty value is not sent (Material validateCriteria)
    await setOperator(row, 'equals')
    await row.getByLabel('Filter value for Code').fill('')
    await expectColumn(page, 'name', await names(backend, '1 = 1'))
    await expect(page.locator('[data-qqq-id="button-filter"]')).not.toContainText(/\d/)
  })

  test('[QRY-011] number operators including ranges and lists @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await open(page, '/app/qryItem')
    await showTable(page)
    await openFilter(page)
    const row = await addCondition(page, 'Quantity', 'equals')
    const single: [string, string, string][] = [
      ['equals', '25', 'quantity = 25'],
      ['does not equal', '25', '(quantity is null or quantity <> 25)'],
      ['greater than', '10', 'quantity > 10'],
      ['greater than or equals', '10', 'quantity >= 10'],
      ['less than', '10', 'quantity < 10'],
      ['less than or equals', '10', 'quantity <= 10'],
    ]
    for (const [operator, value, where] of single) {
      await setOperator(row, operator)
      await row.getByLabel('Filter value for Quantity').fill(value)
      await expectColumn(page, 'name', await names(backend, where))
    }
    await setOperator(row, 'is empty')
    await expectColumn(page, 'name', await names(backend, 'quantity is null'))
    await setOperator(row, 'is not empty')
    await expectColumn(page, 'name', await names(backend, 'quantity is not null'))
    await setOperator(row, 'is between')
    await row.getByLabel('Filter value from for Quantity').fill('5')
    await row.getByLabel('Filter value to for Quantity').fill('25')
    await expectColumn(page, 'name', await names(backend, 'quantity between 5 and 25'))
    await setOperator(row, 'is not between')
    await expectColumn(page, 'name', await names(backend, 'quantity not between 5 and 25'))
    await setOperator(row, 'is any of')
    // Material keeps the previous values when switching to a list operator; start the list fresh
    await clearTags(row)
    await typeTags(row, ['0', '100'])
    await expectColumn(page, 'name', await names(backend, 'quantity in (0, 100)'))
    await setOperator(row, 'is none of')
    await expectColumn(page, 'name', await names(backend, 'quantity not in (0, 100)'))

    // Decimals keep their precision; numeric values are sent as numbers, not text
    await clearFilter(page)
    const price = await addCondition(page, 'Price', 'greater than or equals')
    const sent = nextQuery(page, 'qryItem')
    await price.getByLabel('Filter value for Price').fill('7.77')
    await expectColumn(page, 'name', await names(backend, 'price >= 7.77'))
    const body = await sent
    expect(JSON.stringify(body.filter)).toContain('"values":[7')
  })

  test('[QRY-012] date operators and relative date expressions @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await open(page, '/app/qryItem')
    await showTable(page)
    await openFilter(page)
    const row = await addCondition(page, 'Received Date', 'equals')
    const input = row.getByLabel('Filter value for Received Date')
    const fixed: [string, string][] = [
      ['equals', "received_date = DATE '2021-01-01'"],
      ['does not equal', "(received_date is null or received_date <> DATE '2021-01-01')"],
      ['is after', "received_date > DATE '2021-01-01'"],
      ['is on or after', "received_date >= DATE '2021-01-01'"],
      ['is before', "received_date < DATE '2021-01-01'"],
      ['is on or before', "received_date <= DATE '2021-01-01'"],
    ]
    for (const [operator, where] of fixed) {
      await setOperator(row, operator)
      await input.fill('2021-01-01')
      await expectColumn(page, 'name', await names(backend, where))
    }
    await setOperator(row, 'is empty')
    await expectColumn(page, 'name', await names(backend, 'received_date is null'))
    await setOperator(row, 'is not empty')
    await expectColumn(page, 'name', await names(backend, 'received_date is not null'))
    await setOperator(row, 'is between')
    await row.getByLabel('Filter value from for Received Date').fill('2020-01-01')
    await row.getByLabel('Filter value to for Received Date').fill('2021-01-01')
    await expectColumn(page, 'name', await names(backend, "received_date between DATE '2020-01-01' and DATE '2021-01-01'"))
    await setOperator(row, 'is not between')
    await expectColumn(page, 'name', await names(backend, "received_date not between DATE '2020-01-01' and DATE '2021-01-01'"))

    // Relative: "is after 10 days ago" (Material's NowWithOffset)
    await setOperator(row, 'is after')
    const sent = nextQuery(page, 'qryItem')
    await row.getByRole('button', { name: 'Relative date for Received Date' }).click()
    const editor = page.getByRole('dialog', { name: 'Custom date filter condition' })
    await editor.getByLabel('Amount').fill('10')
    await editor.getByLabel('Offset unit').selectOption('DAYS')
    await editor.getByLabel('Direction').selectOption('MINUS')
    await editor.getByRole('button', { name: 'Apply' }).click()
    await expect(row.locator('[data-qqq-id$="-expression"]')).toHaveText(/10 days ago/)
    await expectColumn(page, 'name', await names(backend, "received_date > DATEADD('DAY', -10, CURRENT_DATE)"))
    expect(JSON.stringify((await sent).filter)).toContain('{"type":"NowWithOffset","operator":"MINUS","amount":10,"timeUnit":"DAYS"}')

    // "equals today" (Now) and "is on or after the start of this year" (ThisOrLastPeriod)
    await setOperator(row, 'equals')
    await row.getByRole('button', { name: 'Relative date for Received Date' }).click()
    await editor.getByRole('radio', { name: 'Today' }).check()
    await editor.getByRole('button', { name: 'Apply' }).click()
    await expectColumn(page, 'name', await names(backend, 'received_date = CURRENT_DATE'))
    await setOperator(row, 'is on or after')
    await row.getByRole('button', { name: 'Relative date for Received Date' }).click()
    await editor.getByRole('radio', { name: 'This or last...' }).check()
    await editor.getByLabel('This or last', { exact: true }).selectOption('LAST')
    await editor.getByLabel('Period unit').selectOption('YEARS')
    await editor.getByRole('button', { name: 'Apply' }).click()
    await expect(row.locator('[data-qqq-id$="-expression"]')).toHaveText(/start of last year/)
    await expectColumn(page, 'name', await names(backend, "received_date >= DATEADD('YEAR', -1, DATE_TRUNC('YEAR', CURRENT_DATE))"))
    // Clearing the expression returns to a plain date input (and no condition is sent)
    await row.getByRole('button', { name: 'Clear relative value for Received Date' }).click()
    await expect(input).toHaveValue('')
    await expectColumn(page, 'name', await names(backend, '1 = 1'))
  })

  test.describe('in another time zone', () => {
    test.use({ timezoneId: 'America/Chicago' })

    test('[QRY-013] date-time operators convert local input to UTC and support relative values @mobile', async ({ page, backend, diagnostics }) => {
      void diagnostics
      await open(page, '/app/qryItem')
      await showTable(page)
    await showTable(page)
      await openFilter(page)
      const row = await addCondition(page, 'Checked At', 'is before')
      const sent = nextQuery(page, 'qryItem')
      // 03:00 in Chicago on 2021-01-01 is 09:00 UTC, so the 08:30 UTC row matches
      await row.getByLabel('Filter value for Checked At').fill('2021-01-01T03:00')
      await expectColumn(page, 'name', await names(backend, "checked_at < TIMESTAMP '2021-01-01 09:00:00'"))
      expect(JSON.stringify((await sent).filter)).toContain('2021-01-01T09:00:00.000Z')
      await setOperator(row, 'is at or after')
      await expectColumn(page, 'name', await names(backend, "checked_at >= TIMESTAMP '2021-01-01 09:00:00'"))
      await setOperator(row, 'is between')
      await row.getByLabel('Filter value from for Checked At').fill('2020-06-15T06:00')
      await row.getByLabel('Filter value to for Checked At').fill('2021-01-01T03:00')
      await expectColumn(page, 'name', await names(backend, "checked_at between TIMESTAMP '2020-06-15 11:00:00' and TIMESTAMP '2021-01-01 09:00:00'"))
      await setOperator(row, 'is empty')
      await expectColumn(page, 'name', await names(backend, 'checked_at is null'))

      // "is after 1 hour ago"
      await setOperator(row, 'is after')
      await row.getByRole('button', { name: 'Relative date-time for Checked At' }).click()
      const editor = page.getByRole('dialog', { name: 'Custom date filter condition' })
      await editor.getByLabel('Amount').fill('1')
      await editor.getByLabel('Offset unit').selectOption('HOURS')
      await editor.getByRole('button', { name: 'Apply' }).click()
      await expect(row.locator('[data-qqq-id$="-expression"]')).toHaveText(/1 hour ago/)
      await expectColumn(page, 'name', await names(backend, "checked_at > DATEADD('HOUR', -1, LOCALTIMESTAMP)"))
      // "is before now"
      await setOperator(row, 'is before')
      await row.getByRole('button', { name: 'Relative date-time for Checked At' }).click()
      await editor.getByRole('radio', { name: 'Now' }).check()
      await editor.getByRole('button', { name: 'Apply' }).click()
      await expectColumn(page, 'name', await names(backend, 'checked_at < LOCALTIMESTAMP'))
    })
  })

  test('[QRY-014] boolean, blob and long-text operators @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await open(page, '/app/qryItem')
    await showTable(page)
    await openFilter(page)
    const active = await addCondition(page, 'Is Active', 'equals yes')
    await expect(active.getByLabel(/^Filter value/)).toHaveCount(0)
    await expectColumn(page, 'name', await names(backend, 'is_active = true'))
    await setOperator(active, 'equals no')
    await expectColumn(page, 'name', await names(backend, 'is_active = false'))
    await setOperator(active, 'is empty')
    await expectColumn(page, 'name', await names(backend, 'is_active is null'))
    await setOperator(active, 'is not empty')
    await expectColumn(page, 'name', await names(backend, 'is_active is not null'))
    await clearFilter(page)

    const photo = await addCondition(page, 'Photo', 'is not empty')
    expect(await photo.getByLabel('Filter operator').locator('option').allTextContents()).toEqual(['is empty', 'is not empty'])
    await expectColumn(page, 'name', await names(backend, 'photo is not null'))
    await setOperator(photo, 'is empty')
    await expectColumn(page, 'name', await names(backend, 'photo is null'))
    await clearFilter(page)

    const notes = await addCondition(page, 'Notes', 'contains')
    await notes.getByLabel('Filter value for Notes').fill('ship')
    await expectColumn(page, 'name', await names(backend, "notes like '%ship%'"))
  })

  test('[QRY-015] possible-value selectors for table and enum sources show labels and send ids @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await open(page, '/app/qryItem')
    await showTable(page)
    await openFilter(page)
    const owner = await addCondition(page, 'Owner', 'equals')
    expect(await owner.getByLabel('Filter operator').locator('option').allTextContents())
      .toEqual(['equals', 'does not equal', 'is empty', 'is not empty', 'is any of', 'is none of'])
    await owner.getByRole('combobox', { name: 'Filter value for Owner' }).click()
    await page.getByRole('textbox', { name: 'Search Owner options' }).fill('Blair')
    const sent = nextQuery(page, 'qryItem')
    await page.getByRole('option', { name: 'Blair Sample', exact: true }).click()
    await expect(owner.getByRole('combobox', { name: 'Filter value for Owner' })).toHaveText('Blair Sample')
    await expectColumn(page, 'name', await names(backend, 'owner_id = 2'))
    expect(JSON.stringify((await sent).filter)).toContain('"fieldName":"ownerId","operator":"EQUALS","values":[2]')
    await setOperator(owner, 'does not equal')
    await expectColumn(page, 'name', await names(backend, '(owner_id is null or owner_id <> 2)'))
    await setOperator(owner, 'is empty')
    await expectColumn(page, 'name', await names(backend, 'owner_id is null'))
    await setOperator(owner, 'is any of')
    await pickPossibleValues(page, owner, ['Avery Sample', 'Casey Sample'])
    await expect(owner.locator('[data-qqq-id="filter-value-chip"]')).toHaveText(['Avery Sample', 'Casey Sample'])
    await expectColumn(page, 'name', await names(backend, 'owner_id in (1, 3)'))
    await setOperator(owner, 'is none of')
    await expectColumn(page, 'name', await names(backend, 'owner_id not in (1, 3)'))
    await clearFilter(page)

    const species = await addCondition(page, 'Species', 'is any of')
    await species.getByRole('combobox', { name: 'Filter values for Species' }).click()
    await expect(page.getByRole('listbox', { name: 'Species options' }).getByRole('option')).toHaveText(['Dog', 'Cat'])
    await page.getByRole('option', { name: 'Cat', exact: true }).click()
    await closeValuePopup(page)
    await expectColumn(page, 'name', await names(backend, 'species_id = 2'))

    // A filter link carrying ids (not labels) still renders the labels after a reload
    await page.reload()
    await openFilter(page)
    await expect(conditionRow(page, 0).locator('[data-qqq-id="filter-value-chip"]')).toHaveText(['Cat'])
    await expectColumn(page, 'name', await names(backend, 'species_id = 2'))
  })

  test('[QRY-016] AND/OR and nested groups combine as declared @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await open(page, '/app/qryItem')
    await showTable(page)
    await openFilter(page)
    const quantity = await addCondition(page, 'Quantity', 'greater than')
    await quantity.getByLabel('Filter value for Quantity').fill('20')
    const active = await addCondition(page, 'Is Active', 'equals no')
    await expect(active).toBeVisible()
    await expectColumn(page, 'name', await names(backend, 'quantity > 20 and is_active = false'))
    await page.getByLabel('Boolean operator').first().selectOption('OR')
    await expectColumn(page, 'name', await names(backend, 'quantity > 20 or is_active = false'))
    // (quantity > 20 OR not active) AND (code starts with G OR code ends with 8)... expressed as a sub-group of OR
    await page.locator('[data-qqq-id="filter-add-group-0"]').click()
    const code = await addCondition(page, 'Code', 'starts with', 1)
    await code.getByLabel('Filter value for Code').fill('G')
    await expectColumn(page, 'name', await names(backend, "quantity > 20 or is_active = false or code like 'G%'"))
    await page.getByLabel('Boolean operator').first().selectOption('AND')
    await expectColumn(page, 'name', await names(backend, "quantity > 20 and is_active = false and code like 'G%'"))
    await page.locator('[data-qqq-id="filter-remove-group-0"]').click()
    await expectColumn(page, 'name', await names(backend, 'quantity > 20 and is_active = false'))
    // Removing a condition leaves the other
    await page.getByRole('button', { name: 'Remove filter condition 1' }).click()
    await expectColumn(page, 'name', await names(backend, 'is_active = false'))
  })

  test('[QRY-017] filters live in the URL: reload, back/forward and Material-style JSON links @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await open(page, '/app/qryItem')
    await showTable(page)
    await openFilter(page)
    const row = await addCondition(page, 'Name', 'contains')
    await row.getByLabel('Filter value for Name').fill('Widget')
    const widgetNames = await names(backend, "name like '%Widget%'")
    await expectColumn(page, 'name', widgetNames)
    await expect(page).toHaveURL(/filter=/)
    await page.reload()
    await expectColumn(page, 'name', widgetNames)
    await expect(page.locator('[data-qqq-id="button-filter"]')).toContainText('1')
    await page.goto('/app/person', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('grid', { name: 'Person records' }).or(page.getByRole('list', { name: 'Person records' }))).toBeVisible()
    await page.goBack()
    await expectColumn(page, 'name', widgetNames)

    // A link with plain JSON, as QQQ widgets and Material build them
    await open(page, filterUrl('qryItem', { criteria: [{ fieldName: 'code', operator: 'IN', values: ['AW-1', 'GW-3'] }] }))
    await expectColumn(page, 'name', await names(backend, "code in ('AW-1', 'GW-3')"))
    // Garbage in the filter parameter falls back to every record rather than failing
    await open(page, '/app/qryItem?filter=not-a-filter!!')
    await expectColumn(page, 'name', await names(backend, '1 = 1'))
  })

  test('[QRY-018] backend-only operators from links render and filter correctly @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const cases: [string, unknown[], string, string][] = [
      ['LIKE', ['%Widget%'], 'is like', "name like '%Widget%'"],
      ['NOT_LIKE', ['%Widget%'], 'is not like', "name not like '%Widget%'"],
      ['TRUE', [], 'matches every record', '1 = 1'],
      ['FALSE', [], 'matches no records', '1 = 0'],
      ['NOT_EQUALS', ['Delta Tool'], 'does not equal (excluding empty)', "name <> 'Delta Tool'"],
    ]
    for (const [operator, values, label, where] of cases) {
      await open(page, filterUrl('qryItem', { criteria: [{ fieldName: 'name', operator, values }] }))
      await showTable(page)
      await expectColumn(page, 'name', await names(backend, where))
      await openFilter(page)
      await expect(conditionRow(page, 0).getByLabel('Filter operator').locator('option:checked')).toHaveText(label)
    }
    await open(page, filterUrl('qryItem', { criteria: [{ fieldName: 'quantity', operator: 'IS_NULL_OR_IN', values: [0, 3] }] }))
    await showTable(page)
    await expectColumn(page, 'name', await names(backend, 'quantity is null or quantity in (0, 3)'))
    await openFilter(page)
    await expect(conditionRow(page, 0).getByLabel('Filter operator').locator('option:checked')).toHaveText('is empty or any of')
    await expect(conditionRow(page, 0).locator('[data-qqq-id="filter-value-chip"]')).toHaveText(['0', '3'])
  })

  test('[QRY-019] quick search combines with the advanced filter @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await open(page, '/app/qryItem')
    await showTable(page)
    const bodies = captureQueries(page, 'qryItem')
    await page.getByLabel('Quick search Query Item').fill('Widget')
    // Quick search ORs CONTAINS across the visible text columns
    await expectColumn(page, 'name', await names(backend, "name like '%Widget%' or code like '%Widget%' or notes like '%Widget%'"))
    await openFilter(page)
    const row = await addCondition(page, 'Is Active', 'equals yes')
    await expect(row).toBeVisible()
    await expectColumn(page, 'name', await names(backend, "is_active = true and (name like '%Widget%' or code like '%Widget%' or notes like '%Widget%')"))
    await closeFilterSheet(page)
    await expect(page.getByLabel('Quick search Query Item')).toHaveValue('Widget')
    const last = bodies.at(-1) as { filter: { booleanOperator: string; subFilters: { booleanOperator: string }[] } }
    expect(last.filter.booleanOperator).toBe('AND')
    expect(last.filter.subFilters.map((s) => s.booleanOperator)).toEqual(['AND', 'OR'])
    // Clearing the quick search keeps the advanced filter
    await page.getByRole('button', { name: 'Clear search' }).click()
    await expectColumn(page, 'name', await names(backend, 'is_active = true'))
    // No match shows the empty state with a clear action
    await page.getByLabel('Quick search Query Item').fill('no such item')
    await expect(page.getByText('No records found', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Clear Filters' }).click()
    await expectColumn(page, 'name', await names(backend, '1 = 1'))
  })
})
