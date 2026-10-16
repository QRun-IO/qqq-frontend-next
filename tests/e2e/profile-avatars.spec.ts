/*
 * Copyright 2026 QRun.IO, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import type { PreferenceSection } from '../../src/types/preferences'
import { setupApiMocks } from './api-mocks'

const directory = process.env.SCREENSHOTS_DIR ? path.resolve(process.env.SCREENSHOTS_DIR) : undefined
const widths = [390, 768, 1024, 1440, 1920, 3200]
const avatarUrl = '/qqq/v1/avatars/0123456789abcdef0123456789abcdef?v=k1'
// A real 480x360 PNG (a drawn portrait), decoded by the browser and cropped through canvas.
const png = readFileSync(path.join(__dirname, 'fixtures', 'profile-photo.png'))
const photo = { name: 'photo.png', mimeType: 'image/png', buffer: png }
const profile = (avatar: string | null): PreferenceSection => ({
  name: 'profile',
  label: 'Profile',
  icon: { name: 'account_circle' },
  description: 'Your photo and the name other people see.',
  order: 1,
  showInUserMenu: false,
  fields: [
    {
      name: 'avatar',
      isRequired: false,
      isHeavy: false,
      label: 'Photo',
      type: 'STRING',
      adornments: [
        {
          type: 'FILE_UPLOAD',
          values: { format: 'dragAndDrop', valueIsUploadRef: true, accept: 'image/png,image/jpeg,image/webp,image/gif', maxBytes: 5242880, imageShape: 'circle' },
        },
      ],
    },
    { name: 'displayName', label: 'Display name', type: 'STRING', maxLength: 100, isRequired: false, isHeavy: false, adornments: [] },
    { name: 'avatarUrl', label: 'Avatar URL', type: 'STRING', isHidden: true, isEditable: false, isRequired: false, isHeavy: false, adornments: [] },
  ] as PreferenceSection['fields'],
  values: { avatar, displayName: null, avatarUrl: avatar },
  lists: [],
  possibleValues: {},
  actions: [],
})

/** Override the base routes last, keeping the saved profile available on refetch. */
async function setupProfileMocks(page: Page) {
  await setupApiMocks(page)
  let section = profile(null)
  const patches: unknown[] = []
  await page.route('**/qqq/v1/version', (route) =>
    route.fulfill({ json: { apiVersion: '1.4.0', features: ['preferences', 'avatars'], extensions: [] } })
  )
  await page.route('**/qqq/v1/preferences', (route) =>
    route.fulfill({ json: { sections: [section] } })
  )
  await page.route('**/qqq/v1/preferences/profile', (route) => {
    if (route.request().method() === 'PATCH') {
      patches.push(route.request().postDataJSON())
      section = profile(avatarUrl)
    }
    return route.fulfill({ json: section })
  })
  await page.route('**/qqq/v1/uploads', (route) => {
    expect(route.request().method()).toBe('POST')
    return route.fulfill({
      json: {
        ref: 'up-1',
        fileName: 'photo.png',
        sizeBytes: 100,
        contentType: 'image/png',
        expiresAt: '2026-10-22T00:00:00Z',
      },
    })
  })
  await page.route('**/qqq/v1/avatars/**', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ json: { avatars: {} } })
      : route.fulfill({ contentType: 'image/png', body: png })
  )
  return patches
}

/** Wait for decoding so captures and keyboard input exercise the loaded cropper. */
async function openCrop(page: Page) {
  await page.locator('input[type=file]').setInputFiles(photo)
  await expect(page.getByRole('dialog', { name: 'Crop your photo' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Use photo', exact: true })).toBeEnabled()
}

test('profile photo: crop, upload, save, refresh sidebar avatar and reject SVG', async ({ page }) => {
  const patches = await setupProfileMocks(page)
  await page.goto('/app/preferences?section=profile')
  await expect(page.getByRole('button', { name: 'Choose photo', exact: true })).toBeVisible({ timeout: 60_000 })
  await openCrop(page)
  await page.getByRole('application', { name: /Photo crop area/ }).press('ArrowLeft')
  await page.getByRole('button', { name: 'Use photo', exact: true }).click()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect.poll(() => patches).toEqual([{ values: { avatar: 'up-1' } }])
  const avatar = page.locator('[data-qqq-id="header-user-avatar"] img')
  await expect(avatar).toHaveAttribute('src', /\/avatars\/0123456789abcdef0123456789abcdef\?v=k1/)
  await expect(avatar).toBeVisible()
  await expect.poll(() => avatar.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(480)

  await page.locator('input[type=file]').setInputFiles({
    name: 'photo.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  })
  await expect(page.getByRole('alert').filter({ hasText: 'Use a PNG, JPEG, WebP or GIF image.' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Crop your photo' })).toHaveCount(0)
})

/** Capture each state after checking document overflow and all dialog edges. */
async function capture(page: Page, name: string, theme: string, width: number) {
  await page.evaluate(() => document.fonts.ready)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const dialog = page.getByRole('dialog', { name: 'Crop your photo' })
  if (await dialog.isVisible()) {
    const bounds = await dialog.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height)
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  }
  await page.screenshot({
    path: path.join(directory!, `${name}-${theme}-${width}.png`),
    fullPage: true,
    animations: 'disabled',
  })
}

test.describe('profile avatar screenshot matrix', () => {
  test.skip(!directory, 'Set SCREENSHOTS_DIR to capture the owner review matrix.')
  for (const theme of ['light', 'dark'])
    for (const width of widths) {
      test(`${theme} ${width}`, async ({ page }) => {
        test.setTimeout(120_000)
        await mkdir(directory!, { recursive: true })
        await page.setViewportSize({ width, height: 1000 })
        await page.addInitScript((dark) => {
          localStorage.setItem('qqq-dark-mode', String(dark))
        }, theme === 'dark')
        await setupProfileMocks(page)
        await page.goto('/app/preferences?section=profile')
        await expect(page.getByRole('button', { name: 'Choose photo', exact: true })).toBeVisible({ timeout: 60_000 })
        await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*\bdark\b)/)
        await capture(page, 'profile', theme, width)
        await openCrop(page)
        await capture(page, 'crop-dialog', theme, width)
      })
    }
})
