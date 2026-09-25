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
 * @file BulkLoadValueMappingComponent — renders a BULK_LOAD_VALUE_MAPPING_FORM
 * process component: for the field being value-mapped, each distinct file value
 * with an input for the table value it becomes, submitted as `mappedValuesJSON`
 * together with the full bulk load profile.
 */

'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'

import type { QFieldMetaData } from '@/types'
import { fetchTablePossibleValues } from '@/lib/api/possible-values'

import { useProcessStep, useSubmitContributor } from './ProcessStepContext'
import { BulkLoadMapping, profileSubmitValues, readTableStructure, type BulkLoadProfile } from './bulk-load-models'

/** Props for {@link BulkLoadValueMappingComponent}. */
export interface BulkLoadValueMappingComponentProps {
  index: number
}

const inputClass = 'w-full max-w-xs rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'

/**
 * Render a BULK_LOAD_VALUE_MAPPING_FORM component.
 * @param props - {@link BulkLoadValueMappingComponentProps}
 * @returns The value mapping editor.
 */
export function BulkLoadValueMappingComponent({ index }: BulkLoadValueMappingComponentProps) {
  const { values, isWorking, setStepLabel } = useProcessStep()
  const field = values.valueMappingField && typeof values.valueMappingField === 'object' ? values.valueMappingField as QFieldMetaData : null
  const fieldFullName = typeof values.valueMappingFullFieldName === 'string' ? values.valueMappingFullFieldName : field?.name ?? ''
  const fieldTableName = typeof values.valueMappingFieldTableName === 'string' ? values.valueMappingFieldTableName : ''
  const fileValues = useMemo(() => (Array.isArray(values.fileValues) ? values.fileValues.map(String) : []), [values.fileValues])
  const tableStructure = readTableStructure(values.tableStructure)
  const [mapping] = useState(() => tableStructure ? BulkLoadMapping.fromProfile(tableStructure, values.bulkLoadProfile as BulkLoadProfile | undefined) : null)
  const [mapped, setMapped] = useState<Record<string, unknown>>(() => {
    const fromProfile = mapping?.valueMappings[fieldFullName] ?? {}
    const fromValues = values.valueMapping && typeof values.valueMapping === 'object' ? values.valueMapping as Record<string, unknown> : {}
    return { ...fromValues, ...fromProfile }
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const fieldIndex = typeof values.valueMappingFieldIndex === 'number' ? values.valueMappingFieldIndex : 0
  const fieldCount = Array.isArray(values.fieldNamesToDoValueMapping) ? values.fieldNamesToDoValueMapping.length : 1
  useEffect(() => {
    if (field) setStepLabel(`Value Mapping: ${field.label} (${fieldIndex + 1} of ${fieldCount})`)
    return () => setStepLabel(null)
  }, [field, fieldCount, fieldIndex, setStepLabel])

  const optionsQuery = useQuery({
    queryKey: ['qqq', 'bulkLoadValueOptions', fieldTableName, field?.name],
    queryFn: () => fetchTablePossibleValues(fieldTableName, field!.name),
    enabled: Boolean(field?.possibleValueSourceName && fieldTableName),
    staleTime: 60_000,
  })

  useSubmitContributor(`bulkLoadValueMapping-${index}`, () => {
    if (!mapping || !field) return { maySubmit: false }
    const nextErrors: Record<string, string> = {}
    if (field.isRequired) {
      for (const fileValue of fileValues) {
        if (mapped[fileValue] === undefined || mapped[fileValue] === null || mapped[fileValue] === '') nextErrors[fileValue] = 'A value is required for this mapping'
      }
    }
    setErrors(nextErrors)
    const draft = mapping.clone()
    draft.valueMappings[fieldFullName] = mapped
    const { profile } = draft.toProfile()
    return {
      maySubmit: Object.keys(nextErrors).length === 0,
      values: { ...profileSubmitValues(draft, profile), mappedValuesJSON: JSON.stringify(mapped) },
    }
  })

  if (!field || !mapping) return null

  /**
   * Store a mapped value (or clear it).
   * @param fileValue - The file value.
   * @param value - The table value.
   */
  const change = (fileValue: string, value: unknown) => {
    setMapped((previous) => {
      const next = { ...previous }
      if (value === '' || value === null || value === undefined) delete next[fileValue]
      else next[fileValue] = value
      return next
    })
    setErrors((previous) => ({ ...previous, [fileValue]: '' }))
  }

  return (
    <div className="space-y-2" data-qqq-id={`process-bulk-load-value-mapping-${index}`}>
      {fileValues.map((fileValue, rowIndex) => {
        const label = `${field.label} value for ${fileValue}`
        const current = mapped[fileValue]
        let input: React.ReactNode
        if (field.type === 'BOOLEAN') {
          input = (
            <select aria-label={label} className={inputClass} disabled={isWorking} value={current === true ? 'true' : current === false ? 'false' : ''}
              onChange={(event) => change(fileValue, event.target.value === '' ? '' : event.target.value === 'true')} data-qqq-id={`select-value-mapping-${rowIndex}`}>
              <option value="">Select a value</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          )
        } else if (field.possibleValueSourceName) {
          input = (
            <select aria-label={label} className={inputClass} disabled={isWorking} value={current === undefined || current === null ? '' : String(current)}
              onChange={(event) => {
                const option = optionsQuery.data?.find((candidate) => String(candidate.id) === event.target.value)
                change(fileValue, option ? option.id : '')
              }} data-qqq-id={`select-value-mapping-${rowIndex}`}>
              <option value="">Select a value</option>
              {(optionsQuery.data ?? []).map((option) => <option key={String(option.id)} value={String(option.id)}>{option.label}</option>)}
            </select>
          )
        } else {
          input = (
            <input aria-label={label} className={inputClass} disabled={isWorking} type={field.type === 'INTEGER' || field.type === 'DECIMAL' || field.type === 'LONG' ? 'number' : 'text'}
              value={current === undefined || current === null ? '' : String(current)} onChange={(event) => change(fileValue, event.target.value)}
              data-qqq-id={`input-value-mapping-${rowIndex}`} />
          )
        }
        return (
          <div key={fileValue} className="grid grid-cols-[minmax(0,2fr)_auto_minmax(0,3fr)] items-center gap-3 text-sm" data-qqq-id={`value-mapping-row-${rowIndex}`}>
            <span className="text-right">{fileValue}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <div>
              {input}
              {errors[fileValue] && <p role="alert" className="mt-1 text-xs text-destructive">{errors[fileValue]}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
