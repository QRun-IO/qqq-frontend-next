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
 * @file RowBuilderEditor — the inline editor of an editable `rowBuilder` widget on a screen
 * whose form hosts widgets (a process step), as Material's RowBuilderWidget: each row's
 * fields (`<field>_<rowIndex>`) join the host's form, so they are validated with it; rows
 * can be added (with `defaultValuesForNewRecords`) and removed; after every change the rows
 * go to the host as `{ [outputFieldName]: json }` (`outputFieldName` defaults to `records`),
 * each row carrying its stable `_qRowIndex`.
 */
'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useWatch } from 'react-hook-form'
import { Plus, X } from 'lucide-react'

import type { QFieldMetaData, QWidgetMetaData } from '@/types'
import { DynamicFormField } from '@/components/forms/DynamicFormField'
import type { WidgetFormHost } from './widget-form-host'
import type { WidgetDataCallback } from './widget-types'
import { asList, isPlainObject } from './widget-types'

/** The key of a row's stable index in the rows handed to the host (Material `ROW_INDEX_KEY`). */
export const ROW_INDEX_KEY = '_qRowIndex'

/** One row as serialized by `RowBuilderData.records`. */
interface RowRecord {
  values?: Record<string, unknown>
}

/** Props for {@link RowBuilderEditor}. */
export interface RowBuilderEditorProps {
  widgetMetaData: QWidgetMetaData
  /** The widget payload (`records`, `defaultValuesForNewRecords`). */
  data: { records?: RowRecord[]; defaultValuesForNewRecords?: Record<string, unknown> }
  /** The editable fields of a row. */
  fields: QFieldMetaData[]
  host: WidgetFormHost
  onWidgetData: WidgetDataCallback
}

/**
 * A row field's name in the host form (Material `makeFullName`).
 * @param fieldName - The row field.
 * @param rowIndex - The row's stable index.
 * @returns The form field name.
 */
function cellName(fieldName: string, rowIndex: number): string {
  return `${fieldName}_${rowIndex}`
}

/**
 * Whether a rowBuilder widget is edited inline on a host screen: `defaultValues.isEditable`,
 * unless the widget is only editable on record edit screens (`isForRecordViewAndEditScreen`).
 * @param widgetMetaData - The widget.
 * @returns `true` when the rows are edited in the host's form.
 */
export function isRowBuilderEditable(widgetMetaData: QWidgetMetaData): boolean {
  const defaults = widgetMetaData.defaultValues ?? {}
  if (String(defaults.isForRecordViewAndEditScreen) === 'true') return false
  return String(defaults.isEditable) === 'true' && String(defaults.useModalEditor) !== 'true'
}

/**
 * The inline row editor.
 * @param props - {@link RowBuilderEditorProps}
 * @returns The rows' fields with Remove Row buttons, and Add new.
 */
export function RowBuilderEditor({ widgetMetaData, data, fields, host, onWidgetData }: RowBuilderEditorProps) {
  const widgetName = widgetMetaData.name
  const outputFieldName = String(widgetMetaData.defaultValues?.outputFieldName ?? 'records')
  const { form, registerFields } = host
  const initial = useMemo(() => (asList<RowRecord>(data.records) ?? []).map((record, index) => {
    const values = isPlainObject(record?.values) ? record.values : {}
    const rowIndex = Number.isInteger(Number(values[ROW_INDEX_KEY])) && values[ROW_INDEX_KEY] !== undefined ? Number(values[ROW_INDEX_KEY]) : index
    return { rowIndex, values }
  }), [data.records])
  const [rows, setRows] = useState<number[]>(() => initial.map((row) => row.rowIndex))
  const seeded = useRef(false)

  //////////////////////////////////////////////////////////////////////
  // seed the starting rows' cells once, then keep the host's fields  //
  // in step with the rows                                            //
  //////////////////////////////////////////////////////////////////////
  useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    for (const row of initial) {
      for (const field of fields) form.setValue(cellName(field.name, row.rowIndex), row.values[field.name] ?? (field.type === 'BOOLEAN' ? null : ''))
    }
  }, [fields, form, initial])

  const cellFields = useMemo(() => rows.flatMap((rowIndex) => fields.map((field) => ({ ...field, name: cellName(field.name, rowIndex) }))), [fields, rows])
  useEffect(() => {
    registerFields(widgetName, cellFields)
  }, [cellFields, registerFields, widgetName])
  useEffect(() => () => registerFields(widgetName, []), [registerFields, widgetName])

  const watched = useWatch({ control: form.control, name: cellFields.map((field) => field.name) })
  const json = useMemo(() => JSON.stringify(rows.map((rowIndex) => {
    const row: Record<string, unknown> = {}
    fields.forEach((field) => {
      const position = cellFields.findIndex((cell) => cell.name === cellName(field.name, rowIndex))
      const value = position >= 0 ? watched[position] : undefined
      row[field.name] = value === '' || value === undefined ? null : value
    })
    row[ROW_INDEX_KEY] = rowIndex
    return row
  })), [cellFields, fields, rows, watched])
  useEffect(() => { onWidgetData({ [outputFieldName]: json }) }, [json, onWidgetData, outputFieldName])

  const addRow = () => {
    const rowIndex = rows.length === 0 ? 0 : Math.max(...rows) + 1
    const defaults = isPlainObject(data.defaultValuesForNewRecords) ? data.defaultValuesForNewRecords : {}
    for (const field of fields) form.setValue(cellName(field.name, rowIndex), defaults[field.name] ?? (field.type === 'BOOLEAN' ? null : ''))
    setRows((current) => [...current, rowIndex])
  }

  const removeRow = (rowIndex: number) => {
    form.unregister(fields.map((field) => cellName(field.name, rowIndex)))
    setRows((current) => current.filter((candidate) => candidate !== rowIndex))
  }

  if (fields.length === 0) {
    return <p role="alert" className="text-sm text-destructive" data-qqq-id={`row-builder-error-${widgetName}`}>Configuration error: No fields were defined for this widget</p>
  }

  return (
    <div className="space-y-3" data-qqq-id={`widget-rowBuilder-${widgetName}`} data-editable="true">
      {rows.map((rowIndex, position) => (
        <div key={rowIndex} className="flex items-start gap-3 border-b border-border pb-3" data-qqq-id={`row-builder-row-${widgetName}-${position}`}>
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.map((field) => (
              <DynamicFormField
                key={field.name}
                field={{ ...field, name: cellName(field.name, rowIndex) }}
                idPrefix={`${widgetName}-${rowIndex}`}
                register={form.register}
                control={form.control}
                errors={form.formState.errors}
                disabled={host.disabled}
                possibleValueContext={{ type: 'standalone' }}
                helpRoles={['ALL_SCREENS']}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => removeRow(rowIndex)}
            disabled={host.disabled}
            aria-label={`Remove row ${position + 1}`}
            title="Remove Row"
            className="mt-7 inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:h-11 pointer-coarse:w-11"
            data-qqq-id={`button-row-builder-remove-${widgetName}-${position}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        disabled={host.disabled}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
        data-qqq-id={`button-row-builder-add-${widgetName}`}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add new
      </button>
    </div>
  )
}
