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

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', () => ({ default: { post: vi.fn() } }))
import apiClient from './client'
import { fetchPossibleValues, fetchProcessPossibleValues, fetchTablePossibleValues } from './possible-values'

describe('v1 possible-value contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiClient.post).mockResolvedValue({ options: [] })
  })

  it('posts to the v1 table route with a JSON search body and reads the options envelope', async () => {
    const options = [{ id: 0, label: 'Zero' }, { id: 'a/b', label: 'Text key', isNotFound: false }]
    vi.mocked(apiClient.post).mockResolvedValue({ options })
    expect(await fetchTablePossibleValues('some table', 'field/name', { searchTerm: 'A&B', ids: '0,a/b', labels: 'Zero', useCase: 'filter' })).toEqual(options)
    expect(apiClient.post).toHaveBeenCalledWith('/table/some%20table/possibleValues/field%2Fname', { searchTerm: 'A&B', ids: ['0', 'a/b'], useCase: 'filter' })
  })

  it('posts to the v1 process route and encodes both identifiers', async () => {
    await fetchProcessPossibleValues('process/name', 'field#1')
    expect(apiClient.post).toHaveBeenCalledWith('/processes/process%2Fname/possibleValues/field%231', {})
  })

  it('posts to the v1 standalone route and maps values to ids', async () => {
    await fetchPossibleValues('source/name', { values: '0,1' })
    expect(apiClient.post).toHaveBeenCalledWith('/possibleValues/source%2Fname', { ids: ['0', '1'] })
  })

  it('keeps explicit ids authoritative over values', async () => {
    await fetchPossibleValues('source', { values: '1', ids: '2' })
    expect(apiClient.post).toHaveBeenCalledWith('/possibleValues/source', { ids: ['2'] })
  })

  it('sends labels only when no ids are given, like the legacy lookup', async () => {
    await fetchPossibleValues('source', { labels: 'Red,Green' })
    expect(apiClient.post).toHaveBeenCalledWith('/possibleValues/source', { labels: ['Red', 'Green'] })
  })

  it('accepts the native NON_EMPTY serialization of an empty option list', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({})
    expect(await fetchPossibleValues('source')).toEqual([])
  })

  it.each(['<html>fallback</html>', [], { records: [] }, { options: null }, { options: [{ id: 1 }] }, { options: [{ id: {}, label: 'Invalid key' }] }])('rejects an invalid native response instead of presenting it as empty: %j', async (response) => {
    vi.mocked(apiClient.post).mockResolvedValue(response)
    await expect(fetchPossibleValues('source')).rejects.toThrow()
  })

  it('preserves an HTTP failure', async () => {
    const failure = new Error('404')
    vi.mocked(apiClient.post).mockRejectedValue(failure)
    await expect(fetchTablePossibleValues('pet', 'speciesId')).rejects.toBe(failure)
  })
})
