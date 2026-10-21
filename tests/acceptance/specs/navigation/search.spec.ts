/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import type { Locator, Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { expectTouchTargets } from '../../support/touch'
import { waitForShell } from './nav-helpers'

/**
 * Records the status of every backend record search response. This backend declares search
 * fields (NavigationFixtures), so the global search also searches records (NAV-030); the
 * regression guarded here was a failing (404) search request on every keystroke. Without
 * searchable tables no request is made at all (NAV-032).
 */
function watchSearchStatuses(page: Page): number[] {
  const statuses: number[] = []
  page.on('response', (response) => {
    if (response.request().method() === 'POST' && /\/search\/?$/.test(new URL(response.url()).pathname)) statuses.push(response.status())
  })
  return statuses
}

/** The palette option whose label is exactly `label`. */
function paletteOption(palette: Locator, label: string): Locator {
  return palette.getByRole('option').filter({ has: palette.page().locator('span.font-medium', { hasText: new RegExp(`^${label}$`) }) })
}

test.describe('command palette and search', () => {
  test('[NAV-024] Ctrl+K lists navigable pages by label with type and app, filters and opens by keyboard @mobile', async ({ page, backend, diagnostics }) => {
    await open(page, '/app/person')
    await waitForShell(page)
    await page.keyboard.press('Control+k')
    const palette = page.getByRole('dialog', { name: 'Command palette' })
    await expect(palette).toBeVisible()
    const search = palette.getByRole('combobox')
    await expect(search).toBeFocused()

    await search.fill('pet')
    const pet = paletteOption(palette, 'Pet')
    await expect(pet).toContainText('Table · People App / Greetings App')
    await expect(pet.locator('svg')).toHaveAttribute('data-qqq-icon', 'pets')
    await expect(paletteOption(palette, 'Pet Note')).toContainText('Table · People App / Greetings App')
    await expect(paletteOption(palette, 'Pet Species')).toContainText('Table · Miscellaneous')

    await search.fill('greetings')
    await expect(paletteOption(palette, 'Greetings App')).toContainText('App · People App')
    await expect(paletteOption(palette, 'Greet Interactive')).toContainText('Process · People App / Greetings App')

    await search.fill('pet species')
    await expect(palette.getByRole('option').first()).toContainText('Pet Species')
    await page.keyboard.press('Enter')
    await expect(palette).toHaveCount(0)
    await expect(page).toHaveURL(/\/app\/petSpecies\/?$/)
    await expect(page).toHaveTitle('Pet Species | Miscellaneous | QQQ Sample')
  })

  test('[NAV-024] "." opens the palette, Escape closes it, and hidden objects are never listed @mobile', async ({ page, backend, diagnostics }) => {
    await open(page, '/app')
    await waitForShell(page)
    await page.locator('body').press('.')
    const palette = page.getByRole('dialog', { name: 'Command palette' })
    await expect(palette).toBeVisible()
    const labels = await palette.getByRole('option').locator('span.font-medium').allTextContents()
    expect(labels).toContain('Nav Deep Item')
    expect(labels).toContain('Sleep Interactive')
    for (const hidden of ['Nav Hidden Note', 'City', 'Greet People', 'Simple Sleep', 'Person Bulk Edit']) expect(labels).not.toContain(hidden)
    await page.keyboard.press('Escape')
    await expect(palette).toHaveCount(0)
  })

  test('[NAV-025] "/" search jumps to pages and recent records, and no search request fails @mobile', async ({ page, backend, diagnostics }) => {
    const searchStatuses = watchSearchStatuses(page)
    const [person] = await backend.sql('select first_name, last_name from person where id = 1')

    // Viewing a record makes it a recent record
    await open(page, '/app/person/1')
    await waitForShell(page)
    await expect(page).toHaveTitle(new RegExp(`^${person.first_name}`))

    await page.locator('body').press('/')
    const dialog = page.getByRole('dialog', { name: 'Command palette' })
    await expect(dialog).toBeVisible()
    const input = dialog.locator('[data-qqq-id="command-menu-search"]')
    await input.fill('deep')
    const pages = dialog.getByRole('group', { name: 'Navigation' }).getByRole('option')
    await expect(pages).toHaveCount(2)
    await expect(pages.nth(0)).toContainText('Nav Deep Item')
    await expect(pages.nth(1)).toContainText('Nav Deep Item Report')
    await expect(pages.nth(0)).toContainText('Nav Level One / Nav Level Two / Nav Level Three')
    await expectTouchTargets(dialog)
    await pages.nth(0).click()
    await expect(page).toHaveURL(/\/app\/navDeepItem\/?$/)

    // The full record label matches the recent record; record search matches single fields,
    // so it finds nothing for "first last" and the record is listed as recently viewed
    await page.locator('body').press('/')
    await dialog.getByRole('combobox').fill(`${person.first_name} ${person.last_name}`.toLowerCase())
    const recent = dialog.getByRole('group', { name: 'Recently Viewed Records' }).getByRole('option')
    await expect(recent).toHaveCount(1)
    await expect(recent).toContainText(`${person.first_name}`)
    await expect(recent).toContainText('Person')
    await recent.click()
    await expect(page).toHaveURL(/\/app\/person\/1\/?$/)

    // The palette offers an explicit entry for the URL-addressable search page.
    await page.locator('body').press('/')
    await dialog.getByRole('combobox').fill('pet')
    await dialog.locator('[data-qqq-id="command-search-all"]').click()
    await expect(page).toHaveURL(/\/app\/search\/?\?q=pet$/)
    for (const attempt of ['navigate', 'reload']) {
      if (attempt === 'reload') await page.reload()
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Results for “pet”')
      // every matching page, on the pages view (the overview lists the best few)
      await page.getByRole('navigation', { name: 'Filter results' }).getByRole('link', { name: /^Pages/ }).click()
      await expect(page).toHaveURL(/\/app\/search\/?\?q=pet&view=pages$/)
      const pageLinks = page.getByRole('region', { name: 'Pages' }).getByRole('link')
      // Other areas' fixtures add matching pages (e.g. "Owned Pet … Report"); every result must match.
      // Exact and prefix label matches come first, in tree order: Pet, then Pet Species and Pet Note
      await expect(pageLinks.filter({ hasText: /^Pet/ })).toHaveText([/^Pet(?! )/, /^Pet Species/, /^Pet Note/])
      for (const text of await pageLinks.allTextContents()) expect(text).toMatch(/pet/i)
    }
    await page.getByRole('region', { name: 'Pages' }).getByRole('link', { name: /^Pet Note/ }).click()
    await expect(page).toHaveURL(/\/app\/petNote\/?$/)
    expect(searchStatuses.length).toBeGreaterThan(0)
    expect(searchStatuses.filter((status) => status !== 200)).toEqual([])
  })

  test('[NAV-025] the header search box offers the same local matches @mobile', async ({ page, backend, diagnostics }) => {
    const searchStatuses = watchSearchStatuses(page)
    await open(page, '/app')
    await waitForShell(page)
    await page.locator('[data-qqq-id="button-search"]').click()
    const dialog = page.getByRole('dialog', { name: 'Command palette' })
    await dialog.getByRole('combobox').fill('clone')
    // Help arrives asynchronously and can share the process label; it is not a local page match.
    await expect(dialog.locator('[data-qqq-id="help-result-process:clonePeople;slot:help"]')).toBeVisible()
    const clone = dialog.locator('[data-qqq-id="command-item-clonePeople"]')
    await expect(clone).toHaveCount(1)
    await expect(clone).toContainText('People App')
    await expect(dialog.locator('[data-qqq-id^="command-item-"]')).toHaveCount(1)
    await expect(dialog.locator('[data-qqq-id="command-search-all"]')).toContainText('Search everything for “clone”')
    await expectTouchTargets(dialog)
    await expect(clone).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/app\/clonePeople\/?$/)
    expect(searchStatuses.filter((status) => status !== 200)).toEqual([])
  })
})
