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

/** @file Per-table saved view capabilities and legacy compatibility. */
import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, it, vi } from 'vitest'
import type { QInstance } from '@/types'
import { processInit } from '@/lib/api/processes'
import { useSavedView, useSavedViews } from './use-saved-views'

vi.mock('@/lib/api/processes', () => ({ processInit: vi.fn() }))
const instance = { processes: { querySavedView: {}, storeSavedView: {}, deleteSavedView: {} } } as unknown as QInstance
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}
beforeEach(() => vi.mocked(processInit).mockReset().mockResolvedValue({ type: 'COMPLETE', processUUID: 'test-run', values: { savedViewList: [{ values: { id: 1, tableName: 'person', label: 'People', userId: 'me', viewJson: '{}' } }] } }))
it('retains legacy process discovery only when capabilities are absent', async () => {
  const { result } = renderHook(() => useSavedViews('person', instance, 'me'), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.yourViews).toHaveLength(1))
  expect(processInit).toHaveBeenCalledWith('querySavedView', expect.any(Object))
  expect(result.current.canStore).toBe(true)
})
it('uses declared names for list, store, delete and individual saved views', async () => {
  const capabilities = { savedViews: { available: true, queryProcessName: 'customQuery', storeProcessName: 'customStore', deleteProcessName: 'customDelete' } }
  const { result } = renderHook(() => useSavedViews('person', instance, 'me', capabilities), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.yourViews).toHaveLength(1))
  expect(processInit).toHaveBeenCalledWith('customQuery', expect.any(Object))
  await act(async () => { await result.current.storeView({ label: 'People', view: result.current.yourViews[0].view }) })
  expect(processInit).toHaveBeenCalledWith('customStore', expect.any(Object))
  await act(async () => { await result.current.deleteView(1) })
  expect(processInit).toHaveBeenCalledWith('customDelete', expect.any(Object))
  const single = renderHook(() => useSavedView('person', 1, true, capabilities), { wrapper: wrapper() })
  await waitFor(() => expect(single.result.current.isSuccess).toBe(true))
  expect(processInit).toHaveBeenCalledWith('customQuery', expect.objectContaining({ values: { id: 1 } }))
})
it.each([{}, { savedViews: { available: false, queryProcessName: 'denied' } }])('does not resurrect denied or missing capabilities', async (capabilities) => {
  const { result } = renderHook(() => useSavedViews('person', instance, 'me', capabilities), { wrapper: wrapper() })
  expect(result.current.isAvailable).toBe(false)
  expect(result.current.canStore).toBe(false)
  expect(result.current.canDelete).toBe(false)
  await expect(result.current.deleteView(1)).rejects.toThrow('unavailable')
  expect(processInit).not.toHaveBeenCalled()
})
it('allows a read-only saved view capability', async () => {
  const { result } = renderHook(() => useSavedViews('person', instance, 'me', { savedViews: { available: true, queryProcessName: 'read' } }), { wrapper: wrapper() })
  await waitFor(() => expect(result.current.yourViews).toHaveLength(1))
  expect(result.current.canStore).toBe(false)
  expect(result.current.canDelete).toBe(false)
})
