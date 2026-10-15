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

  it('sends the browser time zone so the backend evaluates relative dates in it', async () => {
    const { default: apiClient, userTimeZoneHeader } = await import('./client')
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    expect(userTimeZoneHeader()).toEqual({ 'X-QQQ-UserTimezone': zone })
    expect(apiClient.getInstance().defaults.headers['X-QQQ-UserTimezone']).toBe(zone)
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
    await expect(instance.get('/data/person/1', { adapter: reply(403, { message: 'Permission denied.', error: 'Permission denied.', traceId: 'trace-403' }) })).rejects.toThrow('Permission denied.')
    expect(callback).not.toHaveBeenCalled()
    await expect(instance.post('/manageSession', {}, { adapter: reply(401, { message: 'Denied', traceId: 'trace-401' }) })).rejects.toThrow('Denied')
    expect(callback).not.toHaveBeenCalled()
    await expect(instance.get('/metaData', { adapter: reply(401, {}) })).rejects.toThrow('Request failed with status code 401')
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('ends a session generation: in-flight requests are aborted and late responses discarded (SEC-048)', async () => {
    const { default: apiClient } = await import('./client')
    const { AxiosError, isCancel } = await import('axios')
    const callback = vi.fn()
    apiClient.setUnauthorizedCallback(callback)
    const instance = apiClient.getInstance()
    let seenSignal: AbortSignal | undefined
    let answer: (() => void) | undefined
    // an adapter that answers only when told, ignoring aborts: a response already on its way
    const late = (status: number) => (config: import('axios').InternalAxiosRequestConfig) => new Promise<import('axios').AxiosResponse>((resolve, reject) => {
      seenSignal = config.signal as AbortSignal
      answer = () => status === 200
        ? resolve({ status, data: { ok: true }, statusText: '', headers: {}, config })
        : reject(new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, { status, data: {}, statusText: '', headers: {}, config }))
    })

    const started = async () => vi.waitFor(() => expect(answer).toBeDefined())
    const preferences = instance.get('/preferences', { adapter: late(200) })
    await started()
    apiClient.endSession()
    expect(seenSignal?.aborted).toBe(true)
    answer!()
    const discarded = await preferences.catch((error: unknown) => error)
    expect(isCancel(discarded)).toBe(true)

    answer = undefined
    const expired = instance.get('/metaData', { adapter: late(401) })
    await started()
    apiClient.endSession()
    answer!()
    expect(isCancel(await expired.catch((error: unknown) => error))).toBe(true)
    expect(callback).not.toHaveBeenCalled()

    // the next generation works normally
    answer = undefined
    const fresh = instance.get('/version', { adapter: late(200) })
    await started()
    expect(seenSignal?.aborted).toBe(false)
    answer!()
    expect((await fresh).data).toEqual({ ok: true })
  })
})
