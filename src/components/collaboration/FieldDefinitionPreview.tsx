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

/** @file Field-designer preview using the same dispatcher as record edit forms. */
'use client'
import { useForm } from 'react-hook-form'
import type { QFieldMetaData, QRecord } from '@/types'
import { DynamicFormField } from '@/components/forms/DynamicFormField'
/** Renders a safe local preview from a designer definition.
 * @param props - Loaded definition record.
 * @returns Preview card.
 */
export function FieldDefinitionPreview({ record }: { record: QRecord }) {
  const form = useForm<Record<string, unknown>>({
    defaultValues: { preview: record.values.defaultValue ?? '' },
  })
  const values = record.values
  const kind = String(values.type ?? 'STRING')
  const types: Record<string, QFieldMetaData['type']> = {
    STRING: 'STRING',
    TEXT: 'TEXT',
    INTEGER: 'INTEGER',
    DECIMAL: 'DECIMAL',
    BOOLEAN: 'BOOLEAN',
    DATE: 'DATE',
    DATE_TIME: 'DATE_TIME',
    SELECT: 'STRING',
    MULTI_SELECT: 'STRING',
    USER: 'STRING',
    RECORD_LINK: 'STRING',
  }
  const field: QFieldMetaData = {
    name: 'preview',
    label: String(values.label ?? 'Field'),
    type: types[kind] ?? 'STRING',
    isRequired: values.required === true,
    isEditable: true,
    isHeavy: false,
    isHidden: false,
    adornments: [],
    maxLength: typeof values.maxLength === 'number' ? values.maxLength : undefined,
    minValue: typeof values.minValue === 'number' ? values.minValue : undefined,
    maxValue: typeof values.maxValue === 'number' ? values.maxValue : undefined,
    ...(['SELECT', 'MULTI_SELECT'].includes(kind)
      ? { possibleValueSourceName: `collaboration_field_options_${String(values.id)}` }
      : kind === 'USER'
        ? { possibleValueSourceName: 'collaboration_user' }
        : kind === 'RECORD_LINK' && typeof values.linkTableName === 'string'
          ? { possibleValueSourceName: values.linkTableName }
          : {}),
  }
  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-card p-4"
      data-qqq-id="field-definition-preview"
    >
      <h2 className="font-semibold">Preview</h2>
      <DynamicFormField field={field} register={form.register} control={form.control} errors={{}} />
      {typeof values.helpText === 'string' && (
        <p className="text-sm text-muted-foreground">{values.helpText}</p>
      )}
    </section>
  )
}
