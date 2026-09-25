/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, test } from '../../support/fixtures'
import { VIEWER, fieldValue, openRecord, sqlOne, toasts } from './helpers'

test.use(VIEWER)

test('[REC-001] record view shows the label, tiered sections and formatted values', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const person = await sqlOne(backend, 'select first_name, last_name, email, birth_date, annual_salary, days_worked, is_employed from person where id = 1')
  await openRecord(page, 'person', 1, `${person.first_name} ${person.last_name}`)

  // T2 sections render as labelled cards with the backend's display formatting.
  await expect(page.getByRole('heading', { level: 3, name: 'Basic Info' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 3, name: 'Employment Info' })).toBeVisible()
  await expect(fieldValue(page, 'email')).toHaveText(person.email!)
  await expect(fieldValue(page, 'birthDate')).toHaveText(person.birth_date!)
  expect(person.annual_salary).toBe('75003.50')
  await expect(fieldValue(page, 'annualSalary')).toHaveText('$75,003.50')
  expect(person.days_worked).toBe('1001')
  await expect(fieldValue(page, 'daysWorked')).toHaveText('1,001')
  expect(person.is_employed).toBe('TRUE')
  await expect(fieldValue(page, 'isEmployed')).toHaveText('Yes')

  // Morgan is not employed: BOOLEAN false renders as No.
  await openRecord(page, 'person', 5, 'Morgan Sample')
  await expect(fieldValue(page, 'isEmployed')).toHaveText('No')

  // The T1 header shows T1 fields that are not already part of the label (Record Lab: status).
  await openRecord(page, 'recordLab', 1, 'Lab: Alpha')
  const header = page.locator('[data-qqq-id="record-primary-sections"]')
  await expect(header.locator('[data-qqq-id="record-field-status"]')).toContainText('Active')
  await expect(header.locator('[data-qqq-id="record-field-title"]')).toHaveCount(0)
})

test('[REC-002] empty values show a placeholder; hidden fields and sections never render', async ({ page, backend, diagnostics }) => {
  void diagnostics
  expect((await sqlOne(backend, 'select birth_date from person where id = 4')).birth_date).toBeNull()
  await openRecord(page, 'person', 4, 'Drew Sample')
  await expect(fieldValue(page, 'birthDate')).toHaveText('—')

  const lab = await sqlOne(backend, "select hidden_code, legacy_code from record_lab where title = 'Alpha'")
  expect(lab).toEqual({ hidden_code: 'H-ALPHA', legacy_code: 'L-ALPHA' })
  await openRecord(page, 'recordLab', 1, 'Lab: Alpha')
  await page.getByRole('radio', { name: 'List view' }).click()
  await expect(page.locator('[data-qqq-id="record-view-list-mode"]')).toBeVisible()
  await expect(page.locator('[data-qqq-id="record-field-hiddenCode"]')).toHaveCount(0)
  await expect(page.locator('[data-qqq-id="record-section-legacy"]')).toHaveCount(0)
  await expect(page.getByText('H-ALPHA')).toHaveCount(0)
  await expect(page.getByText('L-ALPHA')).toHaveCount(0)

  // The backend never sends a hidden field, so it cannot leak through the payload either.
  const response = await backend.api.get('/data/recordLab/1')
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body.values).not.toHaveProperty('hiddenCode')
  expect(JSON.stringify(body)).not.toContain('H-ALPHA')
})

test('[REC-003] a missing record shows Record Not Found and returns to its table', async ({ page, backend, diagnostics }) => {
  diagnostics.allow('/data/person/999 404')
  diagnostics.allow('Failed to load resource: the server responded with a status of 404')
  expect((await backend.sql('select id from person where id = 999'))).toHaveLength(0)
  await page.goto('/app/person/999', { waitUntil: 'domcontentloaded' })
  const panel = page.locator('[data-qqq-id="record-view-not-found-person"]')
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('Record Not Found')
  await expect(panel).toContainText('The Person record you are looking for does not exist or has been deleted.')
  // The page explains the failure itself; no second, generic toast.
  await expect(toasts(page)).toHaveCount(0)
  await panel.getByRole('button', { name: 'Back to Person' }).click()
  await expect(page).toHaveURL(/\/app\/person\/?$/)
  await expect(page.getByRole('grid', { name: 'Person records' })).toBeVisible()
  expect(diagnostics.failedRequests).toEqual(['GET /data/person/999 404'])
})

test('[REC-004] tabs and list view expose every visible section', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const created = await backend.api.post('/data/fieldLab', { multipart: { name: 'Sections', upperValue: 'abc', boundedValue: '12.5', timeZone: 'UTC' } })
  expect(created.status()).toBe(200)
  const id = (await created.json()).records[0].values.id
  await openRecord(page, 'fieldLab', id, 'Sections')

  const tabs = page.locator('[data-qqq-id="record-view-tabs"]').getByRole('tab')
  await expect(tabs).toHaveText(['Overview', 'Date Defaults', 'Field Types', 'Time Zones', 'Length Policies', 'Case and Whitespace', 'Numeric Bounds'])
  const overview = page.locator('[data-qqq-id="record-tab-panel-overview"]')
  for (const section of ['Date Defaults', 'Field Types', 'Time Zones', 'Length Policies', 'Case and Whitespace', 'Numeric Bounds']) {
    await expect(overview.getByRole('heading', { level: 3, name: section })).toBeVisible()
  }

  await page.getByRole('tab', { name: 'Case and Whitespace' }).click()
  await expect(page).toHaveURL(/tab=section-normalization/)
  await expect(fieldValue(page, 'upperValue')).toHaveText('ABC')
  await expect(page.getByRole('heading', { level: 3, name: 'Numeric Bounds' })).toHaveCount(0)

  await page.getByRole('radio', { name: 'List view' }).click()
  const list = page.locator('[data-qqq-id="record-view-list-mode"]')
  for (const section of ['Identity', 'Date Defaults', 'Field Types', 'Time Zones', 'Length Policies', 'Case and Whitespace', 'Numeric Bounds']) {
    await expect(list.getByRole('heading', { name: section })).toBeVisible()
  }
  await expect(fieldValue(page, 'boundedValue')).toHaveText('12.50')
})

test('[REC-049] pages of a table outside the app tree use its label in the document title and breadcrumbs', async ({ page, backend, diagnostics }) => {
  void diagnostics
  type Node = { name: string; children?: Node[] }
  const meta = await (await backend.api.get('/qqq/v1/metaData')).json()
  const names = (nodes: Node[]): string[] => nodes.flatMap((node) => [node.name, ...names(node.children ?? [])])
  expect(names(meta.appTree)).not.toContain('scheduledReport')
  const label = meta.tables.scheduledReport.label
  expect(label).toBe('Scheduled Report')
  const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb' })

  await page.goto('/app/scheduledReport/create', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 2, name: `Create ${label}` })).toBeVisible()
  await expect(page).toHaveTitle(`Create ${label} | ${label} | QQQ Sample`)
  await expect(breadcrumbs.getByRole('link', { name: label })).toBeVisible()
  await expect(breadcrumbs).not.toContainText('scheduledReport')

  const created = await backend.api.post('/data/scheduledReport', { multipart: {
    savedReportId: '1', isActive: 'true', format: 'CSV', toAddresses: 'owned-title@example.com', subject: 'Owned title', cronExpression: '0 0 9 * * ?', cronTimeZoneId: 'UTC',
  } })
  expect(created.status()).toBe(200)
  const record = (await created.json()).records[0]
  await page.goto(`/app/scheduledReport/${record.values.id}`, { waitUntil: 'domcontentloaded' })
  const heading = page.getByRole('heading', { level: 1 })
  await expect(heading).toHaveText(/\S/)
  const recordLabel = (await heading.textContent())!.trim()
  expect(recordLabel).toContain('Pet Species Report')
  await expect(page).toHaveTitle(`${recordLabel} | ${label} | QQQ Sample`)
  await expect(breadcrumbs.getByRole('link', { name: label })).toBeVisible()
})
