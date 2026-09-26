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
 * @file RowBuilderWidget — a `rowBuilder` widget's rows: a read-only table, or, when the
 * widget is editable (`defaultValues.isEditable`) on a screen whose form hosts widgets
 * (a process step), the inline {@link RowBuilderEditor} that writes the rows to the
 * host's `outputFieldName` value.
 */
'use client'

import React from 'react'

import type { QFieldMetaData } from '@/types'
import { RowBuilderEditor, isRowBuilderEditable } from './RowBuilderEditor'
import { useWidgetFormHost } from './widget-form-host'
import { WidgetEmpty, WidgetPayloadNotice } from './WidgetNotice'
import { formatPlainValue } from './record-widget-utils'
import { asList, isPlainObject, payloadProblem } from './widget-types'
import type { WidgetComponentProps } from './widget-types'

/** One row as serialized by `RowBuilderData.records`. */
interface RowRecord {
  values?: Record<string, unknown>
  displayValues?: Record<string, string>
}

/** Payload of the `rowBuilder` widget (`RowBuilderData`). */
export interface RowBuilderPayload {
  type?: string
  records?: RowRecord[]
  hiddenValues?: Record<string, unknown>
  defaultValuesForNewRecords?: Record<string, unknown>
}

/** A column derived from `defaultValues.fields` or the rows themselves. */
interface RowColumn {
  name: string
  label: string
  type?: string
}

/**
 * Columns from the widget's declared fields, else the union of row value keys.
 *
 * @param declared - `defaultValues.fields` from the widget metadata.
 * @param rows - The payload rows.
 * @returns The columns in order.
 */
function columnsFor(declared: unknown, rows: RowRecord[]): RowColumn[] {
  const fields = asList(declared) ?? []
  const fromFields = fields
    .filter((field): field is Record<string, unknown> => isPlainObject(field) && typeof field.name === 'string')
    .map((field) => ({
      name: String(field.name),
      label: typeof field.label === 'string' && field.label ? field.label : String(field.name),
      type: typeof field.type === 'string' ? field.type : undefined,
    }))
  if (fromFields.length > 0) return fromFields
  const names: string[] = []
  for (const row of rows) {
    for (const key of Object.keys(row.values ?? {})) {
      if (!names.includes(key)) names.push(key)
    }
  }
  return names.map((name) => ({ name, label: name }))
}

/**
 * Renders the widget's rows as a table whose columns come from
 * `widgetMetaData.defaultValues.fields`. `0` values are shown; absent values show
 * an em dash.
 *
 * @param props - Widget metadata and payload.
 * @returns The rendered table, the empty message, or a contained notice.
 */
export function RowBuilderWidget({ widgetMetaData, data, onWidgetData }: WidgetComponentProps<RowBuilderPayload>) {
  const widgetName = widgetMetaData.name
  const host = useWidgetFormHost()
  const rows = asList<RowRecord>(data?.records)
  if (rows === undefined || rows.some((row) => !isPlainObject(row) || (row.values !== undefined && !isPlainObject(row.values)))) {
    return <WidgetPayloadNotice widgetName={widgetName} message={payloadProblem('row builder', 'records')} />
  }
  if (host && onWidgetData && isRowBuilderEditable(widgetMetaData)) {
    const declared = asList(widgetMetaData.defaultValues?.frontendFields ?? widgetMetaData.defaultValues?.fields) ?? []
    const fields = declared
      .filter((field): field is Record<string, unknown> => isPlainObject(field) && typeof field.name === 'string')
      .map((field) => ({ isHeavy: false, isHidden: false, adornments: [], isEditable: true, ...field, label: String(field.label || field.name) }) as unknown as QFieldMetaData)
    return <RowBuilderEditor widgetMetaData={widgetMetaData} data={data} fields={fields} host={host} onWidgetData={onWidgetData} />
  }
  if (rows.length === 0) {
    return <WidgetEmpty widgetName={widgetName}>No rows</WidgetEmpty>
  }
  const columns = columnsFor(widgetMetaData.defaultValues?.fields, rows)
  return (
    <div className="overflow-x-auto" data-qqq-id={`widget-rowBuilder-${widgetName}`}>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{widgetMetaData.label}</caption>
        <thead>
          <tr className="border-b border-border">
            {columns.map((column) => (
              <th key={column.name} scope="col" className="px-3 py-2 font-semibold text-foreground">{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-border/50 last:border-0" data-qqq-id={`row-builder-row-${widgetName}-${index}`}>
              {columns.map((column) => {
                const display = row.displayValues?.[column.name]
                const value = display !== undefined && display !== null && display !== '' ? display : row.values?.[column.name]
                return <td key={column.name} className="px-3 py-2 text-foreground">{formatPlainValue(value, column.type)}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
