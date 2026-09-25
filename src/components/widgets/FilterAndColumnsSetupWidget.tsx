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

/**
 * @file FilterAndColumnsSetupWidget — read-only view of a record's saved query
 * filter, sort and column selection (the `filterAndColumnsSetup` widget type,
 * used by saved reports).
 */
'use client'

import React from 'react'

import type { QTableMetaData } from '@/types'
import { useTableMetaData } from '@/lib/hooks/use-metadata'
import { cn } from '@/lib/utils/cn'
import { WidgetPayloadNotice } from './WidgetNotice'
import { formatPlainValue, parseJsonValue, recordValue, resolveFieldLabel } from './record-widget-utils'
import { asList, isPlainObject, payloadProblem } from './widget-types'
import type { WidgetComponentProps } from './widget-types'

/** Payload of the `filterAndColumnsSetup` widget (`FilterAndColumnsSetupData`). */
export interface FilterAndColumnsSetupPayload {
  type?: string
  /** Table the filter applies to; else the record's `tableName` value. */
  tableName?: string
  /** Record field holding the query filter JSON (default `queryFilterJson`). */
  filterFieldName?: string
  /** Record field holding the columns JSON (default `columnsJson`), as served by the backend. */
  columnFieldName?: string
  /** Alternate spelling of {@link columnFieldName}. */
  columnsFieldName?: string
  hideColumns?: boolean
  hidePreview?: boolean
  hideSortBy?: boolean
  allowVariables?: boolean
}

/** A criterion as stored in query filter JSON. */
interface StoredCriterion {
  fieldName?: string
  operator?: string
  values?: unknown[]
  otherFieldName?: string
}

/** A (sub)filter as stored in query filter JSON. */
interface StoredFilter {
  criteria?: unknown
  subFilters?: unknown
  booleanOperator?: string
  orderBys?: unknown
}

/**
 * Human phrase for a criteria operator, matching the Material dashboard wording.
 *
 * @param operator - QQQ `QCriteriaOperator` name.
 * @param fieldType - Field type (dates read "is before"/"is after").
 * @returns The phrase, or the raw operator name when unrecognized.
 */
export function operatorPhrase(operator: string | undefined, fieldType?: string): string {
  const isDate = fieldType === 'DATE'
  const isDateTime = fieldType === 'DATE_TIME'
  switch (operator) {
    case 'EQUALS': return 'equals'
    case 'NOT_EQUALS':
    case 'NOT_EQUALS_OR_IS_NULL': return 'does not equal'
    case 'IN': return 'is any of'
    case 'NOT_IN': return 'is none of'
    case 'STARTS_WITH': return 'starts with'
    case 'ENDS_WITH': return 'ends with'
    case 'CONTAINS': return 'contains'
    case 'NOT_STARTS_WITH': return 'does not start with'
    case 'NOT_ENDS_WITH': return 'does not end with'
    case 'NOT_CONTAINS': return 'does not contain'
    case 'LESS_THAN': return isDate || isDateTime ? 'is before' : 'less than'
    case 'LESS_THAN_OR_EQUALS': return isDate ? 'is on or before' : isDateTime ? 'is at or before' : 'less than or equals'
    case 'GREATER_THAN': return isDate || isDateTime ? 'is after' : 'greater than'
    case 'GREATER_THAN_OR_EQUALS': return isDate ? 'is on or after' : isDateTime ? 'is at or after' : 'greater than or equals'
    case 'IS_BLANK': return 'is empty'
    case 'IS_NOT_BLANK': return 'is not empty'
    case 'BETWEEN': return 'is between'
    case 'NOT_BETWEEN': return 'is not between'
    default: return operator ?? ''
  }
}

/**
 * Lower-case, singular/plural unit word for a `ChronoUnit` name (e.g. DAYS → day).
 *
 * @param unit - Unit name from the expression.
 * @param amount - Amount, selecting singular or plural.
 * @returns The unit word.
 */
function unitWord(unit: unknown, amount: number): string {
  const base = String(unit ?? '').toLowerCase().replace(/s$/, '')
  return amount === 1 ? base : `${base}s`
}

/**
 * Formats one criteria value, including QQQ filter expressions (variables,
 * now, now-with-offset, this/last period).
 *
 * @param value - A stored criteria value.
 * @returns The display string.
 */
export function formatCriterionValue(value: unknown): string {
  if (isPlainObject(value)) {
    const type = String(value.type ?? '')
    if (type === 'FilterVariableExpression' || type === 'FILTER_VARIABLE') return `\${${String(value.variableName ?? '')}}`
    if (type === 'Now' || type === 'NOW') return 'now'
    if (type === 'NowWithOffset') {
      const amount = Number(value.amount ?? 0)
      return `${amount} ${unitWord(value.timeUnit, amount)} ${value.operator === 'PLUS' ? 'from now' : 'ago'}`
    }
    if (type === 'NOW_WITH_OFFSET') {
      const amount = Number(value.offsetValue ?? 0)
      return `${amount} ${unitWord(value.offsetUnit, amount)} ${value.isNegativeOffset ? 'ago' : 'from now'}`
    }
    if (type === 'ThisOrLastPeriod') return `${value.operator === 'LAST' ? 'last' : 'this'} ${unitWord(value.timeUnit, 1)}`
    if (type === 'THIS_OR_LAST_PERIOD') return `${value.isLast ? 'last' : 'this'} ${String(value.period ?? '').toLowerCase()}`
  }
  return formatPlainValue(value)
}

/**
 * Formats the value portion of a criterion for its operator.
 *
 * @param criterion - Stored criterion.
 * @returns The value text (empty for operators without values).
 */
function criterionValues(criterion: StoredCriterion): string {
  const operator = criterion.operator
  if (operator === 'IS_BLANK' || operator === 'IS_NOT_BLANK') return ''
  const values = Array.isArray(criterion.values) ? criterion.values : []
  if (operator === 'BETWEEN' || operator === 'NOT_BETWEEN') {
    return `${formatCriterionValue(values[0])} and ${formatCriterionValue(values[1])}`
  }
  return values.map(formatCriterionValue).join(', ')
}

/**
 * Reads the column entries from any supported columns JSON shape.
 *
 * @param parsed - Parsed columns JSON.
 * @returns The entries in order, or undefined when the shape is not recognized.
 */
function columnEntries(parsed: unknown): Array<{ name: string; isVisible: boolean }> | undefined {
  const list = isPlainObject(parsed) ? asList(parsed.columns) : asList(parsed)
  if (list === undefined) return undefined
  const entries: Array<{ name: string; isVisible: boolean }> = []
  for (const item of list) {
    if (typeof item === 'string') entries.push({ name: item, isVisible: true })
    else if (isPlainObject(item) && typeof item.name === 'string') entries.push({ name: item.name, isVisible: item.isVisible !== false })
    else return undefined
  }
  return entries
}

/**
 * Field label span, flagged when the field is not in the table metadata.
 *
 * @param props - Table metadata, field name, and whether the table metadata loaded.
 * @returns The label span.
 */
function FieldLabelText({ table, fieldName, tableKnown }: { table: QTableMetaData | undefined; fieldName: string; tableKnown: boolean }) {
  const resolved = resolveFieldLabel(table, fieldName)
  const unknown = tableKnown && !resolved.known
  return (
    <span
      className={cn('font-medium text-foreground', unknown && 'text-amber-700 dark:text-amber-300')}
      data-unknown-field={unknown ? 'true' : undefined}
      title={unknown ? `Unknown field: ${fieldName}` : undefined}
    >
      {resolved.label}
    </span>
  )
}

/** Props for the recursive filter list. */
interface FilterListProps {
  filter: StoredFilter
  table: QTableMetaData | undefined
  tableKnown: boolean
  widgetName: string
  path: string
}

/**
 * Renders one (sub)filter's criteria and nested sub-filters.
 *
 * @param props - See {@link FilterListProps}.
 * @returns The criteria list.
 */
function FilterList({ filter, table, tableKnown, widgetName, path }: FilterListProps) {
  const criteria = (asList<StoredCriterion>(filter.criteria) ?? []).filter(isPlainObject) as StoredCriterion[]
  const subFilters = (asList<StoredFilter>(filter.subFilters) ?? []).filter(isPlainObject) as StoredFilter[]
  const isOr = String(filter.booleanOperator ?? 'AND').toUpperCase() === 'OR'
  const itemCount = criteria.length + subFilters.length
  return (
    <div className="space-y-1">
      {itemCount > 1 && (
        <p className="text-xs text-muted-foreground" data-qqq-id={`filter-boolean-operator-${widgetName}-${path}`}>
          {isOr ? 'Match any of:' : 'Match all of:'}
        </p>
      )}
      <ul className="list-disc space-y-1 pl-5 text-sm" data-qqq-id={`filter-criteria-${widgetName}-${path}`}>
        {criteria.map((criterion, index) => {
          const fieldName = String(criterion.fieldName ?? '')
          const type = table?.fields?.[fieldName]?.type
          const values = criterionValues(criterion)
          return (
            <li key={`c-${index}`} data-qqq-id={`filter-criterion-${widgetName}-${path}-${index}`}>
              <FieldLabelText table={table} fieldName={fieldName} tableKnown={tableKnown} />
              {' '}{operatorPhrase(criterion.operator, type)}
              {criterion.otherFieldName ? (
                <>{' '}<FieldLabelText table={table} fieldName={criterion.otherFieldName} tableKnown={tableKnown} /></>
              ) : values ? ` ${values}` : null}
            </li>
          )
        })}
        {subFilters.map((subFilter, index) => (
          <li key={`s-${index}`} data-qqq-id={`filter-subfilter-${widgetName}-${path}-${index}`}>
            <FilterList filter={subFilter} table={table} tableKnown={tableKnown} widgetName={widgetName} path={`${path}.${index}`} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Renders the saved filter, sort and columns of the hosting record.
 *
 * Field names are shown by their labels from the target table's metadata; an
 * unknown field keeps its raw name with a warning style. A value that is not
 * valid JSON, or JSON of the wrong shape, shows a contained notice.
 *
 * @param props - Widget metadata, payload and the hosting record context.
 * @returns The rendered filter/columns summary.
 */
export function FilterAndColumnsSetupWidget({ widgetMetaData, data, recordContext }: WidgetComponentProps<FilterAndColumnsSetupPayload>) {
  const widgetName = widgetMetaData.name
  const filterFieldName = data?.filterFieldName ?? 'queryFilterJson'
  const columnsFieldName = data?.columnFieldName ?? data?.columnsFieldName ?? 'columnsJson'
  const recordTableName = recordValue(recordContext, 'tableName')
  const tableName = data?.tableName ?? (typeof recordTableName === 'string' && recordTableName ? recordTableName : undefined)
  const { data: table, isLoading, isError } = useTableMetaData(tableName)

  const filterJson = parseJsonValue(recordValue(recordContext, filterFieldName))
  const columnsJson = parseJsonValue(recordValue(recordContext, columnsFieldName))
  if (!filterJson.ok || (filterJson.value !== undefined && !isPlainObject(filterJson.value))) {
    return <WidgetPayloadNotice widgetName={widgetName} message={payloadProblem('filter and columns', 'the saved filter is not valid JSON')} />
  }
  const filter = (filterJson.value ?? {}) as StoredFilter
  const criteria = asList(filter.criteria)
  const subFilters = asList(filter.subFilters)
  const orderBys = asList(filter.orderBys)
  const columns = columnsJson.ok ? (columnsJson.value === undefined ? [] : columnEntries(columnsJson.value)) : undefined
  if (criteria === undefined || subFilters === undefined || orderBys === undefined) {
    return <WidgetPayloadNotice widgetName={widgetName} message={payloadProblem('filter and columns', 'the saved filter has an unexpected shape')} />
  }
  if (columns === undefined) {
    return <WidgetPayloadNotice widgetName={widgetName} message={payloadProblem('filter and columns', 'the saved columns are not valid')} />
  }
  if (tableName && isLoading) {
    return (
      <div className="space-y-2 animate-pulse" aria-busy="true" aria-label="Loading filter and columns" data-qqq-id={`widget-filterAndColumnsSetup-${widgetName}`}>
        <div className="h-4 w-1/2 rounded bg-muted" />
        <div className="h-4 w-2/3 rounded bg-muted" />
      </div>
    )
  }

  const tableKnown = Boolean(table)
  const visibleColumns = columns.filter((column) => column.isVisible)
  const sortedBy = (orderBys.filter(isPlainObject) as Array<{ fieldName?: unknown; isAscending?: unknown }>)
    .filter((orderBy) => typeof orderBy.fieldName === 'string')

  return (
    <div className="space-y-4" data-qqq-id={`widget-filterAndColumnsSetup-${widgetName}`}>
      {tableName && isError && (
        <WidgetPayloadNotice widgetName={widgetName} message={`Field labels for ${tableName} could not be loaded.`} />
      )}
      <section aria-labelledby={`filters-heading-${widgetName}`} data-qqq-id={`filter-summary-${widgetName}`}>
        <h4 id={`filters-heading-${widgetName}`} className="mb-1 text-sm font-semibold text-foreground">Filters</h4>
        {criteria.length === 0 && subFilters.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-qqq-id={`filter-none-${widgetName}`}>No filters</p>
        ) : (
          <FilterList filter={filter} table={table} tableKnown={tableKnown} widgetName={widgetName} path="0" />
        )}
        {!data?.hideSortBy && sortedBy.length > 0 && (
          <p className="mt-2 text-sm text-muted-foreground" data-qqq-id={`filter-sort-${widgetName}`}>
            Sorted by{' '}
            {sortedBy.map((orderBy, index) => (
              <React.Fragment key={`${String(orderBy.fieldName)}-${index}`}>
                {index > 0 && ', then '}
                <FieldLabelText table={table} fieldName={String(orderBy.fieldName)} tableKnown={tableKnown} />
                {orderBy.isAscending === false ? ' descending' : ' ascending'}
              </React.Fragment>
            ))}
          </p>
        )}
      </section>
      {!data?.hideColumns && (
        <section aria-labelledby={`columns-heading-${widgetName}`} data-qqq-id={`columns-summary-${widgetName}`}>
          <h4 id={`columns-heading-${widgetName}`} className="mb-1 text-sm font-semibold text-foreground">Columns</h4>
          {visibleColumns.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-qqq-id={`columns-all-${widgetName}`}>All columns</p>
          ) : (
            <ol className="list-decimal space-y-0.5 pl-5 text-sm" data-qqq-id={`report-columns-${widgetName}`}>
              {visibleColumns.map((column, index) => (
                <li key={`${column.name}-${index}`} data-qqq-id={`report-column-${widgetName}-${column.name}`}>
                  <FieldLabelText table={table} fieldName={column.name} tableKnown={tableKnown} />
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  )
}
