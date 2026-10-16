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

// Validation and repair of assistant payloads at the API boundary

import { describe, expect, it } from 'vitest'

import {
  normalizeAssistantMessage,
  normalizeAssistantPart,
  normalizeAssistantRender,
  normalizeConversationDetail,
  normalizePresentationPart,
  normalizeStreamEvent,
} from './assistant-normalize'

describe('normalizeAssistantRender', () => {
  it('fills the missing lists of a records render (the empty-query crash)', () => {
    expect(normalizeAssistantRender({ type: 'records', tableName: 'finding', tableLabel: 'Findings', openHref: '/app/finding', truncated: false }))
      .toMatchObject({ type: 'records', columns: [], rows: [], tableLabel: 'Findings' })
  })

  it('drops bad rows, stringifies scalar cells and keeps the good rows', () => {
    const render = normalizeAssistantRender({
      type: 'records', tableName: 't', tableLabel: 'T', openHref: '/app/t',
      columns: [{ name: 'a', label: 'A' }, null, 'x'],
      rows: [{ id: 1, href: '/app/t/1', values: { a: 5, b: null, c: { nested: true } } }, 7, null],
    })
    expect(render).toMatchObject({ columns: [{ name: 'a', label: 'A' }], rows: [{ id: 1, values: { a: '5', b: null, c: null } }], truncated: false })
  })

  it.each([
    [{ type: 'record', tableName: 't' }, { fields: [] }],
    [{ type: 'history', tableName: 't', recordId: 1, entries: [{ timestamp: 'x', user: 'u', message: 'm' }] }, { entries: [{ details: [] }] }],
    [{ type: 'count', tableName: 't', tableLabel: 'T' }, { count: 0 }],
    [{ type: 'widget', widgetName: 'w', label: 'W', widgetType: 'pieChart' }, { data: {} }],
  ])('repairs %j', (raw, expected) => {
    expect(normalizeAssistantRender(raw)).toMatchObject(expected)
  })

  it('turns unknown or unrepairable renders into an unknown render, never throwing', () => {
    expect(normalizeAssistantRender({ type: 'map', pins: [] })).toEqual({ type: 'unknown', originalType: 'map', raw: { type: 'map', pins: [] } })
    expect(normalizeAssistantRender({ type: 'pending_action', toolName: 'drop_table' })).toMatchObject({ type: 'unknown', originalType: 'pending_action' })
    expect(normalizeAssistantRender('nonsense')).toMatchObject({ type: 'unknown', originalType: '' })
    expect(normalizeAssistantRender(null)).toBeUndefined()
  })
})

describe('parts and messages', () => {
  it('keeps unknown part types as unknown parts', () => {
    expect(normalizeAssistantPart({ type: 'approval', id: 3 })).toEqual({ type: 'unknown', originalType: 'approval', raw: { type: 'approval', id: 3 } })
    expect(normalizeAssistantPart(42)).toMatchObject({ type: 'unknown' })
  })

  it('repairs known parts', () => {
    expect(normalizeAssistantPart({ type: 'text' })).toEqual({ type: 'text', text: '' })
    expect(normalizeAssistantPart({ type: 'record_refs', refs: 'x' })).toEqual({ type: 'record_refs', refs: [] })
    expect(normalizeAssistantPart({ type: 'notice', level: 'loud', text: 'hi' })).toEqual({ type: 'notice', level: 'info', text: 'hi' })
    expect(normalizeAssistantPart({ type: 'tool', toolCallId: 'a', name: 'q', summary: 's', outcome: 'WEIRD', render: { type: 'records' } }))
      .toMatchObject({ type: 'tool', render: { type: 'records', rows: [], columns: [] } })
  })

  it('drops presentation blocks it cannot repair and keeps unknown kinds for the view to skip', () => {
    const part = normalizePresentationPart({
      summary: 's',
      blocks: [{ kind: 'table', columns: [{ key: 'a', label: 'A' }], rows: [{}] }, { kind: 'future' }, 'x', { kind: 'actions', items: [{ label: 'Go', href: '/app' }, { label: 'none' }] }],
    })
    expect(part.markdown).toBe('')
    expect(part.blocks).toEqual([
      { kind: 'table', columns: [{ key: 'a', label: 'A' }], rows: [{ cells: {} }] },
      { kind: 'future' },
      { kind: 'actions', items: [{ label: 'Go', href: '/app' }] },
    ])
  })

  it('drops messages without an id and defaults the rest', () => {
    expect(normalizeAssistantMessage({ role: 'ASSISTANT' })).toBeNull()
    expect(normalizeAssistantMessage({ id: 3, role: 'BOT', status: 'WAT' })).toMatchObject({ id: 3, role: 'ASSISTANT', status: 'COMPLETE', turnId: null, parts: [] })
    expect(normalizeConversationDetail({ conversation: { id: 1 }, messages: [{ id: 1, parts: [{ type: 'text', text: 'a' }] }, 'junk'] }).messages).toHaveLength(1)
    expect(normalizeConversationDetail(null).messages).toEqual([])
  })
})

describe('normalizeStreamEvent', () => {
  it('skips a message.start without its ids (it cannot be applied)', () => {
    expect(normalizeStreamEvent({ type: 'message.start', seq: 1, turnId: 'x' })).toBeNull()
  })

  it('repairs a tool.result render and record refs', () => {
    expect(normalizeStreamEvent({ type: 'tool.result', seq: 2, toolCallId: 't', render: { type: 'records', tableLabel: 'F' }, recordRefs: [null] }))
      .toMatchObject({ outcome: 'ERROR', render: { type: 'records', rows: [], columns: [] }, recordRefs: [] })
  })

  it('defaults an unknown end status to ERROR, so the reply always finishes', () => {
    expect(normalizeStreamEvent({ type: 'message.end', seq: 3, messageId: 1, status: '??' })).toMatchObject({ status: 'ERROR' })
  })
})
