/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Widget chrome and header controls: dropdowns, stored selections, reload, export, help, card chrome.
import type { Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { downloadText, expectLoaded, widget, widgetBody } from './widget-support'

const EXPECTED_CSV = '"Label","Value"\n"A,""B""",7\n"Beta","0"\n'
const CHOICE_KEY = 'qqq.widgets.dropdownData.accControls.accChoice'
const DATE_KEY = 'qqq.widgets.dropdownData.accControls.accDate'

async function openControls(page: Page) {
  await open(page, '/app/widgetControls')
  await expect(page.getByRole('heading', { level: 1, name: 'Widget Controls' })).toBeVisible()
  await expectLoaded(page, 'accControls')
}

/** The render count a text such as `... renders=7` reports. */
function renders(text: string | null): number {
  const match = /renders=(\d+)/.exec(text ?? '')
  if (!match) throw new Error(`no render count in ${text}`)
  return Number(match[1])
}

test('[WID-049] required dropdowns wait with the backend message, then children render with the selections', async ({ page, diagnostics }) => {
  void diagnostics
  await openControls(page)
  await expect(page.locator('[data-qqq-id="widget-needs-selection-accControls"]')).toHaveText('Please select a Choice and Day from the dropdowns above.')
  await expect(widget(page, 'accControlValues')).toHaveCount(0)
  const choice = widget(page, 'accControls').getByLabel('Select Choice')
  expect(await choice.locator('option').allTextContents()).toEqual(['Select Choice', 'Alpha', 'Beta'])
  const request = page.waitForRequest((candidate) => candidate.url().includes('/widget/accControls?') && candidate.url().includes('accChoice=beta'))
  await choice.selectOption('beta')
  await request
  await expect(page.locator('[data-qqq-id="widget-needs-selection-accControls"]')).toHaveText('Please select a Day from the dropdown above.')
  await widget(page, 'accControls').getByLabel('Select Day').fill('2026-09-24')
  await expect(widgetBody(page, 'accControlValues')).toContainText('choice=beta; day=2026-09-24; renders=')
})

test('[WID-048] a DATE_PICKER dropdown sends the chosen date to the renderer', async ({ page, diagnostics }) => {
  void diagnostics
  await openControls(page)
  const day = widget(page, 'accControls').getByLabel('Select Day')
  await expect(day).toHaveAttribute('type', 'date')
  await widget(page, 'accControls').getByLabel('Select Choice').selectOption('alpha')
  const request = page.waitForRequest((candidate) => candidate.url().includes('/widget/accControlValues?') && candidate.url().includes('accDate=2025-12-31'))
  await day.fill('2025-12-31')
  await request
  await expect(widgetBody(page, 'accControlValues')).toContainText('choice=alpha; day=2025-12-31')
})

test('[WID-050] stored dropdown selections persist across reload and stale stored options are dropped', async ({ page, diagnostics }) => {
  void diagnostics
  await openControls(page)
  await widget(page, 'accControls').getByLabel('Select Choice').selectOption('beta')
  await widget(page, 'accControls').getByLabel('Select Day').fill('2026-01-15')
  await expect(widgetBody(page, 'accControlValues')).toContainText('choice=beta; day=2026-01-15')
  expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key), CHOICE_KEY) ?? 'null')).toEqual({ id: 'beta', label: 'Beta' })
  expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key), DATE_KEY) ?? 'null')).toMatchObject({ id: '2026-01-15' })
  // the first request after reload already carries the stored selections
  const first = page.waitForRequest((candidate) => candidate.url().includes('/widget/accControls'))
  await page.reload()
  expect((await first).url()).toContain('accChoice=beta')
  await expect(widget(page, 'accControls').getByLabel('Select Choice')).toHaveValue('beta')
  await expect(widget(page, 'accControls').getByLabel('Select Day')).toHaveValue('2026-01-15')
  await expect(widgetBody(page, 'accControlValues')).toContainText('choice=beta; day=2026-01-15')
  // a stored option the backend no longer offers is not selected (and is forgotten)
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ id: 'removed', label: 'Old choice' })), CHOICE_KEY)
  await page.reload()
  await expectLoaded(page, 'accControls')
  await expect(widget(page, 'accControls').getByLabel('Select Choice')).toHaveValue('')
  await expect(page.locator('[data-qqq-id="widget-needs-selection-accControls"]')).toHaveText('Please select a Choice from the dropdown above.')
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), CHOICE_KEY)).toBeNull()
})

test('[WID-047] a payload PVS dropdown sends the selection, clears it, and does not persist without storeDropdownSelections', async ({ page, diagnostics }) => {
  void diagnostics
  await openControls(page)
  await expectLoaded(page, 'accDropdownHtml')
  const body = widgetBody(page, 'accDropdownHtml')
  await expect(body).toHaveText('dropdown choice=(none)')
  const select = widget(page, 'accDropdownHtml').getByLabel('Select Choice')
  expect(await select.locator('option').allTextContents()).toEqual(['Select Choice', 'Alpha', 'Beta'])
  const request = page.waitForRequest((candidate) => candidate.url().includes('/widget/accDropdownHtml?accChoice=alpha'))
  await select.selectOption('alpha')
  await request
  await expect(body).toHaveText('dropdown choice=alpha')
  await select.selectOption('')
  await expect(body).toHaveText('dropdown choice=(none)')
  await select.selectOption('beta')
  await expect(body).toHaveText('dropdown choice=beta')
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.includes('accDropdownHtml')))).toEqual([])
  await page.reload()
  await expect(widgetBody(page, 'accDropdownHtml')).toHaveText('dropdown choice=(none)')
})

test('[WID-045] reload re-renders the widget from the backend', async ({ page, diagnostics }) => {
  void diagnostics
  await openControls(page)
  await expectLoaded(page, 'accReload')
  const body = widgetBody(page, 'accReload')
  const before = renders(await body.textContent())
  const reload = page.getByRole('button', { name: 'Reload Owned Reload' })
  await reload.click()
  await expect.poll(async () => renders(await body.textContent())).toBe(before + 1)
  await reload.click()
  await expect.poll(async () => renders(await body.textContent())).toBe(before + 2)
  // a widget declaring showReloadButton false has no reload control
  await expectLoaded(page, 'accHelp')
  await expect(page.locator('[data-qqq-id="button-widget-reload-accHelp"]')).toHaveCount(0)
})

test('[WID-046] export downloads the payload csvData with Material quoting; no data shows a message', async ({ page, diagnostics }) => {
  void diagnostics
  await openControls(page)
  await expectLoaded(page, 'accExport')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export Owned Export' }).click()])
  expect(download.suggestedFilename()).toMatch(/^Owned Export \d{4}-\d{2}-\d{2} \d{4}\.csv$/)
  expect(await downloadText(download)).toBe(EXPECTED_CSV)
  // the parent widget exports its own csvData too
  const [parentDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export Owned Controls' }).click()])
  expect(parentDownload.suggestedFilename()).toMatch(/^Owned Controls \d{4}-\d{2}-\d{2} \d{4}\.csv$/)
  expect(await downloadText(parentDownload)).toBe(EXPECTED_CSV)
  // nothing to export: a message, and no download
  let downloaded = false
  page.on('download', () => { downloaded = true })
  await expectLoaded(page, 'accExportEmpty')
  await page.getByRole('button', { name: 'Export Owned Empty Export' }).click()
  await expect(page.locator('[data-qqq-id="widget-export-message-accExportEmpty"]')).toHaveText('There is no data available to export.')
  expect(downloaded).toBe(false)
})

test('[WID-044] help content shows sanitized HTML help on the widget label', async ({ page, diagnostics }) => {
  void diagnostics
  await openControls(page)
  await expectLoaded(page, 'accHelp')
  const help = page.locator('[data-qqq-id="widget-help-accHelp"]')
  await expect(help).toBeHidden()
  await page.locator('[data-qqq-id="button-widget-help-accHelp"]').hover()
  await expect(help).toBeVisible()
  await expect(help).toHaveText('Owned help content')
  await expect(help.locator('b')).toHaveText('content')
})

test('[WID-041] plain (non-card) widgets drop the card chrome and show metadata footers; payload sublabels render', async ({ page, diagnostics }) => {
  // the gallery deliberately includes a custom component whose bundle is missing
  diagnostics.allow('/missing-extension.js 404')
  diagnostics.allow('Failed to load resource: the server responded with a status of 404')
  await openControls(page)
  await expectLoaded(page, 'accPlain')
  const plain = widget(page, 'accPlain')
  await expect(plain).toHaveCSS('border-top-width', '0px')
  await expect(page.locator('[data-qqq-id="widget-label-accPlain"]')).toHaveText('Owned Plain Widget')
  await expect(widgetBody(page, 'accPlain')).toHaveText('plain widget body')
  await expect(page.locator('[data-qqq-id="widget-footer-accPlain"]')).toHaveText('Owned metadata footer')
  const card = widget(page, 'accReload')
  await expect(card).toHaveCSS('border-top-width', '1px')
  await open(page, '/app/widgetGallery')
  await expectLoaded(page, 'accGeneric')
  await expect(page.locator('[data-qqq-id="widget-sublabel-accGeneric"]')).toHaveText('Owned sublabel')
  await expect(page.locator('[data-qqq-id="widget-footer-accGeneric"]')).toHaveText('Owned footer')
})
