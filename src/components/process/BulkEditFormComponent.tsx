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
 * @file BulkEditFormComponent — renders a BULK_EDIT_FORM process component: the
 * table's editable fields grouped by table section, each behind a switch. Only
 * switched-on fields are validated and submitted, with `bulkEditEnabledFields`
 * naming them; at least one field must be switched on.
 */

'use client'

import React, { useState } from 'react'

import type { QFieldMetaData } from '@/types'

import { DynamicFormField } from '@/components/forms/DynamicFormField'
import { useProcessStep, useSubmitContributor } from './ProcessStepContext'

/** Props for {@link BulkEditFormComponent}. */
export interface BulkEditFormComponentProps {
  index: number
}

/**
 * Group the step's fields by the table's sections (fields outside every section go last).
 * @param fields - Editable step fields.
 * @param sections - Table sections.
 * @returns Section label and fields, in section order.
 */
function groupBySection(fields: QFieldMetaData[], sections: { name: string; label: string; fieldNames: string[]; isHidden?: boolean }[]) {
  const byName = new Map(fields.map((field) => [field.name, field]))
  const used = new Set<string>()
  const groups: { name: string; label: string; fields: QFieldMetaData[] }[] = []
  for (const section of sections) {
    if (section.isHidden) continue
    const sectionFields = (section.fieldNames ?? []).map((name) => byName.get(name)).filter((field): field is QFieldMetaData => Boolean(field))
    sectionFields.forEach((field) => used.add(field.name))
    if (sectionFields.length > 0) groups.push({ name: section.name, label: section.label, fields: sectionFields })
  }
  const rest = fields.filter((field) => !used.has(field.name))
  if (rest.length > 0) groups.push({ name: 'otherFields', label: sections.length > 0 ? 'Other Fields' : '', fields: rest })
  return groups
}

/**
 * Render a BULK_EDIT_FORM component.
 * @param props - {@link BulkEditFormComponentProps}
 * @returns The switchable field sections.
 */
export function BulkEditFormComponent({ index }: BulkEditFormComponentProps) {
  const { step, form, isWorking, tableMetaData, values, processName } = useProcessStep()
  const [enabled, setEnabled] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const fields = (step.formFields ?? []).filter((field) => !field.isHidden && field.isEditable !== false)
  const groups = groupBySection(fields, tableMetaData?.sections ?? [])
  const nonDistinct = values.nonDistinctPVSFields && typeof values.nonDistinctPVSFields === 'object'
    ? values.nonDistinctPVSFields as Record<string, string[]> : null

  useSubmitContributor(`bulkEdit-${index}`, () => {
    const enabledFields = fields.filter((field) => enabled[field.name])
    if (enabledFields.length === 0) {
      setError('You must edit at least one field to continue.')
      return { maySubmit: false }
    }
    let valid = true
    const submitted: Record<string, unknown> = {}
    for (const field of enabledFields) {
      const value = form.getValues(field.name)
      if (field.isRequired && (value === undefined || value === null || value === '')) {
        form.setError(field.name, { type: 'required', message: `${field.label} is required` })
        valid = false
      }
      submitted[field.name] = value ?? ''
    }
    if (!valid) return { maySubmit: false }
    setError(null)
    return { maySubmit: true, values: { ...submitted, bulkEditEnabledFields: enabledFields.map((field) => field.name).join(',') } }
  })

  if (fields.length === 0) {
    return <p role="alert" className="text-sm text-destructive">There are no editable fields on this table.</p>
  }

  return (
    <div className="space-y-4" data-qqq-id={`process-bulk-edit-form-${index}`}>
      {error && <p role="alert" className="text-sm text-destructive" data-qqq-id="process-bulk-edit-error">{error}</p>}
      {nonDistinct && Object.entries(nonDistinct).map(([field, dependents]) => (
        <p key={field} role="status" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {`You may not edit the value of ${dependents.join(', ')}, because the records you are editing do not all have the same value for ${field} (unless you edit the value of ${field}).`}
        </p>
      ))}
      {groups.map((group) => (
        <section key={group.name} aria-label={group.label || 'Fields'} className="rounded-xl border border-border p-4" data-qqq-id={`process-bulk-edit-section-${group.name}`}>
          {group.label && <h4 className="mb-3 text-base font-semibold text-foreground">{group.label}</h4>}
          <div className="space-y-4">
            {group.fields.map((field) => (
              <div key={field.name} className="flex items-start gap-3" data-qqq-id={`process-bulk-edit-field-${field.name}`}>
                <input
                  type="checkbox"
                  role="switch"
                  aria-checked={Boolean(enabled[field.name])}
                  aria-label={`Edit ${field.label}`}
                  checked={Boolean(enabled[field.name])}
                  disabled={isWorking}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setEnabled((previous) => ({ ...previous, [field.name]: checked }))
                    if (!checked) form.clearErrors(field.name)
                    setError(null)
                  }}
                  className="mt-8 h-4 w-4"
                  data-qqq-id={`switch-bulk-edit-${field.name}`}
                />
                <div className="flex-1">
                  <DynamicFormField
                    field={{ ...field, isRequired: Boolean(enabled[field.name] && field.isRequired) }}
                    register={form.register}
                    control={form.control}
                    errors={form.formState.errors}
                    disabled={isWorking || !enabled[field.name]}
                    possibleValueContext={tableMetaData ? { type: 'table', tableName: tableMetaData.name } : { type: 'process', processName }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
