/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import type { Page } from '@playwright/test'
import { expect, test } from '../../support/fixtures'
import { control, openForm, recordIdFromUrl } from './helpers'
import { addCondition, filterUrl, openFilter } from '../query/query-helpers'

/** Select one option using its real metadata label. */
async function choose(page: Page, field: string, label: string, option: string) {
  await control(page, field).click()
  await page.getByRole('listbox', { name: `${label} options` }).getByRole('option', { name: option, exact: true }).click()
}

/** Verify the complete option set, independent of backend ordering, then close the list. */
async function choices(page: Page, field: string, label: string, expected: string[]) {
  await control(page, field).click()
  const options = page.getByRole('listbox', { name: `${label} options` }).getByRole('option')
  await expect(options).toHaveCount(expected.length)
  expect((await options.allTextContents()).sort()).toEqual([...expected].sort())
  await control(page, field).click()
}

test('[REC-069] contingent create narrows country/state/city, cascades clears, and persists via v1 @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await openForm(page, '/app/placeAddress/create', 'Create Address book')
  await control(page, 'label').fill('Contingent acceptance')
  await expect(control(page, 'stateId')).toHaveAttribute('aria-disabled', 'true')
  await expect(control(page, 'stateId')).toHaveAccessibleDescription('Choose Country first')
  await expect(control(page, 'cityId')).toHaveAccessibleDescription('Choose State / province first')
  await choose(page, 'countryId', 'Country', 'USA')
  await choices(page, 'stateId', 'State / province', ['Illinois', 'Missouri'])
  await choose(page, 'stateId', 'State / province', 'Illinois')
  await choices(page, 'cityId', 'City', ['Chester', 'Springfield'])
  await choose(page, 'cityId', 'City', 'Chester')
  await choose(page, 'countryId', 'Country', 'Canada')
  await expect(page.locator('[data-qqq-id="contingent-cleared-stateId"]')).toHaveText("State / province was cleared because it doesn't match the selected Country")
  await expect(page.locator('[data-qqq-id="contingent-cleared-cityId"]')).toHaveText("City was cleared because it doesn't match the selected State / province")
  await expect(control(page, 'stateId')).not.toContainText('Illinois')
  await expect(control(page, 'cityId')).not.toContainText('Chester')
  await choices(page, 'stateId', 'State / province', ['Ontario', 'Quebec'])
  await choose(page, 'stateId', 'State / province', 'Ontario')
  await choices(page, 'cityId', 'City', ['Toronto', 'Ottawa'])
  await choose(page, 'cityId', 'City', 'Toronto')
  await expect(page.locator('[data-qqq-id^="contingent-cleared-"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/placeAddress\/\d+\/?$/)
  const response = await backend.api.get(`/qqq/v1/table/placeAddress/${recordIdFromUrl(page, 'placeAddress')}`)
  expect(response.ok()).toBe(true)
  expect((await response.json()).record.values).toMatchObject({ label: 'Contingent acceptance', countryId: 2, stateId: 3, cityId: 5 })
})

test('[REC-070] contingent edit retains saved selections and clears a city after a state change @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await openForm(page, '/app/placeAddress/1/edit', 'Edit Address book')
  await expect(control(page, 'countryId')).toContainText('USA')
  await expect(control(page, 'stateId')).toContainText('Illinois')
  await expect(control(page, 'cityId')).toContainText('Chester')
  await expect(page.locator('[data-qqq-id^="contingent-cleared-"]')).toHaveCount(0)
  await choose(page, 'stateId', 'State / province', 'Missouri')
  await expect(page.locator('[data-qqq-id="contingent-cleared-cityId"]')).toBeVisible()
  await expect(control(page, 'cityId')).not.toContainText('Chester')
  await choices(page, 'cityId', 'City', ['St. Louis', 'Kansas City'])
  await choose(page, 'cityId', 'City', 'St. Louis')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/placeAddress\/1\/?$/)
  const response = await backend.api.get('/qqq/v1/table/placeAddress/1')
  expect(response.ok()).toBe(true)
  expect((await response.json()).record.values).toMatchObject({ countryId: 1, stateId: 2, cityId: 3 })
})

test('[REC-071] v1 refuses a directly posted invalid dependent choice without saving it @mobile', async ({ backend, diagnostics }) => {
  void diagnostics
  const response = await backend.api.post('/qqq/v1/table/placeAddress', { multipart: { label: 'Invalid acceptance', countryId: '2', stateId: '1', cityId: '1' } })
  // v1 writes can report record validation errors in a successful HTTP envelope.
  const body = await response.json()
  expect(JSON.stringify(body)).toContain('State / province [1] is not a valid choice for the selected Country')
  const query = await backend.api.post('/qqq/v1/table/placeAddress/query', { data: { filter: { criteria: [{ fieldName: 'label', operator: 'EQUALS', values: ['Invalid acceptance'] }] } } })
  expect(query.ok()).toBe(true)
  expect((await query.json()).records ?? []).toHaveLength(0)
})

test('[REC-072] filter builder offers all cities without a state and narrows after a state criterion @mobile', async ({ page, backend, diagnostics }) => {
  void backend
  void diagnostics
  const requests: Array<{ useCase?: string; values?: Record<string, unknown> }> = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/qqq/v1/table/placeAddress/possibleValues/cityId') requests.push(request.postDataJSON())
  })
  await page.goto(filterUrl('placeAddress', { criteria: [{ fieldName: 'cityId', operator: 'EQUALS', values: [] }] }))
  await openFilter(page)
  await page.getByRole('combobox', { name: 'Filter value for City' }).click()
  await expect(page.getByRole('listbox', { name: 'City options' }).getByRole('option')).toHaveCount(8)
  expect(requests.at(-1)).toMatchObject({ useCase: 'filter', values: {} })
  await page.getByRole('combobox', { name: 'Filter value for City' }).click()
  await addCondition(page, 'State / province', 'equals')
  await page.getByRole('combobox', { name: 'Filter value for State / province' }).click()
  await page.getByRole('option', { name: 'Ontario', exact: true }).click()
  await page.getByRole('combobox', { name: 'Filter value for City' }).click()
  const options = page.getByRole('listbox', { name: 'City options' }).getByRole('option')
  await expect(options).toHaveCount(2)
  expect((await options.allTextContents()).sort()).toEqual(['Ottawa', 'Toronto'])
  expect(requests.at(-1)?.useCase).toBe('filter')
  expect(String(requests.at(-1)?.values?.stateId)).toBe('3')
})
