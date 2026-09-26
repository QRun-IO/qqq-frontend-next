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
 * @file ChildRecordListWidget — read-only list of a record's joined child records.
 *
 * Renders the `ChildRecordListRenderer` payload for widgets that are bound only to a
 * join (no managed association): the child rows the backend queried, with column
 * labels from the child table metadata, values formatted by type and adornment (as a
 * record view formats them), the exposed join-table columns the widget queried, a
 * click anywhere on a row to open the child record, a CSV export of the rows shown,
 * and a View All link when the backend limited the rows (Material RecordGridWidget).
 * Association editing is handled by the record view, not here.
 */
'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { Download } from 'lucide-react'

import type { QRecord, QTableMetaData } from '@/types'
import { useMetaData } from '@/lib/hooks/use-metadata'
import { cn } from '@/lib/utils/cn'
import { FieldValue } from '@/components/records/FieldValue'
import { displayText } from './record-lookup-utils'
import { asList, isPlainObject, payloadProblem } from './widget-types'
import type { WidgetComponentProps } from './widget-types'
import { widgetField } from './widget-field-values'
import { downloadText, widgetExportFileName } from './widget-utils'
import { WidgetEmpty, WidgetPayloadNotice } from './WidgetNotice'
import { ChildRecordListEditor } from './ChildRecordListEditor'

/** Field metadata subset used for columns (the rest of the serialized field passes through). */
interface ChildFieldMetaData {
  name: string
  label?: string
  type?: string
  isHidden?: boolean
  isHeavy?: boolean
  possibleValueSourceName?: string
}

/** An exposed join of the child table (`QFrontendExposedJoin`), with its join table's metadata. */
interface ChildExposedJoin {
  label?: string
  isMany?: boolean
  joinTable?: ChildTableMetaData
}

/** One column of the list: a child field, or a field of an exposed join table (`table.field`). */
export interface ChildColumn {
  /** Key of the column's values in each record (`field` or `joinTable.field`). */
  name: string
  /** Column heading (`Join label: Field label` for a join column). */
  label: string
  /** The column's field metadata, renamed to {@link ChildColumn.name}. */
  field: ChildFieldMetaData & Record<string, unknown>
}

/** Section metadata subset used for column order (`isHidden` legacy, `hidden` V1). */
interface ChildSectionMetaData {
  name?: string
  tier?: string
  fieldNames?: string[]
  isHidden?: boolean
  hidden?: boolean
}

/** Child table metadata subset carried in the payload. */
export interface ChildTableMetaData {
  name: string
  label?: string
  primaryKeyField?: string
  fields?: Record<string, ChildFieldMetaData>
  sections?: ChildSectionMetaData[]
  exposedJoins?: ChildExposedJoin[]
}

/** Payload returned by `ChildRecordListRenderer`. */
export interface ChildRecordListPayload {
  type?: string
  title?: string
  label?: string
  /** Exposed join tables the widget queried (its `queryJoins`); their columns are shown. */
  includeExposedJoinTables?: string[]
  queryOutput?: { records?: QRecord[] }
  childFrontendTableMetaData?: ChildTableMetaData
  childTableMetaData?: ChildTableMetaData
  tablePath?: string
  viewAllLink?: string
  totalRows?: number
  disableRowClick?: boolean
  omitFieldNames?: string[]
  onlyIncludeFieldNames?: string[]
  canAddChildRecord?: boolean
  /** Join values a new child gets (the parent's key on the join fields). */
  defaultValuesForNewChildRecords?: Record<string, unknown>
  /** Fields shown read-only for a new child; defaults to the defaulted fields. */
  disabledFieldsForNewChildRecords?: string[]
  /** Child field to parent field, for defaults taken from the hosting record. */
  defaultValuesForNewChildRecordsFromParentFields?: Record<string, string>
  /** `true` when the list is edited in memory by a process step (Material `isInProcess`). */
  isInProcess?: boolean
  /** In a process: rows may be edited. */
  allowRecordEdit?: boolean
  /** In a process: rows may be deleted. */
  allowRecordDelete?: boolean
}

/**
 * Where "Add new" goes, as in Material: on a record view the `#/createChild=` link that opens
 * the child create form over the record, elsewhere the child's create page; both carry the
 * join defaults (and parent-field defaults) with those fields locked.
 *
 * @param data - Widget payload.
 * @param tableName - Child table name.
 * @param parent - Values of the hosting record, when the widget is on a record view.
 * @returns The link.
 */
export function addChildHref(data: ChildRecordListPayload, tableName: string, parent: Record<string, unknown> | undefined): string {
  const defaults: Record<string, unknown> = { ...(isPlainObject(data.defaultValuesForNewChildRecords) ? data.defaultValuesForNewChildRecords : {}) }
  if (parent && isPlainObject(data.defaultValuesForNewChildRecordsFromParentFields)) {
    for (const [childField, parentField] of Object.entries(data.defaultValuesForNewChildRecordsFromParentFields)) defaults[childField] = parent[parentField]
  }
  const disabled = asList<string>(data.disabledFieldsForNewChildRecords) ?? []
  const locked = Object.fromEntries((disabled.length > 0 ? disabled : Object.keys(defaults)).map((name) => [name, 1]))
  const presets = `/defaultValues=${encodeURIComponent(JSON.stringify(defaults))}/disabledFields=${encodeURIComponent(JSON.stringify(locked))}`
  return parent ? `#/createChild=${encodeURIComponent(tableName)}${presets}` : `/app/${encodeURIComponent(tableName)}/create#${presets}`
}

/**
 * Chooses the child table's columns: fields in section order (T1 sections first),
 * skipping hidden sections, hidden or heavy fields, and `omitFieldNames`; limited to
 * `onlyIncludeFieldNames` when given. The primary key column comes first.
 *
 * @param table - Child table metadata.
 * @param omit - Field names to leave out.
 * @param only - When non-empty, the only field names to keep.
 * @param primaryKeyFirst - Whether the primary key column leads (not for join tables).
 * @returns The ordered column fields.
 */
export function childColumns(table: ChildTableMetaData, omit: string[] = [], only: string[] = [], primaryKeyFirst = true): ChildFieldMetaData[] {
  const fields = table.fields ?? {}
  const sections = [...(table.sections ?? [])]
    .filter((section) => !section.isHidden && !section.hidden)
    .sort((a, b) => Number(b.tier === 'T1') - Number(a.tier === 'T1'))
  const names: string[] = []
  for (const section of sections) {
    for (const name of section.fieldNames ?? []) {
      if (!names.includes(name)) names.push(name)
    }
  }
  if (names.length === 0) names.push(...Object.keys(fields))
  const pk = table.primaryKeyField
  if (primaryKeyFirst && pk && names.includes(pk)) {
    names.splice(names.indexOf(pk), 1)
    names.unshift(pk)
  }
  return names
    .map((name) => fields[name])
    .filter((field): field is ChildFieldMetaData => Boolean(field) && !field.isHidden && !field.isHeavy)
    .filter((field) => !omit.includes(field.name))
    .filter((field) => only.length === 0 || only.includes(field.name))
}

/**
 * Every column of the list, as Material's RecordGridWidget builds them: the child fields
 * (see {@link childColumns}), then the fields of each exposed join table the widget queried
 * (`includeExposedJoinTables`) that the user may read, named `joinTable.field` and headed
 * `Join label: Field label`. `omitFieldNames` and `onlyIncludeFieldNames` apply to every
 * column. These are the export's columns; {@link shownColumns} drops the parent's key.
 *
 * @param table - Child table metadata.
 * @param data - Widget payload.
 * @param canReadTable - Whether the user may read a table (from the instance metadata).
 * @returns The columns, in order.
 */
export function listColumns(table: ChildTableMetaData, data: ChildRecordListPayload, canReadTable: (tableName: string) => boolean): ChildColumn[] {
  const omit = asList<string>(data.omitFieldNames) ?? []
  const only = asList<string>(data.onlyIncludeFieldNames) ?? []
  const columns: ChildColumn[] = childColumns(table, [], []).map((field) => ({ name: field.name, label: field.label ?? field.name, field: { ...field } }))
  const included = asList<string>(data.includeExposedJoinTables) ?? []
  for (const join of asList<ChildExposedJoin>(table.exposedJoins) ?? []) {
    const joinTable = isPlainObject(join) && isPlainObject(join.joinTable) ? (join.joinTable as unknown as ChildTableMetaData) : undefined
    if (!joinTable || typeof joinTable.name !== 'string' || !included.includes(joinTable.name) || !canReadTable(joinTable.name)) continue
    const joinLabel = join.label ?? joinTable.label ?? joinTable.name
    for (const field of childColumns(joinTable, [], [], false)) {
      const name = `${joinTable.name}.${field.name}`
      const label = `${joinLabel}: ${field.label ?? field.name}`
      columns.push({ name, label, field: { ...field, name, label } })
    }
  }
  return columns
    .filter((column) => !omit.includes(column.name))
    .filter((column) => only.length === 0 || only.includes(column.name))
}

/**
 * The columns shown on screen: every column except the parent's key, i.e. the fields a new
 * child gets from the parent (`defaultValuesForNewChildRecords`), which Material hides.
 *
 * @param columns - Every column (see {@link listColumns}).
 * @param data - Widget payload.
 * @returns The shown columns.
 */
export function shownColumns(columns: ChildColumn[], data: ChildRecordListPayload): ChildColumn[] {
  const parentKeys = isPlainObject(data.defaultValuesForNewChildRecords) ? data.defaultValuesForNewChildRecords : {}
  return columns.filter((column) => parentKeys[column.name] === undefined || parentKeys[column.name] === null)
}

/**
 * The CSV of the shown child rows, exactly as Material's RecordGridWidget writes it: a
 * heading row, then one row per record, every cell the display value (else the raw value)
 * in double quotes with inner quotes doubled.
 *
 * @param columns - The export's columns (see {@link listColumns}).
 * @param records - The records shown.
 * @returns The CSV text.
 */
export function childRecordsCsv(columns: ChildColumn[], records: QRecord[]): string {
  const cell = (value: unknown) => `"${value === null || value === undefined ? '' : String(value).replace(/"/g, '""')}"`
  let csv = `${columns.map((column) => cell(column.label)).join(',')}\n`
  for (const record of records) {
    const values = isPlainObject(record?.values) ? record.values : {}
    const displayValues = isPlainObject(record?.displayValues) ? record.displayValues : {}
    csv += `${columns.map((column) => cell(displayValues[column.name] ?? values[column.name])).join(',')}\n`
  }
  return csv
}

/**
 * The export button's tooltip, as in Material: "Export", or, when the backend limited the
 * rows, how many rows the export holds and (with a View All link) how to export them all.
 *
 * @param shown - Number of rows shown.
 * @param totalRows - Rows the backend counted.
 * @param hasViewAll - Whether a View All link is offered.
 * @returns The tooltip text.
 */
export function childExportTitle(shown: number, totalRows: number | undefined, hasViewAll: boolean): string {
  if (shown === 0 || !totalRows || shown >= totalRows) return 'Export'
  return `Export these ${shown} records.${hasViewAll ? '\nClick View All to export all records.' : ''}`
}

/**
 * Opens a row's child record from a click anywhere on the row (Material RecordGridWidget),
 * by following the row's record link; clicks on the row's own links and controls, and
 * clicks that end a text selection, keep their usual meaning.
 *
 * @param event - The row click.
 */
function openRowRecord(event: React.MouseEvent<HTMLTableRowElement>) {
  const target = event.target instanceof Element ? event.target : null
  if (target?.closest('a, button, input, select, textarea, summary, [role="button"]')) return
  if (typeof window !== 'undefined' && window.getSelection()?.toString()) return
  event.currentTarget.querySelector<HTMLAnchorElement>('a[data-row-link]')?.click()
}

/**
 * Converts the backend's View All link (a Material route such as
 * `/appPath/table?filter=...`) to the Next record-query route for the child table.
 *
 * @param viewAllLink - Backend link.
 * @param tableName - Child table name.
 * @returns `/app/<table>` with the original query string.
 */
export function nextViewAllHref(viewAllLink: string, tableName: string): string {
  const queryIndex = viewAllLink.indexOf('?')
  return `/app/${encodeURIComponent(tableName)}${queryIndex >= 0 ? viewAllLink.slice(queryIndex) : ''}`
}

/**
 * Renders the child records returned for the hosting record: each value formatted by its
 * field's type and adornments (possible values link to their record), the exposed join
 * columns the widget queried, the parent's key column hidden, the first column linking to
 * the child record and a click anywhere on the row opening it (unless `disableRowClick`),
 * and, when the widget metadata asks for it, an Export button that downloads the shown
 * rows as CSV (Material RecordGridWidget).
 *
 * @param props - Widget props with a `ChildRecordListRenderer` payload.
 * @returns A table of child records, an empty state, or a payload notice.
 */
export function ChildRecordListWidget({ widgetMetaData, data, recordContext, onWidgetData }: WidgetComponentProps<ChildRecordListPayload>) {
  const widgetName = widgetMetaData.name
  const { data: instance } = useMetaData()
  const table = data?.childFrontendTableMetaData ?? data?.childTableMetaData
  const queryOutput = data?.queryOutput
  const records = queryOutput === undefined || queryOutput === null ? [] : isPlainObject(queryOutput) ? asList<QRecord>(queryOutput.records) : undefined
  const valid = Boolean(table) && isPlainObject(table) && typeof table?.name === 'string' && records !== undefined

  // Join columns need the user's table permissions, which the instance metadata carries.
  const allColumns = useMemo(() => {
    if (!valid || !table) return []
    const tables = instance?.tables
    return listColumns(table, data, (name) => Boolean(tables?.[name]) && tables?.[name]?.readPermission !== false)
  }, [valid, table, data, instance?.tables])
  const columns = useMemo(() => shownColumns(allColumns, data), [allColumns, data])
  const fields = useMemo(() => Object.fromEntries(columns.map((column) => [column.name, widgetField(column.field, column.name, column.label)])), [columns])

  if (!valid || !table || records === undefined) {
    return <WidgetPayloadNotice widgetName={widgetName} message={payloadProblem('child record list', 'queryOutput.records and child table metadata')} />
  }

  ////////////////////////////////////////////////////////////////////////
  // a process step edits its child rows in memory and posts them itself //
  ////////////////////////////////////////////////////////////////////////
  if (data.isInProcess === true && onWidgetData) {
    return <ChildRecordListEditor widgetMetaData={widgetMetaData} data={data} table={table} onChange={(next) => onWidgetData({ ...next })} />
  }

  const tableLabel = table.label ?? table.name
  const primaryKeyField = table.primaryKeyField
  const totalRows = typeof data.totalRows === 'number' ? data.totalRows : undefined
  const viewAllHref = data.viewAllLink ? nextViewAllHref(data.viewAllLink, table.name) : undefined
  const allTables = instance?.tables as Record<string, QTableMetaData> | undefined
  const exportLabel = typeof data.label === 'string' && data.label ? data.label : widgetMetaData.label
  const exportTitle = childExportTitle(records.length, totalRows, Boolean(viewAllHref))
  const showToolbar = data.canAddChildRecord === true || widgetMetaData.showExportButton === true

  return (
    <div className="space-y-2" data-qqq-id={`widget-childRecordList-${widgetName}`}>
      {showToolbar && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {widgetMetaData.showExportButton === true && (
            <button
              type="button"
              onClick={() => downloadText(widgetExportFileName(exportLabel), childRecordsCsv(allColumns, records))}
              disabled={records.length === 0}
              title={exportTitle}
              aria-label={exportTitle.replace('\n', ' ')}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              data-qqq-id={`child-record-export-${widgetName}`}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </button>
          )}
          {data.canAddChildRecord === true && (
            // a plain anchor: the record view reacts to the hash change (Next's Link would not fire it)
            <a
              href={addChildHref(data, table.name, recordContext?.record?.values)}
              className="text-sm font-medium text-primary underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
              data-qqq-id={`child-record-add-${widgetName}`}
            >
              Add new {tableLabel}
            </a>
          )}
        </div>
      )}
      {records.length === 0 ? (
        <WidgetEmpty widgetName={widgetName}>No {tableLabel} records found</WidgetEmpty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label={widgetMetaData.label || tableLabel}>
            <thead>
              <tr className="border-b border-border text-left">
                {columns.map((column) => (
                  <th key={column.name} scope="col" className="px-2 py-1.5 font-medium text-muted-foreground" data-qqq-id={`child-record-column-${widgetName}-${column.name}`}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((record, rowIndex) => {
                const values = isPlainObject(record?.values) ? record.values : {}
                const displayValues = isPlainObject(record?.displayValues) ? record.displayValues : {}
                const pk = primaryKeyField ? values[primaryKeyField] : undefined
                const pkText = displayText(pk)
                const href = !data.disableRowClick && pkText !== '' ? `/app/${encodeURIComponent(table.name)}/${encodeURIComponent(pkText)}` : undefined
                const cellRecord: QRecord = {
                  tableName: typeof record?.tableName === 'string' ? record.tableName : table.name,
                  values,
                  displayValues: displayValues as Record<string, string>,
                }
                return (
                  <tr
                    key={pkText || rowIndex}
                    className={cn('border-b border-border/50 last:border-0', href && 'cursor-pointer hover:bg-accent/50')}
                    onClick={href ? openRowRecord : undefined}
                    data-qqq-id={`child-record-row-${widgetName}-${pkText || rowIndex}`}
                  >
                    {columns.map((column, columnIndex) => {
                      const display = displayValues[column.name]
                      const text = displayText(display !== undefined && display !== null ? display : values[column.name])
                      return (
                        <td key={column.name} className="px-2 py-1.5 text-foreground" data-qqq-id={`child-record-cell-${widgetName}-${column.name}`}>
                          {columnIndex === 0 && href ? (
                            <Link href={href} data-row-link="" className="text-primary underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-ring">
                              {text || pkText}
                            </Link>
                          ) : (
                            <FieldValue field={fields[column.name]} record={cellRecord} allTables={allTables} widgetMetaDataMap={instance?.widgets} />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {(totalRows !== undefined && totalRows > records.length) || viewAllHref ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{totalRows !== undefined && totalRows > records.length ? `Showing ${records.length} of ${totalRows}` : ''}</span>
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="text-primary underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
              data-qqq-id={`child-record-view-all-${widgetName}`}
            >
              View All
            </Link>
          )}
        </div>
      ) : null}
    </div>
  )
}
