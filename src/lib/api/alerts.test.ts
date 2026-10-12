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
import { getAlertsInboxSummary, getAlertsRecordPanel, markAlertsRead, watchAlertsRecord } from './alerts'

describe('getAlertsInboxSummary', () => {
  it('returns the summary, with defaults filled in', async () => {
    server.use(http.get('/qqq/v1/alerts/inbox/summary', () => HttpResponse.json({ unreadCount: 1, items: [] })))
    await expect(getAlertsInboxSummary()).resolves.toEqual({ unreadCount: 1, highestUnreadSeverity: null, items: [], alertsHref: '/app/alerts', pollSeconds: undefined })
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

describe('markAlertsRead and watchAlertsRecord', () => {
  it('posts JSON bodies and returns the counts', async () => {
    const bodies: unknown[] = []
    server.use(
      http.post('/qqq/v1/alerts/inbox/read', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ updated: 3 })
      }),
      http.post('/qqq/v1/alerts/record-panel/watch', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ created: true })
      })
    )
    await expect(markAlertsRead({ all: true })).resolves.toBe(3)
    await expect(watchAlertsRecord('blog_post', 5)).resolves.toBe(true)
    expect(bodies).toEqual([{ all: true }, { tableName: 'blog_post', recordId: 5 }])
  })

  it('treats odd bodies as zero / false', async () => {
    server.use(
      http.post('/qqq/v1/alerts/inbox/read', () => HttpResponse.json({})),
      http.post('/qqq/v1/alerts/record-panel/watch', () => HttpResponse.json({ created: false }))
    )
    await expect(markAlertsRead({ alertId: 1 })).resolves.toBe(0)
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
