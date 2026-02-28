// Tests for ColumnConfig component

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { ColumnConfig } from './ColumnConfig'
import type { QTableMetaData } from '@/types'

function makeTableMeta(overrides: Partial<QTableMetaData> = {}): QTableMetaData {
  return {
    name: 'person',
    label: 'People',
    isHidden: false,
    primaryKeyField: 'id',
    fields: {
      id: {
        name: 'id',
        label: 'ID',
        type: 'INTEGER',
        isRequired: true,
        isEditable: false,
        isHeavy: false,
        isHidden: false,
        adornments: [],
      },
      firstName: {
        name: 'firstName',
        label: 'First Name',
        type: 'STRING',
        isRequired: false,
        isEditable: true,
        isHeavy: false,
        isHidden: false,
        adornments: [],
      },
      lastName: {
        name: 'lastName',
        label: 'Last Name',
        type: 'STRING',
        isRequired: false,
        isEditable: true,
        isHeavy: false,
        isHidden: false,
        adornments: [],
      },
      hiddenField: {
        name: 'hiddenField',
        label: 'Hidden Field',
        type: 'STRING',
        isRequired: false,
        isEditable: true,
        isHeavy: false,
        isHidden: true, // this one should be excluded
        adornments: [],
      },
    },
    sections: [],
    capabilities: ['TABLE_QUERY'],
    exposedJoins: [],
    readPermission: true,
    insertPermission: false,
    editPermission: false,
    deletePermission: false,
    usesVariants: false,
    variantTableLabel: '',
    ...overrides,
  }
}

const defaultVisibility: Record<string, boolean> = {
  id: true,
  firstName: true,
  lastName: true,
}

const defaultOrder = ['id', 'firstName', 'lastName']

describe('ColumnConfig — rendering', () => {
  it('renders the "Configure Columns" heading', () => {
    render(
      <ColumnConfig
        tableMetaData={makeTableMeta()}
        columnVisibility={defaultVisibility}
        columnOrder={defaultOrder}
        onVisibilityChange={vi.fn()}
        onOrderChange={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('Configure Columns')).toBeInTheDocument()
  })

  it('renders a list of non-hidden fields', () => {
    render(
      <ColumnConfig
        tableMetaData={makeTableMeta()}
        columnVisibility={defaultVisibility}
        columnOrder={defaultOrder}
        onVisibilityChange={vi.fn()}
        onOrderChange={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('ID')).toBeInTheDocument()
    expect(screen.getByText('First Name')).toBeInTheDocument()
    expect(screen.getByText('Last Name')).toBeInTheDocument()
  })

  it('does not render fields with isHidden=true', () => {
    render(
      <ColumnConfig
        tableMetaData={makeTableMeta()}
        columnVisibility={defaultVisibility}
        columnOrder={defaultOrder}
        onVisibilityChange={vi.fn()}
        onOrderChange={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.queryByText('Hidden Field')).not.toBeInTheDocument()
  })

  it('has data-qqq-id="column-config" on the wrapper', () => {
    render(
      <ColumnConfig
        tableMetaData={makeTableMeta()}
        columnVisibility={defaultVisibility}
        columnOrder={defaultOrder}
        onVisibilityChange={vi.fn()}
        onOrderChange={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(document.querySelector('[data-qqq-id="column-config"]')).toBeInTheDocument()
  })

  it('renders "Show all" and "Hide all" shortcut buttons', () => {
    render(
      <ColumnConfig
        tableMetaData={makeTableMeta()}
        columnVisibility={defaultVisibility}
        columnOrder={defaultOrder}
        onVisibilityChange={vi.fn()}
        onOrderChange={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /show all/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hide all/i })).toBeInTheDocument()
  })

  it('renders a close button', () => {
    render(
      <ColumnConfig
        tableMetaData={makeTableMeta()}
        columnVisibility={defaultVisibility}
        columnOrder={defaultOrder}
        onVisibilityChange={vi.fn()}
        onOrderChange={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /close column configuration/i })).toBeInTheDocument()
  })

  it('renders the column list with role="list"', () => {
    render(
      <ColumnConfig
        tableMetaData={makeTableMeta()}
        columnVisibility={defaultVisibility}
        columnOrder={defaultOrder}
        onVisibilityChange={vi.fn()}
        onOrderChange={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByRole('list', { name: /column visibility and order/i })).toBeInTheDocument()
  })
})

describe('ColumnConfig — visibility toggles', () => {
  it('visible columns have aria-pressed=true on their toggle button', () => {
    render(
      <ColumnConfig
        tableMetaData={makeTableMeta()}
        columnVisibility={{ id: true, firstName: true, lastName: true }}
        columnOrder={defaultOrder}
        onVisibilityChange={vi.fn()}
        onOrderChange={vi.fn()}
        onClose={vi.fn()}
      />
    )
    const toggle = screen.getByRole('button', { name: /hide column id/i })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
  })

  it('hidden columns have aria-pressed=false on their toggle button', () => {
    render(
      <ColumnConfig
        tableMetaData={makeTableMeta()}
        columnVisibility={{ id: true, firstName: false, lastName: true }}
        columnOrder={defaultOrder}
        onVisibilityChange={vi.fn()}
        onOrderChange={vi.fn()}
        onClose={vi.fn()}
      />
    )
    const toggle = screen.getByRole('button', { name: /show column first name/i })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('clicking a toggle calls onVisibilityChange with the updated map', async () => {
    const user = userEvent.setup()
    const onVisibilityChange = vi.fn()

    render(
      <ColumnConfig
        tableMetaData={makeTableMeta()}
        columnVisibility={{ id: true, firstName: true, lastName: true }}
        columnOrder={defaultOrder}
        onVisibilityChange={onVisibilityChange}
        onOrderChange={vi.fn()}
        onClose={vi.fn()}
      />
    )

    // Click the toggle for "First Name" (currently visible → should hide it)
    await user.click(screen.getByRole('button', { name: /hide column first name/i }))

    expect(onVisibilityChange).toHaveBeenCalledOnce()
    expect(onVisibilityChange).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: false })
    )
  })

  it('clicking a hidden toggle calls onVisibilityChange to show the column', async () => {
    const user = userEvent.setup()
    const onVisibilityChange = vi.fn()

    render(
      <ColumnConfig
        tableMetaData={makeTableMeta()}
        columnVisibility={{ id: true, firstName: false, lastName: true }}
        columnOrder={defaultOrder}
        onVisibilityChange={onVisibilityChange}
        onOrderChange={vi.fn()}
        onClose={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /show column first name/i }))

    expect(onVisibilityChange).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: true })
    )
  })
})

describe('ColumnConfig — show all / hide all', () => {
  it('"Show all" calls onVisibilityChange with all columns set to true', async () => {
    const user = userEvent.setup()
    const onVisibilityChange = vi.fn()

    render(
      <ColumnConfig
        tableMetaData={makeTableMeta()}
        columnVisibility={{ id: true, firstName: false, lastName: false }}
        columnOrder={defaultOrder}
        onVisibilityChange={onVisibilityChange}
        onOrderChange={vi.fn()}
        onClose={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /show all/i }))

    expect(onVisibilityChange).toHaveBeenCalledOnce()
    const arg = onVisibilityChange.mock.calls[0][0] as Record<string, boolean>
    // Every value should be true
    expect(Object.values(arg).every((v) => v === true)).toBe(true)
  })

  it('"Hide all" calls onVisibilityChange with all columns set to false', async () => {
    const user = userEvent.setup()
    const onVisibilityChange = vi.fn()

    render(
      <ColumnConfig
        tableMetaData={makeTableMeta()}
        columnVisibility={{ id: true, firstName: true, lastName: true }}
        columnOrder={defaultOrder}
        onVisibilityChange={onVisibilityChange}
        onOrderChange={vi.fn()}
        onClose={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /hide all/i }))

    expect(onVisibilityChange).toHaveBeenCalledOnce()
    const arg = onVisibilityChange.mock.calls[0][0] as Record<string, boolean>
    expect(Object.values(arg).every((v) => v === false)).toBe(true)
  })

  it('"Show all" does not include fields with isHidden=true in the visibility map', async () => {
    const user = userEvent.setup()
    const onVisibilityChange = vi.fn()

    render(
      <ColumnConfig
        tableMetaData={makeTableMeta()}
        columnVisibility={defaultVisibility}
        columnOrder={defaultOrder}
        onVisibilityChange={onVisibilityChange}
        onOrderChange={vi.fn()}
        onClose={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /show all/i }))

    const arg = onVisibilityChange.mock.calls[0][0] as Record<string, boolean>
    // hiddenField (isHidden=true) should not be in the result
    expect('hiddenField' in arg).toBe(false)
  })
})

describe('ColumnConfig — close button', () => {
  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(
      <ColumnConfig
        tableMetaData={makeTableMeta()}
        columnVisibility={defaultVisibility}
        columnOrder={defaultOrder}
        onVisibilityChange={vi.fn()}
        onOrderChange={vi.fn()}
        onClose={onClose}
      />
    )

    await user.click(screen.getByRole('button', { name: /close column configuration/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('ColumnConfig — column order (keyboard move)', () => {
  it('ArrowDown on grip button moves a column down via onOrderChange', async () => {
    const user = userEvent.setup()
    const onOrderChange = vi.fn()

    render(
      <ColumnConfig
        tableMetaData={makeTableMeta()}
        columnVisibility={defaultVisibility}
        columnOrder={['id', 'firstName', 'lastName']}
        onVisibilityChange={vi.fn()}
        onOrderChange={onOrderChange}
        onClose={vi.fn()}
      />
    )

    // Focus the grip for the first column (id) and press ArrowDown
    const idGrip = screen.getByRole('button', { name: /drag to reorder id/i })
    idGrip.focus()
    await user.keyboard('{ArrowDown}')

    expect(onOrderChange).toHaveBeenCalledOnce()
    // id should have moved from position 0 to position 1
    const newOrder = onOrderChange.mock.calls[0][0] as string[]
    expect(newOrder[0]).toBe('firstName')
    expect(newOrder[1]).toBe('id')
  })

  it('ArrowUp on grip button moves a column up via onOrderChange', async () => {
    const user = userEvent.setup()
    const onOrderChange = vi.fn()

    render(
      <ColumnConfig
        tableMetaData={makeTableMeta()}
        columnVisibility={defaultVisibility}
        columnOrder={['id', 'firstName', 'lastName']}
        onVisibilityChange={vi.fn()}
        onOrderChange={onOrderChange}
        onClose={vi.fn()}
      />
    )

    // Focus the grip for the last column (lastName) and press ArrowUp
    const lastGrip = screen.getByRole('button', { name: /drag to reorder last name/i })
    lastGrip.focus()
    await user.keyboard('{ArrowUp}')

    expect(onOrderChange).toHaveBeenCalledOnce()
    const newOrder = onOrderChange.mock.calls[0][0] as string[]
    expect(newOrder[1]).toBe('lastName')
    expect(newOrder[2]).toBe('firstName')
  })

  it('ArrowUp does nothing on the first column', async () => {
    const user = userEvent.setup()
    const onOrderChange = vi.fn()

    render(
      <ColumnConfig
        tableMetaData={makeTableMeta()}
        columnVisibility={defaultVisibility}
        columnOrder={['id', 'firstName', 'lastName']}
        onVisibilityChange={vi.fn()}
        onOrderChange={onOrderChange}
        onClose={vi.fn()}
      />
    )

    const firstGrip = screen.getByRole('button', { name: /drag to reorder id/i })
    firstGrip.focus()
    await user.keyboard('{ArrowUp}')

    // Should not fire at position 0
    expect(onOrderChange).not.toHaveBeenCalled()
  })

  it('ArrowDown does nothing on the last column', async () => {
    const user = userEvent.setup()
    const onOrderChange = vi.fn()

    render(
      <ColumnConfig
        tableMetaData={makeTableMeta()}
        columnVisibility={defaultVisibility}
        columnOrder={['id', 'firstName', 'lastName']}
        onVisibilityChange={vi.fn()}
        onOrderChange={onOrderChange}
        onClose={vi.fn()}
      />
    )

    const lastGrip = screen.getByRole('button', { name: /drag to reorder last name/i })
    lastGrip.focus()
    await user.keyboard('{ArrowDown}')

    expect(onOrderChange).not.toHaveBeenCalled()
  })
})

describe('ColumnConfig — column order (display order)', () => {
  it('renders columns in the order specified by columnOrder', () => {
    render(
      <ColumnConfig
        tableMetaData={makeTableMeta()}
        columnVisibility={defaultVisibility}
        columnOrder={['lastName', 'firstName', 'id']}
        onVisibilityChange={vi.fn()}
        onOrderChange={vi.fn()}
        onClose={vi.fn()}
      />
    )

    const listItems = screen.getAllByRole('listitem')
    // Extract column label text — each listitem contains a toggle button with label text
    const labels = listItems.map((li) => {
      const btn = li.querySelector('[aria-pressed]')
      return btn?.textContent?.trim()
    })

    expect(labels[0]).toContain('Last Name')
    expect(labels[1]).toContain('First Name')
    expect(labels[2]).toContain('ID')
  })
})
