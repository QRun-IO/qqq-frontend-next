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
 * @file BulkLoadFileMappingComponent — renders a BULK_LOAD_FILE_MAPPING_FORM
 * process component: the uploaded file's details and preview, the header-row and
 * layout (or bulk-edit key field) choices, and the field-to-column (or default
 * value) mapping, submitted as the backend's v1 bulk load profile.
 */

'use client'

import React, { useEffect, useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'

import { fetchProcessPossibleValues } from '@/lib/api/possible-values'

import { useProcessStep, useSubmitContributor } from './ProcessStepContext'
import {
  BulkLoadField,
  BulkLoadMapping,
  FileDescription,
  profileSubmitValues,
  readTableStructure,
  type BulkLoadProfile,
} from './bulk-load-models'
import { SavedBulkLoadProfiles, readSavedProfile } from './SavedBulkLoadProfiles'

/** Props for {@link BulkLoadFileMappingComponent}. */
export interface BulkLoadFileMappingComponentProps {
  index: number
}

const LAYOUTS = [
  { id: 'FLAT', label: 'Flat' },
  { id: 'TALL', label: 'Tall' },
  { id: 'WIDE', label: 'Wide' },
]

const inputClass = 'rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 pointer-coarse:h-11'

/** Settings of a mapped field the row can change. */
type FieldPatch = Partial<Pick<BulkLoadField, 'valueType' | 'columnIndex' | 'headerName' | 'defaultValue' | 'doValueMapping' | 'clearIfEmpty' | 'warning'>>

/**
 * One mapped field: column or default value, value mapping and preview.
 * @param props - The field, the file and change callbacks.
 * @returns The field row.
 */
function MappedFieldRow({ field, file, hasHeaderRow, isBulkEdit, onPatch, onRemove, disabled }: {
  field: BulkLoadField
  file: FileDescription
  hasHeaderRow: boolean
  isBulkEdit: boolean
  onPatch: (patch: FieldPatch) => void
  onRemove?: () => void
  disabled: boolean
}) {
  const baseId = useId()
  const columnNames = file.columnNames(hasHeaderRow)
  const preview = field.valueType === 'column' ? file.previewValues(field.columnIndex, hasHeaderRow).slice(0, 5) : []
  const label = field.getQualifiedLabel()
  return (
    <div className="rounded-lg border border-border p-3" data-qqq-id={`bulk-load-field-${field.getQualifiedNameWithWideSuffix()}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{label}{field.field.isRequired && !isBulkEdit ? ' *' : ''}</span>
        {onRemove && (
          <button type="button" onClick={onRemove} disabled={disabled} aria-label={`Remove ${label}`} className="rounded p-1 text-muted-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-qqq-id={`button-remove-bulk-load-field-${field.getQualifiedNameWithWideSuffix()}`}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm" role="radiogroup" aria-label={`${label} value source`}>
        <label className="flex items-center gap-1">
          <input type="radio" name={`${baseId}-type`} checked={field.valueType === 'column'} disabled={disabled}
            onChange={() => onPatch({ valueType: 'column' })} />
          File column
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" name={`${baseId}-type`} checked={field.valueType === 'defaultValue'} disabled={disabled}
            onChange={() => onPatch({ valueType: 'defaultValue' })} />
          Default value
        </label>
      </div>
      {field.valueType === 'column' ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">{`Column for ${label}`}</span>
            <select
              aria-label={`Column for ${label}`}
              value={field.columnIndex ?? ''}
              disabled={disabled}
              onChange={(event) => {
                const value = event.target.value
                onPatch({
                  columnIndex: value === '' ? null : Number(value),
                  headerName: value === '' || !hasHeaderRow ? null : file.headerValues[Number(value)] ?? null,
                  warning: null,
                })
              }}
              className={inputClass}
              data-qqq-id={`select-bulk-load-column-${field.getQualifiedNameWithWideSuffix()}`}
            >
              <option value="">Select a column</option>
              {columnNames.map((name, columnIndex) => <option key={columnIndex} value={columnIndex}>{name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={field.doValueMapping} disabled={disabled}
              onChange={(event) => onPatch({ doValueMapping: event.target.checked })}
              data-qqq-id={`checkbox-bulk-load-map-values-${field.getQualifiedNameWithWideSuffix()}`} />
            Map values
          </label>
          {isBulkEdit && (
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={field.clearIfEmpty} disabled={disabled}
                onChange={(event) => onPatch({ clearIfEmpty: event.target.checked })} />
              Clear if empty
            </label>
          )}
          {preview.length > 0 && (
            <span className="text-xs text-muted-foreground" data-qqq-id={`bulk-load-preview-${field.getQualifiedNameWithWideSuffix()}`}>
              {`Preview: ${preview.join(', ')}`}
            </span>
          )}
        </div>
      ) : (
        <div className="mt-2">
          <input
            type={field.field.type === 'INTEGER' || field.field.type === 'LONG' || field.field.type === 'DECIMAL' ? 'number' : 'text'}
            aria-label={`Default value for ${label}`}
            value={field.defaultValue === null || field.defaultValue === undefined ? '' : String(field.defaultValue)}
            disabled={disabled}
            onChange={(event) => onPatch({ defaultValue: event.target.value })}
            className={inputClass}
            data-qqq-id={`input-bulk-load-default-${field.getQualifiedNameWithWideSuffix()}`}
          />
        </div>
      )}
      {field.warning && <p className="mt-1 text-xs text-amber-700">{field.warning}</p>}
      {field.error && <p role="alert" className="mt-1 text-xs text-destructive">{field.error}</p>}
    </div>
  )
}

/**
 * Render a BULK_LOAD_FILE_MAPPING_FORM component.
 * @param props - {@link BulkLoadFileMappingComponentProps}
 * @returns The mapping editor.
 */
export function BulkLoadFileMappingComponent({ index }: BulkLoadFileMappingComponentProps) {
  const { values, isWorking, processName, tableMetaData, setStepLabel } = useProcessStep()
  const tableStructure = readTableStructure(values.tableStructure)
  const file = useMemo(() => new FileDescription(values.headerValues, values.headerLetters, values.bodyValuesPreview), [values.headerValues, values.headerLetters, values.bodyValuesPreview])
  const [mapping, setMapping] = useState<BulkLoadMapping | null>(() => tableStructure
    ? BulkLoadMapping.fromProfile(tableStructure, (values.bulkLoadProfile ?? values.suggestedBulkLoadProfile) as BulkLoadProfile | undefined)
    : null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedProfile, setSavedProfile] = useState(() => readSavedProfile(values.savedBulkLoadProfileRecord))

  useEffect(() => {
    setStepLabel(savedProfile ? `File Mapping / ${savedProfile.label}` : null)
    return () => setStepLabel(null)
  }, [savedProfile, setStepLabel])
  const headingId = useId()

  const keyFieldsQuery = useQuery({
    queryKey: ['qqq', 'bulkLoadKeyFields', processName],
    queryFn: () => fetchProcessPossibleValues(processName, 'tableKeyFields'),
    enabled: Boolean(mapping?.isBulkEdit),
    staleTime: 60_000,
  })

  /**
   * Apply a change to a copy of the mapping.
   * @param mutate - Change to make on the copy.
   */
  const update = (mutate: (draft: BulkLoadMapping) => void) => {
    setMapping((current) => {
      if (!current) return current
      const draft = current.clone()
      mutate(draft)
      return draft
    })
  }

  /**
   * Change one mapped field's settings.
   * @param key - Field key.
   * @param patch - New settings.
   */
  const patchField = (key: string, patch: FieldPatch) => {
    update((draft) => {
      const target = draft.findField(key)
      if (target) Object.assign(target, patch)
    })
  }

  useSubmitContributor(`bulkLoadFileMapping-${index}`, () => {
    if (!mapping) return { maySubmit: false }
    const draft = mapping.clone()
    const { haveErrors, profile } = draft.toProfile()
    const nextErrors: Record<string, string> = {}
    if (!draft.isBulkEdit && !draft.layout) nextErrors.layout = 'This field is required.'
    if (draft.isBulkEdit && !draft.keyFields) nextErrors.keyFields = 'This field is required.'
    if (draft.requiredFields.length === 0 && draft.additionalFields.length === 0) nextErrors.fields = 'You must have at least 1 field.'
    setErrors(nextErrors)
    setMapping(draft)
    return {
      maySubmit: !haveErrors && Object.keys(nextErrors).length === 0,
      values: { ...profileSubmitValues(draft, profile), ...(savedProfile ? { savedBulkLoadProfileId: String(savedProfile.id) } : {}) },
    }
  })

  if (!tableStructure || !mapping) {
    return <p role="alert" className="text-sm text-destructive">The uploaded file could not be read for mapping.</p>
  }

  const columnNames = file.columnNames(mapping.hasHeaderRow)
  const layouts = mapping.hasAssociations ? LAYOUTS : LAYOUTS.slice(0, 1)
  const fileName = typeof values.fileBaseName === 'string' ? values.fileBaseName : ''
  const addable = mapping.unusedFields.filter((field) => !field.isMany() || mapping.layout !== 'FLAT')

  return (
    <div className="space-y-6" data-qqq-id={`process-bulk-load-file-mapping-${index}`}>
      <SavedBulkLoadProfiles
        tableName={tableStructure.tableName || tableMetaData?.name || ''}
        isBulkEdit={mapping.isBulkEdit}
        current={savedProfile}
        allowSelecting
        profileToSave={() => mapping.clone().toProfile().profile}
        onSelect={(profile) => {
          const suggested = (values.suggestedBulkLoadProfile ?? values.bulkLoadProfile) as BulkLoadProfile | undefined
          setMapping(BulkLoadMapping.fromProfile(tableStructure, profile ? JSON.parse(profile.mappingJson) as BulkLoadProfile : suggested))
        }}
        onChange={setSavedProfile}
      />
      <section aria-labelledby={headingId} className="space-y-3">
        <h4 id={headingId} className="text-sm font-semibold text-foreground">File Details</h4>
        <div className="flex flex-wrap gap-x-6 text-sm">
          <span data-qqq-id="bulk-load-file-name"><span className="font-semibold">File Name:</span> {fileName}</span>
          <span data-qqq-id="bulk-load-file-details"><span className="font-semibold">File Details:</span> {`${columnNames.length} column${columnNames.length === 1 ? '' : 's'}`}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="border-collapse text-xs" data-qqq-id="bulk-load-file-preview" aria-label="File preview">
            <thead>
              <tr className="bg-muted">
                <th scope="col" className="border border-border px-1" />
                {file.headerLetters.map((letter, columnIndex) => (
                  <th key={letter} scope="col" className="border border-border px-2 text-center">
                    {letter}
                    {mapping.fieldsForColumn(columnIndex).length > 0 && <span className="ml-1 rounded bg-primary px-1 text-primary-foreground" aria-label={`${mapping.fieldsForColumn(columnIndex).length} mapped`}>{mapping.fieldsForColumn(columnIndex).length}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" className="border border-border bg-muted px-1">1</th>
                {file.headerValues.map((value, columnIndex) => <td key={columnIndex} className={`border border-border px-2 ${mapping.hasHeaderRow ? 'bg-muted/60 font-medium' : ''}`}>{value}</td>)}
              </tr>
              {(file.bodyValuesPreview[0] ?? []).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  <th scope="row" className="border border-border bg-muted px-1">{rowIndex + 2}</th>
                  {file.headerLetters.map((letter, columnIndex) => <td key={letter} className="border border-border px-2">{file.previewValues(columnIndex, true)[rowIndex] ?? ''}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mapping.hasHeaderRow}
              disabled={isWorking}
              onChange={(event) => { const checked = event.target.checked; update((draft) => { draft.hasHeaderRow = checked }) }}
              data-qqq-id="checkbox-bulk-load-has-header-row"
            />
            Does the file have a header row? *
          </label>
          {!mapping.isBulkEdit ? (
            <label className="flex items-center gap-2">
              File Layout *
              <select value={mapping.layout ?? ''} disabled={isWorking} className={inputClass}
                onChange={(event) => { const layout = event.target.value; update((draft) => draft.switchLayout(layout)); setErrors((previous) => ({ ...previous, layout: '' })) }}
                data-qqq-id="select-bulk-load-layout">
                {!mapping.layout && <option value="">Select a layout</option>}
                {layouts.map((layout) => <option key={layout.id} value={layout.id}>{layout.label}</option>)}
              </select>
            </label>
          ) : (
            <label className="flex items-center gap-2">
              Key Fields *
              <select value={mapping.keyFields ?? ''} disabled={isWorking} className={inputClass}
                onChange={(event) => {
                  const keyFields = event.target.value || null
                  update((draft) => {
                    draft.keyFields = keyFields
                    const keys = (keyFields ?? '').split('|')
                    const all = [...draft.requiredFields, ...draft.additionalFields]
                    draft.requiredFields = all.filter((field) => keys.includes(field.getQualifiedName()))
                    draft.additionalFields = all.filter((field) => !keys.includes(field.getQualifiedName()))
                    for (const key of keys) {
                      const unused = draft.unusedFields.find((field) => field.getQualifiedName() === key)
                      if (unused) {
                        draft.unusedFields = draft.unusedFields.filter((field) => field !== unused)
                        draft.requiredFields.push(unused)
                      }
                    }
                  })
                  setErrors((previous) => ({ ...previous, keyFields: '' }))
                }}
                data-qqq-id="select-bulk-load-key-fields">
                <option value="">Select key fields</option>
                {(keyFieldsQuery.data ?? []).map((option) => <option key={String(option.id)} value={String(option.id)}>{option.label}</option>)}
              </select>
            </label>
          )}
        </div>
        {errors.layout && <p role="alert" className="text-xs text-destructive">{errors.layout}</p>}
        {errors.keyFields && <p role="alert" className="text-xs text-destructive">{errors.keyFields}</p>}
      </section>

      <section aria-label={mapping.isBulkEdit ? 'Key fields' : 'Required fields'} className="space-y-2">
        <h4 className="text-sm font-semibold text-foreground">{mapping.isBulkEdit ? 'Key Fields' : 'Required Fields'}</h4>
        {mapping.requiredFields.length === 0 && <p className="text-sm text-muted-foreground">None</p>}
        {mapping.requiredFields.map((field) => (
          <MappedFieldRow key={field.key} field={field} file={file} hasHeaderRow={mapping.hasHeaderRow} isBulkEdit={mapping.isBulkEdit} disabled={isWorking}
            onPatch={(patch) => patchField(field.key, patch)} />
        ))}
      </section>

      <section aria-label="Additional fields" className="space-y-2">
        <h4 className="text-sm font-semibold text-foreground">Additional Fields</h4>
        {mapping.additionalFields.map((field) => (
          <MappedFieldRow key={field.key} field={field} file={file} hasHeaderRow={mapping.hasHeaderRow} isBulkEdit={mapping.isBulkEdit} disabled={isWorking}
            onPatch={(patch) => patchField(field.key, patch)}
            onRemove={() => update((draft) => { const target = draft.findField(field.key); if (target) draft.removeField(target) })} />
        ))}
        <label className="flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Add Field</span>
          <select value="" disabled={isWorking || addable.length === 0} className={inputClass}
            onChange={(event) => {
              const key = event.target.value
              update((draft) => { const target = draft.unusedFields.find((candidate) => candidate.key === key); if (target) draft.addField(target) })
              setErrors((previous) => ({ ...previous, fields: '' }))
            }}
            data-qqq-id="select-bulk-load-add-field">
            <option value="">Select a field to add</option>
            {addable.map((field) => <option key={field.key} value={field.key}>{field.getQualifiedLabel()}</option>)}
          </select>
        </label>
        {errors.fields && <p role="alert" className="text-xs text-destructive">{errors.fields}</p>}
      </section>
    </div>
  )
}
