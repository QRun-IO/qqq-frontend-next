/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Material query-screen shortcuts (QRun-IO/qqq#714): n new record, r refresh, f filter builder.
import type { Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { grid } from './query-helpers'

const filterBuilder = (page: Page) => page.locator('[data-qqq-id="filter-builder"]')

/** Opens the person table and waits for its rows. */
async function openPeople(page: Page) {
  await open(page, '/app/person')
  await expect(grid(page, 'Person').getByRole('gridcell', { name: 'Avery', exact: true })).toBeVisible()
}

test('[QRY-070] r re-queries the backend and shows the changed data', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await openPeople(page)
  const updated = await backend.api.put('/data/person/1', { multipart: { firstName: 'Refreshed' } })
  expect(updated.status()).toBe(200)
  expect(await backend.sql('select first_name from person where id = 1')).toEqual([{ first_name: 'Refreshed' }])
  // the grid still shows what it loaded; only the refresh reads the change
  await expect(grid(page, 'Person').getByRole('gridcell', { name: 'Avery', exact: true })).toBeVisible()
  const query = page.waitForRequest((request) => request.method() === 'POST' && new URL(request.url()).pathname === '/qqq/v1/table/person/query')
  await page.keyboard.press('r')
  await query
  await expect(grid(page, 'Person').getByRole('gridcell', { name: 'Refreshed', exact: true })).toBeVisible()
  await expect(grid(page, 'Person').getByRole('gridcell', { name: 'Avery', exact: true })).toHaveCount(0)
  await expect(page).toHaveURL(/\/app\/person\/?$/)
})

test('[QRY-070] f opens the filter builder and n opens the create form', async ({ page, backend, diagnostics }) => {
  void diagnostics
  void backend
  await openPeople(page)
  await expect(filterBuilder(page)).toHaveCount(0)
  await page.keyboard.press('f')
  await expect(filterBuilder(page)).toBeVisible()
  await expect(page.locator('[data-qqq-id="button-filter"]')).toHaveAttribute('aria-expanded', 'true')
  // f only opens it (Material opens the filter builder; it does not toggle it closed)
  await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur() })
  await page.keyboard.press('f')
  await expect(filterBuilder(page)).toBeVisible()

  await openPeople(page)
  await page.keyboard.press('n')
  await expect(page).toHaveURL(/\/app\/person\/create\/?$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Create Person' })).toBeVisible()
})

test('[QRY-070] keys typed in quick search are text, not shortcuts', async ({ page, backend, diagnostics }) => {
  void diagnostics
  void backend
  await openPeople(page)
  const search = page.locator('#quick-search')
  await search.click()
  await page.keyboard.type('fnr')
  await expect(search).toHaveValue('fnr')
  await expect(filterBuilder(page)).toHaveCount(0)
  await expect(page).not.toHaveURL(/\/create/)
  await expect(page.getByRole('heading', { level: 2, name: 'Create Person' })).toHaveCount(0)
})

test.describe('read-only persona', () => {
  test.use({ persona: 'viewer' })

  test('[QRY-070] a user who may not insert gets no n shortcut; the backend refuses the insert', async ({ page, backend, diagnostics }) => {
    void diagnostics
    await openPeople(page)
    await page.keyboard.press('n')
    // f still works, so n was handled and ignored
    await page.keyboard.press('f')
    await expect(filterBuilder(page)).toBeVisible()
    await expect(page).toHaveURL(/\/app\/person\/?$/)
    const insert = await backend.api.post('/data/person', { multipart: { firstName: 'No', lastName: 'Shortcut', email: 'no@example.invalid' } })
    expect(insert.status()).toBe(403)
    expect(await backend.sql("select count(*) as n from person where last_name = 'Shortcut'")).toEqual([{ n: '0' }])
  })
})
