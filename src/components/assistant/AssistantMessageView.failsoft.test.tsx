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

// Fail-soft rendering of assistant replies: a failed bulk-load tool step, malformed parts and a
// renderer that throws all stay local to their part; the rest of the reply keeps rendering.

import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AssistantMessage, AssistantPart, AssistantStreamEvent } from '@/types/assistant'
import { toAssistantEvent } from '@/lib/api/assistant'
import { resetClientErrorsForTesting, setClientErrorSink } from '@/lib/errors/client-errors'
import { AssistantMessageView, PART_RENDERERS } from './AssistantMessageView'
import { optimisticTurnMessages, reduceStreamEvent, type TurnMessageIds } from './message-reducer'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }), usePathname: () => '/app/home' }))

/**
 * Parses SSE frames the way the stream client does.
 *
 * @param frames - `[type, data]` pairs, as the server writes them.
 * @returns The typed events.
 */
function events(...frames: Array<[string, Record<string, unknown>]>): AssistantStreamEvent[] {
  return frames.flatMap(([type, data]) => {
    const { event } = toAssistantEvent({ id: String(data.seq), event: type, data: JSON.stringify(data) })
    return event ? [event] : []
  })
}

/**
 * Renders messages like the panel does.
 *
 * @param messages - The messages.
 * @returns The render result.
 */
function show(messages: AssistantMessage[]) {
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      {messages.map((message) => <AssistantMessageView key={message.id} message={message} onSend={() => undefined} />)}
    </QueryClientProvider>
  )
}

// What qbit-assistant streams when a bulk-load tool rejects an attached file: a tool.result with
// INVALID_INPUT, the server's message as the summary and no render (BulkLoadTools.fail).
const BULK_LOAD_FAILURE: Array<[string, Record<string, unknown>]> = [
  ['message.start', { seq: 1, turnId: 9, conversationId: 4, userMessageId: 10, messageId: 11, startedAt: '2026-10-16T19:50:00Z' }],
  ['turn.phase', { seq: 2, phase: 'thinking', label: 'thinking' }],
  ['tool.start', { seq: 3, messageId: 11, toolCallId: 'toolu_1', name: 'describe_table', summary: 'Describing a table' }],
  ['tool.result', { seq: 4, messageId: 11, toolCallId: 'toolu_1', name: 'describe_table', outcome: 'OK', summary: 'Described Blog Posts' }],
  ['tool.start', { seq: 5, messageId: 11, toolCallId: 'toolu_2', name: 'bulk_load_attach', summary: 'Reading the file' }],
  ['tool.result', { seq: 6, messageId: 11, toolCallId: 'toolu_2', name: 'bulk_load_attach', outcome: 'INVALID_INPUT', summary: 'Unrecognized file extension - expecting .csv or .xlsx' }],
  ['turn.phase', { seq: 7, phase: 'writing', label: 'writing' }],
  ['text.delta', { seq: 8, messageId: 11, text: 'I could not read that file.' }],
  ['usage', { seq: 9, turnId: 9, inputTokens: 10, outputTokens: 5 }],
  ['message.end', { seq: 10, messageId: 11, status: 'COMPLETE', stopReason: 'end_turn' }],
]

describe('assistant replies fail soft', () => {
  afterEach(() => {
    resetClientErrorsForTesting()
    vi.restoreAllMocks()
  })

  it('shows a failed bulk-load step from the live stream as a failed step, not a crash', () => {
    const ids: TurnMessageIds = { userId: -1, assistantId: -2 }
    let messages = optimisticTurnMessages('can we post this as a blog?', { userId: -1, assistantId: -2 }, '2026-10-16T19:50:00Z')
    const live = events(...BULK_LOAD_FAILURE)
    for (const [index, event] of live.entries()) {
      messages = reduceStreamEvent(messages, event, ids)
      // every intermediate state renders (the panel renders after each event)
      if (index < live.length - 1) show(messages).unmount()
    }
    show(messages)
    expect(screen.getByText('Described Blog Posts')).toBeInTheDocument()
    expect(screen.getByText('Unrecognized file extension - expecting .csv or .xlsx')).toBeInTheDocument()
    expect(screen.getAllByText(', Invalid request')).toHaveLength(1)
    expect(screen.getByText('I could not read that file.')).toBeInTheDocument()
    expect(screen.queryByText(/could not be shown/)).toBeNull()
  })

  it('keeps a renderer that throws inside its part; the reply keeps rendering', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const sink = vi.fn().mockResolvedValue(true)
    setClientErrorSink(sink)
    const original = PART_RENDERERS.navigate
    PART_RENDERERS.navigate = () => {
      throw new TypeError("Cannot read properties of undefined (reading 'length')")
    }
    try {
      show([{ id: 11, role: 'ASSISTANT', status: 'COMPLETE', turnId: 9, createDate: '', parts: [
        { type: 'navigate', href: '/app/person' },
        { type: 'text', text: 'Still here.' },
      ] }])
    } finally {
      PART_RENDERERS.navigate = original
    }
    expect(screen.getByText('This part could not be shown.')).toBeInTheDocument()
    expect(screen.getByText('Still here.')).toBeInTheDocument()
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ scope: 'assistant-part', partType: 'navigate', messageId: 11 }))
    // the report names the part type and the error, never the reply's content
    expect(JSON.stringify(sink.mock.calls)).not.toContain('Still here')
  })

  it('degrades malformed parts and a message without parts locally', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const malformed = [null, 42, { text: 'no type' }, { type: 'text', text: 'Readable part.' }] as unknown as AssistantPart[]
    show([
      { id: 11, role: 'ASSISTANT', status: 'COMPLETE', turnId: 9, createDate: '', parts: malformed },
      { id: 12, role: 'ASSISTANT', status: 'COMPLETE', turnId: 9, createDate: '', parts: undefined as unknown as AssistantPart[] },
      { id: 13, role: 'USER', status: 'COMPLETE', turnId: 9, createDate: '', parts: [null, { type: 'text', text: 'My question' }] as unknown as AssistantPart[] },
    ])
    expect(screen.getAllByText('This part could not be shown.')).toHaveLength(2)
    expect(screen.getByText('Readable part.')).toBeInTheDocument()
    expect(screen.getByText('My question')).toBeInTheDocument()
  })

  it('applies events to a malformed message instead of throwing', () => {
    const ids: TurnMessageIds = { userId: null, assistantId: 11 }
    const broken = [{ id: 11, role: 'ASSISTANT', status: 'STREAMING', turnId: 9, createDate: '' }] as unknown as AssistantMessage[]
    const [text] = events(['text.delta', { seq: 2, messageId: 11, text: 'Hello' }])
    const next = reduceStreamEvent(broken, text, ids)
    expect(next[0].parts).toEqual([{ type: 'text', text: 'Hello' }])
    const [presentation] = events(['presentation', { seq: 3, messageId: 11, part: 'not a part' }])
    expect(presentation).toBeUndefined()
  })
})
