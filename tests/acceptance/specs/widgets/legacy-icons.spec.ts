/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { createHash } from 'node:crypto'
import { expect, open, test } from '../../support/fixtures'
import { appNavigation } from '../navigation/nav-helpers'
import { expectLoaded, widget } from './widget-support'

const glyphs = [
  ['3d_rotation', '\ue84d'], ['account_balance_wallet', '\ue850'],
  ['airline_seat_flat', '\ue630'], ['battery_6_bar', '\uebd2'],
  ['filter_9_plus', '\ue3da'], ['60fps', '\uefd4'],
]

for (const mode of ['light', 'dark']) {
  test(`[WID-057] legacy icon names render actual local glyphs in ${mode} mode @mobile`, async ({ page, backend, diagnostics }, testInfo) => {
    void diagnostics
    await page.addInitScript(dark => localStorage.setItem('qqq-dark-mode', String(dark)), mode === 'dark')
    await open(page, '/app/widgetBlocks')
    await expectLoaded(page, 'accLegacyIcons')
    await expect(page.locator('html')).toHaveClass(mode === 'dark' ? /dark/ : /^(?!.*\bdark\b)/)
    const card = widget(page, 'accLegacyIcons')
    for (const [name, glyph] of glyphs) {
      const icon = card.locator(`[data-block-id="legacy-${name}"] [data-icon-name="${name}"]`)
      await expect(icon.locator('svg text')).toHaveText(glyph)
      await expect(icon).toHaveCSS('color', 'rgb(37, 99, 235)')
      await expect(icon.locator('.lucide-circle')).toHaveCount(0)
      await expect(icon).toHaveAttribute('aria-hidden', 'true')
      const metrics = await icon.locator('svg').evaluate(svg => ({ width: svg.getBoundingClientRect().width, height: svg.getBoundingClientRect().height }))
      expect(metrics).toEqual({ width: 24, height: 24 })
    }
    const tile = card.locator('[data-qqq-id="widget-main-icon-accLegacyIcons"]')
    await expect(tile.locator('svg text')).toHaveText('\ue850')
    await expect(tile.locator('svg text')).toHaveCSS('fill', 'rgb(255, 255, 255)')
    await expect(page.locator('[data-block-type="ICON"] [data-icon-name="star"] svg')).toHaveClass(/lucide-star/)

    const nav = await appNavigation(page)
    const navIcon = nav.locator('[data-qqq-id="sidebar-item-widgetBlocks"] svg')
    await expect(navIcon).toHaveAttribute('data-qqq-icon', 'view_quilt')
    await expect(navIcon.locator('text')).toHaveText('\ue8f1')
    await expect(navIcon).not.toHaveAttribute('data-qqq-icon-fallback')
    await expect(nav.locator('[data-qqq-id="sidebar-collapse-peopleApp"] svg')).toHaveClass(/lucide-user/)
    // The real server must serve the exact pinned font, and CSP must permit its use.
    const font = await backend.api.get('/fonts/material-icons/MaterialIcons-Regular.ttf')
    expect(font.status()).toBe(200)
    expect(createHash('sha256').update(await font.body()).digest('hex')).toBe('ef149f08bdd2ff09a4e2c8573476b7b0f3fbb15b623954ade59899e7175bedda')
    expect(await page.evaluate(async () => {
      await document.fonts.ready
      return document.fonts.check('24px "QQQ Legacy Material Icons"')
    })).toBe(true)
    await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource').some(entry => new URL(entry.name).pathname === '/fonts/material-icons/MaterialIcons-Regular.ttf'))).toBe(true)
    // Close the mobile drawer before retaining the actual widget appearance.
    if (await page.getByRole('button', { name: 'Close navigation', exact: true }).isVisible()) await page.getByRole('button', { name: 'Close navigation', exact: true }).click()
    await card.evaluate(node => node.scrollIntoView({ block: 'center' }))
    await testInfo.attach(`legacy-icons-${mode}`, { body: await page.screenshot(), contentType: 'image/png' })
  })
}
