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

// A crashing assistant panel is replaced by a small card; the page around it keeps working

import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resetClientErrorsForTesting, setClientErrorSink } from '@/lib/errors/client-errors'
import { AssistantContext, type AssistantController } from './assistant-context'
import { AssistantMount } from './AssistantMount'

const panel = vi.hoisted(() => ({ broken: true }))
vi.mock('./AssistantPanel', () => ({
  default: function AssistantPanel() {
    if (panel.broken) throw new TypeError("Cannot read properties of undefined (reading 'length')")
    return <aside data-qqq-id="assistant-panel">panel</aside>
  },
}))

function renderMount(setOpen = vi.fn()) {
  const controller = { enabled: true, open: true, setOpen, activeConversationId: 4 } as unknown as AssistantController
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <AssistantContext.Provider value={controller}>
        <main><button type="button">page action</button></main>
        <AssistantMount />
      </AssistantContext.Provider>
    </QueryClientProvider>
  )
}

describe('AssistantMount', () => {
  afterEach(() => {
    resetClientErrorsForTesting()
    vi.restoreAllMocks()
    panel.broken = true
  })

  it('replaces a crashed panel with Retry, Copy details and Close, and reports it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const sink = vi.fn().mockResolvedValue(true)
    setClientErrorSink(sink)
    const setOpen = vi.fn()
    renderMount(setOpen)
    expect(await screen.findByText('The assistant hit a problem')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'page action' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Copy details' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Report a bug' })).not.toBeInTheDocument() // QA capture off
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ scope: 'assistant-panel', conversationId: 4 }))

    panel.broken = false
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('panel')).toBeInTheDocument()
  })

  it('closes from the failure card', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const setOpen = vi.fn()
    renderMount(setOpen)
    await userEvent.click(await screen.findByRole('button', { name: 'Close assistant' }))
    expect(setOpen).toHaveBeenCalledWith(false)
  })
})
