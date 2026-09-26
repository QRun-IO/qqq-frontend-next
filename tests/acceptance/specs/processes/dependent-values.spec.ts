/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import type { APIResponse, Request } from '@playwright/test'
import { expect, test } from '../../support/fixtures'
import { advance, choosePossibleValue, expectScreen, openProcess, viewValue } from './process-helpers'

// The pick screen's Specimen field uses the prcSpecimen source filtered on category = ${input.category}.
const PROCESS = 'prcSpecimenPick'
const SPECIMEN_SEARCH = `/processes/${PROCESS}/possibleValues/specimenId`

/** Option labels of a possible-value response (an empty list serializes as `{}`). */
async function labels(response: APIResponse): Promise<string[]> {
  expect(response.status()).toBe(200)
  const body = (await response.json()) as { options?: { label: string }[] }
  return (body.options ?? []).map((option) => option.label)
}

/** The screen values a captured possible-value search posted as its `values` JSON. */
function postedValues(request: Request): Record<string, unknown> {
  return JSON.parse(new URLSearchParams(request.postData() ?? '').get('values') ?? 'null') as Record<string, unknown>
}

test('[PRC-049] a process screen narrows Specimen choices to its Category and records the pick', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const searches: Request[] = []
  page.on('request', (request) => { if (new URL(request.url()).pathname === SPECIMEN_SEARCH) searches.push(request) })
  await openProcess(page, PROCESS)
  await expectScreen(page, 'pick', 'Pick a Specimen')
  const specimen = page.getByRole('combobox', { name: 'Specimen' })
  const specimens = page.getByRole('listbox', { name: 'Specimen options' })

  // No Category yet: ${input.category} is unset, and for a form the backend offers nothing.
  await specimen.click()
  await expect(specimens).toContainText('No options found')
  await expect(specimens.getByRole('option')).toHaveCount(0)
  await specimen.click()

  await choosePossibleValue(page, 'Category', 'Mineral')
  await specimen.click()
  await expect(specimens.getByRole('option')).toHaveText(['Alpha', 'Beta'])
  await specimen.click()

  // Changing the source field changes the dependent field's choices.
  await choosePossibleValue(page, 'Category', 'Plant')
  await specimen.click()
  await expect(specimens.getByRole('option')).toHaveText(['Delta', 'Gamma'])
  await specimens.getByRole('option', { name: 'Delta', exact: true }).click()
  await expect(specimen).toHaveText(/^Delta/)

  // Each search posted the screen's values.
  expect(searches.length).toBeGreaterThanOrEqual(3)
  expect(searches.map((request) => request.method())).toEqual(searches.map(() => 'POST'))
  expect(postedValues(searches[0]).category).toBe('') // an empty screen field is sent as '', which the backend treats as unset
  expect(searches.map((request) => postedValues(request).category)).toEqual(expect.arrayContaining(['Mineral', 'Plant']))

  await advance(page, 'Submit')
  const picked = await expectScreen(page, 'picked', 'Specimen Picked')
  await expect(viewValue(picked, 'category')).toHaveText('Plant')
  await expect(viewValue(picked, 'specimenId')).toHaveText('Delta')
  expect(await backend.sql('select category, specimen_id from prc_pick_log')).toEqual([{ category: 'Plant', specimen_id: '4' }])
})

test('[PRC-049] the backend filters process field searches and id lookups by the posted screen values', async ({ backend, diagnostics }) => {
  void diagnostics
  const search = (values: Record<string, unknown> | null, query = '') =>
    backend.api.post(`${SPECIMEN_SEARCH}${query}`, values ? { form: { values: JSON.stringify(values) } } : {})

  expect(await labels(await backend.api.get('/possibleValues/prcSpecimen'))).toEqual(['Alpha', 'Beta', 'Delta', 'Epsilon', 'Gamma'])
  expect(await labels(await search({ category: 'Mineral' }))).toEqual(['Alpha', 'Beta'])
  expect(await labels(await search({ category: 'Fungus' }))).toEqual(['Epsilon'])
  // An id outside the filter is not found, even by id; inside it, it is.
  expect(await labels(await search({ category: 'Mineral' }, '?ids=4'))).toEqual([])
  expect(await labels(await search({ category: 'Plant' }, '?ids=4'))).toEqual(['Delta'])
  // Unset variable: no matches for a form.
  expect(await labels(await search({}))).toEqual([])
  expect(await labels(await search(null))).toEqual([])
})
