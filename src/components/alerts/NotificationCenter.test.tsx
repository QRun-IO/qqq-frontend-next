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

// Tests for the notification center's bell, popover and banner slot: extension gating (no request
// without the qbit's app), polling with backoff and the hidden-tab pause, badge, a11y, per-item
// and bulk actions (optimistic, rolled back on failure), and older backends.

import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'jest-axe'

import { uiApiVersionHandler } from '@/mocks/ui-api-version'
import { server } from '@/mocks/node'
import type { QInstance } from '@/types/metadata'
import { AlertsBell, MAX_POLL_MS, pollDelay } from './AlertsBell'
import { NotificationBannerSlot } from './NotificationBannerSlot'

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

/** The summary as the notification center backend sends it. */
const SUMMARY = {
  unreadCount: 2,
  highestUnreadSeverity: 'CRITICAL',
  notificationsHref: '/app/notifications',
  pollSeconds: 60,
  items: [
    { id: 71, notificationId: 7, title: 'Nightly backup did not run', severity: 'CRITICAL', category: 'ALERT', source: 'Backups', age: '3 h', href: '/app/alerts_alert/7', unread: true },
    { id: 61, notificationId: 6, title: 'Release 4.1 is out', severity: 'SUCCESS', category: 'RELEASE', source: 'QQQ', age: '20 min', href: 'https://qrun.io/releases', unread: true },
    { id: 21, notificationId: 2, title: 'Old warning', severity: 'WARNING', category: 'SYSTEM', source: null, age: '2 d', href: null, unread: false },
  ],
  banners: [] as unknown[],
}

/** The summary as qbit-alerts 0.1.0-RC.1 sends it (no `id`, `group` as the source). */
const LEGACY_SUMMARY = {
  unreadCount: 1,
  highestUnreadSeverity: 'ERROR',
  alertsHref: '/app/alerts',
  items: [{ alertId: 6, title: '3 CDN purges failed', severity: 'ERROR', status: 'OPEN', group: 'CDN', age: '20 min', href: '/app/alerts_alert/6', unread: true }],
}

/** Instance metadata announcing qbit-alerts (its `alerts` app, present when the user holds `alerts.view`). */
const WITH_ALERTS = { apps: { alerts: { name: 'alerts', label: 'Alerts' } }, tables: {}, processes: {} } as unknown as QInstance

/** Instance metadata without qbit-alerts (e.g. the QQQ sample app). */
const WITHOUT_ALERTS = { apps: { home: { name: 'home', label: 'Home' } }, tables: {}, processes: {} } as unknown as QInstance

/**
 * Renders a component with a fresh query client.
 *
 * @param ui - The component.
 * @returns The render result.
 */
function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

/**
 * Records the bodies posted to an inbox action.
 *
 * @param action - `read`, `unread` or `dismiss`.
 * @returns The bodies, filled as requests arrive.
 */
function captureAction(action: string): unknown[] {
  const bodies: unknown[] = []
  server.use(http.post(`/qqq/v1/alerts/inbox/${action}`, async ({ request }) => {
    bodies.push(await request.json())
    return HttpResponse.json({ updated: 1 })
  }))
  return bodies
}

/**
 * Waits.
 *
 * @param ms - Milliseconds.
 * @returns A promise.
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('pollDelay', () => {
  it('polls every pollSeconds, backs off exponentially to 5 minutes, and stops when unavailable', () => {
    const summary = { unreadCount: 0, highestUnreadSeverity: null, items: [], banners: [], notificationsHref: '/app/notifications', pollSeconds: 30 }
    expect(pollDelay(summary, 0)).toBe(30_000)
    expect(pollDelay(undefined, 0)).toBe(60_000)
    expect(pollDelay(summary, 1)).toBe(60_000)
    expect(pollDelay(summary, 2)).toBe(120_000)
    expect(pollDelay(undefined, 3)).toBe(MAX_POLL_MS)
    expect(pollDelay(summary, 10)).toBe(MAX_POLL_MS)
    expect(pollDelay(null, 0)).toBe(false)
  })
})

describe('AlertsBell', () => {
  beforeEach(() => {
    server.use(uiApiVersionHandler('alerts'))
    router.push.mockReset()
  })

  afterEach(() => {
    focusManager.setFocused(undefined)
  })

  it('sends no request and renders nothing when the version does not announce Alerts', async () => {
    server.use(uiApiVersionHandler())
    let calls = 0
    server.use(http.get('/qqq/v1/alerts/*', () => {
      calls++
      return HttpResponse.json(SUMMARY)
    }))
    const without = renderWithClient(<AlertsBell metaData={WITHOUT_ALERTS} />)
    const loading = renderWithClient(<AlertsBell metaData={undefined} />)
    const banners = renderWithClient(<NotificationBannerSlot metaData={WITHOUT_ALERTS} enabled />)
    await sleep(100)
    expect(calls).toBe(0)
    expect(without.container).toBeEmptyDOMElement()
    expect(loading.container).toBeEmptyDOMElement()
    expect(banners.container).toBeEmptyDOMElement()
  })

  it('renders and polls the inbox summary when the version announces Alerts', async () => {
    let calls = 0
    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => {
      calls++
      return HttpResponse.json({ ...SUMMARY, pollSeconds: 0.05 })
    }))
    renderWithClient(<AlertsBell metaData={WITH_ALERTS} />)
    expect(await screen.findByRole('button', { name: /^Notifications, 2 unread/ })).toBeInTheDocument()
    await waitFor(() => expect(calls).toBeGreaterThanOrEqual(3))
  })

  it('pauses polling while the tab is hidden and refetches when it shows again', async () => {
    let calls = 0
    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => {
      calls++
      return HttpResponse.json({ ...SUMMARY, pollSeconds: 0.05 })
    }))
    renderWithClient(<AlertsBell metaData={WITH_ALERTS} />)
    await screen.findByRole('button', { name: /^Notifications, 2 unread/ })
    act(() => focusManager.setFocused(false))
    await sleep(100)
    const hidden = calls
    await sleep(250)
    expect(calls).toBe(hidden)
    act(() => focusManager.setFocused(true))
    await waitFor(() => expect(calls).toBeGreaterThan(hidden))
  })

  it('renders nothing when the backend still answers that Alerts is not available (403 or 404)', async () => {
    let calls = 0
    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => {
      calls++
      return new HttpResponse(null, { status: 404 })
    }))
    const { container } = renderWithClient(<AlertsBell metaData={WITH_ALERTS} />)
    await waitFor(() => expect(calls).toBe(1))
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for a body that is not a summary', async () => {
    let calls = 0
    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => {
      calls++
      return HttpResponse.json({ hello: 'world' })
    }))
    const { container } = renderWithClient(<AlertsBell metaData={WITH_ALERTS} />)
    await waitFor(() => expect(calls).toBe(1))
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the unread count, red for critical, capped at 99+, with an accessible label', async () => {
    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json(SUMMARY)))
    const first = renderWithClient(<AlertsBell metaData={WITH_ALERTS} />)
    const bell = await screen.findByRole('button', { name: /^Notifications, 2 unread/ })
    expect(bell).toHaveAttribute('aria-expanded', 'false')
    // severity is in the name, not only in the badge color
    expect(bell).toHaveAccessibleName('Notifications, 2 unread, critical')
    expect(screen.getByText('2', { selector: '[data-qqq-id="alerts-unread-badge"]' })).toHaveClass('bg-destructive')
    expect(document.querySelector('[data-qqq-id="alerts-unread-announcer"]')).toHaveAttribute('aria-live', 'polite')
    first.unmount()

    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json({ ...SUMMARY, unreadCount: 140, highestUnreadSeverity: 'WARNING' })))
    renderWithClient(<AlertsBell metaData={WITH_ALERTS} />)
    await screen.findByRole('button', { name: /^Notifications, 140 unread/ })
    expect(screen.getByText('99+', { selector: '[data-qqq-id="alerts-unread-badge"]' })).toHaveClass('bg-primary')
  })

  it('opens the popover, opens an item (marking it read), and closes on Escape', async () => {
    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json(SUMMARY)))
    const reads = captureAction('read')
    const user = userEvent.setup()
    renderWithClient(<AlertsBell metaData={WITH_ALERTS} />)
    const bell = await screen.findByRole('button', { name: /^Notifications, 2 unread/ })
    await user.click(bell)
    const dialog = await screen.findByRole('dialog', { name: 'Notifications' })
    expect(await axe(dialog)).toHaveNoViolations()
    const items = within(dialog).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Nightly backup did not run')
    expect(items[0]).toHaveTextContent('Backups · 3 h ago')
    expect(within(items[0]).getByText('Critical')).toBeInTheDocument()
    expect(within(items[1]).getByText('Success')).toBeInTheDocument()
    expect(within(items[1]).getByRole('link')).toHaveAttribute('target', '_blank')
    expect(within(items[2]).queryByRole('link')).not.toBeInTheDocument()
    const link = within(items[0]).getByRole('link')
    await waitFor(() => expect(link).toHaveFocus())

    await user.click(link)
    expect(router.push).toHaveBeenCalledWith('/app/alerts_alert/7')
    await waitFor(() => expect(reads).toEqual([{ id: 71 }]))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(bell)
    await screen.findByRole('dialog', { name: 'Notifications' })
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(bell).toHaveFocus()
  })

  it('keeps focus inside the popover', async () => {
    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json(SUMMARY)))
    const user = userEvent.setup()
    renderWithClient(<AlertsBell metaData={WITH_ALERTS} />)
    await user.click(await screen.findByRole('button', { name: /^Notifications, 2 unread/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Notifications' })
    const first = within(dialog).getAllByRole('link')[0]
    await waitFor(() => expect(first).toHaveFocus())
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(within(dialog).getByRole('link', { name: 'View all' })).toHaveFocus()
    await user.tab()
    expect(first).toHaveFocus()
  })

  it('marks one read and one unread, and dismisses one', async () => {
    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json(SUMMARY)))
    const reads = captureAction('read')
    const unreads = captureAction('unread')
    const dismissals = captureAction('dismiss')
    const user = userEvent.setup()
    renderWithClient(<AlertsBell metaData={WITH_ALERTS} />)
    await user.click(await screen.findByRole('button', { name: /^Notifications, 2 unread/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Notifications' })

    await user.click(within(dialog).getByRole('button', { name: 'Mark read: Nightly backup did not run' }))
    await waitFor(() => expect(reads).toEqual([{ id: 71 }]))

    await user.click(within(dialog).getByRole('button', { name: 'Mark unread: Old warning' }))
    await waitFor(() => expect(unreads).toEqual([{ id: 21 }]))

    await user.click(within(dialog).getByRole('button', { name: 'Dismiss: Release 4.1 is out' }))
    await waitFor(() => expect(dismissals).toEqual([{ id: 61 }]))
  })

  it('applies an action at once, before the server answers', async () => {
    let summary = SUMMARY
    server.use(
      http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json(summary)),
      http.post('/qqq/v1/alerts/inbox/dismiss', async () => {
        await sleep(200)
        summary = { ...SUMMARY, unreadCount: 1, items: SUMMARY.items.slice(1) }
        return HttpResponse.json({ updated: 1 })
      })
    )
    const user = userEvent.setup()
    renderWithClient(<AlertsBell metaData={WITH_ALERTS} />)
    await user.click(await screen.findByRole('button', { name: /^Notifications, 2 unread/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Notifications' })
    await user.click(within(dialog).getByRole('button', { name: 'Dismiss: Nightly backup did not run' }))
    expect(within(dialog).queryByText('Nightly backup did not run')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Notifications, 1 unread/ })).toBeInTheDocument()
  })

  it('rolls back when an action fails', async () => {
    server.use(
      http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json(SUMMARY)),
      http.post('/qqq/v1/alerts/inbox/read', () => new HttpResponse(null, { status: 500 }))
    )
    const user = userEvent.setup()
    renderWithClient(<AlertsBell metaData={WITH_ALERTS} />)
    await user.click(await screen.findByRole('button', { name: /^Notifications, 2 unread/ }))
    await user.click(await screen.findByRole('button', { name: 'Mark all read' }))
    expect(await screen.findByRole('button', { name: /^Notifications, 2 unread/ })).toBeInTheDocument()
  })

  it('marks all read and opens the notifications page', async () => {
    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json(SUMMARY)))
    const reads = captureAction('read')
    const user = userEvent.setup()
    renderWithClient(<AlertsBell metaData={WITH_ALERTS} />)
    await user.click(await screen.findByRole('button', { name: /^Notifications, 2 unread/ }))
    await user.click(await screen.findByRole('button', { name: 'Mark all read' }))
    await waitFor(() => expect(reads).toEqual([{ all: true }]))
    await user.click(screen.getByRole('link', { name: 'View all' }))
    expect(router.push).toHaveBeenCalledWith('/app/notifications')
  })

  it('shows older backends without per-item actions, marking read by alert id', async () => {
    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json(LEGACY_SUMMARY)))
    const reads = captureAction('read')
    const user = userEvent.setup()
    renderWithClient(<AlertsBell metaData={WITH_ALERTS} />)
    await user.click(await screen.findByRole('button', { name: /^Notifications, 1 unread/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Notifications' })
    expect(dialog).toHaveTextContent('CDN · 20 min ago')
    expect(within(dialog).queryByRole('button', { name: /Dismiss/ })).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('link', { name: /3 CDN purges failed/ }))
    await waitFor(() => expect(reads).toEqual([{ alertId: 6 }]))
    expect(router.push).toHaveBeenCalledWith('/app/alerts_alert/6')
  })

  it('shows an empty state with no items', async () => {
    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json({ ...SUMMARY, unreadCount: 0, highestUnreadSeverity: null, items: [] })))
    const user = userEvent.setup()
    renderWithClient(<AlertsBell metaData={WITH_ALERTS} />)
    await user.click(await screen.findByRole('button', { name: 'Notifications, none unread' }))
    expect(await screen.findByText('You have no notifications.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark all read' })).toBeDisabled()
  })
})

describe('NotificationBannerSlot', () => {
  beforeEach(() => server.use(uiApiVersionHandler('alerts')))
  it('shows sticky notifications until dismissed', async () => {
    const dismissals: unknown[] = []
    let summary = {
      ...SUMMARY,
      banners: [{ id: 90, title: 'Maintenance tonight', body: 'The site is **read-only** from 22:00. [Details](/app/status)', severity: 'WARNING', category: 'SYSTEM', href: 'https://status.example.com', linkLabel: 'Status page', unread: true, sticky: true }] as unknown[],
    }
    server.use(
      http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json(summary)),
      http.post('/qqq/v1/alerts/inbox/dismiss', async ({ request }) => {
        dismissals.push(await request.json())
        summary = { ...summary, banners: [] }
        return HttpResponse.json({ updated: 1 })
      })
    )
    const user = userEvent.setup()
    renderWithClient(<NotificationBannerSlot metaData={WITH_ALERTS} enabled />)
    const banner = await screen.findByRole('status', { name: 'Warning: Maintenance tonight' })
    expect(await axe(banner)).toHaveNoViolations()
    expect(within(banner).getByText('read-only').tagName).toBe('STRONG')
    expect(within(banner).getByRole('link', { name: 'Details' })).toHaveAttribute('href', '/app/status')
    expect(within(banner).getByRole('link', { name: 'Status page' })).toHaveAttribute('target', '_blank')
    expect(within(banner).queryByRole('button', { name: /Mark/ })).not.toBeInTheDocument()
    await user.click(within(banner).getByRole('button', { name: 'Dismiss: Maintenance tonight' }))
    await waitFor(() => expect(screen.queryByText('Maintenance tonight')).not.toBeInTheDocument())
    expect(dismissals).toEqual([{ id: 90 }])
  })

  it('renders nothing without banners or when signed out', async () => {
    let calls = 0
    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => {
      calls++
      return HttpResponse.json(SUMMARY)
    }))
    const none = renderWithClient(<NotificationBannerSlot metaData={WITH_ALERTS} enabled />)
    await waitFor(() => expect(calls).toBe(1))
    expect(none.container).toBeEmptyDOMElement()
    const signedOut = renderWithClient(<NotificationBannerSlot metaData={WITH_ALERTS} enabled={false} />)
    await sleep(50)
    expect(calls).toBe(1)
    expect(signedOut.container).toBeEmptyDOMElement()
  })
})
