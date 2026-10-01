/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { readFileSync } from 'node:fs'
import { expect, open, test } from '../../support/fixtures'

for (const mode of ['light', 'dark'] as const) {
  for (const narrow of [false, true]) {
    test(`[REC-053] API specification controls fit and work in ${mode} mode (${narrow ? '320px' : 'device width'}) @mobile`, async ({ page, backend, diagnostics, isMobile }, testInfo) => {
      void backend
      void diagnostics
      if (narrow) await page.setViewportSize({ width: 320, height: 850 })
      await page.addInitScript(dark => localStorage.setItem('qqq-dark-mode', String(dark)), mode === 'dark')
      await open(page, '/app/person/dev')
      const docs = page.locator('rapi-doc')
      const downloadButton = docs.getByRole('button', { name: 'Download OpenAPI spec', exact: true })
      const viewButton = docs.getByRole('button', { name: 'View OpenAPI spec (New Tab)', exact: true })
      await expect(viewButton).toBeVisible()
      // Only scroll vertically; focusing/clicking a clipped control can conceal overflow
      // by programmatically scrolling an ancestor with overflow:hidden.
      await docs.evaluate(element => {
        const main = document.getElementById('main-content')!
        main.scrollTop += element.getBoundingClientRect().top - main.getBoundingClientRect().top - 16
      })
      await expect(downloadButton).toBeInViewport({ ratio: 1 })
      await expect(viewButton).toBeInViewport({ ratio: 1 })
      for (const button of [downloadButton, viewButton]) {
        const size = await button.evaluate(element => ({ scroll: element.scrollWidth, client: element.clientWidth }))
        expect(size.scroll, `Specification button content must fit: ${await button.textContent()}`).toBeLessThanOrEqual(size.client)
      }
      await testInfo.attach(`api-controls-${mode}-${narrow ? '320' : 'device'}`, { body: await page.screenshot(), contentType: 'image/png' })

      const downloadEvent = page.waitForEvent('download')
      if (isMobile) await downloadButton.tap()
      else await downloadButton.click()
      const download = await downloadEvent
      const spec = JSON.parse(readFileSync((await download.path())!, 'utf8'))
      expect(spec.openapi).toMatch(/^3\./)
      expect(Object.keys(spec.paths).length).toBeGreaterThan(0)

      // Keyboard users can reach the adjacent action and open the same real spec.
      await downloadButton.focus()
      await page.keyboard.press('Tab')
      await expect(viewButton).toBeFocused()
      const popupEvent = page.waitForEvent('popup')
      await page.keyboard.press('Enter')
      const popup = await popupEvent
      await popup.waitForLoadState('domcontentloaded')
      expect(popup.url()).toBe(new URL((await docs.getAttribute('spec-url'))!, page.url()).href)
      await popup.close()
    })
  }
}


test('[REC-053] API specification labels fit wider application font metrics on desktop and phone @mobile', async ({ page, backend, diagnostics }) => {
  void backend
  void diagnostics
  await page.setViewportSize({ width: 1280, height: 720 })
  await open(page, '/app/person/dev')
  const docs = page.locator('rapi-doc')
  const view = docs.getByRole('button', { name: 'View OpenAPI spec (New Tab)', exact: true })
  await expect(view).toBeVisible()
  // An application theme can supply different font metrics; fixed 200px labels clipped in hosted Linux too.
  await page.addStyleTag({ content: '[data-qqq-id="table-dev-api-docs"] rapi-doc { --font-inter: monospace; }' })
  await expect(view).toHaveCSS('font-family', 'monospace')
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 850 })
    await docs.evaluate(element => {
      const main = document.getElementById('main-content')!
      main.scrollTop += element.getBoundingClientRect().top - main.getBoundingClientRect().top - 16
    })
    for (const label of ['Download OpenAPI spec', 'View OpenAPI spec (New Tab)']) {
      const button = docs.getByRole('button', { name: label, exact: true })
      await expect(button).toBeInViewport({ ratio: 1 })
      const size = await button.evaluate(element => ({ scroll: element.scrollWidth, client: element.clientWidth }))
      expect(size.scroll, `${label} must fit at ${width}px with wider glyphs`).toBeLessThanOrEqual(size.client)
    }
  }
})
