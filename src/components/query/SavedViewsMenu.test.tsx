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
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import type { SavedViewsResult } from '@/lib/hooks/use-saved-views'
import type { SavedView } from '@/lib/utils/saved-view-utils'
import { SavedViewsMenu } from './SavedViewsMenu'

const view = (id: number, label: string, userId: string): SavedView => ({ id, label, userId, tableName: 'person', view: { queryFilter: {} } })
const mine = view(1, 'My View', 'sample:alice')
const theirs = view(2, 'Their View', 'sample:bob')

function makeViews(overrides: Partial<SavedViewsResult> = {}): SavedViewsResult {
  return {
    isAvailable: true, canStore: true, canDelete: true, yourViews: [mine], sharedViews: [theirs], isLoading: false, error: null,
    storeView: vi.fn(), deleteView: vi.fn(), isOwner: (v) => v.userId === 'sample:alice', ...overrides,
  }
}

const noop = () => undefined

describe('SavedViewsMenu', () => {
  it('renders nothing when the backend has no saved view processes', () => {
    const { container } = render(<SavedViewsMenu savedViews={makeViews({ isAvailable: false })} currentView={null} viewDiffs={[]}
      onSelectView={noop} onNewView={noop} onStore={vi.fn()} onDelete={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
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
})
