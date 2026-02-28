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

// Tests for SavedViewsMenu component

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { SavedViewsMenu } from './SavedViewsMenu'
import type { SavedView } from '@/lib/hooks/use-record-query'

function makeView(overrides: Partial<SavedView> = {}): SavedView {
  return {
    id: 'view-1',
    name: 'My View',
    filter: {
      criteria: [],
      orderBys: [],
      subFilters: [],
      booleanOperator: 'AND',
    },
    columnVisibility: { id: true, name: true },
    columnOrder: ['id', 'name'],
    sortOrder: [],
    createdAt: '2024-01-15T12:00:00.000Z',
    ...overrides,
  }
}

describe('SavedViewsMenu — rendering', () => {
  it('renders the trigger button with label "Views"', () => {
    render(
      <SavedViewsMenu
        savedViews={[]}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /saved views/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /saved views/i })).toHaveTextContent('Views')
  })

  it('shows a count badge when there are saved views', () => {
    render(
      <SavedViewsMenu
        savedViews={[makeView(), makeView({ id: 'view-2', name: 'Second View' })]}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('does not show count badge when there are no saved views', () => {
    render(
      <SavedViewsMenu
        savedViews={[]}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    // No numeric badge should appear
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('has data-qqq-id="saved-views-menu" on wrapper', () => {
    render(
      <SavedViewsMenu
        savedViews={[]}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(document.querySelector('[data-qqq-id="saved-views-menu"]')).toBeInTheDocument()
  })

  it('dropdown is not visible initially', () => {
    render(
      <SavedViewsMenu
        savedViews={[]}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('SavedViewsMenu — open / close', () => {
  it('opens the dropdown when trigger button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <SavedViewsMenu
        savedViews={[]}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /saved views/i }))
    expect(screen.getByRole('dialog', { name: /saved views/i })).toBeInTheDocument()
  })

  it('closes the dropdown when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    render(
      <SavedViewsMenu
        savedViews={[]}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /saved views/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    const backdrop = document.querySelector('.fixed.inset-0')
    expect(backdrop).toBeInTheDocument()
    await user.click(backdrop!)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes the dropdown when trigger is clicked again', async () => {
    const user = userEvent.setup()
    render(
      <SavedViewsMenu
        savedViews={[]}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /saved views/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /saved views/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('SavedViewsMenu — empty state', () => {
  it('shows "No saved views yet" when list is empty', async () => {
    const user = userEvent.setup()
    render(
      <SavedViewsMenu
        savedViews={[]}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /saved views/i }))
    expect(screen.getByText(/no saved views yet/i)).toBeInTheDocument()
  })
})

describe('SavedViewsMenu — saved views list', () => {
  it('lists all saved views by name', async () => {
    const user = userEvent.setup()
    render(
      <SavedViewsMenu
        savedViews={[
          makeView({ id: 'v1', name: 'Alpha View' }),
          makeView({ id: 'v2', name: 'Beta View' }),
        ]}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /saved views/i }))
    expect(screen.getByText('Alpha View')).toBeInTheDocument()
    expect(screen.getByText('Beta View')).toBeInTheDocument()
  })

  it('calls onLoad with the correct view when a view is clicked', async () => {
    const user = userEvent.setup()
    const onLoad = vi.fn()
    const view = makeView({ id: 'v1', name: 'Alpha View' })

    render(
      <SavedViewsMenu
        savedViews={[view]}
        onSave={vi.fn()}
        onLoad={onLoad}
        onDelete={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /saved views/i }))
    await user.click(screen.getByRole('button', { name: /load view: alpha view/i }))

    expect(onLoad).toHaveBeenCalledOnce()
    expect(onLoad).toHaveBeenCalledWith(view)
  })

  it('closes the dropdown after loading a view', async () => {
    const user = userEvent.setup()
    const view = makeView({ id: 'v1', name: 'Alpha View' })

    render(
      <SavedViewsMenu
        savedViews={[view]}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /saved views/i }))
    await user.click(screen.getByRole('button', { name: /load view: alpha view/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls onDelete with the correct view id when delete button is clicked', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    const view = makeView({ id: 'v1', name: 'Alpha View' })

    render(
      <SavedViewsMenu
        savedViews={[view]}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onDelete={onDelete}
      />
    )

    await user.click(screen.getByRole('button', { name: /saved views/i }))
    await user.click(screen.getByRole('button', { name: /delete saved view: alpha view/i }))

    expect(onDelete).toHaveBeenCalledOnce()
    expect(onDelete).toHaveBeenCalledWith('v1')
  })

  it('does not trigger onLoad when delete button is clicked', async () => {
    const user = userEvent.setup()
    const onLoad = vi.fn()
    const onDelete = vi.fn()
    const view = makeView({ id: 'v1', name: 'Alpha View' })

    render(
      <SavedViewsMenu
        savedViews={[view]}
        onSave={vi.fn()}
        onLoad={onLoad}
        onDelete={onDelete}
      />
    )

    await user.click(screen.getByRole('button', { name: /saved views/i }))
    await user.click(screen.getByRole('button', { name: /delete saved view: alpha view/i }))

    expect(onLoad).not.toHaveBeenCalled()
  })

  it('renders createdAt date in the view row', async () => {
    const user = userEvent.setup()
    const view = makeView({ id: 'v1', name: 'My View', createdAt: '2024-06-01T00:00:00.000Z' })

    render(
      <SavedViewsMenu
        savedViews={[view]}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /saved views/i }))
    // Just verify something date-like is present (locale formatting varies)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|Jun/i)).toBeInTheDocument()
  })
})

describe('SavedViewsMenu — save current view', () => {
  it('shows "Save current view..." button in the dropdown', async () => {
    const user = userEvent.setup()
    render(
      <SavedViewsMenu
        savedViews={[]}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /saved views/i }))
    expect(screen.getByRole('button', { name: /save current view/i })).toBeInTheDocument()
  })

  it('switches to save-mode when "Save current view..." is clicked', async () => {
    const user = userEvent.setup()
    render(
      <SavedViewsMenu
        savedViews={[]}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /saved views/i }))
    await user.click(screen.getByRole('button', { name: /save current view/i }))

    expect(screen.getByRole('textbox', { name: /new view name/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm save/i })).toBeInTheDocument()
  })

  it('calls onSave with the entered name when confirm is clicked', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()

    render(
      <SavedViewsMenu
        savedViews={[]}
        onSave={onSave}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /saved views/i }))
    await user.click(screen.getByRole('button', { name: /save current view/i }))
    await user.type(screen.getByRole('textbox', { name: /new view name/i }), 'My Custom View')
    await user.click(screen.getByRole('button', { name: /confirm save/i }))

    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave).toHaveBeenCalledWith('My Custom View')
  })

  it('calls onSave when Enter key is pressed in the name input', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()

    render(
      <SavedViewsMenu
        savedViews={[]}
        onSave={onSave}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /saved views/i }))
    await user.click(screen.getByRole('button', { name: /save current view/i }))
    await user.type(screen.getByRole('textbox', { name: /new view name/i }), 'My View{Enter}')

    expect(onSave).toHaveBeenCalledWith('My View')
  })

  it('does not call onSave when name is blank', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()

    render(
      <SavedViewsMenu
        savedViews={[]}
        onSave={onSave}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /saved views/i }))
    await user.click(screen.getByRole('button', { name: /save current view/i }))
    // Click confirm without typing anything
    await user.click(screen.getByRole('button', { name: /confirm save/i }))

    expect(onSave).not.toHaveBeenCalled()
  })

  it('confirm save button is disabled when name input is empty', async () => {
    const user = userEvent.setup()

    render(
      <SavedViewsMenu
        savedViews={[]}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /saved views/i }))
    await user.click(screen.getByRole('button', { name: /save current view/i }))

    expect(screen.getByRole('button', { name: /confirm save/i })).toBeDisabled()
  })

  it('exits save-mode when Escape is pressed in the name input', async () => {
    const user = userEvent.setup()

    render(
      <SavedViewsMenu
        savedViews={[]}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /saved views/i }))
    await user.click(screen.getByRole('button', { name: /save current view/i }))
    await user.keyboard('{Escape}')

    // Should return to normal mode — "Save current view..." button visible again
    expect(screen.getByRole('button', { name: /save current view/i })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /new view name/i })).not.toBeInTheDocument()
  })

  it('resets save-mode when the trigger button is clicked again', async () => {
    const user = userEvent.setup()

    render(
      <SavedViewsMenu
        savedViews={[]}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    // Open → enter save mode
    await user.click(screen.getByRole('button', { name: /saved views/i }))
    await user.click(screen.getByRole('button', { name: /save current view/i }))
    expect(screen.getByRole('textbox', { name: /new view name/i })).toBeInTheDocument()

    // Click trigger to close
    await user.click(screen.getByRole('button', { name: /saved views/i }))
    // Re-open — should NOT be in save mode
    await user.click(screen.getByRole('button', { name: /saved views/i }))
    expect(screen.queryByRole('textbox', { name: /new view name/i })).not.toBeInTheDocument()
  })
})
