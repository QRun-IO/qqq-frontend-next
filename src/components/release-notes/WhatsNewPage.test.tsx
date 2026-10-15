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

/** @file Release history behavior and safe content tests. */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { beforeEach, expect, it, vi } from 'vitest'
import { server } from '@/mocks/node'
import { uiApiVersionHandler } from '@/mocks/ui-api-version'
import { queryKeys } from '@/lib/query-client'

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: nav.push }), useSearchParams: () => nav.params }))
vi.mock('@/lib/context/q-context', () => ({ useQContext: () => ({ setPageHeader: vi.fn() }) }))
import { WhatsNewPage } from './WhatsNewPage'

const seen = vi.fn()
const release = (id: number) => ({ id, title: `Release ${id}`, version: '1.0', publishedAt: '2026-10-01T00:00:00Z', isNew: true, summary: 'Summary', items: [
  { category: 'NEW', categoryLabel: 'New features', text: 'App link', linkUrl: '/app/example', screenshotUrl: '/images/example.png' },
  { category: 'FIXED', categoryLabel: 'Fixes', text: 'External link', linkUrl: 'https://example.com' },
  { category: 'FIXED', categoryLabel: 'Fixes', text: 'Unsafe script', linkUrl: 'javascript:alert(1)', screenshotUrl: '//evil.test/image' },
  { category: 'FIXED', categoryLabel: 'Fixes', text: 'Unsafe host', linkUrl: '//evil.test' },
] })
function serve(releases: unknown[], total = releases.length) {
  server.use(http.get('/qqq/v1/qbit/release-notes/releases', () => HttpResponse.json({ releases, total })))
}
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  return { ...render(<React.StrictMode><QueryClientProvider client={client}><WhatsNewPage /></QueryClientProvider></React.StrictMode>), invalidate }
}
beforeEach(() => {
  nav.params = new URLSearchParams()
  nav.push.mockReset()
  seen.mockReset()
  server.use(uiApiVersionHandler('release-notes'), http.post('/qqq/v1/qbit/release-notes/seen', () => { seen(); return HttpResponse.json({ unreadCount: 0 }) }))
})
it('groups items, keeps New badges, marks seen once and refreshes summary', async () => {
  serve([release(2)])
  const { invalidate } = mount()
  const card = await screen.findByRole('region', { name: 'Release 2' })
  expect(within(card).getByRole('heading', { name: 'New features' })).toBeInTheDocument()
  expect(within(card).getByRole('heading', { name: 'Fixes' })).toBeInTheDocument()
  await waitFor(() => expect(seen).toHaveBeenCalledTimes(1))
  expect(screen.getByText('New', { exact: true })).toBeInTheDocument()
  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.releaseNotesSummary() }))
})
it('renders safe links and images and navigates app links', async () => {
  serve([release(2)])
  mount()
  const app = await screen.findByRole('link', { name: 'App link' })
  await userEvent.click(app)
  expect(nav.push).toHaveBeenCalledWith('/app/example')
  expect(screen.getByRole('link', { name: 'External link' })).toHaveAttribute('rel', 'noopener noreferrer')
  expect(screen.getByRole('link', { name: 'External link' })).toHaveAttribute('target', '_blank')
  expect(screen.queryByRole('link', { name: /Unsafe/ })).not.toBeInTheDocument()
  expect(screen.getAllByRole('img')).toHaveLength(1)
  expect(screen.getByAltText('App link')).toHaveAttribute('loading', 'lazy')
})
it('shows the empty state', async () => {
  serve([]); mount()
  expect(await screen.findByText('No release notes yet. When a new version is published, it will appear here.')).toBeInTheDocument()
})
it('does not request releases when not installed', async () => {
  server.use(uiApiVersionHandler())
  const requests = vi.fn()
  server.use(http.get('/qqq/v1/qbit/release-notes/releases', () => { requests(); return HttpResponse.json({ releases: [] }) }))
  mount()
  expect(await screen.findByText("What's new isn't available on this server.")).toBeInTheDocument()
  expect(requests).not.toHaveBeenCalled()
  expect(seen).not.toHaveBeenCalled()
})
it('appends older releases and highlights a deep link once loaded', async () => {
  nav.params = new URLSearchParams('release=1')
  const scroll = vi.fn()
  HTMLElement.prototype.scrollIntoView = scroll
  const offsets: string[] = []
  server.use(http.get('/qqq/v1/qbit/release-notes/releases', ({ request }) => {
    const offset = new URL(request.url).searchParams.get('offset')!
    offsets.push(offset)
    return HttpResponse.json({ releases: [release(offset === '0' ? 2 : 1)], total: 11 })
  }))
  mount()
  await userEvent.click(await screen.findByRole('button', { name: 'Show older releases' }))
  expect(await screen.findByRole('region', { name: 'Release 1' })).toHaveClass('ring-2')
  expect(screen.getByRole('region', { name: 'Release 2' })).toBeInTheDocument()
  expect(offsets).toEqual(['0', '10'])
  await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1))
  expect(seen).toHaveBeenCalledTimes(1)
})
it('offers Retry after a failed first load without marking seen', async () => {
  server.use(http.get('/qqq/v1/qbit/release-notes/releases', () => new HttpResponse(null, { status: 500 })))
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load release notes.')
  expect(seen).not.toHaveBeenCalled()
  serve([release(3)])
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('region', { name: 'Release 3' })).toBeInTheDocument()
})
