/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Record search absent (QRun-IO/qqq#701): the security variant is the stock sample plus
// SecurityFixtures, which declares no search fields, so its metadata advertises no searchable
// table. The global search must then stay local and never call POST /qqq/v1/search.

import type { Page } from '@playwright/test'
import { open } from '../../support/fixtures'
import { expect, test } from '../security/support/variant'
import { waitForShell } from './nav-helpers'

/** Records every request to a backend search endpoint (v1 or legacy), not the /app/search page. */
function watchSearchRequests(page: Page): string[] {
  const seen: string[] = []
  page.on('request', (request) => {
    if (['/qqq/v1/search', '/search'].includes(new URL(request.url()).pathname)) seen.push(`${request.method()} ${request.url()}`)
  })
  return seen
}

test('[NAV-032] without searchable tables the header box, "/" dialog and search page stay local and never call /search', async ({ page, security, diagnostics }) => {
  void diagnostics
  const searchRequests = watchSearchRequests(page)
  const metaData = await (await security.api.get('/qqq/v1/metaData')).json()
  const declared = Object.values(metaData.tables as Record<string, { searchFields?: string[] }>).filter((table) => table.searchFields)
  expect(declared).toEqual([])
  const [person] = await security.sql('select first_name from person where id = 1')

  await open(page, '/app')
  await waitForShell(page)

  // header box: local label, local matches only
  const header = page.getByRole('combobox', { name: 'Search pages and recent records' })
  await header.fill(person.first_name!)
  await expect(page.getByRole('listbox', { name: 'Search results' })).toContainText(`No pages or recent records match “${person.first_name}”`)
  await expect(page.getByRole('combobox', { name: 'Search pages and records' })).toHaveCount(0)

  // '/' dialog: pages still match, no Records group
  await header.press('Escape')
  await page.locator('body').press('/')
  const dialog = page.getByRole('dialog', { name: 'Search' })
  await dialog.getByRole('combobox', { name: 'Search pages and recent records' }).fill('person')
  await expect(dialog.getByRole('group', { name: 'Pages' }).getByRole('option').first()).toContainText('Person')
  await expect(dialog.getByRole('group', { name: 'Records' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  // search page: no Records region
  await open(page, `/app/search?q=${encodeURIComponent(person.first_name!)}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Search results for “${person.first_name}”`)
  await expect(page.getByText(`No pages or recent records match “${person.first_name}”.`)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Records' })).toHaveCount(0)

  // outlast the search debounce before asserting that nothing was requested
  await page.waitForTimeout(1_000)
  expect(searchRequests).toEqual([])
})
