'use client'

// AssociatedRecords — renders child/related record tables below the main record

import React from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

import type { QTableMetaData, QRecord, QExposedJoin } from '@/types'
import { cn } from '@/lib/utils/cn'
import { FieldValue } from './FieldValue'

interface AssociatedRecordsProps {
  join: QExposedJoin
  records: QRecord[]
  /** The parent table's metadata — reserved for future context-aware features */
  parentTableMetaData?: QTableMetaData
  className?: string
}

export function AssociatedRecords({
  join,
  records,
  className,
}: AssociatedRecordsProps) {
  const joinTableMetaData = join.joinTable
  if (!joinTableMetaData) return null

  // Get visible fields for column headers (first 6 non-hidden fields)
  const visibleFields = Object.values(joinTableMetaData.fields)
    .filter((f) => !f.isHidden && !f.isHeavy)
    .slice(0, 6)

  if (visibleFields.length === 0) return null

  return (
    <section
      className={cn('space-y-3', className)}
      data-qqq-id={`associated-records-${join.label}`}
      aria-labelledby={`assoc-heading-${join.label}`}
    >
      <div className="flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-700">
        <h3
          id={`assoc-heading-${join.label}`}
          className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
        >
          {join.label}
          {records.length > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {records.length}
            </span>
          )}
        </h3>
        {joinTableMetaData.insertPermission && (
          <Link
            href={`/app/${joinTableMetaData.name}/create`}
            className={cn(
              'text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300',
              'focus:outline-none focus:underline'
            )}
            data-qqq-id={`button-create-${joinTableMetaData.name}`}
          >
            + Add {joinTableMetaData.label}
          </Link>
        )}
      </div>

      {records.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-600">
          No {join.label} records
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
          <table
            className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"
            aria-label={`${join.label} records`}
          >
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {visibleFields.map((field) => (
                  <th
                    key={field.name}
                    scope="col"
                    className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                    data-qqq-id={`grid-header-${field.name}`}
                  >
                    {field.label}
                  </th>
                ))}
                <th scope="col" className="relative px-3 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {records.map((childRecord, rowIdx) => {
                const childPk =
                  childRecord.values[joinTableMetaData.primaryKeyField] as string | number
                return (
                  <tr
                    key={childPk ?? rowIdx}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    data-qqq-id={`assoc-row-${joinTableMetaData.name}-${childPk}`}
                  >
                    {visibleFields.map((field) => (
                      <td
                        key={field.name}
                        className="whitespace-nowrap px-3 py-2 text-sm"
                        data-qqq-id={`grid-cell-${field.name}`}
                      >
                        <FieldValue field={field} record={childRecord} />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      {joinTableMetaData.readPermission && childPk !== undefined && (
                        <Link
                          href={`/app/${joinTableMetaData.name}/${childPk}`}
                          className={cn(
                            'inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800',
                            'dark:text-blue-400 dark:hover:text-blue-300',
                            'focus:outline-none focus:underline'
                          )}
                          aria-label={`View ${joinTableMetaData.label} record ${childPk}`}
                        >
                          View
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </Link>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
