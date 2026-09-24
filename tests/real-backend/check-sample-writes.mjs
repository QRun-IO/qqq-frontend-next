/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import assert from 'node:assert/strict'
import path from 'node:path'

/** Runs real browser CRUD against the owned sample, with independent SQL snapshots. */
export async function checkSampleWrites({ page, baseUrl, samplePort, apiPrefix, output, evidence }) {
  const snapshot = async () => {
    const response = await fetch(`http://127.0.0.1:${samplePort}/acceptance/write-state`)
    assert.equal(response.status, 200)
    return response.json()
  }
  const before = await snapshot()
  evidence.before = before
  assert.equal(before.person.length, 5)
  assert.equal(before.person[0].birth_date, '1990-01-15')
  await page.goto(`${baseUrl}/app/person/1/edit`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  const form = page.locator('[data-qqq-id="entity-edit-person-1"]')
  await form.getByRole('textbox', { name: /First Name/ }).waitFor({ timeout: 45000 })
  const metadataResponse = await page.request.get(`${baseUrl}${apiPrefix}/qqq/v1/metaData/table/person`)
  assert.equal(metadataResponse.status(), 200)
  const metadata = await metadataResponse.json()
  const instanceResponse = await page.request.get(`${baseUrl}${apiPrefix}/qqq/v1/metaData`)
  assert.equal(instanceResponse.status(), 200)
  const instance = await instanceResponse.json()
  evidence.presentation = { branding: instance.branding ?? null, appTree: instance.appTree }
  evidence.limitations = ['#539: v1 omits branding; Next uses its default identity', '#538: Next app/section icons do not preserve declared v1 icons']
  const sidebar = page.locator('[data-qqq-id="sidebar"]')
  const peopleLink = sidebar.getByRole('link', { name: 'People App', exact: true })
  const expandPeople = sidebar.getByRole('button', { name: 'Expand People App', exact: true })
  if (await expandPeople.count()) await expandPeople.click()
  const peopleGroup = peopleLink.locator('xpath=ancestor::li[1]')
  await peopleGroup.getByRole('link', { name: 'Greetings App', exact: true }).waitFor({ state: 'visible' })
  const identity = form.locator('[data-qqq-id="form-section-identity"]')
  assert.equal(await identity.getByRole('heading', { name: 'Identity', exact: true }).count(), 1)
  assert.deepEqual(await identity.locator('input[name]').evaluateAll((inputs) => inputs.map((input) => input.name)), ['firstName', 'lastName'])
  evidence.checks.push('Live People/Greetings navigation labels and ordered Identity section render from canonical sample metadata; branding/icon limitations remain explicit')
  for (const field of ['id', 'createDate', 'modifyDate']) {
    assert.equal(metadata.fields[field].isEditable, false)
    assert.equal(await form.locator(`input[name="${field}"]`).count(), 0)
  }
  let updateRequests = 0
  const countUpdates = (request) => { if (request.method() === 'PUT') updateRequests++ }
  page.on('request', countUpdates)
  await form.locator('form').evaluate((element) => {
    element.addEventListener('invalid', () => { element.dataset.acceptanceInvalid = 'true' }, true)
  })
  for (const [name, input, original] of [['annualSalary', '1e', '75003.50'], ['daysWorked', '-', '1001']]) {
    const number = form.locator(`input[name="${name}"]`)
    await form.locator('form').evaluate((element) => { delete element.dataset.acceptanceInvalid })
    await number.fill('')
    await number.pressSequentially(input)
    assert.equal(await number.evaluate((element) => element.validity.badInput), true)
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    const invalid = await form.locator('form').getAttribute('data-acceptance-invalid')
    if (invalid !== 'true') {
      await page.waitForURL(`${baseUrl}/app/person/1`)
      evidence.invalidNumericWrite = { name, input, state: await snapshot() }
    }
    assert.equal(invalid, 'true', 'A malformed number must be rejected before a save can clear its stored value')
    assert.equal(updateRequests, 0)
    assert.deepEqual(await snapshot(), before)
    await number.fill(original)
  }
  page.off('request', countUpdates)
  evidence.checks.push('Malformed optional numeric inputs 1e and - are blocked before HTTP; independent SQL snapshots remain identical')
  const denied = await page.request.get(`${baseUrl}${apiPrefix}/data/person/1?includeAssociations=true`)
  assert.equal(denied.status(), 403)
  await form.getByRole('textbox', { name: /First Name/ }).fill('Avery Updated')
  await form.locator('input[name="birthDate"]').fill('')
  const updatedResponse = page.waitForResponse((response) => response.request().method() === 'PUT'
    && new URL(response.url()).pathname === `${apiPrefix}/data/person/1`)
  await form.getByRole('button', { name: 'Save', exact: true }).click()
  assert.equal((await updatedResponse).status(), 200)
  await page.waitForURL(`${baseUrl}/app/person/1`, { timeout: 15000 })
  const edited = await snapshot()
  assert.equal(edited.person[0].first_name, 'Avery Updated')
  assert.equal(edited.person[0].birth_date, null)
  assert.deepEqual(edited.pet, before.pet)
  assert.deepEqual(edited.person.slice(1), before.person.slice(1))
  const unaffected = (record) => Object.fromEntries(Object.entries(record)
    .filter(([field]) => !['first_name', 'birth_date', 'modify_date'].includes(field)))
  assert.deepEqual(unaffected(edited.person[0]), unaffected(before.person[0]))
  evidence.afterEdit = edited
  await page.screenshot({ path: path.join(output, 'person-edited.png'), fullPage: true })

  await page.goto(`${baseUrl}/app/person/create`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  const createForm = page.locator('[data-qqq-id="entity-create-person"]')
  await createForm.getByRole('textbox', { name: /First Name/ }).fill('Browser')
  for (const field of ['id', 'createDate', 'modifyDate']) {
    assert.equal(await createForm.locator(`input[name="${field}"]`).count(), 0)
  }
  await createForm.getByRole('textbox', { name: /Last Name/ }).fill('Acceptance')
  await createForm.getByRole('textbox', { name: /Email/ }).fill('browser@example.invalid')
  await createForm.locator('input[name="birthDate"]').fill('2020-01-02')
  const createdResponse = page.waitForResponse((response) => response.request().method() === 'POST'
    && new URL(response.url()).pathname === `${apiPrefix}/data/person`)
  await createForm.getByRole('button', { name: 'Save', exact: true }).click()
  const created = await createdResponse
  assert.equal(created.status(), 200)
  const response = await created.json()
  assert.equal(response.records.length, 1)
  const id = response.records[0].values.id
  assert.ok(Number.isInteger(id) && id > 5)
  await page.waitForURL(`${baseUrl}/app/person/${id}`)
  const inserted = await snapshot()
  assert.equal(inserted.person.length, 6)
  const newPerson = inserted.person.find((person) => person.id === String(id))
  assert.equal(newPerson.first_name, 'Browser')
  assert.equal(newPerson.last_name, 'Acceptance')
  assert.equal(newPerson.email, 'browser@example.invalid')
  assert.equal(newPerson.birth_date, '2020-01-02')
  assert.equal(newPerson.annual_salary, null)
  assert.equal(newPerson.days_worked, null)
  assert.deepEqual(inserted.person.filter((person) => person.id !== String(id)), edited.person)
  assert.deepEqual(inserted.pet, before.pet)
  evidence.afterCreate = inserted
  evidence.createdId = id
  await page.screenshot({ path: path.join(output, 'person-created.png'), fullPage: true })

  const menu = page.getByRole('button', { name: 'Record actions menu', exact: true })
  if (await menu.count()) {
    await menu.click()
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
  } else {
    await page.getByRole('button', { name: 'Delete Person record', exact: true }).click()
  }
  const dialog = page.getByRole('dialog', { name: 'Delete Person', exact: true })
  await dialog.waitFor()
  const deletedResponse = page.waitForResponse((response) => response.request().method() === 'DELETE'
    && new URL(response.url()).pathname === `${apiPrefix}/data/person/${id}`)
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
  const deleted = await deletedResponse
  assert.equal(deleted.status(), 200)
  assert.equal((await deleted.json()).deletedRecordCount, 1)
  await page.waitForURL(`${baseUrl}/app/person`)
  const after = await snapshot()
  assert.deepEqual(after, edited)
  evidence.afterDelete = after
  evidence.checks.push('Real Person metadata marks id/createDate/modifyDate non-editable; create/edit forms omit their inputs and SQL readback preserves id/createDate after an allowed edit')
  await page.screenshot({ path: path.join(output, 'person-deleted.png'), fullPage: true })
  evidence.checks.push('Real browser base edit with child READ denied; SQL confirms explicit date clear and every child unchanged')
  evidence.checks.push('Real browser CREATE and DELETE use legacy multipart/envelopes under a deployment prefix; SQL confirms insertion then deletion with seeded rows unchanged')
  if (await expandPeople.count()) await expandPeople.click()
  await peopleGroup.getByRole('link', { name: 'Greetings App', exact: true }).click()
  await page.locator('[data-qqq-id="app-home-greetingsApp"]').getByRole('heading', { name: 'Greetings App', exact: true, level: 1 }).waitFor({ state: 'visible' })
  assert.equal(page.url(), `${baseUrl}/app/greetingsApp`)
  assert.deepEqual(await snapshot(), after)
  await page.screenshot({ path: path.join(output, 'nested-app.png'), fullPage: true })
  evidence.checks.push('Nested Greetings App link opens its app dashboard and leaves all sample rows unchanged')
}
