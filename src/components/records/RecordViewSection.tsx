'use client'

// RecordViewSection — renders a group of fields from a table section
// When section.widgetName is set, renders a widget instead of field list

import React from 'react'

import type { QTableMetaData, QTableSection, QRecord, QWidgetMetaData } from '@/types'
import { cn } from '@/lib/utils/cn'

import { FieldValue } from '@/components/records/FieldValue'
import { FieldLabel } from '@/components/records/FieldLabel'
import { ConnectedWidget } from '@/components/widgets/ConnectedWidget'

interface RecordViewSectionProps {
  section: QTableSection
  tableMetaData: QTableMetaData
  record: QRecord
  /** Widget metadata map for resolving section.widgetName */
  widgetMetaDataMap?: Record<string, QWidgetMetaData>
  /** Full table metadata map for rendering possibleValueSource fields as links with hover previews */
  allTables?: Record<string, QTableMetaData>
  /** Source page info for back navigation — passed to FieldValue for record links */
  navigateFrom?: { path: string; label: string }
  /** Compact mode — single column, tighter spacing for list view */
  compact?: boolean
  /** Stacked mode — single column with vertical field stacking (for card grid layout) */
  stacked?: boolean
  className?: string
}

export function RecordViewSection({
  section,
  tableMetaData,
  record,
  widgetMetaDataMap,
  allTables,
  navigateFrom,
  compact = false,
  stacked = false,
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
            <div className="border-b border-border/50 pb-2">
              <h3
                id={`section-heading-${section.name}`}
                className="text-lg font-bold text-foreground"
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
          <div className="border-b border-border/50 pb-2">
            <h3
              id={`section-heading-${section.name}`}
              className="text-lg font-bold text-foreground"
            >
              {section.label}
            </h3>
          </div>
        )}
        <div className="rounded-md border border-border bg-muted p-4 text-sm text-muted-foreground">
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
      className={cn(compact ? 'space-y-2' : 'space-y-4', className)}
      data-qqq-id={`record-section-${section.name}`}
      aria-labelledby={`section-heading-${section.name}`}
    >
      {section.label && (
        <div className={cn(compact ? 'pb-1' : 'border-b border-border/50 pb-2')}>
          <h3
            id={`section-heading-${section.name}`}
            className={cn(
              compact
                ? 'text-sm font-semibold text-foreground'
                : 'text-lg font-bold text-foreground'
            )}
          >
            {section.label}
          </h3>
        </div>
      )}
      {compact ? (
        /* Compact list layout — label: value on each row */
        <dl className="divide-y divide-border/40">
          {visibleFields.map((field) => {
            if (!field) return null
            return (
              <div
                key={field.name}
                className="flex items-baseline gap-4 py-1.5"
                data-qqq-id={`record-field-${field.name}`}
              >
                <dt className="w-40 flex-shrink-0 text-sm text-muted-foreground">
                  <FieldLabel field={field} data-qqq-id={`field-label-${field.name}`} />
                </dt>
                <dd className="flex-1 text-sm text-foreground">
                  <FieldValue field={field} record={record} allTables={allTables} navigateFrom={navigateFrom} />
                </dd>
              </div>
            )
          })}
        </dl>
      ) : stacked ? (
        /* Stacked vertical layout — fields listed top-to-bottom, label above value */
        <dl className="space-y-4">
          {visibleFields.map((field) => {
            if (!field) return null
            return (
              <div
                key={field.name}
                className="flex flex-col gap-0.5"
                data-qqq-id={`record-field-${field.name}`}
              >
                <dt className="text-sm font-semibold text-foreground">
                  <FieldLabel field={field} data-qqq-id={`field-label-${field.name}`} />
                </dt>
                <dd className="text-sm text-foreground">
                  <FieldValue field={field} record={record} allTables={allTables} navigateFrom={navigateFrom} />
                </dd>
              </div>
            )
          })}
        </dl>
      ) : (
        /* Default grid layout */
        <dl
          className={cn(
            'grid gap-x-8 gap-y-6',
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
                  'flex flex-col gap-0.5',
                  field.gridColumns === 2 ? 'col-span-1 sm:col-span-2' : undefined
                )}
                data-qqq-id={`record-field-${field.name}`}
              >
                <dt className="text-sm font-semibold text-foreground">
                  <FieldLabel field={field} data-qqq-id={`field-label-${field.name}`} />
                </dt>
                <dd>
                  <FieldValue field={field} record={record} allTables={allTables} navigateFrom={navigateFrom} />
                </dd>
              </div>
            )
          })}
        </dl>
      )}
    </section>
  )
}
