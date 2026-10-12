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
 * @file RecordFieldValues — every field of the record on the developer view: label and name, type
 * (with possible-value source and adornments), the value as the record screen shows it, and the
 * raw value. A filter box narrows the list; phones get stacked cards instead of a wide table.
 */

'use client'

import React, { useMemo, useState } from 'react'

import type { QFieldMetaData, QRecord, QTableMetaData, QWidgetMetaData } from '@/types'
import { FieldValue } from '@/components/records/FieldValue'

/** Props for {@link RecordFieldValues}. */
export interface RecordFieldValuesProps {
  table: QTableMetaData
  record: QRecord
  allTables?: Record<string, QTableMetaData>
  widgetMetaDataMap?: Record<string, QWidgetMetaData>
  navigateFrom: { path: string; label: string }
}

/**
 * Formats a raw value as JSON text (strings unquoted).
 * @param value - Raw value.
 * @returns Display text.
 */
export function rawText(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

/**
 * Describes a field's type extras: possible-value source and adornments.
 * @param field - The field.
 * @returns Short tags.
 */
export function fieldTags(field: QFieldMetaData): string[] {
  const tags: string[] = []
  if (field.possibleValueSourceName) tags.push(`PVS ${field.possibleValueSourceName}`)
  else if (field.inlinePossibleValueSource) tags.push('inline PVS')
  for (const adornment of field.adornments ?? []) tags.push(adornment.type)
  if (field.isRequired) tags.push('required')
  if (!field.isEditable) tags.push('read-only')
  if (field.isHidden) tags.push('hidden')
  return tags
}

/**
 * The field list.
 *
 * @param props - See {@link RecordFieldValuesProps}.
 * @returns Filter box, table (sm and up) and cards (phones).
 */
export function RecordFieldValues({ table, record, allTables, widgetMetaDataMap, navigateFrom }: RecordFieldValuesProps) {
  const [filter, setFilter] = useState('')
  // the table's fields in metadata order, then any value the record carries without a field (joins)
  const names = useMemo(() => [...new Set([...Object.keys(table.fields ?? {}), ...Object.keys(record.values)])], [table.fields, record.values])
  const needle = filter.trim().toLowerCase()
  const shown = names.filter((name) => {
    if (!needle) return true
    const field = table.fields?.[name]
    return name.toLowerCase().includes(needle) || field?.label?.toLowerCase().includes(needle) || rawText(record.values[name]).toLowerCase().includes(needle)
  })

  return (
    <div className="space-y-3">
      <label className="flex max-w-sm flex-col gap-1 text-xs font-medium text-muted-foreground">
        Filter fields
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Name, label or value"
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          data-qqq-id="dev-field-filter"
        />
      </label>
      <p className="text-xs text-muted-foreground" aria-live="polite">{shown.length} of {names.length} fields</p>

      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <table className="min-w-full text-sm" data-qqq-id="record-dev-field-table">
          <thead className="bg-muted/60">
            <tr>
              <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-foreground">Field</th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-foreground">Type</th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-foreground">Value</th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-foreground">Raw</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((name) => {
              const field = table.fields?.[name]
              return (
                <tr key={name} className="border-t border-border align-top" data-qqq-id={`dev-field-${name}`}>
                  <td className="px-3 py-2">
                    <div className="text-sm text-foreground">{field?.label ?? name}</div>
                    <div className="font-mono text-xs text-primary">{name}{name === table.primaryKeyField ? ' (primary key)' : ''}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs text-muted-foreground">{field?.type ?? '—'}</div>
                    {field && <TagList tags={fieldTags(field)} />}
                  </td>
                  <td className="max-w-[24rem] px-3 py-2 text-sm [overflow-wrap:anywhere]">
                    {field ? <FieldValue field={field} record={record} allTables={allTables} navigateFrom={navigateFrom} widgetMetaDataMap={widgetMetaDataMap} tableMetaData={table} /> : rawText(record.displayValues?.[name] ?? record.values[name])}
                  </td>
                  <td className="max-w-[24rem] px-3 py-2 font-mono text-xs text-foreground [overflow-wrap:anywhere]">
                    <RawValue value={record.values[name]} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ul className="m-0 list-none space-y-2 p-0 md:hidden">
        {shown.map((name) => {
          const field = table.fields?.[name]
          return (
            <li key={name} className="rounded-lg border border-border p-3" data-qqq-id={`dev-field-card-${name}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="text-sm font-medium text-foreground">{field?.label ?? name}</span>
                <span className="font-mono text-xs text-muted-foreground">{field?.type ?? ''}</span>
              </div>
              <div className="font-mono text-xs text-primary">{name}</div>
              {field && <TagList tags={fieldTags(field)} />}
              <div className="mt-2 text-sm [overflow-wrap:anywhere]">
                {field ? <FieldValue field={field} record={record} allTables={allTables} navigateFrom={navigateFrom} widgetMetaDataMap={widgetMetaDataMap} tableMetaData={table} /> : rawText(record.values[name])}
              </div>
              <div className="mt-1 font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">raw: <RawValue value={record.values[name]} /></div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * A raw value, with null in italics.
 * @param props - The value.
 * @param props.value - Raw value.
 * @returns The text.
 */
function RawValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="italic text-muted-foreground">null</span>
  return <>{rawText(value)}</>
}

/**
 * Small tags under a type.
 * @param props - The tags.
 * @param props.tags - Tag texts.
 * @returns The tag list, or nothing.
 */
function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {tags.map((tag) => <span key={tag} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{tag}</span>)}
    </div>
  )
}
