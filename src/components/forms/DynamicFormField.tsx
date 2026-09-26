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

import React from 'react'
import { Controller } from 'react-hook-form'
import type { Control, UseFormRegister, FieldError, FieldErrors } from 'react-hook-form'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { HelpCircle } from 'lucide-react'

import type { QFieldMetaData, QHelpContent, QRecord } from '@/types'
import { useFocusSafeTooltip } from '@/lib/hooks/use-focus-safe-tooltip'
import type { PossibleValueContext } from '@/lib/hooks/use-possible-values'
import { cn } from '@/lib/utils/cn'
import { fileDownload, findAdornment, hasAdornment } from '@/lib/utils/adornment-utils'
import { formatDateTime } from '@/lib/utils/datetime-utils'
import { selectHelpContent } from '@/lib/utils/help-utils'
import { HelpContent } from '@/components/records/HelpContent'

import { TextField } from './field-types/TextField'
import { NumberField } from './field-types/NumberField'
import { BooleanField } from './field-types/BooleanField'
import { DateField } from './field-types/DateField'
import { DateTimeField } from './field-types/DateTimeField'
import { PasswordField } from './field-types/PasswordField'
import { FileUploadField } from './field-types/FileUploadField'
import { PossibleValueSelect } from './PossibleValueSelect'
import { RichTextField } from './RichTextField'
import { ScriptEditor, type ScriptEditorProps } from './ScriptEditor'

/**
 * Props for the {@link DynamicFormField} component.
 */
interface DynamicFormFieldProps {
  /** Metadata describing the field to render. */
  field: QFieldMetaData
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
}

/**
 * Renders help for a field: a hover tooltip on desktop (`sm` and wider) and
 * inline text on mobile (below the field, hidden on `sm` and wider).
 *
 * On mobile the `?` icon button is hidden (`hidden sm:inline-flex`) so that
 * hover-only affordances are not the sole way to access help content.
 * Instead a short inline paragraph is shown (`sm:hidden`) which satisfies
 * the ≥ 44 px touch-target requirement for mobile by requiring no interaction.
 *
 * @param props - Component properties.
 * @returns The rendered help tooltip (desktop) and inline text (mobile), or null when no help content is defined.
 */
function FieldHelpTooltip({ field, helpContent, helpId: suppliedHelpId }: { field: QFieldMetaData; helpContent?: QHelpContent; helpId?: string }) {
  const tooltipState = useFocusSafeTooltip()
  if (!helpContent?.content) return null

  const helpId = suppliedHelpId ?? `field-help-content-${field.name}`

  return (
    <>
      {/* Desktop: hover tooltip — hidden on mobile */}
      <span className="hidden sm:inline-flex">
        <TooltipPrimitive.Provider delayDuration={300}>
          <TooltipPrimitive.Root open={tooltipState.open} onOpenChange={tooltipState.onOpenChange}>
            <TooltipPrimitive.Trigger asChild onFocus={tooltipState.onFocus} onBlur={tooltipState.onBlur} onKeyDown={tooltipState.onKeyDown}
              onPointerDown={tooltipState.onPointerDown} onClick={tooltipState.onClick}>
              <button
                type="button"
                tabIndex={0}
                data-qqq-id={`field-help-${field.name}`}
                aria-label={`Help for ${field.label}`}
                className={cn(
                  'ml-1 inline-flex items-center rounded-full p-0.5',
                  'text-muted-foreground hover:text-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-ring'
                )}
              >
                <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Portal>
              <TooltipPrimitive.Content
                data-qqq-id={`field-help-tooltip-${field.name}`}
                side="top"
                sideOffset={4}
                className={cn(
                  'z-50 max-w-xs rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-md',
                  'text-popover-foreground',
                  'animate-in fade-in-0 zoom-in-95'
                )}
              >
                {helpContent.title && (
                  <p className="mb-1 font-semibold">{helpContent.title}</p>
                )}
                <p><HelpContent helpContent={helpContent} /></p>
                {helpContent.links && helpContent.links.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {helpContent.links.map((link, idx) => (
                      <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-primary hover:underline"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}
                <TooltipPrimitive.Arrow className="fill-border" />
              </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
          </TooltipPrimitive.Root>
        </TooltipPrimitive.Provider>
      </span>
      {/* Mobile: inline text below the field — hidden on desktop */}
      <p id={helpId} className="mt-0.5 text-xs text-muted-foreground sm:hidden" data-qqq-id={`field-help-text-${field.name}`}>
        <HelpContent helpContent={helpContent} />
      </p>
    </>
  )
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
  field,
  helpId,
  children,
}: {
  field: QFieldMetaData
  children: React.ReactNode
  helpId?: string
}) {
  const hasHelp = field.helpContents && field.helpContents.length > 0 && field.helpContents[0]?.content

  if (!hasHelp) {
    return <>{children}</>
  }

  return (
    <div
      className="relative"
      aria-describedby={helpId ?? `field-help-content-${field.name}`}
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
  isDirty,
  children,
}: {
  isDirty: boolean
  children: React.ReactNode
}) {
  // Always the same element: switching between a fragment and a wrapper would remount
  // the control on the first keystroke and drop keyboard focus mid-typing.
  return (
    <div className={cn(isDirty && 'border-l-2 border-primary pl-2')} data-dirty={isDirty || undefined}>
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
  idPrefix,
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
}: DynamicFormFieldProps) {
  if (field.isHidden) return null
  if (!field.isEditable && !disabled && !showReadOnly) return null

  const fieldId = `${idPrefix ? `${idPrefix}-` : ''}field-${field.name}`
  const fieldError = errors[field.name] as FieldError | undefined
  const isDisabled = disabled || !field.isEditable
  const dataQqqId = field.name

  const roles = helpRoles ?? (possibleValueContext?.type === 'process' ? PROCESS_SCREEN_ROLES : ALL_SCREEN_ROLES)
  const helpContent = selectHelpContent(field.helpContents, roles)
  const hasHelp = Boolean(helpContent)
  const helpDescribedBy = hasHelp ? `${idPrefix ? `${idPrefix}-` : ''}field-help-content-${field.name}` : undefined

  if (!field.isEditable && showReadOnly) {
    // A WIDGET-adorned value is a computed display (widget data), not an editable value.
    if (hasAdornment(field, 'WIDGET')) return null
    return (
      <FieldWithHelp field={field} helpId={helpDescribedBy}>
        <ReadOnlyFormField field={field} fieldId={fieldId} record={record} helpDescribedBy={helpDescribedBy} />
        {helpContent && <FieldHelpTooltip field={field} helpContent={helpContent} helpId={helpDescribedBy} />}
      </FieldWithHelp>
    )
  }

  // Fields with possibleValues use PossibleValueSelect (async combobox)
  if (field.possibleValueSourceName) {
    const pvContext: PossibleValueContext = possibleValueContext ?? { type: 'standalone' }
    return (
      <DirtyWrapper isDirty={isDirty}>
        <FieldWithHelp field={field} helpId={helpDescribedBy}>
          <PossibleValueSelect
            id={fieldId}
            label={field.label}
            name={field.name}
            control={control as Control<Record<string, unknown>>}
            fieldName={field.name}
            possibleValueSourceName={field.possibleValueSourceName}
            initialLabel={record?.displayValues?.[field.name]}
            context={pvContext}
            error={fieldError}
            disabled={isDisabled}
            required={field.isRequired}
            data-qqq-id={dataQqqId}
          />
          {helpContent && <FieldHelpTooltip field={field} helpContent={helpContent} helpId={helpDescribedBy} />}
        </FieldWithHelp>
      </DirtyWrapper>
    )
  }

  // Check for FILE_UPLOAD adornment (overrides type rendering)
  const hasFileUpload = field.adornments?.some((a) => a.type === 'FILE_UPLOAD')
  if (hasFileUpload || field.type === 'BLOB') {
    return (
      <DirtyWrapper isDirty={isDirty}>
        <FieldWithHelp field={field} helpId={helpDescribedBy}>
          <FileUploadField
            id={fieldId}
            label={field.label}
            name={field.name}
            control={control as Control<Record<string, unknown>>}
            error={fieldError}
            disabled={isDisabled}
            required={field.isRequired}
            format={findAdornment(field, 'FILE_UPLOAD')?.values?.format === 'dragAndDrop' ? 'dragAndDrop' : 'button'}
            currentFile={currentFile(field, record)}
            data-qqq-id={dataQqqId}
          />
          {helpContent && <FieldHelpTooltip field={field} helpContent={helpContent} helpId={helpDescribedBy} />}
        </FieldWithHelp>
      </DirtyWrapper>
    )
  }

  const codeEditor = findAdornment(field, 'CODE_EDITOR')
  if (codeEditor && (field.type === 'STRING' || field.type === 'TEXT')) {
    const mode = typeof codeEditor.values?.languageMode === 'string' ? codeEditor.values.languageMode : 'text'
    return (
      <DirtyWrapper isDirty={isDirty}>
        <FieldWithHelp field={field} helpId={helpDescribedBy}>
          <Controller
            name={field.name}
            control={control}
            render={({ field: controllerField }) => (
              <ScriptEditor
                id={fieldId}
                label={field.isRequired ? `${field.label} *` : field.label}
                value={typeof controllerField.value === 'string' ? controllerField.value : ''}
                onChange={controllerField.onChange}
                language={scriptLanguage(mode)}
                readOnly={isDisabled}
                error={fieldError}
              />
            )}
          />
          {helpContent && <FieldHelpTooltip field={field} helpContent={helpContent} helpId={helpDescribedBy} />}
        </FieldWithHelp>
      </DirtyWrapper>
    )
  }

  switch (field.type) {
    case 'STRING':
      return (
        <DirtyWrapper isDirty={isDirty}>
          <FieldWithHelp field={field} helpId={helpDescribedBy}>
            <TextField
              id={fieldId}
              label={field.label}
              registration={register(field.name)}
              error={fieldError}
              disabled={isDisabled}
              maxLength={enforceMaxLength ? field.maxLength : undefined}
              required={field.isRequired}
              describedBy={helpDescribedBy}
              data-qqq-id={dataQqqId}
            />
            {helpContent && <FieldHelpTooltip field={field} helpContent={helpContent} helpId={helpDescribedBy} />}
          </FieldWithHelp>
        </DirtyWrapper>
      )

    case 'TEXT':
      return (
        <DirtyWrapper isDirty={isDirty}>
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
                    <span className="ml-1 text-destructive" aria-hidden="true">*</span>
                  )}
                </label>
                {helpContent && <FieldHelpTooltip field={field} helpContent={helpContent} helpId={helpDescribedBy} />}
              </div>
              <textarea
                id={fieldId}
                {...register(field.name)}
                disabled={isDisabled}
                aria-required={field.isRequired}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={
                  [fieldError ? `${fieldId}-error` : undefined, helpDescribedBy]
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                data-qqq-id={dataQqqId}
                rows={4}
                className={`w-full rounded-md border px-3 py-2 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring disabled:cursor-not-allowed disabled:bg-muted transition-colors duration-150 resize-y ${
                  fieldError ? 'border-destructive focus:ring-destructive' : 'border-input'
                }`}
              />
              {fieldError && (
                <p id={`${fieldId}-error`} className="mt-1 text-sm text-destructive" role="alert">
                  {fieldError.message}
                </p>
              )}
            </div>
          </FieldWithHelp>
        </DirtyWrapper>
      )

    case 'HTML':
      return (
        <DirtyWrapper isDirty={isDirty}>
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
                    <span className="ml-1 text-destructive" aria-hidden="true">*</span>
                  )}
                </label>
                {helpContent && <FieldHelpTooltip field={field} helpContent={helpContent} helpId={helpDescribedBy} />}
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
              {fieldError && (
                <p id={`${fieldId}-error`} className="mt-1 text-sm text-destructive" role="alert">
                  {fieldError.message}
                </p>
              )}
            </div>
          </FieldWithHelp>
        </DirtyWrapper>
      )

    case 'INTEGER':
    case 'LONG':
      return (
        <DirtyWrapper isDirty={isDirty}>
          <FieldWithHelp field={field} helpId={helpDescribedBy}>
            <NumberField
              id={fieldId}
              label={field.label}
              registration={register(field.name)}
              error={fieldError}
              disabled={isDisabled}
              required={field.isRequired}
              step={1}
              minValue={field.minValue}
              maxValue={field.maxValue}
              describedBy={helpDescribedBy}
              data-qqq-id={dataQqqId}
            />
            {helpContent && <FieldHelpTooltip field={field} helpContent={helpContent} helpId={helpDescribedBy} />}
          </FieldWithHelp>
        </DirtyWrapper>
      )

    case 'DECIMAL':
      return (
        <DirtyWrapper isDirty={isDirty}>
          <FieldWithHelp field={field} helpId={helpDescribedBy}>
            <NumberField
              id={fieldId}
              label={field.label}
              registration={register(field.name)}
              error={fieldError}
              disabled={isDisabled}
              required={field.isRequired}
              step="any"
              minValue={field.minValue}
              maxValue={field.maxValue}
              describedBy={helpDescribedBy}
              data-qqq-id={dataQqqId}
            />
            {helpContent && <FieldHelpTooltip field={field} helpContent={helpContent} helpId={helpDescribedBy} />}
          </FieldWithHelp>
        </DirtyWrapper>
      )

    case 'BOOLEAN':
      return (
        <DirtyWrapper isDirty={isDirty}>
          <FieldWithHelp field={field} helpId={helpDescribedBy}>
            <BooleanField
              id={fieldId}
              label={field.label}
              name={field.name}
              control={control as Control<Record<string, unknown>>}
              error={fieldError}
              disabled={isDisabled}
              required={field.isRequired}
              data-qqq-id={dataQqqId}
            />
            {helpContent && <FieldHelpTooltip field={field} helpContent={helpContent} helpId={helpDescribedBy} />}
          </FieldWithHelp>
        </DirtyWrapper>
      )

    case 'DATE':
      return (
        <DirtyWrapper isDirty={isDirty}>
          <FieldWithHelp field={field} helpId={helpDescribedBy}>
            <DateField
              id={fieldId}
              label={field.label}
              registration={register(field.name)}
              error={fieldError}
              disabled={isDisabled}
              required={field.isRequired}
              describedBy={helpDescribedBy}
              data-qqq-id={dataQqqId}
            />
            {helpContent && <FieldHelpTooltip field={field} helpContent={helpContent} helpId={helpDescribedBy} />}
          </FieldWithHelp>
        </DirtyWrapper>
      )

    case 'DATE_TIME':
      return (
        <DirtyWrapper isDirty={isDirty}>
          <FieldWithHelp field={field} helpId={helpDescribedBy}>
            <DateTimeField
              id={fieldId}
              label={field.label}
              registration={register(field.name)}
              error={fieldError}
              disabled={isDisabled}
              required={field.isRequired}
              describedBy={helpDescribedBy}
              data-qqq-id={dataQqqId}
            />
            {helpContent && <FieldHelpTooltip field={field} helpContent={helpContent} helpId={helpDescribedBy} />}
          </FieldWithHelp>
        </DirtyWrapper>
      )

    case 'TIME':
      return (
        <DirtyWrapper isDirty={isDirty}>
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
                    <span className="ml-1 text-destructive" aria-hidden="true">*</span>
                  )}
                </label>
                {helpContent && <FieldHelpTooltip field={field} helpContent={helpContent} helpId={helpDescribedBy} />}
              </div>
              <input
                id={fieldId}
                type="time"
                step={1}
                {...register(field.name)}
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
              {fieldError && (
                <p id={`${fieldId}-error`} className="mt-1 text-sm text-destructive" role="alert">
                  {fieldError.message}
                </p>
              )}
            </div>
          </FieldWithHelp>
        </DirtyWrapper>
      )

    case 'PASSWORD':
      return (
        <DirtyWrapper isDirty={isDirty}>
          <FieldWithHelp field={field} helpId={helpDescribedBy}>
            <PasswordField
              id={fieldId}
              label={field.label}
              registration={register(field.name)}
              error={fieldError}
              disabled={isDisabled}
              maxLength={enforceMaxLength ? field.maxLength : undefined}
              required={field.isRequired}
              placeholder={record && showReadOnly && !hasAdornment(field, 'REVEAL') ? 'Unchanged — type to replace' : undefined}
              describedBy={helpDescribedBy}
              data-qqq-id={dataQqqId}
            />
            {helpContent && <FieldHelpTooltip field={field} helpContent={helpContent} helpId={helpDescribedBy} />}
          </FieldWithHelp>
        </DirtyWrapper>
      )

    default:
      return (
        <DirtyWrapper isDirty={isDirty}>
          <FieldWithHelp field={field} helpId={helpDescribedBy}>
            <TextField
              id={fieldId}
              label={field.label}
              registration={register(field.name)}
              error={fieldError}
              disabled={isDisabled}
              maxLength={enforceMaxLength ? field.maxLength : undefined}
              required={field.isRequired}
              describedBy={helpDescribedBy}
              data-qqq-id={dataQqqId}
            />
            {helpContent && <FieldHelpTooltip field={field} helpContent={helpContent} helpId={helpDescribedBy} />}
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
 * Maps a CODE_EDITOR `languageMode` to a {@link ScriptEditor} language.
 *
 * @param mode - The adornment's language mode.
 * @returns The editor language (`text` when not one of its languages).
 */
function scriptLanguage(mode: string): NonNullable<ScriptEditorProps['language']> {
  const languages: NonNullable<ScriptEditorProps['language']>[] = ['javascript', 'groovy', 'python', 'sql', 'json', 'text']
  const normalized = mode.toLowerCase() as NonNullable<ScriptEditorProps['language']>
  return languages.includes(normalized) ? normalized : 'text'
}

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
function ReadOnlyFormField({ field, fieldId, record, helpDescribedBy }: {
  field: QFieldMetaData; fieldId: string; record?: QRecord; helpDescribedBy?: string
}) {
  const raw = record?.values[field.name]
  const display = record?.displayValues?.[field.name]
  const text = field.type === 'DATE_TIME'
    ? (display && display !== raw ? display : (formatDateTime(raw) ?? (raw == null ? '' : String(raw))))
    : field.type === 'BOOLEAN' && raw != null ? (raw === true || raw === 'true' ? 'Yes' : 'No')
      : (display ?? (raw == null ? '' : String(raw)))
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-sm font-medium text-muted-foreground" data-qqq-id={`field-label-${field.name}`}>
        {field.label}
      </label>
      <input
        id={fieldId}
        type="text"
        value={text}
        readOnly
        disabled
        aria-readonly="true"
        aria-describedby={helpDescribedBy}
        data-qqq-id={field.name}
        className="w-full cursor-not-allowed rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
      />
    </div>
  )
}
