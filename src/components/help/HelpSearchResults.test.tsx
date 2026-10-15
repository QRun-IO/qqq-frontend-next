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

/** @file Command palette help search, debounce, gating and result activation. */
import React from 'react'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, it, vi } from 'vitest'

import { searchHelp } from '@/lib/api/help'

import { HelpSearchResults } from './HelpSearchResults'

import { CommandMenu } from '@/components/feedback/CommandMenu'

const state = vi.hoisted(() => ({ searchEnabled: true, openHelp: vi.fn() }))
vi.mock('./HelpPanelProvider', () => ({ useHelpPanel: () => state }))
vi.mock('@/lib/api/help', () => ({ searchHelp: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/app',
}))

beforeEach(() => {
  state.searchEnabled = true
  state.openHelp.mockReset()
  vi.mocked(searchHelp).mockReset()
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})

/** Renders a palette using an isolated query cache. @returns The close callback. */
function palette() {
  const onClose = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <CommandMenu open onClose={onClose} navTargets={[]} />
    </QueryClientProvider>
  )
  return onClose
}

it('offers Search help and waits for a debounced two-character query', async () => {
  vi.mocked(searchHelp).mockResolvedValue([
    {
      kind: 'table',
      key: 'table:owned;slot:help',
      name: 'owned',
      label: 'Owned topic',
      summary: 'Short summary.',
      text: 'Long help.',
      contentAsHtml: '<p>Long help.</p>',
      href: '/app/owned',
    },
  ])
  const onClose = palette()
  fireEvent.click(screen.getByText('Search help…'))
  const input = screen.getByRole('combobox')
  expect(input).toHaveAttribute('placeholder', 'Search help…')
  fireEvent.change(input, { target: { value: 'o' } })
  expect(searchHelp).not.toHaveBeenCalled()
  fireEvent.change(input, { target: { value: 'ow' } })
  expect(searchHelp).not.toHaveBeenCalled()
  fireEvent.change(input, { target: { value: 'owned' } })
  await waitFor(() => expect(searchHelp).toHaveBeenCalledTimes(1))
  expect(searchHelp).toHaveBeenCalledWith('owned', 10, expect.any(AbortSignal))
  fireEvent.click(await screen.findByText('Short summary.'))
  expect(onClose).toHaveBeenCalled()
  expect(state.openHelp).toHaveBeenCalledWith(
    expect.objectContaining({
      key: 'table:owned;slot:help',
      label: 'Owned topic',
      href: '/app/owned',
      helpContent: expect.objectContaining({ contentAsHtml: '<p>Long help.</p>' }),
    })
  )
})

it('never searches or offers help commands without the feature', () => {
  state.searchEnabled = false
  palette()
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'owned' } })
  expect(screen.queryByText('Search help…')).not.toBeInTheDocument()
  expect(searchHelp).not.toHaveBeenCalled()
})

it('reports help-search failures without claiming there are no matches', async () => {
  vi.mocked(searchHelp).mockRejectedValue(new Error('Unavailable'))
  palette()
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'owned' } })
  expect(await screen.findByText('Help search is unavailable.')).toBeInTheDocument()
  expect(screen.queryByText('No help found.')).not.toBeInTheDocument()
})


it('matches palette heading and item styles and truncates the summary', async () => {
  vi.mocked(searchHelp).mockResolvedValue([
    { kind: 'table', key: 'owned', name: 'owned', label: 'Owned topic', summary: 'Short summary.', text: 'Long help.' },
  ])
  palette()
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'owned' } })
  const label = await screen.findByText('Owned topic')
  const helpItem = label.closest('[cmdk-item]')
  const searchItem = document.querySelector('[data-qqq-id="command-group-search"] [cmdk-item]')
  expect(helpItem?.className).toBe(searchItem?.className)
  const helpHeading = document.querySelector('[data-qqq-id="command-group-help"] [cmdk-group-heading] span')
  const searchHeading = document.querySelector('[data-qqq-id="command-group-search"] [cmdk-group-heading] span')
  expect(helpHeading?.className).toBe(searchHeading?.className)
  expect(screen.getByText('Short summary.')).toHaveClass('truncate', 'text-muted-foreground')
})

it('filters the current key and missing summaries before limiting related help to five', async () => {
  const result = { kind: 'table', key: 'current', name: 'topic', label: 'Current topic', summary: 'Summary', text: 'Long help.' }
  vi.mocked(searchHelp).mockResolvedValue([
    result,
    { ...result, key: 'missing', label: 'Missing summary', summary: undefined },
    { ...result, key: 'blank', label: 'Blank summary', summary: '   ' },
    ...Array.from({ length: 7 }, (_, index) => ({ ...result, key: `related-${index}`, label: `Related ${index}` })),
  ])
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}>
    <HelpSearchResults search="topic" heading="Related help" excludeKey="current" requireSummary limit={5} />
  </QueryClientProvider>)
  await screen.findByRole('button', { name: 'Related 0 Summary' })
  expect(screen.getAllByRole('button')).toHaveLength(5)
  expect(screen.queryByText('Current topic')).not.toBeInTheDocument()
  expect(screen.queryByText('Missing summary')).not.toBeInTheDocument()
  expect(screen.queryByText('Blank summary')).not.toBeInTheDocument()
  expect(screen.queryByText('Related 5')).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('Related 0'))
  expect(state.openHelp).toHaveBeenCalledWith(expect.objectContaining({ key: 'related-0' }))
})
