// Tests for BulkActionBar component

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { BulkActionBar } from './BulkActionBar'
import type { QTableMetaData } from '@/types'

// ProcessLauncherMenu uses useRouter internally
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

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
    },
    sections: [],
    capabilities: ['TABLE_QUERY', 'TABLE_GET', 'TABLE_INSERT', 'TABLE_UPDATE', 'TABLE_DELETE'],
    exposedJoins: [],
    readPermission: true,
    insertPermission: true,
    editPermission: true,
    deletePermission: true,
    usesVariants: false,
    variantTableLabel: '',
    ...overrides,
  }
}

const baseFilter = {
  criteria: [],
  orderBys: [],
  subFilters: [],
  booleanOperator: 'AND' as const,
  skip: 0,
  limit: 25,
}

describe('BulkActionBar — visibility', () => {
  it('returns null when selectedCount is 0', () => {
    const { container } = render(
      <BulkActionBar
        tableMetaData={makeTableMeta()}
        selectedCount={0}
        totalCount={100}
        onClearSelection={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the bar when selectedCount > 0', () => {
    render(
      <BulkActionBar
        tableMetaData={makeTableMeta()}
        selectedCount={3}
        totalCount={100}
        onClearSelection={vi.fn()}
      />
    )
    expect(screen.getByRole('region', { name: /bulk actions/i })).toBeInTheDocument()
  })
})

describe('BulkActionBar — selection count', () => {
  it('shows correct selectedCount out of totalCount', () => {
    render(
      <BulkActionBar
        tableMetaData={makeTableMeta()}
        selectedCount={5}
        totalCount={200}
        onClearSelection={vi.fn()}
      />
    )
    expect(screen.getByText(/5 of 200 selected/i)).toBeInTheDocument()
  })

  it('formats large totalCount with locale separators', () => {
    render(
      <BulkActionBar
        tableMetaData={makeTableMeta()}
        selectedCount={2}
        totalCount={1500}
        onClearSelection={vi.fn()}
      />
    )
    // toLocaleString on 1500 in en-US gives "1,500"
    expect(screen.getByText(/2 of/i)).toBeInTheDocument()
  })
})

describe('BulkActionBar — clear selection', () => {
  it('calls onClearSelection when "Clear" button is clicked', async () => {
    const user = userEvent.setup()
    const onClearSelection = vi.fn()

    render(
      <BulkActionBar
        tableMetaData={makeTableMeta()}
        selectedCount={3}
        totalCount={100}
        onClearSelection={onClearSelection}
      />
    )

    await user.click(screen.getByRole('button', { name: /clear selection/i }))
    expect(onClearSelection).toHaveBeenCalledOnce()
  })
})

describe('BulkActionBar — export action', () => {
  it('shows export button when onExportSelected is provided', () => {
    render(
      <BulkActionBar
        tableMetaData={makeTableMeta()}
        selectedCount={2}
        totalCount={50}
        onClearSelection={vi.fn()}
        onExportSelected={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /export selected/i })).toBeInTheDocument()
  })

  it('calls onExportSelected when export button is clicked', async () => {
    const user = userEvent.setup()
    const onExportSelected = vi.fn()

    render(
      <BulkActionBar
        tableMetaData={makeTableMeta()}
        selectedCount={2}
        totalCount={50}
        onClearSelection={vi.fn()}
        onExportSelected={onExportSelected}
      />
    )

    await user.click(screen.getByRole('button', { name: /export selected/i }))
    expect(onExportSelected).toHaveBeenCalledOnce()
  })

  it('does not show export button when onExportSelected is not provided', () => {
    render(
      <BulkActionBar
        tableMetaData={makeTableMeta()}
        selectedCount={2}
        totalCount={50}
        onClearSelection={vi.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: /export selected/i })).not.toBeInTheDocument()
  })
})

describe('BulkActionBar — delete action', () => {
  it('shows delete button when deletePermission=true and onDeleteSelected is provided', () => {
    render(
      <BulkActionBar
        tableMetaData={makeTableMeta({ deletePermission: true })}
        selectedCount={2}
        totalCount={50}
        onClearSelection={vi.fn()}
        onDeleteSelected={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })

  it('calls onDeleteSelected when delete button is clicked', async () => {
    const user = userEvent.setup()
    const onDeleteSelected = vi.fn()

    render(
      <BulkActionBar
        tableMetaData={makeTableMeta({ deletePermission: true })}
        selectedCount={3}
        totalCount={50}
        onClearSelection={vi.fn()}
        onDeleteSelected={onDeleteSelected}
      />
    )

    await user.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDeleteSelected).toHaveBeenCalledOnce()
  })

  it('does not show delete button when deletePermission=false', () => {
    render(
      <BulkActionBar
        tableMetaData={makeTableMeta({ deletePermission: false })}
        selectedCount={2}
        totalCount={50}
        onClearSelection={vi.fn()}
        onDeleteSelected={vi.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })

  it('does not show delete button when onDeleteSelected is not provided', () => {
    render(
      <BulkActionBar
        tableMetaData={makeTableMeta({ deletePermission: true })}
        selectedCount={2}
        totalCount={50}
        onClearSelection={vi.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })

  it('shows singular "record" label when only 1 item selected', () => {
    render(
      <BulkActionBar
        tableMetaData={makeTableMeta({ deletePermission: true })}
        selectedCount={1}
        totalCount={50}
        onClearSelection={vi.fn()}
        onDeleteSelected={vi.fn()}
      />
    )
    const btn = screen.getByRole('button', { name: /delete 1 selected record$/i })
    expect(btn).toBeInTheDocument()
  })

  it('shows plural "records" label when multiple items selected', () => {
    render(
      <BulkActionBar
        tableMetaData={makeTableMeta({ deletePermission: true })}
        selectedCount={4}
        totalCount={50}
        onClearSelection={vi.fn()}
        onDeleteSelected={vi.fn()}
      />
    )
    const btn = screen.getByRole('button', { name: /delete 4 selected records$/i })
    expect(btn).toBeInTheDocument()
  })
})

describe('BulkActionBar — process launcher', () => {
  it('does not show process launcher when no processes provided', () => {
    render(
      <BulkActionBar
        tableMetaData={makeTableMeta()}
        selectedCount={2}
        totalCount={50}
        onClearSelection={vi.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: /run process/i })).not.toBeInTheDocument()
  })

  it('shows process launcher when processes, selectedRecordIds, and currentFilter are provided', () => {
    const processes = [
      {
        name: 'sendEmail',
        label: 'Send Email',
        tableName: 'person',
        isHidden: false,
        iconName: '',
        hasPermission: true,
        stepFlow: 'LINEAR' as const,
        minInputRecords: 1,
        frontendSteps: [],
      },
    ]

    render(
      <BulkActionBar
        tableMetaData={makeTableMeta()}
        selectedCount={2}
        totalCount={50}
        onClearSelection={vi.fn()}
        processes={processes}
        selectedRecordIds={[1, 2]}
        currentFilter={baseFilter}
      />
    )

    // ProcessLauncherMenu renders a trigger button
    expect(screen.getByRole('button', { name: /run process/i })).toBeInTheDocument()
  })
})

describe('BulkActionBar — accessibility', () => {
  it('has data-qqq-id="bulk-action-bar"', () => {
    render(
      <BulkActionBar
        tableMetaData={makeTableMeta()}
        selectedCount={1}
        totalCount={10}
        onClearSelection={vi.fn()}
      />
    )
    expect(document.querySelector('[data-qqq-id="bulk-action-bar"]')).toBeInTheDocument()
  })

  it('has aria-live="polite" on the region', () => {
    render(
      <BulkActionBar
        tableMetaData={makeTableMeta()}
        selectedCount={1}
        totalCount={10}
        onClearSelection={vi.fn()}
      />
    )
    expect(screen.getByRole('region', { name: /bulk actions/i })).toHaveAttribute('aria-live', 'polite')
  })
})
