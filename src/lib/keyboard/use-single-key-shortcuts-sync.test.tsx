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

// The single-key shortcut setting (WCAG 2.1.4): server Keyboard section, else this browser

import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'

import { server } from '@/mocks/node'
import { uiApiVersionHandler } from '@/mocks/ui-api-version'
import { SINGLE_KEY_SHORTCUTS_STORAGE_KEY, setSingleKeyShortcutsEnabled, singleKeyShortcutsEnabled } from './single-key-shortcuts'
import { useSingleKeyShortcutsSync, useSingleKeyShortcutsToggle } from './use-single-key-shortcuts-sync'

const keyboard = (value: boolean) => ({
  name: 'keyboard', label: 'Keyboard', fields: [{ name: 'singleKeyShortcuts', type: 'BOOLEAN' }],
  values: { singleKeyShortcuts: value }, lists: [], possibleValues: {},
})

/**
 * A query client wrapper.
 * @returns The wrapper component.
 */
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  /**
   * Provides the test's query client.
   * @param props - Children.
   * @param props.children - The hook host.
   * @returns The provider.
   */
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  return Wrapper
}

afterEach(() => {
  setSingleKeyShortcutsEnabled(true)
  window.localStorage.removeItem(SINGLE_KEY_SHORTCUTS_STORAGE_KEY)
})

describe('useSingleKeyShortcutsSync', () => {
  it('uses the browser choice and makes no section request when the server has no Keyboard section', async () => {
    const sectionRequest = vi.fn()
    window.localStorage.setItem(SINGLE_KEY_SHORTCUTS_STORAGE_KEY, 'off')
    server.use(
      uiApiVersionHandler(),
      http.get('/qqq/v1/preferences', () => HttpResponse.json({ sections: [] })),
      http.get('/qqq/v1/preferences/keyboard', () => { sectionRequest(); return new HttpResponse(null, { status: 404 }) }),
    )
    const { result } = renderHook(() => useSingleKeyShortcutsSync(true), { wrapper: wrapper() })
    await waitFor(() => expect(result.current).toBe(false))
    expect(singleKeyShortcutsEnabled()).toBe(false)
    expect(sectionRequest).not.toHaveBeenCalled()
  })

  it('follows the server Keyboard section and saves the switch there', async () => {
    const patches: unknown[] = []
    server.use(
      uiApiVersionHandler(),
      http.get('/qqq/v1/preferences', () => HttpResponse.json({ sections: [keyboard(false)] })),
      http.patch('/qqq/v1/preferences/keyboard', async ({ request }) => {
        const body = await request.json()
        patches.push(body)
        return HttpResponse.json(keyboard(true))
      }),
    )
    const Wrapper = wrapper()
    const { result } = renderHook(() => ({ sync: useSingleKeyShortcutsSync(true), toggle: useSingleKeyShortcutsToggle() }), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.sync).toBe(true))
    expect(singleKeyShortcutsEnabled()).toBe(false)
    act(() => result.current.toggle.setEnabled(true))
    await waitFor(() => expect(patches).toEqual([{ values: { singleKeyShortcuts: true } }]))
    expect(singleKeyShortcutsEnabled()).toBe(true)
    expect(window.localStorage.getItem(SINGLE_KEY_SHORTCUTS_STORAGE_KEY)).toBeNull()
  })
})
