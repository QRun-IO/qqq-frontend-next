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
 * @file DynamicFormField — single metadata-driven form field dispatcher with optional help tooltip.
 */

'use client'

// DynamicFormField — renders a single form field based on QFieldMetaData type
// Used by DynamicForm to render each field in a metadata-driven form
// Includes help tooltip support via field.helpContents

import React, { useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FormPresenceContext } from '@/components/collaboration/FormPresenceContext'

import { Controller } from 'react-hook-form'

import type { UseFormReturn, Control, UseFormRegister, FieldError, FieldErrors } from 'react-hook-form'
import type { QFieldMetaData, QRecord } from '@/types'
import type { PossibleValueContext } from '@/lib/hooks/use-possible-values'

import { selectSlotHelpContent } from '@/lib/utils/help-utils'
import { cn } from '@/lib/utils/cn'
import { fileDownload, findAdornment, hasAdornment } from '@/lib/utils/adornment-utils'
import { formatDateTime } from '@/lib/utils/datetime-utils'
import { caseTransform, numberAdornments } from '@/lib/utils/form-layout'
import { tooLongPolicy } from '@/lib/utils/field-validation'
import { useHelpHelpActive } from '@/lib/context/q-context'

import { HelpIcon } from '@/components/help/HelpIcon'
import { TextField } from './field-types/TextField'
import { TextAreaField } from './field-types/TextAreaField'
import { FieldFooter } from './FieldFooter'
import { NumberField } from './field-types/NumberField'
import { BooleanField } from './field-types/BooleanField'
import { DateField } from './field-types/DateField'
import { DateTimeField } from './field-types/DateTimeField'
import { PasswordField } from './field-types/PasswordField'
import { FileUploadField } from './field-types/FileUploadField'
import { PossibleValueSelect } from './PossibleValueSelect'
import { RichTextField } from './RichTextField'
import { ScriptEditor, scriptEditorLanguage } from './ScriptEditor'
import { WidgetAdornmentField } from './WidgetAdornmentField'

/**
 * Props for the {@link DynamicFormField} component.
 */
interface DynamicFormFieldProps {
  /** Read/clear dependent selections through the owning form. */
  formMethods?: Pick<UseFormReturn<Record<string, unknown>>, 'getValues' | 'setValue'>
  /** Complete sibling metadata for dependency hints. */
  fieldsByName?: Record<string, QFieldMetaData>
  /** Bulk edit's enabled fields; disabled inputs do not supply dependencies. */
  enabledFields?: Record<string, boolean>
  /** Surrounding values available to a field widget without making them editable. */
  contextValues?: Record<string, unknown>
  /** Optional hint supplied by an input block. */
  placeholder?: string
  /** Metadata describing the field to render. */
  field: QFieldMetaData
  /** Help slot key shown in help-authoring mode (`?helpHelp`), e.g. `table:person;field:email`. */
  helpKey?: string
  /** Distinguishes inputs when multiple draft records render the same field. */
  idPrefix?: string
  /** React Hook Form register function from the parent `useForm` instance. */
  register: UseFormRegister<Record<string, unknown>>
  /** React Hook Form control object from the parent `useForm` instance. */
  control: Control<Record<string, unknown>>
  /** React Hook Form validation error map from the parent `useForm` instance. */
  errors: FieldErrors<Record<string, unknown>>
  /** When `true`, the rendered input is disabled. */
  disabled?: boolean
  /**
   * When `true`, the field has been modified from its default value.
   * A left-border accent (`border-l-2 border-primary`) is applied to the
   * field wrapper so users can see which fields have unsaved changes.
   */
  isDirty?: boolean
  /** Context forwarded to {@link PossibleValueSelect} for scoping API calls. */
  possibleValueContext?: PossibleValueContext
  /** The record being edited: read-only display values, current files and selected labels. */
  record?: QRecord
  /** Render a non-editable field as a read-only control instead of omitting it. */
  showReadOnly?: boolean
  /** Screen roles used to choose help content, most specific first. */
  helpRoles?: readonly string[]
  /** Limit typing to `maxLength` (process forms); record forms leave it to the server's too-long policy. */
  enforceMaxLength?: boolean
  /** Called when a text-like input loses focus, with its value (form adjusters run on blur). */
  onFieldBlur?: (fieldName: string, value: unknown) => void
  /** Possible-value labels to show for values the form set (form adjusters), by field name. */
  displayValueOverrides?: Record<string, string>
}

/**
 * Wraps a field rendering with an optional `aria-describedby` linkage to the
 * help tooltip content element.
 *
 * When no help content is present the children are returned unwrapped to
 * avoid adding an unnecessary DOM node.
 *
 * @param props - Component properties.
 * @returns The children, optionally wrapped in an aria-describedby container.
 */
function FieldWithHelp({
  helpId,
  children,
}: {
  field: QFieldMetaData
  children: React.ReactNode
  helpId?: string
}) {
  // helpId is set exactly when help applies (in help-authoring mode, for every field)
  if (!helpId) {
    return <>{children}</>
  }

  return (
    <div
      className="relative"
      aria-describedby={helpId}
    >
      {children}
    </div>
  )
}

/**
 * Wraps a field in a container that shows a left-border accent when the
 * field value has been changed from its default (i.e., it is dirty).
 *
 * The accent provides an at-a-glance indicator of unsaved changes in edit
 * mode without interrupting the field layout.
 *
 * @param props - Component properties.
 * @returns The children optionally wrapped in a dirty-field accent container.
 */
function DirtyWrapper({
  fieldName,
  isDirty,
  children,
}: {
  fieldName: string
  isDirty: boolean
  children: React.ReactNode
}) {
  const names = useContext(FormPresenceContext)[fieldName]
  const root = useRef<HTMLDivElement>(null)
  const [label, setLabel] = useState<HTMLLabelElement | null>(null)
  useEffect(() => { setLabel(root.current?.querySelector('label') ?? null) }, [fieldName])
  const chip = names?.length ? <span className="ml-2 inline-block rounded bg-violet-500/15 px-2 py-1 text-xs font-normal text-foreground" role="status">{names.join(', ')} editing</span> : null
  // Always the same element: switching between a fragment and a wrapper would remount
  // the control on the first keystroke and drop keyboard focus mid-typing.
  return (
    <div ref={root} className={cn(isDirty && 'border-l-2 border-primary pl-2', names?.length && 'rounded-md ring-2 ring-violet-500 p-1')} data-dirty={isDirty || undefined} data-presence-field={fieldName}>
      {label ? createPortal(chip, label) : chip}
      {children}
    </div>
  )
}

/**
 * Renders a single form field driven by `QFieldMetaData`.
 *
 * Dispatch priority:
 * 1. If `field.possibleValueSourceName` is set → {@link PossibleValueSelect}.
 * 2. If a `FILE_UPLOAD` adornment or `BLOB` type is present → {@link FileUploadField}.
 * 3. Otherwise dispatches by `field.type` to the appropriate primitive field component.
 *
 * Hidden fields (`isHidden: true`) and non-editable fields (when the form is
 * not in disabled mode) are suppressed entirely.
 *
 * When `isDirty` is `true`, the field is wrapped in a container with a left
 * accent border to indicate an unsaved change.
 *
 * @param props - See {@link DynamicFormFieldProps}.
 * @returns The rendered field input with label and error display, or null when suppressed.
 */
export function DynamicFormField({
  field,
  placeholder,
  contextValues,
  idPrefix,
  formMethods,
  fieldsByName,
  enabledFields,
  register,
  control,
  errors,
  disabled = false,
  isDirty = false,
  possibleValueContext,
  record,
  showReadOnly = false,
  helpRoles,
  enforceMaxLength = true,
  onFieldBlur,
  displayValueOverrides,
  helpKey,
}: DynamicFormFieldProps) {
  const helpHelpActive = useHelpHelpActive()
  if (field.isHidden) return null
  if (!field.isEditable && !disabled && !showReadOnly) return null

  const fieldId = `${idPrefix ? `${idPrefix}-` : ''}field-${field.name}`
  const fieldError = errors[field.name] as FieldError | undefined
  const isDisabled = disabled || !field.isEditable
  const dataQqqId = field.name
  // Typing stops at the limit only for a field that refuses over-long values (ERROR); otherwise
  // the counter and the server's policy handle it.
  const policy = enforceMaxLength ? 'error' : tooLongPolicy(field)
  const capLength = field.maxLength && policy === 'error' ? field.maxLength : undefined
  const lengthLimit = field.maxLength ? { control, name: field.name, max: field.maxLength, policy } : undefined

  const roles = helpRoles ?? (possibleValueContext?.type === 'process' ? PROCESS_SCREEN_ROLES : ALL_SCREEN_ROLES)
  const helpContent = selectSlotHelpContent(field.helpContents, roles, helpKey ?? `field:${field.name}`, helpHelpActive)
  const hasHelp = Boolean(helpContent)
  const helpDescribedBy = hasHelp ? `${idPrefix ? `${idPrefix}-` : ''}field-help-content-${field.name}` : undefined
  const helpIcon = helpContent && <HelpIcon label={field.label} helpContents={field.helpContents} helpKey={helpKey ?? `field:${field.name}`} roles={roles} descriptionId={helpDescribedBy} data-qqq-id={`field-help-${field.name}`} />
  // Text-like inputs: a form adjuster runs when the input loses focus (Material's blur handler).
  const registration = () => register(field.name, onFieldBlur
    ? { onBlur: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => onFieldBlur(field.name, event.target.value) }
    : undefined)

  if (!field.isEditable && showReadOnly) {
    // A WIDGET-adorned value is a computed display (widget data), not an editable value.
    if (hasAdornment(field, 'WIDGET')) return null
    return (
      <FieldWithHelp field={field} helpId={helpDescribedBy}>
        <ReadOnlyFormField field={field} fieldId={fieldId} record={record} helpDescribedBy={helpDescribedBy} labelExtra={helpIcon} />
      </FieldWithHelp>
    )
  }

  if (hasAdornment(field, 'WIDGET')) {
    return <WidgetAdornmentField contextValues={contextValues} field={field} control={control} disabled={disabled} possibleValueContext={possibleValueContext} />
  }

  // Fields with possible values (a named source, or values declared inline) use PossibleValueSelect
  const inlineOptions = field.inlinePossibleValueSource ? (field.inlinePossibleValueSource.enumValues ?? []) : undefined
  if (field.possibleValueSourceName || inlineOptions) {
    const pvContext: PossibleValueContext = possibleValueContext ?? { type: 'standalone' }
    return (
      <DirtyWrapper isDirty={isDirty} fieldName={field.name}>
        <FieldWithHelp field={field} helpId={helpDescribedBy}>
          <PossibleValueSelect
            formMethods={formMethods}
            fieldsByName={fieldsByName}
            enabledFields={enabledFields}
            id={fieldId}
            label={field.label}
            labelExtra={helpIcon}
            name={field.name}
            control={control as Control<Record<string, unknown>>}
            fieldName={field.name}
            possibleValueSourceName={field.possibleValueSourceName}
            placeholder={placeholder}
            initialLabel={displayValueOverrides?.[field.name] ?? record?.displayValues?.[field.name]}
            inlineOptions={inlineOptions}
            chipField={field}
            picker={field.picker}
            pickerTableName={field.pickerTableName}
            relatedPickerTableName={pvContext.type === 'table' ? pvContext.tableName : undefined}
            context={pvContext}
            error={fieldError}
            disabled={isDisabled}
            required={field.isRequired}
            data-qqq-id={dataQqqId}
          />
        </FieldWithHelp>
      </DirtyWrapper>
    )
  }

  // Check for FILE_UPLOAD adornment (overrides type rendering)
  const hasFileUpload = field.adornments?.some((a) => a.type === 'FILE_UPLOAD')
  if (hasFileUpload || field.type === 'BLOB') {
    return (
      <DirtyWrapper isDirty={isDirty} fieldName={field.name}>
        <FieldWithHelp field={field} helpId={helpDescribedBy}>
          <FileUploadField
            id={fieldId}
            label={field.label}
            labelExtra={helpIcon}
            name={field.name}
            control={control as Control<Record<string, unknown>>}
            error={fieldError}
            disabled={isDisabled}
            required={field.isRequired}
            format={findAdornment(field, 'FILE_UPLOAD')?.values?.format === 'dragAndDrop' ? 'dragAndDrop' : 'button'}
            currentFile={currentFile(field, record)}
            data-qqq-id={dataQqqId}
          />
        </FieldWithHelp>
      </DirtyWrapper>
    )
  }

  const codeEditor = findAdornment(field, 'CODE_EDITOR')
  if (codeEditor && (field.type === 'STRING' || field.type === 'TEXT')) {
    const mode = typeof codeEditor.values?.languageMode === 'string' ? codeEditor.values.languageMode : 'text'
    return (
      <DirtyWrapper isDirty={isDirty} fieldName={field.name}>
        <FieldWithHelp field={field} helpId={helpDescribedBy}>
          <Controller
            name={field.name}
            control={control}
            render={({ field: controllerField }) => (
              <ScriptEditor
                id={fieldId}
                label={field.isRequired ? `${field.label} *` : field.label}
                labelExtra={helpIcon}
                value={typeof controllerField.value === 'string' ? controllerField.value : ''}
                onChange={controllerField.onChange}
                language={scriptEditorLanguage(mode)}
                readOnly={isDisabled}
                error={fieldError}
              />
            )}
          />
        </FieldWithHelp>
      </DirtyWrapper>
    )
  }

  switch (field.type) {
    case 'STRING':
      return (
        <DirtyWrapper isDirty={isDirty} fieldName={field.name}>
          <FieldWithHelp field={field} helpId={helpDescribedBy}>
            <TextField
              placeholder={placeholder}
              id={fieldId}
              label={field.label}
              labelExtra={helpIcon}
              registration={registration()}
              error={fieldError}
              disabled={isDisabled}
              maxLength={capLength}
              lengthLimit={lengthLimit}
              required={field.isRequired}
              describedBy={helpDescribedBy}
              transform={caseTransform(field)}
              data-qqq-id={dataQqqId}
            />
          </FieldWithHelp>
        </DirtyWrapper>
      )

    case 'TEXT': {
      return (
        <DirtyWrapper isDirty={isDirty} fieldName={field.name}>
          <FieldWithHelp field={field} helpId={helpDescribedBy}>
            <TextAreaField
              placeholder={placeholder}
              id={fieldId}
              label={field.label}
              labelExtra={helpIcon}
              registration={registration()}
              error={fieldError}
              disabled={isDisabled}
              maxLength={capLength}
              lengthLimit={lengthLimit}
              required={field.isRequired}
              describedBy={helpDescribedBy}
              transform={caseTransform(field)}
              data-qqq-id={dataQqqId}
            />
          </FieldWithHelp>
        </DirtyWrapper>
      )
    }

    case 'HTML':
      return (
        <DirtyWrapper isDirty={isDirty} fieldName={field.name}>
          <FieldWithHelp field={field} helpId={helpDescribedBy}>
            <div className="flex flex-col gap-1">
              <div className="flex items-center">
                <label
                  htmlFor={fieldId}
                  className="text-sm font-medium text-foreground"
                  data-qqq-id={`field-label-${dataQqqId}`}
                >
                  {field.label}
                  {field.isRequired && (
                    <span className="ml-0.5 text-muted-foreground" aria-hidden="true">*</span>
                  )}
                </label>
                {helpIcon}
              </div>
              <Controller
                name={field.name}
                control={control}
                render={({ field: controllerField }) => (
                  <RichTextField
                    id={fieldId}
                    value={typeof controllerField.value === 'string' ? controllerField.value : ''}
                    onChange={controllerField.onChange}
                    disabled={isDisabled}
                    aria-label={field.label}
                    required={field.isRequired}
                  />
                )}
              />
              <FieldFooter id={fieldId} error={fieldError?.message} />
            </div>
          </FieldWithHelp>
        </DirtyWrapper>
      )

    case 'INTEGER':
    case 'LONG':
      return (
        <DirtyWrapper isDirty={isDirty} fieldName={field.name}>
          <FieldWithHelp field={field} helpId={helpDescribedBy}>
            <NumberField
              placeholder={placeholder}
              id={fieldId}
              label={field.label}
              labelExtra={helpIcon}
              registration={registration()}
              error={fieldError}
              disabled={isDisabled}
              required={field.isRequired}
              step={1}
              minValue={field.minValue}
              maxValue={field.maxValue}
              describedBy={helpDescribedBy}
              {...numberAdornments(field)}
              data-qqq-id={dataQqqId}
            />
          </FieldWithHelp>
        </DirtyWrapper>
      )

    case 'DECIMAL':
      return (
        <DirtyWrapper isDirty={isDirty} fieldName={field.name}>
          <FieldWithHelp field={field} helpId={helpDescribedBy}>
            <NumberField
              placeholder={placeholder}
              id={fieldId}
              label={field.label}
              labelExtra={helpIcon}
              registration={registration()}
              error={fieldError}
              disabled={isDisabled}
              required={field.isRequired}
              step="any"
              minValue={field.minValue}
              maxValue={field.maxValue}
              describedBy={helpDescribedBy}
              {...numberAdornments(field)}
              data-qqq-id={dataQqqId}
            />
          </FieldWithHelp>
        </DirtyWrapper>
      )

    case 'BOOLEAN':
      return (
        <DirtyWrapper isDirty={isDirty} fieldName={field.name}>
          <FieldWithHelp field={field} helpId={helpDescribedBy}>
            <BooleanField
              id={fieldId}
              label={field.label}
              labelExtra={helpIcon}
              name={field.name}
              control={control as Control<Record<string, unknown>>}
              error={fieldError}
              disabled={isDisabled}
              required={field.isRequired}
              data-qqq-id={dataQqqId}
            />
          </FieldWithHelp>
        </DirtyWrapper>
      )

    case 'DATE':
      return (
        <DirtyWrapper isDirty={isDirty} fieldName={field.name}>
          <FieldWithHelp field={field} helpId={helpDescribedBy}>
            <DateField
              id={fieldId}
              label={field.label}
              labelExtra={helpIcon}
              registration={registration()}
              error={fieldError}
              disabled={isDisabled}
              required={field.isRequired}
              describedBy={helpDescribedBy}
              data-qqq-id={dataQqqId}
            />
          </FieldWithHelp>
        </DirtyWrapper>
      )

    case 'DATE_TIME':
      return (
        <DirtyWrapper isDirty={isDirty} fieldName={field.name}>
          <FieldWithHelp field={field} helpId={helpDescribedBy}>
            <DateTimeField
              id={fieldId}
              label={field.label}
              labelExtra={helpIcon}
              registration={registration()}
              error={fieldError}
              disabled={isDisabled}
              required={field.isRequired}
              describedBy={helpDescribedBy}
              data-qqq-id={dataQqqId}
            />
          </FieldWithHelp>
        </DirtyWrapper>
      )

    case 'TIME':
      return (
        <DirtyWrapper isDirty={isDirty} fieldName={field.name}>
          <FieldWithHelp field={field} helpId={helpDescribedBy}>
            <div className="flex flex-col gap-1">
              <div className="flex items-center">
                <label
                  htmlFor={fieldId}
                  className="text-sm font-medium text-foreground"
                  data-qqq-id={`field-label-${dataQqqId}`}
                >
                  {field.label}
                  {field.isRequired && (
                    <span className="ml-0.5 text-muted-foreground" aria-hidden="true">*</span>
                  )}
                </label>
                {helpIcon}
              </div>
              <input
                id={fieldId}
                type="time"
                step={1}
                {...registration()}
                disabled={isDisabled}
                aria-required={field.isRequired}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={
                  [fieldError ? `${fieldId}-error` : undefined, helpDescribedBy]
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                data-qqq-id={dataQqqId}
                className={`w-full rounded-md border px-3 py-2 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring disabled:cursor-not-allowed disabled:bg-muted transition-colors duration-150 ${
                  fieldError ? 'border-destructive focus:ring-destructive' : 'border-input'
                }`}
              />
              <FieldFooter id={fieldId} error={fieldError?.message} />
            </div>
          </FieldWithHelp>
        </DirtyWrapper>
      )

    case 'PASSWORD':
      return (
        <DirtyWrapper isDirty={isDirty} fieldName={field.name}>
          <FieldWithHelp field={field} helpId={helpDescribedBy}>
            <PasswordField
              id={fieldId}
              label={field.label}
              labelExtra={helpIcon}
              registration={registration()}
              error={fieldError}
              disabled={isDisabled}
              maxLength={capLength}
              required={field.isRequired}
              placeholder={record && showReadOnly && !hasAdornment(field, 'REVEAL') ? 'Unchanged — type to replace' : placeholder}
              describedBy={helpDescribedBy}
              transform={caseTransform(field)}
              data-qqq-id={dataQqqId}
            />
          </FieldWithHelp>
        </DirtyWrapper>
      )

    default:
      return (
        <DirtyWrapper isDirty={isDirty} fieldName={field.name}>
          <FieldWithHelp field={field} helpId={helpDescribedBy}>
            <TextField
              placeholder={placeholder}
              id={fieldId}
              label={field.label}
              labelExtra={helpIcon}
              registration={registration()}
              error={fieldError}
              disabled={isDisabled}
              maxLength={capLength}
              lengthLimit={lengthLimit}
              required={field.isRequired}
              describedBy={helpDescribedBy}
              transform={caseTransform(field)}
              data-qqq-id={dataQqqId}
            />
          </FieldWithHelp>
        </DirtyWrapper>
      )
  }
}

/** Help roles when a form does not name its screen (Material's DynamicForm default). */
const ALL_SCREEN_ROLES = ['ALL_SCREENS'] as const
/** Help roles of process screens. */
const PROCESS_SCREEN_ROLES = ['PROCESS_SCREEN', 'ALL_SCREENS'] as const


/**
 * The file a BLOB field currently holds, for the upload control of an edit form.
 *
 * @param field - Field metadata.
 * @param record - The record being edited, if any.
 * @returns Name and (for FILE_DOWNLOAD fields) URL, or `undefined` when there is no file.
 */
function currentFile(field: QFieldMetaData, record: QRecord | undefined): { name: string; url?: string } | undefined {
  if (!record) return undefined
  const download = fileDownload(field, record)
  if (download) return { name: download.fileName, url: download.url }
  const value = record.values[field.name]
  return typeof value === 'string' && value ? { name: `Current ${field.label}` } : undefined
}

/**
 * A non-editable field on the edit screen: its label and current value, shown
 * read-only (never submitted).
 *
 * @param props - Component properties.
 * @param props.field - Field metadata.
 * @param props.fieldId - Control id.
 * @param props.record - The record being edited.
 * @param props.helpDescribedBy - Help element id, if any.
 * @returns The read-only control.
 */
function ReadOnlyFormField({ field, fieldId, record, helpDescribedBy, labelExtra }: {
  field: QFieldMetaData; fieldId: string; record?: QRecord; helpDescribedBy?: string; labelExtra?: React.ReactNode
}) {
  const raw = record?.values[field.name]
  const display = record?.displayValues?.[field.name]
  const text = field.type === 'DATE_TIME'
    ? (display && display !== raw ? display : (formatDateTime(raw) ?? (raw == null ? '' : String(raw))))
    : field.type === 'BOOLEAN' && raw != null ? (raw === true || raw === 'true' ? 'Yes' : 'No')
      : (display ?? (raw == null ? '' : String(raw)))
  return (
    <dl className="flex flex-col gap-1" aria-describedby={helpDescribedBy}>
      <dt id={`${fieldId}-label`} className="flex items-center text-sm font-medium text-muted-foreground" data-qqq-id={`field-label-${field.name}`}>
        <span>{field.label}</span>
        {labelExtra}
      </dt>
      <dd id={fieldId} className="min-h-5 whitespace-pre-wrap break-words text-sm text-foreground" data-qqq-id={field.name}>
        {text || <span className="text-muted-foreground" aria-label="No value">{'\u2014'}</span>}
      </dd>
    </dl>
  )
}
