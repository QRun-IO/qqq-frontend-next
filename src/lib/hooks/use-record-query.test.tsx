// Tests for useRecordQuery hook

import { describe, it, expect, beforeEach } from 'vitest'
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
      () => useRecordQuery({ tableName: 'person', tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    expect(result.current.pageNum).toBe(1)
    expect(result.current.pageSize).toBe(25)
    expect(result.current.filterMode).toBe('basic')
    expect(result.current.quickSearchTerm).toBe('')
    expect(result.current.columnConfigOpen).toBe(false)
    expect(result.current.filterPanelOpen).toBe(false)
    expect(result.current.rowSelection).toEqual({})
  })

  it('uses custom initialPageSize', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', tableMetaData: makeTableMeta(), initialPageSize: 50 }),
      { wrapper: createWrapper() }
    )
    expect(result.current.pageSize).toBe(50)
  })
})

describe('useRecordQuery — pagination actions', () => {
  it('setPage updates pageNum', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.setPage(3))
    expect(result.current.pageNum).toBe(3)
  })

  it('setPageSize resets to page 1', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.setPage(5))
    act(() => result.current.setPageSize(50))
    expect(result.current.pageNum).toBe(1)
    expect(result.current.pageSize).toBe(50)
  })
})

describe('useRecordQuery — filter actions', () => {
  it('setQuickSearch updates term and resets page', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.setPage(2))
    act(() => result.current.setQuickSearch('Alice'))
    expect(result.current.quickSearchTerm).toBe('Alice')
    expect(result.current.pageNum).toBe(1)
  })

  it('setUserFilter clears quickSearch and resets page', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.setQuickSearch('Alice'))
    act(() => result.current.setPage(3))
    act(() => result.current.setUserFilter({
      criteria: [{ fieldName: 'firstName', operator: 'EQUALS', values: ['Bob'] }],
      orderBys: [],
      subFilters: [],
      booleanOperator: 'AND',
      skip: 0,
      limit: 25,
    }))
    expect(result.current.quickSearchTerm).toBe('')
    expect(result.current.pageNum).toBe(1)
    expect(result.current.userFilter.criteria).toHaveLength(1)
  })

  it('setFilterMode toggles between basic and advanced', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.setFilterMode('advanced'))
    expect(result.current.filterMode).toBe('advanced')
    act(() => result.current.setFilterMode('basic'))
    expect(result.current.filterMode).toBe('basic')
  })

  it('resetFilter clears criteria and quickSearch', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.setQuickSearch('test'))
    act(() => result.current.setPage(3))
    act(() => result.current.resetFilter())
    expect(result.current.quickSearchTerm).toBe('')
    expect(result.current.pageNum).toBe(1)
    expect(result.current.userFilter.criteria).toEqual([])
  })
})

describe('useRecordQuery — sort actions', () => {
  it('setSort updates sortOrder and resets page', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.setPage(2))
    act(() => result.current.setSort([{ fieldName: 'firstName', isAscending: true }]))
    expect(result.current.sortOrder).toEqual([{ fieldName: 'firstName', isAscending: true }])
    expect(result.current.pageNum).toBe(1)
  })
})

describe('useRecordQuery — column actions', () => {
  it('setColumnVisibility updates column visibility map', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.setColumnVisibility({ firstName: false }))
    expect(result.current.columnVisibility.firstName).toBe(false)
  })

  it('toggleColumn flips a column visibility', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.setColumnVisibility({ age: true }))
    act(() => result.current.toggleColumn('age'))
    expect(result.current.columnVisibility.age).toBe(false)
    act(() => result.current.toggleColumn('age'))
    expect(result.current.columnVisibility.age).toBe(true)
  })

  it('setColumnOrder updates column order', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.setColumnOrder(['lastName', 'firstName', 'id']))
    expect(result.current.columnOrder).toEqual(['lastName', 'firstName', 'id'])
  })

  it('setColumnWidth updates width for specific field', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.setColumnWidth('firstName', 200))
    expect(result.current.columnWidths.firstName).toBe(200)
  })

  it('toggleColumnConfig opens and closes the config panel', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    expect(result.current.columnConfigOpen).toBe(false)
    act(() => result.current.toggleColumnConfig())
    expect(result.current.columnConfigOpen).toBe(true)
    act(() => result.current.toggleColumnConfig())
    expect(result.current.columnConfigOpen).toBe(false)
  })

  it('setColumnConfigOpen sets panel state directly', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.setColumnConfigOpen(true))
    expect(result.current.columnConfigOpen).toBe(true)
    act(() => result.current.setColumnConfigOpen(false))
    expect(result.current.columnConfigOpen).toBe(false)
  })

  it('toggleFilterPanel toggles panel state', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.toggleFilterPanel())
    expect(result.current.filterPanelOpen).toBe(true)
  })
})

describe('useRecordQuery — row selection', () => {
  it('setRowSelection updates selection map', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.setRowSelection({ '0': true, '1': false }))
    expect(result.current.rowSelection['0']).toBe(true)
    expect(result.current.rowSelection['1']).toBe(false)
  })

  it('clearRowSelection empties selection', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.setRowSelection({ '0': true, '1': true }))
    act(() => result.current.clearRowSelection())
    expect(result.current.rowSelection).toEqual({})
  })
})

describe('useRecordQuery — saved views', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saveView creates a view and appends it', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => {
      result.current.saveView('My View')
    })

    expect(result.current.savedViews).toHaveLength(1)
    expect(result.current.savedViews[0].name).toBe('My View')
    expect(result.current.savedViews[0].id).toBeDefined()
  })

  it('loadView applies saved view filter and column config', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    const savedView = {
      id: 'view-1',
      name: 'Test View',
      filter: {
        criteria: [{ fieldName: 'firstName', operator: 'EQUALS' as const, values: ['Alice'] }],
        orderBys: [],
        subFilters: [],
        booleanOperator: 'AND' as const,
      },
      columnVisibility: { age: false },
      columnOrder: ['firstName', 'id'],
      sortOrder: [],
      createdAt: new Date().toISOString(),
    }

    act(() => result.current.loadView(savedView))
    expect(result.current.userFilter.criteria).toHaveLength(1)
    expect(result.current.columnVisibility.age).toBe(false)
    expect(result.current.columnOrder).toEqual(['firstName', 'id'])
    expect(result.current.pageNum).toBe(1)
  })

  it('deleteView removes view by id', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    act(() => result.current.saveView('View 1'))
    act(() => result.current.saveView('View 2'))

    const viewToDelete = result.current.savedViews[0]
    act(() => result.current.deleteView(viewToDelete.id))

    expect(result.current.savedViews).toHaveLength(1)
    expect(result.current.savedViews[0].name).toBe('View 2')
  })
})

describe('useRecordQuery — data fetching', () => {
  it('fetches records from MSW when tableMetaData is provided', async () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isError).toBe(false)
    expect(result.current.records).toBeDefined()
    expect(Array.isArray(result.current.records)).toBe(true)
  })

  it('does not fetch when tableMetaData is undefined', () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', tableMetaData: undefined }),
      { wrapper: createWrapper() }
    )
    expect(result.current.isLoading).toBe(false)
    expect(result.current.records).toEqual([])
  })

  it('applies quick search to effective filter for string fields', async () => {
    const { result } = renderHook(
      () => useRecordQuery({ tableName: 'person', tableMetaData: makeTableMeta() }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.setQuickSearch('Alice'))

    // effectiveFilter should use OR across string fields
    expect(result.current.effectiveFilter.booleanOperator).toBe('OR')
    expect(result.current.effectiveFilter.criteria.length).toBeGreaterThan(0)
    // Should filter on firstName and lastName (both STRING)
    const fieldNames = result.current.effectiveFilter.criteria.map((c) => c.fieldName)
    expect(fieldNames).toContain('firstName')
    expect(fieldNames).toContain('lastName')
    // Integer field (age) excluded from quick search
    expect(fieldNames).not.toContain('age')
  })
})
