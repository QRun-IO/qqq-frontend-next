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

// Tests for widget data API functions

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
    setUnauthorizedCallback: vi.fn(),
  },
}))

describe('Widgets API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchWidgetData', () => {
    it('gets widget data from /widget/{name}', async () => {
      const { default: apiClient } = await import('./client')
      const mockData = { type: 'statistics', data: {} }
      vi.mocked(apiClient.get).mockResolvedValue(mockData)

      const { fetchWidgetData } = await import('./widgets')
      const result = await fetchWidgetData('revenueStats')

      expect(apiClient.get).toHaveBeenCalledWith('/widget/revenueStats', { params: undefined })
      expect(result).toEqual(mockData)
    })

    it('passes params to the endpoint', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockResolvedValue({})

      const { fetchWidgetData } = await import('./widgets')
      const params = { month: '2025-01', showAll: true }
      await fetchWidgetData('salesChart', params)

      expect(apiClient.get).toHaveBeenCalledWith('/widget/salesChart', { params })
    })

    it('URL-encodes the widget name', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.get).mockResolvedValue({})

      const { fetchWidgetData } = await import('./widgets')
      await fetchWidgetData('my widget')

      expect(vi.mocked(apiClient.get).mock.calls[0][0]).toBe('/widget/my%20widget')
    })
  })
})
