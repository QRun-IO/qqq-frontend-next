/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import type { Page } from '@playwright/test'
import { expect, test } from '../../support/fixtures'
import { openForm, openRecord, shown } from '../records/helpers'

/** Opens a help icon by keyboard and verifies summary versus rendered long content. */
async function help(page: Page, id: string, summary: string, strong: string) {
  const icon = shown(page, `[data-qqq-id="${id}"]`).first()
  await icon.focus()
  await expect(page.getByRole('tooltip')).toContainText(summary)
  await icon.press('Enter')
  const panel = page.locator('[data-qqq-id="help-panel"]')
  await expect(panel).toBeVisible()
  await expect(panel.locator('[data-qqq-id="help-panel-content"] strong')).toHaveText(strong)
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(icon).toBeFocused()
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(colorScheme, () => {
    test.use({ colorScheme })

    test('[HLP-001] app and widget summaries open long help with the keyboard @mobile', async ({ page, diagnostics }) => {
      void diagnostics
      await page.goto('/app/helpLab')
      await help(page, 'app-help-helpLab', 'Application summary.', 'complete help laboratory')
      await help(page, 'button-widget-help-helpOverview', 'Overview summary.', 'help overview')
      await page.goto('/app/navDeepItemReport')
      await help(page, 'report-help-navDeepItemReport', 'Report summary.', 'report output format')
    })

    test('[HLP-002] table, field and section help on view, edit and create @mobile', async ({ page, diagnostics }) => {
      void diagnostics
      await page.goto('/app/helpTopic')
      await help(page, 'table-help-helpTopic', 'Topic summary.', 'complete topic guide')
      await openRecord(page, 'helpTopic', 1, 'Owned Topic')
      await help(page, 'table-help-helpTopic', 'Topic summary.', 'complete topic guide')
      await page.getByRole('radio', { name: 'List view' }).click()
      await help(page, 'field-help-name', 'Name summary.', 'recognizable name')
      await help(page, 'section-help-details', 'Details summary.', 'supporting details')
      for (const [path, heading] of [['/app/helpTopic/1/edit', 'Edit Help Topic'], ['/app/helpTopic/create', 'Create Help Topic']]) {
        await openForm(page, path, heading)
        await help(page, 'table-help-helpTopic', 'Topic summary.', 'complete topic guide')
        await help(page, 'field-help-name', 'Name summary.', 'recognizable name')
        await help(page, 'form-section-help-details', 'Details summary.', 'supporting details')
      }
    })

    test('[HLP-003] query column and table action help leave the action uninvoked', async ({ page, diagnostics }) => {
      void diagnostics
      await page.goto('/app/helpTopic')
      await help(page, 'table-help-helpTopic', 'Topic summary.', 'complete topic guide')
      await help(page, 'grid-header-help-name', 'Name summary.', 'recognizable name')
      await page.locator('[data-qqq-id="process-launcher-trigger"]').click()
      await help(page, 'action-help-helpGuide', 'Action summary.', 'topic action guide')
      await expect(page).toHaveURL(/\/app\/helpTopic\/?$/)
    })

    test('[HLP-004] process, step and record-action help @mobile', async ({ page, diagnostics }) => {
      void diagnostics
      await page.goto('/app/helpGuide')
      await help(page, 'process-help-helpGuide', 'Guide summary.', 'guided instructions')
      await help(page, 'process-step-help', 'Step summary.', 'each detail')
      await openRecord(page, 'helpTopic', 1, 'Owned Topic')
      const desktop = page.locator('[data-qqq-id="button-actions-menu"]')
      if (await desktop.isVisible()) await desktop.click()
      else await page.getByRole('button', { name: 'Record actions', exact: true }).click()
      await help(page, 'action-help-helpGuide', 'Action summary.', 'topic action guide')
      await expect(page).toHaveURL(/\/app\/helpTopic\/1\/?$/)
    })

    test('[HLP-005] command palette searches help and opens the result @mobile', async ({ page, diagnostics }) => {
      void diagnostics
      await page.goto('/app/helpLab')
      await expect(page.getByRole('heading', { name: 'Help Lab', exact: true, level: 1 })).toBeVisible()
      await page.keyboard.press('Control+k')
      await page.locator('[data-qqq-id="command-search-help"]').click()
      await page.locator('[data-qqq-id="command-menu-search"]').fill('laboratory')
      const result = page.locator('[data-qqq-id="command-group-help"] [data-qqq-id^="help-result-"]').first()
      await expect(result).toContainText('Help Lab')
      await expect(result).toContainText('Application summary.')
      await result.click()
      const panel = page.locator('[data-qqq-id="help-panel"]')
      await expect(panel.locator('strong')).toContainText('complete help laboratory')
      await expect(panel.locator('[data-qqq-id="help-go-to"]')).toHaveAttribute('href', /helpLab/)
    })

    test('[HLP-006] author links prefill the core create screen @mobile', async ({ page, diagnostics }) => {
      void diagnostics
      await page.goto('/app/helpTopic/create?helpHelp')
      const slot = page.locator('[data-help-key="table:helpTopic;field:notes"]')
      await expect(slot).toContainText('table:helpTopic;field:notes')
      const add = slot.getByRole('link', { name: 'Add help' })
      const href = await add.getAttribute('href')
      expect(JSON.parse(decodeURIComponent(href!.split('defaultValues=')[1]))).toEqual({ key: 'table:helpTopic;field:notes', role: 'INSERT_SCREEN' })
      await add.click()
      await expect(page.locator('[data-qqq-id="entity-form-helpContent"]')).toBeVisible()
      await expect(page.getByRole('textbox', { name: 'Key', exact: true })).toHaveValue('table:helpTopic;field:notes')
    })

    test('[HLP-001] help sheet fits narrow and wide viewports @mobile', async ({ page, diagnostics }) => {
      void diagnostics
      for (const width of [320, 1920]) {
        await page.setViewportSize({ width, height: 900 })
        await page.goto('/app/helpLab')
        await page.locator('[data-qqq-id="app-help-helpLab"]').click()
        const panel = page.locator('[data-qqq-id="help-panel"]')
        await expect(panel).toBeVisible()
        const bounds = await panel.boundingBox()
        expect(bounds!.x).toBeGreaterThanOrEqual(0)
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
        expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
        await page.getByRole('button', { name: 'Close help', exact: true }).click()
      }
    })
  })
}

test.describe('non-author', () => {
  test.use({ persona: 'viewer' })
  test('[HLP-006] read-only users see keys but no author links @mobile', async ({ page, backend, diagnostics }) => {
    // requesting backend applies the viewer persona to this session
    void backend
    void diagnostics
    await page.goto('/app/helpLab?helpHelp')
    await expect(page.getByRole('heading', { name: 'Help Lab', exact: true, level: 1 })).toBeVisible()
    await expect(page.locator('[data-qqq-id="help-author-link"]')).toHaveCount(0)
  })
})
