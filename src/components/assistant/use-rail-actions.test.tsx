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

import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { AssistantConversation } from '@/types/assistant'
import * as api from '@/lib/api/assistant'
import { assistantKeys } from './assistant-context'
import { useRailActions } from './use-rail-actions'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const first: AssistantConversation = { id: 1, title: 'First', status: 'ACTIVE', pinned: false, unreadCount: 0, lastMessageAt: null, createDate: '' }
const second: AssistantConversation = { ...first, id: 2, title: 'Second' }

describe('conversation action isolation', () => {
  afterEach(() => vi.restoreAllMocks())

  it('rolls back only the failed row without undoing another completed delete', async () => {
    let rejectFirst!: (reason: Error) => void
    vi.spyOn(api, 'deleteAssistantConversation')
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectFirst = reject }))
      .mockResolvedValueOnce(undefined)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(assistantKeys.conversations(), [first, second])
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useRailActions({ activeConversationId: null, setActiveConversationId: vi.fn() }), { wrapper })
    let request!: Promise<void>
    await act(async () => { request = result.current.remove(first); await Promise.resolve() })
    await act(() => result.current.remove(second))
    await act(async () => { rejectFirst(new Error('failed')); await request })
    expect(client.getQueryData(assistantKeys.conversations())).toEqual([first])
  })

  it('does not reopen the failed conversation after the user opens another', async () => {
    let rejectDelete!: (reason: Error) => void
    vi.spyOn(api, 'deleteAssistantConversation').mockImplementation(() => new Promise((_, reject) => { rejectDelete = reject }))
    const client = new QueryClient()
    const select = vi.fn()
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const { result, rerender } = renderHook(({ active }) => useRailActions({ activeConversationId: active, setActiveConversationId: select }), { wrapper, initialProps: { active: 1 } })
    let request!: Promise<void>
    await act(async () => { request = result.current.remove(first); await Promise.resolve() })
    expect(select).not.toHaveBeenCalled()
    rerender({ active: 2 })
    select.mockClear()
    await act(async () => { rejectDelete(new Error('failed')); await request })
    expect(select).not.toHaveBeenCalled()
  })
})
