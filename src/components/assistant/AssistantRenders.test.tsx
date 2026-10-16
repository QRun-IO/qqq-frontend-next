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

// Tool result renders tolerate payloads with missing lists, and one bad part
// cannot take down the reply around it.
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { AssistantMessage, AssistantRender } from '@/types/assistant'
import { AssistantRenderView } from './AssistantRenders'
import { AssistantMessageView } from './AssistantMessageView'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

// The exact payload kof22 stored for a query that matched nothing (2026-10-16):
// the server omitted the empty rows and columns lists.
const emptyRecords = {
  type: 'records',
  tableName: 'db_perf_finding',
  tableLabel: 'Findings',
  openHref: '/app/db_perf_finding?filter=eyJib29sZWFuT3BlcmF0b3IiOiJBTkQifQ%3D%3D',
  totalCount: 0,
  truncated: false,
} as unknown as AssistantRender

describe('AssistantRenderView', () => {
  it('renders a records payload without rows or columns as "no rows match"', () => {
    render(<AssistantRenderView render={emptyRecords} />)
    expect(screen.getByText('Findings: no rows match')).toBeInTheDocument()
    expect(screen.getByText('Open in Query screen')).toBeInTheDocument()
  })

  it('renders history and record payloads without their lists', () => {
    render(<AssistantRenderView render={{ type: 'history', tableName: 't', tableLabel: 'T', id: 1 } as unknown as AssistantRender} />)
    expect(screen.getByText('No changes recorded.')).toBeInTheDocument()
    const { container } = render(<AssistantRenderView render={{ type: 'record', tableName: 't', tableLabel: 'T', id: 7, href: '/app/t/7' } as unknown as AssistantRender} />)
    expect(container.querySelector('[data-qqq-id="assistant-record"]')).not.toBeNull()
  })
})

describe('AssistantMessageView', () => {
  it('shows the reply when a tool part carries the empty records payload', () => {
    const message: AssistantMessage = {
      id: 84, role: 'ASSISTANT', status: 'COMPLETE', turnId: 5, createDate: '2026-10-16T00:24:26Z',
      parts: [
        { type: 'tool', toolCallId: 'toolu_x', name: 'query_records', summary: 'Queried Findings', outcome: 'OK', render: emptyRecords },
        { type: 'text', text: 'Here are the main issues.' },
      ],
    } as unknown as AssistantMessage
    render(<AssistantMessageView message={message} onSend={vi.fn()} sending={false} />)
    expect(screen.getByText('Here are the main issues.')).toBeInTheDocument()
    expect(screen.getByText('Findings: no rows match')).toBeInTheDocument()
  })

  it('keeps the rest of the reply when one part throws while rendering', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken = { type: 'count', tableName: 't', tableLabel: 'T', openHref: '/app/t' } as unknown as AssistantRender // no count: toLocaleString throws
    const message: AssistantMessage = {
      id: 85, role: 'ASSISTANT', status: 'COMPLETE', turnId: 6, createDate: '2026-10-16T00:30:00Z',
      parts: [
        { type: 'tool', toolCallId: 'toolu_y', name: 'count_records', summary: 'Counted', outcome: 'OK', render: broken },
        { type: 'text', text: 'Still readable.' },
      ],
    } as unknown as AssistantMessage
    render(<AssistantMessageView message={message} onSend={vi.fn()} sending={false} />)
    expect(screen.getByText('Still readable.')).toBeInTheDocument()
    expect(screen.getByText('This part of the answer could not be shown.')).toBeInTheDocument()
    consoleError.mockRestore()
  })
})
