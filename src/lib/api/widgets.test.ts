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
    post: vi.fn(),
    getInstance: () => ({ defaults: { baseURL: 'https://example.invalid/prefix/qqq/v1' } }),
    setUnauthorizedCallback: vi.fn(),
  },
}))

describe('Widgets API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchWidgetData', () => {
    it('posts to the v1 /widget/{name} route', async () => {
      const { default: apiClient } = await import('./client')
      const mockData = { type: 'statistics', data: {} }
      vi.mocked(apiClient.post).mockResolvedValue(mockData)

      const { fetchWidgetData } = await import('./widgets')
      const result = await fetchWidgetData('revenueStats')

      expect(apiClient.post).toHaveBeenCalledWith('/widget/revenueStats', {}, { params: undefined })
      expect(result).toEqual(mockData)
    })

    it('sends the inputs as query parameters', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue({ type: 'html', html: '' })

      const { fetchWidgetData } = await import('./widgets')
      const params = { month: '2025-01', showAll: true }
      await fetchWidgetData('salesChart', params)

      expect(apiClient.post).toHaveBeenCalledWith('/widget/salesChart', {}, { params })
    })

    it('adapts canonical chart and statistics values without losing zeros', async () => {
      const { default: apiClient } = await import('./client')
      const { fetchWidgetData } = await import('./widgets')
      const chart = { labels: ['Apple'], datasets: [{ label: 'One', data: [100] }] }
      vi.mocked(apiClient.post).mockResolvedValue({ type: 'chart', title: 'Owned chart', chartData: chart })
      expect(await fetchWidgetData('chart')).toMatchObject({ type: 'chart', title: 'Owned chart', ...chart })
      vi.mocked(apiClient.post).mockResolvedValue({ type: 'statistics', count: '98.5%', countContext: 'of 481', percentageAmount: -10, percentageLabel: 'vs prev week' })
      expect(await fetchWidgetData('stat')).toMatchObject({ statistics: [{ value: '98.5%', description: 'of 481', trend: { direction: 'down', value: 10, label: 'vs prev week' } }] })
      vi.mocked(apiClient.post).mockResolvedValue({ type: 'statistics', count: 0, percentageAmount: 0 })
      expect(await fetchWidgetData('empty')).toMatchObject({ statistics: [{ value: 0, trend: { direction: 'flat', value: 0 } }] })
    })

    it('rejects HTML, null and malformed envelopes; preserves denied responses', async () => {
      const { default: apiClient } = await import('./client')
      const { fetchWidgetData } = await import('./widgets')
      for (const body of ['<html>SPA</html>', null, [], {}]) {
        vi.mocked(apiClient.post).mockResolvedValue(body)
        await expect(fetchWidgetData('bad')).rejects.toThrow('Invalid widget data response')
      }
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Permission denied'))
      await expect(fetchWidgetData('denied')).rejects.toThrow('Permission denied')
    })

    it('URL-encodes the widget name', async () => {
      const { default: apiClient } = await import('./client')
      vi.mocked(apiClient.post).mockResolvedValue({ type: 'html', html: '' })

      const { fetchWidgetData } = await import('./widgets')
      await fetchWidgetData('my widget')

      expect(vi.mocked(apiClient.post).mock.calls[0][0]).toBe('/widget/my%20widget')
    })
  })
})
