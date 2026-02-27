// Tests for auth API functions

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the API client
vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    setUnauthorizedCallback: vi.fn(),
  },
}))

describe('Auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('should fetch auth metadata from API when cache is empty', async () => {
    const { default: apiClient } = await import('./client')
    const mockMetadata = {
      name: 'test-auth',
      type: 'FULLY_ANONYMOUS' as const,
      values: {},
    }
    vi.mocked(apiClient.get).mockResolvedValue(mockMetadata)

    const { getAuthenticationMetaData } = await import('./auth')
    const result = await getAuthenticationMetaData()

    expect(result).toEqual(mockMetadata)
    expect(apiClient.get).toHaveBeenCalledWith('/metaData/authentication')
  })

  it('should return cached auth metadata when cache is valid', async () => {
    const { default: apiClient } = await import('./client')
    const mockMetadata = {
      name: 'cached-auth',
      type: 'OAUTH2' as const,
      values: { clientId: 'test', baseUrl: 'https://example.com' },
    }

    // Pre-populate cache
    localStorage.setItem(
      'qqqAuthMetadata:/qqq/v1',
      JSON.stringify({ data: mockMetadata, timestamp: Date.now() })
    )

    const { getAuthenticationMetaData } = await import('./auth')
    const result = await getAuthenticationMetaData()

    expect(result).toEqual(mockMetadata)
    // Should NOT have called the API
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('should re-fetch when cache is expired', async () => {
    const { default: apiClient } = await import('./client')
    const freshMetadata = {
      name: 'fresh-auth',
      type: 'AUTH_0' as const,
      values: {},
    }
    vi.mocked(apiClient.get).mockResolvedValue(freshMetadata)

    // Set expired cache (2 hours ago)
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
    localStorage.setItem(
      'qqqAuthMetadata:/qqq/v1',
      JSON.stringify({ data: { name: 'old', type: 'MOCK', values: {} }, timestamp: twoHoursAgo })
    )

    const { getAuthenticationMetaData } = await import('./auth')
    const result = await getAuthenticationMetaData()

    expect(result).toEqual(freshMetadata)
    expect(apiClient.get).toHaveBeenCalled()
  })

  it('clearAuthMetadataCache should remove the cache entry', async () => {
    localStorage.setItem('qqqAuthMetadata:/qqq/v1', JSON.stringify({ data: {}, timestamp: Date.now() }))

    const { clearAuthMetadataCache } = await import('./auth')
    clearAuthMetadataCache()

    expect(localStorage.getItem('qqqAuthMetadata:/qqq/v1')).toBeNull()
  })

  it('should call logout endpoint and clear cache', async () => {
    const { default: apiClient } = await import('./client')
    vi.mocked(apiClient.post).mockResolvedValue(undefined)

    localStorage.setItem('qqqAuthMetadata:/qqq/v1', JSON.stringify({ data: {}, timestamp: Date.now() }))
    localStorage.setItem('accessToken', 'test-token')

    const { logout } = await import('./auth')
    await logout()

    expect(apiClient.post).toHaveBeenCalledWith('/logout')
    expect(localStorage.getItem('qqqAuthMetadata:/qqq/v1')).toBeNull()
    expect(localStorage.getItem('accessToken')).toBeNull()
  })
})
