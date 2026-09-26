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
 * @file BulkLoadFileMappingComponent — renders a BULK_LOAD_FILE_MAPPING_FORM process
 * component as the Material dashboard's file mapping screen does: the saved profile menu,
 * the uploaded file's details and preview (column tooltips naming the mapped fields, a warning
 * on repeated headers), the header-row and layout (or bulk-edit key field) choices with their
 * help, and the field-to-column (or typed default value) mapping with the grouped Add Fields
 * menu, submitted as the backend's v1 bulk load profile.
 */

'use client'

import React, { useEffect, useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { AlertTriangle, X } from 'lucide-react'

import type { QFieldMetaData, QFrontendStepMetaData } from '@/types'
import { fetchProcessPossibleValues } from '@/lib/api/possible-values'
import { selectHelpContent } from '@/lib/utils/help-utils'

import { PossibleValueSelect } from '@/components/forms/PossibleValueSelect'
import { HelpContent } from '@/components/records/HelpContent'
import { HoverTooltip } from '@/components/widgets/HoverTooltip'
import { useProcessStep, useSubmitContributor } from './ProcessStepContext'
import { BulkLoadAddFieldsMenu } from './BulkLoadAddFieldsMenu'
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

const PROCESS_HELP_ROLES = ['PROCESS_SCREEN', 'ALL_SCREENS'] as const
const DUPLICATE_HEADER_TOOLTIP = 'This column header is a duplicate. Only the first occurrence of it will be used.'

const inputClass = 'rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 pointer-coarse:h-11'

/** Settings of a mapped field the row can change. */
type FieldPatch = Partial<Pick<BulkLoadField, 'valueType' | 'columnIndex' | 'headerName' | 'defaultValue' | 'doValueMapping' | 'clearIfEmpty' | 'warning' | 'error'>>

/**
 * Help for one of the screen's own fields (hasHeaderRow, layout, tableKeyFields), from the
 * step's form field metadata, for process screens.
 * @param props - The step, field name and element id.
 * @returns The help text, or `null` when the field has none.
 */
function StepFieldHelp({ step, fieldName, id }: { step: QFrontendStepMetaData; fieldName: string; id: string }) {
  const field = step.formFields?.find((candidate) => candidate.name === fieldName)
  const help = selectHelpContent(field?.helpContents, PROCESS_HELP_ROLES)
  if (!help) return null
  return (
    <p className="mt-1 text-sm text-muted-foreground" data-qqq-id={`bulk-load-help-${fieldName}`}>
      <HelpContent helpContent={help} id={id} />
    </p>
  )
}

/**
 * Whether a step field has help for process screens (for `aria-describedby`).
 * @param step - The step.
 * @param fieldName - Field name.
 * @returns `true` when help is shown.
 */
function hasStepFieldHelp(step: QFrontendStepMetaData, fieldName: string): boolean {
  return Boolean(selectHelpContent(step.formFields?.find((candidate) => candidate.name === fieldName)?.helpContents, PROCESS_HELP_ROLES))
}

/**
 * A possible-value default value: the searchable possible-value select of the field's table.
 * @param props - The field, its table, value and change callback.
 * @returns The select.
 */
function PossibleValueDefault({ field, tableName, value, label, disabled, onChange, qqqId }: {
  field: QFieldMetaData
  tableName: string
  value: unknown
  label: string
  disabled: boolean
  onChange: (value: unknown) => void
  qqqId: string
}) {
  const id = useId()
  const form = useForm<Record<string, unknown>>({ defaultValues: { defaultValue: value ?? null } })
  const watched = useWatch({ control: form.control, name: 'defaultValue' })
  useEffect(() => {
    if ((watched ?? null) !== (value ?? null)) onChange(watched ?? null)
  }, [watched]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <PossibleValueSelect
      id={`${id}-default`}
      label={label}
      hideLabel
      name="defaultValue"
      control={form.control}
      fieldName={field.name}
      possibleValueSourceName={field.possibleValueSourceName}
      context={{ type: 'table', tableName }}
      disabled={disabled}
      data-qqq-id={qqqId}
    />
  )
}

/**
 * The default value input, typed by the field: possible values (searchable, with labels),
 * yes/no, date, date-time, time, number or text.
 * @param props - The mapped field, value and change callback.
 * @returns The input.
 */
function DefaultValueInput({ field, disabled, onChange }: { field: BulkLoadField; disabled: boolean; onChange: (value: unknown) => void }) {
  const label = `Default value for ${field.getQualifiedLabel()}`
  const qqqId = `input-bulk-load-default-${field.getQualifiedNameWithWideSuffix()}`
  const value = field.defaultValue
  const text = value === null || value === undefined ? '' : String(value)
  if (field.field.possibleValueSourceName) {
    return <PossibleValueDefault field={field.field} tableName={field.tableStructure.tableName} value={value} label={label} disabled={disabled} onChange={onChange} qqqId={qqqId} />
  }
  if (field.field.type === 'BOOLEAN') {
    return (
      <select aria-label={label} value={value === true || value === 'true' ? 'true' : value === false || value === 'false' ? 'false' : ''} disabled={disabled}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value === 'true')} className={inputClass} data-qqq-id={qqqId}>
        <option value="">Select a value</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    )
  }
  const type = field.field.type === 'DATE' ? 'date'
    : field.field.type === 'DATE_TIME' ? 'datetime-local'
      : field.field.type === 'TIME' ? 'time'
        : field.field.type === 'INTEGER' || field.field.type === 'LONG' || field.field.type === 'DECIMAL' ? 'number' : 'text'
  return (
    <input type={type} aria-label={label} value={text} disabled={disabled} step={field.field.type === 'DECIMAL' ? 'any' : undefined}
      onChange={(event) => onChange(event.target.value)} className={inputClass} data-qqq-id={qqqId} />
  )
}

/**
 * One mapped field: column or default value, value mapping and preview.
 * @param props - The field, the file and change callbacks.
 * @returns The field row.
 */
function MappedFieldRow({ field, file, hasHeaderRow, isBulkEdit, isRequired, onPatch, onRemove, disabled }: {
  field: BulkLoadField
  file: FileDescription
  hasHeaderRow: boolean
  isBulkEdit: boolean
  isRequired: boolean
  onPatch: (patch: FieldPatch) => void
  onRemove?: () => void
  disabled: boolean
}) {
  const baseId = useId()
  const options = file.columnOptions(hasHeaderRow)
  const preview = field.valueType === 'column' ? file.previewValues(field.columnIndex, hasHeaderRow).slice(0, 5) : []
  const label = field.getQualifiedLabel()
  const suffix = field.getQualifiedNameWithWideSuffix()
  const messageId = `${baseId}-message`
  const hasMessage = Boolean(field.error || field.warning)
  return (
    <div className="rounded-lg border border-border p-3" data-qqq-id={`bulk-load-field-${suffix}`} data-has-error={field.error ? 'true' : undefined}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{label}{field.field.isRequired && !isBulkEdit ? ' *' : ''}</span>
        {onRemove && (
          <button type="button" onClick={onRemove} disabled={disabled} aria-label={`Remove ${label}`} title="Remove this field from your mapping."
            className="rounded p-1 text-destructive hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-qqq-id={`button-remove-bulk-load-field-${suffix}`}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm" role="radiogroup" aria-label={`${label} value source`}>
        <label className="flex items-center gap-1">
          <input type="radio" name={`${baseId}-type`} checked={field.valueType === 'column'} disabled={disabled}
            onChange={() => onPatch({ valueType: 'column', error: null, warning: null })} data-qqq-id={`radio-bulk-load-column-${suffix}`} />
          File column
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" name={`${baseId}-type`} checked={field.valueType === 'defaultValue'} disabled={disabled}
            onChange={() => onPatch({ valueType: 'defaultValue', error: null, warning: null })} data-qqq-id={`radio-bulk-load-default-${suffix}`} />
          Default value
        </label>
      </div>
      {field.valueType === 'column' ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <select
            aria-label={`Column for ${label}`}
            aria-describedby={hasMessage ? messageId : undefined}
            aria-invalid={field.error ? true : undefined}
            value={field.columnIndex ?? ''}
            disabled={disabled}
            onChange={(event) => {
              const value = event.target.value
              onPatch({
                columnIndex: value === '' ? null : Number(value),
                headerName: value === '' || !hasHeaderRow ? null : file.headerValues[Number(value)] ?? null,
                warning: null,
                error: null,
              })
            }}
            className={inputClass}
            data-qqq-id={`select-bulk-load-column-${suffix}`}
          >
            <option value="">Select a column</option>
            {options.map((option) => <option key={option.index} value={option.index}>{option.label}</option>)}
          </select>
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={field.doValueMapping} disabled={disabled}
              onChange={(event) => onPatch({ doValueMapping: event.target.checked })}
              data-qqq-id={`checkbox-bulk-load-map-values-${suffix}`} />
            Map values
          </label>
          {isBulkEdit && !isRequired && (
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={field.clearIfEmpty} disabled={disabled}
                onChange={(event) => onPatch({ clearIfEmpty: event.target.checked })} data-qqq-id={`checkbox-bulk-load-clear-if-empty-${suffix}`} />
              Clear if empty
            </label>
          )}
          {preview.length > 0 && (
            <span className="text-xs text-muted-foreground" data-qqq-id={`bulk-load-preview-${suffix}`}>
              {`Preview: ${preview.join(', ')}`}
            </span>
          )}
        </div>
      ) : (
        <div className="mt-2 max-w-sm">
          <DefaultValueInput field={field} disabled={disabled} onChange={(value) => onPatch({ defaultValue: value, error: null, warning: null })} />
        </div>
      )}
      {field.warning && <p id={messageId} className="mt-1 text-xs text-amber-700 dark:text-amber-400" data-bulk-load-field-error="" data-qqq-id={`bulk-load-field-warning-${suffix}`}>{field.warning}</p>}
      {field.error && <p id={field.warning ? undefined : messageId} role="alert" className="mt-1 text-xs text-destructive" data-bulk-load-field-error="">{field.error}</p>}
    </div>
  )
}

/**
 * The uploaded file's first rows. Mapped columns name their fields in a tooltip; a header that
 * repeats an earlier one is flagged (only the first is read).
 * @param props - The file and mapping.
 * @returns The preview table.
 */
function FilePreview({ file, mapping }: { file: FileDescription; mapping: BulkLoadMapping }) {
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs" data-qqq-id="bulk-load-file-preview" aria-label="File preview">
        <thead>
          <tr className="bg-muted">
            <th scope="col" className="border border-border px-1"><span className="sr-only">Row</span></th>
            {file.headerLetters.map((letter, columnIndex) => {
              const fields = mapping.fieldsForColumn(columnIndex)
              const duplicate = mapping.hasHeaderRow && file.duplicateHeaderIndexes[columnIndex]
              const heading = (
                <span className={fields.length > 0 ? 'font-semibold text-primary' : undefined}>
                  {letter}
                  {fields.length > 0 && <span className="ml-1 rounded bg-primary px-1 text-primary-foreground" aria-label={`${fields.length} mapped`}>{fields.length}</span>}
                </span>
              )
              return (
                <th key={letter} scope="col" className="border border-border px-2 text-center" data-qqq-id={`bulk-load-preview-column-${letter}`}>
                  <span className="inline-flex items-center gap-1">
                    {duplicate && (
                      <HoverTooltip content={DUPLICATE_HEADER_TOOLTIP} qqqId={`bulk-load-duplicate-header-${letter}`}>
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-label="Duplicate header" role="img" />
                      </HoverTooltip>
                    )}
                    {fields.length > 0 ? (
                      <HoverTooltip
                        qqqId={`bulk-load-column-tooltip-${letter}`}
                        content={(
                          <span className="block text-left">
                            {`This column is mapped to the field${fields.length === 1 ? '' : 's'}:`}
                            <ul className="mt-1 list-disc pl-4">{fields.map((field) => <li key={field.key}>{field.getQualifiedLabel()}</li>)}</ul>
                          </span>
                        )}
                      >
                        {heading}
                      </HoverTooltip>
                    ) : heading}
                  </span>
                </th>
              )
            })}
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
  )
}

/**
 * Render a BULK_LOAD_FILE_MAPPING_FORM component.
 * @param props - {@link BulkLoadFileMappingComponentProps}
 * @returns The mapping editor.
 */
export function BulkLoadFileMappingComponent({ index }: BulkLoadFileMappingComponentProps) {
  const { values, isWorking, processName, tableMetaData, setStepLabel, step } = useProcessStep()
  const tableStructure = readTableStructure(values.tableStructure)
  const file = useMemo(() => new FileDescription(values.headerValues, values.headerLetters, values.bodyValuesPreview), [values.headerValues, values.headerLetters, values.bodyValuesPreview])
  const [mapping, setMapping] = useState<BulkLoadMapping | null>(() => tableStructure
    ? BulkLoadMapping.fromProfile(tableStructure, (values.bulkLoadProfile ?? values.suggestedBulkLoadProfile) as BulkLoadProfile | undefined)
    : null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedProfile, setSavedProfile] = useState(() => readSavedProfile(values.savedBulkLoadProfileRecord))
  const headingId = useId()
  const helpId = useId()

  useEffect(() => {
    setStepLabel(savedProfile ? `File Mapping / ${savedProfile.label}` : null)
    return () => setStepLabel(null)
  }, [savedProfile, setStepLabel])

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
    const maySubmit = !haveErrors && Object.keys(nextErrors).length === 0
    if (!maySubmit) {
      ///////////////////////////////////////////////////////////////////////
      // bring the first problem into view, as the Material dashboard does //
      ///////////////////////////////////////////////////////////////////////
      window.setTimeout(() => {
        document.querySelector(`[data-qqq-id="process-bulk-load-file-mapping-${index}"] [data-bulk-load-field-error], [data-qqq-id="process-bulk-load-file-mapping-${index}"] [data-bulk-load-screen-error]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 250)
    }
    return {
      maySubmit,
      values: { ...profileSubmitValues(draft, profile), ...(savedProfile ? { savedBulkLoadProfileId: String(savedProfile.id) } : {}) },
    }
  })

  if (!tableStructure || !mapping) {
    return <p role="alert" className="text-sm text-destructive">The uploaded file could not be read for mapping.</p>
  }

  const columnNames = file.columnNames(mapping.hasHeaderRow)
  const layouts = mapping.hasAssociations ? LAYOUTS : LAYOUTS.slice(0, 1)
  const fileName = typeof values.fileBaseName === 'string' ? values.fileBaseName : ''
  const unmappedKeys = mapping.unmappedKeyFieldLabels()
  const keyFieldsError = errors.keyFields || (unmappedKeys.length > 0 ? `The following key fields are not mapped: ${unmappedKeys.join(', ')}` : '')
  const keyFieldsLabel = step.formFields?.find((field) => field.name === 'tableKeyFields')?.label ?? 'Key Fields'
  const describedBy = (fieldName: string, errorId?: string) => [hasStepFieldHelp(step, fieldName) ? `${helpId}-${fieldName}` : '', errorId ?? ''].filter(Boolean).join(' ') || undefined

  return (
    <div className="space-y-6" data-qqq-id={`process-bulk-load-file-mapping-${index}`}>
      <SavedBulkLoadProfiles
        tableName={tableStructure.tableName || tableMetaData?.name || ''}
        isBulkEdit={mapping.isBulkEdit}
        current={savedProfile}
        mapping={mapping}
        file={file}
        allowSelecting
        profileToSave={() => mapping.clone().toProfile().profile}
        onSelect={(profile) => {
          setErrors({})
          setMapping(profile ? BulkLoadMapping.fromProfile(tableStructure, JSON.parse(profile.mappingJson) as BulkLoadProfile, file) : new BulkLoadMapping(tableStructure))
        }}
        onResetToSuggested={() => {
          setErrors({})
          setMapping(BulkLoadMapping.fromProfile(tableStructure, (values.suggestedBulkLoadProfile ?? values.bulkLoadProfile) as BulkLoadProfile | undefined, file))
        }}
        onChange={setSavedProfile}
      />
      <section aria-labelledby={headingId} className="space-y-3">
        <h4 id={headingId} className="text-sm font-semibold text-foreground">File Details</h4>
        <div className="flex flex-wrap gap-x-6 text-sm">
          <span data-qqq-id="bulk-load-file-name"><span className="font-semibold">File Name:</span> {fileName}</span>
          <span data-qqq-id="bulk-load-file-details"><span className="font-semibold">File Details:</span> {`${columnNames.length} column${columnNames.length === 1 ? '' : 's'}`}</span>
        </div>
        <FilePreview file={file} mapping={mapping} />
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={mapping.hasHeaderRow}
                disabled={isWorking}
                aria-describedby={describedBy('hasHeaderRow')}
                onChange={(event) => { const checked = event.target.checked; update((draft) => draft.changeHasHeaderRow(checked, file)) }}
                data-qqq-id="checkbox-bulk-load-has-header-row"
              />
              Does the file have a header row? *
            </label>
            <StepFieldHelp step={step} fieldName="hasHeaderRow" id={`${helpId}-hasHeaderRow`} />
          </div>
          {!mapping.isBulkEdit ? (
            <div>
              <div className="flex items-center gap-2">
                <label htmlFor={`${helpId}-layout-select`}>File Layout *</label>
                <select id={`${helpId}-layout-select`} value={mapping.layout ?? ''} disabled={isWorking} className={inputClass}
                  aria-describedby={describedBy('layout', errors.layout ? `${helpId}-layout-error` : undefined)}
                  aria-invalid={errors.layout ? true : undefined}
                  onChange={(event) => { const layout = event.target.value; update((draft) => draft.switchLayout(layout)); setErrors((previous) => ({ ...previous, layout: '' })) }}
                  data-qqq-id="select-bulk-load-layout">
                  {!mapping.layout && <option value="">Select a layout</option>}
                  {layouts.map((layout) => <option key={layout.id} value={layout.id}>{layout.label}</option>)}
                </select>
              </div>
              {errors.layout && <p id={`${helpId}-layout-error`} role="alert" className="mt-1 text-xs text-destructive" data-bulk-load-screen-error="">{errors.layout}</p>}
              <StepFieldHelp step={step} fieldName="layout" id={`${helpId}-layout`} />
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <label htmlFor={`${helpId}-key-fields-select`}>{`${keyFieldsLabel} *`}</label>
                <select id={`${helpId}-key-fields-select`} value={mapping.keyFields ?? ''} disabled={isWorking} className={inputClass}
                  aria-describedby={describedBy('tableKeyFields', keyFieldsError ? `${helpId}-keyFields-error` : undefined)}
                  aria-invalid={keyFieldsError ? true : undefined}
                  onChange={(event) => {
                    const keyFields = event.target.value || null
                    update((draft) => draft.setKeyFields(keyFields))
                    setErrors((previous) => ({ ...previous, keyFields: '' }))
                  }}
                  data-qqq-id="select-bulk-load-key-fields">
                  <option value="">Select key fields</option>
                  {(keyFieldsQuery.data ?? []).map((option) => <option key={String(option.id)} value={String(option.id)}>{option.label}</option>)}
                </select>
              </div>
              {keyFieldsError && <p id={`${helpId}-keyFields-error`} role="alert" className="mt-1 text-xs text-destructive" data-bulk-load-screen-error="" data-qqq-id="bulk-load-key-fields-error">{keyFieldsError}</p>}
              <StepFieldHelp step={step} fieldName="tableKeyFields" id={`${helpId}-tableKeyFields`} />
            </div>
          )}
        </div>
      </section>

      <section aria-label={mapping.isBulkEdit ? 'Key Fields' : 'Required Fields'} className="space-y-2" data-qqq-id="bulk-load-required-fields">
        <h4 className="text-sm font-semibold text-foreground">{mapping.isBulkEdit ? 'Key Fields' : 'Required Fields'}</h4>
        {mapping.requiredFields.length === 0 && (
          <p className="text-sm italic text-muted-foreground" data-qqq-id="bulk-load-required-fields-empty">
            {mapping.isBulkEdit ? 'Select table key fields to continue.' : 'There are no required fields in this table.'}
          </p>
        )}
        {mapping.requiredFields.map((field) => (
          <MappedFieldRow key={field.key} field={field} file={file} hasHeaderRow={mapping.hasHeaderRow} isBulkEdit={mapping.isBulkEdit} isRequired disabled={isWorking}
            onPatch={(patch) => patchField(field.key, patch)} />
        ))}
      </section>

      <section aria-label={mapping.isBulkEdit ? 'Fields To Update' : 'Additional Fields'} className="space-y-2" data-qqq-id="bulk-load-additional-fields">
        <h4 className="text-sm font-semibold text-foreground">{mapping.isBulkEdit ? 'Fields To Update' : 'Additional Fields'}</h4>
        {mapping.additionalFields.map((field) => (
          <MappedFieldRow key={field.key} field={field} file={file} hasHeaderRow={mapping.hasHeaderRow} isBulkEdit={mapping.isBulkEdit} isRequired={false} disabled={isWorking}
            onPatch={(patch) => patchField(field.key, patch)}
            onRemove={() => update((draft) => { const target = draft.findField(field.key); if (target) draft.removeField(target) })} />
        ))}
        <BulkLoadAddFieldsMenu
          mapping={mapping}
          disabled={isWorking}
          onAdd={(qualifiedName) => {
            update((draft) => {
              const target = draft.unusedFields.find((candidate) => candidate.getQualifiedName() === qualifiedName)
              if (target) draft.addField(target)
            })
            setErrors((previous) => ({ ...previous, fields: '' }))
          }}
        />
        {errors.fields && <p role="alert" className="text-xs text-destructive" data-bulk-load-screen-error="">{errors.fields}</p>}
      </section>
    </div>
  )
}
