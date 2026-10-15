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

// The header account menu (moved from the sidebar footer; IA review 2026-10-15) and the Help menu

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render as renderWithoutProviders, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import { server } from '@/mocks/node'
import { preferencesFixture } from '@/mocks/fixtures/preferences'
import { ThemeProvider } from '@/lib/theme/theme-provider'
import { md5Hex } from '@/lib/utils/gravatar'
import { setSingleKeyShortcutsEnabled } from '@/lib/keyboard/single-key-shortcuts'
import { AccountMenu } from './AccountMenu'
import { HelpMenu } from './HelpMenu'

/**
 * Renders with the providers the header has.
 * @param ui - Element under test.
 * @returns Testing Library render result.
 */
function render(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderWithoutProviders(<QueryClientProvider client={client}>{ui}</QueryClientProvider>, { wrapper: ThemeProvider })
}

describe('AccountMenu', () => {
  it('opens from the avatar with the user, Preferences, dark mode and Sign out, and returns focus on Escape', async () => {
    const user = userEvent.setup()
    const logout = vi.fn()
    render(<AccountMenu userName="Alice" userEmail="alice@example.com" logout={logout} />)
    const trigger = screen.getByRole('button', { name: 'Account: Alice' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    await user.click(trigger)
    const menu = screen.getByRole('menu', { name: 'Account: Alice' })
    expect(menu).toHaveTextContent('alice@example.com')
    expect(screen.getByRole('menuitem', { name: 'Preferences' })).toHaveAttribute('href', '/app/preferences')
    // focus starts on the first item; arrows move between items
    expect(screen.getByRole('menuitem', { name: 'Preferences' })).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveFocus()
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveAttribute('data-qqq-id', 'sidenav-logout-button')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(trigger).toHaveFocus()
    await user.click(trigger)
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('switches dark mode without leaving the page', async () => {
    const user = userEvent.setup()
    render(<AccountMenu userName="Alice" />)
    await user.click(screen.getByRole('button', { name: 'Account: Alice' }))
    const toggle = screen.getByRole('menuitemcheckbox', { name: 'Dark mode' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    await user.click(toggle)
    expect(document.documentElement).toHaveClass('dark')
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Dark mode' }))
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('names a user without a name "Anonymous" and shows the initial without a Gravatar setting', async () => {
    render(<AccountMenu userEmail="ann@example.com" />)
    expect(screen.getByRole('button', { name: 'Account: Anonymous' })).toBeInTheDocument()
    expect(document.querySelector('[data-qqq-id="header-user-avatar"]')?.tagName).toBe('SPAN')
    expect(document.querySelector('[data-qqq-id="header-user-avatar"]')).toHaveTextContent('A')
  })

  it('shows the Gravatar when the branding declares gravatarDefault, and the initial if it fails', () => {
    render(<AccountMenu userName="Avery" userEmail="avery@example.com" gravatarDefault="identicon" />)
    const avatar = document.querySelector('img[data-qqq-id="header-user-avatar"]')!
    expect(avatar).toHaveAttribute('src', `https://www.gravatar.com/avatar/${md5Hex('avery@example.com')}?d=identicon`)
    fireEvent.error(avatar)
    expect(document.querySelector('[data-qqq-id="header-user-avatar"]')).toHaveTextContent('A')
  })

  it('lists only the preference sections that opt into the menu', async () => {
    server.use(http.get('/qqq/v1/preferences', () => HttpResponse.json(preferencesFixture)))
    render(<AccountMenu userName="Alice" />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Account: Alice' }))
    const item = await screen.findByRole('menuitem', { name: 'Access tokens' })
    expect(item).toHaveAttribute('href', '/app/preferences?section=access-tokens')
    expect(screen.queryByRole('menuitem', { name: 'Regional settings' })).not.toBeInTheDocument()
  })
})

describe('HelpMenu', () => {
  it('opens help, not shortcuts: Keyboard shortcuts is one of its items (WCAG 3.2.6)', async () => {
    const user = userEvent.setup()
    const onShortcuts = vi.fn()
    render(<HelpMenu onSearchHelp={vi.fn()} onShortcuts={onShortcuts} />)
    await user.click(screen.getByRole('button', { name: 'Help' }))
    const shortcuts = screen.getByRole('menuitem', { name: /Keyboard shortcuts/ })
    expect(shortcuts).toHaveTextContent('?')
    await user.click(shortcuts)
    expect(onShortcuts).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('drops the ? hint while single-key shortcuts are off', async () => {
    setSingleKeyShortcutsEnabled(false)
    try {
      render(<HelpMenu onSearchHelp={vi.fn()} onShortcuts={vi.fn()} />)
      await userEvent.setup().click(screen.getByRole('button', { name: 'Help' }))
      expect(screen.getByRole('menuitem', { name: /Keyboard shortcuts/ })).not.toHaveTextContent('?')
    } finally {
      setSingleKeyShortcutsEnabled(true)
    }
  })
})
