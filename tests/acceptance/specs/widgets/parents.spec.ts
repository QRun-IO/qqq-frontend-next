/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Parent widgets: grid and tab layouts, and children the user may not or cannot see.
import type { Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { expectLoaded, widget, widgetBody } from './widget-support'

/** Records every widget data request the page makes. */
function widgetRequests(page: Page): string[] {
  const names: string[] = []
  page.on('request', (request) => {
    const match = /\/widget\/([^/?]+)/.exec(new URL(request.url()).pathname)
    if (match) names.push(match[1])
  })
  return names
}

test.describe('as administrator', () => {
  test.beforeEach(async ({ page }) => {
    await open(page, '/app/widgetParents')
    await expect(page.getByRole('heading', { level: 1, name: 'Widget Parents' })).toBeVisible()
  })

  test('[WID-022] a grid parent renders each child with its own data', async ({ page, diagnostics }) => {
    void diagnostics
    await expectLoaded(page, 'accParentGrid')
    const parent = page.locator('[data-qqq-id="parent-widget-accParentGrid"]')
    await expect(parent).toHaveAttribute('data-layout', 'GRID')
    await expect(parent.locator('[data-qqq-id="widget-accChildA"]')).toContainText('Child A content; choice=')
    await expect(parent.locator('[data-qqq-id="widget-accChildB"]')).toContainText('Child B content')
    await expect(parent.locator('[data-qqq-id="widget-label-accChildA"]')).toHaveText('Child A')
    // children sit side by side (gridColumns 6 of 12)
    const a = await parent.locator('[data-qqq-id="widget-accChildA"]').boundingBox()
    const b = await parent.locator('[data-qqq-id="widget-accChildB"]').boundingBox()
    expect(Math.round(a!.y)).toBe(Math.round(b!.y))
    expect(b!.x).toBeGreaterThan(a!.x)
  })

  test('[WID-055] a tabs parent switches tabs by click and keyboard and remembers the selection', async ({ page, diagnostics }) => {
    void diagnostics
    await expectLoaded(page, 'accParentTabs')
    const parent = page.locator('[data-qqq-id="parent-widget-accParentTabs"]')
    const tabs = parent.getByRole('tab')
    await expect(tabs).toHaveText(['Child A', 'Child B'])
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true')
    await expect(parent.getByRole('tabpanel')).toContainText('Child A content')
    await tabs.nth(1).click()
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
    await expect(parent.getByRole('tabpanel')).toContainText('Child B content')
    await expect(parent.getByRole('tabpanel')).not.toContainText('Child A content')
    expect(await page.evaluate(() => localStorage.getItem('qqq.widgets.selectedTabs.accParentTabs'))).toBe('1')
    await page.reload()
    await expectLoaded(page, 'accParentTabs')
    await expect(page.locator('[data-qqq-id="parent-widget-accParentTabs"]').getByRole('tab', { name: 'Child B' })).toHaveAttribute('aria-selected', 'true')
    await page.locator('[data-qqq-id="parent-widget-accParentTabs"]').getByRole('tab', { name: 'Child B' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('[data-qqq-id="parent-widget-accParentTabs"]').getByRole('tab', { name: 'Child A' })).toHaveAttribute('aria-selected', 'true')
  })

  test('[WID-056] a parent skips an unknown child without requesting it and shows allowed children', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const requested = widgetRequests(page)
    const payload = await (await backend.api.get('/widget/accParentMissing')).json()
    expect(payload.childWidgetNameList).toEqual(['accNoSuchWidget', 'accChildB'])
    await page.reload()
    await expectLoaded(page, 'accParentMissing')
    const parent = page.locator('[data-qqq-id="parent-widget-accParentMissing"]')
    await expect(parent.locator('[data-qqq-id^="widget-"][data-widget-type]')).toHaveCount(1)
    await expect(parent.locator('[data-qqq-id="widget-accChildB"]')).toContainText('Child B content')
    expect(requested).not.toContain('accNoSuchWidget')
    // the administrator sees the restricted child in its parent
    await expect(page.locator('[data-qqq-id="parent-widget-accParentDenied"] [data-qqq-id="widget-accChildDenied"]')).toContainText('Denied child content')
  })
})

test.describe('as a user without the child permission', () => {
  test.use({ persona: 'noPets' })

  test('[WID-056] a parent omits a denied child without requesting it', async ({ page, backend, diagnostics }) => {
    void diagnostics
    const meta = await (await backend.api.get('/metaData')).json()
    expect(Object.keys(meta.widgets)).not.toContain('accChildDenied')
    expect((await backend.api.get('/widget/accChildDenied')).status()).toBe(403)
    const requested = widgetRequests(page)
    await open(page, '/app/widgetParents')
    await expectLoaded(page, 'accParentDenied')
    const parent = page.locator('[data-qqq-id="parent-widget-accParentDenied"]')
    await expect(widgetBody(page, 'accChildA').first()).toContainText('Child A content')
    await expect(parent.locator('[data-qqq-id="widget-accChildA"]')).toBeVisible()
    await expect(parent.locator('[data-qqq-id="widget-accChildDenied"]')).toHaveCount(0)
    await expect(page.getByText('Denied child content')).toHaveCount(0)
    expect(requested).not.toContain('accChildDenied')
    await expect(widget(page, 'accParentGrid')).toBeVisible()
  })
})
