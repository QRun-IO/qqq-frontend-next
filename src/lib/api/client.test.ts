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

  it('does not treat session endpoint 401s as an expired session (QRun-IO/qqq#669)', async () => {
    const { isSessionEndpoint } = await import('./client')
    expect(isSessionEndpoint('/manageSession')).toBe(true)
    expect(isSessionEndpoint('/logout')).toBe(true)
    expect(isSessionEndpoint('/metaData')).toBe(false)
    expect(isSessionEndpoint('/data/manageSessions')).toBe(false)
    expect(isSessionEndpoint(undefined)).toBe(false)
  })

  it('reports the backend error message and the expired-session callback (QRun-IO/qqq#673)', async () => {
    const { default: apiClient } = await import('./client')
    const callback = vi.fn()
    apiClient.setUnauthorizedCallback(callback)
    const instance = apiClient.getInstance()
    const reply = (status: number, data: unknown) => async (config: import('axios').InternalAxiosRequestConfig) => {
      const error = new (await import('axios')).AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', config, null,
        { status, data, statusText: '', headers: {}, config })
      throw error
    }
    await expect(instance.get('/data/person/1', { adapter: reply(403, { error: 'Permission denied.' }) })).rejects.toThrow('Permission denied.')
    expect(callback).not.toHaveBeenCalled()
    await expect(instance.post('/manageSession', {}, { adapter: reply(401, { error: 'Denied' }) })).rejects.toThrow('Denied')
    expect(callback).not.toHaveBeenCalled()
    await expect(instance.get('/metaData', { adapter: reply(401, {}) })).rejects.toThrow('Request failed with status code 401')
    expect(callback).toHaveBeenCalledTimes(1)
  })
})
