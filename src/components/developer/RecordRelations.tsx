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
 * @file Record developer view sections for how the record relates to others (associations,
 * exposed joins and the records its fields reference) and a summary of its recent audits.
 */

'use client'

import React, { useRef, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'

import type { QRecord, QTableMetaData } from '@/types'
import { getAuditRecords, type AuditSource } from '@/lib/api/audits'
import { HANDLES_OWN_ERRORS, queryKeys } from '@/lib/query-client'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { DateTimeText } from '@/components/ui/DateTimeText'
import { AuditHistoryDialog } from '@/components/records/AuditHistoryDialog'
import { PanelTable } from './DeveloperPanelView'

/**
 * Whether the record has anything to show in {@link RecordRelations}.
 * @param table - Table metadata.
 * @param record - The record.
 * @param allTables - Tables the user can see.
 * @returns True when there are associations, joins or references.
 */
export function hasRelations(table: QTableMetaData, record: QRecord, allTables?: Record<string, QTableMetaData>): boolean {
  return Boolean(table.associations?.length || table.exposedJoins?.length || references(table, record, allTables).length)
}

/**
 * Fields of the record whose values reference records of other visible tables.
 * @param table - Table metadata.
 * @param record - The record.
 * @param allTables - Tables the user can see.
 * @returns Field label, target table and key, for set values only.
 */
function references(table: QTableMetaData, record: QRecord, allTables?: Record<string, QTableMetaData>) {
  return Object.values(table.fields ?? {}).flatMap((field) => {
    const target = field.possibleValueSourceName && allTables?.[field.possibleValueSourceName]
    const value = record.values[field.name]
    if (!target || value === null || value === undefined || value === '') return []
    return [{ field, target, value: String(value), label: record.displayValues?.[field.name] ?? String(value) }]
  })
}

/**
 * Associations, exposed joins and references of the record.
 *
 * @param props - Table, record and visible tables.
 * @param props.table - Table metadata.
 * @param props.record - The record.
 * @param props.allTables - Tables the user can see (for labels and links).
 * @returns The relation lists.
 */
export function RecordRelations({ table, record, allTables }: { table: QTableMetaData; record: QRecord; allTables?: Record<string, QTableMetaData> }) {
  const refs = references(table, record, allTables)
  const tableLabel = (name: string) => allTables?.[name]?.label ?? name
  return (
    <div className="space-y-4">
      {refs.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">References</h3>
          <ul className="m-0 list-none space-y-1 p-0 text-sm">
            {refs.map(({ field, target, value, label }) => (
              <li key={field.name} className="flex flex-wrap gap-x-2">
                <span className="text-muted-foreground">{field.label}</span>
                <Link className="text-primary hover:underline" href={`/app/${encodeURIComponent(target.name)}/${encodeURIComponent(value)}`}>{label}</Link>
                <span className="text-muted-foreground">({target.label})</span>
                <Link className="text-xs text-primary hover:underline" href={`/app/${encodeURIComponent(target.name)}/${encodeURIComponent(value)}/dev`}>developer view</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {Boolean(table.associations?.length) && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Associations</h3>
          <PanelTable
            columns={['Name', 'Associated table', 'Join', 'Type', 'Join on']}
            rows={(table.associations ?? []).map((association) => [
              association.name,
              `${tableLabel(association.associatedTableName)} (${association.associatedTableName})`,
              association.join?.name ?? '',
              association.join?.type ?? '',
              (association.join?.joinOns ?? []).map((on) => `${on.leftField} = ${on.rightField}`).join(', '),
            ])}
          />
        </div>
      )}
      {Boolean(table.exposedJoins?.length) && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Exposed joins</h3>
          <PanelTable
            columns={['Label', 'Table', 'Cardinality', 'Path']}
            rows={(table.exposedJoins ?? []).map((join) => [
              join.label,
              join.joinTable ? `${join.joinTable.label} (${join.joinTable.name})` : '',
              join.isMany ? 'many' : 'one',
              (join.joinPath ?? []).map((step) => step.name).join(' > '),
            ])}
          />
        </div>
      )}
    </div>
  )
}

/** How many audits the summary lists. */
const RECENT_AUDITS = 5

/**
 * The record's latest audits, with a button for the full history dialog.
 *
 * @param props - Audit source, table and record.
 * @param props.source - How the user reads audits.
 * @param props.table - Table metadata.
 * @param props.primaryKey - The record's key.
 * @param props.recordLabel - The record's label.
 * @returns The summary.
 */
export function RecentAuditSummary({ source, table, primaryKey, recordLabel }: { source: Exclude<AuditSource, null>; table: QTableMetaData; primaryKey: string | number; recordLabel: string }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKeys.recordDeveloper(table.name, primaryKey), 'recentAudits'],
    queryFn: () => getAuditRecords(source, table.name, primaryKey),
    meta: HANDLES_OWN_ERRORS,
    retry: false,
  })
  const audits = data?.records ?? []

  return (
    <div className="space-y-3">
      {isLoading && <p role="status" className="text-sm text-muted-foreground">Loading audits…</p>}
      {error && <p role="alert" className="text-sm text-destructive">Audits could not be loaded: {getErrorMessage(error)}</p>}
      {data && audits.length === 0 && <p className="text-sm italic text-muted-foreground">This record has no audits.</p>}
      {audits.length > 0 && (
        <ol className="m-0 list-none space-y-2 p-0">
          {audits.slice(0, RECENT_AUDITS).map((audit) => (
            <li key={audit.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-l-2 border-border pl-3 text-sm">
              <span className="font-mono text-xs font-semibold text-foreground">{audit.action}</span>
              <DateTimeText value={audit.timestamp} type="DATE_TIME" className="text-xs text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{audit.user}</span>
              <span className="min-w-0 basis-full break-words text-sm text-foreground">
                {audit.message || `${audit.fieldChanges?.length ?? 0} field change${audit.fieldChanges?.length === 1 ? '' : 's'}`}
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {data && <span className="text-xs text-muted-foreground">{data.total ?? audits.length} audit{(data.total ?? audits.length) === 1 ? '' : 's'} in all</span>}
        <button
          ref={trigger}
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-input bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-qqq-id="dev-open-audit-history"
        >
          Full audit history
        </button>
      </div>
      <AuditHistoryDialog open={open} onOpenChange={setOpen} source={source} tableMetaData={table} primaryKey={primaryKey} recordLabel={recordLabel} returnFocusRef={trigger} />
    </div>
  )
}
