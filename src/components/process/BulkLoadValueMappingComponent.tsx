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
 * with an input for the table value it becomes (a searchable possible-value select,
 * showing the labels of values mapped before, for possible-value fields), submitted
 * as `mappedValuesJSON` together with the full bulk load profile.
 */

'use client'

import React, { useEffect, useId, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { ArrowRight } from 'lucide-react'

import type { QFieldMetaData } from '@/types'

import { PossibleValueSelect } from '@/components/forms/PossibleValueSelect'
import { useProcessStep, useSubmitContributor } from './ProcessStepContext'
import { BulkLoadMapping, FileDescription, profileSubmitValues, readTableStructure, type BulkLoadProfile } from './bulk-load-models'
import { SavedBulkLoadProfiles, readSavedProfile } from './SavedBulkLoadProfiles'

/** Props for {@link BulkLoadValueMappingComponent}. */
export interface BulkLoadValueMappingComponentProps {
  index: number
}

const inputClass = 'w-full max-w-xs rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 pointer-coarse:h-11'

/**
 * Form name of one file value's possible-value select.
 * @param rowIndex - Position of the file value.
 * @returns The name.
 */
const pvName = (rowIndex: number) => `value${rowIndex}`

/**
 * The possible-value selects of every file value, in one local form (the step form holds
 * only the screen's own fields); each change is reported with its file value.
 * @param props - Field, table, file values, current mapping and callbacks.
 * @returns The value rows.
 */
function PossibleValueRows({ field, tableName, fileValues, mapped, labels, errors, disabled, onChange }: {
  field: QFieldMetaData
  tableName: string
  fileValues: string[]
  mapped: Record<string, unknown>
  labels: Record<string, string>
  errors: Record<string, string>
  disabled: boolean
  onChange: (fileValue: string, value: unknown) => void
}) {
  const baseId = useId()
  const initial = useMemo(() => Object.fromEntries(fileValues.map((fileValue, rowIndex) => [pvName(rowIndex), mapped[fileValue] ?? null])), []) // eslint-disable-line react-hooks/exhaustive-deps
  const form = useForm<Record<string, unknown>>({ defaultValues: initial })
  const watched = useWatch({ control: form.control }) as Record<string, unknown>
  useEffect(() => {
    fileValues.forEach((fileValue, rowIndex) => {
      const value = watched?.[pvName(rowIndex)] ?? null
      if (value !== (mapped[fileValue] ?? null)) onChange(fileValue, value)
    })
  }, [watched]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {fileValues.map((fileValue, rowIndex) => {
        const current = mapped[fileValue]
        const initialLabel = current !== undefined && current !== null && current === initial[pvName(rowIndex)] ? labels[String(current)] : undefined
        return (
          <ValueRow key={fileValue} fileValue={fileValue} rowIndex={rowIndex} error={errors[fileValue]}>
            <PossibleValueSelect
              id={`${baseId}-${rowIndex}`}
              label={`${field.label} value for ${fileValue}`}
              hideLabel
              name={pvName(rowIndex)}
              control={form.control}
              fieldName={field.name}
              possibleValueSourceName={field.possibleValueSourceName}
              initialLabel={initialLabel}
              context={{ type: 'table', tableName }}
              disabled={disabled}
              required={field.isRequired}
              data-qqq-id={`select-value-mapping-${rowIndex}`}
            />
          </ValueRow>
        )
      })}
    </>
  )
}

/**
 * One file value and the table value it maps to.
 * @param props - The file value, its position, error and input.
 * @returns The row.
 */
function ValueRow({ fileValue, rowIndex, error, children }: { fileValue: string; rowIndex: number; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_auto_minmax(0,3fr)] items-center gap-3 text-sm" data-qqq-id={`value-mapping-row-${rowIndex}`}>
      <span className="text-right">{fileValue}</span>
      <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <div className="max-w-xs">
        {children}
        {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
    </div>
  )
}

/**
 * Render a BULK_LOAD_VALUE_MAPPING_FORM component.
 * @param props - {@link BulkLoadValueMappingComponentProps}
 * @returns The value mapping editor.
 */
export function BulkLoadValueMappingComponent({ index }: BulkLoadValueMappingComponentProps) {
  const { values, isWorking, setStepLabel } = useProcessStep()
  const field = values.valueMappingField && typeof values.valueMappingField === 'object' ? values.valueMappingField as QFieldMetaData : null
  const fieldFullName = typeof values.valueMappingFullFieldName === 'string' ? values.valueMappingFullFieldName : field?.name ?? ''
  const tableStructure = readTableStructure(values.tableStructure)
  const fieldTableName = typeof values.valueMappingFieldTableName === 'string' && values.valueMappingFieldTableName ? values.valueMappingFieldTableName : tableStructure?.tableName ?? ''
  const fileValues = useMemo(() => (Array.isArray(values.fileValues) ? values.fileValues.map(String) : []), [values.fileValues])
  const labels = useMemo(() => (values.mappedValueLabels && typeof values.mappedValueLabels === 'object' ? values.mappedValueLabels as Record<string, string> : {}), [values.mappedValueLabels])
  const file = useMemo(() => new FileDescription(values.headerValues, values.headerLetters, values.bodyValuesPreview), [values.headerValues, values.headerLetters, values.bodyValuesPreview])
  const [mapping, setMapping] = useState(() => tableStructure ? BulkLoadMapping.fromProfile(tableStructure, values.bulkLoadProfile as BulkLoadProfile | undefined) : null)
  const [mapped, setMapped] = useState<Record<string, unknown>>(() => {
    const fromProfile = mapping?.valueMappings[fieldFullName] ?? {}
    const fromValues = values.valueMapping && typeof values.valueMapping === 'object' ? values.valueMapping as Record<string, unknown> : {}
    return { ...fromValues, ...fromProfile }
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedProfile, setSavedProfile] = useState(() => readSavedProfile(values.savedBulkLoadProfileRecord))

  const fieldIndex = typeof values.valueMappingFieldIndex === 'number' ? values.valueMappingFieldIndex : 0
  const fieldCount = Array.isArray(values.fieldNamesToDoValueMapping) ? values.fieldNamesToDoValueMapping.length : 1
  useEffect(() => {
    if (field) setStepLabel(`Value Mapping: ${field.label} (${fieldIndex + 1} of ${fieldCount})`)
    return () => setStepLabel(null)
  }, [field, fieldCount, fieldIndex, setStepLabel])

  //////////////////////////////////////////////////////////////////////
  // the mapping on screen, with this field's value mappings as edited //
  //////////////////////////////////////////////////////////////////////
  const liveMapping = useMemo(() => {
    if (!mapping) return null
    const draft = mapping.clone()
    draft.valueMappings[fieldFullName] = mapped
    return draft
  }, [fieldFullName, mapped, mapping])

  useSubmitContributor(`bulkLoadValueMapping-${index}`, () => {
    if (!liveMapping || !field) return { maySubmit: false }
    const nextErrors: Record<string, string> = {}
    if (field.isRequired) {
      for (const fileValue of fileValues) {
        if (mapped[fileValue] === undefined || mapped[fileValue] === null || mapped[fileValue] === '') nextErrors[fileValue] = 'A value is required for this mapping'
      }
    }
    setErrors(nextErrors)
    const { profile } = liveMapping.clone().toProfile()
    return {
      maySubmit: Object.keys(nextErrors).length === 0,
      values: {
        ...profileSubmitValues(liveMapping, profile),
        mappedValuesJSON: JSON.stringify(mapped),
        ...(savedProfile ? { savedBulkLoadProfileId: String(savedProfile.id) } : {}),
      },
    }
  })

  if (!field || !mapping || !liveMapping) return null

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
      <SavedBulkLoadProfiles
        tableName={tableStructure?.tableName ?? ''}
        isBulkEdit={mapping.isBulkEdit}
        current={savedProfile}
        mapping={liveMapping}
        file={file}
        allowSelecting={false}
        profileToSave={() => liveMapping.clone().toProfile().profile}
        onChange={(profile) => {
          setSavedProfile(profile)
          if (profile && tableStructure) setMapping(BulkLoadMapping.fromProfile(tableStructure, JSON.parse(profile.mappingJson) as BulkLoadProfile))
        }}
      />
      {field.possibleValueSourceName ? (
        <PossibleValueRows field={field} tableName={fieldTableName} fileValues={fileValues} mapped={mapped} labels={labels} errors={errors} disabled={isWorking} onChange={change} />
      ) : fileValues.map((fileValue, rowIndex) => {
        const label = `${field.label} value for ${fileValue}`
        const current = mapped[fileValue]
        const input = field.type === 'BOOLEAN' ? (
          <select aria-label={label} className={inputClass} disabled={isWorking} value={current === true || current === 'true' ? 'true' : current === false || current === 'false' ? 'false' : ''}
            onChange={(event) => change(fileValue, event.target.value === '' ? '' : event.target.value === 'true')} data-qqq-id={`select-value-mapping-${rowIndex}`}>
            <option value="">Select a value</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        ) : (
          <input aria-label={label} className={inputClass} disabled={isWorking}
            type={field.type === 'INTEGER' || field.type === 'DECIMAL' || field.type === 'LONG' ? 'number' : field.type === 'DATE' ? 'date' : field.type === 'DATE_TIME' ? 'datetime-local' : 'text'}
            value={current === undefined || current === null ? '' : String(current)} onChange={(event) => change(fileValue, event.target.value)}
            data-qqq-id={`input-value-mapping-${rowIndex}`} />
        )
        return <ValueRow key={fileValue} fileValue={fileValue} rowIndex={rowIndex} error={errors[fileValue]}>{input}</ValueRow>
      })}
    </div>
  )
}
