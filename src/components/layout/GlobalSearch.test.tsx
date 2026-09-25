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

// Tests for GlobalSearch: local "jump to" search over navigation targets and recent records

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}))

import { GlobalSearch } from './GlobalSearch'
import type { NavTarget } from '@/lib/hooks/use-routes'
import { addRecentRecord, clearRecentRecords } from '@/lib/utils/recent-records'

const peopleApp = { label: 'People App', path: '/app/peopleApp' }
const greetingsApp = { label: 'Greetings App', path: '/app/greetingsApp' }
const navTargets: NavTarget[] = [
  { key: 'peopleApp', label: 'People App', path: '/app/peopleApp', nodeType: 'APP', icon: { name: 'person' }, ancestors: [] },
  { key: 'greetingsApp', label: 'Greetings App', path: '/app/greetingsApp', nodeType: 'APP', ancestors: [peopleApp] },
  { key: 'person', label: 'Person', path: '/app/person', nodeType: 'TABLE', icon: { name: 'person' }, ancestors: [peopleApp, greetingsApp] },
  { key: 'pet', label: 'Pet', path: '/app/pet', nodeType: 'TABLE', icon: { name: 'pets' }, ancestors: [peopleApp, greetingsApp] },
  { key: 'greetInteractive', label: 'Greet Interactive', path: '/app/greetInteractive', nodeType: 'PROCESS', ancestors: [peopleApp, greetingsApp] },
]

function renderSearch() {
  return render(<GlobalSearch navTargets={navTargets} />)
}

const input = () => screen.getByRole('combobox', { name: 'Search pages and recent records' })

describe('GlobalSearch', () => {
  const fetchSpy = vi.fn()

  beforeEach(() => {
    pushMock.mockReset()
    clearRecentRecords()
    fetchSpy.mockReset()
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders an empty combobox with no dropdown', () => {
    renderSearch()
    expect(input()).toHaveValue('')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('matches navigation targets by label and shows their app context', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(input(), 'pe')
    const options = within(screen.getByRole('group', { name: 'Pages' })).getAllByRole('option')
    expect(options.map((option) => option.querySelector('span span')?.textContent)).toEqual(['People App', 'Person', 'Pet', 'Greetings App', 'Greet Interactive'])
    expect(options[1]).toHaveTextContent('People App / Greetings App')
    expect(options[1].querySelector('svg')).toHaveAttribute('data-qqq-icon', 'person')
  })

  it('matches targets through their enclosing app label', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(input(), 'greetings')
    const labels = screen.getAllByRole('option').map((option) => option.querySelector('span span')?.textContent)
    expect(labels).toEqual(['Greetings App', 'Person', 'Pet', 'Greet Interactive'])
  })

  it('navigates to the clicked target and clears the input', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(input(), 'Greet Inter')
    await user.click(screen.getByRole('option', { name: /^Greet/ }))
    expect(pushMock).toHaveBeenCalledWith('/app/greetInteractive')
    expect(input()).toHaveValue('')
  })

  it('supports arrow keys and Enter', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(input(), 'pet')
    await user.keyboard('{ArrowDown}')
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Enter}')
    expect(pushMock).toHaveBeenCalledWith('/app/pet')
  })

  it('opens the search page on Enter with nothing selected', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(input(), 'zzz{Enter}')
    expect(pushMock).toHaveBeenCalledWith('/app/search?q=zzz')
  })

  it('keeps the keyboard selection when results appear under a resting pointer', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(input(), 'pe')
    // Results rendering under the pointer fire mouseenter without pointer movement
    fireEvent.mouseEnter(screen.getAllByRole('option')[0])
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'false')
    fireEvent.mouseMove(screen.getAllByRole('option')[1])
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')
  })

  it('shows an empty message when nothing matches', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(input(), 'zzz')
    expect(screen.getByRole('listbox')).toHaveTextContent('No pages or recent records match “zzz”')
  })

  it('lists recently viewed records before typing and filters them by label', async () => {
    addRecentRecord({ tableName: 'person', tableLabel: 'Person', recordId: '1', recordLabel: 'Avery Sample', path: '/app/person/1' })
    const user = userEvent.setup()
    renderSearch()
    await user.click(input())
    expect(within(screen.getByRole('group', { name: 'Recently viewed' })).getByRole('option', { name: /Avery Sample/ })).toBeInTheDocument()
    await user.type(input(), 'avery')
    await user.click(screen.getByRole('option', { name: /Avery Sample/ }))
    expect(pushMock).toHaveBeenCalledWith('/app/person/1')
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(input(), 'pe')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('never calls the backend (QQQ has no global search endpoint)', async () => {
    const user = userEvent.setup()
    renderSearch()
    await user.type(input(), 'person{Enter}')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
