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
 * @file RowBuilderRowForm — one editable row of a `rowBuilder` widget (Material
 * `RowBuilderWidget` `FormRowWrapper` around a `QDynamicForm`): the row's fields with the
 * app's form field editors, a remove button and, when rows may be reordered, a drag
 * handle with keyboard move up and move down buttons.
 */
'use client'

import React, { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import type { Control, FieldError, FieldErrors, Resolver } from 'react-hook-form'
import { ChevronDown, ChevronUp, GripVertical, X } from 'lucide-react'

import type { QFieldMetaData, QRecord } from '@/types'
import type { PossibleValueContext } from '@/lib/hooks/use-possible-values'
import { cn } from '@/lib/utils/cn'

import { DynamicFormField } from '@/components/forms/DynamicFormField'
import { editableFields, rowErrors, rowFormValues } from './row-builder-model'
import type { BuilderRow } from './row-builder-model'

/** Where a row is edited: inline in the widget, or in its modal editor. */
export type RowScope = 'edit' | 'modal'

/** What the editor asks of a mounted row. */
export interface RowFormHandle {
  /**
   * Validates the row's current values and shows each field's message on the field.
   * @param focusFirstError - Move focus to the first invalid field.
   * @returns The first message of each invalid field, keyed by field name.
   */
  validate: (focusFirstError: boolean) => Record<string, string>
  /** Moves focus to the row's first editable control. */
  focusFirstField: () => void
}

/** Native drag and drop state shared by the rows of one list. */
export interface RowDragHandlers {
  /** Key of the row being dragged. */
  draggingKey: number | null
  /** Position the dragged row is over. */
  overIndex: number | null
  onDragStart: (rowKey: number, event: React.DragEvent<HTMLElement>) => void
  onDragOver: (index: number, event: React.DragEvent<HTMLElement>) => void
  onDrop: (index: number, event: React.DragEvent<HTMLElement>) => void
  onDragEnd: () => void
}

/** Props for {@link RowBuilderRowForm}. */
export interface RowBuilderRowFormProps {
  /** Widget name, for `data-qqq-id`s and ids. */
  widgetName: string
  /** Inline or modal. */
  scope: RowScope
  /** The row. */
  row: BuilderRow
  /** Its position. */
  index: number
  /** Number of rows in the list. */
  rowCount: number
  /** Row fields. */
  fields: QFieldMetaData[]
  /** Show the drag handle and move buttons. */
  mayReorder: boolean
  /** Show the row but do not let it be edited. */
  disabled: boolean
  /** Apply `maxLength` while typing and validating (process screens). */
  enforceMaxLength: boolean
  /** Possible-value lookups of the row's fields. */
  possibleValueContext: PossibleValueContext
  /** Called with a field's new control value. */
  onFieldChange: (rowKey: number, fieldName: string, value: unknown) => void
  /** Removes the row. */
  onRemove: (rowKey: number) => void
  /** Moves the row by `delta` positions; `control` names the button that moved it. */
  onMove: (rowKey: number, delta: number, control: 'up' | 'down' | 'drag') => void
  /** Registers (or, with null, removes) the row's handle. */
  registerRow: (rowKey: number, handle: RowFormHandle | null) => void
  /** Drag and drop handlers of the list. */
  drag: RowDragHandlers
}

/** Controls a new row's first field may be. */
const FOCUSABLE = 'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [role="combobox"][tabindex="0"], button[role="checkbox"]:not([disabled])'

/**
 * Whether a field chooses from possible values declared inline on it.
 *
 * @param field - Field metadata.
 * @returns True for an inline enum without a named source.
 */
function hasInlineEnum(field: QFieldMetaData): boolean {
  return !field.possibleValueSourceName && Boolean(field.inlinePossibleValueSource?.enumValues?.length)
}

/**
 * A select for a field whose possible values are declared inline on it (Material
 * `DynamicSelect` with `possibleValues`).
 *
 * @param props - Component properties.
 * @returns The labelled select.
 */
function InlineEnumField({ field, id, control, error, disabled }: {
  field: QFieldMetaData; id: string; control: Control<Record<string, unknown>>; error?: FieldError; disabled: boolean
}) {
  const options = field.inlinePossibleValueSource?.enumValues ?? []
  const isDisabled = disabled || !field.isEditable
  return (
    <Controller
      name={field.name}
      control={control}
      render={({ field: controller }) => (
        <div className="flex flex-col gap-1">
          <label htmlFor={id} className="text-sm font-medium text-foreground" data-qqq-id={`field-label-${field.name}`}>
            {field.label}
            {field.isRequired && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
          </label>
          <select
            id={id}
            value={controller.value === null || controller.value === undefined ? '' : String(controller.value)}
            onChange={(event) => {
              const option = options.find((candidate) => String(candidate.id) === event.target.value)
              controller.onChange(option ? option.id : null)
            }}
            onBlur={controller.onBlur}
            disabled={isDisabled}
            aria-required={field.isRequired}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            data-qqq-id={field.name}
            className={cn(
              'w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring',
              'disabled:cursor-not-allowed disabled:bg-muted',
              error ? 'border-destructive' : 'border-input'
            )}
          >
            <option value="">{`-- Select ${field.label} --`}</option>
            {options.map((option) => <option key={String(option.id)} value={String(option.id)}>{option.label}</option>)}
          </select>
          {error && <p id={`${id}-error`} className="mt-1 text-sm text-destructive" role="alert">{error.message}</p>}
        </div>
      )}
    />
  )
}

/** Classes of the row's small icon buttons (a 44 px target on touch screens). */
const ICON_BUTTON = cn(
  'inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground',
  'hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring',
  'pointer-coarse:h-11 pointer-coarse:w-11 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50'
)

/**
 * One editable row. Its values live in a row-local form (so the app's field editors,
 * which need a react-hook-form `register`/`control`, work unchanged); each change is
 * reported to the editor, which owns the rows.
 *
 * @param props - See {@link RowBuilderRowFormProps}.
 * @returns The row.
 */
function RowBuilderRowFormComponent({
  widgetName, scope, row, index, rowCount, fields, mayReorder, disabled, enforceMaxLength, possibleValueContext,
  onFieldChange, onRemove, onMove, registerRow, drag,
}: RowBuilderRowFormProps) {
  const rowNumber = index + 1
  const idPrefix = `row-builder-${widgetName}-${scope}-${row.key}`
  const rowRef = useRef<HTMLDivElement>(null)
  const fieldsRef = useRef<HTMLDivElement>(null)
  // the row's values when it mounted: the form keeps its own state from here
  const [defaultValues] = useState(() => rowFormValues(fields, row))
  // display values and read-only values of the row, for labels of chosen possible values
  const record: QRecord = { tableName: '', values: row.values, displayValues: row.displayValues }

  const resolver = useCallback<Resolver<Record<string, unknown>>>((values) => {
    const errors = rowErrors(fields, values, enforceMaxLength)
    if (Object.keys(errors).length === 0) return { values, errors: {} }
    return { values: {}, errors: Object.fromEntries(Object.entries(errors).map(([name, message]) => [name, { type: 'validate', message }])) }
  }, [fields, enforceMaxLength])

  const form = useForm<Record<string, unknown>>({ defaultValues, resolver, mode: 'onTouched' })
  const { control, register, getValues, setError, clearErrors, setFocus, watch } = form
  const errors: FieldErrors<Record<string, unknown>> = form.formState.errors

  // report every edit to the editor (the latest callback, without resubscribing)
  const onFieldChangeRef = useRef(onFieldChange)
  onFieldChangeRef.current = onFieldChange
  useEffect(() => {
    const subscription = watch((values, { name }) => {
      if (name) onFieldChangeRef.current(row.key, name, values[name])
    })
    return () => subscription.unsubscribe()
  }, [watch, row.key])

  useEffect(() => {
    registerRow(row.key, {
      validate: (focusFirstError) => {
        const found = rowErrors(fields, getValues(), enforceMaxLength)
        let focused = !focusFirstError
        for (const field of editableFields(fields)) {
          const message = found[field.name]
          if (!message) {
            clearErrors(field.name)
            continue
          }
          setError(field.name, { type: 'validate', message })
          if (!focused) {
            focused = true
            const control = fieldsRef.current?.querySelector<HTMLElement>(`[data-qqq-id="${CSS.escape(field.name)}"]`)
            if (control) control.focus()
            else setFocus(field.name)
          }
        }
        return found
      },
      focusFirstField: () => fieldsRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus(),
    })
    return () => registerRow(row.key, null)
  }, [registerRow, row.key, fields, enforceMaxLength, getValues, setError, clearErrors, setFocus])

  const isDragging = drag.draggingKey === row.key
  const isDropTarget = drag.draggingKey !== null && !isDragging && drag.overIndex === index

  return (
    <div
      ref={rowRef}
      role="group"
      aria-label={`Row ${rowNumber}`}
      data-qqq-id={`row-builder-${scope}-row-${widgetName}-${index}`}
      onDragOver={mayReorder ? (event) => drag.onDragOver(index, event) : undefined}
      onDrop={mayReorder ? (event) => drag.onDrop(index, event) : undefined}
      className={cn(
        'flex items-start gap-3 border-b border-border pb-3 pr-2',
        isDragging && 'opacity-50',
        isDropTarget && 'border-t-2 border-t-primary'
      )}
    >
      {mayReorder && (
        <div className="flex shrink-0 flex-col items-center gap-1 pt-6">
          <button
            type="button"
            draggable={!disabled}
            disabled={disabled}
            onDragStart={(event) => {
              if (rowRef.current) event.dataTransfer.setDragImage(rowRef.current, 16, 16)
              drag.onDragStart(row.key, event)
            }}
            onDragEnd={drag.onDragEnd}
            onKeyDown={(event) => {
              if (event.key === 'ArrowUp') { event.preventDefault(); onMove(row.key, -1, 'drag') }
              if (event.key === 'ArrowDown') { event.preventDefault(); onMove(row.key, 1, 'drag') }
            }}
            aria-label={`Drag to reorder row ${rowNumber}`}
            title="Drag to reorder (or use arrow keys)"
            data-qqq-id={`row-builder-drag-${widgetName}-${index}`}
            className={cn(ICON_BUTTON, 'cursor-ns-resize border-transparent')}
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => { if (index > 0) onMove(row.key, -1, 'up') }}
            disabled={disabled}
            aria-disabled={index === 0 || undefined}
            aria-label={`Move row ${rowNumber} up`}
            data-qqq-id={`row-builder-move-up-${widgetName}-${index}`}
            className={ICON_BUTTON}
          >
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => { if (index < rowCount - 1) onMove(row.key, 1, 'down') }}
            disabled={disabled}
            aria-disabled={index === rowCount - 1 || undefined}
            aria-label={`Move row ${rowNumber} down`}
            data-qqq-id={`row-builder-move-down-${widgetName}-${index}`}
            className={ICON_BUTTON}
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
      <div ref={fieldsRef} data-row-fields="" className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
        {fields.map((field) => hasInlineEnum(field) && !field.isHidden
          ? <InlineEnumField key={field.name} field={field} id={`${idPrefix}-field-${field.name}`} control={control} error={errors[field.name] as FieldError | undefined} disabled={disabled} />
          : (
            <DynamicFormField
              key={field.name}
              field={field}
              idPrefix={idPrefix}
              register={register}
              control={control}
              errors={errors}
              disabled={disabled}
              possibleValueContext={possibleValueContext}
              record={record}
              showReadOnly
              enforceMaxLength={enforceMaxLength}
            />
          ))}
      </div>
      <div className="shrink-0 pt-6">
        <button
          type="button"
          onClick={() => onRemove(row.key)}
          disabled={disabled}
          aria-label={`Remove row ${rowNumber}`}
          title="Remove Row"
          data-qqq-id={`row-builder-remove-${widgetName}-${index}`}
          className={cn(ICON_BUTTON, 'text-destructive hover:text-destructive')}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

/** A memoized {@link RowBuilderRowFormComponent}: typing in one row leaves the others alone. */
export const RowBuilderRowForm = memo(RowBuilderRowFormComponent)
