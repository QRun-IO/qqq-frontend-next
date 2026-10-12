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

/**
 * AssistantMessageView stories — the assistant panel's message rendering: user text, a reply
 * with a tool step, records table, record chips and markdown, a streaming reply, and notices.
 */
import React from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { AssistantMessage } from '@/types/assistant'
import { AssistantMessageView } from './AssistantMessageView'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })

const meta = {
  title: 'Assistant/AssistantMessageView',
  component: AssistantMessageView,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="@container w-[400px] space-y-4 bg-card p-3">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof AssistantMessageView>

export default meta
type Story = StoryObj<typeof meta>

const BASE = { turnId: 9, createDate: '2026-10-12T00:00:00Z' }

/** The user's question. */
export const UserMessage: Story = {
  args: { message: { ...BASE, id: 10, role: 'USER', status: 'COMPLETE', parts: [{ type: 'text', text: 'Who is active?' }] } as AssistantMessage },
}

/** A finished reply with a query step, its records, chips, markdown and a navigation. */
export const Reply: Story = {
  args: {
    message: {
      ...BASE,
      id: 11,
      role: 'ASSISTANT',
      status: 'COMPLETE',
      parts: [
        {
          type: 'tool', toolCallId: 't1', name: 'query_records', summary: 'Queried People · 2 rows', outcome: 'OK',
          render: {
            type: 'records', tableName: 'person', tableLabel: 'People', truncated: false, totalCount: 2, openHref: '/app/person',
            columns: [{ name: 'firstName', label: 'First Name' }, { name: 'lastName', label: 'Last Name' }, { name: 'status', label: 'Status' }],
            rows: [
              { id: 1, href: '/app/person/1', values: { firstName: 'Alice', lastName: 'Johnson', status: 'Active' } },
              { id: 2, href: '/app/person/2', values: { firstName: 'Bob', lastName: 'Martinez', status: 'Active' } },
            ],
          },
        },
        { type: 'record_refs', refs: [{ tableName: 'person', tableLabel: 'People', id: 1, label: 'Alice Johnson', href: '/app/person/1' }] },
        { type: 'text', text: 'Two people are **active**. See [Alice](/app/person/1); [external](https://example.com) links stay plain text.' },
        { type: 'navigate', href: '/app/person/1' },
      ],
    } as AssistantMessage,
  },
}

/** A reply still streaming, with a running tool step. */
export const Streaming: Story = {
  args: {
    message: {
      ...BASE,
      id: 12,
      role: 'ASSISTANT',
      status: 'STREAMING',
      parts: [{ type: 'tool', toolCallId: 't2', name: 'count_records', summary: 'Counting People' }],
    } as AssistantMessage,
  },
}

/** A denied tool call and an error notice. */
export const DeniedAndError: Story = {
  args: {
    message: {
      ...BASE,
      id: 13,
      role: 'ASSISTANT',
      status: 'ERROR',
      parts: [
        { type: 'tool', toolCallId: 't3', name: 'get_record_history', summary: 'Record history is not available to you', outcome: 'DENIED' },
        { type: 'notice', level: 'error', text: 'The daily assistant budget was reached.' },
      ],
    } as AssistantMessage,
  },
}
