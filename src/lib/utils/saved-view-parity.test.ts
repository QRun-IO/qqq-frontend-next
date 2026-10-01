/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { describe, expect, it } from 'vitest'

import type { QFilterCriteria, QTableMetaData } from '@/types'
import { emptyFilter } from './filter-utils'
import {
  criteriaToHumanString, diffBasicModeSettings, diffColumns, diffFilters, diffViews,
  fieldFullLabel, findFieldAndTable, reconcileView, type RecordQueryView,
} from './saved-view-utils'

const table = {
  name: 'pet', label: 'Pet', primaryKeyField: 'id', capabilities: ['TABLE_QUERY'],
  fields: {
    id: { name: 'id', label: 'Id', type: 'INTEGER' },
    name: { name: 'name', label: 'Name', type: 'STRING' },
    active: { name: 'active', label: 'Active', type: 'BOOLEAN' },
    receivedDate: { name: 'receivedDate', label: 'Received Date', type: 'DATE' },
  },
  exposedJoins: [{ label: 'Owner', joinTable: {
    name: 'person', label: 'Person', fields: { firstName: { name: 'firstName', label: 'First Name', type: 'STRING' } },
  } }],
} as unknown as QTableMetaData
const condition = (fieldName: string, operator: QFilterCriteria['operator'], values: QFilterCriteria['values']): QFilterCriteria =>
  ({ fieldName, operator, values })
const view = (queryFilter: RecordQueryView['queryFilter'] = {}, extra: Partial<RecordQueryView> = {}): RecordQueryView =>
  ({ queryFilter, ...extra })

describe('saved-view Material parity', () => {
  it('describes joined, date, boolean and unknown criteria for readable change messages', () => {
    expect(fieldFullLabel(table, 'person.firstName')).toBe('Person: First Name')
    expect(findFieldAndTable(table, 'person.firstName')?.tableName).toBe('person')
    expect(fieldFullLabel(table, 'removed')).toBe('removed')
    expect(criteriaToHumanString(table, condition('person.firstName', 'STARTS_WITH', ['A']))).toBe('Person: First Name starts with A')
    expect(criteriaToHumanString(table, condition('receivedDate', 'GREATER_THAN_OR_EQUALS', [{ type: 'Now' }]))).toBe('Received Date is on or after today')
    expect(criteriaToHumanString(table, condition('active', 'EQUALS', [true]))).toBe('Active equals yes')
    expect(criteriaToHumanString(table, condition('name', 'IS_BLANK', []))).toBe('Name is empty')
    expect(criteriaToHumanString(table, condition('removed', 'CONTAINS', ['x']))).toBe('removed contains x')
    expect(criteriaToHumanString(table, condition('name', 'IN', ['a', 'b', 'c', 'd', 'e', 'f']))).toContain('3 other values')
  })

  it('reports changed criteria, nested groups, boolean mode and sort in an existing view', () => {
    const before = view({
      criteria: [condition('name', 'CONTAINS', ['Cat'])], booleanOperator: 'AND',
      orderBys: [{ fieldName: 'name', isAscending: true }],
    })
    const after = view({
      criteria: [condition('name', 'CONTAINS', ['Dog']), condition('id', 'EQUALS', [7])], booleanOperator: 'OR',
      subFilters: [{ ...emptyFilter(), criteria: [condition('active', 'EQUALS', [true])], booleanOperator: 'AND' }],
      orderBys: [{ fieldName: 'id', isAscending: false }],
    })
    const changes: string[] = []
    diffFilters(table, before, after, changes)
    expect(changes).toContain('Added filter: Id equals 7')
    expect(changes).toContain('Changed a filter from Name contains Cat to Name contains Dog')
    expect(changes).toContain("Changed filter from 'And' to 'Or'")
    expect(changes).toContain('Changed the filter groups')
    expect(changes).toContain('Changed sort from Name ascending to Id descending')
  })

  it('reports visibility, pinning, order and width changes separately', () => {
    const before = view({}, { queryColumns: { columns: [
      { name: 'id', isVisible: true, width: 100, pinned: 'left' },
      { name: 'name', isVisible: false, width: 200 },
      { name: 'active', isVisible: true, width: 120 },
    ] } })
    const after = view({}, { queryColumns: { columns: [
      { name: 'name', isVisible: true, width: 180 },
      { name: 'id', isVisible: true, width: 100 },
      { name: 'active', isVisible: false, width: 120 },
    ] } })
    const changes: string[] = []
    diffColumns(table, before, after, changes)
    expect(changes).toContain('Turned on column: Name')
    expect(changes).toContain('Turned off column: Active')
    expect(changes).toContain('Changed pinned state for column: Id')
    expect(changes).toContain('Changed the order of columns.')
    expect(changes).toContain('Changed width for column: Name')
  })

  it('drops removed fields and unsupported boolean operators from old saved views', () => {
    const stale = view({
      criteria: [condition('retired', 'EQUALS', [1]), condition('active', 'GREATER_THAN', [1]), condition('name', 'CONTAINS', ['Dog'])],
      subFilters: [{ ...emptyFilter(), criteria: [condition('oldNested', 'EQUALS', [1])], booleanOperator: 'AND' }],
      orderBys: [{ fieldName: 'oldSort', isAscending: true }],
    }, {
      queryColumns: { columns: [{ name: 'retired', isVisible: true }, { name: 'id', isVisible: true }] },
      quickFilterFieldNames: ['retired', 'name'],
    })
    const repaired = reconcileView(table, stale)
    expect(repaired.view.queryFilter.criteria).toEqual([condition('name', 'CONTAINS', ['Dog'])])
    expect(repaired.view.queryFilter.subFilters?.[0].criteria).toEqual([])
    expect(repaired.view.queryFilter.orderBys).toEqual([{ fieldName: 'id', isAscending: false }])
    expect(repaired.view.queryColumns?.columns.map((c) => c.name)).toEqual(['id'])
    expect(repaired.view.quickFilterFieldNames).toEqual(['name'])
    expect(repaired.warnings.join(' ')).toContain('retired')
    expect(repaired.warnings.join(' ')).toContain('oldNested')
    expect(repaired.warnings.join(' ')).toContain('Active has an unsupported operator')
  })

  it('reports basic filter, mode and page-size changes without losing labels', () => {
    const before = view({ criteria: [condition('name', 'CONTAINS', ['C'])] }, {
      quickFilterFieldNames: ['active', 'name'], mode: 'basic', rowsPerPage: 25,
    })
    const after = view({ criteria: [condition('name', 'CONTAINS', ['C'])] }, {
      quickFilterFieldNames: ['receivedDate', 'name'], mode: 'advanced', rowsPerPage: 50,
    })
    expect(diffBasicModeSettings(table, before, after)).toEqual([
      'Turned on basic filter: Received Date', 'Turned off basic filter: Active', 'Mode changed from basic to advanced',
    ])
    expect(diffViews(table, before, after)).toContain('Rows per page changed from 25 to 50')
  })
})
