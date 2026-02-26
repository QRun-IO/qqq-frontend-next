'use client'

// RecordActions — edit/delete/copy action buttons for a record view page

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Copy, Trash2 } from 'lucide-react'

import type { QTableMetaData, QRecord } from '@/types'
import { cn } from '@/lib/utils/cn'

import { DeleteConfirmDialog } from './DeleteConfirmDialog'

interface RecordActionsProps {
  tableMetaData: QTableMetaData
  record: QRecord
  className?: string
}

export function RecordActions({ tableMetaData, record, className }: RecordActionsProps) {
  const router = useRouter()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const primaryKey = record.values[tableMetaData.primaryKeyField] as string | number

  const canEdit = tableMetaData.editPermission
  const canDelete = tableMetaData.deletePermission
  const canInsert = tableMetaData.insertPermission

  return (
    <>
      <div
        className={cn('flex items-center gap-2', className)}
        data-qqq-id={`record-actions-${tableMetaData.name}`}
      >
        {canEdit && (
          <button
            type="button"
            onClick={() => router.push(`/app/${tableMetaData.name}/${primaryKey}/edit`)}
            data-qqq-id="button-edit"
            aria-label={`Edit ${tableMetaData.label} record`}
            className={cn(
              'inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium',
              'text-gray-700 bg-white hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
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
                `/app/${tableMetaData.name}/${primaryKey}/copy`
              )
            }
            data-qqq-id="button-copy"
            aria-label={`Copy ${tableMetaData.label} record`}
            className={cn(
              'inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium',
              'text-gray-700 bg-white hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
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
              'inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-medium',
              'text-red-600 bg-white hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:bg-gray-800 dark:hover:bg-red-900/20',
              'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
              'transition-colors duration-150'
            )}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </button>
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
