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
 * @file AuditHistoryDialog — a record's audit history (who changed what, when).
 */

'use client'

import React, { useEffect, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ArrowDown, ArrowUp, History, X } from 'lucide-react'

import type { QAuditRecord, QTableMetaData } from '@/types'
import type { AuditSource } from '@/lib/api/audits'
import { cn } from '@/lib/utils/cn'
import { formatDateTime } from '@/lib/utils/datetime-utils'
import { getErrorStatusCode } from '@/lib/utils/error-utils'
import { useAuditRecords } from '@/lib/hooks/use-audit-records'

/**
 * Props for {@link AuditHistoryDialog}.
 */
interface AuditHistoryDialogProps {
  /** Whether the dialog is open. */
  open: boolean
  /** Called when the dialog asks to open or close. */
  onOpenChange: (open: boolean) => void
  /** How the current user can read audits. */
  source: AuditSource
  /** The audited table. */
  tableMetaData: QTableMetaData
  /** The record's primary key. */
  primaryKey: string | number
  /** The record label for the heading. */
  recordLabel: string
  /**
   * Control that gets focus back when the dialog closes (its trigger). Safari and WebKit do not
   * focus a button on click, so Radix alone would return focus to the page body.
   */
  returnFocusRef?: React.RefObject<HTMLElement | null>
}

/**
 * Status line for the loaded history, worded like the Material dashboard.
 *
 * @param count - Number of audits.
 * @param total - Total available audits, when the response reached its cap.
 * @returns The sentence.
 */
function countSentence(count: number, total: number | null): string {
  if (count === 0) return 'No audits were found for this record.'
  if (total !== null && total > count) return `Showing first ${count.toLocaleString()} of ${total.toLocaleString()} audit details for this record`
  if (count === 1) return 'Showing the only audit for this record'
  if (count === 2) return 'Showing the only 2 audits for this record'
  return `Showing all ${count.toLocaleString()} audits for this record`
}

/**
 * Date in the viewer's time zone, matching the displayed audit timestamps.
 * @param timestamp - The audit instant.
 * @returns A local calendar date.
 */
function localAuditDate(timestamp: string): string {
  return formatDateTime(timestamp)?.split(' ')[0] ?? timestamp
}

/**
 * Keeps adjacent entries with the same local calendar date together.
 * @param records - Audits in the requested sort order.
 * @returns Consecutive groups with matching local dates.
 */
function groupAuditsByDate(records: QAuditRecord[]): QAuditRecord[][] {
  const groups: QAuditRecord[][] = []
  for (const record of records) {
    const group = groups[groups.length - 1]
    if (!group || localAuditDate(group[0].timestamp) !== localAuditDate(record.timestamp)) groups.push([record])
    else group.push(record)
  }
  return groups
}

/**
 * Date heading with the same Today and Yesterday hints as Material.
 * @param timestamp - The first audit instant in a group.
 * @returns A readable date heading.
 */
function dateHeading(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return timestamp
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const day = localAuditDate(timestamp)
  const hint = day === localAuditDate(today.toISOString()) ? ' (Today)' : day === localAuditDate(yesterday.toISOString()) ? ' (Yesterday)' : ''
  return `${new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date)} ${day}${hint}`
}

/**
 * Modal listing a record's audits newest first: time, user, message and each
 * field-level change the backend recorded.
 *
 * @param props - See {@link AuditHistoryDialogProps}.
 * @returns The dialog.
 */
export function AuditHistoryDialog({ open, onOpenChange, source, tableMetaData, primaryKey, recordLabel, returnFocusRef }: AuditHistoryDialogProps) {
  const [isSortAscending, setSortAscending] = useState(false)
  const [sortReady, setSortReady] = useState(false)
  useEffect(() => {
    setSortAscending(localStorage.getItem('audit.sortDirection') === 'true')
    setSortReady(true)
  }, [])
  const { auditRecords, total, isLoading, isError, error } = useAuditRecords({
    source, tableName: tableMetaData.name, primaryKey, enabled: open && sortReady, isSortAscending,
  })

  let status: string
  if (isLoading) status = 'Loading audits...'
  else if (isError) status = getErrorStatusCode(error) === 403 ? 'You do not have permission to view audits' : 'Error loading audits'
  else status = countSentence(auditRecords.length, total)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          data-qqq-id="audit-history-dialog"
          aria-describedby="audit-history-status"
          onCloseAutoFocus={(event) => {
            const target = returnFocusRef?.current
            if (!target) return
            event.preventDefault()
            target.focus()
          }}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'flex max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl flex-col',
            'rounded-xl border border-border bg-card shadow-lg focus:outline-none'
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
            <DialogPrimitive.Title className="text-lg font-semibold tracking-tight text-foreground">
              Audit for {tableMetaData.label}: {recordLabel}
            </DialogPrimitive.Title>
            <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Audit sort order">
              <button type="button" aria-label="Sort by time ascending (oldest to newest)" aria-pressed={isSortAscending}
                onClick={() => { setSortAscending(true); localStorage.setItem('audit.sortDirection', 'true') }}
                data-qqq-id="button-audit-sort-ascending"
                className={cn('rounded-lg p-2 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring', isSortAscending ? 'bg-accent text-foreground' : 'text-muted-foreground')}>
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" aria-label="Sort by time descending (newest to oldest)" aria-pressed={!isSortAscending}
                onClick={() => { setSortAscending(false); localStorage.setItem('audit.sortDirection', 'false') }}
                data-qqq-id="button-audit-sort-descending"
                className={cn('rounded-lg p-2 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring', !isSortAscending ? 'bg-accent text-foreground' : 'text-muted-foreground')}>
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <DialogPrimitive.Close
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Close audit history"
              data-qqq-id="button-close-audit-history"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          <p id="audit-history-status" role={isError ? 'alert' : 'status'} data-qqq-id="audit-history-status"
            className={cn('border-b border-border px-6 py-3 text-sm', isError ? 'text-destructive' : 'text-muted-foreground')}>
            {status}
          </p>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {!isLoading && !isError && auditRecords.length === 0 && (
              <History className="mx-auto h-10 w-10 text-muted-foreground/30" aria-hidden="true" />
            )}
            <ol aria-label="Audits">
              {groupAuditsByDate(auditRecords).map((group) => (
                <li key={`${localAuditDate(group[0].timestamp)}-${group[0].id}`}>
                  <h3 className="sticky top-0 z-10 my-3 border-b border-border bg-card py-2 text-center text-sm font-medium text-muted-foreground"
                    data-qqq-id="audit-date-heading">{dateHeading(group[0].timestamp)}</h3>
                  <ol className="space-y-4">{group.map((entry) => <AuditEntry key={entry.id} entry={entry} tableMetaData={tableMetaData} />)}</ol>
                </li>
              ))}
            </ol>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/**
 * One audit: when, who, the message and its field-level changes.
 *
 * @param props - Component properties.
 * @param props.entry - The audit.
 * @param props.tableMetaData - Audited table metadata (field labels).
 * @returns The list item.
 */
function AuditEntry({ entry, tableMetaData }: { entry: QAuditRecord; tableMetaData: QTableMetaData }) {
  return (
    <li className="rounded-lg border border-border p-3" data-qqq-id={`audit-entry-${entry.id}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 text-xs text-muted-foreground">
        <time dateTime={entry.timestamp} data-qqq-id="audit-entry-timestamp">{formatDateTime(entry.timestamp) ?? entry.timestamp}</time>
        {entry.user && <span data-qqq-id="audit-entry-user">{entry.user}</span>}
      </div>
      {entry.message && <p className="mt-1 text-sm font-medium text-foreground" data-qqq-id="audit-entry-message">{entry.message}</p>}
      {entry.fieldChanges.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground" aria-label="Changes">
          {entry.fieldChanges.map((change, index) => (
            <li key={`${change.fieldName}-${index}`} data-qqq-id={`audit-detail-${change.fieldName}`}>
              {change.message ?? describeChange(tableMetaData.fields[change.fieldName]?.label ?? change.fieldName, change.oldValue, change.newValue)}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * Describes a change that arrived without the backend's sentence.
 *
 * @param label - Field label.
 * @param oldValue - Previous value.
 * @param newValue - New value.
 * @returns The sentence.
 */
function describeChange(label: string, oldValue: unknown, newValue: unknown): string {
  const empty = (value: unknown) => value === null || value === undefined || value === ''
  if (empty(oldValue)) return `${label}: Set to ${String(newValue)}`
  if (empty(newValue)) return `${label}: Removed value ${String(oldValue)}`
  return `${label}: Changed from ${String(oldValue)} to ${String(newValue)}`
}
