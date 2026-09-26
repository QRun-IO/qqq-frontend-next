/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, test } from '../../support/fixtures'
import { expectTouchReady } from '../../support/touch'
import { recordCollection } from '../navigation/nav-helpers'
import { VIEWER, expandOnPhone, expectNoSidewaysScroll, fieldValue, isPhone, openRecord, showSection, sqlOne, toasts } from './helpers'

test.use(VIEWER)

test('[REC-001] record view shows the label, tiered sections and formatted values @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const person = await sqlOne(backend, 'select first_name, last_name, email, birth_date, annual_salary, days_worked, is_employed from person where id = 1')
  await openRecord(page, 'person', 1, `${person.first_name} ${person.last_name}`)

  // T2 sections render as labelled cards (phone: accordion items) with the backend's display formatting.
  await expandOnPhone(page, 'Basic Info', 'Employment Info')
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
  await expandOnPhone(page, 'Employment Info')
  await expect(fieldValue(page, 'isEmployed')).toHaveText('No')

  // The T1 header shows T1 fields that are not already part of the label (Record Lab: status).
  await openRecord(page, 'recordLab', 1, 'Lab: Alpha')
  const header = page.locator('[data-qqq-id="record-primary-sections"]')
  await expect(header.locator('[data-qqq-id="record-field-status"]')).toContainText('Active')
  await expect(header.locator('[data-qqq-id="record-field-title"]')).toHaveCount(0)
})

test('[REC-002] empty values show a placeholder; hidden fields and sections never render @mobile', async ({ page, backend, diagnostics }) => {
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

test('[REC-003] a missing record shows Record Not Found and returns to its table @mobile', async ({ page, backend, diagnostics }) => {
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
  await expect(recordCollection(page, 'Person')).toBeVisible()
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

test('[REC-004] every visible section opens by touch on phones and tablets @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const created = await backend.api.post('/data/fieldLab', { multipart: { name: 'Touch Sections', longValue: '42', timeZone: 'UTC',
    truncateValue: 'abcdefghij', upperValue: 'abc', boundedValue: '12.5' } })
  expect(created.status()).toBe(200)
  const id = (await created.json()).records[0].values.id
  expect(await sqlOne(backend, `select long_value, truncate_value, upper_value, bounded_value from field_lab where id = ${id}`))
    .toEqual({ long_value: '42', truncate_value: 'abcdefgh', upper_value: 'ABC', bounded_value: '12.50' })
  await openRecord(page, 'fieldLab', id, 'Touch Sections')

  // Phone: one accordion item per section, the first open; wider screens: the tab bar.
  const sections = ['Date Defaults', 'Field Types', 'Time Zones', 'Length Policies', 'Case and Whitespace', 'Numeric Bounds']
  if (isPhone(page)) {
    const triggers = page.locator('[data-qqq-id="record-view-accordion"] [data-qqq-id^="accordion-trigger-"]')
    await expect(triggers).toHaveText(sections)
    await expect(triggers.first()).toHaveAttribute('aria-expanded', 'true')
    await expect(fieldValue(page, 'manualDateTime')).toHaveText('—')
  } else {
    await expect(page.locator('[data-qqq-id="record-view-tabs"]').getByRole('tab')).toHaveText(['Overview', ...sections])
  }
  await expectNoSidewaysScroll(page)
  await expectTouchReady(page, page.locator('[data-qqq-id="record-view-fieldLab"]'))

  const values: [string, string, string][] = [['Field Types', 'longValue', '42'], ['Time Zones', 'timeZone', 'UTC'],
    ['Length Policies', 'truncateValue', 'abcdefgh'], ['Case and Whitespace', 'upperValue', 'ABC'], ['Numeric Bounds', 'boundedValue', '12.50']]
  for (const [section, field, text] of values) {
    await showSection(page, section)
    await expect(fieldValue(page, field)).toHaveText(text)
  }
  await expectNoSidewaysScroll(page)

  // A deep link to a section opens it in either layout.
  await page.goto(`/app/fieldLab/${id}?tab=section-normalization`, { waitUntil: 'domcontentloaded' })
  await expect(fieldValue(page, 'upperValue')).toHaveText('ABC')
})
