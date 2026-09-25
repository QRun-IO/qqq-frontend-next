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

// Tests for auth API functions

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the API client
vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    setUnauthorizedCallback: vi.fn(),
    getInstance: () => ({ defaults: { baseURL: '/qqq/v1' } }),
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

  it('posts manageSession as the JSON body v1 reads (QRun-IO/qqq#670)', async () => {
    const { default: apiClient } = await import('./client')
    vi.mocked(apiClient.post).mockResolvedValue({ uuid: 'u', values: { user: { name: 'Alice' } } })
    const { manageSession } = await import('./auth')
    await expect(manageSession('token-1')).resolves.toEqual({ uuid: 'u', values: { user: { name: 'Alice' } } })
    expect(apiClient.post).toHaveBeenCalledWith('/manageSession', { accessToken: 'token-1' })
  })

  it('completes OAuth2 PKCE and resumes sessions through the v1 manageSession', async () => {
    const { default: apiClient } = await import('./client')
    vi.mocked(apiClient.post).mockResolvedValue({ uuid: 'u' })
    const { createOAuth2Session, resumeSession } = await import('./auth')
    await createOAuth2Session({ code: 'c', codeVerifier: 'v', redirectUri: 'https://app/token' })
    expect(apiClient.post).toHaveBeenCalledWith('/manageSession', { code: 'c', codeVerifier: 'v', redirectUri: 'https://app/token' })
    await resumeSession('session-1')
    expect(apiClient.post).toHaveBeenCalledWith('/manageSession', { sessionUUID: 'session-1' })
  })

  it('reads the sessionUUID cookie', async () => {
    const { readSessionUUIDCookie } = await import('./auth')
    document.cookie = 'other=1'
    expect(readSessionUUIDCookie()).toBeNull()
    document.cookie = 'sessionUUID=abc-123'
    expect(readSessionUUIDCookie()).toBe('abc-123')
    document.cookie = 'sessionUUID=; Max-Age=0'
  })
})
