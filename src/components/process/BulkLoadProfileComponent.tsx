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
 * @file BulkLoadProfileComponent — renders a BULK_LOAD_PROFILE_FORM process
 * component: which bulk load profile is in use and the field mapping it applies,
 * re-submitting `savedBulkLoadProfileId` when a saved profile is selected.
 */

'use client'

import React, { useId, useMemo } from 'react'

import { useProcessStep, useSubmitContributor } from './ProcessStepContext'
import { BulkLoadMapping, FileDescription, readTableStructure, type BulkLoadProfile } from './bulk-load-models'

/** Props for {@link BulkLoadProfileComponent}. */
export interface BulkLoadProfileComponentProps {
  index: number
}

/**
 * Render a BULK_LOAD_PROFILE_FORM component.
 * @param props - {@link BulkLoadProfileComponentProps}
 * @returns The profile summary.
 */
export function BulkLoadProfileComponent({ index }: BulkLoadProfileComponentProps) {
  const { values } = useProcessStep()
  const headingId = useId()
  const tableStructure = readTableStructure(values.tableStructure)
  const mapping = useMemo(() => tableStructure ? BulkLoadMapping.fromProfile(tableStructure, values.bulkLoadProfile as BulkLoadProfile | undefined) : null, [tableStructure, values.bulkLoadProfile])
  const file = useMemo(() => new FileDescription(values.headerValues, values.headerLetters, values.bodyValuesPreview), [values.headerValues, values.headerLetters, values.bodyValuesPreview])
  const saved = values.savedBulkLoadProfileRecord && typeof values.savedBulkLoadProfileRecord === 'object'
    ? values.savedBulkLoadProfileRecord as { values?: Record<string, unknown> } : null
  const savedId = saved?.values?.id
  const savedLabel = typeof saved?.values?.label === 'string' ? saved.values.label : null
  const action = mapping?.isBulkEdit ? 'edit' : 'load'

  useSubmitContributor(`bulkLoadProfile-${index}`, () => ({
    maySubmit: true,
    values: savedId !== undefined && savedId !== null ? { savedBulkLoadProfileId: String(savedId) } : {},
  }))

  if (!mapping) return null
  const columnNames = file.columnNames(mapping.hasHeaderRow)
  const mapped = [...mapping.requiredFields, ...mapping.additionalFields]

  return (
    <section aria-labelledby={headingId} className="rounded-xl border border-border p-4 text-sm" data-qqq-id={`process-bulk-load-profile-${index}`}>
      <h4 id={headingId} className="mb-1 font-semibold text-foreground">{`Bulk ${action === 'edit' ? 'Edit' : 'Load'} Profile`}</h4>
      <p className="mb-2 text-muted-foreground" data-qqq-id="bulk-load-profile-name">
        {savedLabel ? `You are using the bulk ${action} profile: ${savedLabel}` : `You are not using a saved bulk ${action} profile.`}
      </p>
      <ul className="space-y-0.5" data-qqq-id="bulk-load-profile-fields">
        {mapped.map((field) => (
          <li key={field.key}>
            <span className="font-medium">{field.getQualifiedLabel()}</span>
            {field.valueType === 'column'
              ? ` from ${field.headerName ?? (field.columnIndex !== null ? columnNames[field.columnIndex] : 'no column')}${field.doValueMapping ? ' (values mapped)' : ''}`
              : ` = ${String(field.defaultValue ?? '')}`}
          </li>
        ))}
      </ul>
    </section>
  )
}
