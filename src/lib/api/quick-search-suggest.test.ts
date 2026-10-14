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

/** @file Quick Search suggestion contract, mapping and cancellation tests. */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CanceledError } from 'axios'
import apiClient from './client'
import { suggestRecords } from './quick-search-suggest'

vi.mock('./client', () => ({ default: { get: vi.fn() } }))

const group = {
  tableName: 'person', tableLabel: 'People', hasMore: true,
  items: [{ recordId: '1', label: 'Alice', subtitle: 'Springfield' }],
}
const response = { query: 'ali', groups: [group], truncated: false }

describe('suggestRecords', () => {
  beforeEach(() => { vi.mocked(apiClient.get).mockReset() })

  it('maps groups, subtitles and summaries and sends encoded query parameters through the client', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      ...response,
      groups: [group, { tableName: 'pet', tableLabel: 'Pets', hasMore: false, items: [{ recordId: '2', label: 'Alina', subtitle: null }] }],
    })
    const signal = new AbortController().signal
    const result = await suggestRecords('ali & co', { tableNames: ['person', 'pet'], limitPerTable: 6, maxTables: 8, signal })
    expect(apiClient.get).toHaveBeenCalledWith('/qbit/quick-search/suggest', {
      params: { q: 'ali & co', tables: 'person,pet', limitPerTable: 6, maxTables: 8 }, signal,
    })
    expect(result).toEqual({
      results: [
        { tableName: 'person', tableLabel: 'People', recordId: '1', recordLabel: 'Alice', details: [{ fieldName: 'subtitle', displayValue: 'Springfield' }] },
        { tableName: 'pet', tableLabel: 'Pets', recordId: '2', recordLabel: 'Alina', details: [] },
      ],
      tables: [
        { tableName: 'person', tableLabel: 'People', resultCount: 1, hasMore: true, source: 'PROVIDER' },
        { tableName: 'pet', tableLabel: 'Pets', resultCount: 1, hasMore: false, source: 'PROVIDER' },
      ],
    })
  })

  it('omits optional parameters and accepts empty groups for a short term', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ query: 'a', groups: [], truncated: false })
    await expect(suggestRecords('a')).resolves.toEqual({ results: [], tables: [] })
    expect(apiClient.get).toHaveBeenCalledWith('/qbit/quick-search/suggest', { params: { q: 'a' }, signal: undefined })
  })

  it('skips malformed items and counts only valid records', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      ...response,
      groups: [{ ...group, items: [...group.items, null, {}, { recordId: '', label: 'Bad' }, { recordId: '2', label: 7 }, { recordId: '3', label: 'Bad', subtitle: {} }] }],
    })
    const result = await suggestRecords('ali')
    expect(result.results).toHaveLength(1)
    expect(result.tables?.[0]).toMatchObject({ resultCount: 1, hasMore: true })
  })

  it.each([null, {}, { ...response, groups: 'bad' }, { ...response, groups: [{ ...group, hasMore: 'yes' }] }])('rejects a malformed response envelope', async (raw) => {
    vi.mocked(apiClient.get).mockResolvedValue(raw)
    await expect(suggestRecords('ali')).rejects.toThrow()
  })

  it('propagates HTTP errors for the caller to fall back', async () => {
    const error = new Error('HTTP 400')
    vi.mocked(apiClient.get).mockImplementation(() => Promise.reject(error))
    await expect(suggestRecords('a'.repeat(101))).rejects.toBe(error)
  })

  it('does not send an already aborted request', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(suggestRecords('ali', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('passes cancellation through unchanged', async () => {
    const error = new CanceledError()
    vi.mocked(apiClient.get).mockImplementation(() => Promise.reject(error))
    await expect(suggestRecords('ali', { signal: new AbortController().signal })).rejects.toBe(error)
  })

  it('discards a response if its signal was aborted before it arrived', async () => {
    const controller = new AbortController()
    vi.mocked(apiClient.get).mockImplementation(async () => {
      controller.abort()
      return response
    })
    await expect(suggestRecords('ali', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
  })
})
