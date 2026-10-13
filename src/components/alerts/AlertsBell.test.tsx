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

// Tests for the Alerts record panel: metadata gating (no request without the qbit's app) and the
// panel's hidden / open / watch states. The bell, popover and banners are in
// NotificationCenter.test.tsx.

import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'jest-axe'

import { server } from '@/mocks/node'
import type { AlertsRecordPanel } from '@/types/alerts'
import type { QInstance } from '@/types/metadata'
import { isAlertsInstalled } from './AlertsBell'
import { AlertsRecordPanelSlot } from './AlertsRecordPanelSlot'

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

/** The inbox summary (the record panel shows only when it loads). */
const SUMMARY = { unreadCount: 0, highestUnreadSeverity: null, notificationsHref: '/app/notifications', items: [], banners: [] }

const PANEL: AlertsRecordPanel = {
  visible: true,
  openCount: 1,
  open: [{ alertId: 9, title: 'Post has no excerpt', severity: 'WARNING', status: 'OPEN', group: 'Content', age: '1 d', href: '/app/alerts_alert/9' }],
  resolvedLast30Days: 2,
  viewAllHref: '/app/alerts_alert?filter=x',
  canManage: true,
  watching: false,
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

describe('isAlertsInstalled', () => {
  it('is true only when the metadata lists the alerts app', () => {
    expect(isAlertsInstalled(WITH_ALERTS)).toBe(true)
    expect(isAlertsInstalled(WITHOUT_ALERTS)).toBe(false)
    expect(isAlertsInstalled(undefined)).toBe(false)
  })
})

describe('AlertsRecordPanelSlot', () => {
  it('sends no request when the metadata does not announce Alerts', async () => {
    let calls = 0
    server.use(
      http.get('/qqq/v1/alerts/inbox/summary', () => {
        calls++
        return HttpResponse.json(SUMMARY)
      }),
      http.get('/qqq/v1/alerts/record-panel', () => {
        calls++
        return HttpResponse.json(PANEL)
      })
    )
    const { container } = renderWithClient(<AlertsRecordPanelSlot metaData={WITHOUT_ALERTS} tableName="blog_post" recordId="1" />)
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(container).toBeEmptyDOMElement()
    expect(calls).toBe(0)
  })

  it('renders nothing when the backend still answers that Alerts is not available', async () => {
    let panelCalls = 0
    server.use(
      http.get('/qqq/v1/alerts/inbox/summary', () => new HttpResponse(null, { status: 403 })),
      http.get('/qqq/v1/alerts/record-panel', () => {
        panelCalls++
        return HttpResponse.json(PANEL)
      })
    )
    const { container } = renderWithClient(<AlertsRecordPanelSlot metaData={WITH_ALERTS} tableName="blog_post" recordId="1" />)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(container).toBeEmptyDOMElement()
    expect(panelCalls).toBe(0)
  })

  it('renders nothing on the Alerts tables themselves, or when the record has nothing to show', async () => {
    server.use(
      http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json(SUMMARY)),
      http.get('/qqq/v1/alerts/record-panel', () => HttpResponse.json({ ...PANEL, visible: false, open: [], openCount: 0, resolvedLast30Days: 0 }))
    )
    const own = renderWithClient(<AlertsRecordPanelSlot metaData={WITH_ALERTS} tableName="alerts_alert" recordId="1" />)
    const none = renderWithClient(<AlertsRecordPanelSlot metaData={WITH_ALERTS} tableName="blog_post" recordId="1" />)
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
    renderWithClient(<AlertsRecordPanelSlot metaData={WITH_ALERTS} tableName="blog_post" recordId="5" />)
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
