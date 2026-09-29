/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import AxeBuilder from '@axe-core/playwright'
import { expect, open, test } from '../../support/fixtures'

for (const mode of ['light', 'dark'] as const) {
  test(`[NAV-056] branded report links and controls remain readable in ${mode} mode @mobile`, async ({ page, diagnostics }) => {
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

for (const mode of ['light', 'dark'] as const) {
  test(`[NAV-056] pivot validation remains readable in ${mode} mode @mobile`, async ({ page, diagnostics }) => {
    void diagnostics
    await page.addInitScript((dark) => localStorage.setItem('qqq-dark-mode', String(dark)), mode === 'dark')
    await open(page, '/app/savedReport/102/edit')
    await page.getByRole('button', { name: 'Edit Pivot Table', exact: true }).click()
    await page.locator('[data-qqq-id="pivot-editor-add-row"]').click()
    await page.locator('[data-qqq-id="pivot-editor-ok"]').click()
    await expect(page.locator('[data-qqq-id="pivot-editor-error"]')).toContainText('Missing value in 1 field.')
    const results = await new AxeBuilder({ page }).include('[data-qqq-id="pivot-editor-error"]')
      .withRules(['color-contrast']).analyze()
    expect(results.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }))).toEqual([])
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
