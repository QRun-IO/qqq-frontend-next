/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'

// Runs against NEXT_PUBLIC_MOCK_API=true (playwright.collaboration.config.ts), without
// page.route replacements: browser requests exercise the same stateful MSW handlers used by
// developers. Screenshots land in test-results/collab-shots/<project>-<shot>-<theme>-<width>.png.
async function openRecord(page: Page) {
  await page.goto('/app/person/1')
  await expect(page.locator('[data-qqq-id="record-view-title-person"]')).toHaveText('Alice Johnson')
  await expect(page.locator('[data-qqq-id="favorite-toggle"]')).toBeEnabled()
}

async function starRecord(page: Page) {
  const response = page.waitForResponse(
    (res) => res.url().endsWith('/qbit/collaboration/favorites') && res.request().method() === 'PUT'
  )
  await page.locator('[data-qqq-id="favorite-toggle"]').click()
  expect((await response).ok()).toBe(true)
  await expect(page.locator('[data-qqq-id="favorite-toggle"]')).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await expect(page.locator('[data-qqq-id="favorite-toggle"]')).toBeEnabled()
}

// The header's palette button, or the app's '.' shortcut (layout.tsx) from the page body.
async function openPalette(page: Page, via: 'button' | 'shortcut' = 'button') {
  if (via === 'button') await page.locator('[data-qqq-id="button-command-palette"]').click()
  else await page.keyboard.press('.')
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible()
}

test('collaboration-favorites: star, menu, palette, unstar and server recents', async ({
  page,
}) => {
  const recentWrites: string[] = []
  page.on('request', (request) => {
    if (request.url().endsWith('/qbit/collaboration/recents') && request.method() === 'POST')
      recentWrites.push(request.postData() ?? '')
  })
  await openRecord(page)
  await starRecord(page)
  await page.locator('[data-qqq-id="favorites-menu"]').click()
  const menu = page.locator('[data-qqq-id="favorites-popover"]')
  await expect(menu.getByRole('link', { name: 'Alice Johnson' })).toBeVisible()
  await expect(menu.getByText('Unavailable', { exact: true })).toBeVisible()
  await expect(menu.getByRole('heading', { name: 'Operations' })).toBeVisible()
  await page.getByRole('button', { name: 'Close favorites' }).click()
  await openPalette(page)
  const favorites = page.locator('[data-qqq-id="command-group-favorites"]')
  await expect(favorites.getByText('Alice Johnson')).toBeVisible()
  await expect(page.locator('[cmdk-group]').first()).toHaveAttribute(
    'data-qqq-id',
    'command-group-favorites'
  )
  await page.locator('[data-qqq-id="command-menu-search"]').fill('Alice')
  await expect(favorites.getByText('Alice Johnson')).toBeVisible()
  await page.locator('[data-qqq-id="command-menu-search"]').clear()
  await expect(page.locator('[data-qqq-id="command-toggle-favorite"]')).toHaveText(
    'Unstar this page'
  )
  await page.getByRole('button', { name: 'Close command palette' }).click()
  await page.locator('[data-qqq-id="favorite-toggle"]').click()
  await expect(page.locator('[data-qqq-id="favorite-toggle"]')).toHaveAttribute(
    'aria-pressed',
    'false'
  )
  await expect(page.locator('[data-qqq-id="favorite-toggle"]')).toBeEnabled()
  await page.locator('[data-qqq-id="favorites-menu"]').click()
  await expect(menu.getByRole('link', { name: 'Alice Johnson' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Close favorites' }).click()
  await openPalette(page, 'shortcut')
  await expect(favorites.getByText('Alice Johnson')).toHaveCount(0)
  await expect(
    page.locator('[data-qqq-id="command-group-recent"]').getByText('Alice Johnson')
  ).toBeVisible()
  await expect(page.locator('[data-qqq-id="command-toggle-favorite"]')).toHaveText('Star this page')
  expect(recentWrites.filter((body) => JSON.parse(body).recordId === '1')).toHaveLength(1)
  await page.locator('[data-qqq-id="command-toggle-favorite"]').click()
  await expect(favorites.getByText('Alice Johnson')).toBeVisible()
})

for (const width of [390, 1440]) {
  for (const theme of ['light', 'dark']) {
    test(`collaboration-favorites screenshots ${theme} ${width}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 })
      await page.addInitScript(
        (dark) => localStorage.setItem('qqq-dark-mode', String(dark)),
        theme === 'dark'
      )
      await openRecord(page)
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*\bdark\b)/)
      await starRecord(page)
      const directory = path.resolve('test-results/collab-shots')
      await mkdir(directory, { recursive: true })
      const shot = async (name: string) => {
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
        ).toBe(true)
        await page.screenshot({
          path: path.join(directory, `${testInfo.project.name}-${name}-${theme}-${width}.png`),
          animations: 'disabled',
        })
      }
      await shot('record-header-with-star')
      await page.locator('[data-qqq-id="favorites-menu"]').click()
      const menu = page.locator('[data-qqq-id="favorites-popover"]')
      await expect(menu.getByRole('link', { name: 'Alice Johnson' })).toBeVisible()
      const box = await menu.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
      expect(await menu.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true
      )
      await shot('favorites-menu-open')
      await page.getByRole('button', { name: 'Close favorites' }).click()
      await openPalette(page)
      await expect(
        page.locator('[data-qqq-id="command-group-favorites"]').getByText('Alice Johnson')
      ).toBeVisible()
      await shot('palette-with-favorites')
    })
  }
}
