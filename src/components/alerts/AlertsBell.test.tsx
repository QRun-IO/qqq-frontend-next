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

// Tests for the Alerts bell, its popover, and the record panel: probe gating, badge, a11y,
// mark read, keyboard, and the panel's hidden / open / watch states.

import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'jest-axe'

import { server } from '@/mocks/node'
import type { AlertsInboxSummary, AlertsRecordPanel } from '@/types/alerts'
import { AlertsBell } from './AlertsBell'
import { AlertsRecordPanelSlot } from './AlertsRecordPanelSlot'

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

const SUMMARY: AlertsInboxSummary = {
  unreadCount: 2,
  highestUnreadSeverity: 'CRITICAL',
  alertsHref: '/app/alerts',
  pollSeconds: 60,
  items: [
    { alertId: 7, title: 'Nightly backup did not run', severity: 'CRITICAL', status: 'OPEN', group: 'Backups', age: '3 h', href: '/app/alerts_alert/7', unread: true },
    { alertId: 6, title: '3 CDN purges failed', severity: 'ERROR', status: 'OPEN', group: 'CDN', age: '20 min', href: '/app/alerts_alert/6', unread: true },
    { alertId: 2, title: 'Old warning', severity: 'WARNING', status: 'ACKNOWLEDGED', group: null, age: '2 d', href: '/app/alerts_alert/2', unread: false },
  ],
}

const PANEL: AlertsRecordPanel = {
  visible: true,
  openCount: 1,
  open: [{ alertId: 9, title: 'Post has no excerpt', severity: 'WARNING', status: 'OPEN', group: 'Content', age: '1 d', href: '/app/alerts_alert/9' }],
  resolvedLast30Days: 2,
  viewAllHref: '/app/alerts_alert?filter=x',
  canManage: true,
  watching: false,
}

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

describe('AlertsBell', () => {
  beforeEach(() => {
    router.push.mockReset()
  })

  it('renders nothing when Alerts is not available (403 or 404)', async () => {
    let calls = 0
    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => {
      calls++
      return new HttpResponse(null, { status: 404 })
    }))
    const { container } = renderWithClient(<AlertsBell />)
    await waitFor(() => expect(calls).toBe(1))
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for a body that is not a summary', async () => {
    let calls = 0
    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => {
      calls++
      return HttpResponse.json({ hello: 'world' })
    }))
    const { container } = renderWithClient(<AlertsBell />)
    await waitFor(() => expect(calls).toBe(1))
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the unread count, red for critical, with an accessible label', async () => {
    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json(SUMMARY)))
    renderWithClient(<AlertsBell />)
    const bell = await screen.findByRole('button', { name: 'Alerts, 2 unread' })
    expect(bell).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('2', { selector: '[data-qqq-id="alerts-unread-badge"]' })).toHaveClass('bg-destructive')
    expect(document.querySelector('[data-qqq-id="alerts-unread-announcer"]')).toHaveAttribute('aria-live', 'polite')
  })

  it('opens the popover, opens an item (marking it read), and closes on Escape', async () => {
    let readBody: unknown = null
    server.use(
      http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json(SUMMARY)),
      http.post('/qqq/v1/alerts/inbox/read', async ({ request }) => {
        readBody = await request.json()
        return HttpResponse.json({ updated: 1 })
      })
    )
    const user = userEvent.setup()
    renderWithClient(<AlertsBell />)
    const bell = await screen.findByRole('button', { name: 'Alerts, 2 unread' })
    await user.click(bell)
    const dialog = await screen.findByRole('dialog', { name: 'Alerts' })
    expect(await axe(dialog)).toHaveNoViolations()
    const items = within(dialog).getAllByRole('link')
    expect(items[0]).toHaveTextContent('Nightly backup did not run')
    expect(items[0]).toHaveTextContent('Backups · 3 h ago')
    await waitFor(() => expect(items[0]).toHaveFocus())

    await user.click(items[0])
    expect(router.push).toHaveBeenCalledWith('/app/alerts_alert/7')
    await waitFor(() => expect(readBody).toEqual({ alertId: 7 }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(bell)
    await screen.findByRole('dialog', { name: 'Alerts' })
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(bell).toHaveFocus()
  })

  it('marks all read and opens the Alerts app', async () => {
    let readBody: unknown = null
    server.use(
      http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json(SUMMARY)),
      http.post('/qqq/v1/alerts/inbox/read', async ({ request }) => {
        readBody = await request.json()
        return HttpResponse.json({ updated: 2 })
      })
    )
    const user = userEvent.setup()
    renderWithClient(<AlertsBell />)
    await user.click(await screen.findByRole('button', { name: 'Alerts, 2 unread' }))
    await user.click(await screen.findByRole('button', { name: 'Mark all read' }))
    await waitFor(() => expect(readBody).toEqual({ all: true }))
    await user.click(screen.getByRole('link', { name: 'Open Alerts' }))
    expect(router.push).toHaveBeenCalledWith('/app/alerts')
  })

  it('shows an empty state with no items', async () => {
    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json({ ...SUMMARY, unreadCount: 0, highestUnreadSeverity: null, items: [] })))
    const user = userEvent.setup()
    renderWithClient(<AlertsBell />)
    await user.click(await screen.findByRole('button', { name: 'Alerts, none unread' }))
    expect(await screen.findByText('Nothing needs you right now.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark all read' })).toBeDisabled()
  })
})

describe('AlertsRecordPanelSlot', () => {
  it('renders nothing when Alerts is not available', async () => {
    let panelCalls = 0
    server.use(
      http.get('/qqq/v1/alerts/inbox/summary', () => new HttpResponse(null, { status: 403 })),
      http.get('/qqq/v1/alerts/record-panel', () => {
        panelCalls++
        return HttpResponse.json(PANEL)
      })
    )
    const { container } = renderWithClient(<AlertsRecordPanelSlot tableName="blog_post" recordId="1" />)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(container).toBeEmptyDOMElement()
    expect(panelCalls).toBe(0)
  })

  it('renders nothing on the Alerts tables themselves, or when the record has nothing to show', async () => {
    server.use(
      http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json(SUMMARY)),
      http.get('/qqq/v1/alerts/record-panel', () => HttpResponse.json({ ...PANEL, visible: false, open: [], openCount: 0, resolvedLast30Days: 0 }))
    )
    const own = renderWithClient(<AlertsRecordPanelSlot tableName="alerts_alert" recordId="1" />)
    const none = renderWithClient(<AlertsRecordPanelSlot tableName="blog_post" recordId="1" />)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(own.container).toBeEmptyDOMElement()
    expect(none.container).toBeEmptyDOMElement()
  })

  it('shows open alerts with actions, recent resolutions, and watches the record', async () => {
    let watched: unknown = null
    let panel = PANEL
    server.use(
      http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json(SUMMARY)),
      http.get('/qqq/v1/alerts/record-panel', ({ request }) => {
        const url = new URL(request.url)
        expect(url.searchParams.get('tableName')).toBe('blog_post')
        expect(url.searchParams.get('recordId')).toBe('5')
        return HttpResponse.json(panel)
      }),
      http.post('/qqq/v1/alerts/record-panel/watch', async ({ request }) => {
        watched = await request.json()
        panel = { ...PANEL, watching: true }
        return HttpResponse.json({ watching: true, created: true })
      })
    )
    const user = userEvent.setup()
    renderWithClient(<AlertsRecordPanelSlot tableName="blog_post" recordId="5" />)
    const section = await screen.findByRole('region', { name: 'Open alerts (1)' })
    expect(await axe(section)).toHaveNoViolations()
    expect(within(section).getByRole('link', { name: 'Post has no excerpt' })).toHaveAttribute('href', '/app/alerts_alert/9')
    expect(within(section).getByRole('link', { name: 'Acknowledge' })).toHaveAttribute('href', '/app/alertsAcknowledge?recordsParam=recordIds&recordIds=9&tableName=alerts_alert')
    expect(within(section).getByRole('link', { name: 'Snooze' })).toBeInTheDocument()
    expect(within(section).getByText('2 resolved in the last 30 days')).toBeInTheDocument()

    await user.click(within(section).getByRole('button', { name: 'Watch alerts for this record' }))
    await waitFor(() => expect(watched).toEqual({ tableName: 'blog_post', recordId: '5' }))
    expect(await within(section).findByText("You watch this record's alerts")).toBeInTheDocument()
  })
})
