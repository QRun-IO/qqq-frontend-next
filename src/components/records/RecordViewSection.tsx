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
 * @file RecordViewSection — renders a group of fields from a table section, or a widget when one is configured.
 */

'use client'

import React, { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import type { QTableMetaData, QTableSection, QRecord, QWidgetMetaData } from '@/types'
import { associationWidgetBinding } from '@/lib/utils/association-utils'
import { cn } from '@/lib/utils/cn'
import { gridSpanClasses, initialSectionOpen, isCollapsibleSection, storeSectionOpen, twelfths } from '@/lib/utils/record-layout-utils'
import { selectSlotHelpContent, VIEW_SCREEN_HELP_ROLES } from '@/lib/utils/help-utils'
import { useHelpHelpActive } from '@/lib/context/q-context'

import { FieldValue } from '@/components/records/FieldValue'
import { FieldLabel } from '@/components/records/FieldLabel'
import { HelpContent } from '@/components/records/HelpContent'
import { ConnectedWidget } from '@/components/widgets/ConnectedWidget'
import { SectionIcon } from '@/components/layout/MetadataIcon'

interface RecordViewSectionProps {
  renderAssociation?: (name: string, label?: string) => React.ReactNode
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

/**
 * RecordViewSection — renders a group of fields from a table section.
 *
 * When `section.widgetName` is set, renders a ConnectedWidget instead of field list.
 * Otherwise renders visible fields in compact (row), stacked (vertical), or
 * default grid layout depending on the `compact` and `stacked` flags.
 *
 * @param props - Component properties.
 * @returns A `<section>` containing field rows in compact (label: value row),
 *   stacked (label above value, card grid), or responsive grid layout; a
 *   {@link ConnectedWidget} when `section.widgetName` resolves to widget
 *   metadata; a placeholder div when the widget name is set but metadata is
 *   missing; or `null` when the section is hidden or has no renderable fields.
 */
export function RecordViewSection({
  section,
  renderAssociation,
  tableMetaData,
  record,
  widgetMetaDataMap,
  allTables,
  navigateFrom,
  compact = false,
  stacked = false,
  className,
}: RecordViewSectionProps) {
  const helpHelpActive = useHelpHelpActive()
  const collapsible = isCollapsibleSection(section)
  const [open, setOpen] = useState(!collapsible || section.collapsible?.initiallyOpen === true)
  useEffect(() => {
    setOpen(initialSectionOpen(tableMetaData.name, section))
  }, [tableMetaData.name, section])
  const toggle = () => {
    const next = !open
    setOpen(next)
    storeSectionOpen(tableMetaData.name, section.name, next)
  }
  if (section.isHidden || section.hidden) return null

  // If this section has a widgetName, render a widget instead of the field list
  if (section.widgetName) {
    const declaredWidgetMeta = widgetMetaDataMap?.[section.widgetName]
    const widgetMeta = declaredWidgetMeta && section.collapsible
      ? { ...declaredWidgetMeta, collapsible: section.collapsible }
      : declaredWidgetMeta
    const binding = associationWidgetBinding(widgetMeta)
    if (binding && renderAssociation) {
      if (widgetMeta?.hasPermission === false) return null
      if ('error' in binding) return <p role="alert">{binding.error}</p>
      if (collapsible) return (
        <section className={cn('space-y-4', className)} data-qqq-id={`section-widget-${section.widgetName}`}>
          <button type="button" onClick={toggle} aria-expanded={open} aria-controls={`record-section-body-${section.name}`}
            data-qqq-id={`button-section-collapse-${section.name}`}
            className="flex w-full items-center justify-between gap-2 rounded-md border border-border p-3 text-left font-semibold focus:outline-none focus:ring-2 focus:ring-ring">
            <span><SectionIcon section={section} />{section.label}</span>
            <ChevronDown className={cn('h-5 w-5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
          </button>
          <div id={`record-section-body-${section.name}`} hidden={!open}>
            {open && renderAssociation(binding.name, section.label)}
          </div>
        </section>
      )
      return <div data-qqq-id={`section-widget-${section.widgetName}`}>{renderAssociation(binding.name, section.label)}</div>
    }

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
                <SectionIcon section={section} />
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
            recordContext={{
              tableName: tableMetaData.name,
              recordId: primaryKey !== null && primaryKey !== undefined ? String(primaryKey) : undefined,
              record,
              tableMetaData,
            }}
            widgetRegistry={widgetMetaDataMap}
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
              <SectionIcon section={section} />
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

  // Filter to visible fields. Heavy fields are included: a single-record read returns them.
  const visibleFields = section.fieldNames
    .map((fn) => tableMetaData.fields[fn])
    .filter((f) => f && !f.isHidden)
  const sectionHelp = selectSlotHelpContent(section.helpContents, VIEW_SCREEN_HELP_ROLES, `table:${tableMetaData.name};section:${section.name}`, helpHelpActive)

  if (visibleFields.length === 0) return null

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
            {collapsible ? (
              <button type="button" onClick={toggle} aria-expanded={open} aria-controls={`record-section-body-${section.name}`}
                aria-label={`Toggle ${section.label}`} data-qqq-id={`button-section-collapse-${section.name}`}
                className="flex w-full items-center justify-between gap-2 text-left focus:outline-none focus:ring-2 focus:ring-ring">
                <span><SectionIcon section={section} />{section.label}</span>
                <ChevronDown className={cn('h-5 w-5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
              </button>
            ) : <><SectionIcon section={section} />{section.label}</>}
          </h3>
          {open && sectionHelp && (
            <p className="mt-1 text-sm text-muted-foreground" data-qqq-id={`section-help-${section.name}`}>
              <HelpContent helpContent={sectionHelp} />
            </p>
          )}
        </div>
      )}
      <div id={`record-section-body-${section.name}`} hidden={!open}>
      {compact ? (
        /* Compact list layout — label: value on each row (label above value on phones).
           Values wrap anywhere so a long URL or token stays inside the card. */
        <dl className="divide-y divide-border/40">
          {visibleFields.map((field) => {
            if (!field) return null
            return (
              <div
                key={field.name}
                className="flex flex-col gap-0.5 py-1.5 sm:flex-row sm:items-baseline sm:gap-4"
                data-qqq-id={`record-field-${field.name}`}
              >
                <dt className="text-sm text-muted-foreground sm:w-40 sm:flex-shrink-0">
                  <FieldLabel field={field} data-qqq-id={`field-label-${field.name}`} helpKey={`table:${tableMetaData.name};field:${field.name}`} />
                </dt>
                <dd className="min-w-0 flex-1 text-sm text-foreground [overflow-wrap:anywhere]">
                  <FieldValue field={field} record={record} allTables={allTables} navigateFrom={navigateFrom} widgetMetaDataMap={widgetMetaDataMap} tableMetaData={tableMetaData} />
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
                className="flex min-w-0 flex-col gap-0.5"
                data-qqq-id={`record-field-${field.name}`}
              >
                <dt className="text-sm font-semibold text-foreground">
                  <FieldLabel field={field} data-qqq-id={`field-label-${field.name}`} helpKey={`table:${tableMetaData.name};field:${field.name}`} />
                </dt>
                <dd className="min-w-0 text-sm text-foreground [overflow-wrap:anywhere]">
                  <FieldValue field={field} record={record} allTables={allTables} navigateFrom={navigateFrom} widgetMetaDataMap={widgetMetaDataMap} tableMetaData={tableMetaData} />
                </dd>
              </div>
            )
          })}
        </dl>
      ) : (
        /* Material uses a 12-column field grid; each field defaults to full width. */
        <dl
          className="grid grid-cols-12 gap-x-8 gap-y-6"
        >
          {visibleFields.map((field) => {
            if (!field) return null
            return (
              <div
                key={field.name}
                className={cn(
                  'flex min-w-0 flex-col gap-0.5',
                  gridSpanClasses(twelfths(field.gridColumns) ?? 12)
                )}
                data-qqq-id={`record-field-${field.name}`}
              >
                <dt className="text-sm font-semibold text-foreground">
                  <FieldLabel field={field} data-qqq-id={`field-label-${field.name}`} helpKey={`table:${tableMetaData.name};field:${field.name}`} />
                </dt>
                <dd className="min-w-0 [overflow-wrap:anywhere]">
                  <FieldValue field={field} record={record} allTables={allTables} navigateFrom={navigateFrom} widgetMetaDataMap={widgetMetaDataMap} tableMetaData={tableMetaData} />
                </dd>
              </div>
            )
          })}
        </dl>
      )}
      </div>
    </section>
  )
}
