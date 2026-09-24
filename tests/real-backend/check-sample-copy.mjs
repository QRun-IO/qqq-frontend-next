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

/** Checks real copy pages against the packaged sample and independent SQL snapshots. */
export async function checkSampleCopy({ page, baseUrl, samplePort, apiPrefix, output, evidence, mode }) {
  const snapshot = async () => {
    const response = await fetch(`http://127.0.0.1:${samplePort}/acceptance/write-state`)
    assert.equal(response.status, 200)
    return response.json()
  }
  const before = await snapshot()
  evidence.before = before
  const denied = mode === 'copy-denied'
  const empty = mode === 'copy-empty'
  const named = mode === 'copy-named'
  const sourceId = empty ? 4 : 1
  let inserts = 0
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === `${apiPrefix}/data/person`) inserts++
  })
  const form = page.locator(`[data-qqq-id="entity-copy-person-${sourceId}"]`)
  const node = (...parts) => page.locator(`[data-qqq-id="copy-node-${encodeURIComponent(JSON.stringify(parts))}"]`)
  const open = async () => {
    await page.goto(`${baseUrl}/app/person/${sourceId}/copy`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await form.getByRole('textbox', { name: /First Name/ }).waitFor({ timeout: 45000 })
  }
  const submit = async () => {
    const response = page.waitForResponse(response => response.request().method() === 'POST'
      && new URL(response.url()).pathname === `${apiPrefix}/data/person`)
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    const saved = await response
    const body = await saved.json()
    assert.equal(saved.status(), 200, JSON.stringify(body))
    assert.equal(body.records.length, 1)
    assert.equal(body.records[0].errors?.length ?? 0, 0)
    const id = body.records[0].values.id
    assert.ok(Number.isInteger(id) && id > 5)
    await page.waitForURL(`${baseUrl}/app/person/${id}`)
    return { id, body }
  }
  await open()
  assert.equal(await form.getByRole('radio', { name: 'Base copy', exact: true }).isChecked(), true)
  await form.getByRole('textbox', { name: /First Name/ }).fill('Base Browser Copy')
  const base = await submit()
  const afterBase = await snapshot()
  assert.equal(afterBase.person.length, before.person.length + 1)
  assert.equal(afterBase.person.find(row => row.id === String(base.id)).first_name, 'Base Browser Copy')
  assert.deepEqual(afterBase.person.filter(row => row.id !== String(base.id)), before.person)
  assert.deepEqual(afterBase.pet, before.pet)
  assert.deepEqual(afterBase.pet_note, before.pet_note)
  evidence.base = { ...base, state: afterBase }
  evidence.checks.push('Base Copy creates a fresh parent and leaves every existing parent, child and grandchild unchanged')

  await open()
  const expandedResponse = page.waitForResponse(response => new URL(response.url()).pathname === `${apiPrefix}/data/person/${sourceId}`
    && new URL(response.url()).searchParams.get('includeAssociations') === 'true', { timeout: 45000 })
  await form.getByRole('radio', { name: 'Full copy', exact: true }).click()
  const expanded = await expandedResponse
  assert.equal(expanded.status(), denied ? 403 : 200)
  evidence.expandedReadStatus = expanded.status()
  if (denied) {
    await form.getByRole('alert').first().waitFor({ timeout: 45000 })
    assert.match(await form.getByRole('alert').first().innerText(), /You do not have access to all the information needed for Full Copy\. Choose Base Copy to copy this record only\./)
    assert.equal(await form.getByRole('button', { name: 'Save', exact: true }).isDisabled(), true)
    await form.locator('form').evaluate(element => element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    assert.equal(inserts, 1)
    assert.deepEqual(await snapshot(), afterBase)
    await page.setViewportSize({ width: 390, height: 844 })
    await form.getByRole('radio', { name: 'Full copy', exact: true }).scrollIntoViewIfNeeded()
    const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }))
    assert.equal(size.scroll, size.width, 'Copy permission guidance must remain within a mobile viewport')
    evidence.mobile = size
    await page.screenshot({ path: path.join(output, 'full-copy-denied.png'), fullPage: true })
    await page.screenshot({ path: path.join(output, 'full-copy-denied-mobile.png') })
    evidence.checks.push('Denied grandchild READ blocks Full Copy and forced submit before any INSERT; Base Copy remains available')
    return
  }
  if (empty) {
    await form.getByText('No associated records to copy.', { exact: true }).waitFor({ timeout: 45000 })
  } else {
    const note = node('pets', 0, 'notes', 0)
    await note.getByRole('textbox', { name: /^Note/ }).waitFor({ timeout: 45000 })
    assert.equal(await note.locator('input[name="petId"]').count(), 0)
    assert.equal(await node('pets', 0).locator(':scope > div input[name="personId"]').count(), 0)
    await note.getByRole('textbox', { name: /^Note/ }).fill('')
    await form.getByRole('alert').first().waitFor()
    await form.locator('form').evaluate(element => element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    assert.equal(inserts, 1)
    assert.deepEqual(await snapshot(), afterBase)
    await note.getByRole('textbox', { name: /^Note/ }).fill('Copied browser note')
  }
  await form.getByRole('textbox', { name: /First Name/ }).fill('Full Browser Copy')
  await page.setViewportSize({ width: 390, height: 844 })
  await form.getByRole('radio', { name: 'Full copy', exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(output, 'full-copy-mobile.png') })
  if (!empty) {
    await node('pets', 0, 'notes', 0).getByRole('textbox', { name: /^Note/ }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(output, 'full-copy-note-mobile.png') })
  }
  if (named) {
    await node('care group / primary', 0, 'notes', 0).getByRole('textbox', { name: /^Note/ }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(output, 'full-copy-alias-mobile.png') })
  }
  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }))
  assert.equal(size.scroll, size.width, 'Full Copy must remain within a mobile viewport')
  evidence.mobile = size
  const full = await submit()
  const afterFull = await snapshot()
  assert.equal(inserts, 2)
  assert.equal(afterFull.person.length, before.person.length + 2)
  assert.equal(afterFull.person.find(row => row.id === String(full.id)).first_name, 'Full Browser Copy')
  assert.deepEqual(afterFull.person.filter(row => row.id !== String(full.id)), afterBase.person)
  const originalRowsUnchanged = (table) => assert.deepEqual(afterFull[table].filter(row => before[table].some(original => original.id === row.id)), before[table])
  originalRowsUnchanged('pet')
  originalRowsUnchanged('pet_note')
  const newPets = afterFull.pet.filter(row => row.person_id === String(full.id))
  const newNotes = afterFull.pet_note.filter(row => newPets.some(pet => pet.id === row.pet_id))
  const copies = named ? 2 : 1
  assert.equal(newPets.length, empty ? 0 : 4 * copies)
  assert.equal(newNotes.length, empty ? 0 : copies)
  assert.equal(afterFull.pet.length, before.pet.length + newPets.length)
  assert.equal(afterFull.pet_note.length, before.pet_note.length + newNotes.length)
  if (!empty) {
    assert.deepEqual(newPets.map(row => row.name).sort(), Array.from({ length: copies }, () => ['Charlie', 'Coco', 'Louie', 'Barkley']).flat().sort())
    for (const note of newNotes) {
      assert.equal(note.payload, 'AAH/gEEA')
      assert.equal(note.file_name, 'sample.bin')
      assert.equal(note.flag, 'FALSE')
      assert.ok(Number(note.id) > 2)
      assert.ok(Number(note.pet_id) > 6)
    }
    assert.equal(newNotes.filter(note => note.note === 'Copied browser note').length, 1)
    if (named) assert.equal(newNotes.filter(note => note.note === 'Target note').length, 1)
  }
  evidence.full = { ...full, state: afterFull }
  evidence.checks.push(empty
    ? 'Full Copy preserves the explicit empty pets group and creates no child records'
    : 'Full Copy creates fresh parent, child and grandchild identities, preserves exact binary bytes and filename, and retains independent original SQL rows')
  if (named) evidence.checks.push('An arbitrary named alias copies the shared source tree independently, with separate descendant identities and edits')
  await page.screenshot({ path: path.join(output, 'full-copy-saved.png'), fullPage: true })
}
