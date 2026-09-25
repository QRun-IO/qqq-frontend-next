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
 * @file DeleteConfirmDialog — modal confirmation before deleting a record.
 */

'use client'

import React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react'

import type { QTableMetaData, QRecord } from '@/types'
import { deleteRecord } from '@/lib/api/tables'
import { HANDLES_OWN_ERRORS } from '@/lib/query-client'
import { cn } from '@/lib/utils/cn'
import { getErrorMessage } from '@/lib/utils/error-utils'
import { forgetDeletedRecord } from '@/lib/utils/record-cache'
import { toast } from '@/lib/hooks/use-toast'
import { useRestoreFocus } from '@/lib/hooks/use-restore-focus'

interface DeleteConfirmDialogProps {
  tableMetaData: QTableMetaData
  record: QRecord
  onClose: () => void
  onDeleted: () => void
}

/**
 * DeleteConfirmDialog — accessible modal confirmation dialog for deleting a record.
 *
 * Uses Radix Dialog for focus trapping, Escape-key dismissal, and focus
 * restoration. Executes the delete via a TanStack Query mutation and
 * invalidates the table query cache on success.
 *
 * @param props - Component properties.
 * @returns A Radix Dialog portal (always open) with a warning icon, record
 *   label, an inline error alert when the mutation fails, and Cancel/Delete
 *   buttons. The Delete button shows a spinner while `isPending`. On success
 *   the table query cache is invalidated, a success toast is shown, and
 *   `onDeleted` is called.
 */
export function DeleteConfirmDialog({
  tableMetaData,
  record,
  onClose,
  onDeleted,
}: DeleteConfirmDialogProps) {
  const queryClient = useQueryClient()

  const primaryKey = record.values[tableMetaData.primaryKeyField] as string | number
  const recordLabel = record.recordLabel || `${tableMetaData.label} #${primaryKey}`

  const deleteMutation = useMutation({
    mutationFn: () => deleteRecord(tableMetaData.name, primaryKey),
    meta: HANDLES_OWN_ERRORS,
    onSuccess: async () => {
      // #541: never refetch the deleted record while its view is still mounted.
      await forgetDeletedRecord(queryClient, tableMetaData.name, primaryKey)
      toast.success(`${recordLabel} deleted successfully.`)
      onDeleted()
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete: ${getErrorMessage(err)}`)
    },
  })

  const mutationError = deleteMutation.error ? getErrorMessage(deleteMutation.error, 'Failed to delete record. Please try again.') : null
  const restoreFocus = useRestoreFocus(true)

  return (
    <DialogPrimitive.Root open onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/50 dark:bg-black/70"
        />
        <DialogPrimitive.Content
          onCloseAutoFocus={restoreFocus}
          data-qqq-id="delete-confirm-dialog"
          aria-describedby="delete-dialog-description"
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2',
            'rounded-lg border border-border bg-card shadow-lg',
            'focus:outline-none'
          )}
          onEscapeKeyDown={onClose}
        >
          <DialogPrimitive.Title className="sr-only">
            Delete {tableMetaData.label}
          </DialogPrimitive.Title>

          {/* Header */}
          <div className="flex items-start justify-between p-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden="true" />
              </div>
              <h2
                className="text-lg font-semibold text-foreground"
              >
                Delete {tableMetaData.label}
              </h2>
            </div>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                aria-label="Close dialog"
                className={cn(
                  'rounded-md p-1 text-muted-foreground hover:text-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-ring'
                )}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </DialogPrimitive.Close>
          </div>

          {/* Body */}
          <div className="px-6 pb-4">
            <p id="delete-dialog-description" className="text-sm text-muted-foreground">
              Are you sure you want to delete{' '}
              <strong className="text-foreground">{recordLabel}</strong>?
              This action cannot be undone.
            </p>

            {mutationError && (
              <div
                role="alert"
                className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
              >
                {mutationError}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 rounded-b-lg bg-muted px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={deleteMutation.isPending}
              data-qqq-id="button-cancel"
              className={cn(
                'inline-flex items-center gap-2 rounded-md border border-input px-4 py-2 text-sm font-medium',
                'text-foreground bg-card hover:bg-accent',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'transition-colors duration-150'
              )}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-qqq-id="button-delete-confirm"
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
                'text-destructive-foreground bg-destructive hover:bg-destructive/90',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'transition-colors duration-150'
              )}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              )}
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
