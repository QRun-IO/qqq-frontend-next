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

// Tests for CommandMenu: typed entries from navigation targets

import React from 'react'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }))

import { CommandMenu } from './CommandMenu'
import type { NavTarget } from '@/lib/hooks/use-routes'

const app = { label: 'People App', path: '/app/peopleApp' }
const targets: NavTarget[] = [
  { key: 'peopleApp', label: 'People App', path: '/app/peopleApp', nodeType: 'APP', icon: { name: 'person' }, ancestors: [] },
  { key: 'pet', label: 'Pet', path: '/app/pet', nodeType: 'TABLE', icon: { name: 'pets' }, ancestors: [app] },
  { key: 'clonePeople', label: 'Clone People', path: '/app/clonePeople', nodeType: 'PROCESS', ancestors: [app] },
]

describe('CommandMenu', () => {
  beforeAll(() => {
    // cmdk scrolls the selected item into view and observes list size
    Element.prototype.scrollIntoView = vi.fn()
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  })

  it('renders nothing when closed', () => {
    const { container } = render(<CommandMenu open={false} onClose={vi.fn()} navTargets={targets} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists each target with its type, app context and declared icon (regression: every entry was typed as an app)', () => {
    render(<CommandMenu open onClose={vi.fn()} navTargets={targets} />)
    const pet = document.querySelector('[data-qqq-id="command-item-pet"]')!
    expect(pet).toHaveTextContent('Pet')
    expect(pet).toHaveTextContent('Table · People App')
    expect(pet).toHaveAttribute('data-node-type', 'TABLE')
    expect(pet.querySelector('svg')).toHaveAttribute('data-qqq-icon', 'pets')
    expect(document.querySelector('[data-qqq-id="command-item-clonePeople"]')).toHaveTextContent('Process · People App')
    expect(document.querySelector('[data-qqq-id="command-item-clonePeople"] svg')).toHaveClass('lucide-workflow')
    expect(document.querySelector('[data-qqq-id="command-item-peopleApp"]')).toHaveTextContent(/App$/)
  })

  it('filters and navigates to the chosen target, then closes', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<CommandMenu open onClose={onClose} navTargets={targets} />)
    await user.type(screen.getByRole('combobox'), 'clone')
    await user.keyboard('{Enter}')
    expect(pushMock).toHaveBeenCalledWith('/app/clonePeople')
    expect(onClose).toHaveBeenCalled()
  })
})
