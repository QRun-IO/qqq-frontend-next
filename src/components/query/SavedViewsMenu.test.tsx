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

// Tests for the backend saved views menu (#649)

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import type { SavedViewsResult } from '@/lib/hooks/use-saved-views'
import type { SavedView } from '@/lib/utils/saved-view-utils'
import { SavedViewsMenu } from './SavedViewsMenu'

const view = (id: number, label: string, userId: string): SavedView => ({ id, label, userId, tableName: 'person', view: { queryFilter: {} } })
const mine = view(1, 'My View', 'sample:alice')
const theirs = view(2, 'Their View', 'sample:bob')

function makeViews(overrides: Partial<SavedViewsResult> = {}): SavedViewsResult {
  return {
    isAvailable: true, canStore: true, canDelete: true, yourViews: [mine], sharedViews: [theirs], quickViews: [], isLoading: false, error: null,
    storeView: vi.fn(), deleteView: vi.fn(), isOwner: (v) => v.userId === 'sample:alice', ...overrides,
  }
}

const noop = () => undefined

describe('SavedViewsMenu', () => {
  it('keeps the menu open when touch compatibility focus returns to its trigger', async () => {
    render(<SavedViewsMenu savedViews={makeViews()} currentView={null} viewDiffs={[]} onSelectView={noop} onNewView={noop} onStore={vi.fn()} onDelete={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: 'Saved views' })
    await userEvent.click(trigger)
    expect(screen.getByRole('menu', { name: 'Saved views' })).toBeInTheDocument()
    act(() => trigger.focus())
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens from the keyboard and selects a saved view with arrow keys', async () => {
    const onSelectView = vi.fn()
    render(<SavedViewsMenu savedViews={makeViews()} currentView={null} viewDiffs={[]} onSelectView={onSelectView} onNewView={noop} onStore={vi.fn()} onDelete={vi.fn()} />)
    screen.getByRole('button', { name: 'Saved views' }).focus()
    await userEvent.keyboard('{ArrowDown}')
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Save As...' })).toHaveFocus())
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(onSelectView).toHaveBeenCalledWith(mine)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
  it('renders nothing when the backend has no saved view processes', () => {
    const { container } = render(<SavedViewsMenu savedViews={makeViews({ isAvailable: false })} currentView={null} viewDiffs={[]}
      onSelectView={noop} onNewView={noop} onStore={vi.fn()} onDelete={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('closes on Escape and returns focus to its button (#708)', async () => {
    render(<SavedViewsMenu savedViews={makeViews()} currentView={null} viewDiffs={[]} onSelectView={noop} onNewView={noop} onStore={vi.fn()} onDelete={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Saved views' }))
    expect(screen.getByRole('menu', { name: 'Saved views' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu', { name: 'Saved views' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Saved views' })).toHaveFocus()
  })

  it('lists your views apart from views shared with you and opens one', async () => {
    const onSelect = vi.fn()
    render(<SavedViewsMenu savedViews={makeViews()} currentView={null} viewDiffs={[]} onSelectView={onSelect} onNewView={noop} onStore={vi.fn()} onDelete={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Saved views' }))
    expect(screen.getByRole('group', { name: 'Your Saved Views' })).toHaveTextContent('My View')
    expect(screen.getByRole('group', { name: 'Views Shared with you' })).toHaveTextContent('Their View')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Their View' }))
    expect(onSelect).toHaveBeenCalledWith(theirs)
  })

  it('saves a new view by name and shows backend errors in the dialog', async () => {
    const onStore = vi.fn().mockRejectedValueOnce(new Error('You already have a saved view on this table with this name.')).mockResolvedValueOnce(undefined)
    render(<SavedViewsMenu savedViews={makeViews()} currentView={null} viewDiffs={['Changed the filter']} onSelectView={noop} onNewView={noop} onStore={onStore} onDelete={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save View As...' }))
    await userEvent.type(screen.getByLabelText('Enter a name for this view'), 'My View')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('You already have a saved view on this table with this name.')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onStore).toHaveBeenLastCalledWith({ label: 'My View' })
  })

  it('disables owner-only actions on a view shared with you', async () => {
    render(<SavedViewsMenu savedViews={makeViews()} currentView={theirs} viewDiffs={['Changed the filter']} onSelectView={noop} onNewView={noop} onStore={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Save...' })).not.toBeInTheDocument()
    expect(screen.getByText('1 Unsaved Change')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Saved views (current view: Their View)' }))
    expect(screen.getByRole('menuitem', { name: 'Save...' })).toBeDisabled()
    expect(screen.getByRole('menuitem', { name: 'Rename...' })).toBeDisabled()
    expect(screen.getByRole('menuitem', { name: 'Delete...' })).toBeDisabled()
    expect(screen.getByRole('menuitem', { name: 'Save As...' })).toBeEnabled()
  })

  it('confirms before deleting the current view', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    render(<SavedViewsMenu savedViews={makeViews()} currentView={mine} viewDiffs={[]} onSelectView={noop} onNewView={noop} onStore={vi.fn()} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: 'Saved views (current view: My View)' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete...' }))
    expect(screen.getByText("Are you sure you want to delete the view 'My View'?")).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(mine))
  })

  it('offers a report seeded from the current view when report creation is available', async () => {
    const href = '/app/savedReport/create#defaultValues=%7B%22tableName%22%3A%22person%22%7D'
    render(<SavedViewsMenu savedViews={makeViews()} currentView={null} viewDiffs={[]} onSelectView={noop} onNewView={noop}
      onStore={vi.fn()} onDelete={vi.fn()} reportHref={href} />)
    await userEvent.click(screen.getByRole('button', { name: 'Saved views' }))
    expect(screen.getByRole('menuitem', { name: 'Create Report from Current View' })).toHaveAttribute('href', href)
  })

  it('wraps the views button in Material\'s layout-neutral button-views hook (QRun-IO/qqq#731)', () => {
    render(<SavedViewsMenu savedViews={makeViews()} currentView={null} viewDiffs={[]} onSelectView={noop} onNewView={noop} onStore={vi.fn()} onDelete={vi.fn()} />)
    const hook = document.querySelector('[data-qqq-id="button-views"]')
    expect(hook).toHaveClass('contents')
    expect(hook).toContainElement(screen.getByRole('button', { name: 'Saved views' }))
  })
})
