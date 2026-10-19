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

// Tests for the conversation list: row actions (archive, restore, delete with confirmation and
// rollback), the manage link, running and unread indicators, and marking read when a reply ends

import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { toast } from 'sonner'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'jest-axe'

import type { QInstance } from '@/types'
import type { AssistantConversation } from '@/types/assistant'
import { server } from '@/mocks/node'
import { uiApiVersionHandler } from '@/mocks/ui-api-version'
import { AssistantProvider, useAssistantController } from './AssistantProvider'
import { AssistantHeaderButton } from './AssistantHeaderButton'
import { AssistantMount } from './AssistantMount'
import { ConversationRail } from './ConversationRail'

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

const BASE = '/qqq/v1/assistant'
const META = {
  tables: { person: { name: 'person', label: 'People' }, assistantConversation: { name: 'assistantConversation', label: 'Conversations' } },
  supplementalInstanceMetaData: { assistant: {} },
} as unknown as QInstance

/**
 * Builds a conversation.
 *
 * @param id - The id.
 * @param title - The title.
 * @param extra - Other fields.
 * @returns The conversation.
 */
function conversation(id: number, title: string, extra: Partial<AssistantConversation> = {}): AssistantConversation {
  return { id, title, status: 'ACTIVE', pinned: false, lastMessageAt: null, unreadCount: 0, createDate: '2026-10-12T00:00:00Z', ...extra }
}

/** The accessible name of the unread row (the spacing around the screen-reader text varies by engine). */
const UNREAD_ROW = /^Open invoices\s*,\s*unread$/

const LIST = [
  conversation(1, 'Sales report', { running: true }),
  conversation(2, 'Open invoices', { unreadCount: 2 }),
  conversation(3, 'Weekly summary', { pinned: true }),
  conversation(4, 'Quiet one'),
]

/**
 * Props of the rail, with spies.
 *
 * @param overrides - Props to change.
 * @returns The props.
 */
function railProps(overrides: Partial<React.ComponentProps<typeof ConversationRail>> = {}): React.ComponentProps<typeof ConversationRail> {
  return {
    conversations: LIST, loading: false, activeId: null, status: 'ACTIVE',
    onStatusChange: vi.fn(), onSelect: vi.fn(), onArchive: vi.fn(), onDelete: vi.fn(),
    ...overrides,
  }
}

describe('ConversationRail', () => {
  it('has Archive and Delete on every row, and Restore in the archived list', async () => {
    const props = railProps()
    const user = userEvent.setup()
    const { rerender } = render(<ConversationRail {...props} />)
    for (const item of LIST) {
      expect(screen.getByRole('button', { name: `Archive ${item.title}` })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: `Delete ${item.title}` })).toBeInTheDocument()
    }
    await user.click(screen.getByRole('button', { name: 'Archive Quiet one' }))
    expect(props.onArchive).toHaveBeenCalledWith(LIST[3])
    await user.click(screen.getByRole('button', { name: 'Delete Open invoices' }))
    expect(props.onDelete).toHaveBeenCalledWith(LIST[1])

    const archived = LIST.map((item) => ({ ...item, status: 'ARCHIVED' as const }))
    rerender(<ConversationRail {...props} conversations={archived} status="ARCHIVED" />)
    expect(screen.getByRole('button', { name: 'Restore Quiet one' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Archive / })).toBeNull()
  })

  it('moves between rows with the arrow keys and reaches a row\'s actions with Right', async () => {
    const user = userEvent.setup()
    render(<ConversationRail {...railProps()} />)
    // pinned first, then recent in order
    const names: Array<string | RegExp> = ['Weekly summary', 'Working: Sales report', UNREAD_ROW, 'Quiet one']
    const mains = names.map((name) => screen.getByRole('button', { name }))
    mains[0].focus()
    await user.keyboard('{ArrowDown}')
    expect(mains[1]).toHaveFocus()
    await user.keyboard('{End}')
    expect(mains[3]).toHaveFocus()
    await user.keyboard('{Home}')
    expect(mains[0]).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: 'Archive Weekly summary' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: 'Delete Weekly summary' })).toHaveFocus()
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(mains[0]).toHaveFocus()
    // one tab stop per list: only the current row's buttons are tabbable
    expect(mains[1]).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('button', { name: 'Delete Quiet one' })).toHaveAttribute('tabindex', '-1')
  })

  it('marks running conversations with a spinner and unread ones with a dot and a bold title', () => {
    const { container } = render(<ConversationRail {...railProps()} />)
    const running = screen.getByRole('button', { name: 'Working: Sales report' })
    expect(running.querySelector('[data-qqq-id="assistant-conversation-running"]')).not.toBeNull()
    expect(running.querySelector('.motion-safe\\:animate-spin')).not.toBeNull()
    const unread = screen.getByRole('button', { name: UNREAD_ROW })
    expect(unread.querySelector('[data-qqq-id="assistant-conversation-unread"]')).not.toBeNull()
    expect(unread.querySelector('.font-semibold')).toHaveTextContent('Open invoices')
    expect(container.querySelectorAll('[data-qqq-id="assistant-conversation-running"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-qqq-id="assistant-conversation-unread"]')).toHaveLength(1)
  })

  it('shows both indicators on a conversation that is running and unread', () => {
    render(<ConversationRail {...railProps({ conversations: [conversation(7, 'Busy', { running: true, unreadCount: 1 })] })} />)
    const row = screen.getByRole('button', { name: /^Working: Busy/ })
    expect(row.querySelector('[data-qqq-id="assistant-conversation-running"]')).not.toBeNull()
    expect(row.querySelector('[data-qqq-id="assistant-conversation-unread"]')).not.toBeNull()
  })

  it('shows the manage link only with a path', () => {
    const { rerender } = render(<ConversationRail {...railProps({ manageHref: '/app/assistantConversation' })} />)
    expect(screen.getByRole('link', { name: 'Manage all conversations' })).toHaveAttribute('href', '/app/assistantConversation')
    rerender(<ConversationRail {...railProps({ manageHref: null })} />)
    expect(screen.queryByRole('link', { name: 'Manage all conversations' })).toBeNull()
  })

  it.each(['ACTIVE', 'ARCHIVED'] as const)('passes axe with running and unread rows (%s)', async (status) => {
    const conversations = LIST.map((item) => ({ ...item, status }))
    const { container } = render(<ConversationRail {...railProps({ conversations, status, activeId: 4, manageHref: '/app/assistantConversation' })} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

// ─── Inside the panel ────────────────────────────────────────────────────────

/** Records the traffic of one test. */
const traffic: { patches: Array<{ id: string; body: unknown }>; deletes: string[] } = { patches: [], deletes: [] }

/**
 * Harness: the dashboard's assistant wiring.
 *
 * @param props - Component properties.
 * @param props.metaData - Instance metadata.
 * @returns The shell.
 */
function Shell({ metaData }: { metaData: QInstance }) {
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
 * Renders the shell.
 *
 * @param metaData - Instance metadata.
 * @returns The render result.
 */
function renderShell(metaData: QInstance = META) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><Shell metaData={metaData} /></QueryClientProvider>)
}

/**
 * Registers the assistant routes with a mutable conversation list.
 *
 * @param options - `config` extra probe fields; `list` the conversations; `archived` the archived ones.
 * @param options.config - Extra probe fields.
 * @param options.list - The active conversations.
 * @param options.archived - The archived conversations.
 */
function mockAssistant(options: { config?: Record<string, unknown>; list?: AssistantConversation[]; archived?: AssistantConversation[] } = {}) {
  let list = options.list ?? LIST
  let archived = options.archived ?? []
  traffic.patches = []
  traffic.deletes = []
  server.use(
    uiApiVersionHandler('assistant'),
    http.get(`${BASE}/turns/active`, () => HttpResponse.json({ error: 'Not found' }, { status: 404 })),
    http.get(`${BASE}/config`, () => HttpResponse.json({ enabled: true, ...options.config })),
    http.get(`${BASE}/conversations`, ({ request }) =>
      HttpResponse.json({ conversations: new URL(request.url).searchParams.get('status') === 'ARCHIVED' ? archived : list })),
    http.patch(`${BASE}/conversations/:id`, async ({ params, request }) => {
      const body = await request.json() as { status?: 'ACTIVE' | 'ARCHIVED'; read?: boolean }
      traffic.patches.push({ id: String(params.id), body })
      const id = Number(params.id)
      if (body.read) list = list.map((item) => (item.id === id ? { ...item, unreadCount: 0 } : item))
      if (body.status === 'ARCHIVED') { archived = [...archived, ...list.filter((item) => item.id === id).map((item) => ({ ...item, status: 'ARCHIVED' as const }))]; list = list.filter((item) => item.id !== id) }
      if (body.status === 'ACTIVE') { list = [...list, ...archived.filter((item) => item.id === id).map((item) => ({ ...item, status: 'ACTIVE' as const }))]; archived = archived.filter((item) => item.id !== id) }
      return HttpResponse.json(conversation(id, 'x'))
    }),
    http.delete(`${BASE}/conversations/:id`, ({ params }) => {
      traffic.deletes.push(String(params.id))
      list = list.filter((item) => item.id !== Number(params.id))
      return new HttpResponse(null, { status: 204 })
    }),
  )
}

/**
 * Opens the panel and its conversation list.
 *
 * @param user - The user.
 */
async function openRail(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /^Ask the assistant/ }))
  await user.click(await screen.findByRole('button', { name: 'Conversation history' }))
  await screen.findByRole('button', { name: UNREAD_ROW })
}

beforeAll(async () => {
  await import('./AssistantPanel')
}, 30_000)

beforeEach(() => {
  router.push.mockReset()
  window.history.replaceState(null, '', '/app/person')
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

describe('conversation list in the panel', () => {
  it('archives a row at once and asks the server', async () => {
    mockAssistant()
    const user = userEvent.setup()
    renderShell()
    await openRail(user)
    await user.click(screen.getByRole('button', { name: 'Archive Quiet one' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Quiet one' })).toBeNull())
    expect(traffic.patches).toContainEqual({ id: '4', body: { status: 'ARCHIVED' } })
    await user.click(screen.getByRole('button', { name: 'Archived' }))
    expect(await screen.findByRole('button', { name: 'Restore Quiet one' })).toBeInTheDocument()
  })

  it('confirms a delete naming the conversation; Cancel keeps it, Delete removes it', async () => {
    mockAssistant()
    const user = userEvent.setup()
    renderShell()
    await openRail(user)
    await user.click(screen.getByRole('button', { name: 'Delete Quiet one' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/Quiet one and its messages are deleted/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(traffic.deletes).toEqual([])
    expect(screen.getByRole('button', { name: 'Quiet one' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete Quiet one' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(traffic.deletes).toEqual(['4']))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Quiet one' })).toBeNull())
  })

  it('puts the row back and shows a toast when the server refuses', async () => {
    mockAssistant()
    server.use(http.patch(`${BASE}/conversations/:id`, () => HttpResponse.json({ error: 'nope' }, { status: 500 })))
    const error = vi.spyOn(toast, 'error')
    const user = userEvent.setup()
    renderShell()
    await openRail(user)
    await user.click(screen.getByRole('button', { name: 'Archive Quiet one' }))
    await waitFor(() => expect(error).toHaveBeenCalled())
    expect(error.mock.calls[0][0]).toContain('Quiet one')
    expect(await screen.findByRole('button', { name: 'Quiet one' })).toBeInTheDocument()
  })

  it('rolls a failed delete back too', async () => {
    mockAssistant()
    server.use(http.delete(`${BASE}/conversations/:id`, () => HttpResponse.json({ error: 'nope' }, { status: 500 })))
    const error = vi.spyOn(toast, 'error')
    const user = userEvent.setup()
    renderShell()
    await openRail(user)
    await user.click(screen.getByRole('button', { name: 'Delete Quiet one' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(error).toHaveBeenCalled())
    expect(await screen.findByRole('button', { name: 'Quiet one' })).toBeInTheDocument()
  })

  it('links to the conversations table only when the server names one that is in the metadata', async () => {
    mockAssistant({ config: { conversationsTable: 'assistantConversation' } })
    const user = userEvent.setup()
    const first = renderShell()
    await openRail(user)
    expect(await screen.findByRole('link', { name: 'Manage all conversations' })).toHaveAttribute('href', '/app/assistantConversation')
    first.unmount()

    mockAssistant({ config: { conversationsTable: 'notInMetadata' } })
    const second = renderShell()
    await openRail(user)
    expect(screen.queryByRole('link', { name: 'Manage all conversations' })).toBeNull()
    second.unmount()

    mockAssistant()
    renderShell()
    await openRail(user)
    expect(screen.queryByRole('link', { name: 'Manage all conversations' })).toBeNull()
  })

  it('works with an old server that reports neither running nor a table', async () => {
    mockAssistant({ list: [{ ...conversation(2, 'Open invoices'), unreadCount: 1 }] })
    const user = userEvent.setup()
    renderShell()
    await openRail(user)
    expect(document.querySelector('[data-qqq-id="assistant-conversation-running"]')).toBeNull()
  })

  it('dots the History toggle while another conversation is working or unread, with an accessible label', async () => {
    mockAssistant()
    const user = userEvent.setup()
    renderShell()
    await user.click(await screen.findByRole('button', { name: /^Ask the assistant/ }))
    const toggle = await screen.findByRole('button', { name: 'Conversation history' })
    await waitFor(() => expect(toggle.querySelector('[data-qqq-id="assistant-rail-toggle-dot"]')).not.toBeNull())
    expect(toggle).toHaveAccessibleDescription('Other conversations are working or have unread replies')
  })

  it('does not dot the History toggle when nothing else is working or unread', async () => {
    mockAssistant({ list: [conversation(4, 'Quiet one')] })
    const user = userEvent.setup()
    renderShell()
    await user.click(await screen.findByRole('button', { name: /^Ask the assistant/ }))
    const toggle = await screen.findByRole('button', { name: 'Conversation history' })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(toggle.querySelector('[data-qqq-id="assistant-rail-toggle-dot"]')).toBeNull()
  })

  it('passes axe with the rail open (Recent and Archived)', async () => {
    mockAssistant({ config: { conversationsTable: 'assistantConversation' }, archived: [conversation(9, 'Old thread', { status: 'ARCHIVED', unreadCount: 1 })] })
    const user = userEvent.setup()
    renderShell()
    await openRail(user)
    const panel = screen.getByRole('dialog')
    expect(await axe(panel)).toHaveNoViolations()
    await user.click(screen.getByRole('button', { name: 'Archived' }))
    await screen.findByRole('button', { name: 'Restore Old thread' })
    expect(await axe(panel)).toHaveNoViolations()
  })
})

describe('unread correctness', () => {
  /**
   * A reply that streams to its end in the open conversation, the server counting it unread.
   */
  it('marks the open conversation read when its reply finishes, so it never counts as unread', async () => {
    const open = conversation(4, 'Quiet one')
    mockAssistant({ list: [open] })
    let unread = 0
    server.use(
      http.get(`${BASE}/conversations`, () => HttpResponse.json({ conversations: [{ ...open, unreadCount: unread }] })),
      http.get(`${BASE}/conversations/4`, () => HttpResponse.json({ conversation: open, messages: [] })),
      http.post(`${BASE}/conversations/4/turns`, () => {
        unread = 1 // the server counts the reply as unread until it is marked read
        const frames = [
          ['message.start', { seq: 1, turnId: 9, conversationId: 4, userMessageId: 10, messageId: 11 }],
          ['text.delta', { seq: 2, messageId: 11, text: 'Done.' }],
          ['message.end', { seq: 3, messageId: 11, status: 'COMPLETE' }],
        ] as Array<[string, Record<string, unknown>]>
        return new HttpResponse(frames.map(([type, data]) => `id: ${data.seq}\nevent: ${type}\ndata: ${JSON.stringify(data)}\n\n`).join(''), { headers: { 'Content-Type': 'text/event-stream' } })
      }),
      http.patch(`${BASE}/conversations/4`, async ({ request }) => {
        traffic.patches.push({ id: '4', body: await request.json() })
        unread = 0
        return HttpResponse.json(open)
      }),
    )
    const user = userEvent.setup()
    renderShell()
    await user.click(await screen.findByRole('button', { name: /^Ask the assistant/ }))
    await user.click(await screen.findByRole('button', { name: 'Conversation history' }))
    await user.click(await screen.findByRole('button', { name: 'Quiet one' }))
    const composer = await screen.findByRole('textbox', { name: 'Message the assistant' })
    await user.type(composer, 'Hello{Enter}')
    await waitFor(() => expect(traffic.patches).toContainEqual({ id: '4', body: { read: true } }))
    // the header badge never shows the reply the user was watching
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(document.querySelector('[data-qqq-id="assistant-unread-badge"]')).toBeNull()
  })

  it('opening a conversation with unread replies marks it read on the server', async () => {
    mockAssistant({ list: [conversation(2, 'Open invoices', { unreadCount: 2 })] })
    server.use(http.get(`${BASE}/conversations/2`, () => HttpResponse.json({ conversation: conversation(2, 'Open invoices'), messages: [] })))
    const user = userEvent.setup()
    renderShell()
    await user.click(await screen.findByRole('button', { name: /^Ask the assistant, 2 unread/ }))
    await user.click(await screen.findByRole('button', { name: 'Conversation history' }))
    await user.click(await screen.findByRole('button', { name: UNREAD_ROW }))
    await waitFor(() => expect(traffic.patches).toContainEqual({ id: '2', body: { read: true } }))
  })
})
