'use client'

// RecordViewSection — renders a group of fields from a table section
// When section.widgetName is set, renders a widget instead of field list

import React from 'react'

import type { QTableMetaData, QTableSection, QRecord, QWidgetMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

import { FieldValue } from '@/components/records/FieldValue'
import { ConnectedWidget } from '@/components/widgets/ConnectedWidget'

interface RecordViewSectionProps {
  section: QTableSection
  tableMetaData: QTableMetaData
  record: QRecord
  /** Widget metadata map for resolving section.widgetName */
  widgetMetaDataMap?: Record<string, QWidgetMetaData>
  className?: string
}

export function RecordViewSection({
  section,
  tableMetaData,
  record,
  widgetMetaDataMap,
  className,
}: RecordViewSectionProps) {
  if (section.isHidden) return null

  // If this section has a widgetName, render a widget instead of the field list
  if (section.widgetName) {
    const widgetMeta = widgetMetaDataMap?.[section.widgetName]

    if (widgetMeta) {
      // We have full widget metadata -- render the ConnectedWidget
      const primaryKey = record.values[tableMetaData.primaryKeyField]
      return (
        <section
          className={cn('space-y-4', className)}
          data-qqq-id={`section-widget-${section.widgetName}`}
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
          <ConnectedWidget
            widgetMetaData={widgetMeta}
            params={{
              tableName: tableMetaData.name,
              id: primaryKey !== null && primaryKey !== undefined ? String(primaryKey) : '',
            }}
          />
        </section>
      )
    }

    // Widget metadata not available -- render a placeholder integration point
    return (
      <section
        className={cn('space-y-4', className)}
        data-qqq-id={`section-widget-${section.widgetName}`}
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
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
          Widget: {section.widgetName}
        </div>
      </section>
    )
  }

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
