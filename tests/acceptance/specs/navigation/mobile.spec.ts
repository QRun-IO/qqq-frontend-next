/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { expect, open, test } from '../../support/fixtures'
import { waitForShell } from './nav-helpers'

test.describe('mobile navigation', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('[NAV-026] the header menu opens the navigation drawer, which navigates and closes @mobile', async ({ page, backend, diagnostics }) => {
    await open(page, '/app')
    await waitForShell(page)
    const drawer = page.locator('[data-qqq-id="sidebar-mobile-drawer"]')
    await expect(drawer).toHaveCount(0)
    await expect(page.locator('[data-qqq-id="sidebar-desktop"]')).toBeHidden()

    await page.getByRole('button', { name: 'Open navigation menu' }).click()
    await expect(drawer).toBeVisible()
    const nav = drawer.getByRole('navigation', { name: 'App navigation' })
    await nav.getByRole('button', { name: 'Expand Miscellaneous' }).click()
    await nav.getByRole('link', { name: 'Carrier', exact: true }).click()
    await expect(page).toHaveURL(/\/app\/carrier\/?$/)
    await expect(drawer).toHaveCount(0)
    await expect(page).toHaveTitle('Carrier | Miscellaneous | QQQ Sample')
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).locator('[aria-current="page"]')).toHaveText('Carrier')

    await page.getByRole('button', { name: 'Open navigation menu' }).click()
    await expect(drawer.getByRole('link', { name: 'Carrier', exact: true })).toHaveAttribute('aria-current', 'page')
    await drawer.getByRole('button', { name: 'Close navigation' }).click()
    await expect(drawer).toHaveCount(0)
    await expect(page).toHaveURL(/\/app\/carrier\/?$/)
  })
})
