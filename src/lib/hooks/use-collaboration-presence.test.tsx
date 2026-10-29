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

import React from 'react'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useCollaborationPresence, otherViewers } from './use-collaboration-presence'
import * as api from '@/lib/api/collaboration'
vi.mock('@/lib/context/q-context', async () => {
  const { createContext } = await import('react')
  return { useQContext: () => ({ userId: 'me' }), QContext: createContext({ userId: 'me' }) }
})
vi.mock('./use-realtime-channel', () => ({ useRealtimeChannel: vi.fn() }))
vi.mock('@/lib/api/collaboration', () => ({
  openPresenceLease: vi.fn(),
  renewPresence: vi.fn(),
  leavePresence: vi.fn(),
  getPresence: vi.fn(),
  beaconPresence: vi.fn(),
}))
beforeEach(() => {
  vi.useFakeTimers()
  let nextLease = 0
  vi.mocked(api.openPresenceLease).mockImplementation(async () => ({
    connectionId: `lease:${++nextLease}`,
  }))
  vi.mocked(api.getPresence).mockResolvedValue({ table: 'person', viewers: [] })
  vi.mocked(api.renewPresence).mockResolvedValue({ table: 'person', viewers: [] })
  vi.mocked(api.leavePresence).mockResolvedValue({})
})
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})
it('renews on mount and focus changes, every 20 seconds; beacons and leaves its own lease', async () => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={cache}>{children}</QueryClientProvider>
  )
  const hook = renderHook(({ field }) => useCollaborationPresence('person', '1', true, field), {
    wrapper,
    initialProps: { field: 'firstName' },
  })
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(api.renewPresence).toHaveBeenCalledWith(
    expect.objectContaining({ mode: 'EDITING', fieldName: 'firstName' })
  )
  await act(() => vi.advanceTimersByTimeAsync(20000))
  expect(api.renewPresence).toHaveBeenCalledTimes(2)
  expect(vi.mocked(api.renewPresence).mock.calls.map(([input]) => input.sequence)).toEqual([1, 2])
  hook.rerender({ field: 'lastName' })
  expect(api.openPresenceLease).toHaveBeenCalledTimes(1)
  expect(api.renewPresence).toHaveBeenLastCalledWith(
    expect.objectContaining({ fieldName: 'lastName' })
  )
  act(() => window.dispatchEvent(new Event('pagehide')))
  expect(api.beaconPresence).toHaveBeenCalledWith(
    expect.objectContaining({ fieldName: 'lastName' })
  )
  hook.unmount()
  expect(api.leavePresence).not.toHaveBeenCalled()
  expect(api.beaconPresence).toHaveBeenCalledWith(
    expect.objectContaining({ table: 'person', pk: '1', sequence: 4 })
  )
})
it('merges tabs and excludes my own tabs, preferring editors', () => {
  expect(
    otherViewers(
      [
        { userId: 'me', displayName: 'Me', mode: 'VIEWING' },
        { userId: 'sam', displayName: 'Sam', mode: 'VIEWING' },
        { userId: 'sam', displayName: 'Sam', mode: 'EDITING', fieldName: 'name' },
      ],
      'me'
    )
  ).toEqual([{ userId: 'sam', displayName: 'Sam', mode: 'EDITING', fieldName: 'name' }])
})

it('reports failed renewals even when reads succeed, and recovers on a successful renewal', async () => {
  vi.mocked(api.renewPresence).mockRejectedValueOnce(new Error('Unavailable'))
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={cache}>{children}</QueryClientProvider>
  )
  const hook = renderHook(() => useCollaborationPresence('person', '1'), { wrapper })
  await act(() => vi.advanceTimersByTimeAsync(10))
  expect(hook.result.current.unavailable).toBe(true)
  expect(hook.result.current.viewers).toEqual([])
  await act(() => vi.advanceTimersByTimeAsync(20000))
  expect(hook.result.current.unavailable).toBe(false)
  expect(api.openPresenceLease).toHaveBeenCalledTimes(1)
  hook.unmount()
})

it('ignores a failed renewal from the previous record', async () => {
  let rejectOld: (reason: Error) => void = () => undefined
  vi.mocked(api.renewPresence).mockReturnValueOnce(
    new Promise((_, reject) => {
      rejectOld = reject
    })
  )
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={cache}>{children}</QueryClientProvider>
  )
  const hook = renderHook(({ pk }) => useCollaborationPresence('person', pk), {
    wrapper,
    initialProps: { pk: '1' },
  })
  await act(() => vi.advanceTimersByTimeAsync(0))
  hook.rerender({ pk: '2' })
  await act(() => vi.advanceTimersByTimeAsync(10))
  await act(async () => {
    rejectOld(new Error('Old request failed'))
  })
  expect(hook.result.current.unavailable).toBe(false)
  hook.unmount()
})

it('releases a late reservation without activating a closed surface', async () => {
  let resolveOpen!: (value: { connectionId: string }) => void
  vi.mocked(api.openPresenceLease).mockReturnValueOnce(
    new Promise((resolve) => {
      resolveOpen = resolve
    })
  )
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={cache}>{children}</QueryClientProvider>
  )
  const hook = renderHook(() => useCollaborationPresence('person', '1'), { wrapper })
  hook.unmount()
  await act(async () => {
    resolveOpen({ connectionId: 'lease:late' })
  })
  expect(api.renewPresence).not.toHaveBeenCalled()
  expect(api.leavePresence).toHaveBeenCalledWith({
    table: 'person',
    pk: '1',
    connectionId: 'lease:late',
    sequence: 1,
  })
})

it('rejoins once with a new handle after an explicit lease expiry', async () => {
  vi.mocked(api.renewPresence).mockRejectedValueOnce({
    isAxiosError: true,
    response: { status: 409, data: { code: 'PRESENCE_LEASE_EXPIRED' } },
  })
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={cache}>{children}</QueryClientProvider>
  )
  const hook = renderHook(() => useCollaborationPresence('person', '1'), { wrapper })
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(api.openPresenceLease).toHaveBeenCalledTimes(2)
  expect(
    vi.mocked(api.renewPresence).mock.calls.map(([input]) => [input.connectionId, input.sequence])
  ).toEqual([
    ['lease:1', 1],
    ['lease:2', 1],
  ])
  expect(hook.result.current.unavailable).toBe(false)
  hook.unmount()
})

it('opens a fresh lease on pageshow instead of reviving the departed handle', async () => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={cache}>{children}</QueryClientProvider>
  )
  const hook = renderHook(() => useCollaborationPresence('person', '1'), { wrapper })
  await act(() => vi.advanceTimersByTimeAsync(0))
  act(() => window.dispatchEvent(new Event('pagehide')))
  act(() => window.dispatchEvent(new Event('pageshow')))
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(api.openPresenceLease).toHaveBeenCalledTimes(2)
  expect(api.renewPresence).toHaveBeenLastCalledWith(
    expect.objectContaining({ connectionId: 'lease:2', sequence: 1 })
  )
  hook.unmount()
})

it('bounds immediate rejoin attempts when replacement leases also expire', async () => {
  vi.mocked(api.renewPresence).mockRejectedValue({
    isAxiosError: true,
    response: { status: 409, data: { code: 'PRESENCE_LEASE_EXPIRED' } },
  })
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={cache}>{children}</QueryClientProvider>
  )
  const hook = renderHook(() => useCollaborationPresence('person', '1'), { wrapper })
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(api.openPresenceLease).toHaveBeenCalledTimes(2)
  expect(hook.result.current.unavailable).toBe(true)
  hook.unmount()
})

it('discards an old pending open after hide and show while preserving the new handle', async () => {
  let resolveOld!: (value: { connectionId: string }) => void
  vi.mocked(api.openPresenceLease).mockReturnValueOnce(
    new Promise((resolve) => {
      resolveOld = resolve
    })
  )
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={cache}>{children}</QueryClientProvider>
  )
  const hook = renderHook(() => useCollaborationPresence('person', '1'), { wrapper })
  act(() => window.dispatchEvent(new Event('pagehide')))
  act(() => window.dispatchEvent(new Event('pageshow')))
  await act(() => vi.advanceTimersByTimeAsync(0))
  await act(async () => {
    resolveOld({ connectionId: 'lease:old' })
  })
  expect(api.renewPresence).toHaveBeenCalledTimes(1)
  expect(api.renewPresence).toHaveBeenLastCalledWith(
    expect.objectContaining({ connectionId: 'lease:1', sequence: 1 })
  )
  expect(api.leavePresence).toHaveBeenCalledWith(
    expect.objectContaining({ connectionId: 'lease:old', sequence: 1 })
  )
  hook.unmount()
  expect(api.leavePresence).toHaveBeenLastCalledWith(
    expect.objectContaining({ connectionId: 'lease:1', sequence: 2 })
  )
})
