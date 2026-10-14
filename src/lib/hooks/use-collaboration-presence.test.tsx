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
vi.mock('@/lib/context/q-context', () => ({ useQContext: () => ({ userId: 'me' }) }))
vi.mock('./use-realtime-channel', () => ({ useRealtimeChannel: vi.fn() }))
vi.mock('@/lib/api/collaboration', () => ({
  renewPresence: vi.fn(),
  leavePresence: vi.fn(),
  getPresence: vi.fn(),
  beaconPresence: vi.fn(),
}))
beforeEach(() => {
  vi.useFakeTimers()
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
  expect(api.renewPresence).toHaveBeenCalledWith(
    expect.objectContaining({ mode: 'EDITING', fieldName: 'firstName' })
  )
  await act(() => vi.advanceTimersByTimeAsync(20000))
  expect(api.renewPresence).toHaveBeenCalledTimes(2)
  hook.rerender({ field: 'lastName' })
  expect(api.renewPresence).toHaveBeenLastCalledWith(
    expect.objectContaining({ fieldName: 'lastName' })
  )
  act(() => window.dispatchEvent(new Event('pagehide')))
  expect(api.beaconPresence).toHaveBeenCalledWith(
    expect.objectContaining({ fieldName: 'lastName' })
  )
  hook.unmount()
  expect(api.leavePresence).toHaveBeenCalledTimes(1)
  expect(api.leavePresence).toHaveBeenCalledWith(
    expect.objectContaining({ table: 'person', pk: '1' })
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
