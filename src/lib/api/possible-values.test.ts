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

// Tests for possible values API functions

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  default: {
    post: vi.fn(),
    setUnauthorizedCallback: vi.fn(),
  },
}))

describe('Possible Values API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchTablePossibleValues', () => {
    it('posts FormData to /table/{name}/possibleValues/{field}', async () => {
      const { default: apiClient } = await import('./client')
      const mockValues = [{ id: '1', label: 'Active', value: 'active' }]
      vi.mocked(apiClient.post).mockResolvedValue(mockValues)

      const { fetchTablePossibleValues } = await import('./possible-values')
      const result = await fetchTablePossibleValues('person', 'status', { searchTerm: 'act' })

      const [url, body] = vi.mocked(apiClient.post).mock.calls[0]
      expect(url).toBe('/table/person/possibleValues/status')
      expect(body).toBeInstanceOf(FormData)
      expect((body as FormData).get('searchTerm')).toBe('act')
      expect(result).toEqual(mockValues)
    })

    it('includes all request params in FormData', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue([])

      const { fetchTablePossibleValues } = await import('./possible-values')
      await fetchTablePossibleValues('order', 'status', {
        searchTerm: 'test',
        ids: '1,2',
        labels: 'Active,Closed',
        values: 'active,closed',
        useCase: 'filter',
      })

      const formData = vi.mocked(apiClient.post).mock.calls[0][1] as FormData
      expect(formData.get('searchTerm')).toBe('test')
      expect(formData.get('ids')).toBe('1,2')
      expect(formData.get('labels')).toBe('Active,Closed')
      expect(formData.get('values')).toBe('active,closed')
      expect(formData.get('useCase')).toBe('filter')
    })

    it('works with empty request', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue([])

      const { fetchTablePossibleValues } = await import('./possible-values')
      await fetchTablePossibleValues('person', 'companyId')

      const formData = vi.mocked(apiClient.post).mock.calls[0][1] as FormData
      expect([...formData.keys()]).toHaveLength(0)
    })
  })

  describe('fetchProcessPossibleValues', () => {
    it('posts to /processes/{name}/possibleValues/{field}', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue([])

      const { fetchProcessPossibleValues } = await import('./possible-values')
      await fetchProcessPossibleValues('bulkImport', 'targetTable', { searchTerm: 'per' })

      const [url] = vi.mocked(apiClient.post).mock.calls[0]
      expect(url).toBe('/processes/bulkImport/possibleValues/targetTable')
    })
  })

  describe('fetchPossibleValues', () => {
    it('posts to /possibleValues/{field}', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue([])

      const { fetchPossibleValues } = await import('./possible-values')
      await fetchPossibleValues('country', { searchTerm: 'US' })

      const [url, body] = vi.mocked(apiClient.post).mock.calls[0]
      expect(url).toBe('/possibleValues/country')
      expect((body as FormData).get('searchTerm')).toBe('US')
    })
  })
})
