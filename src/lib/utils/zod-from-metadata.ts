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

/** zod-from-metadata — builds Zod validation schemas dynamically from QQQ field and table metadata */

import { z } from 'zod'

import type { QFieldMetaData, QTableMetaData } from '@/types'

/**
 * Builds a string-based Zod schema with optional required/maxLength constraints.
 *
 * @param isRequired - When true, adds a `min(1)` constraint with a required message.
 * @param label - The field label used in validation error messages.
 * @param maxLength - When provided, adds a `max()` constraint.
 * @returns A `z.ZodString` or `z.ZodOptional<z.ZodString>` schema.
 */
function buildStringSchema(isRequired: boolean, label: string, maxLength?: number): z.ZodTypeAny {
  let schema = z.string()
  if (isRequired) schema = schema.min(1, `${label} is required`)
  if (maxLength) schema = schema.max(maxLength, `${label} must be at most ${maxLength} characters`)
  return isRequired ? schema : schema.optional()
}

/**
 * Builds a string-based Zod schema for date/time fields (same as string but without maxLength).
 *
 * Date/time values are stored as strings in HTML `<input>` elements, so the schema is
 * identical to a plain string schema minus any length limit.
 *
 * @param isRequired - When true, adds a `min(1)` constraint with a required message.
 * @param label - The field label used in validation error messages.
 * @returns A `z.ZodString` or `z.ZodOptional<z.ZodString>` schema.
 */
function buildDateTimeSchema(isRequired: boolean, label: string): z.ZodTypeAny {
  const schema = z.string()
  if (isRequired) return schema.min(1, `${label} is required`)
  return schema.optional()
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
    case 'LONG': {
      let num = z.coerce.number().int(`${label} must be a whole number`)
      if (field.minValue !== undefined && field.minValue !== null) {
        num = num.min(Number(field.minValue), `${label} must be at least ${field.minValue}`)
      }
      if (field.maxValue !== undefined && field.maxValue !== null) {
        num = num.max(Number(field.maxValue), `${label} must be at most ${field.maxValue}`)
      }
      if (isRequired) return num
      let optNum = z.coerce.number().int(`${label} must be a whole number`)
      if (field.minValue !== undefined && field.minValue !== null) {
        optNum = optNum.min(Number(field.minValue), `${label} must be at least ${field.minValue}`)
      }
      if (field.maxValue !== undefined && field.maxValue !== null) {
        optNum = optNum.max(Number(field.maxValue), `${label} must be at most ${field.maxValue}`)
      }
      return z.union([z.literal(''), optNum]).optional()
    }

    case 'DECIMAL': {
      let dec = z.coerce.number({ message: `${label} must be a number` })
      if (field.minValue !== undefined && field.minValue !== null) {
        dec = dec.min(Number(field.minValue), `${label} must be at least ${field.minValue}`)
      }
      if (field.maxValue !== undefined && field.maxValue !== null) {
        dec = dec.max(Number(field.maxValue), `${label} must be at most ${field.maxValue}`)
      }
      if (isRequired) return dec
      let optDec = z.coerce.number()
      if (field.minValue !== undefined && field.minValue !== null) {
        optDec = optDec.min(Number(field.minValue), `${label} must be at least ${field.minValue}`)
      }
      if (field.maxValue !== undefined && field.maxValue !== null) {
        optDec = optDec.max(Number(field.maxValue), `${label} must be at most ${field.maxValue}`)
      }
      return z.union([z.literal(''), optDec]).optional()
    }

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
