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
 * @file PivotTableSetupWidget — read-only view of a record's pivot table
 * definition (the `pivotTableSetup` widget type, used by saved reports).
 */
'use client'

import React from 'react'

import { useTableMetaData } from '@/lib/hooks/use-metadata'
import { WidgetPayloadNotice } from './WidgetNotice'
import { parseJsonValue, recordValue, resolveFieldLabel } from './record-widget-utils'
import { asList, isPlainObject, payloadProblem } from './widget-types'
import type { WidgetComponentProps } from './widget-types'

/** Payload of the `pivotTableSetup` widget (the default widget renderer's echo). */
export interface PivotTableSetupPayload {
  type?: string
  queryParams?: Record<string, string>
}

/** Labels for `PivotTableFunction` values, matching the Material dashboard. */
export const PIVOT_FUNCTION_LABELS: Record<string, string> = {
  SUM: 'Sum',
  COUNT: 'Count',
  COUNT_NUMS: 'Count Numbers',
  AVERAGE: 'Average',
  MAX: 'Max',
  MIN: 'Min',
  PRODUCT: 'Product',
  STD_DEV: 'StdDev',
  STD_DEVP: 'StdDevp',
  VAR: 'Var',
  VARP: 'Varp',
}

/** Record field holding the pivot table definition JSON. */
const PIVOT_FIELD_NAME = 'pivotTableJson'

/**
 * Reads `{fieldName}` entries from a pivot definition list.
 *
 * @param value - A rows/columns/values list from the definition.
 * @returns The entries, or undefined when malformed.
 */
function groupBys(value: unknown): Array<{ fieldName: string; function?: string }> | undefined {
  const list = asList(value)
  if (list === undefined) return undefined
  const entries: Array<{ fieldName: string; function?: string }> = []
  for (const item of list) {
    if (!isPlainObject(item) || typeof item.fieldName !== 'string') return undefined
    entries.push({ fieldName: item.fieldName, function: typeof item.function === 'string' ? item.function : undefined })
  }
  return entries
}

/**
 * Renders the rows, columns and values of the hosting record's pivot table.
 *
 * @param props - Widget metadata and the hosting record context.
 * @returns The rendered pivot summary, the no-pivot message, or a contained notice.
 */
export function PivotTableSetupWidget({ widgetMetaData, recordContext }: WidgetComponentProps<PivotTableSetupPayload>) {
  const widgetName = widgetMetaData.name
  const recordTableName = recordValue(recordContext, 'tableName')
  const tableName = typeof recordTableName === 'string' && recordTableName ? recordTableName : undefined
  const { data: table, isLoading } = useTableMetaData(tableName)
  const parsed = parseJsonValue(recordValue(recordContext, PIVOT_FIELD_NAME))

  if (!parsed.ok || (parsed.value !== undefined && !isPlainObject(parsed.value))) {
    return <WidgetPayloadNotice widgetName={widgetName} message={payloadProblem('pivot table', 'the pivot table definition is not valid JSON')} />
  }
  const definition = (parsed.value ?? {}) as Record<string, unknown>
  const rows = groupBys(definition.rows)
  const columns = groupBys(definition.columns)
  const values = groupBys(definition.values)
  if (rows === undefined || columns === undefined || values === undefined) {
    return <WidgetPayloadNotice widgetName={widgetName} message={payloadProblem('pivot table', 'the pivot table definition has an unexpected shape')} />
  }
  if (rows.length === 0 && columns.length === 0 && values.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-qqq-id={`widget-pivotTableSetup-${widgetName}`}>
        This report does not use a pivot table.
      </p>
    )
  }
  if (tableName && isLoading) {
    return <div className="h-12 animate-pulse rounded bg-muted" aria-busy="true" aria-label="Loading pivot table" data-qqq-id={`widget-pivotTableSetup-${widgetName}`} />
  }

  const label = (fieldName: string) => resolveFieldLabel(table, fieldName).label
  const part = (title: string, key: string, items: string[]) => (
    <div key={key}>
      <dt className="text-sm font-semibold text-foreground">{title}</dt>
      <dd className="mt-0.5 text-sm">
        {items.length === 0 ? (
          <span className="text-muted-foreground" data-qqq-id={`pivot-${key}-${widgetName}`}>None</span>
        ) : (
          <ul className="flex flex-wrap gap-1.5" data-qqq-id={`pivot-${key}-${widgetName}`}>
            {items.map((item, index) => (
              <li key={`${item}-${index}`} className="rounded-lg border border-border px-2 py-0.5">{item}</li>
            ))}
          </ul>
        )}
      </dd>
    </div>
  )

  return (
    <dl className="space-y-3" data-qqq-id={`widget-pivotTableSetup-${widgetName}`}>
      {part('Rows', 'rows', rows.map((row) => label(row.fieldName)))}
      {part('Columns', 'columns', columns.map((column) => label(column.fieldName)))}
      {part('Values', 'values', values.map((value) => `${PIVOT_FUNCTION_LABELS[value.function ?? ''] ?? value.function ?? ''} of ${label(value.fieldName)}`.trim()))}
    </dl>
  )
}
