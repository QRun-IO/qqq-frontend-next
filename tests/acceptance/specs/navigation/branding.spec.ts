/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, open, test } from '../../support/fixtures'
import { appNavigation, v1MetaData, waitForShell } from './nav-helpers'

test.describe('branding', () => {
  test('[NAV-012] sidebar logo, favicon and accent color come from branding; partial branding raises no warning', async ({ page, backend, diagnostics }) => {
    const warnings: string[] = []
    page.on('console', (message) => { if (message.type() === 'warning') warnings.push(message.text()) })

    const branding = (await v1MetaData(backend)).branding
    expect(branding).toMatchObject({ appName: 'QQQ Sample', logo: '/samples-logo.png', icon: '/kr-icon.png', accentColor: '#1d4ed8' })
    // The sample declares no company name or URL: every branding field is optional
    expect(branding).not.toHaveProperty('companyName')
    expect(branding).not.toHaveProperty('companyUrl')
    expect((await backend.api.get('/samples-logo.png')).status()).toBe(200)

    await open(page, '/app')
    const nav = await appNavigation(page)
    const sidebar = page.getByRole('complementary', { name: 'Main navigation' })
    const logo = sidebar.getByRole('img', { name: 'QQQ Sample' })
    await expect(logo).toHaveAttribute('src', '/samples-logo.png')
    await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
    await expect(logo.locator('xpath=ancestor::a[1]')).toHaveAttribute('href', /\/app\/?$/)

    await expect(page.locator("link[rel~='icon']").first()).toHaveAttribute('href', '/kr-icon.png')
    await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--color-primary'))).toBe('#1d4ed8')
    await expect(nav.getByRole('link', { name: 'Dashboard', exact: true })).toHaveCSS('background-color', 'rgb(29, 78, 216)')

    // Navigate away from the landing page and back via the logo
    await nav.getByRole('link', { name: 'Nav Empty App', exact: true }).click()
    await expect(page).toHaveURL(/\/app\/navEmptyApp\/?$/)
    await appNavigation(page)
    await page.getByRole('complementary', { name: 'Main navigation' }).getByRole('img', { name: 'QQQ Sample' }).click()
    await expect(page).toHaveURL(/\/app\/?$/)
    await waitForShell(page)

    expect(warnings.filter((text) => /schema validation/i.test(text))).toEqual([])
  })

  test('[NAV-013] banners render in their slots with message, severity and colors from metadata', async ({ page, backend, diagnostics }) => {
    const banners = (await v1MetaData(backend)).branding?.banners as Record<string, Record<string, unknown>>
    expect(Object.keys(banners).sort()).toEqual(['QFMD_SIDE_NAV_UNDER_LOGO', 'QFMD_TOP_OF_BODY', 'QFMD_TOP_OF_SITE'])

    for (const path of ['/app', '/app/person']) {
      await open(page, path)
      await appNavigation(page)

      const site = page.getByRole('region', { name: 'Site banner' })
      await expect(site).toHaveText(String(banners.QFMD_TOP_OF_SITE.messageText))
      await expect(site).toHaveAttribute('data-severity', 'info')
      // Top of site: above the sidebar and the header
      const siteBox = await site.boundingBox()
      const headerBox = await page.locator('[data-qqq-id="header"]').boundingBox()
      expect(siteBox!.y).toBe(0)
      expect(headerBox!.y).toBeGreaterThanOrEqual(siteBox!.y + siteBox!.height - 1)

      const body = page.getByRole('main').getByRole('region', { name: 'Page banner' })
      await expect(body).toHaveText('Acceptance body banner: read the docs')
      await expect(body.locator('b')).toHaveText('read the docs')
      await expect(body).toHaveAttribute('data-severity', 'warning')

      const side = page.getByRole('complementary', { name: 'Main navigation' }).getByRole('region', { name: 'Navigation banner' })
      await expect(side).toHaveText('NAV FIXTURE')
      await expect(side).toHaveCSS('color', 'rgb(255, 255, 255)')
      await expect(side).toHaveCSS('background-color', 'rgb(20, 83, 45)')
      await expect(side).toHaveCSS('font-weight', '700')
    }
    // Exactly the three declared slots render
    await expect(page.locator('[data-qqq-id^="banner-QFMD_"][role="region"]:visible')).toHaveCount(3)
  })
})
