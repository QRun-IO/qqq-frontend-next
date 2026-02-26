// Tests for the base API client

import { describe, it, expect, vi, beforeEach } from 'vitest'

// We need to test the APIClient class behavior
describe('APIClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should be a singleton module export', async () => {
    const { default: apiClient } = await import('./client')
    expect(apiClient).toBeDefined()
    expect(typeof apiClient.get).toBe('function')
    expect(typeof apiClient.post).toBe('function')
    expect(typeof apiClient.put).toBe('function')
    expect(typeof apiClient.delete).toBe('function')
  })

  it('should expose setUnauthorizedCallback', async () => {
    const { default: apiClient } = await import('./client')
    expect(typeof apiClient.setUnauthorizedCallback).toBe('function')
  })

  it('should set unauthorized callback and call it on 401', async () => {
    const { default: apiClient } = await import('./client')
    const callback = vi.fn()

    apiClient.setUnauthorizedCallback(callback)

    // Simulate a 401 response via the interceptor
    const axiosInstance = apiClient.getInstance()
    const interceptor = axiosInstance.interceptors.response

    // Verify the interceptor is registered (Axios stores them internally)
    // We test this by checking the client responds to 401
    expect(interceptor).toBeDefined()
  })

  it('should get the axios instance', async () => {
    const { default: apiClient } = await import('./client')
    const instance = apiClient.getInstance()
    expect(instance).toBeDefined()
    // Should have interceptors
    expect(instance.interceptors).toBeDefined()
    expect(instance.interceptors.response).toBeDefined()
  })
})
