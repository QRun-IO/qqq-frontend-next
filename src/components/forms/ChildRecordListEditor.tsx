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
 * @file ChildRecordListEditor — a child record list that manages an association, edited inside
 * its parent's create or edit form (Material's EntityForm with RecordGridWidget): child rows are
 * added, edited and removed in a dialog, held in memory, and saved with the parent record as
 * that association.
 */

'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Pencil, Plus, Trash2, X } from 'lucide-react'

import type { QFieldMetaData, QRecord, QTableMetaData, QWidgetMetaData } from '@/types'
import { fetchTablePossibleValues } from '@/lib/api/possible-values'
import { useTableMetaData } from '@/lib/hooks/use-metadata'
import { cn } from '@/lib/utils/cn'
import { formValueFromRecordValue, wireValuesFromForm } from '@/lib/utils/zod-from-metadata'

import { FieldValue } from '@/components/records/FieldValue'
import { childColumns } from '@/components/widgets/ChildRecordListWidget'
import type { ChildRecordListPayload } from '@/components/widgets/ChildRecordListWidget'
import { asList, isPlainObject } from '@/components/widgets/widget-types'
import type { WidgetFormContext } from '@/components/widgets/widget-types'
import { EntityForm } from './EntityForm'

/** A child row held by the form. */
interface ChildRow {
  values: Record<string, unknown>
  displayValues: Record<string, string>
}

/** The open child dialog: a new row (index null) or an existing one. */
interface ChildDialog {
  rowIndex: number | null
  defaultValues: Record<string, unknown>
  disabledFields: string[]
}

/** Props for {@link ChildRecordListEditor}. */
export interface ChildRecordListEditorProps {
  /** The childRecordList widget (its `manageAssociationName` names the association). */
  widgetMetaData: QWidgetMetaData
  /** The widget's data: the current child records and the child table. */
  data: ChildRecordListPayload
  /** The parent form. */
  formContext: WidgetFormContext
}

/**
 * The rows of the widget data as the form holds them.
 *
 * @param data - Widget data.
 * @returns Child rows.
 */
function rowsFrom(data: ChildRecordListPayload): ChildRow[] {
  const records = isPlainObject(data.queryOutput) ? asList<QRecord>(data.queryOutput.records) ?? [] : []
  return records.filter(isPlainObject).map((record) => ({
    values: isPlainObject(record.values) ? { ...record.values } : {},
    displayValues: isPlainObject(record.displayValues) ? { ...(record.displayValues as Record<string, string>) } : {},
  }))
}

/**
 * Labels for the possible-value fields of a child row, looked up as Material does after a child
 * form closes (the grid shows labels, not ids).
 *
 * @param table - Child table metadata.
 * @param values - The row's values.
 * @returns Display values by field name.
 */
async function lookupDisplayValues(table: QTableMetaData, values: Record<string, unknown>): Promise<Record<string, string>> {
  const displayValues: Record<string, string> = {}
  await Promise.all(Object.entries(values).map(async ([name, value]) => {
    const field = table.fields[name]
    if (!field?.possibleValueSourceName || value === null || value === undefined || value === '') return
    try {
      const options = await fetchTablePossibleValues(table.name, name, { ids: String(value), formValues: values, useCase: 'form' })
      const match = options.find((option) => String(option.id) === String(value))
      if (match) displayValues[name] = match.label
    } catch {
      // the raw value stays visible
    }
  }))
  return displayValues
}

/**
 * Renders the child rows with add, edit and delete, and the child dialog.
 *
 * @param props - See {@link ChildRecordListEditorProps}.
 * @returns The editable child list.
 */
export function ChildRecordListEditor({ widgetMetaData, data, formContext }: ChildRecordListEditorProps) {
  const widgetName = widgetMetaData.name
  const associationName = String(widgetMetaData.defaultValues?.manageAssociationName ?? '')
  const payloadTable = data.childFrontendTableMetaData ?? data.childTableMetaData
  const { data: childTable, isError: tableError } = useTableMetaData(payloadTable?.name)
  const [rows, setRows] = useState<ChildRow[]>(() => rowsFrom(data))
  const [dialog, setDialog] = useState<ChildDialog | null>(null)
  const changed = useRef(false)
  const addButtonRef = useRef<HTMLButtonElement>(null)

  // New widget data (a field rule reloaded it) replaces the rows until the user changes them.
  useEffect(() => {
    if (!changed.current) setRows(rowsFrom(data))
  }, [data])

  const { setAssociation } = formContext
  /**
   * Replaces the rows and hands them to the form as the association's records.
   * @param next - The new rows.
   */
  const commit = (next: ChildRow[]) => {
    changed.current = true
    setRows(next)
    setAssociation(associationName, next.map((row) => row.values))
  }

  if (!payloadTable || typeof payloadTable.name !== 'string') {
    return <p role="alert" className="text-sm text-destructive">The child record list data is not in the expected format.</p>
  }
  const tableLabel = childTable?.label ?? payloadTable.label ?? payloadTable.name
  const presetValues = isPlainObject(data.defaultValuesForNewChildRecords) ? data.defaultValuesForNewChildRecords : {}
  const disabledFields = (asList<string>(data.disabledFieldsForNewChildRecords) ?? []).length > 0
    ? asList<string>(data.disabledFieldsForNewChildRecords) ?? []
    : Object.keys(presetValues)
  // The parent's key column is not shown (Material hides the defaulted fields).
  const columns = childColumns(childTable ?? payloadTable, asList<string>(data.omitFieldNames) ?? [], asList<string>(data.onlyIncludeFieldNames) ?? [])
    .filter((field) => !(field.name in presetValues))
  const locked = Boolean(formContext.disabled)

  /** Opens the dialog for a new child, with the widget's defaults and the parent fields' values. */
  const openAdd = () => {
    const defaults: Record<string, unknown> = { ...presetValues }
    if (isPlainObject(data.defaultValuesForNewChildRecordsFromParentFields)) {
      for (const [childField, parentField] of Object.entries(data.defaultValuesForNewChildRecordsFromParentFields)) {
        defaults[childField] = formContext.values[String(parentField)]
      }
    }
    setDialog({ rowIndex: null, defaultValues: defaults, disabledFields })
  }

  /**
   * Opens the dialog for an existing row, with its values as the form shows them.
   * @param rowIndex - The row's index.
   */
  const openEdit = (rowIndex: number) => {
    const values = rows[rowIndex].values
    const defaults = childTable
      ? Object.fromEntries(Object.entries(values).map(([name, value]) => {
        const field = childTable.fields[name]
        return [name, field && value !== null && value !== undefined ? formValueFromRecordValue(field, value) : value]
      }))
      : { ...values }
    setDialog({ rowIndex, defaultValues: defaults, disabledFields })
  }

  /**
   * Takes the child dialog's values into the rows (a new row, or the edited one).
   * @param formValues - The child form's values.
   */
  const submitChild = async (formValues: Record<string, unknown>) => {
    if (!childTable || !dialog) return
    // An empty input is no value: a new child leaves it out (the insert applies defaults and
    // assigns the key), an existing child clears it.
    const isNew = dialog.rowIndex === null
    const values = Object.fromEntries(Object.entries(wireValuesFromForm(childTable, formValues, dialog.rowIndex === null ? undefined : rows[dialog.rowIndex].values))
      .filter(([, value]) => value !== undefined && !(isNew && (value === '' || value === null)))
      .map(([name, value]) => [name, value === '' ? null : value]))
    if (isNew || values[childTable.primaryKeyField] === null) delete values[childTable.primaryKeyField]
    const displayValues = await lookupDisplayValues(childTable, values)
    const next = [...rows]
    if (dialog.rowIndex === null) next.push({ values, displayValues })
    else next[dialog.rowIndex] = { values, displayValues }
    commit(next)
    setDialog(null)
  }

  return (
    <div className="space-y-2" data-qqq-id={`child-record-editor-${widgetName}`}>
      {data.canAddChildRecord !== false && (
        <div className="flex justify-end">
          <button
            ref={addButtonRef}
            type="button"
            onClick={openAdd}
            disabled={locked || !childTable}
            data-qqq-id={`child-record-add-${widgetName}`}
            className={cn(
              'inline-flex min-h-9 items-center gap-1.5 rounded-md border border-input px-3 text-sm font-medium text-foreground',
              'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring pointer-coarse:min-h-11',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add new
          </button>
        </div>
      )}
      {tableError && <p role="alert" className="text-sm text-destructive">{`${tableLabel} details could not be loaded.`}</p>}
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground" data-qqq-id={`child-record-empty-${widgetName}`}>
          No rows
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label={widgetMetaData.label || tableLabel}>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="w-24 px-2 py-1.5 font-medium text-muted-foreground">Actions</th>
                {columns.map((field) => (
                  <th key={field.name} scope="col" className="px-2 py-1.5 font-medium text-muted-foreground">{field.label ?? field.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-border/50 last:border-0" data-qqq-id={`child-record-row-${widgetName}-${rowIndex}`}>
                  <td className="px-1 py-1">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(rowIndex)}
                        disabled={locked || !childTable}
                        aria-label={`Edit ${tableLabel} row ${rowIndex + 1}`}
                        data-qqq-id={`child-record-edit-${widgetName}-${rowIndex}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 pointer-coarse:h-11 pointer-coarse:w-11"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => commit(rows.filter((_, index) => index !== rowIndex))}
                        disabled={locked}
                        aria-label={`Delete ${tableLabel} row ${rowIndex + 1}`}
                        data-qqq-id={`child-record-delete-${widgetName}-${rowIndex}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 pointer-coarse:h-11 pointer-coarse:w-11"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                  {columns.map((column) => {
                    const field: QFieldMetaData | undefined = childTable?.fields[column.name]
                    const record: QRecord = { tableName: payloadTable.name, values: row.values, displayValues: row.displayValues }
                    return (
                      <td key={column.name} className="px-2 py-1.5 text-foreground" data-qqq-id={`child-record-cell-${widgetName}-${rowIndex}-${column.name}`}>
                        {field
                          ? <FieldValue field={field} record={record} tableMetaData={childTable} />
                          : String(row.displayValues[column.name] ?? row.values[column.name] ?? '')}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog && childTable && (
        <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) setDialog(null) }}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
            <DialogPrimitive.Content
              className={cn(
                'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
                'flex max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl flex-col',
                'rounded-xl border border-border bg-card shadow-lg'
              )}
              aria-describedby={undefined}
              // Material ignores backdrop clicks: the child form closes with its own buttons.
              onPointerDownOutside={(event) => event.preventDefault()}
              onCloseAutoFocus={(event) => { event.preventDefault(); addButtonRef.current?.focus() }}
              data-qqq-id={`dialog-child-record-${widgetName}`}
            >
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <DialogPrimitive.Title className="text-lg font-semibold tracking-tight text-foreground">
                  {`${dialog.rowIndex === null ? 'Creating New' : 'Editing'} ${tableLabel}`}
                </DialogPrimitive.Title>
                <DialogPrimitive.Close
                  className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </DialogPrimitive.Close>
              </div>
              <div className="flex-1 overflow-y-auto">
                <EntityForm
                  tableMetaData={childTable}
                  isModal
                  saveButtonLabel="OK"
                  defaultValues={dialog.defaultValues}
                  disabledFieldNames={dialog.disabledFields}
                  onSubmitValues={(values) => { void submitChild(values) }}
                  onCancel={() => setDialog(null)}
                />
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      )}
    </div>
  )
}
