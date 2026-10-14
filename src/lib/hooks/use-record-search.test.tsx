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

/** @file Source selection, fallback, cache isolation, debounce and abort tests. */

import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CanceledError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { searchRecords } from '@/lib/api/record-search'
import { suggestRecords } from '@/lib/api/quick-search-suggest'
import type { RecordSearchResponse } from '@/lib/api/record-search'
import { queryKeys } from '@/lib/query-client'
import { useRecordSearch } from './use-record-search'

vi.mock('@/lib/api/record-search', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api/record-search')>()), searchRecords: vi.fn() }))
vi.mock('@/lib/api/quick-search-suggest', () => ({ suggestRecords: vi.fn() }))

const tables = [{ name: 'person', label: 'People' }]
const core = { results: [{ tableName: 'person', recordId: '1', recordLabel: 'Core' }] }
const suggested = { results: [{ tableName: 'person', recordId: '2', recordLabel: 'Suggested' }] }

/** Creates an isolated query cache for each hook render. */
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('useRecordSearch sources', () => {
  beforeEach(() => {
    vi.mocked(searchRecords).mockReset().mockResolvedValue(core)
    vi.mocked(suggestRecords).mockReset().mockResolvedValue(suggested)
  })
  afterEach(() => vi.useRealTimers())

  it('uses core search by default, preserving pagination and sorting', async () => {
    const { result } = renderHook(() => useRecordSearch('alice', tables, 25, { offset: 25, sort: 'recent' }), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.results).toEqual(core.results))
    expect(searchRecords).toHaveBeenCalledWith('alice', { tableNames: ['person'], limitPerTable: 25, offset: 25, sort: 'recent', signal: expect.any(AbortSignal) })
    expect(suggestRecords).not.toHaveBeenCalled()
  })

  it('uses suggestions with table scope and limit when enabled', async () => {
    const { result } = renderHook(() => useRecordSearch('alice', tables, 6, { suggest: true }), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.results).toEqual(suggested.results))
    expect(suggestRecords).toHaveBeenCalledWith('alice', { tableNames: ['person'], limitPerTable: 6, signal: expect.any(AbortSignal) })
    expect(searchRecords).not.toHaveBeenCalled()
  })

  it.each([new Error('HTTP 500'), new Error('Invalid response'), new Error('Network error')])('falls back on a non-abort failure', async (error) => {
    vi.mocked(suggestRecords).mockRejectedValue(error)
    const { result } = renderHook(() => useRecordSearch('alice', tables, 6, { suggest: true }), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.results).toEqual(core.results))
    expect(searchRecords).toHaveBeenCalledWith('alice', expect.objectContaining({
      tableNames: ['person'], limitPerTable: 6, signal: vi.mocked(suggestRecords).mock.calls[0][1]?.signal,
    }))
    expect(result.current.isError).toBe(false)
  })

  it.each([new DOMException('Aborted', 'AbortError'), new CanceledError()])('does not fall back on cancellation', async (error) => {
    vi.mocked(suggestRecords).mockRejectedValue(error)
    const { result } = renderHook(() => useRecordSearch('alice', tables, 6, { suggest: true }), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSearching).toBe(false))
    expect(searchRecords).not.toHaveBeenCalled()
  })

  it('aborts superseded requests and never falls back or replaces new results with the old response', async () => {
    let rejectOld!: (error: Error) => void
    vi.mocked(suggestRecords).mockImplementationOnce(() => new Promise<RecordSearchResponse>((_resolve, reject) => { rejectOld = reject }))
    const { result, rerender } = renderHook(({ term }) => useRecordSearch(term, tables, 6, { suggest: true }), { initialProps: { term: 'alice' }, wrapper: wrapper() })
    await waitFor(() => expect(suggestRecords).toHaveBeenCalledTimes(1))
    const oldSignal = vi.mocked(suggestRecords).mock.calls[0][1]?.signal
    rerender({ term: 'bob' })
    await waitFor(() => expect(result.current.results).toEqual(suggested.results))
    expect(oldSignal?.aborted).toBe(true)
    await act(async () => rejectOld(new Error('Late network failure')))
    expect(searchRecords).not.toHaveBeenCalled()
    expect(result.current.results).toEqual(suggested.results)
  })

  it('preserves the default 200 ms debounce', async () => {
    vi.useFakeTimers()
    const { rerender } = renderHook(({ term }) => useRecordSearch(term, tables, 6, { suggest: true }), { initialProps: { term: '' }, wrapper: wrapper() })
    rerender({ term: 'alice' })
    await act(async () => { await vi.advanceTimersByTimeAsync(199) })
    expect(suggestRecords).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(suggestRecords).toHaveBeenCalledTimes(1)
  })

  it('isolates suggestion cache entries and preserves the original core key', async () => {
    expect(queryKeys.recordSearch('alice', ['person'], 6)).toEqual([...queryKeys.search(), 'records', 'alice', ['person'], 6, 0, 'relevance'])
    const { result, rerender } = renderHook(({ suggest }) => useRecordSearch('alice', tables, 6, { suggest }), { initialProps: { suggest: false }, wrapper: wrapper() })
    await waitFor(() => expect(result.current.results).toEqual(core.results))
    rerender({ suggest: true })
    await waitFor(() => expect(result.current.results).toEqual(suggested.results))
    rerender({ suggest: false })
    await waitFor(() => expect(result.current.results).toEqual(core.results))
    expect(searchRecords).toHaveBeenCalledTimes(1)
  })

  it('reports failure if both providers fail', async () => {
    vi.mocked(suggestRecords).mockRejectedValue(new Error('Suggest failed'))
    vi.mocked(searchRecords).mockRejectedValue(new Error('Core failed'))
    const { result } = renderHook(() => useRecordSearch('alice', tables, 6, { suggest: true }), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('does not start core search when closing clears the term and disables suggestions', async () => {
    const { result, rerender } = renderHook(({ term, suggest }) => useRecordSearch(term, tables, 6, { suggest }), {
      initialProps: { term: 'alice', suggest: true }, wrapper: wrapper(),
    })
    await waitFor(() => expect(result.current.results).toEqual(suggested.results))
    rerender({ term: '', suggest: false })
    expect(result.current.results).toEqual([])
    expect(searchRecords).not.toHaveBeenCalled()
  })

  it('does not search short terms or an empty table scope', () => {
    renderHook(() => useRecordSearch('a', tables, 6, { suggest: true }), { wrapper: wrapper() })
    renderHook(() => useRecordSearch('alice', [], 6, { suggest: true }), { wrapper: wrapper() })
    expect(suggestRecords).not.toHaveBeenCalled()
    expect(searchRecords).not.toHaveBeenCalled()
  })
})
