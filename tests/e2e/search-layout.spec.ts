/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy at https://www.apache.org/licenses/LICENSE-2.0
 */
// Regression: delayed help must not move a navigation target during a pointer gesture.
import { test, expect } from '@playwright/test'
import { setupApiMocks } from './api-mocks'

for (const surface of ['palette', 'search page'] as const) {
  test(`${surface}: a page remains clickable when help arrives between pointer down and up`, async ({ page, baseURL }) => {
    await setupApiMocks(page)
    await page.route('**/qqq/v1/version', (route) => route.fulfill({ json: {
      apiVersion: '1.4.0', features: ['help'], extensions: [],
    } }))
    let releaseHelp!: () => void
    const held = new Promise<void>((resolve) => { releaseHelp = resolve })
    await page.route('**/qqq/v1/help/search?**', async (route) => {
      await held
      await route.fulfill({ json: { results: [{
        kind: 'table', key: 'table:person;slot:help', name: 'person',
        label: 'People help', summary: 'Delayed help result', text: 'People help content',
      }] } })
    })
    try {
      const requested = page.waitForRequest('**/qqq/v1/help/search?**')
      const origin = baseURL!.replace('127.0.0.1', 'localhost')
      if (surface === 'palette') {
        await page.goto(`${origin}/app`)
        await page.locator('[data-qqq-id="button-search"]').click()
        await page.locator('[data-qqq-id="command-menu-search"]').fill('People')
      } else {
        await page.goto(`${origin}/app/search?q=People&view=pages`)
      }
      await requested
      const target = surface === 'palette'
        ? page.locator('[data-qqq-id="command-item-person"]')
        : page.getByRole('region', { name: 'Pages' }).getByRole('link', { name: /People/ })
      await expect(target).toBeVisible()
      const box = await target.boundingBox()
      expect(box).not.toBeNull()
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
      await page.mouse.down()
      releaseHelp()
      await expect(page.locator('[data-qqq-id="help-result-table:person;slot:help"]')).toBeVisible()
      expect(await target.boundingBox()).toEqual(box)
      await page.mouse.up()
      await expect(page).toHaveURL(/\/app\/person\/?$/)
    } finally {
      releaseHelp()
    }
  })
}
