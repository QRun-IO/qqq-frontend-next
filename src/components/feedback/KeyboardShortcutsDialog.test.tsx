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
// Keyboard help on phones and tablets (QRun-IO/qqq#708): the dialog keeps a margin at the screen
// edges, and closing it returns focus to the header help button even where a tap does not focus it.

import React, { useRef, useState } from 'react'
import { render as renderWithoutProviders, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it } from 'vitest'

import { SINGLE_KEY_SHORTCUTS_STORAGE_KEY, setSingleKeyShortcutsEnabled, singleKeyShortcutsEnabled } from '@/lib/keyboard/single-key-shortcuts'
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog'

/**
 * Renders inside a query client (the sheet's switch saves through it).
 * @param ui - Element under test.
 * @returns Testing Library render result.
 */
function render(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderWithoutProviders(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

afterEach(() => {
  setSingleKeyShortcutsEnabled(true)
  window.localStorage.removeItem(SINGLE_KEY_SHORTCUTS_STORAGE_KEY)
})

describe('KeyboardShortcutsDialog content', () => {
  it('lists delete as Shift+D and search as Ctrl/⌘+K or /', () => {
    render(<KeyboardShortcutsDialog open onClose={() => undefined} />)
    const del = screen.getByText('Delete the current Record (asks to confirm)').parentElement!
    expect(del).toHaveTextContent('Shift+D')
    expect(screen.getByText('Search or jump to (Ctrl+K on Windows and Linux)')).toBeInTheDocument()
    expect(screen.queryByText('Command Palette')).toBeNull()
  })

  it('turns single-key shortcuts off and on with its switch (WCAG 2.1.4), kept in this browser without a server section', async () => {
    const user = userEvent.setup()
    render(<KeyboardShortcutsDialog open onClose={() => undefined} />)
    const toggle = screen.getByRole('switch', { name: /Single-key shortcuts/ })
    expect(toggle).toBeChecked()
    await user.click(toggle)
    expect(singleKeyShortcutsEnabled()).toBe(false)
    expect(window.localStorage.getItem(SINGLE_KEY_SHORTCUTS_STORAGE_KEY)).toBe('off')
    expect(screen.getByRole('switch', { name: /Single-key shortcuts/ })).not.toBeChecked()
    await user.click(screen.getByRole('switch', { name: /Single-key shortcuts/ }))
    expect(singleKeyShortcutsEnabled()).toBe(true)
    expect(window.localStorage.getItem(SINGLE_KEY_SHORTCUTS_STORAGE_KEY)).toBeNull()
  })
})

/** A help button wired to the dialog the way the dashboard layout wires the header button. */
function HelpButtonWithDialog() {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={button} type="button" onClick={() => setOpen(true)}>Keyboard shortcuts (?)</button>
      <KeyboardShortcutsDialog open={open} onClose={() => setOpen(false)} returnFocusRef={button} />
    </>
  )
}

describe('KeyboardShortcutsDialog on phones and tablets', () => {
  it('keeps a margin at the screen edges instead of spanning a phone', () => {
    render(<KeyboardShortcutsDialog open onClose={() => undefined} />)
    const dialog = screen.getByRole('dialog', { name: 'Keyboard Shortcuts' })
    expect(dialog).toHaveClass('w-[calc(100%-2rem)]', 'max-w-md')
    expect(dialog).not.toHaveClass('w-full')
  })

  it('returns focus to the help button when it closes, even if the tap did not focus the button', async () => {
    const user = userEvent.setup()
    render(<HelpButtonWithDialog />)
    const button = screen.getByRole('button', { name: 'Keyboard shortcuts (?)' })
    // Safari (and iPad) does not focus a tapped or clicked button
    button.click()
    expect(await screen.findByRole('dialog', { name: 'Keyboard Shortcuts' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(button).toHaveFocus())
  })

  it('returns focus to where it was when opened from the keyboard', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = useState(false)
      const button = useRef<HTMLButtonElement>(null)
      return (
        <>
          <button ref={button} type="button">Keyboard shortcuts (?)</button>
          <button type="button" onClick={() => setOpen(true)}>Elsewhere</button>
          <KeyboardShortcutsDialog open={open} onClose={() => setOpen(false)} returnFocusRef={button} />
        </>
      )
    }
    render(<Harness />)
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' })
    await user.click(elsewhere)
    expect(await screen.findByRole('dialog', { name: 'Keyboard Shortcuts' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(elsewhere).toHaveFocus())
  })
})
