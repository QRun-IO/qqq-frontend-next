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
 * @file RecordActions — edit/delete/copy action buttons for a record view page.
 */

'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Pencil, Copy, Trash2, MoreVertical, Play } from 'lucide-react'

import type { QTableMetaData, QRecord, QProcessMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

import { DeleteConfirmDialog } from './DeleteConfirmDialog'

interface RecordActionsProps {
  tableMetaData: QTableMetaData
  record: QRecord
  processes?: QProcessMetaData[]
  className?: string
}

/**
 * RecordActions — renders edit, copy, delete, and process action buttons for a record.
 *
 * When processes are available, actions are grouped into a Radix dropdown menu
 * with Edit as a standalone button for quick access. Without processes, all
 * permitted actions are shown as individual buttons.
 *
 * @param props - Component properties.
 * @returns A React fragment with a `<div>` of action controls followed by an
 *   optional {@link DeleteConfirmDialog} portal. When processes are present,
 *   the layout is Edit button + "Actions" dropdown (Copy, processes, Delete).
 *   When no processes exist, all permitted actions are rendered as individual
 *   buttons in a row.
 */
export function RecordActions({ tableMetaData, record, processes, className }: RecordActionsProps) {
  const router = useRouter()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const primaryKey = record.values[tableMetaData.primaryKeyField] as string | number

  const canEdit = tableMetaData.editPermission
  const canDelete = tableMetaData.deletePermission
  const canInsert = tableMetaData.insertPermission

  // Filter to visible, permitted processes that accept single records
  const availableProcesses = (processes ?? []).filter(
    (p) => !p.isHidden && p.hasPermission && (p.maxInputRecords ?? Infinity) >= 1
  )

  const hasProcesses = availableProcesses.length > 0

  return (
    <>
      <div
        className={cn('flex items-center gap-2', className)}
        data-qqq-id={`record-actions-${tableMetaData.name}`}
      >
        {/* Standalone buttons shown when no processes exist */}
        {!hasProcesses && (
          <>
            {canEdit && (
              <button
                type="button"
                onClick={() => router.push(`/app/${tableMetaData.name}/${primaryKey}/edit`)}
                data-qqq-id="button-edit"
                aria-label={`Edit ${tableMetaData.label} record`}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm font-medium',
                  'text-foreground bg-card hover:bg-accent',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  'transition-colors duration-150'
                )}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </button>
            )}

            {canInsert && (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/app/${encodeURIComponent(tableMetaData.name)}/${encodeURIComponent(String(primaryKey))}/copy`
                  )
                }
                data-qqq-id="button-copy"
                aria-label={`Copy ${tableMetaData.label} record`}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm font-medium',
                  'text-foreground bg-card hover:bg-accent',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  'transition-colors duration-150'
                )}
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                Copy
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                onClick={() => setShowDeleteDialog(true)}
                data-qqq-id="button-delete"
                aria-label={`Delete ${tableMetaData.label} record`}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md border border-destructive/30 px-3 py-2 text-sm font-medium',
                  'text-destructive bg-card hover:bg-destructive/10',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  'transition-colors duration-150'
                )}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </button>
            )}
          </>
        )}

        {/* Dropdown menu shown when processes are available */}
        {hasProcesses && (
          <>
            {/* Keep Edit as a standalone button for quick access */}
            {canEdit && (
              <button
                type="button"
                onClick={() => router.push(`/app/${tableMetaData.name}/${primaryKey}/edit`)}
                data-qqq-id="button-edit"
                aria-label={`Edit ${tableMetaData.label} record`}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm font-medium',
                  'text-foreground bg-card hover:bg-accent',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  'transition-colors duration-150'
                )}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </button>
            )}

            <DropdownMenuPrimitive.Root>
              <DropdownMenuPrimitive.Trigger asChild>
                <button
                  type="button"
                  data-qqq-id="record-action-menu"
                  aria-label="Record actions menu"
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
              </DropdownMenuPrimitive.Trigger>

              <DropdownMenuPrimitive.Portal>
                <DropdownMenuPrimitive.Content
                  align="end"
                  sideOffset={4}
                  className={cn(
                    'z-50 min-w-[180px] overflow-hidden rounded-md border border-border bg-card shadow-lg',
                    'animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2'
                  )}
                >
                  {/* Edit */}
                  {canEdit && (
                    <DropdownMenuPrimitive.Item
                      onSelect={() => router.push(`/app/${tableMetaData.name}/${primaryKey}/edit`)}
                      data-qqq-id="record-action-edit"
                      className={cn(
                        'relative flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-sm',
                        'text-foreground',
                        'outline-none data-[highlighted]:bg-accent',
                        'transition-colors duration-100'
                      )}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Edit
                    </DropdownMenuPrimitive.Item>
                  )}

                  {/* Copy */}
                  {canInsert && (
                    <DropdownMenuPrimitive.Item
                      onSelect={() => router.push(`/app/${encodeURIComponent(tableMetaData.name)}/${encodeURIComponent(String(primaryKey))}/copy`)}
                      data-qqq-id="record-action-copy"
                      className={cn(
                        'relative flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-sm',
                        'text-foreground',
                        'outline-none data-[highlighted]:bg-accent',
                        'transition-colors duration-100'
                      )}
                    >
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      Copy
                    </DropdownMenuPrimitive.Item>
                  )}

                  {/* Separator before processes — only if there are menu items above */}
                  {(canEdit || canInsert) && (
                    <DropdownMenuPrimitive.Separator className="my-1 h-px bg-border" />
                  )}

                  {/* Processes */}
                  {availableProcesses.map((process) => (
                    <DropdownMenuPrimitive.Item
                      key={process.name}
                      onSelect={() =>
                        router.push(
                          `/app/${process.name}?recordsParam=recordIds&recordIds=${primaryKey}`
                        )
                      }
                      data-qqq-id={`record-action-${process.name}`}
                      className={cn(
                        'relative flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-sm',
                        'text-foreground',
                        'outline-none data-[highlighted]:bg-accent',
                        'transition-colors duration-100'
                      )}
                    >
                      <Play className="h-4 w-4" aria-hidden="true" />
                      {process.label}
                    </DropdownMenuPrimitive.Item>
                  ))}

                  {/* Separator before delete — only if there are menu items above */}
                  {canDelete && (canEdit || canInsert || availableProcesses.length > 0) && (
                    <DropdownMenuPrimitive.Separator className="my-1 h-px bg-border" />
                  )}

                  {/* Delete (destructive) */}
                  {canDelete && (
                    <DropdownMenuPrimitive.Item
                      onSelect={() => setShowDeleteDialog(true)}
                      data-qqq-id="record-action-delete"
                      className={cn(
                        'relative flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-sm',
                        'text-destructive',
                        'outline-none data-[highlighted]:bg-destructive/10',
                        'transition-colors duration-100'
                      )}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Delete
                    </DropdownMenuPrimitive.Item>
                  )}
                </DropdownMenuPrimitive.Content>
              </DropdownMenuPrimitive.Portal>
            </DropdownMenuPrimitive.Root>
          </>
        )}
      </div>

      {showDeleteDialog && (
        <DeleteConfirmDialog
          tableMetaData={tableMetaData}
          record={record}
          onClose={() => setShowDeleteDialog(false)}
          onDeleted={() => {
            router.push(`/app/${tableMetaData.name}`)
          }}
        />
      )}
    </>
  )
}
