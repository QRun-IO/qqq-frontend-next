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

// Tests for ExportButton: backend export with visible columns and the full filter (#649)

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import type { QTableMetaData, QQueryFilter } from '@/types'
import { ExportButton, formatDateTimeForFileName } from './ExportButton'

vi.mock('@/lib/api/tables', () => ({ exportRecords: vi.fn() }))
vi.mock('@/lib/hooks/use-toast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { exportRecords } from '@/lib/api/tables'
import { toast } from '@/lib/hooks/use-toast'

const mockExport = vi.mocked(exportRecords)

const table = (capabilities: string[]): QTableMetaData => ({
  name: 'person', label: 'People', isHidden: false, primaryKeyField: 'id', fields: {}, sections: [], exposedJoins: [],
  capabilities: capabilities as QTableMetaData['capabilities'], readPermission: true, insertPermission: false, editPermission: false,
  deletePermission: false, usesVariants: false, variantTableLabel: '',
})

const filter: QQueryFilter = {
  criteria: [{ fieldName: 'firstName', operator: 'EQUALS', values: ['Avery'] }],
  orderBys: [{ fieldName: 'id', isAscending: false }],
  subFilters: [],
  booleanOperator: 'AND',
  skip: 50,
  limit: 25,
}

describe('ExportButton', () => {
  beforeEach(() => {
    mockExport.mockReset()
    vi.mocked(toast.error).mockReset()
    URL.createObjectURL = vi.fn(() => 'blob:export')
    URL.revokeObjectURL = vi.fn()
  })

  it('posts the visible columns and the filter without paging for each format', async () => {
    mockExport.mockResolvedValue(new Blob(['id\n1']))
    render(<ExportButton tableName="person" tableMetaData={table(['TABLE_QUERY', 'TABLE_EXPORT'])} exportFilter={filter}
      columnNames={['id', 'firstName', 'pet.name']} totalCount={3} />)
    for (const format of ['csv', 'xlsx', 'json']) {
      await userEvent.click(screen.getByRole('button', { name: 'Export records' }))
      await userEvent.click(screen.getByRole('menuitem', { name: new RegExp(`Export ${format.toUpperCase()}`) }))
      await waitFor(() => expect(mockExport).toHaveBeenCalledTimes(['csv', 'xlsx', 'json'].indexOf(format) + 1))
      const [tableName, filename, fields, sentFilter] = mockExport.mock.calls.at(-1)!
      expect(tableName).toBe('person')
      expect(filename).toMatch(new RegExp(`^People Export \\d{4}-\\d{2}-\\d{2} \\d{4}\\.${format}$`))
      expect(fields).toEqual(['id', 'firstName', 'pet.name'])
      expect(sentFilter).toEqual({ criteria: filter.criteria, orderBys: filter.orderBys, subFilters: [], booleanOperator: 'AND' })
    }
  })

  it('disables the formats when nothing matches and the button without TABLE_EXPORT', async () => {
    const { rerender } = render(<ExportButton tableName="person" tableMetaData={table(['TABLE_EXPORT'])} exportFilter={filter} columnNames={['id']} totalCount={0} />)
    await userEvent.click(screen.getByRole('button', { name: 'Export records' }))
    expect(screen.getByRole('menuitem', { name: /Export CSV/ })).toBeDisabled()
    rerender(<ExportButton tableName="person" tableMetaData={table(['TABLE_QUERY'])} exportFilter={filter} columnNames={['id']} totalCount={2} />)
    expect(screen.getByRole('button', { name: /exports are not allowed/ })).toBeDisabled()
  })

  it('closes on Escape and returns focus to its button (#708)', async () => {
    render(<ExportButton tableName="person" tableMetaData={table(['TABLE_QUERY', 'TABLE_EXPORT'])} exportFilter={filter} columnNames={['id']} totalCount={2} />)
    await userEvent.click(screen.getByRole('button', { name: 'Export records' }))
    expect(screen.getByRole('menuitem', { name: /Export CSV/ })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menuitem', { name: /Export CSV/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export records' })).toHaveFocus()
  })

  it('reports backend export errors', async () => {
    mockExport.mockRejectedValue(new Error('Permission denied'))
    render(<ExportButton tableName="person" tableMetaData={table(['TABLE_EXPORT'])} exportFilter={filter} columnNames={['id']} totalCount={1} />)
    await userEvent.click(screen.getByRole('button', { name: 'Export records' }))
    await userEvent.click(screen.getByRole('menuitem', { name: /Export CSV/ }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Export failed: Permission denied'))
  })

  it('formats file-name dates like Material', () => {
    expect(formatDateTimeForFileName(new Date(2026, 0, 2, 3, 4))).toBe('2026-01-02 0304')
  })
})
