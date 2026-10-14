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

/** @file Shared extension discovery and React gating tests. */

import { createElement, type ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/node'
import { uiApiVersionHandler } from '@/mocks/ui-api-version'
import { useAlertsInstalled } from '@/components/alerts/AlertsBell'
import { isUiApiExtensionInstalled, isUiApiFeatureSupported, resetUiApiExtensions, useUiApiExtensionInstalled } from './ui-api-extensions'

/** Gives each hook test an isolated query cache. */
function wrapper() {
  const client = new QueryClient()
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children)
  }
}

describe('extension discovery', () => {
  it('detects arbitrary registered names and absent extensions', async () => {
    server.use(uiApiVersionHandler('custom-extension'))
    await expect(isUiApiExtensionInstalled('custom-extension')).resolves.toBe(true)
    await expect(isUiApiExtensionInstalled('alerts')).resolves.toBe(false)
  })

  it('reports core features from the same discovery, false when absent or unreachable', async () => {
    server.use(http.get('/qqq/v1/version', () => HttpResponse.json({ apiVersion: '1.3.0', features: ['preferences'], extensions: [] })))
    await expect(isUiApiFeatureSupported('preferences')).resolves.toBe(true)
    await expect(isUiApiFeatureSupported('realtime')).resolves.toBe(false)
    resetUiApiExtensions()
    server.use(http.get('/qqq/v1/version', () => new HttpResponse(null, { status: 500 })))
    await expect(isUiApiFeatureSupported('preferences')).resolves.toBe(false)
  })

  it('treats pre-semver servers as having no extensions', async () => {
    server.use(http.get('/qqq/v1/version', () => new HttpResponse(null, { status: 404 })))
    await expect(isUiApiExtensionInstalled('alerts')).resolves.toBe(false)
  })

  it('shares one concurrent request across names until reset', async () => {
    const handler = vi.fn(() => HttpResponse.json({ apiVersion: '1.1.0', extensions: [{ name: 'alerts' }] }))
    server.use(http.get('/qqq/v1/version', handler))
    expect(await Promise.all([isUiApiExtensionInstalled('alerts'), isUiApiExtensionInstalled('assistant')])).toEqual([true, false])
    await isUiApiExtensionInstalled('alerts')
    expect(handler).toHaveBeenCalledTimes(1)
    resetUiApiExtensions()
    await isUiApiExtensionInstalled('alerts')
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('returns false on error and retries on the next call', async () => {
    server.use(http.get('/qqq/v1/version', () => new HttpResponse(null, { status: 500 })))
    await expect(isUiApiExtensionInstalled('alerts')).resolves.toBe(false)
    server.use(uiApiVersionHandler('alerts'))
    await expect(isUiApiExtensionInstalled('alerts')).resolves.toBe(true)
  })
})

describe('extension hooks', () => {
  it('starts false and shares discovery with imperative callers and other names', async () => {
    const handler = vi.fn(() => HttpResponse.json({ apiVersion: '1.1.0', extensions: [{ name: 'alerts' }] }))
    server.use(http.get('/qqq/v1/version', handler))
    const { result } = renderHook(() => [useAlertsInstalled(), useUiApiExtensionInstalled('assistant')], { wrapper: wrapper() })
    expect(result.current).toEqual([false, false])
    await waitFor(() => expect(result.current).toEqual([true, false]))
    await expect(isUiApiExtensionInstalled('alerts')).resolves.toBe(true)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('keeps the Alerts hook false when the extension is absent', async () => {
    server.use(uiApiVersionHandler('assistant'))
    const client = new QueryClient()
    const { result } = renderHook(() => useAlertsInstalled(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    })
    await waitFor(() => expect(client.getQueryCache().getAll()[0]?.state.status).toBe('success'))
    expect(result.current).toBe(false)
  })

  it('does not request when disabled', async () => {
    const handler = vi.fn(() => HttpResponse.json({ apiVersion: '1.1.0', extensions: [] }))
    server.use(http.get('/qqq/v1/version', handler))
    const { result } = renderHook(() => useUiApiExtensionInstalled('alerts', false), { wrapper: wrapper() })
    expect(result.current).toBe(false)
    expect(handler).not.toHaveBeenCalled()
  })

  it('returns false on error without automatically retrying', async () => {
    const handler = vi.fn(() => new HttpResponse(null, { status: 500 }))
    server.use(http.get('/qqq/v1/version', handler))
    const client = new QueryClient()
    const { result } = renderHook(() => useAlertsInstalled(), {
      wrapper: ({ children }) => createElement(QueryClientProvider, { client }, children),
    })
    await waitFor(() => expect(client.getQueryCache().getAll()[0]?.state.status).toBe('error'))
    expect(result.current).toBe(false)
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
