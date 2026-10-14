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

// Tests for the notifications page: extension gating, filters and paging in the URL, the inbox
// query, safe markdown bodies, actions, and empty and error states.

import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'jest-axe'

import { uiApiVersionHandler } from '@/mocks/ui-api-version'
import { server } from '@/mocks/node'

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), push: vi.fn(), replace: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/app/notifications',
  useSearchParams: () => nav.params,
}))
vi.mock('@/lib/context/q-context', () => ({ useQContext: () => ({ setPageHeader: vi.fn() }) }))

import { NotificationsPage, filterFromParams } from './NotificationsPage'

/** One inbox item. */
function item(id: number, overrides: Record<string, unknown> = {}) {
  return { id, notificationId: id, title: `Notice ${id}`, severity: 'INFO', category: 'SYSTEM', source: 'QQQ', age: '1 h', unread: false, ...overrides }
}

/**
 * Renders the page with a fresh query client.
 *
 * @returns The render result.
 */
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <NotificationsPage />
    </QueryClientProvider>
  )
}

/**
 * Serves the inbox, recording each request's query.
 *
 * @param page - The response.
 * @returns The recorded queries.
 */
function serveInbox(page: Record<string, unknown>): URLSearchParams[] {
  const queries: URLSearchParams[] = []
  server.use(http.get('/qqq/v1/alerts/inbox', ({ request }) => {
    queries.push(new URL(request.url).searchParams)
    return HttpResponse.json(page)
  }))
  return queries
}

describe('filterFromParams', () => {
  it('reads status, category, severity and offset, with safe defaults', () => {
    expect(filterFromParams(new URLSearchParams('status=unread&category=JOB&severity=ERROR&offset=25'))).toEqual({ status: 'unread', category: 'JOB', severity: 'ERROR', offset: 25, limit: 25 })
    expect(filterFromParams(new URLSearchParams('status=bogus&offset=-4'))).toEqual({ status: 'all', category: '', severity: '', offset: 0, limit: 25 })
  })
})

describe('NotificationsPage', () => {
  beforeEach(() => {
    server.use(uiApiVersionHandler('alerts'))
    nav.params = new URLSearchParams()
    nav.push.mockReset()
    nav.replace.mockReset()
  })

  it('sends no inbox request without the Alerts extension', async () => {
    server.use(uiApiVersionHandler())
    const queries = serveInbox({ items: [], total: 0 })
    renderPage()
    expect(await screen.findByText('Notifications are not available.')).toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(queries).toHaveLength(0)
  })

  it('lists notifications with markdown bodies rendered without HTML', async () => {
    const queries = serveInbox({
      items: [
        item(5, { title: 'Export finished', severity: 'SUCCESS', category: 'JOB', body: 'Your **export** is ready. <img src=x onerror=alert(1)>', href: '/app/exports/5', linkLabel: 'Download', unread: true }),
        item(4, { title: 'Key rotated', severity: 'CRITICAL', category: 'SECURITY', body: '[docs](https://qrun.io/docs) and [bad](javascript:alert(1))' }),
      ],
      total: 2,
      offset: 0,
      limit: 25,
    })
    const reads: unknown[] = []
    server.use(http.post('/qqq/v1/alerts/inbox/read', async ({ request }) => {
      reads.push(await request.json())
      return HttpResponse.json({ updated: 1 })
    }))
    const user = userEvent.setup()
    const { container } = renderPage()
    const list = await screen.findByRole('list', { name: 'Notifications' })
    expect(await axe(container)).toHaveNoViolations()
    expect(queries[0].get('status')).toBe('all')
    expect(queries[0].get('offset')).toBe('0')
    expect(queries[0].get('limit')).toBe('25')
    expect(queries[0].has('category')).toBe(false)

    const items = within(list).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Job · QQQ · 1 h ago')
    expect(within(items[0]).getByText('export').tagName).toBe('STRONG')
    expect(container.querySelector('img')).toBeNull()
    expect(within(items[0]).getByText('(unread)', { exact: false })).toBeInTheDocument()
    expect(within(items[1]).getByText('Critical')).toBeInTheDocument()
    expect(within(items[1]).getByRole('link', { name: 'docs' })).toHaveAttribute('href', 'https://qrun.io/docs')
    expect(within(items[1]).queryByRole('link', { name: 'bad' })).not.toBeInTheDocument()
    expect(screen.getByText('1–2 of 2')).toBeInTheDocument()

    await user.click(within(items[0]).getByRole('link', { name: 'Download' }))
    expect(nav.push).toHaveBeenCalledWith('/app/exports/5')
    await waitFor(() => expect(reads).toEqual([{ id: 5 }]))
  })

  it('puts filters in the URL and sends them to the inbox', async () => {
    nav.params = new URLSearchParams('status=unread&category=SECURITY&severity=ERROR&offset=25')
    const queries = serveInbox({ items: [], total: 0, offset: 25, limit: 25 })
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('No notifications match these filters.')).toBeInTheDocument()
    expect(queries[0].get('status')).toBe('unread')
    expect(queries[0].get('category')).toBe('SECURITY')
    expect(queries[0].get('severity')).toBe('ERROR')
    expect(queries[0].get('offset')).toBe('25')
    expect(screen.getByRole('button', { name: 'Unread' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'All' }))
    expect(nav.replace).toHaveBeenLastCalledWith('/app/notifications?category=SECURITY&severity=ERROR', { scroll: false })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Category' }), 'RELEASE')
    expect(nav.replace).toHaveBeenLastCalledWith('/app/notifications?status=unread&category=RELEASE&severity=ERROR', { scroll: false })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Severity' }), '')
    expect(nav.replace).toHaveBeenLastCalledWith('/app/notifications?status=unread&category=SECURITY', { scroll: false })
  })

  it('pages through the inbox', async () => {
    nav.params = new URLSearchParams('offset=25')
    serveInbox({ items: Array.from({ length: 25 }, (_, index) => item(100 - index)), total: 60, offset: 25, limit: 25 })
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('26–50 of 60')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(nav.replace).toHaveBeenLastCalledWith('/app/notifications?offset=50', { scroll: false })
    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(nav.replace).toHaveBeenLastCalledWith('/app/notifications', { scroll: false })
  })

  it('marks read, unread and all read, and dismisses at once', async () => {
    serveInbox({ items: [item(1, { unread: true }), item(2)], total: 2, offset: 0, limit: 25 })
    const bodies: Array<[string, unknown]> = []
    server.use(http.post('/qqq/v1/alerts/inbox/:action', async ({ request, params }) => {
      bodies.push([String(params.action), await request.json()])
      return HttpResponse.json({ updated: 1 })
    }))
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('list', { name: 'Notifications' })
    await user.click(screen.getByRole('button', { name: 'Mark read: Notice 1' }))
    await user.click(screen.getByRole('button', { name: 'Mark unread: Notice 2' }))
    await user.click(screen.getByRole('button', { name: 'Mark all read' }))
    await user.click(screen.getByRole('button', { name: 'Dismiss: Notice 2' }))
    await waitFor(() => expect(bodies).toEqual([['read', { id: 1 }], ['unread', { id: 2 }], ['read', { all: true }], ['dismiss', { id: 2 }]]))
  })

  it('shows older items without actions, and the empty and error states', async () => {
    serveInbox({ items: [{ alertId: 3, title: 'Legacy alert', severity: 'ERROR', group: 'CDN', age: '2 h', unread: true }], total: 1 })
    const first = renderPage()
    const list = await screen.findByRole('list', { name: 'Notifications' })
    expect(list).toHaveTextContent('CDN · 2 h ago')
    expect(within(list).queryByRole('button')).not.toBeInTheDocument()
    first.unmount()

    serveInbox({ items: [], total: 0 })
    const empty = renderPage()
    expect(await screen.findByText('You have no notifications.')).toBeInTheDocument()
    empty.unmount()

    server.use(http.get('/qqq/v1/alerts/inbox', () => new HttpResponse(null, { status: 500 })))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load notifications.')
    serveInbox({ items: [item(9)], total: 1 })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Notice 9')).toBeInTheDocument()
  })
})
