/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, open, test } from '../../support/fixtures'
import { waitForShell } from './nav-helpers'

for (const theme of ['light', 'dark']) {
  test(`[NAV-025] search keeps keyboard focus inside its empty and populated dialog in ${theme} mode @mobile`, async ({ page, backend, diagnostics }) => {
    await page.addInitScript((value) => localStorage.setItem('qqq-dark-mode', String(value === 'dark')), theme)
    await open(page, '/app/person')
    await waitForShell(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    const trigger = page.locator('[data-qqq-id="button-filter"]')
    await trigger.focus()
    await trigger.press('/')
    const dialog = page.getByRole('dialog', { name: 'Search', exact: true })
    const input = dialog.getByRole('combobox')
    await expect(input).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(input).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(input).toBeFocused()
    await input.fill('deep')
    await expect(dialog.getByRole('group', { name: 'Pages' }).getByRole('option')).toHaveCount(2)
    await page.keyboard.press('Shift+Tab')
    await expect(dialog.getByRole('button', { name: 'Show all matches' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(input).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(dialog.getByRole('button', { name: 'Clear search' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(dialog.getByRole('group', { name: 'Pages' }).getByRole('option').first()).toBeFocused()
    await dialog.getByRole('button', { name: 'Clear search' }).click()
    await expect(input).toHaveValue('')
    await expect(input).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(input).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(input).toBeFocused()

  })

  test(`[NAV-025] search dismissal returns focus to its opener in ${theme} mode @mobile`, async ({ page, backend, diagnostics }) => {
    await page.addInitScript((value) => localStorage.setItem('qqq-dark-mode', String(value === 'dark')), theme)
    await open(page, '/app/person')
    await waitForShell(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    const trigger = page.locator('[data-qqq-id="button-filter"]')
    await trigger.focus()
    await trigger.press('/')
    const dialog = page.getByRole('dialog', { name: 'Search', exact: true })
    await dialog.getByRole('combobox').fill('deep')
    await page.keyboard.press('Tab')
    await expect(dialog.getByRole('button', { name: 'Clear search' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
    await trigger.press('/')
    await expect(dialog.getByRole('combobox')).toBeFocused()
    await page.locator('[data-qqq-id="search-dialog-backdrop"]').click({ position: { x: 1, y: 1 } })
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })
}

test('[NAV-025] a pointer-opened phone search returns focus to its actual button @mobile', async ({ page, backend, diagnostics }) => {
  await page.setViewportSize({ width: 393, height: 851 })
  await open(page, '/app/person')
  await waitForShell(page)
  // Safari does not necessarily focus a clicked button; keep a distinct previous focus.
  await page.locator('[data-qqq-id="button-filter"]').focus()
  const trigger = page.getByRole('button', { name: 'Open search', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Search', exact: true })
  await expect(dialog.getByRole('combobox')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})
