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

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { axe } from 'jest-axe'

import type { AssistantPendingActionRender } from '@/types/assistant'
import { server } from '@/mocks/node'
import AssistantPendingActionCard from './AssistantPendingActionCard'

const RENDER: AssistantPendingActionRender = {
  type: 'pending_action',
  actionId: 7,
  toolName: 'create_record',
  tableName: 'blog_post',
  tableLabel: 'Blog Post',
  summary: 'Create a Blog Post: Title = Hello',
  changes: [{ field: 'title', label: 'Title', value: 'Hello' }],
}

/**
 * Serves the action endpoints with the given state transitions.
 *
 * @param confirmStatus - The status the confirm endpoint answers.
 * @returns The calls made, by kind.
 */
function serve(confirmStatus: 'EXECUTED' | 'FAILED' = 'EXECUTED') {
  const calls: string[] = []
  server.use(
    http.get('*/assistant/actions/7', () => {
      calls.push('get')
      return HttpResponse.json({ id: 7, status: 'PENDING', toolName: 'create_record', tableName: 'blog_post', summary: RENDER.summary })
    }),
    http.post('*/assistant/actions/7/confirm', () => {
      calls.push('confirm')
      return HttpResponse.json({ id: 7, status: confirmStatus, toolName: 'create_record', tableName: 'blog_post', summary: RENDER.summary, resultSummary: 'Created Blog Post 9', outcome: 'OK', href: '/app/blog_post/9' })
    }),
    http.post('*/assistant/actions/7/reject', () => {
      calls.push('reject')
      return HttpResponse.json({ id: 7, status: 'REJECTED', toolName: 'create_record', tableName: 'blog_post', summary: RENDER.summary, resultSummary: 'Cancelled by the user; nothing changed.' })
    })
  )
  return calls
}

describe('AssistantPendingActionCard', () => {
  it('shows the proposed change and runs it only when confirmed', async () => {
    const calls = serve()
    const { container } = render(<AssistantPendingActionCard render={RENDER} />)
    expect(screen.getByText('Create a Blog Post: Title = Hello')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
    await waitFor(() => expect(calls).toContain('get'))
    expect(calls).not.toContain('confirm')

    await userEvent.click(screen.getByRole('button', { name: /create/i }))
    await waitFor(() => expect(screen.getByText(/Done · Created Blog Post 9/)).toBeInTheDocument())
    expect(calls.filter((c) => c === 'confirm')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /create/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open blog post/i })).toHaveAttribute('href', '/app/blog_post/9')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('cancels without running anything', async () => {
    const calls = serve()
    render(<AssistantPendingActionCard render={RENDER} />)
    await waitFor(() => expect(calls).toContain('get'))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => expect(screen.getByText(/Cancelled, nothing changed/)).toBeInTheDocument())
    expect(calls).not.toContain('confirm')
  })
})
