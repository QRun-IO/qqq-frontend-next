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

// Tests for useRecordQuery hook

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useRecordQuery } from './use-record-query'
import type { QTableMetaData } from '@/types'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

function makeTableMeta(overrides: Partial<QTableMetaData> = {}): QTableMetaData {
  return {
    name: 'person',
    label: 'People',
    isHidden: false,
    primaryKeyField: 'id',
    fields: {
      id: { name: 'id', label: 'ID', type: 'INTEGER', isRequired: true, isEditable: false, isHeavy: false, isHidden: false, adornments: [] },
      firstName: { name: 'firstName', label: 'First Name', type: 'STRING', isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [] },
      lastName: { name: 'lastName', label: 'Last Name', type: 'STRING', isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [] },
      age: { name: 'age', label: 'Age', type: 'INTEGER', isRequired: false, isEditable: true, isHeavy: false, isHidden: false, adornments: [] },
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

describe('useRecordQuery — initialization', () => {
  it('initializes with default state', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    expect(result.current.pagination.pageNum).toBe(1)
    expect(result.current.pagination.pageSize).toBe(25)
    expect(result.current.filter.filterMode).toBe('basic')
    expect(result.current.filter.quickSearchTerm).toBe('')
    expect(result.current.columns.columnConfigOpen).toBe(false)
    expect(result.current.filter.filterPanelOpen).toBe(false)
    expect(result.current.selection.rowSelection).toEqual({})
  })

  it('uses custom initialPageSize', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta(), initialPageSize: 50 }),
      { wrapper: createWrapper() }
    )
    expect(result.current.pagination.pageSize).toBe(50)
  })
})

describe('useRecordQuery — pagination actions', () => {
  it('setPage updates pageNum', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.pagination.setPage(3))
    expect(result.current.pagination.pageNum).toBe(3)
  })

  it('setPageSize resets to page 1', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.pagination.setPage(5))
    act(() => result.current.pagination.setPageSize(50))
    expect(result.current.pagination.pageNum).toBe(1)
    expect(result.current.pagination.pageSize).toBe(50)
  })
})

describe('useRecordQuery — URL sync', () => {
  it('writes view state to the URL through history rather than a router navigation', async () => {
    // Regression (#12): router.replace refetched the RSC payload, and a document navigation that
    // cut the fetch off made Next load the stale URL over the page the user asked for
    const replaceState = vi.spyOn(window.history, 'replaceState')
    try {
      const { result } = renderHook(
        () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta() }),
        { wrapper: createWrapper() }
      )

      act(() => result.current.pagination.setPageSize(50))
      await waitFor(() => expect(replaceState).toHaveBeenCalledWith(null, '', '/?pageSize=50'))
    } finally {
      replaceState.mockRestore()
    }
  })
})

describe('useRecordQuery — filter actions', () => {
  it('setQuickSearch updates term and resets page', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.pagination.setPage(2))
    act(() => result.current.filter.setQuickSearch('Alice'))
    expect(result.current.filter.quickSearchTerm).toBe('Alice')
    expect(result.current.pagination.pageNum).toBe(1)
  })

  it('setUserFilter keeps the quick search (they combine) and resets page', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.filter.setQuickSearch('Alice'))
    act(() => result.current.pagination.setPage(3))
    act(() => result.current.filter.setUserFilter({
      criteria: [{ fieldName: 'firstName', operator: 'EQUALS', values: ['Bob'] }],
      orderBys: [],
      subFilters: [],
      booleanOperator: 'AND',
      skip: 0,
      limit: 25,
    }))
    expect(result.current.filter.quickSearchTerm).toBe('Alice')
    expect(result.current.pagination.pageNum).toBe(1)
    expect(result.current.filter.userFilter.criteria).toHaveLength(1)
    // Regression (#649): the quick search is ANDed with the advanced filter, not a replacement
    const combined = result.current.filter.effectiveFilter
    expect(combined.booleanOperator).toBe('AND')
    expect(combined.subFilters?.[0].criteria).toEqual([{ fieldName: 'firstName', operator: 'EQUALS', values: ['Bob'] }])
    expect(combined.subFilters?.[1].booleanOperator).toBe('OR')
  })

  it('setFilterMode toggles between basic and advanced', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.filter.setFilterMode('advanced'))
    expect(result.current.filter.filterMode).toBe('advanced')
    act(() => result.current.filter.setFilterMode('basic'))
    expect(result.current.filter.filterMode).toBe('basic')
  })

  it('resetFilter clears criteria and quickSearch', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.filter.setQuickSearch('test'))
    act(() => result.current.pagination.setPage(3))
    act(() => result.current.filter.resetFilter())
    expect(result.current.filter.quickSearchTerm).toBe('')
    expect(result.current.pagination.pageNum).toBe(1)
    expect(result.current.filter.userFilter.criteria).toEqual([])
  })
})

describe('useRecordQuery — sort actions', () => {
  it('setSort updates sortOrder and resets page', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.pagination.setPage(2))
    act(() => result.current.filter.setSort([{ fieldName: 'firstName', isAscending: true }]))
    expect(result.current.filter.sortOrder).toEqual([{ fieldName: 'firstName', isAscending: true }])
    expect(result.current.pagination.pageNum).toBe(1)
  })
})

describe('useRecordQuery — column actions', () => {
  it('setColumnVisibility updates column visibility map', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.columns.setColumnVisibility({ firstName: false }))
    expect(result.current.columns.columnVisibility.firstName).toBe(false)
  })

  it('toggleColumn flips a column visibility', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.columns.setColumnVisibility({ age: true }))
    act(() => result.current.columns.toggleColumn('age'))
    expect(result.current.columns.columnVisibility.age).toBe(false)
    act(() => result.current.columns.toggleColumn('age'))
    expect(result.current.columns.columnVisibility.age).toBe(true)
  })

  it('setColumnOrder updates column order', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.columns.setColumnOrder(['lastName', 'firstName', 'id']))
    expect(result.current.columns.columnOrder).toEqual(['lastName', 'firstName', 'id'])
  })

  it('setColumnWidth updates width for specific field', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.columns.setColumnWidth('firstName', 200))
    expect(result.current.columns.columnWidths.firstName).toBe(200)
  })

  it('toggleColumnConfig opens and closes the config panel', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    expect(result.current.columns.columnConfigOpen).toBe(false)
    act(() => result.current.columns.toggleColumnConfig())
    expect(result.current.columns.columnConfigOpen).toBe(true)
    act(() => result.current.columns.toggleColumnConfig())
    expect(result.current.columns.columnConfigOpen).toBe(false)
  })

  it('setColumnConfigOpen sets panel state directly', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.columns.setColumnConfigOpen(true))
    expect(result.current.columns.columnConfigOpen).toBe(true)
    act(() => result.current.columns.setColumnConfigOpen(false))
    expect(result.current.columns.columnConfigOpen).toBe(false)
  })

  it('toggleFilterPanel toggles panel state', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.filter.toggleFilterPanel())
    expect(result.current.filter.filterPanelOpen).toBe(true)
  })
})

describe('useRecordQuery — row selection', () => {
  it('setRowSelection updates selection map keyed by primary-key strings', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    // Keys must be PK values (e.g. '42', '99'), not array indices
    act(() => result.current.selection.setRowSelection({ '42': true, '99': false }))
    expect(result.current.selection.rowSelection['42']).toBe(true)
    expect(result.current.selection.rowSelection['99']).toBe(false)
  })

  it('selectedRecordIds derives numeric PK values from rowSelection keys', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    // Simulate DataGrid/RecordCardView writing PK strings into rowSelection
    act(() => result.current.selection.setRowSelection({ '42': true, '99': true, '7': false }))
    // Numeric-looking PK strings are converted to numbers for backend compatibility
    expect(result.current.selection.selectedRecordIds).toEqual([42, 99])
    expect(result.current.selection.selectedRecordIds).not.toContain(7)
  })

  it('clearRowSelection empties selection', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.selection.setRowSelection({ '42': true, '99': true }))
    act(() => result.current.selection.clearRowSelection())
    expect(result.current.selection.rowSelection).toEqual({})
    expect(result.current.selection.selectedRecordIds).toEqual([])
  })
})

describe('useRecordQuery — selection modes and joins', () => {
  it('describes an all-matching selection as the query filter without paging', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta({ capabilities: ['TABLE_QUERY', 'TABLE_COUNT'] }) }),
      { wrapper: createWrapper() }
    )
    act(() => result.current.pagination.setPage(3))
    act(() => result.current.selection.setSelectionMode('all'))
    const filter = result.current.selection.selectionFilter
    expect(filter?.skip).toBe(0)
    expect(filter && 'limit' in filter && filter.limit !== undefined).toBe(false)
    act(() => result.current.selection.setSelectionMode('subset', 7))
    expect(result.current.selection.selectionFilter?.limit).toBe(7)
    act(() => result.current.selection.clearRowSelection())
    expect(result.current.selection.selectionFilter).toBeNull()
  })

  it('dedupes repeated primary keys from many-side joins', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )
    act(() => result.current.selection.setRowSelection({ '1': true, '1#1': true, '2': true }))
    expect(result.current.selection.selectedRecordIds).toEqual([1, 2])
  })

  it('joins an exposed table only when a visible column, criterion or sort uses it', () => {
    const table = makeTableMeta({
      exposedJoins: [{ label: 'Pet', isMany: true, joinTable: { name: 'pet', label: 'Pet', readPermission: true, fields: {} } as unknown as QTableMetaData, joinPath: [{ name: 'personJoinPet', type: 'ONE_TO_MANY', leftTable: 'person', rightTable: 'pet' }] }],
    })
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: { pet: table }, tableMetaData: table }),
      { wrapper: createWrapper() }
    )
    expect(result.current.joins).toBeUndefined()
    act(() => result.current.columns.setColumnVisibility({ 'pet.name': true }))
    expect(result.current.joins).toEqual([{ joinTable: 'pet', select: true, type: 'LEFT', joinName: 'personJoinPet' }])
  })

  it('defaults the sort to the primary key descending (Material)', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )
    expect(result.current.filter.sortOrder).toEqual([{ fieldName: 'id', isAscending: false }])
    act(() => result.current.filter.setSort([]))
    expect(result.current.filter.sortOrder).toEqual([{ fieldName: 'id', isAscending: false }])
  })

  it('does not count when the table lacks TABLE_COUNT', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta({ capabilities: ['TABLE_QUERY'] }) }),
      { wrapper: createWrapper() }
    )
    expect(result.current.data.canCount).toBe(false)
    expect(result.current.pagination.totalCount).toBeNull()
  })

  it('waits for a variant on tables whose backend uses variants', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta({ usesVariants: true, variantTableLabel: 'Store' }) }),
      { wrapper: createWrapper() }
    )
    expect(result.current.data.needsVariant).toBe(true)
    expect(result.current.data.isLoading).toBe(false)
  })
})

describe('useRecordQuery — data fetching', () => {
  it('fetches records from MSW when tableMetaData is provided', async () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.data.isLoading).toBe(false))
    expect(result.current.data.isError).toBe(false)
    expect(result.current.data.records.length).toBeGreaterThan(0)
  })

  it('does not fetch when tableMetaData is undefined', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: undefined }),
      { wrapper: createWrapper() }
    )
    expect(result.current.data.isLoading).toBe(false)
    expect(result.current.data.records).toEqual([])
  })

  it('applies quick search to effective filter for string fields', async () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', allTables: {}, tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.data.isLoading).toBe(false))

    act(() => result.current.filter.setQuickSearch('Alice'))

    // with no advanced filter, the quick search is an OR across string fields
    expect(result.current.filter.effectiveFilter.booleanOperator).toBe('OR')
    expect(result.current.filter.effectiveFilter.criteria.length).toBeGreaterThan(0)
    // Should filter on firstName and lastName (both STRING)
    const fieldNames = result.current.filter.effectiveFilter.criteria.map((c) => c.fieldName)
    expect(fieldNames).toContain('firstName')
    expect(fieldNames).toContain('lastName')
    // Integer field (age) excluded from quick search
    expect(fieldNames).not.toContain('age')
  })
})
