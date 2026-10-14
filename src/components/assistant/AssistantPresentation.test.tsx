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

// Presentation contract, navigation safety and action behavior.
import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'jest-axe'

import type { AssistantPresentationPart } from '@/types/assistant'
import { AssistantPresentation } from './AssistantPresentation'
import { AssistantMessageView } from './AssistantMessageView'
import { optimisticTurnMessages, reduceStreamEvent } from './message-reducer'
import { toAssistantEvent } from '@/lib/api/assistant'

const router = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))
// Keep real Recharts, supplying the size that jsdom cannot measure.
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>()
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactElement }) => React.cloneElement(children as React.ReactElement<{ width: number; height: number }>, { width: 340, height: 200 }) }
})

const table = {
  kind: 'table' as const, title: 'Media by type',
  columns: [{ key: 'type', label: 'Type' }, { key: 'count', label: 'Count' }, { key: 'share', label: 'Share', align: 'right' as const }],
  rows: [{ cells: { type: 'JPEG', count: 81, share: 0.802 }, display: { share: '80.2%' }, href: '/app/media?filter=jpeg' }],
}
const part: AssistantPresentationPart = {
  type: 'presentation', summary: '101 images.', markdown: '**Fallback answer**',
  blocks: [
    { kind: 'metrics', items: [{ label: 'Images', value: 101, display: '101 files', href: '/app/media' }] },
    table,
    { kind: 'filterLinks', items: [{ label: 'Open JPEG', tableName: 'media', href: '/app/media?filter=jpeg' }] },
    { kind: 'recordLinks', items: [{ label: 'Sunset.jpg', tableName: 'media', recordId: '12', href: '/app/media/12' }] },
    { kind: 'actions', items: [{ label: 'Show PNG', prompt: 'Show me PNG files' }, { label: 'Open media', href: '/app/media' }] },
    { kind: 'future', payload: 'Ignore this' },
  ],
}

describe('AssistantPresentation', () => {
  it('renders summary, metrics, table display values, links and prompt actions accessibly', async () => {
    const send = vi.fn()
    const { container } = render(<AssistantPresentation part={part} onSend={send} />)
    expect(screen.getByText('101 images.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '101 files' })).toHaveAttribute('href', '/app/media')
    expect(screen.getByRole('table', { name: 'Media by type' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '81' })).toHaveStyle({ textAlign: 'right' })
    expect(screen.getByRole('cell', { name: '80.2%' })).toHaveStyle({ textAlign: 'right' })
    expect(screen.getByRole('link', { name: 'JPEG' })).toHaveAttribute('href', '/app/media?filter=jpeg')
    expect(screen.getByRole('link', { name: 'Open JPEG' })).toHaveAttribute('href', '/app/media?filter=jpeg')
    expect(screen.getByRole('link', { name: 'Sunset.jpg' })).toHaveAttribute('href', '/app/media/12')
    expect(screen.getByRole('link', { name: 'Open media' })).toHaveAttribute('href', '/app/media')
    fireEvent.click(screen.getByRole('button', { name: 'Show PNG' }))
    expect(send).toHaveBeenCalledWith('Show me PNG files')
    expect(screen.queryByText('Ignore this')).not.toBeInTheDocument()
    expect(screen.queryByText('Fallback answer')).not.toBeInTheDocument()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect((await axe(container)).violations).toEqual([])
  })

  it.each(['https://evil.test/app/media', 'javascript:alert(1)', '//evil.test/app/media'])('rejects unsafe hrefs everywhere: %s', async (href) => {
    const unsafe: AssistantPresentationPart = { ...part, blocks: [
      { kind: 'metrics', items: [{ label: 'Total', value: 1, href }] },
      { ...table, rows: [{ ...table.rows[0], href }] },
      { kind: 'filterLinks', items: [{ label: 'Filtered', tableName: 'media', href }] },
      { kind: 'recordLinks', items: [{ label: 'Record', tableName: 'media', recordId: 1, href }] },
      { kind: 'actions', items: [{ label: 'Action', href }] },
      { kind: 'chart', chartType: 'pie', points: [{ label: 'Point', value: 1, href }] },
    ] }
    render(<AssistantPresentation part={unsafe} />)
    await screen.findByRole('img', { name: /Point: 1/ }, { timeout: 10_000 })
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.getByText('Action')).toBeInTheDocument()
    router.push.mockClear()
    fireEvent.click(document.querySelector('.recharts-pie-sector')!)
    expect(router.push).not.toHaveBeenCalled()
  })

  it.each(['bar', 'pie', 'line'] as const)('renders a real %s chart with accessible data and clickable points', async (chartType) => {
    const { container } = render(<AssistantPresentation part={{ ...part, blocks: [{ kind: 'chart', chartType, title: 'Media share', points: [{ label: 'JPEG', value: 81, display: '81 files', href: '/app/media' }, { label: 'PNG', value: 20 }] }] }} />)
    const chart = await screen.findByRole('img', { name: 'Media share: JPEG: 81 files; PNG: 20' }, { timeout: 10_000 })
    expect(chart.querySelector('svg')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Media share data' })).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'JPEG: 81 files' })).toHaveAttribute('href', '/app/media')
    const selector = chartType === 'bar' ? '.recharts-bar-rectangle' : chartType === 'pie' ? '.recharts-pie-sector' : '.recharts-line-dots circle'
    router.push.mockClear()
    fireEvent.click(container.querySelector(selector)!)
    expect(router.push).toHaveBeenCalledWith('/app/media')
  })

  it('falls back to markdown when every block is unknown or empty', () => {
    render(<AssistantPresentation part={{ ...part, blocks: [{ kind: 'future' }, { kind: 'metrics', items: [] }] }} />)
    expect(screen.getByText('Fallback answer').tagName).toBe('STRONG')
  })

  it('gives wide tables an accessible scroll region and disables busy actions', () => {
    render(<AssistantPresentation part={{ ...part, blocks: [{ ...table, columns: [...table.columns, { key: 'extra', label: 'Extra' }] }, part.blocks[4]] }} onSend={vi.fn()} sending />)
    expect(screen.getByRole('region', { name: 'Media by type' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('button', { name: 'Show PNG' })).toBeDisabled()
  })

  it('decodes and appends streamed presentations between text parts, preserving reload order', () => {
    const ids = { userId: -1, assistantId: -2 }
    let messages = optimisticTurnMessages('Media', ids, '')
    messages = reduceStreamEvent(messages, { type: 'text.delta', seq: 1, messageId: -2, text: 'Before' }, ids)
    const event = toAssistantEvent({ event: 'presentation', id: '2', data: JSON.stringify({ messageId: -2, part }) }).event!
    expect(event.type).toBe('presentation')
    messages = reduceStreamEvent(messages, event, ids)
    messages = reduceStreamEvent(messages, { type: 'text.delta', seq: 3, messageId: -2, text: 'After' }, ids)
    expect(messages[1].parts).toEqual([{ type: 'text', text: 'Before' }, part, { type: 'text', text: 'After' }])
    const send = vi.fn()
    const { container } = render(<AssistantMessageView message={{ ...messages[1], status: 'COMPLETE' }} onSend={send} />)
    expect(container.textContent).toMatch(/Before.*101 images\..*After/)
    fireEvent.click(screen.getByRole('button', { name: 'Show PNG' }))
    expect(send).toHaveBeenCalledWith('Show me PNG files')
  })
})
