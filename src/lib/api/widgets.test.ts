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
