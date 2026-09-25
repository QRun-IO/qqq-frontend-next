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

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/hooks/use-metadata', () => ({ useTableMetaData: vi.fn() }))

import type { QRecord, QTableMetaData, QWidgetMetaData } from '@/types'
import { useTableMetaData } from '@/lib/hooks/use-metadata'
import { FilterAndColumnsSetupWidget, formatCriterionValue, operatorPhrase } from './FilterAndColumnsSetupWidget'

const tableMetaData = vi.mocked(useTableMetaData)

/** Minimal table metadata with labelled fields. */
function table(name: string, fields: Record<string, [string, string]>): QTableMetaData {
  return {
    name,
    label: name,
    fields: Object.fromEntries(Object.entries(fields).map(([field, [label, type]]) => [field, { name: field, label, type }])),
  } as unknown as QTableMetaData
}

const petSpecies = table('petSpecies', { possibleValueId: ['ID', 'INTEGER'], possibleValueLabel: ['Species', 'STRING'] })
const person = table('person', {
  id: ['Id', 'INTEGER'], firstName: ['First Name', 'STRING'], lastName: ['Last Name', 'STRING'],
  email: ['Email', 'STRING'], birthDate: ['Birth Date', 'DATE'],
})

/** The real payload served by `reportSetupWidget`. */
const payload = {
  allowVariables: true, hideColumns: false, hidePreview: false, hideSortBy: false, isApiVersioned: false,
  filterFieldName: 'queryFilterJson', columnFieldName: 'columnsJson', type: 'filterAndColumnsSetup',
}
const meta = { name: 'reportSetupWidget', label: 'Filters and Columns', hasPermission: true } as QWidgetMetaData

/** A saved report record carrying the given JSON values. */
function savedReport(values: Record<string, unknown>): QRecord {
  return { tableName: 'savedReport', values: { id: 1, label: 'Report', ...values } }
}

function mockTable(value: QTableMetaData | undefined, state: { isLoading?: boolean; isError?: boolean } = {}) {
  tableMetaData.mockReturnValue({ data: value, isLoading: state.isLoading ?? false, isError: state.isError ?? false } as unknown as ReturnType<typeof useTableMetaData>)
}

describe('FilterAndColumnsSetupWidget', () => {
  beforeEach(() => {
    tableMetaData.mockReset()
  })

  it('shows the sample saved report: no filters and its columns by label, in order', () => {
    mockTable(petSpecies)
    const record = savedReport({
      tableName: 'petSpecies',
      queryFilterJson: '{}',
      columnsJson: '{"columns":[{"name":"possibleValueId","isVisible":true,"width":140},{"name":"possibleValueLabel","isVisible":true,"width":220}]}',
    })
    const { container } = render(<FilterAndColumnsSetupWidget widgetMetaData={meta} data={payload} recordContext={{ tableName: 'savedReport', record }} />)
    expect(tableMetaData).toHaveBeenCalledWith('petSpecies')
    expect(screen.getByText('No filters')).toBeInTheDocument()
    const columns = container.querySelectorAll('[data-qqq-id="report-columns-reportSetupWidget"] li')
    expect(Array.from(columns).map((li) => li.textContent)).toEqual(['ID', 'Species'])
    expect(container.querySelector('[data-qqq-id="filter-sort-reportSetupWidget"]')).toBeNull()
  })

  it('describes criteria, the boolean operator, sub-filters and sort with field labels', () => {
    mockTable(person)
    const filter = {
      booleanOperator: 'OR',
      criteria: [
        { fieldName: 'firstName', operator: 'EQUALS', values: ['Avery'] },
        { fieldName: 'birthDate', operator: 'BETWEEN', values: ['1990-01-01', '1991-12-31'] },
        { fieldName: 'email', operator: 'IS_BLANK', values: [] },
        { fieldName: 'id', operator: 'IN', values: [1, 2, 0] },
      ],
      subFilters: [{ booleanOperator: 'AND', criteria: [{ fieldName: 'lastName', operator: 'STARTS_WITH', values: [{ type: 'FilterVariableExpression', variableName: 'prefix' }] }] }],
      orderBys: [{ fieldName: 'lastName', isAscending: false }, { fieldName: 'id', isAscending: true }],
    }
    const record = savedReport({ tableName: 'person', queryFilterJson: JSON.stringify(filter), columnsJson: '{"columns":[{"name":"firstName"},{"name":"email","isVisible":false}]}' })
    const { container } = render(<FilterAndColumnsSetupWidget widgetMetaData={meta} data={payload} recordContext={{ tableName: 'savedReport', record }} />)
    const text = (id: string) => container.querySelector(`[data-qqq-id="${id}"]`)?.textContent
    expect(text('filter-boolean-operator-reportSetupWidget-0')).toBe('Match any of:')
    expect(text('filter-criterion-reportSetupWidget-0-0')).toBe('First Name equals Avery')
    expect(text('filter-criterion-reportSetupWidget-0-1')).toBe('Birth Date is between 1990-01-01 and 1991-12-31')
    expect(text('filter-criterion-reportSetupWidget-0-2')).toBe('Email is empty')
    expect(text('filter-criterion-reportSetupWidget-0-3')).toBe('Id is any of 1, 2, 0')
    expect(text('filter-criterion-reportSetupWidget-0.0-0')).toBe('Last Name starts with ${prefix}')
    expect(text('filter-sort-reportSetupWidget')).toBe('Sorted by Last Name descending, then Id ascending')
    expect(Array.from(container.querySelectorAll('[data-qqq-id="report-columns-reportSetupWidget"] li')).map((li) => li.textContent)).toEqual(['First Name'])
  })

  it('keeps an unknown field name, flagged, without crashing', () => {
    mockTable(person)
    const record = savedReport({ tableName: 'person', queryFilterJson: '{"criteria":[{"fieldName":"retiredField","operator":"CONTAINS","values":["x"]}]}' })
    render(<FilterAndColumnsSetupWidget widgetMetaData={meta} data={payload} recordContext={{ tableName: 'savedReport', record }} />)
    const unknown = screen.getByText('retiredField')
    expect(unknown).toHaveAttribute('data-unknown-field', 'true')
    expect(unknown.parentElement?.textContent).toBe('retiredField contains x')
  })

  it('shows all columns when none are saved and supports the legacy name list', () => {
    mockTable(person)
    const { container, rerender } = render(<FilterAndColumnsSetupWidget widgetMetaData={meta} data={payload} recordContext={{ tableName: 'savedReport', record: savedReport({ tableName: 'person' }) }} />)
    expect(screen.getByText('All columns')).toBeInTheDocument()
    rerender(<FilterAndColumnsSetupWidget widgetMetaData={meta} data={payload} recordContext={{ tableName: 'savedReport', record: savedReport({ tableName: 'person', columnsJson: '["lastName","id"]' }) }} />)
    expect(Array.from(container.querySelectorAll('[data-qqq-id="report-columns-reportSetupWidget"] li')).map((li) => li.textContent)).toEqual(['Last Name', 'Id'])
  })

  it('honors hideColumns and hideSortBy', () => {
    mockTable(person)
    const record = savedReport({ tableName: 'person', queryFilterJson: '{"orderBys":[{"fieldName":"id","isAscending":true}]}', columnsJson: '["id"]' })
    const { container } = render(<FilterAndColumnsSetupWidget widgetMetaData={meta} data={{ ...payload, hideColumns: true, hideSortBy: true }} recordContext={{ tableName: 'savedReport', record }} />)
    expect(container.querySelector('[data-qqq-id="columns-summary-reportSetupWidget"]')).toBeNull()
    expect(container.querySelector('[data-qqq-id="filter-sort-reportSetupWidget"]')).toBeNull()
  })

  it('shows a contained notice for a saved filter that is not JSON or has the wrong shape', () => {
    mockTable(person)
    const { rerender } = render(<FilterAndColumnsSetupWidget widgetMetaData={meta} data={payload} recordContext={{ tableName: 'savedReport', record: savedReport({ tableName: 'person', queryFilterJson: '{not json' }) }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('the saved filter is not valid JSON')
    rerender(<FilterAndColumnsSetupWidget widgetMetaData={meta} data={payload} recordContext={{ tableName: 'savedReport', record: savedReport({ tableName: 'person', queryFilterJson: '{"criteria":{"invalidShape":true}}' }) }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('unexpected shape')
    rerender(<FilterAndColumnsSetupWidget widgetMetaData={meta} data={payload} recordContext={{ tableName: 'savedReport', record: savedReport({ tableName: 'person', columnsJson: '{"columns":{"invalidShape":true}}' }) }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('the saved columns are not valid')
  })

  it('shows a loading placeholder while the target table metadata loads', () => {
    mockTable(undefined, { isLoading: true })
    render(<FilterAndColumnsSetupWidget widgetMetaData={meta} data={payload} recordContext={{ tableName: 'savedReport', record: savedReport({ tableName: 'person' }) }} />)
    expect(screen.getByLabelText('Loading filter and columns')).toBeInTheDocument()
  })
})

describe('operatorPhrase / formatCriterionValue', () => {
  it('matches the Material wording, including date variants', () => {
    expect(operatorPhrase('NOT_EQUALS_OR_IS_NULL')).toBe('does not equal')
    expect(operatorPhrase('NOT_IN')).toBe('is none of')
    expect(operatorPhrase('GREATER_THAN')).toBe('greater than')
    expect(operatorPhrase('GREATER_THAN', 'DATE')).toBe('is after')
    expect(operatorPhrase('LESS_THAN_OR_EQUALS', 'DATE_TIME')).toBe('is at or before')
    expect(operatorPhrase('IS_NOT_BLANK')).toBe('is not empty')
    expect(operatorPhrase('NOT_BETWEEN')).toBe('is not between')
    expect(operatorPhrase('SOMETHING_NEW')).toBe('SOMETHING_NEW')
  })

  it('formats filter expressions', () => {
    expect(formatCriterionValue({ type: 'Now' })).toBe('now')
    expect(formatCriterionValue({ type: 'NowWithOffset', operator: 'MINUS', amount: 3, timeUnit: 'DAYS' })).toBe('3 days ago')
    expect(formatCriterionValue({ type: 'NowWithOffset', operator: 'PLUS', amount: 1, timeUnit: 'WEEKS' })).toBe('1 week from now')
    expect(formatCriterionValue({ type: 'ThisOrLastPeriod', operator: 'LAST', timeUnit: 'MONTHS' })).toBe('last month')
    expect(formatCriterionValue(0)).toBe('0')
    expect(formatCriterionValue(false)).toBe('false')
  })
})
