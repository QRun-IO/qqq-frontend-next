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

/** Exercises declared sample associations through real pages, HTTP and independent SQL. */
export async function checkSampleAssociations({ page, baseUrl, samplePort, apiPrefix, output, evidence, mode }) {
  const denied = mode === 'association-denied'
  const named = mode === 'association-named'
  const snapshot = async () => {
    const response = await fetch(`http://127.0.0.1:${samplePort}/acceptance/write-state`)
    assert.equal(response.status, 200)
    return response.json()
  }
  const panel = (name) => page.locator(`[data-qqq-id="associated-records-${encodeURIComponent(name)}"]:visible`)
  const before = await snapshot()
  evidence.before = before
  await page.goto(`${baseUrl}/app/person/1?tab=related`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await panel('pets').waitFor({ timeout: 45000 })
  const metadataResponse = await page.request.get(`${baseUrl}${apiPrefix}/qqq/v1/metaData/table/person`)
  assert.equal(metadataResponse.status(), 200)
  const metadata = await metadataResponse.json()
  assert.equal(metadata.exposedJoins?.length ?? 0, 0)
  assert.ok(metadata.associations.some((association) => association.name === 'pets' && association.associatedTableName === 'pet'))
  evidence.associationMetadata = metadata.associations
  if (denied) {
    await page.getByText('Related records could not be loaded.', { exact: true }).waitFor()
    await panel('pets').getByText('Related records are unavailable.', { exact: true }).waitFor()
    assert.equal(await panel('pets').getByText('Charlie', { exact: true }).count(), 0)
    assert.equal(await panel('pets').getByRole('link', { name: 'View All', exact: true }).count(), 0)
  } else {
    await panel('pets').getByText('Charlie', { exact: true }).waitFor()
    const href = await panel('pets').getByRole('link', { name: 'View All', exact: true }).getAttribute('href')
    const filter = JSON.parse(Buffer.from(new URL(href, baseUrl).searchParams.get('filter'), 'base64').toString('utf8'))
    assert.deepEqual(filter.criteria, [{ fieldName: 'personId', operator: 'EQUALS', values: [1] }])
  }
  await page.screenshot({ path: path.join(output, 'canonical-pets.png'), fullPage: true })

  if (!denied && !named) {
    await page.goto(`${baseUrl}/app/person/4?tab=related`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await panel('pets').getByText(/^No .* records$/).waitFor({ timeout: 45000 })
    assert.equal(await panel('pets').getByText('Related records are unavailable.', { exact: true }).count(), 0)
    const emptyResponse = await page.request.get(`${baseUrl}${apiPrefix}/data/person/4?includeAssociations=true`)
    assert.equal(emptyResponse.status(), 200)
    assert.deepEqual((await emptyResponse.json()).associatedRecords.pets, [])
    evidence.checks.push('Canonical pets association displays Charlie without exposed joins; a successful empty pets group is distinct from unavailable')
    await page.screenshot({ path: path.join(output, 'empty-pets.png'), fullPage: true })
    await page.goto(`${baseUrl}/app/person/1?tab=related`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  }

  let associationName = 'pets'
  if (named) {
    assert.equal(before.person[0].days_worked, '2')
    assert.deepEqual(metadata.associations.map((association) => association.name), ['pets', 'care group / primary', 'scheduled reviews'])
    await page.goto(`${baseUrl}/app/person/1?tab=section-fieldGuide`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await panel('care group / primary').getByText('Charlie', { exact: true }).waitFor({ timeout: 45000 })
    assert.equal(await panel('pets').count(), 0)
    await page.screenshot({ path: path.join(output, 'explicit-widget-section.png'), fullPage: true })
    await page.getByRole('radio', { name: 'List view', exact: true }).click()
    await panel('pets').getByText('Charlie', { exact: true }).waitFor()
    await panel('care group / primary').getByText('Charlie', { exact: true }).waitFor()
    assert.equal(await panel('care group / primary').count(), 1)
    assert.equal(await panel('scheduled reviews').count(), 1)
    associationName = 'scheduled reviews'
    await panel(associationName).getByText(/^No .* records$/).waitFor()
    await page.screenshot({ path: path.join(output, 'named-list-layout.png'), fullPage: true })
    evidence.checks.push('Two arbitrary association names share Pet and one repeats the canonical join; exact widget bindings place each panel once in card/list layouts')
  }

  const target = panel(associationName)
  evidence.possibleValueSearch = []
  for (const [query, expected] of [['searchTerm=Do', { id: 1, label: 'Dog' }], ['ids=2', { id: 2, label: 'Cat' }]]) {
    const response = await page.request.get(`${baseUrl}${apiPrefix}/data/pet/possibleValues/speciesId?${query}`)
    assert.equal(response.status(), 200)
    const result = await response.json()
    assert.deepEqual(result.options.map(({ id, label }) => ({ id, label })), [expected])
    evidence.possibleValueSearch.push({ query, result })
  }
  await target.locator(`[data-qqq-id="button-create-association-${encodeURIComponent(associationName)}"]`).click()
  const dialog = page.locator(`[data-qqq-id="dialog-create-association-${encodeURIComponent(associationName)}"]`)
  await dialog.waitFor()
  assert.equal(await dialog.locator('input[name="personId"]').count(), 0)
  if (named) assert.equal(await dialog.locator('input[name="birthDate"]').count(), 0)
  const name = named ? 'Composite Browser Pet' : denied ? 'Private Browser Pet' : 'Canonical Browser Pet'
  await dialog.getByRole('textbox', { name: /^Name/ }).fill(name)
  await dialog.getByRole('combobox', { name: /Species/ }).click()
  const noMatchResponse = page.waitForResponse((response) => new URL(response.url()).pathname === `${apiPrefix}/data/pet/possibleValues/speciesId`
    && new URL(response.url()).searchParams.get('searchTerm') === 'NoMatchingSpecies')
  await page.getByRole('textbox', { name: 'Search Species options' }).fill('NoMatchingSpecies')
  const noMatch = await noMatchResponse
  assert.equal(noMatch.status(), 200)
  evidence.emptyPossibleValues = await noMatch.json()
  assert.deepEqual(evidence.emptyPossibleValues, {})
  await dialog.getByText('No options found', { exact: true }).waitFor()
  assert.equal(await dialog.getByText('Options could not be loaded.', { exact: true }).count(), 0)
  await page.getByRole('textbox', { name: 'Search Species options' }).fill('Do')
  await page.getByRole('option', { name: 'Dog', exact: true }).click()
  const save = page.waitForResponse((response) => response.request().method() === 'POST'
    && new URL(response.url()).pathname === `${apiPrefix}/data/pet`)
  await dialog.getByRole('button', { name: 'Create', exact: true }).click()
  const response = await save
  evidence.insertResponse = await response.json()
  assert.equal(response.status(), 200)
  assert.equal(evidence.insertResponse.records.length, 1)
  assert.equal(evidence.insertResponse.records[0].errors?.length ?? 0, 0)
  await dialog.waitFor({ state: 'hidden' })
  const after = await snapshot()
  evidence.after = after
  const row = after.pet.find((pet) => pet.name === name)
  assert.ok(row)
  assert.equal(after.pet.length, before.pet.length + 1)
  assert.equal(row.person_id, named ? '2' : '1')
  assert.equal(row.species_id, '1')
  assert.equal(row.birth_date, named ? '1990-01-15' : null)
  assert.deepEqual(after.person, before.person)
  assert.deepEqual(after.pet.filter((pet) => pet.id !== row.id), before.pet)
  if (denied) {
    await target.getByText('Related records are unavailable.', { exact: true }).waitFor()
    assert.equal(await target.getByText(name, { exact: true }).count(), 0)
    evidence.checks.push('Canonical Add uses full child INSERT metadata despite denied READ; actual POST and SQL prove the linked row, without disclosing child data')
  } else {
    await target.getByText(name, { exact: true }).waitFor()
    evidence.checks.push(named
      ? 'Composite non-primary relationship values survive actual multipart INSERT: stored owner2 differs from parent primary key1, and birth_date equals the parent date; all existing SQL rows remain unchanged'
      : 'Canonical Add persists the intended Pet owner via actual multipart INSERT; parent and existing child SQL rows remain unchanged')
  }
  if (named) {
    await page.setViewportSize({ width: 390, height: 844 })
    await target.getByText(name, { exact: true }).waitFor()
    evidence.mobileLayout = await page.evaluate(() => ({
      width: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflowing: Array.from(document.querySelectorAll('body *')).filter((element) => {
        const bounds = element.getBoundingClientRect()
        return bounds.width > 0 && bounds.right > window.innerWidth + 1
      }).sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right).slice(0, 15).map((element) => ({
        tag: element.tagName, id: element.getAttribute('data-qqq-id'), className: element.className, right: element.getBoundingClientRect().right,
        visibility: getComputedStyle(element).visibility,
        ancestors: [element.parentElement, element.parentElement?.parentElement, element.parentElement?.parentElement?.parentElement].filter(Boolean)
          .map((parent) => ({ tag: parent.tagName, className: parent.className, right: parent.getBoundingClientRect().right,
            scrollWidth: parent.scrollWidth, clientWidth: parent.clientWidth, overflowX: getComputedStyle(parent).overflowX })),
      })),
    }))
    await page.screenshot({ path: path.join(output, 'named-mobile-layout.png'), fullPage: true })
    assert.equal(evidence.mobileLayout.scrollWidth, evidence.mobileLayout.width, 'Related grids must scroll within the mobile page, without widening the page itself')
    const href = await target.getByRole('link', { name: 'View All', exact: true }).getAttribute('href')
    const filter = JSON.parse(Buffer.from(new URL(href, baseUrl).searchParams.get('filter'), 'base64').toString('utf8'))
    assert.deepEqual(filter.criteria, [
      { fieldName: 'personId', operator: 'EQUALS', values: [2] },
      { fieldName: 'birthDate', operator: 'EQUALS', values: ['1990-01-15'] },
    ])
    assert.equal(filter.booleanOperator, 'AND')
  }
  await page.screenshot({ path: path.join(output, 'linked-child-created.png'), fullPage: true })
}
