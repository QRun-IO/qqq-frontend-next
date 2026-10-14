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

// Tests for useWidget hook

import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, renderHook, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useWidget } from './use-widget'
import * as widgetsApi from '@/lib/api/widgets'
import type { WidgetData } from '@/types'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useWidget', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('clamps refresh to two seconds, retains data, pauses while hidden, resumes and stops on unmount', async () => {
    vi.useFakeTimers()
    let visibility: DocumentVisibilityState = 'visible'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
    let resolveRefresh!: (data: WidgetData) => void
    const fetch = vi.spyOn(widgetsApi, 'fetchWidgetData').mockImplementation(() => new Promise((resolve) => { resolveRefresh = resolve }))
    const { result, unmount } = renderHook(() => useWidget('refresh', { id: 7 }, {
      refreshSeconds: 0, initialData: { type: 'html', html: 'Old data' },
    }), { wrapper: createWrapper() })
    await act(async () => { await vi.advanceTimersByTimeAsync(1999) })
    expect(fetch).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(fetch).toHaveBeenCalledWith('refresh', { id: 7 })
    expect(result.current.data).toMatchObject({ html: 'Old data' })
    expect(result.current.isLoading).toBe(false)
    await act(async () => { resolveRefresh({ type: 'html', html: 'New data' }); await vi.advanceTimersByTimeAsync(1) })
    expect(result.current.data).toMatchObject({ html: 'New data' })
    act(() => { visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')) })
    await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
    expect(fetch).toHaveBeenCalledTimes(1)
    act(() => { visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')) })
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(fetch).toHaveBeenCalledTimes(2)
    unmount()
    await act(async () => { resolveRefresh({ type: 'html', html: 'Last data' }); await vi.advanceTimersByTimeAsync(10000) })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it.each([undefined, '2', NaN, Infinity])('does not poll with invalid refresh metadata %s', async (refreshSeconds) => {
    vi.useFakeTimers()
    const fetch = vi.spyOn(widgetsApi, 'fetchWidgetData')
    renderHook(() => useWidget('refresh', undefined, { refreshSeconds, initialData: { type: 'html', html: 'Seeded' } }), { wrapper: createWrapper() })
    await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(['hidden', 'disabled'])('does not poll when initially %s', async (condition) => {
    vi.useFakeTimers()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(condition === 'hidden' ? 'hidden' : 'visible')
    const fetch = vi.spyOn(widgetsApi, 'fetchWidgetData')
    renderHook(() => useWidget('refresh', undefined, {
      refreshSeconds: 2, enabled: condition !== 'disabled', initialData: { type: 'html', html: 'Seeded' },
    }), { wrapper: createWrapper() })
    await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fetches widget data from MSW', async () => {
    const { result } = renderHook(() => useWidget('crmTotalPeople'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({ type: 'statistics', title: 'Total People', value: 25 })
  })

  it('does not fetch when widgetName is empty', () => {
    const { result } = renderHook(() => useWidget(''), { wrapper: createWrapper() })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeUndefined()
  })

  it('fetches widget data with params', async () => {
    const params = { month: '2025-01' }
    const { result } = renderHook(() => useWidget('crmRevenueChart', params), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({ type: 'chart' })
  })
})
