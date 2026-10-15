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

/** @file Release notes normalization and HTTP contract tests. */
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/mocks/node'
import { getReleaseNotes, getReleaseNotesSummary, markReleaseNotesSeen } from './release-notes'

describe('release notes client', () => {
  it('gets a page with limit and offset and normalizes invalid fields', async () => {
    server.use(http.get('/qqq/v1/qbit/release-notes/releases', ({ request }) => {
      expect(new URL(request.url).search).toBe('?limit=10&offset=20')
      return HttpResponse.json({ releases: [null, {}, { id: 1, title: 'Release', isNew: 'true', publishedAt: 'bad', items: [null, { category: 'UNKNOWN', text: 'bad' }, { category: 'FIXED', text: 'Works', linkUrl: 3 }] }], total: -1, unreadCount: '5', lastSeenAt: 'bad' })
    }))
    expect(await getReleaseNotes(10, 20)).toEqual({ releases: [{ id: 1, title: 'Release', version: '', publishedAt: '', summary: null, isNew: false, items: [{ category: 'FIXED', categoryLabel: 'Fixed', text: 'Works', linkUrl: null, screenshotUrl: null }] }], total: 1, unreadCount: 0, lastSeenAt: null })
  })
  it.each([null, [], 'invalid', {}])('handles a malformed page: %j', async (body) => {
    server.use(http.get('/qqq/v1/qbit/release-notes/releases', () => HttpResponse.json(body)))
    expect(await getReleaseNotes(10, 0)).toEqual({ releases: [], total: 0, unreadCount: 0, lastSeenAt: null })
  })
  it('gets and normalizes the summary', async () => {
    server.use(http.get('/qqq/v1/qbit/release-notes/summary', () => HttpResponse.json({ unreadCount: 2, latest: { id: 4, title: 'Four', version: '4', publishedAt: '2026-10-01T00:00:00Z' } })))
    expect(await getReleaseNotesSummary()).toMatchObject({ unreadCount: 2, latest: { id: 4, title: 'Four' } })
    server.use(http.get('/qqq/v1/qbit/release-notes/summary', () => HttpResponse.json({ unreadCount: -2, latest: {} })))
    expect(await getReleaseNotesSummary()).toEqual({ unreadCount: 0, latest: null })
  })
  it('posts seen without a body', async () => {
    server.use(http.post('/qqq/v1/qbit/release-notes/seen', async ({ request }) => {
      expect(await request.text()).toBe('')
      return HttpResponse.json({ unreadCount: 0 })
    }))
    expect(await markReleaseNotesSeen()).toEqual({ unreadCount: 0 })
  })
})
