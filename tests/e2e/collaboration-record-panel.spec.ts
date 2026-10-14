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
  await expect(page.locator('[data-qqq-id="comment-body"]')).toBeVisible()
}

test('record collaboration: mention, edit, resolve, file, tags, follow and activity', async ({
  page,
}) => {
  await openRecord(page)
  await page.locator('[data-qqq-id="comment-body"]').fill('Please review @Sam')
  await page.locator('[data-qqq-id="mention-sam"]').click()
  await expect(page.locator('[data-qqq-id="mention-warning"]')).toContainText(
    "can't see this record"
  )
  await page.locator('[data-qqq-id="comment-preview"]').click()
  await expect(
    page.locator('[data-qqq-id="comment-preview-body"] [data-qqq-id="mention-chip"]')
  ).toHaveText('Sam Parker')
  await page.locator('[data-qqq-id="comment-submit"]').click()
  const posted = page.locator('article').filter({ hasText: 'Please review' }).first()
  await expect(posted).toBeVisible()
  const threadId = await posted.getAttribute('data-qqq-id')
  const thread = page.locator(`[data-qqq-id="${threadId}"]`)
  await thread.getByRole('button', { name: 'Edit', exact: true }).click()
  await thread
    .locator('[data-qqq-id="comment-body"]')
    .fill('Updated review @[Sam Parker](user:sam)')
  await thread.getByRole('button', { name: 'Save comment' }).click()
  const edited = page.locator('article').filter({ hasText: 'Updated review' }).first()
  await edited.getByRole('button', { name: 'edited', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Edit history' })).toBeVisible()
  await page.locator('[data-qqq-id="comment-history-close"]').click()
  await edited.getByRole('button', { name: 'Resolve', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Resolved thread · Show' })).toBeVisible()
  await page.getByRole('button', { name: 'Reopen', exact: true }).click()
  await expect(page.getByText('Updated review', { exact: false })).toBeVisible()

  await page.locator('[data-qqq-id="collaboration-tab-files"]').click()
  await page
    .locator('[data-qqq-id="files-picker"]')
    .setInputFiles({
      name: 'collab-test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('A small collaboration file.'),
    })
  const fileRow = page
    .locator('li')
    .filter({ has: page.getByRole('button', { name: /collab-test.txt/ }) })
  await expect(fileRow).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await fileRow.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(fileRow).toHaveCount(0)

  await page.locator('[data-qqq-id="tag-add"]').click()
  await page.locator('[data-qqq-id="tag-search"]').fill('Priority')
  await page.locator('[data-qqq-id="tag-option-1"]').click()
  const remove = page.getByRole('button', { name: 'Remove tag Priority' })
  await expect(remove).toBeEnabled()
  await remove.click()
  await expect(remove).toHaveCount(0)

  const bell = page.locator('[data-qqq-id="follow-toggle"]')
  await expect(bell).toBeEnabled()
  await bell.click()
  await expect(bell).toHaveAttribute('aria-pressed', 'true')
  await page.locator('[data-qqq-id="follow-preferences"]').click()
  await expect(page.getByLabel('Notify me about changes')).toBeChecked()
  await page.getByLabel('Notify me about changes').click()
  await expect(page.getByLabel('Notify me about changes')).not.toBeChecked()
  await expect(page.getByLabel('Notify me about changes')).toBeEnabled()
  await page.locator('[data-qqq-id="follow-close"]').click()
  await expect(bell).toBeEnabled()
  await bell.click()
  await expect(bell).toHaveAttribute('aria-pressed', 'false')

  await page.locator('[data-qqq-id="collaboration-tab-activity"]').click()
  await expect(page.locator('[data-qqq-id="collaboration-activity"]')).toContainText(
    'Posted a comment'
  )
  await page.locator('[data-qqq-id="activity-more"]').click()
  await expect(page.locator('[data-qqq-id="activity-more"]')).toHaveCount(0)
})

for (const width of [390, 1440])
  for (const theme of ['light', 'dark']) {
    test(`record collaboration screenshots ${theme} ${width}`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 1000 })
      await page.addInitScript((dark) => {
        localStorage.setItem('qqq-dark-mode', String(dark))
      }, theme === 'dark')
      await openRecord(page)
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*\bdark\b)/)
      const directory = path.resolve('test-results/collab-shots')
      await mkdir(directory, { recursive: true })
      const shot = async (name: string) => {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true
        )
        await page.screenshot({
          path: path.join(
            directory,
            `${info.project.name}-collaboration-${name}-${theme}-${width}.png`
          ),
          fullPage: true,
          animations: 'disabled',
        })
      }
      await shot('record-page')
      const panel = page.locator('[data-qqq-id="record-collaboration-panel"]')
      for (const tab of ['comments', 'files', 'activity']) {
        await page.locator(`[data-qqq-id="collaboration-tab-${tab}"]`).click()
        await expect(page.locator(`[data-qqq-id="collaboration-${tab}"]`)).toBeVisible()
        await expect(panel.getByRole('status')).toHaveCount(0)
        await panel.evaluate((element) => element.scrollIntoView({ block: 'start' }))
        await shot(tab)

      }
      if (width === 1440) {
        await expect(panel).toHaveCSS('width', '360px')
        await page.locator('[data-qqq-id="collaboration-collapse"]').click()
        await expect(panel).toHaveCSS('width', '48px')
        await page.reload()
        await expect(page.locator('[data-qqq-id="collaboration-collapse"]')).toHaveAttribute(
          'aria-expanded',
          'false'
        )
      }
    })
  }
