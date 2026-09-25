/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, test } from '../../support/fixtures'
import {
  VIEWER, control, fieldValue, multipartFields, openForm, openRecord, recordAction, recordIdFromUrl, recordRequests, sqlCount, sqlOne, toasts,
} from './helpers'

test.use(VIEWER)

test('[REC-005] create validates required fields in the browser before any request', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const before = await sqlCount(backend, 'select count(*) as n from person')
  const writes = recordRequests(page, '/data/person')
  await openForm(page, '/app/person/create', 'Create Person')

  for (const [name, label] of [['firstName', 'First Name'], ['lastName', 'Last Name'], ['email', 'Email']]) {
    await expect(page.locator(`label[for="field-${name}"]`)).toHaveText(`${label}*`)
    await expect(control(page, name)).toHaveAttribute('aria-required', 'true')
  }
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('#field-firstName-error')).toHaveText('First Name is required')
  await expect(page.locator('#field-lastName-error')).toHaveText('Last Name is required')
  await expect(page.locator('#field-email-error')).toHaveText('Email is required')
  await expect(control(page, 'firstName')).toHaveAttribute('aria-invalid', 'true')

  await control(page, 'firstName').fill('Only')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('#field-firstName-error')).toHaveCount(0)
  await expect(page.locator('#field-lastName-error')).toHaveText('Last Name is required')
  expect(writes.filter((request) => request.method() === 'POST')).toHaveLength(0)
  expect(await sqlCount(backend, 'select count(*) as n from person')).toBe(before)
})

test('[REC-006] create persists the entered values and opens the new record', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await openForm(page, '/app/person/create', 'Create Person')
  // Non-editable fields (id, create and modify dates) are not offered on create.
  for (const name of ['id', 'createDate', 'modifyDate']) await expect(control(page, name)).toHaveCount(0)

  await control(page, 'firstName').fill('Quinn')
  await control(page, 'lastName').fill('Acceptance')
  await control(page, 'email').fill('quinn@example.invalid')
  await control(page, 'birthDate').fill('1988-07-04')
  await control(page, 'annualSalary').fill('64250.75')
  await control(page, 'daysWorked').fill('321')
  await page.getByRole('checkbox', { name: 'Is Employed' }).click()
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Quinn Acceptance' })).toBeVisible()
  const id = recordIdFromUrl(page, 'person')
  await expect(toasts(page).filter({ hasText: 'Person created successfully.' })).toBeVisible()
  const row = await sqlOne(backend, `select first_name, last_name, email, birth_date, annual_salary, days_worked, is_employed from person where id = ${id}`)
  expect(row).toEqual({ first_name: 'Quinn', last_name: 'Acceptance', email: 'quinn@example.invalid', birth_date: '1988-07-04',
    annual_salary: '64250.75', days_worked: '321', is_employed: 'TRUE' })
  await expect(fieldValue(page, 'annualSalary')).toHaveText('$64,250.75')
  await expect(fieldValue(page, 'isEmployed')).toHaveText('Yes')
})

test('[REC-007] the backend enforces required fields when the UI is bypassed', async ({ backend, diagnostics }) => {
  void diagnostics
  const before = await sqlCount(backend, 'select count(*) as n from field_lab')
  const response = await backend.api.post('/data/fieldLab', { multipart: { longValue: '5' } })
  expect(response.status()).toBe(400)
  expect(await response.json()).toEqual({ error: 'Error inserting Field Lab: Missing value in required field: Name' })
  expect(await sqlCount(backend, 'select count(*) as n from field_lab')).toBe(before)
})

test('[REC-008] cancel leaves create and edit, guarding unsaved changes', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const before = await sqlCount(backend, 'select count(*) as n from person')
  const writes = recordRequests(page, '/data/person')

  // Clean cancel from create returns to the list at once.
  await openForm(page, '/app/person/create', 'Create Person')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page).toHaveURL(/\/app\/person\/?$/)

  // Dirty cancel asks first; Stay keeps the typed value, Leave discards it.
  await openForm(page, '/app/person/create', 'Create Person')
  await control(page, 'firstName').fill('Discard')
  await page.getByRole('button', { name: 'Cancel' }).click()
  const dialog = page.locator('[data-qqq-id="unsaved-changes-dialog"]')
  await expect(dialog).toContainText('You have unsaved changes. Are you sure you want to leave? Your changes will be lost.')
  await dialog.getByRole('button', { name: 'Stay' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(control(page, 'firstName')).toHaveValue('Discard')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.locator('[data-qqq-id="unsaved-changes-dialog"]').getByRole('button', { name: 'Leave' }).click()
  await expect(page).toHaveURL(/\/app\/person\/?$/)

  // Cancel from edit returns to the record view without saving.
  const original = await sqlOne(backend, 'select first_name, modify_date from person where id = 2')
  await openForm(page, '/app/person/2/edit', 'Edit Person')
  await control(page, 'firstName').fill('Changed')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.locator('[data-qqq-id="unsaved-changes-dialog"]').getByRole('button', { name: 'Leave' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Blair Sample' })).toBeVisible()
  expect(recordIdFromUrl(page, 'person')).toBe('2')

  expect(writes.filter((request) => ['POST', 'PUT', 'PATCH'].includes(request.method()))).toHaveLength(0)
  expect(await sqlCount(backend, 'select count(*) as n from person')).toBe(before)
  expect(await sqlOne(backend, 'select first_name, modify_date from person where id = 2')).toEqual(original)
})

test('[REC-009] edit prefills stored values, saves only the change and shows the updated record', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const before = await sqlOne(backend, 'select first_name, last_name, email, birth_date, annual_salary, days_worked, is_employed from person where id = 1')
  const writes = recordRequests(page, '/data/person/1')
  await openRecord(page, 'person', 1, 'Avery Sample')
  await recordAction(page, 'Edit', 'Person')
  await expect(page.getByRole('heading', { level: 2, name: 'Edit Person' })).toBeVisible()

  await expect(control(page, 'firstName')).toHaveValue(before.first_name!)
  await expect(control(page, 'email')).toHaveValue(before.email!)
  await expect(control(page, 'birthDate')).toHaveValue(before.birth_date!)
  await expect(control(page, 'annualSalary')).toHaveValue('75003.5')
  await expect(control(page, 'daysWorked')).toHaveValue(before.days_worked!)
  await expect(page.getByRole('checkbox', { name: 'Is Employed' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()

  await control(page, 'email').fill('avery.updated@example.invalid')
  await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled()
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Avery Sample' })).toBeVisible()
  await expect(fieldValue(page, 'email')).toHaveText('avery.updated@example.invalid')
  await expect(toasts(page).filter({ hasText: 'Person saved successfully.' })).toBeVisible()

  const put = writes.filter((request) => request.method() === 'PUT')
  expect(put).toHaveLength(1)
  // Editable values are re-sent as stored (as the Material dashboard does); only email changed.
  expect(multipartFields(put[0])).toEqual({ firstName: 'Avery', lastName: 'Sample', email: 'avery.updated@example.invalid',
    birthDate: '1990-01-15', isEmployed: 'true', annualSalary: '75003.5', daysWorked: '1001' })
  expect(await sqlOne(backend, 'select first_name, last_name, email, birth_date, annual_salary, days_worked, is_employed from person where id = 1'))
    .toEqual({ ...before, email: 'avery.updated@example.invalid' })
})

test('[REC-010] edit shows non-editable fields read-only and never submits them', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const before = await sqlOne(backend, 'select id, create_date from person where id = 3')
  const writes = recordRequests(page, '/data/person/3')
  await openForm(page, '/app/person/3/edit', 'Edit Person')

  await expect(control(page, 'id')).toHaveValue('3')
  for (const name of ['id', 'createDate', 'modifyDate']) {
    await expect(control(page, name)).toBeDisabled()
    await expect(control(page, name)).toHaveAttribute('aria-readonly', 'true')
  }
  // The creation instant is shown in the viewer's zone (America/New_York).
  const created = new Date(`${before.create_date!.replace(' ', 'T')}Z`)
  const expected = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(created)
  const ymd = `${expected.find((part) => part.type === 'year')!.value}-${expected.find((part) => part.type === 'month')!.value}-${expected.find((part) => part.type === 'day')!.value}`
  await expect(control(page, 'createDate')).toHaveValue(new RegExp(`^${ymd} \\d{2}:\\d{2}:\\d{2} [AP]M E[DS]T$`))

  await control(page, 'daysWorked').fill('100101')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Casey Sample' })).toBeVisible()
  const put = writes.filter((request) => request.method() === 'PUT')
  expect(put).toHaveLength(1)
  const submitted = multipartFields(put[0])
  expect(submitted.daysWorked).toBe('100101')
  for (const name of ['id', 'createDate', 'modifyDate']) expect(submitted).not.toHaveProperty(name)
  const after = await sqlOne(backend, 'select id, create_date, days_worked from person where id = 3')
  expect(after).toEqual({ ...before, days_worked: '100101' })
})

test('[REC-011] editing a missing record shows the load failure instead of a form', async ({ page, diagnostics }) => {
  diagnostics.allow('/data/person/999 404')
  diagnostics.allow('Failed to load resource: the server responded with a status of 404')
  await page.goto('/app/person/999/edit', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('alert').filter({ hasText: 'could not be found' })).toHaveText('Person 999 could not be found.')
  await expect(page.locator('form')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0)
  expect(diagnostics.failedRequests).toEqual(['GET /data/person/999 404'])
})

test('[REC-012] delete confirms, removes the record and returns to the list without error noise', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const reads = recordRequests(page, '/data/person/5')
  await openRecord(page, 'person', 5, 'Morgan Sample')

  // Cancel keeps the record.
  await recordAction(page, 'Delete', 'Person')
  const dialog = page.locator('[data-qqq-id="delete-confirm-dialog"]')
  await expect(dialog).toContainText('Are you sure you want to delete Morgan Sample? This action cannot be undone.')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)
  expect(await sqlCount(backend, 'select count(*) as n from person where id = 5')).toBe(1)

  await recordAction(page, 'Delete', 'Person')
  await page.locator('[data-qqq-id="delete-confirm-dialog"]').getByRole('button', { name: 'Delete' }).click()
  await expect(page).toHaveURL(/\/app\/person\/?$/)
  const grid = page.getByRole('grid', { name: 'Person records' })
  await expect(grid.getByRole('gridcell', { name: 'Avery', exact: true })).toBeVisible()
  await expect(grid.getByRole('gridcell', { name: 'Morgan', exact: true })).toHaveCount(0)
  await expect(toasts(page).filter({ hasText: 'Morgan Sample deleted successfully.' })).toBeVisible()

  // #541: the deleted record is never read again, so no 404 and no "Resource not found".
  await expect(toasts(page).filter({ hasText: 'Resource not found' })).toHaveCount(0)
  const methods = reads.map((request) => request.method())
  expect(methods.at(-1)).toBe('DELETE')
  expect(methods.filter((method) => method === 'DELETE')).toHaveLength(1)
  expect(methods.slice(0, -1).every((method) => method === 'GET')).toBe(true)
  expect(await sqlCount(backend, 'select count(*) as n from person where id = 5')).toBe(0)
})

test('[REC-013] copy prefills a new record and saves it separately from the source', async ({ page, backend, diagnostics }) => {
  diagnostics.allow('/data/recordLab 400')
  diagnostics.allow('Failed to load resource: the server responded with a status of 400')
  const source = await sqlOne(backend, 'select first_name, last_name, email, birth_date, annual_salary, days_worked, is_employed, modify_date from person where id = 1')
  await openRecord(page, 'person', 1, 'Avery Sample')
  await recordAction(page, 'Copy', 'Person')
  await expect(page.getByRole('heading', { level: 2, name: 'Copy Person' })).toBeVisible()
  await expect(control(page, 'firstName')).toHaveValue('Avery')
  await expect(control(page, 'email')).toHaveValue('avery@example.invalid')
  await expect(control(page, 'id')).toHaveCount(0)
  await control(page, 'firstName').fill('Avery Copy')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Avery Copy Sample' })).toBeVisible()
  const id = recordIdFromUrl(page, 'person')
  expect(id).not.toBe('1')
  expect(await sqlOne(backend, `select first_name, last_name, email, birth_date, annual_salary, days_worked, is_employed from person where id = ${id}`))
    .toEqual({ first_name: 'Avery Copy', last_name: source.last_name, email: source.email, birth_date: source.birth_date,
      annual_salary: source.annual_salary, days_worked: source.days_worked, is_employed: source.is_employed })
  expect(await sqlOne(backend, 'select first_name, last_name, email, birth_date, annual_salary, days_worked, is_employed, modify_date from person where id = 1')).toEqual(source)

  // Copying without changing the unique title is refused by the backend; the form keeps its values.
  const labCount = await sqlCount(backend, 'select count(*) as n from record_lab')
  await openForm(page, '/app/recordLab/1/copy', 'Copy Record Lab')
  await expect(control(page, 'title')).toHaveValue('Alpha')
  await expect(page.locator('[data-qqq-id="attachment-current-file"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Error inserting Record Lab: Another record already exists with this Title' })).toBeVisible()
  await expect(control(page, 'title')).toHaveValue('Alpha')
  expect(await sqlCount(backend, 'select count(*) as n from record_lab')).toBe(labCount)

  await control(page, 'title').fill('Alpha Copy')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Lab: Alpha Copy' })).toBeVisible()
  const copy = await sqlOne(backend, "select status, owner_id, website, config, api_token, attachment, attachment_name, hidden_code from record_lab where title = 'Alpha Copy'")
  // Base copy copies editable values; the download-URL file and hidden values are not copied.
  expect(copy).toEqual({ status: 'ACTIVE', owner_id: '1', website: 'https://example.invalid/alpha', config: '{"enabled":true,"limit":3}',
    api_token: 'tok-alpha-123', attachment: null, attachment_name: null, hidden_code: null })
})
