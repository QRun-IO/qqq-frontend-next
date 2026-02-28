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

// Tests for ExportButton component

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { ExportButton } from './ExportButton'
import type { QTableMetaData } from '@/types'

// Mock the tables API so we don't hit the network
vi.mock('@/lib/api/tables', () => ({
  queryRecords: vi.fn(),
}))

// Mock the toast to verify error notifications
vi.mock('@/lib/hooks/use-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
  },
  useToast: () => ({ toast: { error: vi.fn() } }),
}))

import { queryRecords } from '@/lib/api/tables'
import { toast } from '@/lib/hooks/use-toast'

const mockQueryRecords = vi.mocked(queryRecords)
const mockToastError = vi.mocked(toast.error)

const RECORDS = [
  { values: { id: 1, name: 'Alice' }, displayValues: { id: '1', name: 'Alice Smith' } },
  { values: { id: 2, name: 'Bob' }, displayValues: { id: '2', name: 'Bob Jones' } },
]

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
      name: {
        name: 'name',
        label: 'Name',
        type: 'STRING',
        isRequired: false,
        isEditable: true,
        isHeavy: false,
        isHidden: false,
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

const baseFilter = {
  criteria: [],
  orderBys: [],
  subFilters: [],
  booleanOperator: 'AND' as const,
  skip: 0,
  limit: 25,
}

// Helpers for mocking URL / anchor download
let createdObjectUrls: string[] = []
let revokedObjectUrls: string[] = []
let anchorClicks = 0

beforeEach(() => {
  vi.clearAllMocks()
  createdObjectUrls = []
  revokedObjectUrls = []
  anchorClicks = 0

  mockQueryRecords.mockResolvedValue({ records: RECORDS } as unknown as Awaited<ReturnType<typeof queryRecords>>)

  // Stub URL.createObjectURL / revokeObjectURL
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn((blob: Blob) => {
      const url = `blob:test-url-${createdObjectUrls.length}`
      createdObjectUrls.push(url)
      return url
    }),
    revokeObjectURL: vi.fn((url: string) => {
      revokedObjectUrls.push(url)
    }),
  })

  // Intercept anchor click to track it without navigating
  const originalCreateElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = originalCreateElement(tag)
    if (tag === 'a') {
      vi.spyOn(el as HTMLAnchorElement, 'click').mockImplementation(() => {
        anchorClicks++
      })
    }
    return el
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ExportButton — rendering', () => {
  it('renders the export trigger button', () => {
    render(
      <ExportButton
        tableName="person"
        tableMetaData={makeTableMeta()}
        currentFilter={baseFilter}
        columnVisibility={{}}
        columnOrder={['id', 'name']}
      />
    )
    expect(screen.getByRole('button', { name: /export records/i })).toBeInTheDocument()
  })

  it('shows "Export" label by default', () => {
    render(
      <ExportButton
        tableName="person"
        tableMetaData={makeTableMeta()}
        currentFilter={baseFilter}
        columnVisibility={{}}
        columnOrder={['id', 'name']}
      />
    )
    expect(screen.getByRole('button', { name: /export records/i })).toHaveTextContent('Export')
  })

  it('has data-qqq-id="export-button" on wrapper', () => {
    render(
      <ExportButton
        tableName="person"
        tableMetaData={makeTableMeta()}
        currentFilter={baseFilter}
        columnVisibility={{}}
        columnOrder={['id', 'name']}
      />
    )
    expect(document.querySelector('[data-qqq-id="export-button"]')).toBeInTheDocument()
  })

  it('dropdown is not visible initially', () => {
    render(
      <ExportButton
        tableName="person"
        tableMetaData={makeTableMeta()}
        currentFilter={baseFilter}
        columnVisibility={{}}
        columnOrder={['id', 'name']}
      />
    )
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('ExportButton — dropdown', () => {
  it('opens dropdown menu when trigger is clicked', async () => {
    const user = userEvent.setup()
    render(
      <ExportButton
        tableName="person"
        tableMetaData={makeTableMeta()}
        currentFilter={baseFilter}
        columnVisibility={{}}
        columnOrder={['id', 'name']}
      />
    )

    await user.click(screen.getByRole('button', { name: /export records/i }))
    expect(screen.getByRole('menu', { name: /export options/i })).toBeInTheDocument()
  })

  it('shows "All records" menu item', async () => {
    const user = userEvent.setup()
    render(
      <ExportButton
        tableName="person"
        tableMetaData={makeTableMeta()}
        currentFilter={baseFilter}
        columnVisibility={{}}
        columnOrder={['id', 'name']}
      />
    )

    await user.click(screen.getByRole('button', { name: /export records/i }))
    expect(screen.getByRole('menuitem', { name: /all records/i })).toBeInTheDocument()
  })

  it('shows "Current page" menu item', async () => {
    const user = userEvent.setup()
    render(
      <ExportButton
        tableName="person"
        tableMetaData={makeTableMeta()}
        currentFilter={baseFilter}
        columnVisibility={{}}
        columnOrder={['id', 'name']}
      />
    )

    await user.click(screen.getByRole('button', { name: /export records/i }))
    expect(screen.getByRole('menuitem', { name: /current page/i })).toBeInTheDocument()
  })

  it('shows "Selected (N)" menu item when selectedRecordIds is non-empty', async () => {
    const user = userEvent.setup()
    render(
      <ExportButton
        tableName="person"
        tableMetaData={makeTableMeta()}
        currentFilter={baseFilter}
        columnVisibility={{}}
        columnOrder={['id', 'name']}
        selectedRecordIds={[1, 2, 3]}
      />
    )

    await user.click(screen.getByRole('button', { name: /export records/i }))
    expect(screen.getByRole('menuitem', { name: /selected \(3\)/i })).toBeInTheDocument()
  })

  it('does not show "Selected" option when no records are selected', async () => {
    const user = userEvent.setup()
    render(
      <ExportButton
        tableName="person"
        tableMetaData={makeTableMeta()}
        currentFilter={baseFilter}
        columnVisibility={{}}
        columnOrder={['id', 'name']}
        selectedRecordIds={[]}
      />
    )

    await user.click(screen.getByRole('button', { name: /export records/i }))
    expect(screen.queryByRole('menuitem', { name: /selected/i })).not.toBeInTheDocument()
  })

  it('closes the dropdown when clicking the backdrop', async () => {
    const user = userEvent.setup()
    render(
      <ExportButton
        tableName="person"
        tableMetaData={makeTableMeta()}
        currentFilter={baseFilter}
        columnVisibility={{}}
        columnOrder={['id', 'name']}
      />
    )

    await user.click(screen.getByRole('button', { name: /export records/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    // Click on the fixed backdrop
    const backdrop = document.querySelector('.fixed.inset-0')
    expect(backdrop).toBeInTheDocument()
    await user.click(backdrop!)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('ExportButton — download (all records)', () => {
  it('calls queryRecords and triggers anchor download for "All records"', async () => {
    const user = userEvent.setup()
    render(
      <ExportButton
        tableName="person"
        tableMetaData={makeTableMeta()}
        currentFilter={baseFilter}
        columnVisibility={{}}
        columnOrder={['id', 'name']}
      />
    )

    await user.click(screen.getByRole('button', { name: /export records/i }))
    await user.click(screen.getByRole('menuitem', { name: /all records/i }))

    await waitFor(() => {
      expect(mockQueryRecords).toHaveBeenCalledWith('person', expect.objectContaining({
        filter: expect.objectContaining({ limit: 10000 }),
      }))
      expect(anchorClicks).toBe(1)
    })
  })

  it('shows "Exporting..." label while the fetch is in progress', async () => {
    // Delay the fetch so we can observe the loading state
    mockQueryRecords.mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve({ records: RECORDS } as unknown as Awaited<ReturnType<typeof queryRecords>>), 200)
    }))

    const user = userEvent.setup()
    render(
      <ExportButton
        tableName="person"
        tableMetaData={makeTableMeta()}
        currentFilter={baseFilter}
        columnVisibility={{}}
        columnOrder={['id', 'name']}
      />
    )

    await user.click(screen.getByRole('button', { name: /export records/i }))
    await user.click(screen.getByRole('menuitem', { name: /all records/i }))

    // Immediately after click — should show Exporting...
    expect(screen.getByRole('button', { name: /export records/i })).toHaveTextContent('Exporting...')

    // Button should be disabled during export
    expect(screen.getByRole('button', { name: /export records/i })).toBeDisabled()

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export records/i })).toHaveTextContent('Export')
    })
  })

  it('revokes the object URL after download', async () => {
    const user = userEvent.setup()
    render(
      <ExportButton
        tableName="person"
        tableMetaData={makeTableMeta()}
        currentFilter={baseFilter}
        columnVisibility={{}}
        columnOrder={['id', 'name']}
      />
    )

    await user.click(screen.getByRole('button', { name: /export records/i }))
    await user.click(screen.getByRole('menuitem', { name: /all records/i }))

    await waitFor(() => {
      expect(revokedObjectUrls).toHaveLength(1)
    })
  })
})

describe('ExportButton — download (current page)', () => {
  it('calls queryRecords with the currentFilter for "Current page"', async () => {
    const user = userEvent.setup()
    render(
      <ExportButton
        tableName="person"
        tableMetaData={makeTableMeta()}
        currentFilter={baseFilter}
        columnVisibility={{}}
        columnOrder={['id', 'name']}
      />
    )

    await user.click(screen.getByRole('button', { name: /export records/i }))
    await user.click(screen.getByRole('menuitem', { name: /current page/i }))

    await waitFor(() => {
      expect(mockQueryRecords).toHaveBeenCalledWith('person', { filter: baseFilter })
    })
  })
})

describe('ExportButton — download (selected)', () => {
  it('builds a filter with IN criteria for selected record IDs', async () => {
    const user = userEvent.setup()
    render(
      <ExportButton
        tableName="person"
        tableMetaData={makeTableMeta()}
        currentFilter={baseFilter}
        columnVisibility={{}}
        columnOrder={['id', 'name']}
        selectedRecordIds={[1, 2]}
      />
    )

    await user.click(screen.getByRole('button', { name: /export records/i }))
    await user.click(screen.getByRole('menuitem', { name: /selected \(2\)/i }))

    await waitFor(() => {
      expect(mockQueryRecords).toHaveBeenCalledWith('person', expect.objectContaining({
        filter: expect.objectContaining({
          criteria: [expect.objectContaining({ operator: 'IN', values: ['1', '2'] })],
        }),
      }))
    })
  })
})

describe('ExportButton — error handling', () => {
  it('shows a toast error and re-enables button when queryRecords rejects', async () => {
    mockQueryRecords.mockRejectedValue(new Error('Network error'))

    const user = userEvent.setup()
    render(
      <ExportButton
        tableName="person"
        tableMetaData={makeTableMeta()}
        currentFilter={baseFilter}
        columnVisibility={{}}
        columnOrder={['id', 'name']}
      />
    )

    await user.click(screen.getByRole('button', { name: /export records/i }))
    await user.click(screen.getByRole('menuitem', { name: /all records/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('Export failed'))
      expect(screen.getByRole('button', { name: /export records/i })).not.toBeDisabled()
    })
  })
})
