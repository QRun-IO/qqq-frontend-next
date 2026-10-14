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

import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'

async function openRecord(page: Page) {
  await page.goto('/app/person/1')
  await expect(page.locator('[data-qqq-id="record-view-title-person"]')).toHaveText('Alice Johnson')
  await expect(page.locator('[data-qqq-id="presence-sam"]')).toBeVisible()
}
async function concurrentEdit(page: Page) {
  await page.evaluate(async () => {
    await fetch('/qqq/v1/mock/collaboration-change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'person', pk: '1', values: { firstName: 'Their name' } }),
    })
  })
}
test('live conflict preserves my values and retries 409 with the refreshed version', async ({
  page,
}) => {
  await openRecord(page)
  const subscribed = page.waitForResponse(
    (r) => r.url().endsWith('/realtime/subscriptions') && r.request().method() === 'POST'
  )
  await page.goto('/app/person/1/edit')
  await expect(page.locator('[data-qqq-id="firstName"]')).toBeVisible()
  await subscribed
  await page.locator('[data-qqq-id="firstName"]').fill('My name')
  await concurrentEdit(page)
  await expect(page.locator('[data-qqq-id="conflict-banner"]')).toContainText(
    'Sam Parker saved changes'
  )
  await expect(page.locator('[data-qqq-id="firstName"]')).toHaveValue('My name')
  await page.locator('[data-qqq-id="conflict-review"]').click()
  await expect(page.locator('[data-qqq-id="conflict-values"]')).toContainText('Their name')
  await expect(page.locator('[data-qqq-id="conflict-values"]')).toContainText('My name')
  await page.locator('[data-qqq-id="collaboration-dialog-close"]').click()
  const conflict = page.waitForResponse(
    (r) => r.request().method() === 'PATCH' && r.status() === 409
  )
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await conflict
  await expect(page.locator('[data-qqq-id="conflict-overwrite"]')).toBeEnabled()
  const overwrite = page.waitForRequest((r) => r.method() === 'PATCH')
  await page.locator('[data-qqq-id="conflict-overwrite"]').click()
  expect(new URL((await overwrite).url()).searchParams.get('expectedVersion')).toBeTruthy()
  await expect(page.locator('[data-qqq-id="record-view-title-person"]')).toContainText('My name')
})
test('share preview, access deep link, task assignment refusal, toggle and My work', async ({
  page,
}) => {
  await openRecord(page)
  await page.locator('[data-qqq-id="record-share"]').click()
  await expect(page.getByText("can't open this record", { exact: true })).toBeVisible()
  await page.locator('[data-qqq-id="person-sam"]').check()
  await page.locator('[data-qqq-id="person-alex"]').check()
  await page.locator('[data-qqq-id="share-message"]').fill('Please review')
  await page.locator('[data-qqq-id="share-send"]').click()
  await expect(page.locator('[data-qqq-id="share-result"]')).toContainText('Offered access')
  await expect(page.locator('[data-qqq-id="share-result"]')).toContainText('Notified')
  await page.locator('[data-qqq-id="collaboration-dialog-close"]').click()
  await page.locator('[data-qqq-id="collaboration-tab-tasks"]').click()
  await page.locator('[data-qqq-id="task-create"]').click()
  await expect(page.locator('[data-qqq-id="person-sam"]')).toBeDisabled()
  await expect(page.locator('[data-qqq-id="person-alex"]')).toBeEnabled()
  await page.locator('[data-qqq-id="task-title"]').fill('Follow up with customer')
  await page.locator('[data-qqq-id="person-alex"]').check()
  await page.locator('[data-qqq-id="task-save"]').click()
  await page.getByRole('checkbox', { name: 'Complete Follow up with customer' }).check()
  await page.locator('[data-qqq-id="tasks-show-done"]').check()
  await page.getByRole('checkbox', { name: 'Reopen Follow up with customer' }).uncheck()
  await page.locator('[data-qqq-id="favorites-menu"]').click()
  await page.locator('[data-qqq-id="favorites-my-work"]').click()
  await expect(page.getByRole('heading', { name: 'My work' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Follow up with customer' })).toBeVisible()
  await page.goto(
    '/app/collaboration_access_request/create?tableName=person&recordId=hidden&shareId=12'
  )
  await page.locator('[data-qqq-id="access-message"]').fill('Please review my access')
  await page.locator('[data-qqq-id="access-submit"]').click()
  await expect(page.getByRole('status')).toContainText('submitted for review')
  await page.goto('/app/person/not-a-record')
  await expect(page.locator('[data-qqq-id="request-access"]')).toBeVisible()
  await expect(page.locator('[data-qqq-id="record-view-not-found-person"]')).not.toContainText(
    'does not exist'
  )
})
for (const width of [390, 1440])
  for (const theme of ['light', 'dark']) {
    test(`presence, conflict, sharing, access, tasks and work screenshots ${theme} ${width}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 1000 })
      await page.addInitScript((dark) => {
        localStorage.setItem('qqq-dark-mode', String(dark))
      }, theme === 'dark')
      const directory = path.resolve('test-results/collab-shots')
      await mkdir(directory, { recursive: true })
      const capture = async (surface: string) => {
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
        ).toBe(true)
        const file = path.join(directory, `${info.project.name}-${surface}-${theme}-${width}.png`)
        await page.screenshot({ path: file, fullPage: true })
        await info.attach(surface, { path: file, contentType: 'image/png' })
      }
      await openRecord(page)
      await capture('presence')
      await page.locator('[data-qqq-id="record-share"]').click()
      await expect(page.locator('[data-qqq-id="person-sam"]')).toBeVisible()
      await capture('share')
      await page.locator('[data-qqq-id="collaboration-dialog-close"]').click()
      await page.locator('[data-qqq-id="collaboration-tab-tasks"]').click()
      await expect(page.getByText('Review customer requirements')).toBeVisible()
      await capture('tasks')
      await page.goto('/app/person/1/edit')
      await expect(page.locator('[data-qqq-id="firstName"]')).toBeVisible()
      await page.locator('[data-qqq-id="firstName"]').fill('My name')
      await concurrentEdit(page)
      // Saving guarantees the same dialog through the 409 path even if the SSE subscription is still opening.
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(page.locator('[data-qqq-id="conflict-values"]')).toBeVisible()
      await capture('conflict')
      await page.locator('[data-qqq-id="conflict-use-theirs"]').click()
      await page.goto('/app/collaboration_access_request/create?tableName=person&recordId=hidden')
      await expect(page.locator('[data-qqq-id="request-access"]')).toBeVisible()
      await capture('request-access')
      await page.goto('/app/my-work')
      await expect(page.locator('[data-qqq-id="work-mentions"]')).toBeVisible()
      await capture('my-work')
    })
  }
