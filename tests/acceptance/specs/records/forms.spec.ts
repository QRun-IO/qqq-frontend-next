/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, test } from '../../support/fixtures'
import { VIEWER, control, fieldValue, multipartFields, openForm, openRecord, recordIdFromUrl, recordRequests, sqlCount, sqlOne } from './helpers'

test.use(VIEWER)

test('[REC-045] possible-value editors show stored labels, look up defaults and select by keyboard @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  // Edit shows labels of the stored ids, not the ids.
  await openForm(page, '/app/recordLab/1/edit', 'Edit Record Lab')
  await expect(control(page, 'status')).toHaveText(/^Active/)
  await expect(control(page, 'ownerId')).toHaveText(/^Avery Sample/)

  // Create: the metadata default id is shown with its label.
  const writes = recordRequests(page, '/data/recordLab')
  await openForm(page, '/app/recordLab/create', 'Create Record Lab')
  await expect(control(page, 'status')).toHaveText(/^Draft/)
  await control(page, 'title').fill('Keyboard Pick')

  // Keyboard only: focus the owner combobox, open it, search, choose with Enter.
  await control(page, 'ownerId').focus()
  await page.keyboard.press('Enter')
  const search = page.getByRole('textbox', { name: 'Search Owner options' })
  await expect(search).toBeFocused()
  await page.keyboard.type('Casey')
  await expect(page.getByRole('listbox', { name: 'Owner options' }).getByRole('option')).toHaveText(['Casey Sample'])
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(control(page, 'ownerId')).toHaveText(/^Casey Sample/)
  await expect(control(page, 'ownerId')).toBeFocused()
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Lab: Keyboard Pick' })).toBeVisible()
  const id = recordIdFromUrl(page, 'recordLab')
  const post = multipartFields(writes.find((request) => request.method() === 'POST')!)
  expect(post.ownerId).toBe('3')
  expect(post.status).toBe('DRAFT')
  expect(await sqlOne(backend, `select owner_id, status from record_lab where id = ${id}`)).toEqual({ owner_id: '3', status: 'DRAFT' })
  await expect(fieldValue(page, 'ownerId')).toHaveText('Casey Sample')
})

test.describe('read-only persona', () => {
  test.use({ persona: 'viewer' })

  test('[REC-046] a read-only user has no write actions and the backend refuses writes @mobile', async ({ page, backend, diagnostics }) => {
    diagnostics.allow('Failed to load resource: the server responded with a status of 403')
    const before = await sqlOne(backend, 'select first_name, email from person where id = 1')
    const count = await sqlCount(backend, 'select count(*) as n from person')
    await openRecord(page, 'person', 1, 'Avery Sample')
    for (const action of ['Edit', 'Copy', 'Delete']) {
      await expect(page.getByRole('button', { name: `${action} Person record` })).toHaveCount(0)
    }
    await expect(page.getByRole('button', { name: 'Record actions menu' })).toHaveCount(0)
    // Phone: no Actions trigger opening an empty sheet either
    await expect(page.getByRole('button', { name: 'Record actions', exact: true })).toHaveCount(0)

    await page.goto('/app/person/1/edit', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('alert').filter({ hasText: 'permission' })).toHaveText('You do not have permission to edit Person records.')
    await expect(control(page, 'firstName')).toHaveCount(0)
    await page.goto('/app/person/create', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('alert').filter({ hasText: 'permission' })).toHaveText('You do not have permission to create Person records.')
    await page.goto('/app/person/1/copy', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('alert').filter({ hasText: 'permission' })).toHaveText('You do not have permission to create Person records.')

    const insert = await backend.api.post('/data/person', { multipart: { firstName: 'No', lastName: 'Access', email: 'no@example.invalid' } })
    const update = await backend.api.put('/data/person/1', { multipart: { email: 'changed@example.invalid' } })
    const remove = await backend.api.delete('/data/person/1')
    expect([insert.status(), update.status(), remove.status()]).toEqual([403, 403, 403])
    expect(await sqlCount(backend, 'select count(*) as n from person')).toBe(count)
    expect(await sqlOne(backend, 'select first_name, email from person where id = 1')).toEqual(before)
  })
})

test('[REC-047] record forms are labelled and fully keyboard operable @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await openForm(page, '/app/person/create', 'Create Person')
  for (const [name, label] of [['firstName', 'First Name'], ['lastName', 'Last Name'], ['email', 'Email'], ['birthDate', 'Birth Date'],
    ['annualSalary', 'Annual Salary'], ['daysWorked', 'Days Worked']]) {
    await expect(page.getByLabel(label, { exact: false }).first()).toHaveAttribute('id', `field-${name}`)
  }
  await expect(page.getByRole('checkbox', { name: 'Is Employed' })).toBeVisible()

  // Keyboard only, from the first field to Save.
  await control(page, 'firstName').focus()
  await page.keyboard.type('Kay')
  await page.keyboard.press('Tab')
  await expect(control(page, 'lastName')).toBeFocused()
  await page.keyboard.type('Board')
  await page.keyboard.press('Tab')
  await expect(control(page, 'email')).toBeFocused()
  await page.keyboard.press('Enter')
  // Submitting with Enter validates: the missing email is reported and described.
  await expect(control(page, 'email')).toHaveAttribute('aria-invalid', 'true')
  await expect(control(page, 'email')).toHaveAttribute('aria-describedby', /field-email-error/)
  await expect(page.locator('#field-email-error')).toHaveText('Email is required')
  await page.keyboard.type('kay@example.invalid')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Kay Board' })).toBeVisible()
  const id = recordIdFromUrl(page, 'person')
  expect(await sqlOne(backend, `select first_name, last_name, email from person where id = ${id}`)).toEqual({ first_name: 'Kay', last_name: 'Board', email: 'kay@example.invalid' })
})
