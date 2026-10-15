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
 * @file Form adjusters — the UI API's table form adjuster route, which lets an
 * application change a record form on load and when a field changes (field definitions,
 * values, sections, or locking the form).
 */

import { z } from 'zod'

import type { QFieldMetaData, QTableSection } from '@/types'
import apiClient from './client'

/** When an adjuster runs: when the form (or a field) loads, or after a field changes. */
export type FormAdjusterEvent = 'onLoad' | 'onChange'

/** What an adjuster returns (`FormAdjusterOutput` in the Material dashboard backend). */
export interface FormAdjusterOutput {
  /** Replacement definitions for fields, by name (hidden, required, editable, label, ...). */
  updatedFieldMetaData?: Record<string, QFieldMetaData>
  /** New values for fields, by name. */
  updatedFieldValues?: Record<string, unknown>
  /** Display values (possible-value labels) for fields given new values. */
  updatedFieldDisplayValues?: Record<string, string>
  /** Fields whose values are cleared. */
  fieldsToClear?: string[]
  /** Replacement definitions for sections, by name (hide, relabel, show). */
  updatedSectionMetaData?: Record<string, QTableSection>
  /** When true the form is locked: fields read-only and saving disabled. */
  isFormDisabled?: boolean
  /** Why the form is locked. */
  formDisabledMessage?: string
}

/** Unknown keys (and a null) are tolerated; each known key is checked where the form uses it. */
const FormAdjusterOutputSchema = z.object({
  updatedFieldMetaData: z.record(z.object({ name: z.string().optional() }).passthrough()).nullish(),
  updatedFieldValues: z.record(z.unknown()).nullish(),
  updatedFieldDisplayValues: z.record(z.string().nullable()).nullish(),
  fieldsToClear: z.array(z.string()).nullish(),
  updatedSectionMetaData: z.record(z.object({ name: z.string().optional() }).passthrough()).nullish(),
  isFormDisabled: z.boolean().nullish(),
  formDisabledMessage: z.string().nullish(),
}).passthrough()

/**
 * Runs a table or field form adjuster through the UI API with JSON values.
 *
 * @param tableName - Exact backend table identifier.
 * @param identifier - The adjuster's identifier (`table:{name}` or a field's `formAdjusterIdentifier`).
 * @param event - `onLoad` or `onChange`.
 * @param input - The changed field and its new value (field adjusters) and every form value.
 * @param input.fieldName - The field the event is for (field adjusters).
 * @param input.newValue - The field's new value (field adjusters).
 * @param input.allValues - Every value of the form.
 * @returns The adjuster's output, with absent keys left out.
 * @throws When the request fails or the response is not an adjuster output.
 */
export async function runFormAdjuster(
  tableName: string,
  identifier: string,
  event: FormAdjusterEvent,
  input: { fieldName?: string; newValue?: unknown; allValues: Record<string, unknown> }
): Promise<FormAdjusterOutput> {
  const allValues = Object.fromEntries(Object.entries(input.allValues).filter(([, value]) => !(value instanceof File)))
  const response = await apiClient.post<unknown>(
    `/table/${encodeURIComponent(tableName)}/formAdjuster/${encodeURIComponent(identifier)}/${event}`,
    { ...input, allValues }
  )
  const parsed = FormAdjusterOutputSchema.safeParse(response ?? {})
  if (!parsed.success) throw new Error('Invalid form adjuster response')
  const output: FormAdjusterOutput = {}
  const data = parsed.data
  if (data.updatedFieldMetaData) output.updatedFieldMetaData = data.updatedFieldMetaData as unknown as Record<string, QFieldMetaData>
  if (data.updatedFieldValues) output.updatedFieldValues = data.updatedFieldValues
  if (data.updatedFieldDisplayValues) {
    output.updatedFieldDisplayValues = Object.fromEntries(Object.entries(data.updatedFieldDisplayValues).map(([name, label]) => [name, label ?? '']))
  }
  if (data.fieldsToClear) output.fieldsToClear = data.fieldsToClear
  if (data.updatedSectionMetaData) output.updatedSectionMetaData = data.updatedSectionMetaData as unknown as Record<string, QTableSection>
  if (data.isFormDisabled) output.isFormDisabled = true
  if (data.formDisabledMessage) output.formDisabledMessage = data.formDisabledMessage
  return output
}
