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
 * @file form-layout — how record and process forms size, decorate and transform fields, from
 * field metadata, as the Material dashboard does (DynamicForm and DynamicFormField):
 *
 * - a 12-column grid: full width on phones, half from `sm`, and the field's `gridColumns`
 *   (default 6, half) from `lg`; a `FILE_UPLOAD` field with `width: full` spans the row from `sm`;
 * - a `$` prefix for a `displayFormat` starting with `$`, and a `%` suffix for one ending in `%%`;
 * - live case change for the `TO_UPPER_CASE` and `TO_LOWER_CASE` behaviors.
 */

import type { QFieldMetaData } from '@/types'
import { findAdornment } from './adornment-utils'

/** Large-screen column spans, spelled out so Tailwind generates them. */
const LG_SPANS: Record<number, string> = {
  1: 'lg:col-span-1', 2: 'lg:col-span-2', 3: 'lg:col-span-3', 4: 'lg:col-span-4', 5: 'lg:col-span-5', 6: 'lg:col-span-6',
  7: 'lg:col-span-7', 8: 'lg:col-span-8', 9: 'lg:col-span-9', 10: 'lg:col-span-10', 11: 'lg:col-span-11', 12: 'lg:col-span-12',
}

/** Default large-screen width of a form field, in twelfths (Material: half). */
export const DEFAULT_FORM_FIELD_COLUMNS = 6

/**
 * The declared width of a `FILE_UPLOAD` field (`values.width`, default half).
 *
 * @param field - Field metadata.
 * @returns `full` or `half`.
 */
export function fileUploadWidth(field: QFieldMetaData): 'full' | 'half' {
  return findAdornment(field, 'FILE_UPLOAD')?.values?.width === 'full' ? 'full' : 'half'
}

/**
 * The field's large-screen width in twelfths.
 *
 * @param field - Field metadata.
 * @returns 1 to 12.
 */
export function formFieldColumns(field: QFieldMetaData): number {
  if (fileUploadWidth(field) === 'full' && findAdornment(field, 'FILE_UPLOAD')) return 12
  const declared = field.gridColumns
  return typeof declared === 'number' && Number.isFinite(declared) && declared >= 1 && declared <= 12
    ? Math.round(declared)
    : DEFAULT_FORM_FIELD_COLUMNS
}

/**
 * Column-span classes for a field in the form's 12-column grid.
 *
 * @param field - Field metadata.
 * @returns Tailwind classes.
 */
export function formFieldColumnClasses(field: QFieldMetaData): string {
  const fullFile = Boolean(findAdornment(field, 'FILE_UPLOAD')) && fileUploadWidth(field) === 'full'
  return `col-span-12 min-w-0 ${fullFile ? 'sm:col-span-12' : 'sm:col-span-6'} ${LG_SPANS[formFieldColumns(field)]}`
}

/** Text shown before and after a numeric input, from its display format. */
export interface NumberAdornments {
  /** `$` for a currency format. */
  prefix?: string
  /** `%` for a percent format. */
  suffix?: string
}

/**
 * The `$` prefix and `%` suffix a number input shows for its display format.
 *
 * @param field - Field metadata.
 * @returns The adornments (empty when the format declares none).
 */
export function numberAdornments(field: QFieldMetaData): NumberAdornments {
  const format = field.displayFormat ?? ''
  return {
    prefix: format.startsWith('$') ? '$' : undefined,
    suffix: format.endsWith('%%') ? '%' : undefined,
  }
}

/**
 * The live case change a text field applies while the user types, from its behaviors.
 *
 * @param field - Field metadata.
 * @returns A function that changes the case, or `undefined` when the field has no case behavior.
 */
export function caseTransform(field: QFieldMetaData): ((value: string) => string) | undefined {
  const behaviors = field.behaviors ?? []
  if (behaviors.includes('TO_UPPER_CASE')) return (value) => value.toUpperCase()
  if (behaviors.includes('TO_LOWER_CASE')) return (value) => value.toLowerCase()
  return undefined
}

/**
 * Applies a case change to a text input or textarea as the user types, keeping the caret and selection
 * at the same text boundaries even when case conversion expands characters.
 *
 * @param input - The input that changed.
 * @param transform - The case change.
 */
export function transformInputValue(input: HTMLInputElement | HTMLTextAreaElement, transform: (value: string) => string): void {
  const previous = input.value
  const next = transform(previous)
  if (next === previous) return
  const start = input.selectionStart
  const end = input.selectionEnd
  const direction = input.selectionDirection
  input.value = next
  if (start !== null && end !== null && document.activeElement === input) {
    input.setSelectionRange(
      transform(previous.slice(0, start)).length,
      transform(previous.slice(0, end)).length,
      direction ?? undefined,
    )
  }
}

/** Input types in which Enter would submit the form implicitly. */
const IMPLICIT_SUBMIT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date', 'time', 'datetime-local', 'month', 'week'])

/**
 * Whether a key press would submit a record form implicitly (Enter in a single-line input);
 * record forms save only from the Save button, as in the Material dashboard.
 *
 * @param event - The key event.
 * @returns `true` when the event is an Enter in a single-line input.
 */
export function isImplicitSubmitKey(event: Pick<KeyboardEvent, 'key' | 'target' | 'isComposing'>): boolean {
  if (event.key !== 'Enter' || event.isComposing) return false
  const target = event.target
  return target instanceof HTMLInputElement && IMPLICIT_SUBMIT_TYPES.has(target.type)
}
