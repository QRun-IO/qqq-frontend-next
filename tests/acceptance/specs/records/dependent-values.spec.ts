/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import type { APIResponse, Page, Request } from '@playwright/test'
import { expect, test } from '../../support/fixtures'
import { expectTouchReady, expectTouchTargets } from '../../support/touch'
import { VIEWER, control, fieldValue, openForm, recordIdFromUrl, recordRequests, sqlOne } from './helpers'

test.use(VIEWER)

// Lab Pick's Item field uses the recPvItem source filtered on categoryId = ${input.categoryId}.
const ITEM_SEARCH = '/qqq/v1/table/recPvPick/possibleValues/itemId'

/** The Item picker's option list (open it first). */
function itemList(page: Page) {
  return page.getByRole('listbox', { name: 'Item options' })
}

/** Open or close a possible-value picker by clicking its combobox. */
async function toggle(page: Page, fieldName: string) {
  await control(page, fieldName).click()
}

/** Choose a possible value by its label and wait for the picker to show it. */
async function choose(page: Page, fieldName: string, label: string, option: string) {
  await toggle(page, fieldName)
  await page.getByRole('listbox', { name: `${label} options` }).getByRole('option', { name: option, exact: true }).click()
  await expect(control(page, fieldName)).toHaveText(new RegExp(`^${option}`))
}

/** The JSON body a captured v1 possible-value search posted. */
function postedBody(request: Request): { values?: Record<string, unknown>, searchTerm?: string } {
  return JSON.parse(request.postData() ?? '{}') as { values?: Record<string, unknown>, searchTerm?: string }
}

/** The form values a captured v1 possible-value search posted as the `values` map of its body. */
function postedValues(request: Request): Record<string, unknown> {
  return postedBody(request).values ?? {}
}

/** Option labels of a possible-value response (an empty list serializes as `{}`). */
async function labels(response: APIResponse): Promise<string[]> {
  expect(response.status()).toBe(200)
  const body = (await response.json()) as { options?: { label: string }[] }
  return (body.options ?? []).map((option) => option.label)
}

test('[REC-052] create: Item choices follow the chosen Category and the chosen id is saved @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  const searches = recordRequests(page, ITEM_SEARCH)
  await openForm(page, '/app/recPvPick/create', 'Create Lab Pick')
  await control(page, 'name').fill('Dinner')

  // No Category yet: ${input.categoryId} is unset, and for a form the backend offers nothing.
  await toggle(page, 'itemId')
  await expect(itemList(page)).toContainText('No options found')
  await expect(itemList(page).getByRole('option')).toHaveCount(0)
  await toggle(page, 'itemId')

  await choose(page, 'categoryId', 'Category', 'Fruit')
  await toggle(page, 'itemId')
  await expect(itemList(page).getByRole('option')).toHaveText(['Apple', 'Banana'])
  // On a touch screen the filtered choices are tappable and the form does not scroll sideways
  await expectTouchTargets(itemList(page))
  await expectTouchReady(page, page.locator('[data-qqq-id="entity-form-recPvPick"]'))
  await toggle(page, 'itemId')

  // Changing the source field changes the dependent field's choices.
  await choose(page, 'categoryId', 'Category', 'Vegetable')
  await toggle(page, 'itemId')
  await expect(itemList(page).getByRole('option')).toHaveText(['Carrot', 'Leek'])
  // An item outside the filter is not offered, even when searched for by name.
  const search = page.getByRole('textbox', { name: 'Search Item options' })
  await search.fill('Apple')
  await expect(itemList(page)).toContainText('No options found')
  await search.fill('Car')
  await expect(itemList(page).getByRole('option')).toHaveText(['Carrot'])
  await itemList(page).getByRole('option', { name: 'Carrot', exact: true }).click()
  await expect(control(page, 'itemId')).toHaveText(/^Carrot/)

  // Every search posted the form's current values; the first had no Category, the later ones the chosen one.
  expect(searches.length).toBeGreaterThanOrEqual(4)
  expect(searches.map((request) => request.method())).toEqual(searches.map(() => 'POST'))
  expect(postedValues(searches[0]).categoryId ?? null).toBeNull()
  expect(searches.map((request) => postedValues(request).categoryId)).toContain(1)
  expect(postedValues(searches.at(-1)!)).toMatchObject({ name: 'Dinner', categoryId: 2 })
  expect(postedBody(searches.at(-1)!).searchTerm).toBe('Car')

  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Dinner' })).toBeVisible()
  const id = recordIdFromUrl(page, 'recPvPick')
  expect(await sqlOne(backend, `select name, category_id, item_id from rec_pv_pick where id = ${id}`))
    .toEqual({ name: 'Dinner', category_id: '2', item_id: '3' })
  await expect(fieldValue(page, 'categoryId')).toHaveText('Vegetable')
  await expect(fieldValue(page, 'itemId')).toHaveText('Carrot')
})

test('[REC-052] edit: the stored Item is shown, a new Category changes the choices and the new id persists @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await openForm(page, '/app/recPvPick/1/edit', 'Edit Lab Pick')
  await expect(control(page, 'categoryId')).toHaveText(/^Fruit/)
  await expect(control(page, 'itemId')).toHaveText(/^Banana/)
  await toggle(page, 'itemId')
  await expect(itemList(page).getByRole('option')).toHaveText(['Apple', 'Banana'])
  await toggle(page, 'itemId')

  await choose(page, 'categoryId', 'Category', 'Vegetable')
  await toggle(page, 'itemId')
  await expect(itemList(page).getByRole('option')).toHaveText(['Carrot', 'Leek'])
  await itemList(page).getByRole('option', { name: 'Leek', exact: true }).click()
  await expect(control(page, 'itemId')).toHaveText(/^Leek/)

  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Lunch' })).toBeVisible()
  expect(await sqlOne(backend, 'select category_id, item_id from rec_pv_pick where id = 1')).toEqual({ category_id: '2', item_id: '4' })
  await expect(fieldValue(page, 'itemId')).toHaveText('Leek')
})

test('[REC-052] the backend filters searches and id lookups by the posted form values', async ({ backend, diagnostics }) => {
  void diagnostics
  // the v1 route the UI uses: search options and form values in a JSON body
  const search = (values: Record<string, unknown> | null, options: { ids?: string[], useCase?: string } = {}) =>
    backend.api.post(ITEM_SEARCH, { data: { ...(values ? { values } : {}), ...options } })

  // Unfiltered, the source has every item; the field's filter narrows it to the posted Category.
  expect(await labels(await backend.api.post('/qqq/v1/possibleValues/recPvItem', { data: {} }))).toEqual(['Apple', 'Banana', 'Carrot', 'Leek'])
  expect(await labels(await search({ categoryId: 1 }))).toEqual(['Apple', 'Banana'])
  expect(await labels(await search({ categoryId: 2 }))).toEqual(['Carrot', 'Leek'])

  // An id outside the filter is not found, even by id; inside it, it is.
  expect(await labels(await search({ categoryId: 2 }, { ids: ['1'] }))).toEqual([])
  expect(await labels(await search({ categoryId: 1 }, { ids: ['1'] }))).toEqual(['Apple'])

  // Unset variable: no matches for a form (the default use case), the filter dropped for a query filter.
  expect(await labels(await search({}))).toEqual([])
  expect(await labels(await search(null))).toEqual([])
  expect(await labels(await search({ categoryId: null }))).toEqual([])
  expect(await labels(await search({}, { useCase: 'filter' }))).toEqual(['Apple', 'Banana', 'Carrot', 'Leek'])
})
