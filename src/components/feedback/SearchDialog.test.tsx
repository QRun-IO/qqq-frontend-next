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

import React, { useState } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { SearchDialog } from './SearchDialog'

/** Uses real dialog state and search components; no searchable backend tables are needed for focus. */
function Harness() {
  const [open, setOpen] = useState(false)
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return (
    <QueryClientProvider client={client}>
      <button onClick={() => setOpen(true)}>Open search</button>
      <SearchDialog open={open} onClose={() => setOpen(false)} navTargets={[]} />
      <button>Outside action</button>
    </QueryClientProvider>
  )
}

describe('SearchDialog keyboard access', () => {
  beforeEach(() => localStorage.clear())

  it('keeps both Tab directions in an empty dialog', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open search' }))
    const input = screen.getByRole('combobox')
    await waitFor(() => expect(input).toHaveFocus())
    await user.tab()
    expect(input).toHaveFocus()
    await user.tab({ shift: true })
    expect(input).toHaveFocus()
  })

  it('wraps between the first and last controls when the query adds buttons', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open search' }))
    const input = screen.getByRole('combobox')
    await user.type(input, 'no matches')
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Show all matches' })).toHaveFocus()
    await user.tab()
    expect(input).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Clear search' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Show all matches' })).toHaveFocus()
  })

  it('dismisses with Escape from a button and returns focus to the opener', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open search' })
    await user.click(trigger)
    await user.type(screen.getByRole('combobox'), 'no matches')
    await user.tab()
    expect(screen.getByRole('button', { name: 'Clear search' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Search' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('returns to the input when clearing removes the focused button', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open search' }))
    const input = screen.getByRole('combobox')
    await user.type(input, 'no matches')
    await user.tab()
    await user.keyboard('{Enter}')
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
    await user.tab()
    expect(input).toHaveFocus()
    await user.tab({ shift: true })
    expect(input).toHaveFocus()
  })

  it('cancels delayed autofocus if the dialog unmounts before its frame', async () => {
    const request = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(42)
    const cancel = vi.spyOn(window, 'cancelAnimationFrame')
    try {
      const user = userEvent.setup()
      const { unmount } = render(<Harness />)
      await user.click(screen.getByRole('button', { name: 'Open search' }))
      expect(request).toHaveBeenCalledOnce()
      unmount()
      expect(cancel).toHaveBeenCalledWith(42)
    } finally {
      request.mockRestore()
      cancel.mockRestore()
    }
  })

  it('does not steal focus after the user reaches another dialog control before autofocus', async () => {
    let autofocus: FrameRequestCallback | undefined
    const request = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      autofocus = callback
      return 42
    })
    try {
      const user = userEvent.setup()
      render(<Harness />)
      await user.click(screen.getByRole('button', { name: 'Open search' }))
      await user.type(screen.getByRole('combobox'), 'no matches')
      await user.tab()
      const clear = screen.getByRole('button', { name: 'Clear search' })
      expect(clear).toHaveFocus()
      act(() => autofocus?.(0))
      expect(clear).toHaveFocus()
    } finally {
      request.mockRestore()
    }
  })

  it('returns focus after Escape from the input and can reopen', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open search' })
    await user.click(trigger)
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus())
    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus())
  })
})
