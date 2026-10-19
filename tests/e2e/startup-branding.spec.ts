/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */
import { test, expect } from '@playwright/test'
import { METADATA, setupApiMocks } from './api-mocks'

const branded = {
  ...METADATA,
  branding: { ...METADATA.branding, appName: 'Workspace Example' },
  supplementalInstanceMetaData: { materialDashboardTheme: { primaryColor: '#0f766e', sidebarBackgroundColor: '#1f2937' } },
}

test('slow metadata keeps a neutral loading screen until the first branded shell paint', async ({ page }) => {
  await setupApiMocks(page)
  let release!: () => void
  const ready = new Promise<void>((resolve) => { release = resolve })
  await page.route(/\/qqq\/v1\/metaData(?:\?.*)?$/, async (route) => {
    await ready
    await route.fulfill({ json: branded })
  })
  await page.addInitScript(() => {
    localStorage.setItem('qqq-dark-mode', 'true')
    const watch = () => {
      const shell = document.querySelector('[data-qqq-id="app-shell"]')
      if (!shell) { requestAnimationFrame(watch); return }
      document.documentElement.dataset.firstShellPrimary = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim()
      document.documentElement.dataset.firstShellMode = document.documentElement.getAttribute('data-theme') ?? ''
    }
    requestAnimationFrame(watch)
  })
  await page.goto('/app/person', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-qqq-id="application-loading"]')).toBeVisible()
  await expect(page.locator('[data-qqq-id="app-shell"]')).toHaveCount(0)
  await expect(page.getByText('QQQ', { exact: true })).toHaveCount(0)
  release()
  await expect(page.locator('[data-qqq-id="app-shell"]')).toBeVisible()
  await expect(page.locator('[data-qqq-id="application-loading"]')).toHaveCount(0)
  await expect(page.locator('html')).toHaveAttribute('data-first-shell-primary', '#0f766e')
  await expect(page.locator('html')).toHaveAttribute('data-first-shell-mode', 'light')
})

test('metadata failure provides a retry and never exposes the default shell', async ({ page }) => {
  await setupApiMocks(page)
  let failing = true
  await page.route(/\/qqq\/v1\/metaData(?:\?.*)?$/, (route) => route.fulfill(failing
    ? { status: 503, json: { error: 'Temporarily unavailable' } }
    : { json: branded }))
  await page.goto('/app/person', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('alert').filter({ hasText: 'Unable to load your workspace.' })).toHaveText('Unable to load your workspace.', { timeout: 20_000 })
  await expect(page.locator('[data-qqq-id="app-shell"]')).toHaveCount(0)
  failing = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.locator('[data-qqq-id="app-shell"]')).toBeVisible()
})
