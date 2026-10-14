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

// Tests for the search library: highlighting, failure descriptions, recent searches

import { describe, it, expect, beforeEach } from 'vitest'
import { AxiosError, type AxiosResponse } from 'axios'

import { RecordSearchResponseError } from '@/lib/api/record-search'
import { findMatches, segmentText, termTokens } from './highlight'
import { describeProviderFallback, describeSearchFailure } from './search-failure'
import { addRecentSearch, clearRecentSearches, getRecentSearches, MAX_RECENT_SEARCHES, removeRecentSearch } from './recent-searches'

/**
 * An axios error carrying an HTTP response.
 *
 * @param status - HTTP status.
 * @param message - Error message (the client interceptor puts the backend's text here).
 * @returns The error.
 */
function httpError(status: number, message = `Request failed with status code ${status}`): AxiosError {
  return new AxiosError(message, 'ERR_BAD_RESPONSE', undefined, null, { status, data: {}, statusText: '', headers: {}, config: {} } as unknown as AxiosResponse)
}

describe('highlight', () => {
  it('splits a term into distinct lowercased words, longest first', () => {
    expect(termTokens('  Acme  co ACME ')).toEqual(['acme', 'co'])
  })

  it('finds every occurrence of every word, merging overlaps', () => {
    expect(findMatches('Acme Corp — acme.com', 'acme')).toEqual([{ start: 0, end: 4 }, { start: 12, end: 16 }])
    expect(findMatches('abcd', 'abc bcd')).toEqual([{ start: 0, end: 4 }])
    expect(findMatches('nothing', 'zzz')).toEqual([])
  })

  it('segments text at the ranges', () => {
    expect(segmentText('alice@acme.io', [{ start: 6, end: 10 }])).toEqual([
      { text: 'alice@', match: false }, { text: 'acme', match: true }, { text: '.io', match: false },
    ])
    expect(segmentText('abc', [])).toEqual([{ text: 'abc', match: false }])
  })
})

describe('describeSearchFailure', () => {
  it('names server errors with their status and the backend message', () => {
    expect(describeSearchFailure(httpError(500, 'Error in record search provider'))).toEqual({
      kind: 'server', title: 'Record search failed: server error (HTTP 500)', detail: 'Error in record search provider', status: 500, retryable: true,
    })
  })

  it('omits axios generic messages', () => {
    expect(describeSearchFailure(httpError(502)).detail).toBeUndefined()
  })

  it('classifies unreachable, timeout, permission, unsupported, rejected and invalid responses', () => {
    expect(describeSearchFailure(new AxiosError('Network Error', 'ERR_NETWORK')).kind).toBe('offline')
    expect(describeSearchFailure(new AxiosError('timeout of 30000ms exceeded', 'ECONNABORTED')).kind).toBe('timeout')
    expect(describeSearchFailure(httpError(504)).kind).toBe('timeout')
    expect(describeSearchFailure(httpError(401)).kind).toBe('unauthorized')
    expect(describeSearchFailure(httpError(403, 'Permission denied.'))).toMatchObject({ kind: 'forbidden', detail: 'Permission denied.', retryable: false })
    expect(describeSearchFailure(httpError(404)).kind).toBe('unsupported')
    expect(describeSearchFailure(httpError(400, 'The search term may not be longer than 100 characters.'))).toMatchObject({ kind: 'bad-request', title: 'Record search failed: the search was rejected (HTTP 400)' })
    expect(describeSearchFailure(new RecordSearchResponseError()).kind).toBe('invalid-response')
    expect(describeSearchFailure(new Error('boom'))).toMatchObject({ kind: 'unknown', detail: 'boom' })
  })

  it('reports a failed provider with its failure class, and nothing otherwise', () => {
    expect(describeProviderFallback({ status: 'FAILED', failureClass: 'ConnectException', message: 'Connection refused\n at …' })).toEqual({
      title: 'Search index unavailable — showing basic matches instead', detail: 'ConnectException: Connection refused',
    })
    expect(describeProviderFallback({ status: 'OK' })).toBeUndefined()
    expect(describeProviderFallback(undefined)).toBeUndefined()
  })
})

describe('recent searches', () => {
  beforeEach(() => localStorage.clear())

  it('keeps distinct terms newest first, moving a repeated term (any case) to the top', () => {
    addRecentSearch('acme')
    addRecentSearch('bolt')
    expect(addRecentSearch(' ACME ')).toEqual(['ACME', 'bolt'])
    expect(getRecentSearches()).toEqual(['ACME', 'bolt'])
  })

  it('ignores blank terms, caps the list, removes and clears', () => {
    addRecentSearch('   ')
    for (let index = 0; index < MAX_RECENT_SEARCHES + 3; index++) addRecentSearch(`term ${index}`)
    expect(getRecentSearches()).toHaveLength(MAX_RECENT_SEARCHES)
    expect(removeRecentSearch(`term ${MAX_RECENT_SEARCHES + 2}`)).not.toContain(`term ${MAX_RECENT_SEARCHES + 2}`)
    clearRecentSearches()
    expect(getRecentSearches()).toEqual([])
  })

  it('survives corrupt storage', () => {
    localStorage.setItem('qqq-recent-searches', '{not json')
    expect(getRecentSearches()).toEqual([])
    localStorage.setItem('qqq-recent-searches', JSON.stringify(['ok', 3, '']))
    expect(getRecentSearches()).toEqual(['ok'])
  })
})
