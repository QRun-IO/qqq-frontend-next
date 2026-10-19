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

// Tests for the assistant API client: probe, conversations, feedback and the SSE turn stream

import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssistantStreamEvent } from '@/types/assistant'
import { uiApiVersionHandler } from '@/mocks/ui-api-version'
import { server } from '@/mocks/node'
import apiClient from './client'
import {
  AssistantHttpError,
  AssistantStreamLostError,
  cancelAssistantTurn,
  createAssistantConversation,
  deleteAssistantConversation,
  getAssistantConfig,
  getAssistantConversation,
  listAssistantConversations,
  listActiveAssistantTurns,
  resumeAssistantTurn,
  sendAssistantFeedback,
  streamAssistantTurn,
  toAssistantEvent,
  updateAssistantConversation,
} from './assistant'

const BASE = '/qqq/v1/assistant'

/**
 * Formats stream events as SSE frames.
 *
 * @param events - `[type, data]` pairs; `seq` is taken from the data.
 * @returns The event-stream text.
 */
function sse(...events: Array<[string, Record<string, unknown>]>): string {
  return events.map(([type, data]) => `${data.seq !== undefined ? `id: ${data.seq}\n` : ''}event: ${type}\ndata: ${JSON.stringify(data)}\n\n`).join('')
}

/**
 * A streaming response that sends each chunk separately.
 *
 * @param chunks - Text chunks.
 * @returns The response.
 */
function streamResponse(...chunks: string[]): HttpResponse<ReadableStream> {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new HttpResponse(body, { headers: { 'Content-Type': 'text/event-stream' } })
}

const START = ['message.start', { seq: 1, turnId: 9, conversationId: 4, userMessageId: 10, messageId: 11 }] as [string, Record<string, unknown>]
const DELTA_A = ['text.delta', { seq: 2, messageId: 11, text: 'Hello' }] as [string, Record<string, unknown>]
const DELTA_B = ['text.delta', { seq: 3, messageId: 11, text: ' world' }] as [string, Record<string, unknown>]
const END = ['message.end', { seq: 4, messageId: 11, status: 'COMPLETE' }] as [string, Record<string, unknown>]

describe('getAssistantConfig', () => {
  beforeEach(() => server.use(uiApiVersionHandler('assistant')))

  it('does not probe config without the extension', async () => {
    server.use(uiApiVersionHandler())
    const probe = vi.fn(() => HttpResponse.json({ enabled: true }))
    server.use(http.get(`${BASE}/config`, probe))
    await expect(getAssistantConfig()).resolves.toBeNull()
    expect(probe).not.toHaveBeenCalled()
  })

  it('returns the config', async () => {
    server.use(http.get(`${BASE}/config`, () => HttpResponse.json({ enabled: true, shortcut: 'mod+j' })))
    await expect(getAssistantConfig()).resolves.toEqual({ enabled: true, shortcut: 'mod+j' })
  })

  it('normalizes conversation and attachment configuration together', async () => {
    server.use(http.get(`${BASE}/config`, () => HttpResponse.json({
      enabled: true,
      conversationsTable: ' assistant_conversation ',
      features: { attachments: true },
      limits: { maxAttachmentBytes: -1, attachmentTypes: [' image/png ', ''] },
    })))
    await expect(getAssistantConfig()).resolves.toMatchObject({
      enabled: true,
      conversationsTable: 'assistant_conversation',
      features: { attachments: true },
      limits: { attachmentTypes: ['image/png'] },
    })
    expect((await getAssistantConfig())?.limits).not.toHaveProperty('maxAttachmentBytes')
  })

  it.each([403, 404])('returns null on %i (qbit absent or not for this user)', async (status) => {
    server.use(http.get(`${BASE}/config`, () => HttpResponse.json({ error: 'nope' }, { status })))
    await expect(getAssistantConfig()).resolves.toBeNull()
  })

  it('returns null for a 2xx body that is not a config (the SPA not-found page)', async () => {
    server.use(http.get(`${BASE}/config`, () => HttpResponse.text('<!doctype html><html></html>')))
    await expect(getAssistantConfig()).resolves.toBeNull()
    server.use(http.get(`${BASE}/config`, () => HttpResponse.json([1])))
    await expect(getAssistantConfig()).resolves.toBeNull()
    server.use(http.get(`${BASE}/config`, () => HttpResponse.json({ enabled: 'yes' })))
    await expect(getAssistantConfig()).resolves.toBeNull()
  })

  it('rethrows other failures', async () => {
    server.use(http.get(`${BASE}/config`, () => HttpResponse.json({ error: 'boom' }, { status: 500 })))
    await expect(getAssistantConfig()).rejects.toThrow('boom')
  })
})

describe('conversations', () => {
  const conversation = { id: 4, title: 'Posts', status: 'ACTIVE', pinned: false, lastMessageAt: null, unreadCount: 0, createDate: '2026-10-12T00:00:00Z' }

  it('lists conversations, passing the status filter', async () => {
    let status: string | null = 'unset'
    server.use(http.get(`${BASE}/conversations`, ({ request }) => {
      status = new URL(request.url).searchParams.get('status')
      return HttpResponse.json({ conversations: [conversation] })
    }))
    await expect(listAssistantConversations()).resolves.toEqual([conversation])
    expect(status).toBeNull()
    await listAssistantConversations('ARCHIVED')
    expect(status).toBe('ARCHIVED')
  })

  it('treats a list without conversations as empty', async () => {
    server.use(http.get(`${BASE}/conversations`, () => HttpResponse.json({})))
    await expect(listAssistantConversations()).resolves.toEqual([])
  })

  it('creates a conversation with its page context', async () => {
    let body: unknown
    server.use(http.post(`${BASE}/conversations`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(conversation, { status: 201 })
    }))
    await expect(createAssistantConversation({ context: { tableName: 'person' } })).resolves.toEqual(conversation)
    expect(body).toEqual({ context: { tableName: 'person' } })
    await createAssistantConversation()
    expect(body).toEqual({})
  })

  it('loads a conversation with paging parameters', async () => {
    let search = ''
    server.use(http.get(`${BASE}/conversations/4`, ({ request }) => {
      search = new URL(request.url).search
      return HttpResponse.json({ conversation, messages: [] })
    }))
    await expect(getAssistantConversation(4)).resolves.toEqual({ conversation, messages: [] })
    expect(search).toBe('')
    await getAssistantConversation(4, { before: 20, limit: 50 })
    expect(search).toBe('?before=20&limit=50')
  })

  it('defaults missing messages to an empty list', async () => {
    server.use(http.get(`${BASE}/conversations/4`, () => HttpResponse.json({ conversation })))
    await expect(getAssistantConversation(4)).resolves.toEqual({ conversation, messages: [] })
  })

  it('patches and deletes a conversation', async () => {
    let patch: unknown
    let deleted = false
    server.use(
      http.patch(`${BASE}/conversations/4`, async ({ request }) => {
        patch = await request.json()
        return HttpResponse.json({ ...conversation, pinned: true })
      }),
      http.delete(`${BASE}/conversations/4`, () => {
        deleted = true
        return new HttpResponse(null, { status: 204 })
      })
    )
    await expect(updateAssistantConversation(4, { pinned: true })).resolves.toMatchObject({ pinned: true })
    expect(patch).toEqual({ pinned: true })
    await deleteAssistantConversation(4)
    expect(deleted).toBe(true)
  })

  it('cancels a turn and sends feedback', async () => {
    let feedback: unknown
    server.use(
      http.post(`${BASE}/turns/9/cancel`, () => HttpResponse.json({ status: 'CANCELLING' }, { status: 202 })),
      http.post(`${BASE}/messages/11/feedback`, async ({ request }) => {
        feedback = await request.json()
        return new HttpResponse(null, { status: 204 })
      })
    )
    await expect(cancelAssistantTurn(9)).resolves.toEqual({ status: 'CANCELLING' })
    await sendAssistantFeedback(11, { rating: -1, comment: 'wrong table' })
    expect(feedback).toEqual({ rating: -1, comment: 'wrong table' })
  })
})

describe('toAssistantEvent', () => {
  it('types known events and takes seq from the data, else from the id', () => {
    expect(toAssistantEvent({ event: 'text.delta', data: '{"seq":5,"messageId":1,"text":"a"}', id: '5' }))
      .toEqual({ event: { type: 'text.delta', seq: 5, messageId: 1, text: 'a' }, seq: 5 })
    expect(toAssistantEvent({ event: 'text.delta', data: '{"messageId":1,"text":"a"}', id: '6' }).seq).toBe(6)
  })

  it('skips unknown types and malformed data but keeps their sequence number', () => {
    expect(toAssistantEvent({ event: 'approval.required', data: '{"seq":7}', id: '7' })).toEqual({ event: null, seq: 7 })
    expect(toAssistantEvent({ event: 'text.delta', data: 'not json', id: '8' })).toEqual({ event: null, seq: 8 })
    expect(toAssistantEvent({ event: 'text.delta', data: '[1]', id: 'x' })).toEqual({ event: null, seq: undefined })
  })

  it('requires a sequence number except on ping', () => {
    expect(toAssistantEvent({ event: 'text.delta', data: '{"text":"a"}' })).toEqual({ event: null })
    expect(toAssistantEvent({ event: 'ping', data: '{}' }).event).toEqual({ type: 'ping' })
  })
})

describe('streamAssistantTurn', () => {
  it('posts the text and page context and delivers events in order without pings', async () => {
    let body: unknown
    let accept: string | null = null
    server.use(http.post(`${BASE}/conversations/4/turns`, async ({ request }) => {
      body = await request.json()
      accept = request.headers.get('accept')
      return streamResponse(sse(START, ['ping', {}], DELTA_A).slice(0, 37), sse(START, ['ping', {}], DELTA_A).slice(37), sse(DELTA_B, END))
    }))
    const events: AssistantStreamEvent[] = []
    const result = await streamAssistantTurn(4, { text: 'Hi', pageContext: { tableName: 'person' } }, { onEvent: (event) => events.push(event) })
    expect(body).toEqual({ text: 'Hi', pageContext: { tableName: 'person' } })
    expect(accept).toBe('text/event-stream')
    expect(events.map((event) => event.type)).toEqual(['message.start', 'text.delta', 'text.delta', 'message.end'])
    expect(result).toEqual({ status: 'COMPLETE', turnId: 9, lastSeq: 4 })
  })

  it('throws the backend message for a refused turn', async () => {
    server.use(http.post(`${BASE}/conversations/4/turns`, () => HttpResponse.json({ error: 'Daily budget reached' }, { status: 429 })))
    const error = await streamAssistantTurn(4, { text: 'Hi' }, { onEvent: vi.fn() }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(AssistantHttpError)
    expect((error as AssistantHttpError).status).toBe(429)
    expect((error as Error).message).toBe('Daily budget reached')
  })

  it('uses a generic message when the error body is not JSON', async () => {
    server.use(http.post(`${BASE}/conversations/4/turns`, () => HttpResponse.text('bad', { status: 400 })))
    await expect(streamAssistantTurn(4, { text: 'Hi' }, { onEvent: vi.fn() })).rejects.toThrow('HTTP 400')
  })

  it('starts the sign-in flow on 401', async () => {
    const notify = vi.spyOn(apiClient, 'notifyUnauthorized')
    server.use(http.post(`${BASE}/conversations/4/turns`, () => HttpResponse.json({ error: 'Session expired' }, { status: 401 })))
    await expect(streamAssistantTurn(4, { text: 'Hi' }, { onEvent: vi.fn() })).rejects.toThrow('Session expired')
    expect(notify).toHaveBeenCalled()
    notify.mockRestore()
  })

  it('resumes after a dropped connection from the last sequence number, skipping replayed events', async () => {
    const afters: Array<string | null> = []
    server.use(
      http.post(`${BASE}/conversations/4/turns`, () => streamResponse(sse(START, DELTA_A))),
      http.get(`${BASE}/turns/9/events`, ({ request }) => {
        afters.push(new URL(request.url).searchParams.get('after'))
        return streamResponse(sse(DELTA_A, DELTA_B, END))
      })
    )
    const texts: string[] = []
    const result = await streamAssistantTurn(4, { text: 'Hi' }, {
      onEvent: (event) => { if (event.type === 'text.delta') texts.push(event.text) },
      resumeDelayMs: 1,
    })
    expect(afters).toEqual(['2'])
    expect(texts).toEqual(['Hello', ' world'])
    expect(result.status).toBe('COMPLETE')
  })

  it('retries a failing resume and gives up after the recovery budget without progress', async () => {
    let calls = 0
    server.use(
      http.post(`${BASE}/conversations/4/turns`, () => streamResponse(sse(START))),
      http.get(`${BASE}/turns/9/events`, () => {
        calls++
        return calls === 1 ? HttpResponse.error() : HttpResponse.json({ error: 'unavailable' }, { status: 503 })
      })
    )
    await expect(streamAssistantTurn(4, { text: 'Hi' }, { onEvent: vi.fn(), resumeDelayMs: 1, resumeBudgetMs: 100 }))
      .rejects.toBeInstanceOf(AssistantStreamLostError)
    expect(calls).toBeGreaterThan(1)
  })

  it('does not resume a stream that dropped before the turn id was known', async () => {
    server.use(http.post(`${BASE}/conversations/4/turns`, () => HttpResponse.error()))
    await expect(streamAssistantTurn(4, { text: 'Hi' }, { onEvent: vi.fn(), resumeDelayMs: 1 }))
      .rejects.toBeInstanceOf(AssistantStreamLostError)
  })

  it('stops resuming when the turn is gone', async () => {
    server.use(
      http.post(`${BASE}/conversations/4/turns`, () => streamResponse(sse(START))),
      http.get(`${BASE}/turns/9/events`, () => HttpResponse.json({ error: 'Turn not found' }, { status: 404 }))
    )
    await expect(streamAssistantTurn(4, { text: 'Hi' }, { onEvent: vi.fn(), resumeDelayMs: 1 })).rejects.toThrow('Turn not found')
  })

  it('reports ABORTED when the request is aborted', async () => {
    const controller = new AbortController()
    server.use(http.post(`${BASE}/conversations/4/turns`, () => {
      controller.abort()
      return streamResponse(sse(START))
    }))
    await expect(streamAssistantTurn(4, { text: 'Hi' }, { onEvent: vi.fn(), signal: controller.signal }))
      .resolves.toMatchObject({ status: 'ABORTED' })
  })

  it('reports ABORTED when aborted while waiting to resume', async () => {
    const controller = new AbortController()
    server.use(http.post(`${BASE}/conversations/4/turns`, () => streamResponse(sse(START))))
    const pending = streamAssistantTurn(4, { text: 'Hi' }, {
      onEvent: () => { setTimeout(() => controller.abort(), 5) },
      signal: controller.signal,
      resumeDelayMs: 1000,
    })
    await expect(pending).resolves.toMatchObject({ status: 'ABORTED', turnId: 9 })
  })

  it('reports the server-side end status (cancelled)', async () => {
    server.use(http.post(`${BASE}/conversations/4/turns`, () =>
      streamResponse(sse(START, ['message.end', { seq: 2, messageId: 11, status: 'CANCELLED' }]))))
    await expect(streamAssistantTurn(4, { text: 'Hi' }, { onEvent: vi.fn() })).resolves.toMatchObject({ status: 'CANCELLED' })
  })
})

describe('resumeAssistantTurn', () => {
  it('replays events after the given sequence number right away', async () => {
    let after: string | null = null
    server.use(http.get(`${BASE}/turns/9/events`, ({ request }) => {
      after = new URL(request.url).searchParams.get('after')
      return streamResponse(sse(DELTA_B, END))
    }))
    const events: AssistantStreamEvent[] = []
    await expect(resumeAssistantTurn(9, 2, { onEvent: (event) => events.push(event) })).resolves.toEqual({ status: 'COMPLETE', turnId: 9, lastSeq: 4 })
    expect(after).toBe('2')
    expect(events.map((event) => event.seq)).toEqual([3, 4])
  })

  it('reports ABORTED when already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(resumeAssistantTurn(9, 0, { onEvent: vi.fn(), signal: controller.signal })).resolves.toMatchObject({ status: 'ABORTED' })
  })
})


describe('turn recovery contracts', () => {
  it('discovers active turns and silently supports an older backend', async () => {
    const turn = { turnId: 9, conversationId: 4, assistantMessageId: 11, userMessageId: 10, status: 'RUNNING', phase: 'thinking', startedAt: '2026-10-14T12:00:00Z', heartbeatAt: '2026-10-14T12:00:10Z', elapsedMs: 10000, live: true, concurrencyMode: 'supersede' }
    server.use(http.get(`${BASE}/turns/active`, () => HttpResponse.json({ turns: [turn] })))
    await expect(listActiveAssistantTurns()).resolves.toEqual([turn])
    server.use(http.get(`${BASE}/turns/active`, () => HttpResponse.json({ error: 'Not found' }, { status: 404 })))
    await expect(listActiveAssistantTurns()).resolves.toEqual([])
    server.use(http.get(`${BASE}/turns/active`, () => HttpResponse.json({ error: 'Denied' }, { status: 403 })))
    await expect(listActiveAssistantTurns()).rejects.toThrow('Denied')
  })

  it('treats old cancel 409 as finished, without swallowing other errors', async () => {
    server.use(http.post(`${BASE}/turns/9/cancel`, () => HttpResponse.json({ error: 'already finished' }, { status: 409 })))
    await expect(cancelAssistantTurn(9)).resolves.toEqual({ status: 'FINISHED' })
    server.use(http.post(`${BASE}/turns/9/cancel`, () => HttpResponse.json({ error: 'Denied' }, { status: 403 })))
    await expect(cancelAssistantTurn(9)).rejects.toThrow('Denied')
  })

  it('resumes across a pod switch and a 503 without duplicate text', async () => {
    let calls = 0
    const texts: string[] = []
    const cursors: string[] = []
    server.use(
      http.post(`${BASE}/conversations/4/turns`, () => streamResponse(sse(START, DELTA_A))),
      http.get(`${BASE}/turns/9/events`, ({ request }) => {
        cursors.push(new URL(request.url).searchParams.get('after') ?? '')
        return ++calls === 1 ? HttpResponse.json({ error: 'Restarting' }, { status: 503 }) : streamResponse(sse(START, DELTA_A, DELTA_B, END))
      }),
    )
    await expect(streamAssistantTurn(4, { text: 'Hi' }, {
      resumeDelayMs: 1, onEvent: (event) => { if (event.type === 'text.delta') texts.push(event.text) },
    })).resolves.toMatchObject({ status: 'COMPLETE' })
    expect(texts.join('')).toBe('Hello world')
    expect(cursors).toEqual(['2', '2'])
  })

  it('continues beyond three empty resumes and accepts phase events', async () => {
    let calls = 0
    const phases: string[] = []
    server.use(http.get(`${BASE}/turns/9/events`, () => ++calls <= 4 ? streamResponse(sse(['ping', {}])) : streamResponse(sse(
      ['turn.phase', { seq: 1, phase: 'tool', toolName: 'query_records', label: 'Search records' }], END,
    ))))
    await expect(resumeAssistantTurn(9, 0, { resumeDelayMs: 1, onEvent: (event) => { if (event.type === 'turn.phase') phases.push(event.label ?? '') } })).resolves.toMatchObject({ status: 'COMPLETE' })
    expect(calls).toBe(5)
    expect(phases).toEqual(['Search records'])
  })

  it('ends ping-only reconnects at the budget without moving the replay cursor', async () => {
    const cursors: string[] = []
    server.use(
      http.post(`${BASE}/conversations/4/turns`, () => streamResponse(sse(START, ['ping', { seq: 99 }]))),
      http.get(`${BASE}/turns/9/events`, ({ request }) => {
        cursors.push(new URL(request.url).searchParams.get('after') ?? '')
        return streamResponse(sse(['ping', { seq: 100 }]))
      }),
    )
    await expect(streamAssistantTurn(4, { text: 'Hi' }, { resumeDelayMs: 1, resumeBudgetMs: 100, onEvent: vi.fn() })).rejects.toThrow('Lost connection to the assistant.')
    expect(cursors.length).toBeGreaterThan(1)
    expect(new Set(cursors)).toEqual(new Set(['1']))
  })

  it('also bounds a resumed connection that never closes', async () => {
    server.use(http.get(`${BASE}/turns/9/events`, () => new HttpResponse(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode(sse(['ping', {}]))) },
    }), { headers: { 'Content-Type': 'text/event-stream' } })))
    await expect(resumeAssistantTurn(9, 0, { resumeBudgetMs: 50, onEvent: vi.fn() })).rejects.toBeInstanceOf(AssistantStreamLostError)
  })

  it.each([408, 429])('retries resumable HTTP %i', async (status) => {
    let calls = 0
    server.use(http.get(`${BASE}/turns/9/events`, () => ++calls === 1 ? HttpResponse.json({ error: 'Try again' }, { status }) : streamResponse(sse(END))))
    await expect(resumeAssistantTurn(9, 0, { resumeDelayMs: 1, onEvent: vi.fn() })).resolves.toMatchObject({ status: 'COMPLETE' })
    expect(calls).toBe(2)
  })

  it('retries a shutdown start and preserves the concurrency choice', async () => {
    const requests: unknown[] = []
    server.use(http.post(`${BASE}/conversations/4/turns`, async ({ request }) => {
      requests.push(await request.json())
      return requests.length === 1 ? HttpResponse.json({ error: 'Restarting', code: 'SHUTTING_DOWN' }, { status: 503 }) : streamResponse(sse(START, END))
    }))
    await expect(streamAssistantTurn(4, { text: 'Hi', concurrency: 'concurrent' }, { onEvent: vi.fn() })).resolves.toMatchObject({ status: 'COMPLETE' })
    expect(requests).toEqual([{ text: 'Hi', concurrency: 'concurrent' }, { text: 'Hi', concurrency: 'concurrent' }])
  })

  it('limits shutdown retries to three with one, two and three second delays', async () => {
    const times: number[] = []
    server.use(http.post(`${BASE}/conversations/4/turns`, () => {
      times.push(Date.now())
      return HttpResponse.json({ error: 'Restarting', code: 'SHUTTING_DOWN' }, { status: 503 })
    }))
    await expect(streamAssistantTurn(4, { text: 'Hi' }, { onEvent: vi.fn() })).rejects.toThrow('Restarting')
    expect(times).toHaveLength(4)
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(i * 1000 - 10)
  }, 10_000)

  it('does not retry an ambiguous start failure', async () => {
    const post = vi.fn(() => HttpResponse.json({ error: 'Unknown failure' }, { status: 503 }))
    server.use(http.post(`${BASE}/conversations/4/turns`, post))
    await expect(streamAssistantTurn(4, { text: 'Hi' }, { onEvent: vi.fn() })).rejects.toThrow('Unknown failure')
    expect(post).toHaveBeenCalledTimes(1)
  })
})

describe('stream failure handling', () => {
  it('carries the X-Request-Id of a refused turn', async () => {
    server.use(http.post(`${BASE}/conversations/4/turns`, () => HttpResponse.json({ error: 'Boom' }, { status: 500, headers: { 'X-Request-Id': 'req-77' } })))
    const error = await streamAssistantTurn(4, { text: 'Hi' }, { onEvent: vi.fn() }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(AssistantHttpError)
    expect((error as AssistantHttpError).requestId).toBe('req-77')
  })

  it('skips malformed chunks, repairs payloads and still finishes', async () => {
    const malformed = 'id: 2\nevent: text.delta\ndata: {not json\n\n'
    const result3 = ['tool.result', { seq: 3, messageId: 11, toolCallId: 't', name: 'q', summary: 's', outcome: 'OK', render: { type: 'records' } }] as [string, Record<string, unknown>]
    server.use(http.post(`${BASE}/conversations/4/turns`, () => streamResponse(sse(START), malformed, sse(result3, END))))
    const events: AssistantStreamEvent[] = []
    const result = await streamAssistantTurn(4, { text: 'Hi' }, { onEvent: (event) => events.push(event) })
    expect(result.status).toBe('COMPLETE')
    expect(events.map((event) => event.type)).toEqual(['message.start', 'tool.result', 'message.end'])
    expect(events[1]).toMatchObject({ render: { rows: [], columns: [] } })
  })

  it('treats a connection that goes quiet as lost and resumes it', async () => {
    let resumes = 0
    server.use(
      // never closes and never pings
      http.post(`${BASE}/conversations/4/turns`, () => new HttpResponse(new ReadableStream({
        start(controller) { controller.enqueue(new TextEncoder().encode(sse(START, DELTA_A))) },
      }), { headers: { 'Content-Type': 'text/event-stream' } })),
      http.get(`${BASE}/turns/9/events`, () => {
        resumes++
        return streamResponse(sse(DELTA_B, END))
      })
    )
    const result = await streamAssistantTurn(4, { text: 'Hi' }, { onEvent: vi.fn(), idleTimeoutMs: 30, resumeDelayMs: 1 })
    expect(result.status).toBe('COMPLETE')
    expect(resumes).toBe(1)
  })
})
