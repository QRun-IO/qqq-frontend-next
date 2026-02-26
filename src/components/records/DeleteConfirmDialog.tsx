'use client'

// DeleteConfirmDialog — modal confirmation before deleting a record

import React, { useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react'

import type { QTableMetaData, QRecord } from '@/types'
import { deleteRecord } from '@/lib/api/tables'
import { queryKeys } from '@/lib/query-client'
import { cn } from '@/lib/utils/cn'
import { toast } from '@/lib/hooks/use-toast'

interface DeleteConfirmDialogProps {
  tableMetaData: QTableMetaData
  record: QRecord
  onClose: () => void
  onDeleted: () => void
}

export function DeleteConfirmDialog({
  tableMetaData,
  record,
  onClose,
  onDeleted,
}: DeleteConfirmDialogProps) {
  const queryClient = useQueryClient()
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  const primaryKey = record.values[tableMetaData.primaryKeyField] as string | number
  const recordLabel = record.recordLabel || `${tableMetaData.label} #${primaryKey}`

  // Focus cancel button when dialog opens
  useEffect(() => {
    cancelButtonRef.current?.focus()
  }, [])

  // Trap focus in dialog and handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const deleteMutation = useMutation({
    mutationFn: () => deleteRecord(tableMetaData.name, primaryKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tableRecords(tableMetaData.name) })
      queryClient.removeQueries({
        queryKey: queryKeys.tableRecord(tableMetaData.name, primaryKey),
      })
      toast.success(`${recordLabel} deleted successfully.`)
      onDeleted()
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete: ${err.message}`)
    },
  })

  const mutationError = deleteMutation.error as Error | null

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-description"
      data-qqq-id="delete-confirm-dialog"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className={cn(
          'relative z-10 mx-4 w-full max-w-md rounded-lg bg-white shadow-xl',
          'dark:bg-gray-900 dark:border dark:border-gray-700'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden="true" />
            </div>
            <h2
              id="delete-dialog-title"
              className="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              Delete {tableMetaData.label}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className={cn(
              'rounded-md p-1 text-gray-400 hover:text-gray-600',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
              'dark:text-gray-500 dark:hover:text-gray-300'
            )}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-4">
          <p id="delete-dialog-description" className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to delete{' '}
            <strong className="text-gray-900 dark:text-gray-100">{recordLabel}</strong>?
            This action cannot be undone.
          </p>

          {mutationError && (
            <div
              role="alert"
              className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
            >
              {mutationError.message || 'Failed to delete record. Please try again.'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 rounded-b-lg bg-gray-50 px-6 py-4 dark:bg-gray-800/50">
          <button
            type="button"
            ref={cancelButtonRef}
            onClick={onClose}
            disabled={deleteMutation.isPending}
            data-qqq-id="button-cancel"
            className={cn(
              'inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium',
              'text-gray-700 bg-white hover:bg-gray-50',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'dark:border-gray-600 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700',
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
              'text-white bg-red-600 hover:bg-red-700',
              'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
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
      </div>
    </div>
  )
}
