/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Backend exports (CSV, XLSX, JSON) of the query's filter, sort and visible columns.
import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { addCondition, expectColumn, grid, openFilter, sqlColumn } from './query-helpers'

/** Minimal RFC 4180 CSV parser (quoted fields, doubled quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' } else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' } else if (c !== '\r') field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

/** Clicks an export format and returns the downloaded file. */
async function download(page: Page, format: 'CSV' | 'XLSX' | 'JSON') {
  await page.getByRole('button', { name: 'Export records' }).click()
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: new RegExp(`^Export ${format}`) }).click(),
  ])
  return { name: file.suggestedFilename(), body: readFileSync((await file.path())!) }
}

/** Grid header labels in display order. */
async function headers(page: Page, tableLabel: string) {
  return grid(page, tableLabel).locator('thead th button[data-qqq-id^="grid-header-"]').allTextContents()
}

test('[QRY-040] CSV export has the visible columns in order and exactly the filtered, sorted rows', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, '/app/qryItem')
  await expectColumn(page, 'id', await sqlColumn(backend, 'select id from qry_item order by id desc'))
  // hide Notes, show a joined column, filter and sort
  await page.getByRole('button', { name: 'Configure columns' }).click()
  const config = page.getByRole('dialog', { name: 'Configure columns' })
  await config.getByRole('button', { name: 'Hide column Notes' }).click()
  await config.getByRole('button', { name: 'Hide column Photo' }).click()
  await config.getByRole('button', { name: 'Show column Person: First Name' }).click()
  await page.keyboard.press('Escape')
  await openFilter(page)
  const row = await addCondition(page, 'Quantity', 'greater than')
  await row.getByLabel('Filter value for Quantity').fill('5')
  await grid(page, 'Query Item').getByRole('button', { name: 'Sort by Name', exact: true }).click()
  const ids = await sqlColumn(backend, 'select id from qry_item where quantity > 5 order by name asc')
  await expectColumn(page, 'id', ids)

  const file = await download(page, 'CSV')
  expect(file.name).toMatch(/^Query Item Export \d{4}-\d{2}-\d{2} \d{4}\.csv$/)
  const [header, ...rows] = parseCsv(file.body.toString('utf8'))
  // The backend adds a "<label> Name" column after each possible-value field
  const expectedHeader = (await headers(page, 'Query Item')).flatMap((label) => ['Owner', 'Species'].includes(label) ? [label, `${label} Name`] : [label])
  expect(header).toEqual(expectedHeader)
  expect(header).not.toContain('Notes')
  const column = (label: string) => rows.map((r) => r[header.indexOf(label)])
  expect(column('Id')).toEqual(ids)
  expect(column('Name')).toEqual(await sqlColumn(backend, 'select name from qry_item where quantity > 5 order by name asc'))
  expect(column('Owner Name')).toEqual(await sqlColumn(backend, "select p.first_name || ' ' || p.last_name from qry_item i join person p on p.id = i.owner_id where i.quantity > 5 order by i.name asc"))
  expect(column('Person: First Name')).toEqual(await sqlColumn(backend, 'select p.first_name from qry_item i join person p on p.id = i.owner_id where i.quantity > 5 order by i.name asc'))
})

test('[QRY-041] XLSX and JSON exports carry the same rows', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await open(page, `/app/qryItem?filter=${encodeURIComponent(JSON.stringify({ criteria: [{ fieldName: 'isActive', operator: 'EQUALS', values: [true] }] }))}`)
  const ids = await sqlColumn(backend, 'select id from qry_item where is_active = true order by id desc')
  await expectColumn(page, 'id', ids)
  const xlsx = await download(page, 'XLSX')
  expect(xlsx.name).toMatch(/\.xlsx$/)
  expect(xlsx.body.subarray(0, 2).toString('latin1')).toBe('PK')
  expect(xlsx.body.length).toBeGreaterThan(1000)
  const json = await download(page, 'JSON')
  expect(json.name).toMatch(/\.json$/)
  const records = JSON.parse(json.body.toString('utf8')) as Record<string, unknown>[]
  expect(records.map((r) => String(r.id))).toEqual(ids)
  expect(records.map((r) => r.name)).toEqual(await sqlColumn(backend, 'select name from qry_item where is_active = true order by id desc'))
  // Only visible columns are exported; the backend keys JSON by camel-cased label, plus "<label>Name" for possible values
  const camel = (label: string) => label.split(/\s+/).map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join('')
  const allowed = (await headers(page, 'Query Item')).flatMap((label) => ['Owner', 'Species'].includes(label) ? [camel(label), `${camel(label)}Name`] : [camel(label)])
  for (const record of records) {
    for (const key of Object.keys(record)) expect(allowed).toContain(key)
  }
  expect(Object.keys(records[0])).toContain('ownerName')
})

test('[QRY-042] nothing to export disables the formats', async ({ page, diagnostics }) => {
  void diagnostics
  await open(page, `/app/qryItem?filter=${encodeURIComponent(JSON.stringify({ criteria: [{ fieldName: 'name', operator: 'EQUALS', values: ['no such item'] }] }))}`)
  await expect(page.getByText('No records found', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Export records' }).click()
  for (const format of ['CSV', 'XLSX', 'JSON']) {
    await expect(page.getByRole('menuitem', { name: new RegExp(`^Export ${format}`) })).toBeDisabled()
  }
})

test.describe('without pet permissions', () => {
  test.use({ persona: 'noPets' })

  test('[QRY-043] the backend refuses exports of unreadable tables', async ({ backend, diagnostics }) => {
    void diagnostics
    const denied = await backend.api.post('/data/pet/export/pets.csv', { form: { fields: 'id,name', filter: '{}' } })
    expect(denied.status()).toBe(403)
    expect(await denied.text()).not.toContain('Charlie')
  })
})
