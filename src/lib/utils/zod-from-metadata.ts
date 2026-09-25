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
import { adornmentString } from './adornment-utils'
import { fromLocalDateTimeInput, toLocalDateTimeInput } from './datetime-utils'

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
 * Builds the schema of a LONG field. The value stays the exact digits typed (a string):
 * a JavaScript number cannot hold every LONG (beyond 2^53 it silently changes).
 *
 * @param isRequired - When `true`, blank values are rejected.
 * @param label - Field label for messages.
 * @param minValue - Optional lower bound.
 * @param maxValue - Optional upper bound.
 * @returns The schema, producing the digits as a string ('' when blank and optional).
 */
function buildLongSchema(isRequired: boolean, label: string, minValue?: number | string | null, maxValue?: number | string | null): z.ZodTypeAny {
  const text = z.union([z.string(), z.number(), z.bigint()]).transform((value) => String(value).trim())
  const checked = text
    .refine((value) => !isRequired || value !== '', `${label} is required`)
    .refine((value) => value === '' || /^[+-]?\d+$/.test(value), `${label} must be a whole number`)
    .refine((value) => value === '' || minValue === undefined || minValue === null || BigInt(value) >= BigInt(Math.ceil(Number(minValue))), `${label} must be at least ${minValue}`)
    .refine((value) => value === '' || maxValue === undefined || maxValue === null || BigInt(value) <= BigInt(Math.floor(Number(maxValue))), `${label} must be at most ${maxValue}`)
  return isRequired ? checked : checked.optional()
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
  return isRequired
    ? z.union([z.string().trim().min(1, `${label} is required`), z.number()]).pipe(schema)
    : z.union([z.literal(''), schema]).optional()
}

/**
 * Builds a Zod schema for a single QQQ field based on its type, required flag,
 * and optional maxLength.
 *
 * Used by {@link zodSchemaFromTableMetadata} and {@link zodSchemaFromFields} to build
 * full form validation schemas from table or process metadata.
 *
 * @example
 * // A required string field with max length 100
 * const schema = zodFieldFromMetadata({
 *   name: 'firstName', label: 'First Name', type: 'STRING',
 *   isRequired: true, maxLength: 100, isEditable: true, isHidden: false, isHeavy: false, adornments: [],
 * })
 * // Produces: z.string().min(1, 'First Name is required').max(100, 'First Name must be at most 100 characters')
 *
 * // An optional integer field with bounds
 * const schema = zodFieldFromMetadata({
 *   name: 'age', label: 'Age', type: 'INTEGER',
 *   isRequired: false, minValue: 0, maxValue: 150, isEditable: true, isHidden: false, isHeavy: false, adornments: [],
 * })
 * // Produces: z.union([z.literal(''), z.coerce.number().int().min(0).max(150)]).optional()
 *
 * @param field - The field metadata object containing type, required, maxLength, and label.
 * @param options - `enforceMaxLength: false` skips the `maxLength` limit (record forms, whose
 *   server applies each field's too-long policy).
 * @returns A `ZodTypeAny` appropriate for the field's type and constraints.
 */
export function zodFieldFromMetadata(field: QFieldMetaData, { enforceMaxLength = true }: { enforceMaxLength?: boolean } = {}): z.ZodTypeAny {
  const { type, isRequired, label } = field
  // Table writes apply the field's own too-long policy (truncate, ellipsis, pass through
  // or reject) on the server, so record forms do not pre-empt it with a client limit.
  const maxLength = enforceMaxLength ? field.maxLength : undefined

  switch (type) {
    case 'INTEGER':
      return buildNumberSchema(isRequired ?? false, label ?? type, true, field.minValue, field.maxValue)

    case 'LONG':
      return buildLongSchema(isRequired ?? false, label ?? type, field.minValue, field.maxValue)

    case 'DECIMAL':
      return buildNumberSchema(isRequired ?? false, label ?? type, false, field.minValue, field.maxValue)

    case 'BOOLEAN':
      return z.boolean().optional()

    case 'DATE':
    case 'TIME':
    case 'DATE_TIME':
      return buildDateTimeSchema(isRequired ?? false, label ?? type)

    case 'BLOB': {
      // A new File, the stored value (download URL or bytes) left unchanged, or null when
      // the stored file is removed. A required file must be present.
      const file = z.union([z.instanceof(File), z.string(), z.null()], { errorMap: () => ({ message: `${label ?? type} must be a file` }) })
      return isRequired
        ? file.refine((value) => value instanceof File || (typeof value === 'string' && value !== ''), `${label ?? type} is required`)
        : file.optional()
    }

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
 * @param allowNullValues - Preserve explicit nulls in optional copy fields; ordinary forms keep their existing schema.
 * @returns A `z.ZodObject` whose keys are editable field names and whose values are field schemas.
 */
export function zodSchemaFromTableMetadata(
  tableMetaData: QTableMetaData,
  fieldNamesToInclude?: string[],
  allowNullValues = false
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

    const fieldSchema = zodFieldFromMetadata(field, { enforceMaxLength: false })
    shape[fieldName] = allowNullValues && !field.isRequired ? fieldSchema.nullable() : fieldSchema
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
 * Converts one stored record value to the value its form control edits.
 *
 * DATE_TIME instants become local `datetime-local` text, DATE and TIME become
 * strings, and a stored null stays empty (`null` for BOOLEAN, `''` otherwise) so
 * the form shows what is actually stored rather than a metadata default.
 *
 * @param field - Field metadata.
 * @param value - The stored value from the record.
 * @returns The form control value.
 */
export function formValueFromRecordValue(field: QFieldMetaData, value: unknown): unknown {
  if (value === undefined || value === null) return field.type === 'BOOLEAN' ? null : ''
  if (field.type === 'DATE_TIME') return toLocalDateTimeInput(value) || String(value)
  if (field.type === 'DATE' || field.type === 'TIME') return String(value)
  if (field.type === 'BOOLEAN') return value === true || value === 'true' || value === 1 || value === '1'
  return value
}

/**
 * Builds form values for editing an existing record.
 *
 * Returns an object suitable for passing to React Hook Form's `defaultValues` option.
 * Only editable, visible fields are included; each shows its stored value
 * (see {@link formValueFromRecordValue}). Metadata defaults apply to new records only
 * ({@link defaultValuesForCreate}).
 *
 * @param tableMetaData - The table metadata describing field types.
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
    // A stored password reads back as a mask, not its value: start empty (typing replaces it).
    defaults[fieldName] = field.type === 'PASSWORD' && !field.adornments?.some((item) => item.type === 'REVEAL')
      ? ''
      : formValueFromRecordValue(field, recordValues[fieldName])
  }
  return defaults
}

/**
 * Converts a metadata `defaultValue` (serialized as text by the backend, for example
 * `"true"` for a BOOLEAN) to the value its form control edits.
 *
 * @param field - Field metadata.
 * @returns The typed default, or `undefined` when the field declares none.
 */
export function metadataDefaultValue(field: QFieldMetaData): unknown {
  const value = field.defaultValue
  if (value === undefined || value === null || value === '') return undefined
  if (field.type === 'BOOLEAN') return value === true || value === 'true' || value === 1 || value === '1'
  if (field.type === 'DATE_TIME') return toLocalDateTimeInput(value) || String(value)
  return typeof value === 'object' ? undefined : value
}

/**
 * Builds the initial values of a create form from each editable field's metadata
 * `defaultValue`. Fields without a default are left unset.
 *
 * @param tableMetaData - Table metadata.
 * @returns Defaults keyed by field name.
 */
export function defaultValuesForCreate(tableMetaData: QTableMetaData): Record<string, unknown> {
  const defaults: Record<string, unknown> = {}
  for (const [fieldName, field] of Object.entries(tableMetaData.fields)) {
    if (field.isHidden || !field.isEditable) continue
    const value = metadataDefaultValue(field)
    if (value !== undefined) defaults[fieldName] = value
  }
  return defaults
}

/**
 * Converts form values to what the record endpoints store: local DATE_TIME text
 * becomes the UTC instant; every other value passes through.
 *
 * @param tableMetaData - Table metadata.
 * @param values - Form values keyed by field name.
 * @returns A new object with wire values.
 */
export function wireValuesFromForm(tableMetaData: QTableMetaData, values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(values).map(([name, value]) => [name,
    tableMetaData.fields[name]?.type === 'DATE_TIME' && typeof value === 'string' ? fromLocalDateTimeInput(value) : value]))
}

/**
 * Prepare editable base fields for a new record without retaining its source key.
 * Native BLOB values are base64; upload files preserve their bytes and filename.
 * @param tableMetaData - Full source table metadata.
 * @param recordValues - Source values, which remain unchanged.
 * @returns Fresh form values; malformed binary data raises an error before saving.
 */
export function defaultValuesForCopy(
  tableMetaData: QTableMetaData,
  recordValues: Record<string, unknown>
): Record<string, unknown> {
  const defaults = defaultValuesFromRecord(tableMetaData, recordValues)
  defaults[tableMetaData.primaryKeyField] = ''
  for (const field of Object.values(tableMetaData.fields)) {
    const value = recordValues[field.name]
    if (field.isHidden || !field.isEditable || field.name === tableMetaData.primaryKeyField) continue
    if (field.type === 'PASSWORD' && !field.adornments?.some(item => item.type === 'REVEAL')) {
      defaults[field.name] = ''
      continue
    }
    if (value === null) {
      defaults[field.name] = null
      continue
    }
    if (value === undefined) {
      // A value the source did not return starts from the insert default, as on create.
      const fallback = metadataDefaultValue(field)
      if (fallback !== undefined) defaults[field.name] = fallback
      continue
    }
    if (field.type !== 'BLOB' || typeof value !== 'string') continue
    if (fileDownloadUrlValue(field, value)) {
      // A FILE_DOWNLOAD field reads as its download URL, not its bytes: the file is not
      // copied (as in the Material dashboard); the new record starts without it.
      delete defaults[field.name]
      continue
    }
    try {
      const bytes = Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
      const fileNameField = adornmentString(field, 'FILE_DOWNLOAD', 'fileNameField')
      const fileName = fileNameField ? recordValues[fileNameField] : undefined
      defaults[field.name] = new File([bytes], typeof fileName === 'string' && fileName ? fileName : field.name, {
        type: adornmentString(field, 'FILE_DOWNLOAD', 'defaultMimeType') ?? 'application/octet-stream',
      })
    } catch {
      throw new Error(`Cannot copy ${field.label}: the source file data is invalid.`)
    }
  }
  return defaults
}

/**
 * A native password mask is not source data; require an explicit replacement.
 * @param table - Full metadata defining editable fields and REVEAL adornments.
 * @param values - Current copy draft values.
 * @param fields - Optional fields not assigned by a copied parent.
 */
export function validateCopyPasswords(table: QTableMetaData, values: Record<string, unknown>, fields?: string[]): void {
  for (const field of Object.values(table.fields)) {
    if (field.type !== 'PASSWORD' || !field.isEditable || field.isHidden || field.adornments?.some(item => item.type === 'REVEAL') || (fields && !fields.includes(field.name))) continue
    if (typeof values[field.name] !== 'string' || values[field.name] === '') throw new Error(`Enter a new value for ${field.label}; its source password is unreadable.`)
  }
}

/**
 * Whether a BLOB value is the backend's FILE_DOWNLOAD URL rather than base64 bytes.
 *
 * @param field - Field metadata.
 * @param value - The stored value.
 * @returns `true` for a download URL.
 */
function fileDownloadUrlValue(field: QFieldMetaData, value: string): boolean {
  return Boolean(field.adornments?.some((item) => item.type === 'FILE_DOWNLOAD')) && (value.startsWith('/') || /^https?:\/\//i.test(value))
}
