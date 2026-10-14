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

// Tests for applying stream events to messages, and the announcer's sentence detection

import { describe, expect, it } from 'vitest'

import type { AssistantMessage, AssistantStreamEvent } from '@/types/assistant'
import { endReply, messageText, optimisticTurnMessages, reduceStreamEvent, type TurnMessageIds } from './message-reducer'
import { completeSentenceLength } from './use-stream-announcer'

const REF = { tableName: 'person', tableLabel: 'People', id: 1, label: 'Alice', href: '/app/person/1' }

/**
 * Applies events to a fresh optimistic turn.
 *
 * @param events - Stream events.
 * @returns The messages and ids.
 */
function apply(...events: AssistantStreamEvent[]): { messages: AssistantMessage[]; ids: TurnMessageIds } {
  const ids: TurnMessageIds = { userId: -1, assistantId: -2 }
  let messages = optimisticTurnMessages('Hi', { userId: -1, assistantId: -2 }, '2026-10-12T00:00:00Z')
  for (const event of events) messages = reduceStreamEvent(messages, event, ids)
  return { messages, ids }
}

const START: AssistantStreamEvent = { type: 'message.start', seq: 1, turnId: 9, conversationId: 4, userMessageId: 10, messageId: 11 }

describe('reduceStreamEvent', () => {
  it('appends a presentation to its message and makes its summary available to announcements', () => {
    const part = { type: 'presentation' as const, summary: '101 images.', markdown: '101 images.', blocks: [] }
    const { messages } = apply(START, { type: 'presentation', seq: 2, messageId: 11, part })
    expect(messages[1].parts).toEqual([part])
    expect(messageText(messages[1])).toBe('\n101 images.\n')
  })

  it('swaps temporary ids for the server ids on message.start', () => {
    const { messages, ids } = apply(START)
    expect(messages.map((message) => [message.id, message.turnId])).toEqual([[10, 9], [11, 9]])
    expect(ids).toEqual({ userId: 10, assistantId: 11 })
  })

  it('appends text deltas to the last text part and starts a new one after other parts', () => {
    const { messages } = apply(
      START,
      { type: 'text.delta', seq: 2, messageId: 11, text: 'Hel' },
      { type: 'text.delta', seq: 3, messageId: 11, text: 'lo' },
      { type: 'tool.start', seq: 4, messageId: 11, toolCallId: 't', name: 'count_records', summary: 'Counting' },
      { type: 'text.delta', seq: 5, messageId: 11, text: 'Done' },
    )
    expect(messages[1].parts.map((part) => part.type)).toEqual(['text', 'tool', 'text'])
    expect(messageText(messages[1])).toBe('HelloDone')
  })

  it('completes tool parts, adds record refs after them without duplicates, and ignores repeated starts', () => {
    const result: AssistantStreamEvent = { type: 'tool.result', seq: 3, messageId: 11, toolCallId: 't', name: 'get_record', outcome: 'OK', summary: 'Got Alice', recordRefs: [REF] }
    const { messages } = apply(
      START,
      { type: 'tool.start', seq: 2, messageId: 11, toolCallId: 't', name: 'get_record', summary: 'Getting' },
      { type: 'tool.start', seq: 2, messageId: 11, toolCallId: 't', name: 'get_record', summary: 'Getting' },
      result,
      { ...result, seq: 4, recordRefs: [REF, { ...REF, id: 2, label: 'Bob' }] },
      { type: 'tool.result', seq: 5, messageId: 11, toolCallId: 'u', name: 'count_records', outcome: 'DENIED', summary: 'Not allowed', render: { type: 'count', tableName: 'x', tableLabel: 'X', count: 1, openHref: '/app/x' } },
    )
    expect(messages[1].parts).toEqual([
      { type: 'tool', toolCallId: 't', name: 'get_record', summary: 'Got Alice', outcome: 'OK' },
      { type: 'record_refs', refs: [REF, { ...REF, id: 2, label: 'Bob' }] },
      { type: 'tool', toolCallId: 'u', name: 'count_records', summary: 'Not allowed', outcome: 'DENIED', render: { type: 'count', tableName: 'x', tableLabel: 'X', count: 1, openHref: '/app/x' } },
    ])
  })

  it('adds navigate, notice and error parts and applies the end status', () => {
    const { messages } = apply(
      START,
      { type: 'ui.navigate', seq: 2, messageId: 11, href: '/app/person' },
      { type: 'notice', seq: 3, messageId: 11, level: 'warning', text: 'Truncated' },
      { type: 'error', seq: 4, code: 'BUDGET', message: 'Budget reached' },
      { type: 'usage', seq: 5, turnId: 9, inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0, costMicros: 1 },
      { type: 'message.end', seq: 6, messageId: 11, status: 'ERROR' },
    )
    expect(messages[1].parts).toEqual([
      { type: 'navigate', href: '/app/person' },
      { type: 'notice', level: 'warning', text: 'Truncated' },
      { type: 'notice', level: 'error', text: 'Budget reached' },
    ])
    expect(messages[1].status).toBe('ERROR')
  })

  it('leaves messages unchanged for an unknown message id', () => {
    const { messages } = apply(START)
    expect(reduceStreamEvent(messages, { type: 'text.delta', seq: 2, messageId: 99, text: 'x' }, { userId: 10, assistantId: 99 })).toBe(messages)
  })

  it('keeps the user message when attaching to a reply (no user id)', () => {
    const messages = optimisticTurnMessages('Hi', { userId: 10, assistantId: 11 }, '2026-10-12T00:00:00Z')
    const ids: TurnMessageIds = { userId: null, assistantId: 11 }
    expect(reduceStreamEvent(messages, START, ids).map((message) => message.id)).toEqual([10, 11])
  })
})

describe('endReply', () => {
  it('ends a streaming reply with a notice, and keeps a finished status', () => {
    const { messages } = apply(START)
    const ended = endReply(messages, 11, 'ERROR', 'Lost')
    expect(ended[1]).toMatchObject({ status: 'ERROR', parts: [{ type: 'notice', level: 'error', text: 'Lost' }] })
    expect(endReply(ended, 11, 'CANCELLED')[1].status).toBe('ERROR')
  })
})

describe('completeSentenceLength', () => {
  it('finds the end of the last complete sentence', () => {
    expect(completeSentenceLength('One. Two! Three')).toBe(9)
    expect(completeSentenceLength('Line one\nmore')).toBe(9)
    expect(completeSentenceLength('Version 1.5 is')).toBe(0)
    expect(completeSentenceLength('Done.')).toBe(5)
  })
})
