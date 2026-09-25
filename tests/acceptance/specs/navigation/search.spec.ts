/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import type { Locator, Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { waitForShell } from './nav-helpers'

/** Records every request to a backend search endpoint (none exists in QQQ). */
function watchSearchRequests(page: Page): string[] {
  const seen: string[] = []
  page.on('request', (request) => {
    if (/\/search(\?|$)/.test(new URL(request.url()).pathname + '?') && request.method() === 'POST') seen.push(request.url())
  })
  return seen
}

/** The palette option whose label is exactly `label`. */
function paletteOption(palette: Locator, label: string): Locator {
  return palette.getByRole('option').filter({ has: palette.page().locator('span.font-medium', { hasText: new RegExp(`^${label}$`) }) })
}

test.describe('command palette and search', () => {
  test('[NAV-024] Ctrl+K lists navigable pages by label with type and app, filters and opens by keyboard', async ({ page, backend, diagnostics }) => {
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

  test('[NAV-024] "." opens the palette, Escape closes it, and hidden objects are never listed', async ({ page, backend, diagnostics }) => {
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

  test('[NAV-025] "/" search jumps to pages and recent records without calling a backend search endpoint', async ({ page, backend, diagnostics }) => {
    const searchRequests = watchSearchRequests(page)
    const [person] = await backend.sql('select first_name, last_name from person where id = 1')

    // Viewing a record makes it a recent record
    await open(page, '/app/person/1')
    await waitForShell(page)
    await expect(page).toHaveTitle(new RegExp(`^${person.first_name}`))

    await page.locator('body').press('/')
    const dialog = page.getByRole('dialog', { name: 'Search' })
    await expect(dialog).toBeVisible()
    const input = dialog.getByRole('combobox', { name: 'Search pages and recent records' })
    await input.fill('deep')
    const pages = dialog.getByRole('group', { name: 'Pages' }).getByRole('option')
    await expect(pages).toHaveCount(2)
    await expect(pages.nth(0)).toContainText('Nav Deep Item')
    await expect(pages.nth(1)).toContainText('Nav Deep Item Report')
    await expect(pages.nth(0)).toContainText('Nav Level One / Nav Level Two / Nav Level Three')
    await pages.nth(0).click()
    await expect(page).toHaveURL(/\/app\/navDeepItem\/?$/)

    await page.locator('body').press('/')
    await dialog.getByRole('combobox').fill(person.first_name!.toLowerCase())
    const recent = dialog.getByRole('group', { name: 'Recently viewed' }).getByRole('option')
    await expect(recent).toHaveCount(1)
    await expect(recent).toContainText(`${person.first_name}`)
    await expect(recent).toContainText('Person')
    await recent.click()
    await expect(page).toHaveURL(/\/app\/person\/1\/?$/)

    // Enter without a selection opens the search page, which survives a refresh
    await page.locator('body').press('/')
    await dialog.getByRole('combobox').fill('pet')
    // Keep the pointer off the results so no option is hovered (hover selects, as in the palette)
    await page.mouse.move(1, 1)
    await expect(dialog.getByRole('option', { selected: true })).toHaveCount(0)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/app\/search\/?\?q=pet$/)
    for (const attempt of ['navigate', 'reload']) {
      if (attempt === 'reload') await page.reload()
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Search results for “pet”')
      await expect(page.getByRole('region', { name: 'Pages' }).getByRole('link')).toHaveText([/^Pet Species/, /^Pet(?! )/, /^Pet Note/])
    }
    await page.getByRole('region', { name: 'Pages' }).getByRole('link', { name: /^Pet Note/ }).click()
    await expect(page).toHaveURL(/\/app\/petNote\/?$/)
    expect(searchRequests).toEqual([])
  })

  test('[NAV-025] the header search box offers the same local matches', async ({ page, backend, diagnostics }) => {
    const searchRequests = watchSearchRequests(page)
    await open(page, '/app')
    await waitForShell(page)
    const header = page.getByRole('combobox', { name: 'Search pages and recent records' })
    if (await header.isVisible()) {
      await header.fill('clone')
      const results = page.getByRole('listbox', { name: 'Search results' })
      await expect(results.getByRole('option')).toHaveCount(1)
      await expect(results.getByRole('option')).toContainText('Clone People')
      await expect(results.getByRole('option')).toContainText('People App')
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
    } else {
      // Narrow viewports replace the header box with a button that opens the same search
      await page.getByRole('button', { name: 'Open search' }).click()
      const dialog = page.getByRole('dialog', { name: 'Search' })
      await dialog.getByRole('combobox').fill('clone')
      await dialog.getByRole('option', { name: /Clone People/ }).click()
    }
    await expect(page).toHaveURL(/\/app\/clonePeople\/?$/)
    expect(searchRequests).toEqual([])
  })
})
