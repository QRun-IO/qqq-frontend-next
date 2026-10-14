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

// Tests for searchRecords (POST /search): request body compatibility, the extended response
// (scores, highlights, details, per-table summaries, provider status) and invalid responses

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({ default: { post: vi.fn() } }))

import apiClient from './client'
import { RecordSearchResponseError, searchRecords, validMatches } from './record-search'

describe('searchRecords', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts only the term, table scope and limit by default (the original contract)', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ results: [{ tableName: 'person', tableLabel: 'People', recordId: '1', recordLabel: 'Alice' }] })
    const response = await searchRecords('Alice', { tableNames: ['person'], limitPerTable: 5 })
    expect(apiClient.post).toHaveBeenCalledWith('/search', { searchTerm: 'Alice', tableNames: ['person'], limitPerTable: 5 })
    expect(response).toEqual({ results: [{ tableName: 'person', tableLabel: 'People', recordId: '1', recordLabel: 'Alice' }], tables: undefined, provider: undefined })
  })

  it('sends only the term when no options are given', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ results: [] })
    await expect(searchRecords('x')).resolves.toMatchObject({ results: [] })
    expect(apiClient.post).toHaveBeenCalledWith('/search', { searchTerm: 'x' })
  })

  it('adds offset and RECENT order only when requested, and passes the abort signal', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ results: [] })
    const controller = new AbortController()
    await searchRecords('x', { tableNames: ['person'], limitPerTable: 25, offset: 25, sort: 'recent', signal: controller.signal })
    expect(apiClient.post).toHaveBeenCalledWith('/search', { searchTerm: 'x', tableNames: ['person'], limitPerTable: 25, offset: 25, sort: 'RECENT' }, { signal: controller.signal })
  })

  it('normalizes the extended response: scores, highlights (invalid ranges dropped), details, summaries, provider', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      results: [{
        tableName: 'person', tableLabel: 'People', recordId: 7, recordLabel: null, score: 4.5, updatedAt: '2026-10-01T12:00:00Z',
        highlights: [{ fieldName: 'email', fieldLabel: 'Email', text: 'alice@acme.io', matches: [{ start: 6, end: 10 }, { start: 8, end: 9 }, { start: 11, end: 99 }] }],
        details: [{ fieldName: 'city', fieldLabel: null, displayValue: 'Austin' }],
      }],
      tables: [{ tableName: 'person', tableLabel: 'People', resultCount: 1, hasMore: true, totalCount: 40, source: 'FALLBACK' }],
      provider: { status: 'FAILED', failureClass: 'ConnectException', message: 'Connection refused' },
    })
    const response = await searchRecords('acme')
    expect(response.results[0]).toEqual({
      tableName: 'person', tableLabel: 'People', recordId: '7', recordLabel: 'People 7', score: 4.5, updatedAt: '2026-10-01T12:00:00Z',
      highlights: [{ fieldName: 'email', fieldLabel: 'Email', text: 'alice@acme.io', matches: [{ start: 6, end: 10 }] }],
      details: [{ fieldName: 'city', fieldLabel: undefined, displayValue: 'Austin' }],
    })
    expect(response.tables).toEqual([{ tableName: 'person', tableLabel: 'People', resultCount: 1, hasMore: true, totalCount: 40, source: 'FALLBACK' }])
    expect(response.provider).toEqual({ status: 'FAILED', failureClass: 'ConnectException', message: 'Connection refused' })
  })

  it('labels a result whose label was omitted, and skips (with a warning) one that cannot link, keeping the others', async () => {
    // the admin.kof22.com response for "maes": QQQ left recordLabel out of results whose label was ""
    vi.mocked(apiClient.post).mockResolvedValue({ results: [
      { tableName: 'author', tableLabel: 'Authors', recordId: '2', recordLabel: 'jm' },
      { tableName: 'page_section', tableLabel: 'Page Sections', recordId: '1' },
      { tableName: 'page_section', recordId: 11, recordLabel: '' },
      { tableName: 'person' },
    ] })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const response = await searchRecords('maes')
    expect(response.results.map((result) => result.recordLabel)).toEqual(['jm', 'Page Sections 1', 'page_section 11'])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('skipped 1 malformed result'))
    warn.mockRestore()
  })

  it.each([[[]], [{}], ['<html>Dashboard</html>'], [{ results: 'nope' }]])('rejects an invalid response: %j', async (response) => {
    vi.mocked(apiClient.post).mockResolvedValue(response)
    await expect(searchRecords('x')).rejects.toBeInstanceOf(RecordSearchResponseError)
  })

  it('re-throws request errors, including 404 (callers only search when the capability is advertised)', async () => {
    const notFound = Object.assign(new Error('Not Found'), { isAxiosError: true, response: { status: 404 } })
    vi.mocked(apiClient.post).mockRejectedValue(notFound)
    await expect(searchRecords('x')).rejects.toBe(notFound)
  })
})

describe('validMatches', () => {
  it('keeps in-bounds, sorted, non-overlapping, non-empty ranges', () => {
    expect(validMatches('abcdef', [{ start: 0, end: 2 }, { start: 1, end: 3 }, { start: 3, end: 3 }, { start: 4, end: 6 }, { start: 5, end: 7 }])).toEqual([{ start: 0, end: 2 }, { start: 4, end: 6 }])
    expect(validMatches('abc', null)).toEqual([])
  })
})


it('passes a palette tag search to the backend without stripping its hash prefix', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ results: [] })
  await searchRecords('#priority:high', { tableNames: ['person'] })
  expect(apiClient.post).toHaveBeenLastCalledWith('/search', { searchTerm: '#priority:high', tableNames: ['person'] })
})
