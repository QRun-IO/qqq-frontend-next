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
 * @file ChildRecordListEditor — a `childRecordList` widget whose rows are edited in
 * memory by the screen hosting it (a process step with `isInProcess` data), as Material's
 * DashboardWidgets and RecordGridWidget do: Add new (when `canAddChildRecord`), Edit and
 * Delete per row (when `allowRecordEdit` / `allowRecordDelete`), a modal form for the child
 * table with the new-record defaults and locked fields. Nothing is saved to a table: every
 * change hands the updated payload to the host (which posts the rows as `frontendRecords`).
 */
'use client'

import React, { useMemo, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Trash2, X } from 'lucide-react'

import type { QRecord, QTableMetaData, QWidgetMetaData } from '@/types'
import {
  defaultValuesForCreate, defaultValuesFromRecord, wireValuesFromForm, zodSchemaFromTableMetadata,
} from '@/lib/utils/zod-from-metadata'
import { cn } from '@/lib/utils/cn'
import { DynamicForm } from '@/components/forms/DynamicForm'
import { displayText } from './record-lookup-utils'
import type { ChildRecordListPayload, ChildTableMetaData } from './ChildRecordListWidget'
import { childColumns } from './ChildRecordListWidget'
import { asList, isPlainObject } from './widget-types'
import { WidgetEmpty } from './WidgetNotice'

/** Props for {@link ChildRecordListEditor}. */
export interface ChildRecordListEditorProps {
  widgetMetaData: QWidgetMetaData
  /** The widget payload (its rows are the starting rows). */
  data: ChildRecordListPayload
  /** The child table, from the payload. */
  table: ChildTableMetaData
  /** Receives the payload with the updated rows after every change. */
  onChange: (data: ChildRecordListPayload) => void
}

/** An open child form: the row being edited (`null` for a new row). */
interface OpenForm {
  rowIndex: number | null
  defaults: Record<string, unknown>
  disabled: string[]
}

const iconButton = 'inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 pointer-coarse:h-11 pointer-coarse:w-11'

/**
 * The in-memory child record list.
 * @param props - {@link ChildRecordListEditorProps}
 * @returns The rows with their editing controls and the child form dialog.
 */
export function ChildRecordListEditor({ widgetMetaData, data, table, onChange }: ChildRecordListEditorProps) {
  const widgetName = widgetMetaData.name
  const [records, setRecords] = useState<QRecord[]>(() => asList<QRecord>(isPlainObject(data.queryOutput) ? data.queryOutput.records : []) ?? [])
  const [openForm, setOpenForm] = useState<OpenForm | null>(null)
  const tableLabel = table.label ?? table.name
  const columns = childColumns(table, asList<string>(data.omitFieldNames) ?? [], asList<string>(data.onlyIncludeFieldNames) ?? [])
  const allowEdit = data.allowRecordEdit === true
  const allowDelete = data.allowRecordDelete === true
  const newDefaults = isPlainObject(data.defaultValuesForNewChildRecords) ? data.defaultValuesForNewChildRecords : {}
  const lockedForNew = (asList<string>(data.disabledFieldsForNewChildRecords) ?? []).length > 0
    ? asList<string>(data.disabledFieldsForNewChildRecords) ?? []
    : Object.keys(newDefaults)

  /**
   * Keep and report the new rows.
   * @param next - The rows after a change.
   */
  const change = (next: QRecord[]) => {
    setRecords(next)
    onChange({ ...data, queryOutput: { records: next }, totalRows: next.length })
  }

  return (
    <div className="space-y-2" data-qqq-id={`widget-childRecordList-${widgetName}`} data-editing="in-memory">
      {data.canAddChildRecord === true && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setOpenForm({ rowIndex: null, defaults: newDefaults, disabled: lockedForNew })}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-primary hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
            data-qqq-id={`child-record-add-${widgetName}`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add new {tableLabel}
          </button>
        </div>
      )}
      {records.length === 0 ? (
        <WidgetEmpty widgetName={widgetName}>No {tableLabel} records found</WidgetEmpty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label={widgetMetaData.label || tableLabel}>
            <thead>
              <tr className="border-b border-border text-left">
                {columns.map((field) => (
                  <th key={field.name} scope="col" className="px-2 py-1.5 font-medium text-muted-foreground">{field.label ?? field.name}</th>
                ))}
                {(allowEdit || allowDelete) && <th scope="col" className="px-2 py-1.5"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {records.map((record, rowIndex) => {
                const values = isPlainObject(record?.values) ? record.values : {}
                const displayValues = isPlainObject(record?.displayValues) ? record.displayValues : {}
                return (
                  <tr key={rowIndex} className="border-b border-border/50 last:border-0" data-qqq-id={`child-record-row-${widgetName}-${rowIndex}`}>
                    {columns.map((field) => {
                      const display = displayValues[field.name]
                      return <td key={field.name} className="px-2 py-1.5 text-foreground">{displayText(display !== undefined && display !== null ? display : values[field.name])}</td>
                    })}
                    {(allowEdit || allowDelete) && (
                      <td className="whitespace-nowrap px-2 py-1 text-right">
                        {allowEdit && (
                          <button
                            type="button"
                            onClick={() => setOpenForm({ rowIndex, defaults: values, disabled: lockedForNew })}
                            aria-label={`Edit ${tableLabel} row ${rowIndex + 1}`}
                            className={iconButton}
                            data-qqq-id={`button-child-record-edit-${widgetName}-${rowIndex}`}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                        {allowDelete && (
                          <button
                            type="button"
                            onClick={() => change(records.filter((_, index) => index !== rowIndex))}
                            aria-label={`Delete ${tableLabel} row ${rowIndex + 1}`}
                            className={iconButton}
                            data-qqq-id={`button-child-record-delete-${widgetName}-${rowIndex}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {openForm && (
        <ChildRecordFormDialog
          table={table as unknown as QTableMetaData}
          openForm={openForm}
          onClose={() => setOpenForm(null)}
          onSave={(values) => {
            //////////////////////////////////////////////////////////////////////
            // an edited row keeps the values the form does not edit (its key) //
            //////////////////////////////////////////////////////////////////////
            const original = openForm.rowIndex === null ? {} : records[openForm.rowIndex]?.values ?? {}
            const row: QRecord = { tableName: table.name, values: { ...original, ...values } }
            change(openForm.rowIndex === null ? [...records, row] : records.map((record, index) => index === openForm.rowIndex ? row : record))
            setOpenForm(null)
          }}
        />
      )}
    </div>
  )
}

/**
 * The child table's form in a dialog (Material: "Creating New {table}" / "Editing {table}").
 * Saving returns the entered values; nothing is written to the table.
 * @param props - The child table, the row being edited, and the close and save callbacks.
 * @returns The dialog.
 */
function ChildRecordFormDialog({ table, openForm, onClose, onSave }: {
  table: QTableMetaData
  openForm: OpenForm
  onClose: () => void
  onSave: (values: Record<string, unknown>) => void
}) {
  const schema = useMemo(() => zodSchemaFromTableMetadata(table), [table])
  const defaultValues = useMemo(() => ({
    ...defaultValuesForCreate(table),
    ...(openForm.rowIndex === null ? openForm.defaults : defaultValuesFromRecord(table, openForm.defaults)),
  }), [openForm, table])
  const form = useForm<Record<string, unknown>>({ resolver: zodResolver(schema), defaultValues })
  const heading = `${openForm.rowIndex === null ? 'Creating New' : 'Editing'} ${table.label ?? table.name}`

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'flex max-h-[85vh] w-[calc(100%-2rem)] max-w-xl flex-col rounded-xl border border-border bg-card shadow-lg'
          )}
          aria-describedby={undefined}
          data-qqq-id={`dialog-child-record-${table.name}`}
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <DialogPrimitive.Title className="text-lg font-semibold tracking-tight text-foreground">{heading}</DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Close"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>
          {/* the dialog is portaled, but React still bubbles its submit to the process form: stop it here */}
          <form
            noValidate
            autoComplete="off"
            aria-label={heading}
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault()
              event.stopPropagation()
              void form.handleSubmit((values) => onSave(wireValuesFromForm(table, values, openForm.rowIndex === null ? undefined : openForm.defaults)))(event)
            }}
          >
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <DynamicForm
                register={form.register}
                control={form.control}
                errors={form.formState.errors}
                tableMetaData={table}
                disabledFieldNames={openForm.disabled}
                possibleValueContext={{ type: 'table', tableName: table.name }}
              />
            </div>
            <div className="flex justify-end gap-3 border-t border-border px-6 py-3">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
                data-qqq-id="button-child-record-cancel"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
                data-qqq-id="button-child-record-save"
              >
                Save
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
