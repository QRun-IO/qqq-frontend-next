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
 * @file RecordInfoFooter — footer showing created/modified timestamps and a searchable audit history dialog.
 */

'use client'

import React, { useState, useMemo } from 'react'
import { Clock, History, ArrowRight, User, Plus, Pencil, Trash2, X, Search } from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'

import type { QTableMetaData, QRecord, QTableSection } from '@/types'
import type { QAuditRecord } from '@/types'
import { cn } from '@/lib/utils/cn'
import { useAuditRecords } from '@/lib/hooks/use-audit-records'

interface RecordInfoFooterProps {
  tableMetaData: QTableMetaData
  record: QRecord
  /** T3 "record info" sections containing createDate/modifyDate fields */
  recordInfoSections: QTableSection[]
  className?: string
}

/**
 * RecordInfoFooter — displays created/modified timestamps and a "Change History" button.
 *
 * Derives timestamp values from T3 audit section fields (createDate, modifyDate).
 * Clicking "Change History" opens the AuditHistoryDialog with searchable timeline entries.
 *
 * @param props - Component properties.
 * @returns A footer element with timestamps and a history dialog trigger, or `null` when no data exists.
 */
export function RecordInfoFooter({
  tableMetaData,
  record,
  recordInfoSections,
  className,
}: RecordInfoFooterProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  const primaryKey = record.values[tableMetaData.primaryKeyField] as string | number

  // Collect all fields from record info sections
  const infoFields = recordInfoSections.flatMap((s) =>
    s.fieldNames
      .map((fn) => tableMetaData.fields[fn])
      .filter((f) => f && !f.isHidden)
  )

  const createdField = infoFields.find((f) =>
    f.name === 'createDate' || f.name === 'createdDate' || f.name === 'createdAt'
  )
  const modifiedField = infoFields.find((f) =>
    f.name === 'modifyDate' || f.name === 'modifiedDate' || f.name === 'updatedAt'
  )

  const rawCreated = createdField
    ? (record.displayValues?.[createdField.name] ?? record.values[createdField.name])
    : null
  const createdValue: string | null = rawCreated != null ? String(rawCreated) : null

  const rawModified = modifiedField
    ? (record.displayValues?.[modifiedField.name] ?? record.values[modifiedField.name])
    : null
  const modifiedValue: string | null = rawModified != null ? String(rawModified) : null

  if (!createdValue && !modifiedValue && recordInfoSections.length === 0) {
    return null
  }

  const recordLabel = record.recordLabel || `${tableMetaData.label} #${primaryKey}`

  return (
    <>
      <div
        className={cn('rounded-xl border border-border bg-muted/30', className)}
        data-qqq-id="record-info-footer"
      >
        <div className="flex items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-8">
            {createdValue && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground/60" aria-hidden="true" />
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Created</span>
                  <span className="text-sm text-foreground">{String(createdValue)}</span>
                </div>
              </div>
            )}
            {modifiedValue && (
              <div className="flex items-center gap-2">
                <Pencil className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden="true" />
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Modified</span>
                  <span className="text-sm text-foreground">{String(modifiedValue)}</span>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              'border border-border bg-card text-muted-foreground shadow-sm',
              'hover:text-foreground hover:bg-accent',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1'
            )}
            data-qqq-id="button-open-audit-history"
          >
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            Change History
          </button>
        </div>
      </div>

      <AuditHistoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tableName={tableMetaData.name}
        primaryKey={primaryKey}
        recordLabel={recordLabel}
        tableMetaData={tableMetaData}
      />
    </>
  )
}

// --- Audit history dialog ---

/**
 * AuditHistoryDialog — searchable timeline dialog listing all audit entries for a record.
 *
 * Fetches audit records via `useAuditRecords` when the dialog is open and
 * filters them client-side as the user types into the search input.
 *
 * @param props - Component properties.
 * @returns A Radix Dialog portal with a scrollable timeline of audit entries.
 */
function AuditHistoryDialog({
  open,
  onOpenChange,
  tableName,
  primaryKey,
  recordLabel,
  tableMetaData,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tableName: string
  primaryKey: string | number
  recordLabel: string
  tableMetaData: QTableMetaData
}) {
  const [searchTerm, setSearchTerm] = useState('')

  const { auditRecords, isLoading } = useAuditRecords({
    tableName,
    primaryKey,
    enabled: open,
  })

  // Client-side search across all audit entry text
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return auditRecords
    const q = searchTerm.toLowerCase()
    return auditRecords.filter((entry) => {
      if (entry.action.toLowerCase().includes(q)) return true
      if (entry.user?.toLowerCase().includes(q)) return true
      if (entry.message?.toLowerCase().includes(q)) return true
      const date = new Date(entry.timestamp)
      const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      if (formatted.toLowerCase().includes(q)) return true
      return entry.fieldChanges.some((change) => {
        const fieldMeta = tableMetaData.fields[change.fieldName]
        const fieldLabel = fieldMeta?.label ?? change.fieldName
        if (fieldLabel.toLowerCase().includes(q)) return true
        if (change.fieldName.toLowerCase().includes(q)) return true
        if (change.oldValue != null && String(change.oldValue).toLowerCase().includes(q)) return true
        if (change.newValue != null && String(change.newValue).toLowerCase().includes(q)) return true
        return false
      })
    })
  }, [auditRecords, searchTerm, tableMetaData.fields])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/50',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0'
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-full max-w-2xl max-h-[85vh] flex flex-col',
            'rounded-xl border border-border bg-card shadow-lg',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95'
          )}
          aria-describedby={undefined}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <DialogPrimitive.Title className="text-lg font-semibold tracking-tight text-foreground">
                Change History
              </DialogPrimitive.Title>
              <p className="mt-0.5 text-sm text-muted-foreground">{recordLabel}</p>
            </div>
            <DialogPrimitive.Close
              className={cn(
                'rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-accent',
                'focus:outline-none focus:ring-2 focus:ring-ring'
              )}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Search bar */}
          <div className="border-b border-border px-6 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search by field, value, user, or message..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  'w-full rounded-lg border border-input bg-background py-2 pl-10 pr-9 text-sm',
                  'placeholder:text-muted-foreground/50',
                  'focus:outline-none focus:ring-2 focus:ring-ring'
                )}
                data-qqq-id="input-audit-search"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Timeline content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-16">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">Loading history...</span>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="py-16 text-center">
                <History className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" aria-hidden="true" />
                <p className="text-sm font-medium text-muted-foreground">
                  {searchTerm
                    ? `No results for "${searchTerm}"`
                    : 'No change history available'}
                </p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[15px] top-4 bottom-4 w-px bg-border" aria-hidden="true" />

                <div className="space-y-1">
                  {filteredRecords.map((entry) => (
                    <AuditEntry
                      key={entry.id}
                      entry={entry}
                      tableMetaData={tableMetaData}
                      searchTerm={searchTerm}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer with result count */}
          {!isLoading && auditRecords.length > 0 && (
            <div className="border-t border-border px-6 py-3">
              <p className="text-xs text-muted-foreground">
                {searchTerm
                  ? `Showing ${filteredRecords.length} of ${auditRecords.length} entries`
                  : `${auditRecords.length} ${auditRecords.length === 1 ? 'entry' : 'entries'}`}
              </p>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// --- Audit entry ---

const ACTION_CONFIG = {
  INSERT: {
    icon: Plus,
    label: 'Created',
    badgeClass: 'bg-emerald-100 text-emerald-950 dark:bg-emerald-900/50 dark:text-emerald-100',
  },
  UPDATE: {
    icon: Pencil,
    label: 'Updated',
    badgeClass: 'bg-blue-100 text-blue-950 dark:bg-blue-900/50 dark:text-blue-100',
  },
  DELETE: {
    icon: Trash2,
    label: 'Deleted',
    badgeClass: 'bg-red-100 text-red-950 dark:bg-red-900/50 dark:text-red-100',
  },
} as const

/**
 * Highlights the first occurrence of `query` within `text` using a `<mark>` element.
 *
 * @param props - Component properties.
 * @returns A React fragment with the matched portion wrapped in a `<mark>` tag.
 */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200/80 text-inherit dark:bg-yellow-700/40 rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

/**
 * AuditEntry — renders a single audit timeline entry with field-change details.
 *
 * Displays the action badge, timestamp, user, optional message, and a table
 * of field changes. Matching text in each cell is highlighted via HighlightMatch.
 *
 * @param props - Component properties.
 * @returns A timeline row element for the given audit record.
 */
function AuditEntry({
  entry,
  tableMetaData,
  searchTerm,
}: {
  entry: QAuditRecord
  tableMetaData: QTableMetaData
  searchTerm: string
}) {
  const config = ACTION_CONFIG[entry.action]
  const Icon = config.icon

  const date = new Date(entry.timestamp)
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return (
    <div className="relative flex gap-4 py-3">
      {/* Timeline dot */}
      <div className="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-card border border-border shadow-sm">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none',
            config.badgeClass
          )}>
            {config.label}
          </span>
          <span className="text-xs text-muted-foreground">
            {formattedDate} at {formattedTime}
          </span>
          {entry.user && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" aria-hidden="true" />
              <HighlightMatch text={entry.user} query={searchTerm} />
            </span>
          )}
        </div>

        {/* Message */}
        {entry.message && (
          <p className="mt-1 text-[13px] text-foreground/80">
            <HighlightMatch text={entry.message} query={searchTerm} />
          </p>
        )}

        {/* Field changes */}
        {entry.fieldChanges.length > 0 && (
          <div className="mt-2 overflow-hidden rounded-lg border border-border">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Field</th>
                  {entry.action !== 'INSERT' && (
                    <th className="px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Before</th>
                  )}
                  <th className="px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {entry.action === 'INSERT' ? 'Value' : 'After'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {entry.fieldChanges.map((change) => {
                  const fieldMeta = tableMetaData.fields[change.fieldName]
                  const fieldLabel = fieldMeta?.label ?? change.fieldName
                  const oldStr = change.oldValue != null ? String(change.oldValue) : null
                  const newStr = change.newValue != null ? String(change.newValue) : null
                  return (
                    <tr key={change.fieldName}>
                      <td className="px-3 py-1.5 text-xs font-medium text-foreground">
                        <HighlightMatch text={fieldLabel} query={searchTerm} />
                      </td>
                      {entry.action !== 'INSERT' && (
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">
                          {oldStr != null ? <HighlightMatch text={oldStr} query={searchTerm} /> : '\u2014'}
                        </td>
                      )}
                      <td className="px-3 py-1.5 text-xs text-foreground">
                        {entry.action !== 'INSERT' && oldStr != null && (
                          <ArrowRight className="mr-1 inline h-3 w-3 text-muted-foreground/50" aria-hidden="true" />
                        )}
                        {newStr != null ? <HighlightMatch text={newStr} query={searchTerm} /> : '\u2014'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
