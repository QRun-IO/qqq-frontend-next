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

// Tests for the assistant panel: probe gating, streaming, cancel, markdown safety, deep link

import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'jest-axe'

import type { QInstance } from '@/types'
import { server } from '@/mocks/node'
import { uiApiVersionHandler } from '@/mocks/ui-api-version'
import { AssistantProvider, useAssistantController } from './AssistantProvider'
import { AssistantHeaderButton } from './AssistantHeaderButton'
import * as assistantApi from '@/lib/api/assistant'
import { AssistantMount } from './AssistantMount'

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

const BASE = '/qqq/v1/assistant'
const META = { tables: { person: { name: 'person', label: 'People' } }, supplementalInstanceMetaData: { assistant: {} } } as unknown as QInstance
/** Matches rendered message text, not the screen-reader announcer that repeats it. */
const MESSAGE_TEXT = ':not([data-qqq-id="assistant-announcer"])'

const CONVERSATION = { id: 4, title: null, status: 'ACTIVE', pinned: false, lastMessageAt: null, unreadCount: 0, createDate: '2026-10-12T00:00:00Z' }

/**
 * Formats stream events as SSE frames.
 *
 * @param events - `[type, data]` pairs.
 * @returns Event-stream text.
 */
function sse(...events: Array<[string, Record<string, unknown>]>): string {
  return events.map(([type, data]) => `id: ${data.seq}\nevent: ${type}\ndata: ${JSON.stringify(data)}\n\n`).join('')
}

/**
 * A stream the test writes to and closes.
 *
 * @returns The response factory, a writer and a closer.
 */
function controllableStream() {
  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null
  const body = new ReadableStream<Uint8Array>({ start(c) { controller = c } })
  return {
    response: () => new HttpResponse(body, { headers: { 'Content-Type': 'text/event-stream' } }),
    write: (text: string) => controller?.enqueue(encoder.encode(text)),
    close: () => controller?.close(),
  }
}

/** What the server has stored for conversation 4 (served after a turn ends). */
const persisted: { messages: unknown[] } = { messages: [] }

/**
 * The stored messages of a finished turn.
 *
 * @param text - The user's text.
 * @param parts - The reply's parts.
 * @param status - The reply's status.
 * @returns The messages.
 */
function storedTurn(text: string, parts: unknown[], status = 'COMPLETE'): unknown[] {
  return [
    { id: 10, role: 'USER', status: 'COMPLETE', turnId: 9, createDate: '2026-10-12T00:00:00Z', parts: [{ type: 'text', text }] },
    { id: 11, role: 'ASSISTANT', status, turnId: 9, createDate: '2026-10-12T00:00:00Z', parts },
  ]
}

const START = ['message.start', { seq: 1, turnId: 9, conversationId: 4, userMessageId: 10, messageId: 11 }] as [string, Record<string, unknown>]

/**
 * Harness: the dashboard's assistant wiring.
 *
 * @param props - Component properties.
 * @param props.metaData - Instance metadata (defaults to one announcing the qbit).
 * @returns The shell.
 */
function Shell({ metaData = META }: { metaData?: QInstance }) {
  const assistant = useAssistantController(metaData, true)
  return (
    <AssistantProvider value={assistant}>
      <header><AssistantHeaderButton /></header>
      <main>page</main>
      <AssistantMount />
    </AssistantProvider>
  )
}

/**
 * Renders the harness.
 *
 * @param metaData - Instance metadata (defaults to one announcing the qbit).
 * @returns The render result.
 */
function renderShell(metaData?: QInstance) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><Shell metaData={metaData} /></QueryClientProvider>)
}

/**
 * Registers the probe and conversation routes.
 *
 * @param config - The probe response, or a status code.
 */
function mockAssistant(config: Record<string, unknown> | number = { enabled: true }) {
  persisted.messages = []
  server.use(
    uiApiVersionHandler('assistant'),
    http.get(`${BASE}/turns/active`, () => HttpResponse.json({ error: 'Not found' }, { status: 404 })),
    http.get(`${BASE}/config`, () => (typeof config === 'number' ? HttpResponse.json({ error: 'x' }, { status: config }) : HttpResponse.json(config))),
    http.get(`${BASE}/conversations`, () => HttpResponse.json({ conversations: [] })),
    http.post(`${BASE}/conversations`, () => HttpResponse.json(CONVERSATION, { status: 201 })),
    http.get(`${BASE}/conversations/4`, () => HttpResponse.json({ conversation: CONVERSATION, messages: persisted.messages })),
  )
}

// The panel is lazily loaded; load its module once so the tests do not race the import
beforeAll(async () => {
  await import('./AssistantPanel')
}, 30_000)

beforeEach(() => {
  router.push.mockReset()
  router.replace.mockReset()
  window.history.replaceState(null, '', '/app/person')
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

describe('assistant gating', () => {
  it('does not probe an instance whose metadata does not announce the qbit', async () => {
    const probe = vi.fn()
    mockAssistant()
    server.use(http.get(`${BASE}/config`, () => {
      probe()
      return HttpResponse.json({ enabled: true })
    }))
    renderShell({ tables: META.tables } as unknown as QInstance)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(probe).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /assistant/i })).toBeNull()
  })

  it.each([404, 403])('renders nothing when the probe answers %i', async (status) => {
    mockAssistant(status)
    renderShell()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByRole('button', { name: /assistant/i })).toBeNull()
  })

  it('renders nothing when the assistant is disabled for the user', async () => {
    mockAssistant({ enabled: false, reason: 'NO_PERMISSION' })
    renderShell()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByRole('button', { name: /assistant/i })).toBeNull()
  })

  it('shows the unread count on the header button', async () => {
    mockAssistant()
    server.use(http.get(`${BASE}/conversations`, () => HttpResponse.json({ conversations: [{ ...CONVERSATION, unreadCount: 2 }, { ...CONVERSATION, id: 5, unreadCount: 1 }] })))
    renderShell()
    expect(await screen.findByRole('button', { name: 'Ask the assistant, 3 unread (Ctrl+J or ⌘J)' })).toBeInTheDocument()
  })
})

describe('asking a question', () => {
  it('sends a presentation prompt through the same engine and context as the composer', async () => {
    mockAssistant()
    const reply = { type: 'presentation', summary: 'Images found.', markdown: 'Images found.', blocks: [{ kind: 'actions', items: [{ label: 'Show PNG', prompt: 'Show me PNG files' }] }] }
    const requests: unknown[] = []
    server.use(http.post(`${BASE}/conversations/4/turns`, async ({ request }) => {
      const body = await request.json() as { text: string }
      requests.push(body)
      persisted.messages = storedTurn(body.text, [reply])
      return new HttpResponse(sse(START, ['presentation', { seq: 2, messageId: 11, part: reply }], ['message.end', { seq: 3, messageId: 11, status: 'COMPLETE' }]), { headers: { 'Content-Type': 'text/event-stream' } })
    }))
    const user = userEvent.setup()
    renderShell()
    await user.click(await screen.findByRole('button', { name: /^Ask the assistant/ }))
    const composer = await screen.findByRole('textbox', { name: 'Message the assistant' })
    await user.type(composer, 'Count images{Enter}')
    const action = await screen.findByRole('button', { name: 'Show PNG' })
    await waitFor(() => expect(action).toBeEnabled())
    await user.click(action)
    await waitFor(() => expect(requests[1]).toEqual({ concurrency: 'supersede', text: 'Show me PNG files', pageContext: { route: '/app/person', tableName: 'person' } }))
  })

  it('streams the reply with a tool step and record chip, follows navigation, and passes axe', async () => {
    mockAssistant()
    const stream = controllableStream()
    let turnBody: unknown
    server.use(http.post(`${BASE}/conversations/4/turns`, async ({ request }) => {
      turnBody = await request.json()
      return stream.response()
    }))
    const user = userEvent.setup()
    renderShell()
    await user.click(await screen.findByRole('button', { name: /^Ask the assistant/ }))
    const panel = await screen.findByRole('dialog', {}, { timeout: 10_000 })
    const composer = within(panel).getByRole('textbox', { name: 'Message the assistant' })
    expect(within(panel).getByText('On: People')).toBeInTheDocument()
    await user.type(composer, 'Who is active?{Enter}')

    await waitFor(() => expect(turnBody).toEqual({ concurrency: 'supersede', text: 'Who is active?', pageContext: { route: '/app/person', tableName: 'person' } }))
    expect(within(panel).getByText('Who is active?')).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Stop the reply' })).toBeInTheDocument()

    act(() => stream.write(sse(
      START,
      ['tool.start', { seq: 2, messageId: 11, toolCallId: 't1', name: 'query_records', summary: 'Querying People' }],
      ['tool.result', {
        seq: 3, messageId: 11, toolCallId: 't1', name: 'query_records', outcome: 'OK', summary: 'Queried People · 1 row',
        recordRefs: [{ tableName: 'person', tableLabel: 'People', id: 1, label: 'Alice Johnson', href: '/app/person/1' }],
      }],
      ['text.delta', { seq: 4, messageId: 11, text: 'One person is **active**. ' }],
      ['ui.navigate', { seq: 5, messageId: 11, href: '/app/person/1' }],
      ['text.delta', { seq: 6, messageId: 11, text: 'Opened it.' }],
    )))

    expect(await within(panel).findByText('active')).toBeInTheDocument()
    expect(within(panel).getByText('Queried People · 1 row')).toBeInTheDocument()
    const chip = within(panel).getByRole('link', { name: /Alice Johnson/ })
    expect(chip).toHaveAttribute('href', '/app/person/1')
    expect(router.push).toHaveBeenCalledWith('/app/person/1')

    persisted.messages = storedTurn('Who is active?', [
      { type: 'tool', toolCallId: 't1', name: 'query_records', summary: 'Queried People · 1 row', outcome: 'OK' },
      { type: 'record_refs', refs: [{ tableName: 'person', tableLabel: 'People', id: 1, label: 'Alice Johnson', href: '/app/person/1' }] },
      { type: 'text', text: 'One person is **active**. Opened it.' },
    ])
    act(() => stream.write(sse(['message.end', { seq: 7, messageId: 11, status: 'COMPLETE' }])))
    act(() => stream.close())
    await waitFor(() => expect(within(panel).getByRole('button', { name: 'Send' })).toBeInTheDocument())
    expect(await within(panel).findByRole('button', { name: 'Good response' })).toBeInTheDocument()
    expect(within(panel).getByText('active')).toBeInTheDocument()
    expect(await axe(panel)).toHaveNoViolations()
  })

  it('shows the configured persona: name, greeting and starter prompts that send', async () => {
    mockAssistant({ enabled: true, profile: { displayName: 'Ada', icon: 'school', greeting: 'Hi, I am Ada.', starterPrompts: ['How many posts?'] } })
    const stream = controllableStream()
    let turnBody: unknown
    server.use(http.post(`${BASE}/conversations/4/turns`, async ({ request }) => {
      turnBody = await request.json()
      return stream.response()
    }))
    const user = userEvent.setup()
    renderShell()
    await user.click(await screen.findByRole('button', { name: /^Ask the assistant/ }))
    const panel = await screen.findByRole('dialog', {}, { timeout: 10_000 })
    expect(within(panel).getAllByText('Ada').length).toBeGreaterThan(0)
    expect(within(panel).getByText('Hi, I am Ada.')).toBeInTheDocument()
    await user.click(within(panel).getByRole('button', { name: 'How many posts?' }))
    await waitFor(() => expect(turnBody).toMatchObject({ text: 'How many posts?' }))
    act(() => stream.close())
  })

  it('switches a conversation between Read-only and Write', async () => {
    mockAssistant({ enabled: true, features: { writeMode: true } })
    const stream = controllableStream()
    let patched: unknown
    server.use(
      http.post(`${BASE}/conversations`, () => HttpResponse.json({ ...CONVERSATION, writeMode: false }, { status: 201 })),
      http.get(`${BASE}/conversations/4`, () => HttpResponse.json({ conversation: { ...CONVERSATION, writeMode: false }, messages: [] })),
      http.post(`${BASE}/conversations/4/turns`, () => stream.response()),
      http.patch(`${BASE}/conversations/4`, async ({ request }) => {
        patched = await request.json()
        return HttpResponse.json({ ...CONVERSATION, writeMode: true })
      })
    )
    const user = userEvent.setup()
    renderShell()
    await user.click(await screen.findByRole('button', { name: /^Ask the assistant/ }))
    const panel = await screen.findByRole('dialog', {}, { timeout: 10_000 })
    await user.type(within(panel).getByRole('textbox', { name: 'Message the assistant' }), 'hi{Enter}')
    act(() => stream.close())
    const toggle = await within(panel).findByRole('switch', { name: /read-only/i })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    await user.click(toggle)
    await waitFor(() => expect(patched).toEqual({ writeMode: true }))
    expect(await within(panel).findByRole('switch', { name: /write/i })).toHaveAttribute('aria-checked', 'true')
  })

  it('stops a reply through the cancel endpoint', async () => {
    mockAssistant()
    const stream = controllableStream()
    let cancelled = false
    server.use(
      http.post(`${BASE}/conversations/4/turns`, () => stream.response()),
      http.post(`${BASE}/turns/9/cancel`, () => {
        cancelled = true
        persisted.messages = storedTurn('Count people', [{ type: 'text', text: 'Counting' }], 'CANCELLED')
        stream.write(sse(['message.end', { seq: 3, messageId: 11, status: 'CANCELLED' }]))
        stream.close()
        return HttpResponse.json({ status: 'CANCELLING' }, { status: 202 })
      }),
    )
    const user = userEvent.setup()
    renderShell()
    await user.click(await screen.findByRole('button', { name: /^Ask the assistant/ }))
    const panel = await screen.findByRole('dialog', {}, { timeout: 10_000 })
    await user.type(within(panel).getByRole('textbox', { name: 'Message the assistant' }), 'Count people{Enter}')
    act(() => stream.write(sse(START, ['text.delta', { seq: 2, messageId: 11, text: 'Counting' }])))
    await within(panel).findByText('Counting')
    await user.click(within(panel).getByRole('button', { name: 'Stop the reply' }))
    await waitFor(() => expect(cancelled).toBe(true))
    expect(await within(panel).findByText('Stopped.')).toBeInTheDocument()
  })

  it('still stops when the stop request fails, and the composer stays usable', async () => {
    mockAssistant()
    const stream = controllableStream()
    server.use(
      http.post(`${BASE}/conversations/4/turns`, () => stream.response()),
      http.post(`${BASE}/turns/9/cancel`, () => HttpResponse.json({ error: 'Gateway down' }, { status: 502 })),
    )
    const user = userEvent.setup()
    renderShell()
    await user.click(await screen.findByRole('button', { name: /^Ask the assistant/ }))
    const panel = await screen.findByRole('dialog', {}, { timeout: 10_000 })
    await user.type(within(panel).getByRole('textbox', { name: 'Message the assistant' }), 'Count people{Enter}')
    act(() => stream.write(sse(START, ['text.delta', { seq: 2, messageId: 11, text: 'Counting' }])))
    await within(panel).findByText('Counting')
    await user.click(within(panel).getByRole('button', { name: 'Stop the reply' }))
    expect(await within(panel).findByText('Stopped.')).toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: /^Stop/ })).not.toBeInTheDocument()
    expect(within(panel).getByRole('textbox', { name: 'Message the assistant' })).toBeEnabled()
  })

  it('stops at once on a second Stop while the server is still stopping', async () => {
    mockAssistant()
    const stream = controllableStream()
    server.use(
      http.post(`${BASE}/conversations/4/turns`, () => stream.response()),
      http.post(`${BASE}/turns/9/cancel`, () => HttpResponse.json({ status: 'CANCELLING' }, { status: 202 })),
    )
    const user = userEvent.setup()
    renderShell()
    await user.click(await screen.findByRole('button', { name: /^Ask the assistant/ }))
    const panel = await screen.findByRole('dialog', {}, { timeout: 10_000 })
    await user.type(within(panel).getByRole('textbox', { name: 'Message the assistant' }), 'Count people{Enter}')
    act(() => stream.write(sse(START)))
    await user.click(await within(panel).findByRole('button', { name: 'Stop the reply' }))
    await user.click(await within(panel).findByRole('button', { name: 'Stop now' }))
    expect(await within(panel).findByText('Stopped.', { selector: MESSAGE_TEXT })).toBeInTheDocument()
  })

  it('offers Retry on a failed reply, which asks the question again', async () => {
    mockAssistant()
    let posts = 0
    server.use(http.post(`${BASE}/conversations/4/turns`, () => {
      posts++
      return HttpResponse.json({ error: 'Provider unavailable' }, { status: 503 })
    }))
    const user = userEvent.setup()
    renderShell()
    await user.click(await screen.findByRole('button', { name: /^Ask the assistant/ }))
    const panel = await screen.findByRole('dialog', {}, { timeout: 10_000 })
    await user.type(within(panel).getByRole('textbox', { name: 'Message the assistant' }), 'Hi{Enter}')
    expect(await within(panel).findByText('Provider unavailable')).toBeInTheDocument()
    await user.click(within(panel).getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(posts).toBe(2))
  })

  it('shows a refused turn as an error in the reply', async () => {
    mockAssistant()
    server.use(http.post(`${BASE}/conversations/4/turns`, () => HttpResponse.json({ error: 'Daily budget reached' }, { status: 429 })))
    const user = userEvent.setup()
    renderShell()
    await user.click(await screen.findByRole('button', { name: /^Ask the assistant/ }))
    const panel = await screen.findByRole('dialog', {}, { timeout: 10_000 })
    await user.type(within(panel).getByRole('textbox', { name: 'Message the assistant' }), 'Hi{Enter}')
    expect(await within(panel).findByText('Daily budget reached')).toBeInTheDocument()
  })

  it('omits the page context once the chip is dismissed', async () => {
    mockAssistant()
    let turnBody: unknown
    server.use(http.post(`${BASE}/conversations/4/turns`, async ({ request }) => {
      turnBody = await request.json()
      const stream = controllableStream()
      stream.write(sse(START, ['message.end', { seq: 2, messageId: 11, status: 'COMPLETE' }]))
      stream.close()
      return stream.response()
    }))
    const user = userEvent.setup()
    renderShell()
    await user.click(await screen.findByRole('button', { name: /^Ask the assistant/ }))
    const panel = await screen.findByRole('dialog', {}, { timeout: 10_000 })
    await user.click(within(panel).getByRole('button', { name: "Don't send page context (People)" }))
    await user.type(within(panel).getByRole('textbox', { name: 'Message the assistant' }), 'Hi{Enter}')
    await waitFor(() => expect(turnBody).toEqual({ concurrency: 'supersede', text: 'Hi' }))
  })
})

describe('markdown safety', () => {
  it('renders only same-origin /app links, never raw HTML or images', async () => {
    mockAssistant()
    const text = [
      'See [the record](/app/person/1) or [elsewhere](https://evil.example.com/x?d=secret).',
      '<img src="https://evil.example.com/p.png"><b>bold html</b>',
      '![tracker](https://evil.example.com/t.png) [js](javascript:alert(1))',
    ].join('\n\n')
    server.use(http.post(`${BASE}/conversations/4/turns`, () => {
      const stream = controllableStream()
      persisted.messages = storedTurn('Links?', [{ type: 'text', text }])
      stream.write(sse(START, ['text.delta', { seq: 2, messageId: 11, text }], ['message.end', { seq: 3, messageId: 11, status: 'COMPLETE' }]))
      stream.close()
      return stream.response()
    }))
    const user = userEvent.setup()
    renderShell()
    await user.click(await screen.findByRole('button', { name: /^Ask the assistant/ }))
    const panel = await screen.findByRole('dialog', {}, { timeout: 10_000 })
    await user.type(within(panel).getByRole('textbox', { name: 'Message the assistant' }), 'Links?{Enter}')
    const internal = await within(panel).findByRole('link', { name: 'the record' })
    expect(internal).toHaveAttribute('href', '/app/person/1')
    expect(within(panel).queryByRole('link', { name: 'elsewhere' })).toBeNull()
    expect(within(panel).getByText('(https://evil.example.com/x?d=secret)')).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Copy link https://evil.example.com/x?d=secret' })).toBeInTheDocument()
    expect(within(panel).queryByRole('link', { name: 'js' })).toBeNull()
    expect(panel.querySelector('img')).toBeNull()
    expect(panel.querySelector('b')).toBeNull()
    expect(within(panel).getByText('[image: tracker not shown]')).toBeInTheDocument()
  })
})

describe('deep link', () => {
  it('opens a new conversation with the prompt pre-filled, not sent, and strips the parameters', async () => {
    mockAssistant()
    const turns = vi.fn()
    server.use(http.post(`${BASE}/conversations/4/turns`, () => {
      turns()
      return HttpResponse.json({ error: 'no' }, { status: 500 })
    }))
    window.history.replaceState(null, '', '/app/person/1?assistant=open&assistantPrompt=Tell%20me%20about%20this%20record.&tab=2')
    renderShell()
    const panel = await screen.findByRole('dialog', {}, { timeout: 10_000 })
    const composer = within(panel).getByRole('textbox', { name: 'Message the assistant' })
    await waitFor(() => expect(composer).toHaveValue('Tell me about this record.'))
    expect(router.replace).toHaveBeenCalledWith('/app/person/1?tab=2', { scroll: false })
    expect(within(panel).getByText('On: People #1')).toBeInTheDocument()
    expect(turns).not.toHaveBeenCalled()
  })

  it('is inert when the assistant is unavailable', async () => {
    mockAssistant(404)
    window.history.replaceState(null, '', '/app/person/1?assistant=open&assistantPrompt=Hi')
    renderShell()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(router.replace).not.toHaveBeenCalled()
  })
})


/** A discovered turn with a seven-second head start. */
function activeTurn() {
  return { turnId: 9, conversationId: 4, assistantMessageId: 11, userMessageId: 10, status: 'RUNNING', phase: 'thinking', startedAt: new Date(Date.now() - 7000).toISOString(), heartbeatAt: new Date().toISOString(), elapsedMs: 7000, live: true, concurrencyMode: 'supersede' }
}

/** Opens the panel and returns its composer. */
async function openComposer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /^Ask the assistant/ }))
  return screen.findByRole('textbox', { name: 'Message the assistant' })
}

describe('answer lifecycle and recovery', () => {
  it('keeps partial text and the error notice when a running answer fails', async () => {
    mockAssistant()
    const stream = controllableStream()
    server.use(http.post(`${BASE}/conversations/4/turns`, () => stream.response()))
    const user = userEvent.setup()
    renderShell()
    const composer = await openComposer(user)
    await user.type(composer, 'Explain this{Enter}')
    act(() => stream.write(sse(START, ['tool.start', { seq: 2, messageId: 11, toolCallId: 'search', name: 'query_records', summary: 'Search records' }], ['text.delta', { seq: 3, messageId: 11, text: 'Partial explanation' }])))
    expect(await screen.findByText('Partial explanation')).toBeInTheDocument()
    persisted.messages = storedTurn('Explain this', [{ type: 'tool', toolCallId: 'search', name: 'query_records', summary: 'Search records' }, { type: 'text', text: 'Partial explanation' }, { type: 'notice', level: 'error', text: 'The server restarted.' }], 'ERROR')
    act(() => {
      stream.write(sse(['error', { seq: 4, messageId: 11, message: 'The server restarted.' }], ['message.end', { seq: 5, messageId: 11, status: 'ERROR' }]))
      stream.close()
    })
    expect(await screen.findByText('The server restarted.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Stop the reply' })).not.toBeInTheDocument())
    expect(screen.getByText('Partial explanation')).toBeInTheDocument()
    expect(document.querySelector('[data-qqq-id="assistant-tool-step"]')).toHaveAttribute('data-outcome', 'INCOMPLETE')
    await user.type(composer, 'Next question')
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
  })

  it('shows a busy header on refresh while closed, then a background banner with Open and Stop', async () => {
    mockAssistant()
    const turn = activeTurn()
    const stream = controllableStream()
    const events = vi.fn(() => stream.response())
    let active = true
    persisted.messages = storedTurn('Find records', [], 'STREAMING')
    server.use(
      http.get(`${BASE}/turns/active`, () => HttpResponse.json({ turns: active ? [turn] : [] })),
      http.get(`${BASE}/conversations/4`, () => HttpResponse.json({ conversation: { ...CONVERSATION, title: 'People search' }, messages: persisted.messages })),
      http.get(`${BASE}/turns/9/events`, events),
      http.post(`${BASE}/turns/9/cancel`, () => {
        active = false
        persisted.messages = storedTurn('Find records', [], 'CANCELLED')
        stream.write(sse(['message.end', { seq: 2, messageId: 11, status: 'CANCELLED' }]))
        stream.close()
        return HttpResponse.json({ status: 'CANCELLING' })
      }),
    )
    const user = userEvent.setup()
    renderShell()
    expect(await screen.findByRole('status', { name: 'Assistant is answering' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await openComposer(user)
    const banner = document.querySelector('[data-qqq-id="assistant-background-run"]') as HTMLElement
    expect(banner).toHaveTextContent('Answering in People search - 0:0')
    expect(within(banner).getByRole('button', { name: 'Stop' })).toBeEnabled()
    await user.click(within(banner).getByRole('button', { name: 'Open' }))
    expect(await screen.findByText('Thinking...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop the reply' })).toBeEnabled()
    expect(screen.getByPlaceholderText('Ask something else...')).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Stop the reply' }))
    expect(await screen.findByText('Stopped.', { selector: MESSAGE_TEXT })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Assistant is answering' })).not.toBeInTheDocument())
    expect(events).toHaveBeenCalledTimes(1)
  })

  it('stops a background conversation without opening it', async () => {
    mockAssistant()
    const stream = controllableStream()
    const cancel = vi.fn(() => {
      persisted.messages = storedTurn('Find records', [], 'CANCELLED')
      stream.write(sse(['message.end', { seq: 2, messageId: 11, status: 'CANCELLED' }]))
      stream.close()
      return HttpResponse.json({ status: 'CANCELLING' })
    })
    server.use(
      http.get(`${BASE}/turns/active`, () => HttpResponse.json({ turns: [activeTurn()] })),
      http.get(`${BASE}/turns/9/events`, () => stream.response()),
      http.post(`${BASE}/turns/9/cancel`, cancel),
    )
    const user = userEvent.setup()
    renderShell()
    await openComposer(user)
    await user.click(await screen.findByRole('button', { name: 'Stop' }))
    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(document.querySelector('[data-qqq-id="assistant-background-run"]')).toBeNull())
  })

  it.each(['supersede', 'concurrent'] as const)('sends while running with %s and retains both replies', async (mode) => {
    mockAssistant()
    const first = controllableStream()
    const second = controllableStream()
    const bodies: Array<{ text: string; concurrency: string }> = []
    server.use(http.post(`${BASE}/conversations/4/turns`, async ({ request }) => {
      bodies.push(await request.json() as { text: string; concurrency: string })
      return bodies.length === 1 ? first.response() : second.response()
    }))
    const user = userEvent.setup()
    renderShell()
    const composer = await openComposer(user)
    await user.type(composer, 'First question{Enter}')
    act(() => first.write(sse(START, ['text.delta', { seq: 2, messageId: 11, text: 'First answer' }])))
    expect(await screen.findByText('First answer', { selector: MESSAGE_TEXT })).toBeInTheDocument()
    if (mode === 'concurrent') {
      await user.click(screen.getByRole('button', { name: 'Conversation actions' }))
      await user.click(await screen.findByRole('menuitemradio', { name: 'Answer both' }))
      expect(localStorage.getItem('qqq.assistant.concurrency')).toBe('concurrent')
    }
    expect(screen.getByText(mode === 'concurrent' ? 'Both answers will continue' : 'Sending stops the current answer')).toBeInTheDocument()
    expect(composer).toBeEnabled()
    await user.type(composer, 'Second question')
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Stop the reply' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(bodies).toHaveLength(2))
    expect(bodies[0].concurrency).toBe('supersede')
    expect(bodies[1].concurrency).toBe(mode)
    act(() => second.write(sse(
      ['message.start', { seq: 1, turnId: 12, conversationId: 4, userMessageId: 13, messageId: 14 }],
      ['text.delta', { seq: 2, messageId: 14, text: 'Second answer' }],
    )))
    expect(await screen.findByText('Second answer', { selector: MESSAGE_TEXT })).toBeInTheDocument()
    // The newer answer finishes first: it must not overwrite the older stream in the cache.
    act(() => {
      second.write(sse(['message.end', { seq: 3, messageId: 14, status: 'COMPLETE' }]))
      second.close()
    })
    await waitFor(() => expect(document.querySelector('[data-status="COMPLETE"][data-role="assistant"]')).not.toBeNull())
    expect(screen.getByRole('button', { name: 'Stop the reply' })).toBeInTheDocument()
    const notice = 'Stopped because you asked something else.'
    persisted.messages = [
      ...storedTurn('First question', [{ type: 'text', text: 'First answer' }, ...(mode === 'supersede' ? [{ type: 'notice', level: 'info', text: notice }] : [])], mode === 'supersede' ? 'CANCELLED' : 'COMPLETE'),
      { id: 13, role: 'USER', status: 'COMPLETE', turnId: 12, createDate: new Date().toISOString(), parts: [{ type: 'text', text: 'Second question' }] },
      { id: 14, role: 'ASSISTANT', status: 'COMPLETE', turnId: 12, createDate: new Date().toISOString(), parts: [{ type: 'text', text: 'Second answer' }] },
    ]
    act(() => {
      if (mode === 'supersede') first.write(sse(['notice', { seq: 3, level: 'info', text: notice }]))
      first.write(sse(['message.end', { seq: 4, messageId: 11, status: mode === 'supersede' ? 'CANCELLED' : 'COMPLETE' }]))
      first.close()
    })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Stop the reply' })).not.toBeInTheDocument())
    expect(screen.getByText('First answer', { selector: MESSAGE_TEXT })).toBeInTheDocument()
    expect(screen.getByText('Second answer', { selector: MESSAGE_TEXT })).toBeInTheDocument()
    if (mode === 'supersede') expect(screen.getByText(notice)).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Assistant is answering' })).not.toBeInTheDocument()
  })

  it('falls back to STREAMING messages on an old server and reconciles cancel 409', async () => {
    mockAssistant()
    const stream = controllableStream()
    persisted.messages = storedTurn('Find records', [{ type: 'text', text: 'Old partial' }], 'STREAMING')
    server.use(
      http.get(`${BASE}/conversations`, () => HttpResponse.json({ conversations: [{ ...CONVERSATION, title: 'Saved conversation' }] })),
      http.get(`${BASE}/turns/9/events`, () => stream.response()),
      http.post(`${BASE}/turns/9/cancel`, () => {
        persisted.messages = storedTurn('Find records', [{ type: 'text', text: 'Finished on another pod' }])
        return HttpResponse.json({ error: 'already finished' }, { status: 409 })
      }),
    )
    const user = userEvent.setup()
    renderShell()
    await openComposer(user)
    await user.click(screen.getByRole('button', { name: 'Conversation history' }))
    await user.click(await screen.findByRole('option', { name: /Saved conversation/ }))
    await user.click(await screen.findByRole('button', { name: 'Stop the reply' }))
    expect(await screen.findByText('Finished on another pod', { selector: MESSAGE_TEXT })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Stop the reply' })).not.toBeInTheDocument())
  })

  it('ends a stuck run, then Retry check discovers its finished answer', async () => {
    mockAssistant()
    const actualStart = assistantApi.streamAssistantTurn
    vi.spyOn(assistantApi, 'streamAssistantTurn').mockImplementation((id, body, options) => actualStart(id, body, { ...options, resumeDelayMs: 1, resumeBudgetMs: 100 }))
    server.use(
      http.post(`${BASE}/conversations/4/turns`, () => new HttpResponse(sse(START, ['ping', {}]), { headers: { 'Content-Type': 'text/event-stream' } })),
      http.get(`${BASE}/turns/9/events`, () => new HttpResponse(sse(['ping', {}]), { headers: { 'Content-Type': 'text/event-stream' } })),
    )
    const user = userEvent.setup()
    renderShell()
    const composer = await openComposer(user)
    await user.type(composer, 'Find records{Enter}')
    expect(await screen.findByText('Lost connection to the assistant. It may still be answering - reopen the panel to check.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Stop the reply' })).not.toBeInTheDocument()
    persisted.messages = storedTurn('Find records', [{ type: 'text', text: 'Recovered finished answer' }])
    await user.click(screen.getByRole('button', { name: 'Retry check' }))
    expect(await screen.findByText('Recovered finished answer')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry check' })).not.toBeInTheDocument())
  })

  it('rechecks on online and after being hidden longer than thirty seconds', async () => {
    mockAssistant()
    const active = vi.fn(() => HttpResponse.json({ turns: [] }))
    server.use(http.get(`${BASE}/turns/active`, active))
    renderShell()
    await waitFor(() => expect(active).toHaveBeenCalledTimes(1))
    act(() => window.dispatchEvent(new Event('online')))
    await waitFor(() => expect(active).toHaveBeenCalledTimes(2))
    const hidden = vi.spyOn(document, 'hidden', 'get')
    const now = vi.spyOn(Date, 'now')
    const time = Date.now()
    now.mockReturnValue(time)
    hidden.mockReturnValue(true)
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    now.mockReturnValue(time + 31000)
    hidden.mockReturnValue(false)
    act(() => window.dispatchEvent(new Event('focus')))
    await waitFor(() => expect(active).toHaveBeenCalledTimes(3))
    act(() => window.dispatchEvent(new Event('focus')))
    expect(active).toHaveBeenCalledTimes(3)
  })
})


describe('multiple run controls', () => {
  it('Stop cancels every known run in the conversation', async () => {
    mockAssistant()
    const streams = [controllableStream(), controllableStream()]
    let posts = 0
    const cancelled: string[] = []
    server.use(
      http.post(`${BASE}/conversations/4/turns`, () => streams[posts++].response()),
      http.post(`${BASE}/turns/:id/cancel`, ({ params }) => {
        cancelled.push(String(params.id))
        const index = params.id === '9' ? 0 : 1
        streams[index].write(sse(['message.end', { seq: 3, messageId: index === 0 ? 11 : 14, status: 'CANCELLED' }]))
        streams[index].close()
        return HttpResponse.json({ status: 'CANCELLING' })
      }),
    )
    const user = userEvent.setup()
    renderShell()
    const composer = await openComposer(user)
    await user.type(composer, 'First{Enter}')
    act(() => streams[0].write(sse(START)))
    await screen.findByText('Thinking...')
    await user.type(composer, 'Second{Enter}')
    act(() => streams[1].write(sse(['message.start', { seq: 1, turnId: 12, conversationId: 4, userMessageId: 13, messageId: 14 }])))
    await waitFor(() => expect(screen.getAllByText('Thinking...')).toHaveLength(2))
    await user.click(screen.getByRole('button', { name: 'Stop the reply' }))
    await waitFor(() => expect(cancelled.sort()).toEqual(['12', '9']))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Stop the reply' })).not.toBeInTheDocument())
  })

  it('renders persisted phase events and the server start time', async () => {
    mockAssistant()
    const stream = controllableStream()
    server.use(http.post(`${BASE}/conversations/4/turns`, () => stream.response()))
    const user = userEvent.setup()
    renderShell()
    const composer = await openComposer(user)
    await user.type(composer, 'Find records{Enter}')
    expect(await screen.findByText('Starting...')).toBeInTheDocument()
    const startedAt = new Date(Date.now() - 30000).toISOString()
    act(() => stream.write(sse(['message.start', { ...START[1], startedAt }], ['turn.phase', { seq: 2, phase: 'thinking' }])))
    expect(await screen.findByText('Thinking...')).toBeInTheDocument()
    expect(document.querySelector('[data-qqq-id="assistant-run-status"]')).toHaveTextContent(/0:3[0-9]/)
    act(() => stream.write(sse(['turn.phase', { seq: 3, phase: 'tool', toolName: 'query_records', label: 'Search records' }])))
    expect(await screen.findByText('Using Search records...')).toBeInTheDocument()
    act(() => stream.write(sse(['turn.phase', { seq: 4, phase: 'writing' }])))
    expect(await screen.findByText('Writing...')).toBeInTheDocument()
    act(() => {
      stream.write(sse(['message.end', { seq: 5, messageId: 11, status: 'COMPLETE' }]))
      stream.close()
    })
    await waitFor(() => expect(screen.queryByText('Writing...')).not.toBeInTheDocument())
  })
})

describe('panel header chrome and starter prompts', () => {
  const LONG = 'Which of my open orders have been waiting on a customer reply for more than two weeks, and what was the last thing we said to them?'

  it('labels the history, new and close buttons with an icon, aria-label and keyboard-focus tooltip', async () => {
    mockAssistant()
    const user = userEvent.setup()
    renderShell()
    await openComposer(user)
    const panel = await screen.findByRole('dialog', {}, { timeout: 10_000 })
    const history = within(panel).getByRole('button', { name: 'Conversation history' })
    expect(history).toHaveAttribute('aria-expanded', 'false')
    expect(history.querySelector('svg')).toHaveClass('lucide-history')
    expect(within(panel).getByRole('button', { name: 'New conversation' })).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Close assistant' })).toBeInTheDocument()

    // keyboard focus alone (no hover) opens the tooltip
    act(() => history.focus())
    expect(await screen.findByRole('tooltip', {}, { timeout: 3000 })).toHaveTextContent('Conversation history')
    await user.click(history)
    expect(within(panel).getByRole('button', { name: 'Hide conversation history' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('wraps long starter prompts inside the chip and stacks them, with no truncation', async () => {
    mockAssistant({ enabled: true, profile: { starterPrompts: [LONG, 'Short one', LONG + ' Again?'] } })
    const user = userEvent.setup()
    renderShell()
    await openComposer(user)
    const list = await screen.findByRole('list', { name: 'Suggested questions' })
    const chips = within(list).getAllByRole('button')
    expect(chips).toHaveLength(3)
    for (const chip of chips) {
      expect(chip).toHaveClass('whitespace-normal', 'break-words', 'w-full')
      expect(chip.className).not.toMatch(/truncate|whitespace-nowrap|overflow-hidden/)
      expect(chip.parentElement).toHaveClass('w-full', 'min-w-0', '@md:w-auto')
    }
    expect(chips[0]).toHaveTextContent(LONG)
  })

  it.each([[0], [1], [2], [3]])('renders %i starter prompts without an empty list', async (count) => {
    mockAssistant({ enabled: true, profile: { starterPrompts: Array.from({ length: count }, (_, index) => `Question ${index + 1}`) } })
    const user = userEvent.setup()
    renderShell()
    await openComposer(user)
    await screen.findByText('Ask about your data')
    const list = screen.queryByRole('list', { name: 'Suggested questions' })
    if (count === 0) expect(list).not.toBeInTheDocument()
    else expect(within(list as HTMLElement).getAllByRole('button')).toHaveLength(count)
  })

  it('has no axe violations: empty state, rail open, and with a conversation', async () => {
    mockAssistant({ enabled: true, profile: { starterPrompts: [LONG, 'Short one'] } })
    server.use(http.get(`${BASE}/conversations`, () => HttpResponse.json({ conversations: [{ ...CONVERSATION, title: 'Saved conversation' }] })))
    const user = userEvent.setup()
    renderShell()
    await openComposer(user)
    const panel = await screen.findByRole('dialog', {}, { timeout: 10_000 })
    expect(await axe(panel)).toHaveNoViolations()

    await user.click(within(panel).getByRole('button', { name: 'Conversation history' }))
    await screen.findByRole('option', { name: /Saved conversation/ })
    expect(await axe(panel)).toHaveNoViolations()

    persisted.messages = storedTurn('Find records', [{ type: 'text', text: 'Here they are.' }])
    await user.click(screen.getByRole('option', { name: /Saved conversation/ }))
    expect(await screen.findByText('Here they are.', { selector: MESSAGE_TEXT })).toBeInTheDocument()
    expect(await axe(panel)).toHaveNoViolations()
  })
})
