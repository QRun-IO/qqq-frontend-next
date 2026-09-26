/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Record search across tables (QRun-IO/qqq#701): NavigationFixtures declares search fields on
// person (name, email), pet (name) and saved views (label; locked to their owner). The global
// search (header box, '/' dialog, search page) lists the records POST /qqq/v1/search finds.

import type { Locator, Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import type { Backend } from '../../support/fixtures'
import { v1MetaData, waitForShell } from './nav-helpers'

interface SearchCall { body: { searchTerm: string; tableNames?: string[]; limitPerTable?: number }; status: number }
interface Found { tableName: string; tableLabel: string; recordId: string; recordLabel: string }

/** Records every record search request the page makes, with its body and response status. */
function watchSearches(page: Page): SearchCall[] {
  const calls: SearchCall[] = []
  page.on('response', (response) => {
    const request = response.request()
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/qqq/v1/search') {
      calls.push({ body: request.postDataJSON(), status: response.status() })
    }
  })
  return calls
}

/** Record search as this test's session, bypassing the UI. */
async function apiSearch(backend: Backend, data: Record<string, unknown>): Promise<Found[]> {
  const response = await backend.api.post('/qqq/v1/search', { data })
  expect(response.status()).toBe(200)
  return (await response.json()).results
}

/** Opens the search dialog: the header's "Open search" button on phones, the '/' key otherwise. */
async function openSearchDialog(page: Page): Promise<Locator> {
  const button = page.getByRole('button', { name: 'Open search' })
  if (await button.isVisible()) await button.click()
  else await page.locator('body').press('/')
  const dialog = page.getByRole('dialog', { name: 'Search' })
  await expect(dialog).toBeVisible()
  return dialog
}

/** The found-record options (the "Records" group) of a results listbox or dialog. */
function foundRecords(scope: Locator): Locator {
  return scope.getByRole('group', { name: 'Records' }).getByRole('option')
}

/** The label line of a result option (the table label is the second line). */
function optionLabel(option: Locator): Locator {
  return option.locator('span.text-sm.font-medium')
}

/** Expected "Records" entries for a term, straight from the database (label = "first last"). */
async function expectedPeople(backend: Backend, needle: string, limit: number): Promise<string[]> {
  const rows = await backend.sql(`select first_name, last_name from person where lower(first_name) like '%${needle}%' or lower(last_name) like '%${needle}%' or lower(email) like '%${needle}%' order by id`)
  return rows.slice(0, limit).map((row) => `${row.first_name} ${row.last_name}`)
}

test.describe('record search results', () => {
  test('[NAV-030] @mobile the search dialog finds a record by label with its table, ignoring case, and opens it by keyboard', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const searches = watchSearches(page)
    const pets = await backend.sql("select id, name from pet where lower(name) like '%coco%' order by id")
    expect(pets).toHaveLength(1)
    const tables = (await v1MetaData(backend)).tables

    await open(page, '/app')
    await waitForShell(page)
    const dialog = await openSearchDialog(page)
    await dialog.getByRole('combobox', { name: 'Search pages and records' }).fill('COCO')
    const records = foundRecords(dialog)
    await expect(records).toHaveCount(1)
    await expect(optionLabel(records.first())).toHaveText(pets[0].name!)
    await expect(records.first()).toContainText(tables.pet.label)

    await page.keyboard.press('ArrowDown')
    await expect(records.first()).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('Enter')
    await expect(dialog).toHaveCount(0)
    await expect(page).toHaveURL(new RegExp(`/app/pet/${pets[0].id}/?$`))
    await expect(page).toHaveTitle(new RegExp(`^${pets[0].name}`))

    // the UI searched the readable, visible tables that declare search fields, with its per-table limit
    expect(searches.length).toBeGreaterThan(0)
    for (const call of searches) {
      expect(call.status).toBe(200)
      expect([...(call.body.tableNames ?? [])].sort()).toEqual(['person', 'pet', 'savedView'])
      expect(call.body.limitPerTable).toBe(5)
    }
    expect(searches.map((call) => call.body.searchTerm)).toContain('COCO')
  })

  test('[NAV-030] the header search lists found records after pages; the search page lists every match and survives refresh', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const searches = watchSearches(page)
    const personLabel = (await v1MetaData(backend)).tables.person.label
    const dropdownPeople = await expectedPeople(backend, 'sample', 5)
    const pagePeople = await expectedPeople(backend, 'sample', 25)
    expect(dropdownPeople.length).toBeGreaterThan(1)
    expect(await backend.sql("select name from pet where lower(name) like '%sample%'")).toEqual([])
    expect(await backend.sql("select label from saved_view where lower(label) like '%sample%'")).toEqual([])

    await open(page, '/app')
    await waitForShell(page)
    const header = page.getByRole('combobox', { name: 'Search pages and records' })
    await header.fill('Sample')
    const results = page.getByRole('listbox', { name: 'Search results' })
    const records = foundRecords(results)
    await expect(records.locator('span.text-sm.font-medium')).toHaveText(dropdownPeople)
    for (const option of await records.all()) await expect(option).toContainText(personLabel)
    // groups keep their order: pages (if any match), then found records
    const groups = await results.getByRole('group').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')))
    expect(groups.filter((name) => name !== 'Pages')).toEqual(['Records'])

    // Enter with nothing selected opens the search page, with every match up to its limit
    await page.mouse.move(1, 1)
    await expect(results.getByRole('option', { selected: true })).toHaveCount(0)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/app\/search\/?\?q=Sample$/)
    for (const attempt of ['navigate', 'reload']) {
      if (attempt === 'reload') await page.reload()
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Search results for “Sample”')
      const links = page.getByRole('region', { name: 'Records' }).getByRole('link')
      await expect(links.locator('span.font-medium')).toHaveText(pagePeople)
    }
    await page.getByRole('region', { name: 'Records' }).getByRole('link').first().click()
    const [first] = await backend.sql("select id from person where lower(first_name) like '%sample%' or lower(last_name) like '%sample%' or lower(email) like '%sample%' order by id")
    await expect(page).toHaveURL(new RegExp(`/app/person/${first.id}/?$`))
    expect(searches.filter((call) => call.status !== 200)).toEqual([])
    expect(searches.some((call) => call.body.limitPerTable === 25)).toBe(true)
  })
})

test.describe('record search permissions', () => {
  test.describe('noPets persona', () => {
    test.use({ persona: 'noPets' })

    test('[NAV-031] finds people but never pets, and the backend refuses pet results even when asked @mobile', async ({ page, backend, diagnostics }) => {
      void diagnostics
      const searches = watchSearches(page)
      // "ey" matches a person (Casey) and a pet (Barkley) in the owned database
      const pets = await backend.sql("select name from pet where lower(name) like '%ey%' order by id")
      expect(pets.length).toBeGreaterThan(0)
      const people = await expectedPeople(backend, 'ey', 5)
      expect(people.length).toBeGreaterThan(0)

      await open(page, '/app')
      await waitForShell(page)
      const dialog = await openSearchDialog(page)
      await dialog.getByRole('combobox', { name: 'Search pages and records' }).fill('ey')
      const records = foundRecords(dialog)
      await expect(records.locator('span.text-sm.font-medium')).toHaveText(people)
      for (const pet of pets) await expect(dialog.getByRole('option', { name: new RegExp(pet.name!) })).toHaveCount(0)
      for (const call of searches) expect(call.body.tableNames).not.toContain('pet')

      // server-side enforcement: naming the pet table returns nothing; an unscoped search returns no pets
      expect(await apiSearch(backend, { searchTerm: 'ey', tableNames: ['pet'] })).toEqual([])
      const unscoped = await apiSearch(backend, { searchTerm: 'ey' })
      expect(unscoped.map((found) => found.tableName)).not.toContain('pet')
      expect(unscoped.filter((found) => found.tableName === 'person').map((found) => found.recordLabel)).toEqual(people)
      expect((await v1MetaData(backend)).tables.pet?.searchFields).toBeUndefined()
    })
  })

  test('[NAV-031] admin gets the same term\'s pets from the backend (the noPets difference is enforcement)', async ({ backend, diagnostics }) => {
    void diagnostics
    const pets = await backend.sql("select id, name from pet where lower(name) like '%ey%' order by id")
    const found = await apiSearch(backend, { searchTerm: 'EY', tableNames: ['pet'] })
    expect(found.map((result) => [result.tableName, result.recordId, result.recordLabel])).toEqual(pets.map((pet) => ['pet', pet.id, pet.name]))
  })

  test('[NAV-031] a saved view is found by its owner (alice) @mobile', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const [view] = await backend.sql("select id, label, user_id from saved_view where lower(label) like '%people view%'")
    expect(view.user_id).toBe('sample:alice')
    const savedViewLabel = (await v1MetaData(backend)).tables.savedView.label

    await open(page, '/app')
    await waitForShell(page)
    const dialog = await openSearchDialog(page)
    await dialog.getByRole('combobox', { name: 'Search pages and records' }).fill('people view')
    const records = foundRecords(dialog)
    await expect(records).toHaveCount(1)
    await expect(optionLabel(records.first())).toHaveText(view.label!)
    await expect(records.first()).toContainText(savedViewLabel)
    expect(await apiSearch(backend, { searchTerm: 'people view', tableNames: ['savedView'] })).toEqual([
      { tableName: 'savedView', tableLabel: savedViewLabel, recordId: view.id, recordLabel: view.label },
    ])
  })

  test.describe('bob, with whom alice shared the view read-only', () => {
    test.use({ user: 'bob' })

    test('[NAV-031] the lock admits a shared reader: bob finds alice\'s shared view', async ({ backend, diagnostics }) => {
      void diagnostics
      const [view] = await backend.sql("select v.id, v.label from saved_view v join shared_saved_view s on s.saved_view_id = v.id where s.user_id = 'sample:bob' and lower(v.label) like '%people view%'")
      const found = await apiSearch(backend, { searchTerm: 'people view', tableNames: ['savedView'] })
      expect(found.map((result) => [result.recordId, result.recordLabel])).toEqual([[view.id, view.label]])
    })
  })

  test.describe('casey, who neither owns nor shares the view', () => {
    test.use({ user: 'casey' })

    test('[NAV-031] a saved view locked to alice (shared only with bob) is not found by casey, in the UI or from the API @mobile', async ({ page, backend, diagnostics }) => {
      void diagnostics
      const searches = watchSearches(page)
      const [view] = await backend.sql("select id, user_id from saved_view where lower(label) like '%people view%'")
      expect(view.user_id).toBe('sample:alice')
      expect(await backend.sql(`select user_id from shared_saved_view where saved_view_id = ${view.id}`)).toEqual([{ user_id: 'sample:bob' }])

      await open(page, '/app')
      await waitForShell(page)
      const dialog = await openSearchDialog(page)
      await dialog.getByRole('combobox', { name: 'Search pages and records' }).fill('people view')
      await expect.poll(() => searches.filter((call) => call.body.searchTerm === 'people view').length).toBeGreaterThan(0)
      await expect(dialog.getByRole('status')).toHaveText('')
      await expect(foundRecords(dialog)).toHaveCount(0)
      await expect(dialog.getByRole('listbox')).toContainText('No pages or records match “people view”')
      expect(await apiSearch(backend, { searchTerm: 'people view', tableNames: ['savedView'] })).toEqual([])
    })
  })
})
