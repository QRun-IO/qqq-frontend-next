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
 * @file RowBuilderTable — the read-only rows of a `rowBuilder` widget (Material
 * `RowBuilderWidget` `RenderRowsView`): a column per shown field, "No rows" when empty.
 */
'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'

import type { QFieldMetaData } from '@/types'
import { fetchPossibleValues } from '@/lib/api/possible-values'
import { formatDateTime } from '@/lib/utils/datetime-utils'

import { formatPlainValue } from './record-widget-utils'
import type { BuilderRow } from './row-builder-model'

/** Props for {@link RowBuilderTable}. */
export interface RowBuilderTableProps {
  /** Widget name, for `data-qqq-id`s. */
  widgetName: string
  /** Table caption (the widget label), for screen readers. */
  caption: string
  /** Row fields; hidden ones get no column. */
  fields: QFieldMetaData[]
  /** The rows. */
  rows: BuilderRow[]
}

/**
 * The label of a chosen possible value whose display value is not known (a row edited in
 * the modal), looked up from the field's possible-value source.
 *
 * @param props - Component properties.
 * @returns The label, or the value while it loads or when it is not found.
 */
function PossibleValueLabel({ sourceName, value }: { sourceName: string; value: unknown }) {
  const id = String(value)
  const { data } = useQuery({
    queryKey: ['qqq', 'rowBuilderPossibleValueLabel', sourceName, id],
    queryFn: () => fetchPossibleValues(sourceName, { ids: id }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  return <>{data?.find((option) => String(option.id) === id)?.label ?? id}</>
}

/**
 * One cell: the backend display value, else the chosen possible value's label, else the
 * value formatted for its type.
 *
 * @param field - The column's field.
 * @param row - The row.
 * @returns The cell content.
 */
function cellContent(field: QFieldMetaData, row: BuilderRow): React.ReactNode {
  const display = row.displayValues[field.name]
  if (display !== undefined && display !== '') return display
  const value = row.values[field.name]
  if (value === undefined || value === null || value === '') return formatPlainValue(value, field.type)
  const inline = field.inlinePossibleValueSource?.enumValues?.find((option) => String(option.id) === String(value))
  if (inline) return inline.label
  if (field.possibleValueSourceName) return <PossibleValueLabel sourceName={field.possibleValueSourceName} value={value} />
  if (field.type === 'DATE_TIME') return formatDateTime(value) ?? formatPlainValue(value, field.type)
  return formatPlainValue(value, field.type)
}

/**
 * Renders rows read-only. `0` values are shown; absent values show an em dash.
 *
 * @param props - See {@link RowBuilderTableProps}.
 * @returns The table.
 */
export function RowBuilderTable({ widgetName, caption, fields, rows }: RowBuilderTableProps) {
  const columns = fields.filter((field) => !field.isHidden)
  return (
    <div className="overflow-x-auto" data-qqq-id={`row-builder-table-${widgetName}`}>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border">
            {columns.map((column) => (
              <th key={column.name} scope="col" className="px-3 py-2 font-semibold text-foreground">{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? (
              <tr>
                <td colSpan={Math.max(columns.length, 1)} className="px-3 py-4 text-center text-muted-foreground" data-qqq-id={`widget-empty-${widgetName}`}>No rows</td>
              </tr>
            )
            : rows.map((row, index) => (
              <tr key={row.key} className="border-b border-border/50 last:border-0" data-qqq-id={`row-builder-row-${widgetName}-${index}`}>
                {columns.map((column) => <td key={column.name} className="px-3 py-2 text-foreground">{cellContent(column, row)}</td>)}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}
