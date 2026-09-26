/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import type { Locator, Page } from '@playwright/test'
import { expect, open, test } from '../../support/fixtures'
import { expectNoHorizontalScroll, expectTouchReady, expectTouchTargets, undersizedTargets } from '../../support/touch'
import { tabKey } from '../security/support/ui'
import { appNavigation, expectBreadcrumbs, recordCollection, waitForShell } from './nav-helpers'

/** Whether keyboard focus is inside `scope`. */
async function focusInside(scope: Locator): Promise<boolean> {
  return scope.evaluate((element) => element.contains(document.activeElement))
}

/** A short description of the focused element, to tell Tab stops apart. */
async function focusedControl(page: Page): Promise<string> {
  return page.evaluate(() => {
    const active = document.activeElement
    return active ? `${active.tagName} ${active.getAttribute('data-qqq-id') ?? ''} ${active.getAttribute('aria-label') ?? active.textContent?.trim() ?? ''}` : ''
  })
}

test.describe('mobile navigation', () => {
  test.use({ viewport: { width: 412, height: 839 }, hasTouch: true })

  test('[NAV-026] the header menu opens the navigation drawer, which navigates and closes @mobile', async ({ page, backend, diagnostics }) => {
    await open(page, '/app')
    await waitForShell(page)
    const drawer = page.locator('[data-qqq-id="sidebar-mobile-drawer"]')
    await expect(drawer).toHaveCount(0)
    await expect(page.locator('[data-qqq-id="sidebar-desktop"]')).toBeHidden()

    await page.getByRole('button', { name: 'Open navigation menu' }).click()
    await expect(drawer).toBeVisible()
    await expectTouchReady(page, drawer)
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

    // A tap on the backdrop closes the drawer too
    await page.getByRole('button', { name: 'Open navigation menu' }).click()
    await expect(drawer).toBeVisible()
    await page.locator('[data-qqq-id="sidebar-mobile-backdrop"]').click({ position: { x: 380, y: 400 } })
    await expect(drawer).toHaveCount(0)
  })

  test('[NAV-030] the drawer opens from the keyboard, keeps Tab inside and gives focus back to the menu button @mobile', async ({ page, backend, diagnostics }) => {
    await open(page, '/app/miscellaneous')
    await waitForShell(page)
    const menu = page.getByRole('button', { name: 'Open navigation menu' })
    const drawer = page.locator('[data-qqq-id="sidebar-mobile-drawer"]')
    const tab = tabKey(page)
    await expect(menu).toHaveAttribute('aria-expanded', 'false')

    // Enter on the focused menu button opens the drawer as a modal dialog and moves focus into it
    await menu.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible()
    await expect(drawer).toBeVisible()
    expect(await focusInside(drawer), await focusedControl(page)).toBe(true)
    await expectTouchReady(page, drawer)

    // Tab and Shift+Tab reach every control of the drawer and never the page behind it (Chromium and
    // Firefox wrap around at the ends; WebKit's Option+Tab stops at the first and last control)
    const controls = await drawer.locator('a[href]:visible, button:visible').evaluateAll((elements) => elements.map((element) =>
      `${element.tagName} ${element.getAttribute('data-qqq-id') ?? ''} ${element.getAttribute('aria-label') ?? element.textContent?.trim() ?? ''}`))
    const visited = new Set<string>()
    for (const key of [tab, `Shift+${tab}`]) {
      for (let press = 0; press < controls.length + 3; press++) {
        await page.keyboard.press(key)
        expect(await focusInside(drawer), `${key} ${press + 1} left the drawer for ${await focusedControl(page)}`).toBe(true)
        visited.add(await focusedControl(page))
      }
    }
    expect(controls.filter((control) => !visited.has(control)), 'drawer controls the keyboard never reached').toEqual([])

    // Escape closes it and returns focus to the menu button
    await page.keyboard.press('Escape')
    await expect(drawer).toHaveCount(0)
    await expect(menu).toBeFocused()
    await expect(menu).toHaveAttribute('aria-expanded', 'false')

    // The close button, used from the keyboard, returns focus as well
    await page.keyboard.press('Enter')
    await expect(drawer).toBeVisible()
    await drawer.getByRole('button', { name: 'Close navigation' }).focus()
    await page.keyboard.press('Enter')
    await expect(drawer).toHaveCount(0)
    await expect(menu).toBeFocused()

    // Choosing a link navigates, closes the drawer and returns focus to the menu button
    await page.keyboard.press('Enter')
    await expect(drawer).toBeVisible()
    await drawer.getByRole('link', { name: 'Carrier', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/app\/carrier\/?$/)
    await expect(drawer).toHaveCount(0)
    await expect(menu).toBeFocused()
    await expect(recordCollection(page, 'Carrier')).toBeVisible()
    await expectBreadcrumbs(page, ['Miscellaneous', 'Carrier'])
  })
})

test('[NAV-031] the shell is touch-ready on phones and tablets: skip link, header controls and user menu @mobile', async ({ page, backend, diagnostics }) => {
  await open(page, '/app/navDeepItem')
  await waitForShell(page)
  await expectBreadcrumbs(page, ['Nav Level One', 'Nav Level Two', 'Nav Level Three', 'Nav Deep Item'])
  await expectNoHorizontalScroll(page)
  await expectTouchTargets(page.locator('[data-qqq-id="header"]'))

  // The skip link is the first Tab stop; once visible it is a full-size target
  await page.keyboard.press(tabKey(page))
  const skip = page.locator('[data-qqq-id="skip-to-content"]')
  await expect(skip).toBeFocused()
  await expect(skip).toHaveText('Skip to main content')
  expect((await undersizedTargets(page)).filter((target) => target.includes('skip-to-content'))).toEqual([])

  // The navigation (tablet sidebar or phone drawer) and its user menu
  const nav = await appNavigation(page)
  await expectTouchTargets(nav)
  const sidebar = page.locator('[data-qqq-id="sidebar"]:visible')
  await sidebar.locator('[data-qqq-id="sidebar-user-button"]').click()
  const menu = sidebar.getByRole('menu')
  await expect(menu.getByRole('menuitem')).toHaveText(['Preferences', 'Log Out'])
  await expectTouchTargets(sidebar)
})
