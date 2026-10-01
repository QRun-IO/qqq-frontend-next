/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

// Shared UI helpers for the security specs; they work on desktop and on the mobile
// project (where navigation lives in a drawer behind the header menu button).
import { expect, type Locator, type Page } from '@playwright/test'

/**
 * The visible navigation sidebar, opening the mobile drawer when needed.
 *
 * @param page - The page.
 * @returns The sidebar locator.
 */
export async function navigation(page: Page): Promise<Locator> {
  const menuButton = page.locator('[data-qqq-id="button-mobile-menu"]')
  await expect(page.locator('[data-qqq-id="button-mobile-menu"]:visible, [data-qqq-id="sidebar-desktop"]:visible').first()).toBeVisible()
  if (await menuButton.isVisible()) {
    const drawer = page.locator('[data-qqq-id="sidebar-mobile-drawer"]')
    // an already open drawer covers the menu button: use it as it is
    if (!(await drawer.isVisible())) await menuButton.click()
    return drawer
  }
  return page.locator('[data-qqq-id="sidebar-desktop"]')
}

/**
 * Opens the user menu in the visible sidebar.
 *
 * @param page - The page.
 * @returns The open menu.
 */
export async function openUserMenu(page: Page): Promise<Locator> {
  const nav = await navigation(page)
  await nav.locator('[data-qqq-id="sidebar-user-button"]').click()
  return nav.getByRole('menu')
}

/**
 * Collects the URLs of data and table-metadata requests the page makes.
 *
 * @param page - The page.
 * @returns A live array of request URLs (reset it with `length = 0`).
 */
export function recordRequests(page: Page): string[] {
  const urls: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (/\/data\/|\/qqq\/v1\/table\/|\/metaData\/table\/|\/widget\/|\/processes\//.test(url)) urls.push(url)
  })
  return urls
}

/**
 * The dashboard landing shows every app's widgets, including the sample's AWS QuickSight
 * chart, which needs an external AWS account the acceptance fixture cannot own and so
 * always fails with 500 (widgets area). Security specs that land on /app allow only that.
 *
 * @param diagnostics - The test's diagnostics fixture.
 * @param diagnostics.allow - Registers an expected failure.
 */
export function allowExternalQuickSightWidget(diagnostics: { allow: (pattern: string | RegExp) => void }) {
  diagnostics.allow('/widget/QuickSightChartRenderer 500')
  diagnostics.allow('the server responded with a status of 500')
}

/**
 * A record in a table's list, whether it renders as the data grid (desktop) or as
 * cards (phone widths): the grid cell or the card text with exactly this value.
 *
 * @param page - The page.
 * @param tableLabel - The table label (the list is named "<label> records").
 * @param text - The cell / card text.
 * @returns The locator.
 */
export function listCell(page: Page, tableLabel: string, text: string): Locator {
  const name = `${tableLabel} records`
  // a card holds its title and field values in separate elements (their text runs together
  // in the card's own text), so match the card that has an element with exactly this text
  return page.getByRole('grid', { name }).getByRole('gridcell', { name: text, exact: true })
    .or(page.getByRole('list', { name }).getByRole('listitem').filter({ has: page.getByText(text, { exact: true }) }).first())
}

/**
 * Every record row or card in the visible list.
 *
 * @param page - The page.
 * @returns The locator.
 */
export function listRows(page: Page): Locator {
  return page.locator('[data-qqq-id^="grid-row-"], [role="listitem"][data-qqq-id^="record-card-"]')
}

/**
 * The key that moves focus to the next control: WebKit, like Safari, tabs only
 * between form fields unless Option is held.
 *
 * @param page - The page.
 * @returns "Tab" or "Alt+Tab".
 */
export function tabKey(page: Page): string {
  return page.context().browser()?.browserType().name() === 'webkit' ? 'Alt+Tab' : 'Tab'
}
