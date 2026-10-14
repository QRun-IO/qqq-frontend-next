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

/** @file Help endpoint contract and old-server gating. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import apiClient from './client'
import { searchHelp } from './help'
import { getUiApiVersion } from './ui-api-version'

vi.mock('./client', () => ({ default: { get: vi.fn() } }))
vi.mock('./ui-api-version', () => ({ getUiApiVersion: vi.fn() }))

beforeEach(() => vi.resetAllMocks())
describe('searchHelp', () => {
  it('does not probe help on a server without the feature', async () => {
    vi.mocked(getUiApiVersion).mockResolvedValue({
      apiVersion: '1.2.0',
      features: [],
      extensions: [],
      preSemver: false,
    })
    expect(await searchHelp('address')).toEqual([])
    expect(apiClient.get).not.toHaveBeenCalled()
  })
  it('requires two characters before any request', async () => {
    expect(await searchHelp(' a ')).toEqual([])
    expect(getUiApiVersion).not.toHaveBeenCalled()
  })
  it('passes search parameters and cancellation to the versioned API client', async () => {
    vi.mocked(getUiApiVersion).mockResolvedValue({
      apiVersion: '1.2.0',
      features: ['help'],
      extensions: [],
      preSemver: false,
    })
    const results = [
      {
        kind: 'field',
        key: 'table:x;field:y',
        name: 'y',
        label: 'Address',
        text: 'A postal address.',
      },
    ]
    vi.mocked(apiClient.get).mockResolvedValue({ results })
    const signal = new AbortController().signal
    expect(await searchHelp(' address ', 4, signal)).toEqual(results)
    expect(apiClient.get).toHaveBeenCalledWith('/help/search', {
      params: { q: 'address', limit: 4 },
      signal,
    })
  })
  it('propagates server failures instead of treating them as empty results', async () => {
    vi.mocked(getUiApiVersion).mockResolvedValue({
      apiVersion: '1.2.0',
      features: ['help'],
      extensions: [],
      preSemver: false,
    })
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Unavailable'))
    await expect(searchHelp('address')).rejects.toThrow('Unavailable')
  })
})
