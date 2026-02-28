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

/** DynamicForm — core metadata-driven form renderer used by EntityForm and ProcessRun */
'use client'

// DynamicForm — renders form fields from metadata using React Hook Form
// This is the CORE REUSABLE FORM component used by EntityForm (Package 3)
// and will be reused by ProcessRun (Package 4).

import React from 'react'
import type { Control, UseFormRegister, FieldErrors } from 'react-hook-form'

import type { QFieldMetaData, QTableSection, QTableMetaData } from '@/types'
import type { PossibleValueContext } from '@/lib/hooks/use-possible-values'
import { cn } from '@/lib/utils/cn'

import { DynamicFormField } from './DynamicFormField'

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

  /** Optional heading rendered above the field grid. */
  formLabel?: string

  /** Additional CSS classes applied to the outermost container. */
  className?: string
}

/**
 * DynamicForm renders form fields from metadata.
 *
 * Usage patterns:
 * 1. Table-based: pass tableMetaData (uses its sections for layout)
 * 2. Process-based: pass fields directly (flat list, no sections)
 * 3. Both: pass both tableMetaData and fieldNamesToInclude to filter
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
  formLabel,
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
      if (section.isHidden) continue
      for (const fn of section.fieldNames) {
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
    tableMetaData.sections.filter((s) => !s.isHidden).length > 0 &&
    !fields

  if (hasSections && tableMetaData) {
    const resolvedSections = sections ?? tableMetaData.sections
    return (
      <div className={cn('space-y-6', className)} data-qqq-id="dynamic-form">
        {formLabel && (
          <h3 className="text-base font-semibold text-foreground">{formLabel}</h3>
        )}
        {resolvedSections
          .filter((s) => !s.isHidden)
          .map((section) => {
            const sectionFields = section.fieldNames
              .map((fn) => tableMetaData.fields[fn])
              .filter((f): f is QFieldMetaData => {
                if (!f) return false
                if (f.isHidden) return false
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
                    <h4 className="text-sm font-medium text-muted-foreground">
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
                        possibleValueContext={possibleValueContext}
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
              possibleValueContext={possibleValueContext}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
