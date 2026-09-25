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
 * @file DynamicForm — core metadata-driven form renderer used by EntityForm and ProcessRun.
 */

'use client'

import React from 'react'
import type { Control, UseFormRegister, FieldErrors } from 'react-hook-form'

import type { QFieldMetaData, QRecord, QTableSection, QTableMetaData, QWidgetMetaData } from '@/types'
import type { PossibleValueContext } from '@/lib/hooks/use-possible-values'
import { cn } from '@/lib/utils/cn'

import { DynamicFormField } from './DynamicFormField'
import { SectionIcon } from '@/components/layout/MetadataIcon'

/**
 * Props for the {@link DynamicForm} component.
 *
 * Supply either `tableMetaData` (for section-grouped layout) or `fields`
 * (for a flat list, typically used by processes).  Both can be combined with
 * `fieldNamesToInclude` for fine-grained field filtering.
 */
export interface DynamicFormProps {
  /** React Hook Form register function from the parent `useForm` instance. */
  register: UseFormRegister<Record<string, unknown>>
  /** React Hook Form control object from the parent `useForm` instance. */
  control: Control<Record<string, unknown>>
  /** React Hook Form validation error map from the parent `useForm` instance. */
  errors: FieldErrors<Record<string, unknown>>

  /** Table metadata used to derive sections and field ordering. */
  tableMetaData?: QTableMetaData
  /** Explicit field list; when provided, section grouping is skipped. */
  fields?: QFieldMetaData[]
  /** Override the sections from `tableMetaData`; ignored when `fields` is set. */
  sections?: QTableSection[]

  /** Restricts rendered fields to this allow-list; when omitted all editable non-hidden fields are shown. */
  fieldNamesToInclude?: string[]

  /** Context forwarded to possible-value fields to scope their fetch calls. */
  possibleValueContext?: PossibleValueContext

  /** When `true`, all fields are rendered in a disabled, read-only state. */
  disabled?: boolean

  /**
   * Map of field names to a boolean indicating whether that field has been
   * modified from its default value.  When `true` for a field, the field
   * renders with a left-border accent to highlight the change.
   * Typically sourced from `formState.dirtyFields` in React Hook Form.
   */
  dirtyFields?: Record<string, boolean>

  /**
   * The record being edited, if any: supplies the display of read-only fields, the
   * current file of upload fields and the labels of possible-value selections.
   */
  record?: QRecord

  /** Show non-editable fields as read-only controls (the edit screen does; create and copy do not). */
  showReadOnlyFields?: boolean

  /** Screen roles used to choose field help content, most specific first. */
  helpRoles?: readonly string[]

  /** Limit typing to each field's `maxLength` (default); record forms turn this off. */
  enforceMaxLength?: boolean

  /** Optional heading rendered above the field grid. */
  formLabel?: string

  /**
   * Widget metadata by name. A section housing a widget shown on record edit
   * screens (`includeOnRecordEditScreen`, e.g. the cron schedule) renders the
   * record fields that widget edits, which usually sit in a hidden section.
   */
  widgets?: Record<string, QWidgetMetaData>

  /** Additional CSS classes applied to the outermost container. */
  className?: string
}

/**
 * The record fields a widget section edits on a record form, as Material's
 * EntityForm does for `cronUI` widgets (expression and time zone fields).
 *
 * @param section - A table section.
 * @param widgets - Widget metadata by name.
 * @returns The edited field names, or `undefined` when the section is not an editable widget section.
 */
export function editScreenWidgetFieldNames(section: QTableSection, widgets: Record<string, QWidgetMetaData> | undefined): string[] | undefined {
  const widget = section.widgetName ? widgets?.[section.widgetName] : undefined
  if (!widget || widget.hasPermission === false || widget.type !== 'cronUI') return undefined
  const defaults = widget.defaultValues ?? {}
  if (defaults.includeOnRecordEditScreen !== true) return undefined
  const names = [defaults.cronExpressionFieldName, defaults.timeZoneFieldName].filter((name): name is string => typeof name === 'string' && name !== '')
  return names.length > 0 ? names : undefined
}

/**
 * DynamicForm renders form fields from metadata.
 *
 * Supports three usage patterns:
 * 1. **Table-based** — pass `tableMetaData`; fields are grouped and ordered by
 *    the table's sections.
 * 2. **Process-based** — pass `fields` directly; renders a flat list with no
 *    section grouping, typically used by `ProcessRun`.
 * 3. **Filtered** — pass both `tableMetaData` and `fieldNamesToInclude` to show
 *    only a named subset of the table's fields while preserving section layout.
 *
 * Used by {@link EntityForm} (create/edit/copy), `ProcessRun` (step forms), and
 * any other caller that needs a metadata-driven field grid.
 *
 * @param props - Component properties (see {@link DynamicFormProps}).
 * @returns The rendered form fields grouped by section, or `null` when no
 *   renderable fields exist after applying visibility and include-list filters.
 */
export function DynamicForm({
  register,
  control,
  errors,
  tableMetaData,
  fields,
  sections,
  fieldNamesToInclude,
  possibleValueContext,
  disabled = false,
  dirtyFields,
  record,
  showReadOnlyFields = false,
  helpRoles,
  enforceMaxLength = true,
  formLabel,
  widgets,
  className,
}: DynamicFormProps) {
  // Determine the set of fields to render
  const resolvedFields: QFieldMetaData[] = []

  if (fields) {
    // Direct fields list (process mode)
    const includeSet = fieldNamesToInclude ? new Set(fieldNamesToInclude) : null
    for (const f of fields) {
      if (f.isHidden) continue
      if (includeSet && !includeSet.has(f.name)) continue
      resolvedFields.push(f)
    }
  } else if (tableMetaData) {
    // Table metadata mode — respect sections for layout
    const includeSet = fieldNamesToInclude ? new Set(fieldNamesToInclude) : null
    const allFields = tableMetaData.fields
    const fieldOrder: string[] = []

    // Collect field names in section order
    const resolvedSections = sections ?? tableMetaData.sections
    for (const section of resolvedSections) {
      if (section.isHidden || section.hidden) continue
      for (const fn of section.fieldNames ?? []) {
        if (!fieldOrder.includes(fn)) fieldOrder.push(fn)
      }
    }

    // Add any fields not in sections
    for (const fn of Object.keys(allFields)) {
      if (!fieldOrder.includes(fn)) fieldOrder.push(fn)
    }

    for (const fn of fieldOrder) {
      const f = allFields[fn]
      if (!f) continue
      if (f.isHidden) continue
      if (includeSet && !includeSet.has(fn)) continue
      resolvedFields.push(f)
    }
  }

  if (resolvedFields.length === 0) {
    return null
  }

  // If we have table sections, render section-grouped layout
  const hasSections =
    tableMetaData &&
    tableMetaData.sections &&
    tableMetaData.sections.filter((s) => !s.isHidden && !s.hidden).length > 0 &&
    !fields

  if (hasSections && tableMetaData) {
    const resolvedSections = (sections ?? tableMetaData.sections).map((section) => {
      const widgetFieldNames = editScreenWidgetFieldNames(section, widgets)
      return widgetFieldNames ? { ...section, fieldNames: widgetFieldNames } : section
    })
    return (
      <div className={cn('space-y-6', className)} data-qqq-id="dynamic-form">
        {formLabel && (
          <h3 className="text-base font-semibold text-foreground">{formLabel}</h3>
        )}
        {resolvedSections
          .filter((s) => !s.isHidden && !s.hidden)
          .map((section) => {
            const sectionFields = (section.fieldNames ?? [])
              .map((fn) => tableMetaData.fields[fn])
              .filter((f): f is QFieldMetaData => {
                if (!f) return false
                if (f.isHidden) return false
                if (!f.isEditable && !showReadOnlyFields && !disabled) return false
                if (fieldNamesToInclude && !fieldNamesToInclude.includes(f.name)) return false
                return true
              })

            if (sectionFields.length === 0) return null

            const gridCols = section.gridColumns ?? 2

            return (
              <div
                key={section.name}
                className="space-y-4"
                data-qqq-id={`form-section-${section.name}`}
              >
                {section.label && (
                  <div className="border-b border-border pb-2">
                    <h4 className="flex items-center text-sm font-medium text-muted-foreground">
                      <SectionIcon section={section} />
                      {section.label}
                    </h4>
                  </div>
                )}
                <div
                  className={cn(
                    'grid gap-4',
                    gridCols === 1 ? 'grid-cols-1' :
                    gridCols === 2 ? 'grid-cols-1 sm:grid-cols-2' :
                    gridCols === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
                    'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                  )}
                >
                  {sectionFields.map((f) => (
                    <div
                      key={f.name}
                      className={cn(
                        f.gridColumns === 1 ? 'col-span-1' :
                        f.gridColumns === 2 ? 'col-span-1 sm:col-span-2' : undefined
                      )}
                    >
                      <DynamicFormField
                        field={f}
                        register={register}
                        control={control}
                        errors={errors}
                        disabled={disabled}
                        isDirty={dirtyFields?.[f.name] === true}
                        possibleValueContext={possibleValueContext}
                        record={record}
                        showReadOnly={showReadOnlyFields}
                        helpRoles={helpRoles}
                        enforceMaxLength={enforceMaxLength}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
      </div>
    )
  }

  // Flat layout (no sections — process mode or simple tables)
  return (
    <div className={cn('space-y-4', className)} data-qqq-id="dynamic-form">
      {formLabel && (
        <h3 className="text-base font-semibold text-foreground">{formLabel}</h3>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {resolvedFields.map((f) => (
          <div
            key={f.name}
            className={cn(
              f.gridColumns === 1 ? 'col-span-1' :
              f.gridColumns === 2 ? 'col-span-1 sm:col-span-2' : undefined
            )}
          >
            <DynamicFormField
              field={f}
              register={register}
              control={control}
              errors={errors}
              disabled={disabled}
              isDirty={dirtyFields?.[f.name] === true}
              possibleValueContext={possibleValueContext}
              record={record}
              showReadOnly={showReadOnlyFields}
              helpRoles={helpRoles}
              enforceMaxLength={enforceMaxLength}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
