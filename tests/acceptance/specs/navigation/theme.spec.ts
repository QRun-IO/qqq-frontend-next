/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { appNavigation } from './nav-helpers'
import { expect, open, test } from '../../support/fixtures'

// Theme metadata is instance-wide; every scenario needs the backend reset before navigation.
test.beforeEach(async ({ backend }) => { void backend })

for (const mode of ['light', 'dark'] as const) {
  test(`[NAV-056] branded report links and controls remain readable in ${mode} mode @mobile`, async ({ page, diagnostics }, testInfo) => {
    void diagnostics
    await page.emulateMedia({ colorScheme: mode === 'dark' ? 'light' : 'dark' })
    await page.addInitScript((dark) => localStorage.setItem('qqq-dark-mode', String(dark)), mode === 'dark')
    await open(page, '/app/savedReport/1/edit')
    await page.getByRole('button', { name: 'Edit Filters and Columns' }).click()
    const editor = page.getByRole('dialog', { name: 'Edit Filters and Columns' })
    await expect(editor).toBeVisible()
    await expect(editor.getByRole('button', { name: 'OK', exact: true })).toHaveCSS('background-color', 'rgb(29, 78, 216)')
    const link = editor.getByRole('link', { name: 'Open in new window' })
    if (mode === 'light') await expect(link).toHaveCSS('color', 'rgb(29, 78, 216)')
    for (const hovered of [false, true]) {
      if (hovered) await link.hover()
      const results = await new AxeBuilder({ page }).include('[data-qqq-id="filter-editor-reportSetupWidget"]')
        .withRules(['color-contrast']).analyze()
      expect(results.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }))).toEqual([])
    }
  })
}

for (const mode of ['light', 'dark', 'application'] as const) {
  test(`[NAV-056] pivot validation remains readable in ${mode} mode @mobile`, async ({ page, backend, diagnostics }) => {
    void diagnostics
    if (mode === 'application') await backend.enableTheme()
    await page.addInitScript((dark) => localStorage.setItem('qqq-dark-mode', String(dark)), mode === 'dark')
    await open(page, '/app/savedReport/102/edit')
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode === 'dark' ? 'dark' : 'light')
    if (mode === 'application') {
      await expect.poll(() => page.locator('html').evaluate(root => getComputedStyle(root).getPropertyValue('--color-destructive').trim())).toBe('#f97316')
    }
    await page.getByRole('button', { name: 'Edit Pivot Table', exact: true }).click()
    await page.locator('[data-qqq-id="pivot-editor-add-row"]').click()
    await page.locator('[data-qqq-id="pivot-editor-ok"]').click()
    await expect(page.locator('[data-qqq-id="pivot-editor-error"]')).toContainText('Missing value in 1 field.')
    const results = await new AxeBuilder({ page }).include('[data-qqq-id="pivot-editor-error"]')
      .withRules(['color-contrast']).analyze()
    expect(results.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }))).toEqual([])
    expect(results.incomplete).toEqual([])
  })
}

test('[NAV-056] the unbranded dark default has readable action buttons @mobile', async ({ page, diagnostics }) => {
  void diagnostics
  await page.addInitScript(() => localStorage.setItem('qqq-dark-mode', 'true'))
  await page.route((url) => url.pathname === '/qqq/v1/metaData', async (route) => {
    const response = await route.fetch()
    const metadata = await response.json()
    delete metadata.branding
    await route.fulfill({ response, json: metadata })
  })
  await open(page, '/app/savedReport/1/edit')
  await page.getByRole('button', { name: 'Edit Filters and Columns' }).click()
  const results = await new AxeBuilder({ page }).include('[data-qqq-id="filter-editor-reportSetupWidget"]')
    .withRules(['color-contrast']).analyze()
  expect(results.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }))).toEqual([])
})

/** A real v1 response must carry the theme all the way into the rendered shell. */
test('[NAV-056] Material theme metadata drives CSS tokens, custom CSS and the branded header @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await backend.enableTheme()
  const response = await backend.api.get('/qqq/v1/metaData')
  expect(response.status()).toBe(200)
  const metaData = await response.json() as { supplementalInstanceMetaData?: { materialDashboardTheme?: Record<string, unknown> } }
  expect(metaData.supplementalInstanceMetaData?.materialDashboardTheme).toMatchObject({
    primaryColor: '#0f766e',
    sidebarBackgroundColor: '#1f2937',
    brandedHeaderEnabled: true,
    brandedHeaderTagline: 'Owned acceptance theme',
  })

  await open(page, '/app/person')
  const bar = page.locator('[data-qqq-id="branded-header-bar"]')
  await expect(bar).toBeVisible()
  await expect(bar).toHaveCSS('background-color', 'rgb(18, 52, 86)')
  const tagline = page.locator('[data-qqq-id="branded-header-tagline"]')
  await expect(tagline).toHaveText('Owned acceptance theme')
  await expect(tagline).toHaveCSS('letter-spacing', '2px')
  await expect(page.locator('body')).toHaveClass(/qqq-themed/)
  await expect.poll(() => page.locator('html').evaluate((root) =>
    getComputedStyle(root).getPropertyValue('--qqq-primary-color').trim())).toBe('#0f766e')
})

/** Opens the same user preferences from either the sidebar or the phone drawer. */
async function openPreferences(page: Page) {
  await appNavigation(page)
  await page.locator('[data-qqq-id="sidebar"]:visible [data-qqq-id="sidebar-user-button"]').click()
  await page.getByRole('menuitem', { name: 'Preferences', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Preferences', exact: true })
  await expect(dialog).toBeVisible()
  return dialog
}

test('[NAV-056] appearance preferences apply immediately and survive a reload @mobile', async ({ page, diagnostics }) => {
  void diagnostics
  await page.emulateMedia({ colorScheme: 'dark' })
  await open(page, '/app/person')
  let dialog = await openPreferences(page)
  const light = dialog.getByRole('radio', { name: 'Light', exact: true })
  await expect(light).toBeChecked()
  await light.focus()
  await page.keyboard.press('ArrowRight')
  await expect(dialog.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  for (const mode of ['dark', 'light'] as const) {
    await dialog.getByRole('radio', { name: mode === 'dark' ? 'Dark' : 'Light', exact: true }).check()
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode)
    // Audit the selected palette after the existing control color transitions settle.
    await dialog.evaluate(async element => {
      await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})))
    })
    const results = await new AxeBuilder({ page }).include('[data-qqq-id="dialog-user-preferences"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(results.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }))).toEqual([])
  }
  await dialog.getByRole('radio', { name: 'Dark', exact: true }).check()
  await dialog.getByRole('button', { name: 'Done', exact: true }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  dialog = await openPreferences(page)
  await expect(dialog.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked()
  await dialog.getByRole('button', { name: 'Reset to Defaults' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('[NAV-056] appearance preferences explain an application theme override @mobile', async ({ page, backend, diagnostics }) => {
  void diagnostics
  await backend.enableTheme()
  await open(page, '/app/person')
  await expect(page.locator('body')).toHaveClass(/qqq-themed/)
  await page.evaluate(() => localStorage.setItem('qqq-dark-mode', 'true'))
  await page.reload()
  const dialog = await openPreferences(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(dialog.getByRole('radio', { name: 'Light', exact: true })).toBeChecked()
  await expect(dialog.getByRole('radio', { name: 'Dark', exact: true })).toBeDisabled()
  await expect(dialog.getByText(/application theme requires light mode/i)).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('qqq-dark-mode'))).toBe('true')
  await dialog.getByRole('button', { name: 'Reset to Defaults' }).click()
  expect(await page.evaluate(() => localStorage.getItem('qqq-dark-mode'))).toBe('false')
})

for (const mode of ['light', 'dark'] as const) {
  test(`[NAV-056] API playground text and hovered controls remain readable in ${mode} mode @mobile`, async ({ page, diagnostics }, testInfo) => {
    void diagnostics
    await page.addInitScript((dark) => localStorage.setItem('qqq-dark-mode', String(dark)), mode === 'dark')
    await open(page, '/app/person/dev')
    const docs = page.locator('rapi-doc')
    await expect(docs.getByText('Expand all', { exact: true })).toBeVisible()
    // RapiDoc animates button colors; audit each rendered state after transitions settle.
    const settlePalette = () => docs.evaluate(async element => {
      await (element as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete
      await Promise.all((element.shadowRoot?.getAnimations() ?? []).map(animation => animation.finished.catch(() => {})))
    })
    for (const hovered of [false, true]) {
      if (hovered) await docs.getByRole('button', { name: 'Download OpenAPI spec', exact: true }).hover()
      await settlePalette()
      const result = await new AxeBuilder({ page }).include('rapi-doc').withRules(['color-contrast']).analyze()
      expect(result.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }))).toEqual([])
    }
    await settlePalette()
    await testInfo.attach(`api-playground-${mode}`, { body: await page.screenshot(), contentType: 'image/png' })
    const dialog = await openPreferences(page)
    const oppositeMode = mode === 'dark' ? 'Light' : 'Dark'
    await dialog.getByRole('radio', { name: oppositeMode, exact: true }).check()
    await dialog.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(docs).toHaveJSProperty('theme', oppositeMode.toLowerCase())
    await settlePalette()
    const changed = await new AxeBuilder({ page }).include('rapi-doc').withRules(['color-contrast']).analyze()
    expect(changed.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }))).toEqual([])
  })
}
