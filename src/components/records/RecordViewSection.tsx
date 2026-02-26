'use client'

// RecordViewSection — renders a group of fields from a table section

import React from 'react'

import type { QTableMetaData, QTableSection, QRecord } from '@/types'
import { cn } from '@/lib/utils/cn'

import { FieldValue } from './FieldValue'

interface RecordViewSectionProps {
  section: QTableSection
  tableMetaData: QTableMetaData
  record: QRecord
  className?: string
}

export function RecordViewSection({
  section,
  tableMetaData,
  record,
  className,
}: RecordViewSectionProps) {
  if (section.isHidden) return null

  // Filter to visible fields
  const visibleFields = section.fieldNames
    .map((fn) => tableMetaData.fields[fn])
    .filter((f) => f && !f.isHidden && !f.isHeavy)

  if (visibleFields.length === 0) return null

  const gridCols = section.gridColumns ?? 2

  return (
    <section
      className={cn('space-y-4', className)}
      data-qqq-id={`record-section-${section.name}`}
      aria-labelledby={`section-heading-${section.name}`}
    >
      {section.label && (
        <div className="border-b border-gray-200 pb-2 dark:border-gray-700">
          <h3
            id={`section-heading-${section.name}`}
            className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            {section.label}
          </h3>
        </div>
      )}
      <dl
        className={cn(
          'grid gap-x-6 gap-y-4',
          gridCols === 1
            ? 'grid-cols-1'
            : gridCols === 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : gridCols === 3
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
        )}
      >
        {visibleFields.map((field) => {
          if (!field) return null
          return (
            <div
              key={field.name}
              className={cn(
                'flex flex-col gap-1',
                field.gridColumns === 2 ? 'col-span-1 sm:col-span-2' : undefined
              )}
              data-qqq-id={`record-field-${field.name}`}
            >
              <dt
                className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                data-qqq-id={`field-label-${field.name}`}
              >
                {field.label}
              </dt>
              <dd>
                <FieldValue field={field} record={record} />
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}
