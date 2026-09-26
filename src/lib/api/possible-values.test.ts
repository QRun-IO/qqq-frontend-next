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

const defaults = vi.hoisted(() => ({ baseURL: 'https://sample.invalid/prefix/qqq/v1/' }))
vi.mock('./client', () => ({ default: { get: vi.fn(), post: vi.fn(), getInstance: () => ({ defaults }) } }))
import apiClient from './client'
import { fetchPossibleValues, fetchProcessPossibleValues, fetchTablePossibleValues } from './possible-values'

describe('Native possible-value contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    defaults.baseURL = 'https://sample.invalid/prefix/qqq/v1/'
    vi.mocked(apiClient.get).mockResolvedValue({ options: [] })
  })

  it('uses the actual table route, query parameters and options envelope', async () => {
    const options = [{ id: 0, label: 'Zero' }, { id: 'a/b', label: 'Text key', isNotFound: false }]
    vi.mocked(apiClient.get).mockResolvedValue({ options })
    expect(await fetchTablePossibleValues('some table', 'field/name', { searchTerm: 'A&B', ids: '0,a/b', labels: 'Zero', useCase: 'filter' })).toEqual(options)
    expect(apiClient.get).toHaveBeenCalledWith('/data/some%20table/possibleValues/field%2Fname', {
      baseURL: 'https://sample.invalid/prefix', params: { searchTerm: 'A&B', ids: '0,a/b', labels: 'Zero', useCase: 'filter' },
    })
  })

  it('uses the registered process route and encodes both identifiers', async () => {
    await fetchProcessPossibleValues('process/name', 'field#1')
    expect(apiClient.get).toHaveBeenCalledWith('/processes/process%2Fname/possibleValues/field%231', { baseURL: 'https://sample.invalid/prefix', params: {} })
  })

  it('uses standalone source lookup and maps values to native ids', async () => {
    await fetchPossibleValues('source/name', { values: '0,1' })
    expect(apiClient.get).toHaveBeenCalledWith('/possibleValues/source%2Fname', { baseURL: 'https://sample.invalid/prefix', params: { ids: '0,1' } })
  })

  it('keeps explicit ids authoritative and a custom non-V1 prefix intact', async () => {
    defaults.baseURL = 'https://sample.invalid/custom'
    await fetchPossibleValues('source', { values: '1', ids: '2' })
    expect(apiClient.get).toHaveBeenCalledWith('/possibleValues/source', { baseURL: 'https://sample.invalid/custom', params: { ids: '2' } })
  })

  it('posts form values as the form-encoded values JSON that ${input.field} filters read, keeping search and ids as query parameters', async () => {
    const options = [{ id: 3, label: 'Carrot' }]
    vi.mocked(apiClient.post).mockResolvedValue({ options })
    const formValues = { categoryId: 2, note: 'a&b=c', itemId: null }
    expect(await fetchTablePossibleValues('order', 'itemId', { searchTerm: 'Ca', ids: '3', formValues })).toEqual(options)
    expect(apiClient.get).not.toHaveBeenCalled()
    const [url, body, config] = vi.mocked(apiClient.post).mock.calls[0]
    expect(url).toBe('/data/order/possibleValues/itemId')
    expect(body).toBeInstanceOf(URLSearchParams)
    expect(JSON.parse((body as URLSearchParams).get('values')!)).toEqual(formValues)
    expect([...(body as URLSearchParams).keys()]).toEqual(['values'])
    expect(config).toEqual({
      baseURL: 'https://sample.invalid/prefix',
      params: { searchTerm: 'Ca', ids: '3' },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  })

  it('posts empty form values for a process field as an empty values object', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ options: [] })
    await fetchProcessPossibleValues('prcPick', 'itemId', { formValues: {} })
    expect(apiClient.post).toHaveBeenCalledWith('/processes/prcPick/possibleValues/itemId', expect.any(URLSearchParams), expect.objectContaining({ params: {} }))
    expect((vi.mocked(apiClient.post).mock.calls[0][1] as URLSearchParams).get('values')).toBe('{}')
  })

  it('accepts the native NON_EMPTY serialization of an empty option list', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({})
    expect(await fetchPossibleValues('source')).toEqual([])
  })

  it.each(['<html>fallback</html>', [], { records: [] }, { options: null }, { options: [{ id: 1 }] }, { options: [{ id: {}, label: 'Invalid key' }] }])('rejects an invalid native response instead of presenting it as empty: %j', async (response) => {
    vi.mocked(apiClient.get).mockResolvedValue(response)
    await expect(fetchPossibleValues('source')).rejects.toThrow()
  })

  it('preserves an HTTP failure', async () => {
    const failure = new Error('404')
    vi.mocked(apiClient.get).mockRejectedValue(failure)
    await expect(fetchTablePossibleValues('pet', 'speciesId')).rejects.toBe(failure)
  })
})
