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
 * @file RecordViewHeader — record avatar, title, T1 field grid, and action controls.
 */

'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { LayoutGrid, List, MoreVertical, Pencil, Copy, Trash2, Play, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { QTableMetaData, QRecord, QProcessMetaData, QFieldMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

import { RecordActions } from './RecordActions'
import { RecordHoverCard } from './RecordHoverCard'
import { FieldLabel } from './FieldLabel'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'

/**
 * Extracts up to two uppercase initials from a label string.
 *
 * When the label contains multiple words the first character of each of the
 * first two words is used; otherwise the first two characters of the label
 * are returned.
 *
 * @param label - The display label to abbreviate.
 * @returns A one-or-two character uppercase string suitable for an avatar.
 */
function getInitials(label: string): string {
  const words = label.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return label.slice(0, 2).toUpperCase()
}

/**
 * Props for the {@link RecordViewHeader} component.
 */
interface RecordViewHeaderProps {
  /** Table metadata used for label, primary key field, and field lookups. */
  tableMetaData: QTableMetaData
  /** The record being displayed. */
  record: QRecord
  /** Ordered T1 fields to render as compact key/value pairs under the title. */
  t1Fields: QFieldMetaData[]
  /** One-to-one join definitions used to append joined fields to the T1 dl. */
  oneJoins: QTableMetaData['exposedJoins']
  /** Current view mode controlling which toggle button appears active. */
  viewMode: 'tabs' | 'list'
  /** Callback to switch the view mode. */
  setViewMode: (mode: 'tabs' | 'list') => void
  /** When true, the RecordActions bar is not rendered. */
  hideActions: boolean
  /** Processes available for this table (passed through to RecordActions). */
  processes?: QProcessMetaData[]
  /** Full table metadata map for rendering possibleValueSource fields as hover links. */
  allTables?: Record<string, QTableMetaData>
  /** Navigation context used to build outgoing record links with a back reference. */
  navigateFrom: { path: string; label: string }
}

/**
 * Renders the header block of the record detail page.
 *
 * Contains the avatar, record label, T1 badge chips, the view-mode radio toggle
 * (card / list), and the actions button bar.
 *
 * @param props - See {@link RecordViewHeaderProps}.
 * @returns The record header element including avatar, title, field chips, view toggle, and actions.
 */
export function RecordViewHeader({
  tableMetaData,
  record,
  t1Fields,
  oneJoins,
  viewMode,
  setViewMode,
  hideActions,
  processes,
  allTables,
  navigateFrom,
}: RecordViewHeaderProps) {
  const router = useRouter()
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false)
  const [showMobileDeleteDialog, setShowMobileDeleteDialog] = useState(false)

  const primaryKey = record.values[tableMetaData.primaryKeyField] as string | number
  const canEdit = tableMetaData.editPermission
  const canInsert = tableMetaData.insertPermission
  const canDelete = tableMetaData.deletePermission

  const availableProcesses = (processes ?? []).filter(
    (p) => !p.isHidden && p.hasPermission && (p.maxInputRecords ?? Infinity) >= 1
  )

  return (
    <div className="flex items-start gap-4">
      <div
        className="mt-1 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground"
        aria-hidden="true"
        data-qqq-id="record-avatar"
      >
        {getInitials(
          record.recordLabel ||
          `${tableMetaData.label} ${record.values[tableMetaData.primaryKeyField]}`
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {record.recordLabel || `${tableMetaData.label} #${record.values[tableMetaData.primaryKeyField]}`}
        </h1>
        {/* T1 fields as a compact grid under the name */}
        {t1Fields.length > 0 && (
          <dl
            className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4"
            data-qqq-id="record-primary-sections"
          >
            {t1Fields.map((field) => {
              const displayVal = record.displayValues?.[field.name]
              const rawVal = record.values[field.name]
              const val = displayVal ?? (rawVal != null ? String(rawVal) : null)
              const pvsName = field.possibleValueSourceName
              const refMeta = pvsName ? allTables?.[pvsName] : undefined
              const isLink = Boolean(refMeta) && rawVal != null
              const fromParams = navigateFrom
                ? `?from=${encodeURIComponent(navigateFrom.path)}&fromLabel=${encodeURIComponent(navigateFrom.label)}`
                : ''
              return (
                <div key={field.name} className="flex flex-col" data-qqq-id={`record-field-${field.name}`}>
                  <dt className="text-xs text-muted-foreground">
                    <FieldLabel field={field} data-qqq-id={`field-label-${field.name}`} />
                  </dt>
                  <dd className="text-sm">
                    {val == null ? '\u2014' : isLink && refMeta ? (
                      <RecordHoverCard
                        tableName={pvsName!}
                        primaryKey={rawVal as string | number}
                        tableMetaData={refMeta}
                        navigateFrom={navigateFrom}
                      >
                        <Link
                          href={`/app/${pvsName}/${rawVal}${fromParams}`}
                          className="text-primary hover:text-primary/80 hover:underline"
                        >
                          {val}
                        </Link>
                      </RecordHoverCard>
                    ) : (
                      <span className="text-foreground">{val}</span>
                    )}
                  </dd>
                </div>
              )
            })}
            {/* One-to-one join fields */}
            {oneJoins.map((join) => {
              const joinRecords = record.associatedRecords?.[join.joinTable!.name] ?? []
              if (joinRecords.length === 0) return null
              const joinRecord = joinRecords[0]
              return Object.values(join.joinTable!.fields)
                .filter((f) => !f.isHidden && !f.isHeavy)
                .slice(0, 3)
                .map((field) => {
                  const val = joinRecord.displayValues?.[field.name] ??
                    (joinRecord.values[field.name] != null ? String(joinRecord.values[field.name]) : null)
                  return (
                    <div key={`${join.label}-${field.name}`} className="flex flex-col">
                      <dt className="text-xs text-muted-foreground">{field.label}</dt>
                      <dd className="text-sm text-foreground">{val ?? '\u2014'}</dd>
                    </div>
                  )
                })
            })}
          </dl>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* View mode toggle */}
        <div
          className="flex rounded-lg border border-border bg-muted/50 p-0.5"
          role="radiogroup"
          aria-label="View mode"
          data-qqq-id="record-view-mode-toggle"
        >
          <button
            role="radio"
            aria-checked={viewMode === 'tabs'}
            aria-label="Card view"
            onClick={() => setViewMode('tabs')}
            className={cn(
              'rounded-md p-1.5 transition-colors',
              viewMode === 'tabs'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            role="radio"
            aria-checked={viewMode === 'list'}
            aria-label="List view"
            onClick={() => setViewMode('list')}
            className={cn(
              'rounded-md p-1.5 transition-colors',
              viewMode === 'list'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <List className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {!hideActions && (
          <>
            {/* Desktop: Radix DropdownMenu (already has focus trap via Radix) — MED-17 */}
            <div className="hidden md:flex">
              <RecordActions tableMetaData={tableMetaData} record={record} processes={processes} />
            </div>

            {/* Mobile: bottom-sheet trigger button — MED-17 */}
            <div className="flex md:hidden">
              <button
                type="button"
                onClick={() => setMobileActionsOpen(true)}
                aria-label="Record actions"
                data-qqq-id="button-mobile-actions"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-medium',
                  'text-foreground bg-card hover:bg-accent',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  'transition-colors duration-150'
                )}
              >
                Actions
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Mobile actions bottom-sheet — MED-17 */}
      {mobileActionsOpen && (
        <div className="md:hidden" data-qqq-id="mobile-actions-sheet">
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setMobileActionsOpen(false)}
            aria-hidden="true"
          />
          {/* Bottom sheet panel */}
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-xl border-t border-border bg-card shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-label="Record actions"
          >
            {/* Drag handle */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-base font-semibold text-foreground">Actions</span>
              <button
                type="button"
                onClick={() => setMobileActionsOpen(false)}
                aria-label="Close actions menu"
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full',
                  'text-muted-foreground hover:bg-accent hover:text-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-ring'
                )}
                data-qqq-id="mobile-actions-close"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col py-2">
              {/* Edit */}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileActionsOpen(false)
                    router.push(`/app/${tableMetaData.name}/${primaryKey}/edit`)
                  }}
                  className={cn(
                    'flex items-center gap-3 px-6 py-3.5 text-sm text-foreground',
                    'hover:bg-accent focus:outline-none focus:bg-accent',
                    'transition-colors duration-100'
                  )}
                  data-qqq-id="mobile-action-edit"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Edit {tableMetaData.label}
                </button>
              )}

              {/* Copy */}
              {canInsert && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileActionsOpen(false)
                    router.push(`/app/${tableMetaData.name}/${primaryKey}/copy`)
                  }}
                  className={cn(
                    'flex items-center gap-3 px-6 py-3.5 text-sm text-foreground',
                    'hover:bg-accent focus:outline-none focus:bg-accent',
                    'transition-colors duration-100'
                  )}
                  data-qqq-id="mobile-action-copy"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  Copy {tableMetaData.label}
                </button>
              )}

              {/* Processes */}
              {availableProcesses.map((process) => (
                <button
                  key={process.name}
                  type="button"
                  onClick={() => {
                    setMobileActionsOpen(false)
                    router.push(`/app/${process.name}?recordsParam=recordIds&recordIds=${primaryKey}`)
                  }}
                  className={cn(
                    'flex items-center gap-3 px-6 py-3.5 text-sm text-foreground',
                    'hover:bg-accent focus:outline-none focus:bg-accent',
                    'transition-colors duration-100'
                  )}
                  data-qqq-id={`mobile-action-${process.name}`}
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                  {process.label}
                </button>
              ))}

              {/* Separator before delete */}
              {canDelete && (canEdit || canInsert || availableProcesses.length > 0) && (
                <div className="my-1 h-px bg-border" role="separator" />
              )}

              {/* Delete */}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileActionsOpen(false)
                    setShowMobileDeleteDialog(true)
                  }}
                  className={cn(
                    'flex items-center gap-3 px-6 py-3.5 text-sm text-destructive',
                    'hover:bg-destructive/10 focus:outline-none focus:bg-destructive/10',
                    'transition-colors duration-100'
                  )}
                  data-qqq-id="mobile-action-delete"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete {tableMetaData.label}
                </button>
              )}
            </div>

            {/* Safe area spacer for mobile browsers */}
            <div className="h-safe-area-inset-bottom pb-4" />
          </div>
        </div>
      )}

      {/*
       * Delete dialog triggered from mobile actions sheet.
       * HIGH-4: DeleteConfirmDialog uses @radix-ui/react-dialog (DialogPrimitive.Content) which
       * provides a built-in focus trap, Escape-key dismissal, and focus restoration on close.
       * No additional focus-trap logic is needed — Radix handles it automatically.
       */}
      {showMobileDeleteDialog && (
        <DeleteConfirmDialog
          tableMetaData={tableMetaData}
          record={record}
          onClose={() => setShowMobileDeleteDialog(false)}
          onDeleted={() => {
            router.push(`/app/${tableMetaData.name}`)
          }}
        />
      )}
    </div>
  )
}
