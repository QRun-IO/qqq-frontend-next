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

// E2E: the notification center (qbit-alerts) against mocked /qqq/v1/alerts/inbox routes: no
// request without the Alerts app; bell badge, popover, the /app/notifications page and a sticky
// banner, readable at 390 and 1440 px in light and dark mode with no horizontal scrolling, axe,
// and the actions. Set QQQ_NOTIFICATIONS_SCREENSHOTS to a directory to also write screenshots.

import { test, expect, type Page, type Route } from '@playwright/test'
import { METADATA, setupApiMocks } from './api-mocks'
import { checkA11y } from './a11y-helpers'

/** Where screenshots go when set (a directory). */
const SCREENSHOT_DIR = process.env.QQQ_NOTIFICATIONS_SCREENSHOTS

const SEVERITIES = ['CRITICAL', 'ERROR', 'WARNING', 'SUCCESS', 'INFO'] as const
const CATEGORIES = ['ALERT', 'JOB', 'SECURITY', 'RELEASE', 'SYSTEM', 'SHARE', 'MARKETING'] as const

/** Thirty inbox items, newest first. */
const ITEMS = Array.from({ length: 30 }, (_, index) => ({
  id: 100 - index,
  notificationId: 50 - index,
  title: [
    'Nightly backup did not run on the primary database cluster',
    'Order export finished',
    'Your password was changed',
    'QQQ 4.1 is available',
    'Scheduled maintenance on Saturday',
  ][index % 5] + (index >= 5 ? ` (${index})` : ''),
  body: index % 5 === 0
    ? 'The **nightly** backup job stopped at 02:14.\n\n- Check the [backup job](/app/person)\n- Read the [runbook](https://qrun.io/docs/backups)'
    : 'Details for this notification, with `code` and a [link](/app/person).',
  severity: SEVERITIES[index % 5],
  category: CATEGORIES[index % 7],
  source: ['Backups', 'Jobs', 'Security', 'Releases', 'System'][index % 5],
  href: index % 5 === 3 ? 'https://qrun.io/releases/4.1' : '/app/person',
  linkLabel: index % 5 === 3 ? 'Release notes' : 'Open',
  deliveredAt: new Date(Date.now() - (index + 1) * 47 * 60_000).toISOString(),
  age: index === 0 ? 'just now' : `${index * 47} min`,
  unread: index < 4,
  sticky: false,
}))

const BANNER = {
  id: 7,
  notificationId: 7,
  title: 'Scheduled maintenance tonight from 22:00 to 23:00 UTC',
  body: 'The admin will be **read-only** during the window. See the [status page](https://status.qrun.io) for updates.',
  severity: 'WARNING',
  category: 'SYSTEM',
  source: 'System',
  href: null,
  linkLabel: null,
  deliveredAt: new Date().toISOString(),
  age: '5 min',
  unread: true,
  sticky: true,
}

/** Recorded inbox traffic. */
interface InboxMock {
  /** Every request path under /alerts. */
  requests: string[]
  /** POST bodies by action. */
  posts: Array<[string, unknown]>
}

/**
 * Announces the Alerts app in the metadata (unless `installed` is false) and answers the inbox.
 *
 * @param page - The page.
 * @param installed - Whether the metadata lists the alerts app.
 * @returns The recorded traffic.
 */
async function mockInbox(page: Page, installed = true): Promise<InboxMock> {
  const mock: InboxMock = { requests: [], posts: [] }
  const items = ITEMS.map((item) => ({ ...item }))
  let banners = [BANNER]
  const json = (route: Route, body: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  await setupApiMocks(page)
  await page.route('**/qqq/v1/version', (route) => json(route, { apiVersion: '1.3.0', features: [], extensions: installed ? [{ name: 'alerts', version: '1.0.0' }] : [] }))
  if (installed) {
    await page.route(/\/qqq\/v1\/metaData(\?|$)/, (route) => json(route, { ...METADATA, apps: { ...METADATA.apps, alerts: { name: 'alerts', label: 'Alerts', children: [] } } }))
  }
  await page.route('**/qqq/v1/alerts/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace('/qqq/v1/alerts', '')
    mock.requests.push(path)
    if (path === '/inbox/summary') {
      const unread = items.filter((item) => item.unread)
      return json(route, {
        unreadCount: unread.length,
        highestUnreadSeverity: unread.some((item) => item.severity === 'CRITICAL') ? 'CRITICAL' : unread[0]?.severity ?? null,
        items: items.slice(0, 10).map(({ body: _body, ...rest }) => rest),
        banners,
        pollSeconds: 60,
        notificationsHref: '/app/notifications',
      })
    }
    if (path === '/inbox') {
      const status = url.searchParams.get('status')
      const offset = Number(url.searchParams.get('offset') ?? 0)
      const limit = Number(url.searchParams.get('limit') ?? 25)
      const matching = items.filter((item) => (status !== 'unread' || item.unread)
        && (!url.searchParams.get('category') || item.category === url.searchParams.get('category'))
        && (!url.searchParams.get('severity') || item.severity === url.searchParams.get('severity')))
      return json(route, { items: matching.slice(offset, offset + limit), total: matching.length, offset, limit })
    }
    const action = path.replace('/inbox/', '')
    const body = request.postDataJSON() as { id?: number; all?: boolean }
    mock.posts.push([action, body])
    for (const item of items) {
      if (body.all || item.id === body.id) {
        if (action === 'read') item.unread = false
        if (action === 'unread') item.unread = true
      }
    }
    if (action === 'dismiss') {
      banners = banners.filter((banner) => banner.id !== body.id)
      const index = items.findIndex((item) => item.id === body.id)
      if (index >= 0) items.splice(index, 1)
    }
    return json(route, { updated: 1 })
  })
  return mock
}

/**
 * Elements that scroll horizontally, and whether the document does.
 *
 * @param page - The page.
 * @returns The offenders.
 */
async function horizontalScroll(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = []
    const root = document.scrollingElement as HTMLElement
    if (root.scrollWidth > window.innerWidth + 1) found.push('document')
    for (const element of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const style = getComputedStyle(element)
      if (/(auto|scroll)/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 1) found.push(element.dataset.qqqId ?? element.tagName)
    }
    return found
  })
}

test.describe('Notification center', () => {
  test('sends no Alerts request without the Alerts app', async ({ page }) => {
    const mock = await mockInbox(page, false)
    await page.goto('/app/person')
    await expect(page.getByRole('heading', { name: 'People' }).first()).toBeVisible()
    await page.waitForTimeout(500)
    expect(mock.requests).toEqual([])
    await expect(page.locator('[data-qqq-id="button-notifications"]')).toHaveCount(0)
  })

  for (const scheme of ['light', 'dark'] as const) {
    for (const width of [390, 1440]) {
      test(`bell, popover, banner and page at ${width} px (${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
        await page.emulateMedia({ colorScheme: scheme })
        await page.addInitScript((value) => { try { localStorage.setItem('qqq-dark-mode', String(value === 'dark')) } catch { /* ignore */ } }, scheme)
        const mock = await mockInbox(page)
        await page.goto('/app/person')

        const bell = page.getByRole('button', { name: 'Notifications, 4 unread' })
        await expect(bell).toBeVisible()
        const banner = page.getByRole('status', { name: /Warning: Scheduled maintenance tonight/ })
        await expect(banner).toBeVisible()
        expect(await horizontalScroll(page)).toEqual([])
        if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/banner-${width}-${scheme}.png` })

        await bell.click()
        const popover = page.getByRole('dialog', { name: 'Notifications' })
        await expect(popover).toBeVisible()
        await expect(popover.getByRole('listitem')).toHaveCount(10)
        const box = await popover.boundingBox()
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
        expect(await horizontalScroll(page)).toEqual([])
        if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/popover-${width}-${scheme}.png` })
        if (scheme === 'light' && width === 1440) await checkA11y(page)
        await page.keyboard.press('Escape')
        await expect(popover).toHaveCount(0)

        await page.goto('/app/notifications')
        const list = page.getByRole('list', { name: 'Notifications' })
        await expect(list.locator(':scope > li')).toHaveCount(25)
        await expect(page.getByText('1–25 of 30')).toBeVisible()
        expect(await horizontalScroll(page)).toEqual([])
        if (SCREENSHOT_DIR) await page.screenshot({ path: `${SCREENSHOT_DIR}/page-${width}-${scheme}.png`, fullPage: false })
        if (scheme === 'light' && width === 1440) await checkA11y(page)

        if (scheme === 'light' && width === 1440) {
          await page.getByRole('button', { name: 'Next' }).click()
          await expect(page.getByText('26–30 of 30')).toBeVisible()
          await page.getByRole('button', { name: 'Unread', exact: true }).click()
          await expect(page.getByText('1–4 of 4')).toBeVisible()
          await page.getByRole('button', { name: /^Mark read: Nightly backup/ }).click()
          await expect(page.getByRole('button', { name: 'Notifications, 3 unread' })).toBeVisible()
          await page.getByRole('button', { name: /^Dismiss: Scheduled maintenance tonight/ }).click()
          await expect(page.getByRole('status', { name: /Warning: Scheduled maintenance tonight/ })).toHaveCount(0)
          expect(mock.posts).toEqual([['read', { id: 100 }], ['dismiss', { id: 7 }]])
        }
      })
    }
  }
})
