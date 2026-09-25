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
 * labels from the child table metadata, links to each child record, and a View All
 * link when the backend limited the rows. Association editing is handled by the
 * record view, not here.
 */
'use client'

import React from 'react'
import Link from 'next/link'

import type { QRecord } from '@/types'
import { displayText } from './record-lookup-utils'
import { asList, isPlainObject, payloadProblem } from './widget-types'
import type { WidgetComponentProps } from './widget-types'
import { WidgetEmpty, WidgetPayloadNotice } from './WidgetNotice'

/** Field metadata subset used for columns. */
interface ChildFieldMetaData {
  name: string
  label?: string
  isHidden?: boolean
  isHeavy?: boolean
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
}

/** Payload returned by `ChildRecordListRenderer`. */
export interface ChildRecordListPayload {
  type?: string
  title?: string
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
}

/**
 * Chooses the child table's columns: fields in section order (T1 sections first),
 * skipping hidden sections, hidden or heavy fields, and `omitFieldNames`; limited to
 * `onlyIncludeFieldNames` when given. The primary key column comes first.
 *
 * @param table - Child table metadata.
 * @param omit - Field names to leave out.
 * @param only - When non-empty, the only field names to keep.
 * @returns The ordered column fields.
 */
export function childColumns(table: ChildTableMetaData, omit: string[] = [], only: string[] = []): ChildFieldMetaData[] {
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
  if (pk && names.includes(pk)) {
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
 * Renders the child records returned for the hosting record.
 *
 * @param props - Widget props with a `ChildRecordListRenderer` payload.
 * @returns A table of child records, an empty state, or a payload notice.
 */
export function ChildRecordListWidget({ widgetMetaData, data }: WidgetComponentProps<ChildRecordListPayload>) {
  const widgetName = widgetMetaData.name
  const table = data?.childFrontendTableMetaData ?? data?.childTableMetaData
  const queryOutput = data?.queryOutput
  const records = queryOutput === undefined || queryOutput === null ? [] : isPlainObject(queryOutput) ? asList<QRecord>(queryOutput.records) : undefined

  if (!table || !isPlainObject(table) || typeof table.name !== 'string' || records === undefined) {
    return <WidgetPayloadNotice widgetName={widgetName} message={payloadProblem('child record list', 'queryOutput.records and child table metadata')} />
  }

  const tableLabel = table.label ?? table.name
  const columns = childColumns(table, asList<string>(data.omitFieldNames) ?? [], asList<string>(data.onlyIncludeFieldNames) ?? [])
  const primaryKeyField = table.primaryKeyField
  const totalRows = typeof data.totalRows === 'number' ? data.totalRows : undefined
  const viewAllHref = data.viewAllLink ? nextViewAllHref(data.viewAllLink, table.name) : undefined

  return (
    <div className="space-y-2" data-qqq-id={`widget-childRecordList-${widgetName}`}>
      {data.canAddChildRecord === true && (
        <div className="flex justify-end">
          <Link
            href={`/app/${encodeURIComponent(table.name)}/create`}
            className="text-sm font-medium text-primary underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
            data-qqq-id={`child-record-add-${widgetName}`}
          >
            Add new {tableLabel}
          </Link>
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
                  <th key={field.name} scope="col" className="px-2 py-1.5 font-medium text-muted-foreground">
                    {field.label ?? field.name}
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
                return (
                  <tr
                    key={pkText || rowIndex}
                    className="border-b border-border/50 last:border-0"
                    data-qqq-id={`child-record-row-${widgetName}-${pkText || rowIndex}`}
                  >
                    {columns.map((field, columnIndex) => {
                      const display = displayValues[field.name]
                      const text = displayText(display !== undefined && display !== null ? display : values[field.name])
                      return (
                        <td key={field.name} className="px-2 py-1.5 text-foreground">
                          {columnIndex === 0 && href ? (
                            <Link href={href} className="text-primary underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-ring">
                              {text || pkText}
                            </Link>
                          ) : (
                            text
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
