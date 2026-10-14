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
import { AssistantProvider, useAssistantController } from './AssistantProvider'
import { AssistantHeaderButton } from './AssistantHeaderButton'
import { AssistantMount } from './AssistantMount'

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

const BASE = '/qqq/v1/assistant'
const META = { tables: { person: { name: 'person', label: 'People' } }, supplementalInstanceMetaData: { assistant: {} } } as unknown as QInstance
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
    expect(await screen.findByRole('button', { name: 'Assistant, 3 unread (Ctrl+J or ⌘J)' })).toBeInTheDocument()
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
    await user.click(await screen.findByRole('button', { name: /^Assistant/ }))
    const composer = await screen.findByRole('textbox', { name: 'Message the assistant' })
    await user.type(composer, 'Count images{Enter}')
    const action = await screen.findByRole('button', { name: 'Show PNG' })
    await waitFor(() => expect(action).toBeEnabled())
    await user.click(action)
    await waitFor(() => expect(requests[1]).toEqual({ text: 'Show me PNG files', pageContext: { route: '/app/person', tableName: 'person' } }))
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
    await user.click(await screen.findByRole('button', { name: /^Assistant/ }))
    const panel = await screen.findByRole('dialog', {}, { timeout: 10_000 })
    const composer = within(panel).getByRole('textbox', { name: 'Message the assistant' })
    expect(within(panel).getByText('On: People')).toBeInTheDocument()
    await user.type(composer, 'Who is active?{Enter}')

    await waitFor(() => expect(turnBody).toEqual({ text: 'Who is active?', pageContext: { route: '/app/person', tableName: 'person' } }))
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
    await user.click(await screen.findByRole('button', { name: /^Assistant/ }))
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
    await user.click(await screen.findByRole('button', { name: /^Assistant/ }))
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
    await user.click(await screen.findByRole('button', { name: /^Assistant/ }))
    const panel = await screen.findByRole('dialog', {}, { timeout: 10_000 })
    await user.type(within(panel).getByRole('textbox', { name: 'Message the assistant' }), 'Count people{Enter}')
    act(() => stream.write(sse(START, ['text.delta', { seq: 2, messageId: 11, text: 'Counting' }])))
    await within(panel).findByText('Counting')
    await user.click(within(panel).getByRole('button', { name: 'Stop the reply' }))
    await waitFor(() => expect(cancelled).toBe(true))
    expect(await within(panel).findByText('Stopped.')).toBeInTheDocument()
  })

  it('shows a refused turn as an error in the reply', async () => {
    mockAssistant()
    server.use(http.post(`${BASE}/conversations/4/turns`, () => HttpResponse.json({ error: 'Daily budget reached' }, { status: 429 })))
    const user = userEvent.setup()
    renderShell()
    await user.click(await screen.findByRole('button', { name: /^Assistant/ }))
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
    await user.click(await screen.findByRole('button', { name: /^Assistant/ }))
    const panel = await screen.findByRole('dialog', {}, { timeout: 10_000 })
    await user.click(within(panel).getByRole('button', { name: "Don't send page context (People)" }))
    await user.type(within(panel).getByRole('textbox', { name: 'Message the assistant' }), 'Hi{Enter}')
    await waitFor(() => expect(turnBody).toEqual({ text: 'Hi' }))
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
    await user.click(await screen.findByRole('button', { name: /^Assistant/ }))
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
