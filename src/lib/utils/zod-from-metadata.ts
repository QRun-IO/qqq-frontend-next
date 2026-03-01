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
 * @file zod-from-metadata — builds Zod validation schemas dynamically from QQQ field and table metadata.
 */

import { z } from 'zod'

import type { QFieldMetaData, QTableMetaData } from '@/types'

/**
 * Internal helper used by {@link zodFieldFromMetadata} to build a string-based Zod schema
 * for STRING, TEXT, HTML, and PASSWORD field types.
 *
 * @param isRequired - When `true`, adds a `min(1)` constraint so empty strings fail
 *   validation with a `"${label} is required"` message; `false` makes the field optional.
 * @param label - The human-readable field label from metadata, used verbatim in error
 *   messages (e.g. `"First Name is required"`).
 * @param maxLength - When provided (from `QFieldMetaData.maxLength`), adds a `max()`
 *   constraint with a `"${label} must be at most ${maxLength} characters"` message.
 * @returns A `z.ZodString` when required, or `z.ZodOptional<z.ZodString>` when optional.
 *   The returned schema is typed as `z.ZodTypeAny` because the exact generic depends on
 *   the `isRequired` branch.
 */
function buildStringSchema(isRequired: boolean, label: string, maxLength?: number): z.ZodTypeAny {
  let schema = z.string()
  if (isRequired) schema = schema.min(1, `${label} is required`)
  if (maxLength) schema = schema.max(maxLength, `${label} must be at most ${maxLength} characters`)
  return isRequired ? schema : schema.optional()
}

/**
 * Internal helper used by {@link zodFieldFromMetadata} to build a string-based Zod schema
 * for DATE, TIME, and DATE_TIME field types.
 *
 * Date and time values travel through HTML `<input type="date">` and `<input type="datetime-local">`
 * elements as ISO-8601 strings (e.g. `"2026-03-01"` or `"2026-03-01T14:30"`). The form layer
 * therefore keeps these as strings rather than JavaScript `Date` objects — Zod transforms
 * (if needed) are applied at submit time by the form submit handler, not at the schema level.
 * No `maxLength` is applied because the browser constrains the format to a fixed-width string.
 *
 * @param isRequired - When `true`, adds a `min(1)` constraint so an unpopulated date input
 *   (which submits as an empty string `""`) fails validation with a `"${label} is required"`
 *   message; `false` makes the field optional.
 * @param label - The human-readable field label from metadata, used verbatim in error messages.
 * @returns A `z.ZodString` when required, or `z.ZodOptional<z.ZodString>` when optional.
 */
function buildDateTimeSchema(isRequired: boolean, label: string): z.ZodTypeAny {
  const schema = z.string()
  if (isRequired) return schema.min(1, `${label} is required`)
  return schema.optional()
}

/**
 * Internal helper used by {@link zodFieldFromMetadata} to build a `coerce.number()` schema
 * for INTEGER, LONG, and DECIMAL field types.
 *
 * HTML `<input type="number">` elements submit an empty string when left blank, which would
 * cause a type error against a plain `z.number()`. The optional branch therefore returns
 * `z.union([z.literal(''), schema]).optional()` so blank inputs pass validation cleanly.
 *
 * @param isRequired - When `true`, the schema rejects empty strings; `false` wraps the schema
 *   in a union with `z.literal('')` and marks it optional.
 * @param label - The human-readable field label used verbatim in all error messages.
 * @param isInteger - When `true`, adds a `.int()` constraint (for INTEGER / LONG types);
 *   `false` allows fractional values (DECIMAL).
 * @param minValue - Optional lower bound from field metadata; adds a `.min()` constraint when
 *   defined and non-null.
 * @param maxValue - Optional upper bound from field metadata; adds a `.max()` constraint when
 *   defined and non-null.
 * @returns A `ZodTypeAny` — a plain `ZodNumber` when required, or a `ZodOptional` union when not.
 */
function buildNumberSchema(
  isRequired: boolean,
  label: string,
  isInteger: boolean,
  minValue?: number | string | null,
  maxValue?: number | string | null
): z.ZodTypeAny {
  let schema: z.ZodNumber = isInteger
    ? z.coerce.number().int(`${label} must be a whole number`)
    : z.coerce.number({ message: `${label} must be a number` })
  if (minValue !== undefined && minValue !== null) {
    schema = schema.min(Number(minValue), `${label} must be at least ${minValue}`)
  }
  if (maxValue !== undefined && maxValue !== null) {
    schema = schema.max(Number(maxValue), `${label} must be at most ${maxValue}`)
  }
  return isRequired ? schema : z.union([z.literal(''), schema]).optional()
}

/**
 * Builds a Zod schema for a single QQQ field based on its type, required flag,
 * and optional maxLength.
 *
 * Used by {@link zodSchemaFromTableMetadata} and {@link zodSchemaFromFields} to build
 * full form validation schemas from table or process metadata.
 *
 * @param field - The field metadata object containing type, required, maxLength, and label.
 * @returns A `ZodTypeAny` appropriate for the field's type and constraints.
 */
export function zodFieldFromMetadata(field: QFieldMetaData): z.ZodTypeAny {
  const { type, isRequired, maxLength, label } = field

  switch (type) {
    case 'INTEGER':
    case 'LONG':
      return buildNumberSchema(isRequired ?? false, label ?? type, true, field.minValue, field.maxValue)

    case 'DECIMAL':
      return buildNumberSchema(isRequired ?? false, label ?? type, false, field.minValue, field.maxValue)

    case 'BOOLEAN':
      return z.boolean().optional()

    case 'DATE':
    case 'TIME':
    case 'DATE_TIME':
      return buildDateTimeSchema(isRequired ?? false, label ?? type)

    case 'BLOB':
      // BLOB fields accept File objects or strings (existing file URLs)
      return z.union([z.instanceof(File), z.string()]).optional()

    case 'PASSWORD':
    case 'TEXT':
    case 'HTML':
    case 'STRING':
    default:
      return buildStringSchema(isRequired ?? false, label ?? type, maxLength)
  }
}

/**
 * Builds a complete Zod schema object from a {@link QTableMetaData}'s editable fields.
 *
 * Skips fields that are hidden (`isHidden`) or not editable (`!isEditable`).
 * When `fieldNamesToInclude` is provided, only those fields are considered
 * (useful for partial-edit dialogs or step-by-step wizards).
 *
 * @param tableMetaData - The table metadata whose fields drive the schema shape.
 * @param fieldNamesToInclude - Optional allowlist of field names to include. Defaults to all fields.
 * @returns A `z.ZodObject` whose keys are editable field names and whose values are field schemas.
 */
export function zodSchemaFromTableMetadata(
  tableMetaData: QTableMetaData,
  fieldNamesToInclude?: string[]
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {}

  const fieldsToProcess = fieldNamesToInclude
    ? fieldNamesToInclude.filter((name) => tableMetaData.fields[name])
    : Object.keys(tableMetaData.fields)

  for (const fieldName of fieldsToProcess) {
    const field = tableMetaData.fields[fieldName]
    if (!field) continue
    if (field.isHidden) continue
    if (!field.isEditable) continue

    shape[fieldName] = zodFieldFromMetadata(field)
  }

  return z.object(shape)
}

/**
 * Builds a Zod schema from a flat array of {@link QFieldMetaData} objects.
 *
 * Used for process form steps (Package 4) where the backend returns an ordered list
 * of fields rather than a table metadata object. Hidden fields are excluded.
 *
 * @param fields - The ordered list of field metadata objects to include in the schema.
 * @returns A `z.ZodObject` whose keys are field names and whose values are field schemas.
 */
export function zodSchemaFromFields(
  fields: QFieldMetaData[]
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const field of fields) {
    if (field.isHidden) continue
    shape[field.name] = zodFieldFromMetadata(field)
  }

  return z.object(shape)
}

/**
 * Builds default form values from existing record data and table metadata.
 *
 * Returns an object suitable for passing to React Hook Form's `defaultValues` option.
 * For each editable, visible field:
 * - Uses the record value if present, coercing date/time to string and boolean to boolean.
 * - Falls back to `field.defaultValue` from metadata, then `false` for booleans, then `''`.
 *
 * @param tableMetaData - The table metadata describing field types and defaults.
 * @param recordValues - The raw record data keyed by field name (e.g. from the API response).
 * @returns A plain object of default values ready for `useForm({ defaultValues })`.
 */
export function defaultValuesFromRecord(
  tableMetaData: QTableMetaData,
  recordValues: Record<string, unknown>
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {}

  for (const [fieldName, field] of Object.entries(tableMetaData.fields)) {
    if (field.isHidden || !field.isEditable) continue

    const value = recordValues[fieldName]

    if (value !== undefined && value !== null) {
      // Convert to string for date/time fields to work with HTML inputs
      if (field.type === 'DATE' || field.type === 'TIME' || field.type === 'DATE_TIME') {
        defaults[fieldName] = String(value)
      } else if (field.type === 'BOOLEAN') {
        defaults[fieldName] = Boolean(value)
      } else {
        defaults[fieldName] = value
      }
    } else {
      // Use default value from metadata if available
      if (field.defaultValue !== undefined) {
        defaults[fieldName] = field.defaultValue
      } else if (field.type === 'BOOLEAN') {
        defaults[fieldName] = false
      } else {
        defaults[fieldName] = ''
      }
    }
  }

  return defaults
}
