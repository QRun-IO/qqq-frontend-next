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

/** @file Metadata-driven editors for composite input blocks. */
'use client'

import React, { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import type { UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import type { QFieldMetaData } from '@/types'
import type { PossibleValueContext } from '@/lib/hooks/use-possible-values'
import { formValueFromRecordValue, zodSchemaFromFields } from '@/lib/utils/zod-from-metadata'
import { fromLocalDateTimeInput } from '@/lib/utils/datetime-utils'
import { DynamicFormField } from '@/components/forms/DynamicFormField'
import type { LeafBlockProps } from './QqqBlocks'
import { blockValues, text } from './block-utils'

/**
 * Whether field metadata requires more than the block's plain scalar control.
 * @param field - The block's field metadata.
 * @returns Whether to use the shared form editor.
 */
export function needsBlockInputEditor(field: Partial<QFieldMetaData>): boolean {
  return Boolean(field.isEditable === false || field.possibleValueSourceName || field.inlinePossibleValueSource || (field.displayFormat && field.displayFormat !== '%s') || field.behaviors?.length ||
    field.adornments?.some(({ type }) => ['WIDGET', 'FILE_UPLOAD', 'CODE_EDITOR'].includes(type)))
}

/** Shared editor configuration; the host owns its form and submission. */
interface BlockInputEditorProps {
  field: QFieldMetaData
  widgetName: string
  form: UseFormReturn<Record<string, unknown>>
  disabled?: boolean
  autoFocus?: boolean
  placeholder?: string
  contextValues?: Record<string, unknown>
  possibleValueContext?: PossibleValueContext
  onEnter: (value: string) => void
}

/**
 * Uses the existing Next field editors without introducing a nested form.
 * @param props - Field metadata, hosting form and Enter behavior.
 * @returns The field editor.
 */
export function BlockInputEditor({ field, widgetName, form, disabled = false, autoFocus, placeholder, contextValues, possibleValueContext, onEnter }: BlockInputEditorProps) {
  const root = useRef<HTMLDivElement>(null)
  const readOnly = disabled || field.isEditable === false
  useEffect(() => {
    if (autoFocus && !readOnly) root.current?.querySelector<HTMLElement>('input:not(:disabled), textarea:not(:disabled), button:not(:disabled)')?.focus()
  }, [autoFocus, readOnly])
  return <div ref={root} data-qqq-autofocus={autoFocus && !readOnly || undefined} data-qqq-id={`block-input-field-${widgetName}-${field.name}`} onKeyDown={(event) => {
    if (event.defaultPrevented || event.key !== 'Enter' || readOnly) return
    // Search pickers and multiline/code editors own Enter themselves.
    if (!(event.target instanceof HTMLInputElement) || event.target.name !== field.name || event.target.type === 'file') return
    event.preventDefault()
    onEnter(event.target.value.trim())
  }}>
    <DynamicFormField field={{ ...field, label: field.label || field.name, isEditable: field.isEditable !== false }}
      idPrefix={`block-${widgetName}`} register={form.register} control={form.control} errors={form.formState.errors}
      contextValues={contextValues} disabled={readOnly} possibleValueContext={possibleValueContext} placeholder={placeholder} />
  </div>
}

/**
 * A dashboard block owns its draft; only Enter sends it to the block action callback.
 * @param props - Block payload and field metadata.
 * @returns The metadata editor with its local form state.
 */
export function StandaloneBlockInputEditor({ block, widgetName, actionCallback, field }: LeafBlockProps & { field: QFieldMetaData }) {
  const values = blockValues(block)
  const form = useForm<Record<string, unknown>>({
    defaultValues: { [field.name]: formValueFromRecordValue(field, values.value) },
    resolver: zodResolver(zodSchemaFromFields([field])),
  })
  return <BlockInputEditor field={field} widgetName={widgetName} form={form}
    autoFocus={values.autoFocus === true} placeholder={text(values.placeholder)} onEnter={(entered) => {
      if (values.submitOnEnter !== true) return
      if (entered.startsWith('->')) {
        actionCallback?.(block, { actionCode: entered.substring(2), _fieldToClearIfError: field.name })
        return
      }
      if (['STRING', 'TEXT', 'HTML', 'PASSWORD'].includes(field.type)) form.setValue(field.name, entered, { shouldDirty: true })
      void form.trigger(field.name).then((valid) => {
        if (valid) actionCallback?.(block, { [field.name]: field.type === 'DATE_TIME' ? fromLocalDateTimeInput(entered, values.value) : entered })
      })
    }} />
}
