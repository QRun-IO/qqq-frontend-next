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

import React, { useEffect, useRef, useState } from 'react'
import { LayoutGrid, List, MoreVertical, Pencil, Copy, Trash2, Play, X, Check, ClipboardCopy, History } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { QTableMetaData, QRecord, QProcessMetaData, QFieldMetaData, QWidgetMetaData } from '@/types'
import type { AuditSource } from '@/lib/api/audits'
import { cn } from '@/lib/utils/cn'
import { canDeleteRecords, canEditRecords, canInsertRecords } from '@/lib/auth/permissions'

import { RecordActions } from './RecordActions'
import { FieldLabel } from './FieldLabel'
import { FieldValue } from './FieldValue'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'
import { AuditHistoryDialog } from './AuditHistoryDialog'
import { ShareButton } from '@/components/sharing/ShareDialog'

/**
 * Extracts initials from a display label: first letter of each of the first
 * two words ('John Smith' → 'JS'), first two chars for a single word
 * (including CJK and other non-Latin scripts), or '?' for empty/whitespace-only input.
 *
 * Used to populate the 56 × 56 px avatar circle in the record view header.
 *
 * @param label - The display label to abbreviate (e.g. `record.recordLabel`).
 * @returns A one-or-two character uppercase string suitable for an avatar,
 *   or `'?'` when the label is empty or whitespace-only.
 */
function getInitials(label: string): string {
  const trimmed = label.trim()
  if (!trimmed) return '?'
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    return ((words[0][0] ?? '') + (words[1][0] ?? '')).toUpperCase() || '?'
  }
  return trimmed.slice(0, 2).toUpperCase() || '?'
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
  /** How the current user can read audits; `null` hides the Audit action. */
  auditSource?: AuditSource
  /** Widget metadata, for WIDGET-adorned T1 fields. */
  widgetMetaDataMap?: Record<string, QWidgetMetaData>
}

/**
 * Renders the header block of the record detail page.
 *
 * Displays a 56 × 56 px avatar (initials), the record label as an `<h1>`,
 * a compact T1 field grid with hover-card links for possibleValueSource fields,
 * a card/list view-mode radio toggle, and the action bar (desktop) or bottom-
 * sheet trigger (mobile). The mobile bottom sheet mounts a
 * {@link DeleteConfirmDialog} when the Delete action is tapped.
 *
 * @param props - See {@link RecordViewHeaderProps}.
 * @returns The full record header block: avatar + title + T1 grid + view-mode
 *   toggle + action controls. On mobile, also conditionally renders the
 *   bottom-sheet overlay and delete dialog.
 */
export function RecordViewHeader({
  tableMetaData,
  record,
  t1Fields,
  viewMode,
  setViewMode,
  hideActions,
  processes,
  allTables,
  navigateFrom,
  auditSource = null,
  widgetMetaDataMap,
}: RecordViewHeaderProps) {
  const router = useRouter()
  const [auditOpen, setAuditOpen] = useState(false)
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false)
  const [showMobileDeleteDialog, setShowMobileDeleteDialog] = useState(false)
  const [idCopied, setIdCopied] = useState(false)
  const mobileActionsTrigger = useRef<HTMLButtonElement>(null)
  const mobileActionsClose = useRef<HTMLButtonElement>(null)
  const auditTrigger = useRef<HTMLButtonElement>(null)

  /**
   * Closes the phone action sheet and returns focus to its trigger. The sheet's items unmount
   * when it closes, so a dialog opened from one would otherwise restore focus to the body
   * (QRun-IO/qqq#694); focusing the stable trigger first makes it the dialog's return target.
   */
  const closeMobileActions = () => {
    mobileActionsTrigger.current?.focus()
    setMobileActionsOpen(false)
  }

  /**
   * Keeps Tab and Shift+Tab inside the open action sheet (a modal dialog), wrapping at either end.
   *
   * @param event - The keydown event of a Tab press inside the sheet.
   */
  const trapTab = (event: React.KeyboardEvent<HTMLElement>) => {
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]'))
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  // Move focus into the action sheet when it opens, so keyboard and screen-reader users land in it.
  useEffect(() => {
    if (mobileActionsOpen) mobileActionsClose.current?.focus()
  }, [mobileActionsOpen])

  const primaryKey = record.values[tableMetaData.primaryKeyField] as string | number

  /**
   * Copies the record's primary key value to the clipboard.
   * Shows a {@link Check} icon for 2 seconds, then reverts to the copy icon.
   */
  function handleCopyId() {
    void navigator.clipboard.writeText(String(primaryKey)).then(() => {
      setIdCopied(true)
      setTimeout(() => setIdCopied(false), 2000)
    })
  }
  const canEdit = canEditRecords(tableMetaData)
  const canInsert = canInsertRecords(tableMetaData)
  const canDelete = canDeleteRecords(tableMetaData)

  const availableProcesses = (processes ?? []).filter(
    (p) => !p.isHidden && p.hasPermission && (p.maxInputRecords ?? Infinity) >= 1
  )
  // A read-only user gets no Actions trigger on a phone rather than one that opens an empty sheet
  const hasMobileActions = canEdit || canInsert || canDelete || availableProcesses.length > 0

  return (
    <div className="flex flex-wrap items-start gap-4" data-qqq-id="record-view-header">
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
      {/* The title keeps at least 14rem; when the controls do not fit beside it (phones, tablets
          with the sidebar open) they wrap onto their own row instead of squeezing the title. */}
      <div className="min-w-0 flex-1 basis-56">
        <div className="flex items-center gap-2">
          <h1 className="min-w-0 break-words text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            {record.recordLabel || `${tableMetaData.label} #${record.values[tableMetaData.primaryKeyField]}`}
          </h1>
          {/* D-V-5: Copy record ID to clipboard */}
          <button
            type="button"
            onClick={handleCopyId}
            title="Copy record ID"
            aria-label="Copy record ID"
            data-qqq-id="button-copy-record-id"
            className={cn(
              'mt-1 flex-shrink-0 rounded-md p-1 text-muted-foreground',
              'hover:bg-accent hover:text-foreground',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              'transition-colors duration-150'
            )}
          >
            {idCopied
              ? <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
              : <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
            }
          </button>
        </div>
        {/* T1 fields as a compact grid under the name */}
        {t1Fields.length > 0 && (
          <dl
            className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4"
            data-qqq-id="record-primary-sections"
          >
            {t1Fields.map((field) => (
              <div key={field.name} className="flex min-w-0 flex-col" data-qqq-id={`record-field-${field.name}`}>
                <dt className="text-xs text-muted-foreground">
                  <FieldLabel field={field} data-qqq-id={`field-label-${field.name}`} />
                </dt>
                <dd className="min-w-0 text-sm [overflow-wrap:anywhere]">
                  <FieldValue field={field} record={record} allTables={allTables} navigateFrom={navigateFrom} widgetMetaDataMap={widgetMetaDataMap} tableMetaData={tableMetaData} />
                </dd>
              </div>
            ))}
            {/* One-to-one join fields */}

          </dl>
        )}
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 md:w-auto" data-qqq-id="record-view-controls">
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

        {auditSource && (
          <button
            ref={auditTrigger}
            type="button"
            onClick={() => setAuditOpen(true)}
            data-qqq-id="button-audit"
            aria-label={`Audit history for ${record.recordLabel || tableMetaData.label}`}
            className={cn(
              'inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm font-medium',
              'text-foreground bg-card hover:bg-accent',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'transition-colors duration-150'
            )}
          >
            <History className="h-4 w-4" aria-hidden="true" />
            Audit
          </button>
        )}

        {!hideActions && (
          <>
            {/* Desktop: Radix DropdownMenu (already has focus trap via Radix) — MED-17 */}
            <div className="hidden md:flex md:flex-wrap md:items-center md:gap-2">
              {tableMetaData.shareableTableMetaData && <ShareButton tableMetaData={tableMetaData} record={record} />}
              <RecordActions className="flex-wrap" tableMetaData={tableMetaData} record={record} processes={processes} />
            </div>

            {/* Mobile: bottom-sheet trigger button — MED-17 */}
            <div className="flex items-center gap-2 md:hidden">
              {tableMetaData.shareableTableMetaData && <ShareButton tableMetaData={tableMetaData} record={record} />}
              {hasMobileActions && <button
                type="button"
                ref={mobileActionsTrigger}
                onClick={() => setMobileActionsOpen(true)}
                aria-label="Record actions"
                aria-haspopup="dialog"
                aria-expanded={mobileActionsOpen}
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
              </button>}
            </div>
          </>
        )}
      </div>

      {/* Mobile actions bottom-sheet — MED-17 */}
      {mobileActionsOpen && hasMobileActions && (
        <div className="md:hidden" data-qqq-id="mobile-actions-sheet">
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={closeMobileActions}
            aria-hidden="true"
          />
          {/* Bottom sheet panel */}
          <div
            className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[85vh] flex-col rounded-t-xl border-t border-border bg-card shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-label="Record actions"
            data-qqq-id="mobile-actions-panel"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation()
                closeMobileActions()
              } else if (event.key === 'Tab') {
                trapTab(event)
              }
            }}
          >
            {/* Drag handle */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-base font-semibold text-foreground">Actions</span>
              <button
                ref={mobileActionsClose}
                type="button"
                onClick={closeMobileActions}
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

            <div className="flex min-h-0 flex-col overflow-y-auto overscroll-contain py-2" data-qqq-id="mobile-actions-list">
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
                    router.push(`/app/${encodeURIComponent(tableMetaData.name)}/${encodeURIComponent(String(primaryKey))}/copy`)
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
                    closeMobileActions()
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
      {auditSource && (
        <AuditHistoryDialog
          open={auditOpen}
          onOpenChange={setAuditOpen}
          source={auditSource}
          tableMetaData={tableMetaData}
          primaryKey={primaryKey}
          recordLabel={record.recordLabel || String(primaryKey)}
          returnFocusRef={auditTrigger}
        />
      )}

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
