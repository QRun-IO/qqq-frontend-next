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

// Tests for the Alerts API client

import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '@/mocks/node'
import { getAlertsInbox, getAlertsInboxSummary, getAlertsRecordPanel, normalizeInboxItem, postInboxAction, watchAlertsRecord } from './alerts'

describe('getAlertsInboxSummary', () => {
  it('returns the summary, with defaults filled in', async () => {
    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json({ unreadCount: 1, items: [] })))
    await expect(getAlertsInboxSummary()).resolves.toEqual({ unreadCount: 1, highestUnreadSeverity: null, items: [], banners: [], notificationsHref: '/app/notifications', preferencesSection: null, pollSeconds: undefined })
  })

  it('normalizes items and banners, and keeps an app notificationsHref', async () => {
    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json({
      unreadCount: 1,
      highestUnreadSeverity: 'SUCCESS',
      notificationsHref: '/app/inbox',
      preferencesSection: 'notifications',
      pollSeconds: 30,
      items: [{ id: 3, title: 'Hi', severity: 'SUCCESS', category: 'JOB', source: 'Jobs', unread: true }, { title: '' }, null],
      banners: [{ id: 4, title: 'Down tonight', severity: 'WARNING', body: '**soon**', sticky: true }],
    })))
    const summary = await getAlertsInboxSummary()
    expect(summary?.highestUnreadSeverity).toBe('SUCCESS')
    expect(summary?.notificationsHref).toBe('/app/inbox')
    expect(summary?.pollSeconds).toBe(30)
    expect(summary?.preferencesSection).toBe('notifications')
    expect(summary?.items).toEqual([expect.objectContaining({ key: 'n3', id: 3, title: 'Hi', category: 'JOB', source: 'Jobs', unread: true })])
    expect(summary?.banners).toEqual([expect.objectContaining({ key: 'n4', body: '**soon**', sticky: true, unread: false })])

    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json({ unreadCount: 0, items: [], notificationsHref: 'https://evil.example', highestUnreadSeverity: 'BOGUS' })))
    await expect(getAlertsInboxSummary()).resolves.toMatchObject({ notificationsHref: '/app/notifications', highestUnreadSeverity: null })
  })

  it('returns null for 403, 404, and non-summary bodies', async () => {
    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => new HttpResponse(null, { status: 403 })))
    await expect(getAlertsInboxSummary()).resolves.toBeNull()
    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => new HttpResponse(null, { status: 404 })))
    await expect(getAlertsInboxSummary()).resolves.toBeNull()
    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json([1, 2])))
    await expect(getAlertsInboxSummary()).resolves.toBeNull()
    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json({ unreadCount: 'x', items: [] })))
    await expect(getAlertsInboxSummary()).resolves.toBeNull()
  })

  it('throws other errors', async () => {
    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => new HttpResponse(null, { status: 500 })))
    await expect(getAlertsInboxSummary()).rejects.toBeTruthy()
  })
})

describe('normalizeInboxItem', () => {
  it('reads older backends: alertId, group and raisedAt', () => {
    expect(normalizeInboxItem({ alertId: 6, title: 'Old', severity: 'ERROR', group: 'CDN', raisedAt: '2026-10-01T00:00:00Z', status: 'OPEN' }, 0)).toEqual({
      key: 'a6', id: undefined, notificationId: undefined, alertId: 6, title: 'Old', body: null, severity: 'ERROR', category: null, source: 'CDN',
      href: null, linkLabel: null, deliveredAt: '2026-10-01T00:00:00Z', age: null, unread: false, sticky: false,
    })
    expect(normalizeInboxItem({ title: 'Bare', severity: 'NOPE' }, 2)).toMatchObject({ key: 'i2', severity: 'INFO' })
    expect(normalizeInboxItem('x', 0)).toBeNull()
  })
})

describe('getAlertsInbox', () => {
  it('sends the filter and normalizes the page', async () => {
    let query: URLSearchParams | null = null
    server.use(http.get('/qqq/v1/alerts/inbox', ({ request }) => {
      query = new URL(request.url).searchParams
      return HttpResponse.json({ items: [{ id: 1, title: 'A', severity: 'INFO' }], total: 40, offset: 25, limit: 25 })
    }))
    await expect(getAlertsInbox({ status: 'unread', category: 'JOB', severity: 'ERROR', offset: 25, limit: 25 })).resolves.toMatchObject({ total: 40, offset: 25, limit: 25, items: [{ id: 1 }] })
    expect(Object.fromEntries(query!)).toEqual({ status: 'unread', category: 'JOB', severity: 'ERROR', offset: '25', limit: '25' })
  })

  it('fills paging from the filter for a sparse body', async () => {
    server.use(http.get('/qqq/v1/alerts/inbox', () => HttpResponse.json({ items: [{ id: 1, title: 'A' }] })))
    await expect(getAlertsInbox({ status: 'all', category: '', severity: '', offset: 0, limit: 25 })).resolves.toMatchObject({ total: 1, offset: 0, limit: 25 })
    server.use(http.get('/qqq/v1/alerts/inbox', () => HttpResponse.json(null)))
    await expect(getAlertsInbox({ status: 'all', category: '', severity: '', offset: 0, limit: 25 })).resolves.toMatchObject({ items: [], total: 0 })
  })
})

describe('postInboxAction and watchAlertsRecord', () => {
  it('posts JSON bodies and returns the counts', async () => {
    const bodies: unknown[] = []
    server.use(
      http.post('/qqq/v1/alerts/inbox/:action', async ({ request, params }) => {
        bodies.push([params.action, await request.json()])
        return HttpResponse.json({ updated: 3 })
      }),
      http.post('/qqq/v1/alerts/record-panel/watch', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ created: true })
      })
    )
    await expect(postInboxAction('read', { all: true })).resolves.toBe(3)
    await expect(postInboxAction('unread', { id: 4 })).resolves.toBe(3)
    await expect(postInboxAction('dismiss', { ids: [4, 5] })).resolves.toBe(3)
    await expect(watchAlertsRecord('blog_post', 5)).resolves.toBe(true)
    expect(bodies).toEqual([['read', { all: true }], ['unread', { id: 4 }], ['dismiss', { ids: [4, 5] }], { tableName: 'blog_post', recordId: 5 }])
  })

  it('treats odd bodies as zero / false', async () => {
    server.use(
      http.post('/qqq/v1/alerts/inbox/read', () => HttpResponse.json({})),
      http.post('/qqq/v1/alerts/record-panel/watch', () => HttpResponse.json({ created: false }))
    )
    await expect(postInboxAction('read', { alertId: 1 })).resolves.toBe(0)
    await expect(watchAlertsRecord('blog_post', 5)).resolves.toBe(false)
  })
})

describe('getAlertsRecordPanel', () => {
  it('passes the table and record and returns the panel', async () => {
    server.use(http.get('/qqq/v1/alerts/record-panel', ({ request }) => {
      const url = new URL(request.url)
      return HttpResponse.json({ visible: url.searchParams.get('tableName') === 'blog_post' && url.searchParams.get('recordId') === '7', open: [] })
    }))
    await expect(getAlertsRecordPanel('blog_post', 7)).resolves.toMatchObject({ visible: true })
  })

  it('returns null for 400, 403, 404, and non-panel bodies; throws others', async () => {
    for(const status of [400, 403, 404])
    {
      server.use(http.get('/qqq/v1/alerts/record-panel', () => new HttpResponse(null, { status })))
      await expect(getAlertsRecordPanel('t', 1)).resolves.toBeNull()
    }
    server.use(http.get('/qqq/v1/alerts/record-panel', () => HttpResponse.json({ nope: true })))
    await expect(getAlertsRecordPanel('t', 1)).resolves.toBeNull()
    server.use(http.get('/qqq/v1/alerts/record-panel', () => new HttpResponse(null, { status: 500 })))
    await expect(getAlertsRecordPanel('t', 1)).rejects.toBeTruthy()
  })
})
