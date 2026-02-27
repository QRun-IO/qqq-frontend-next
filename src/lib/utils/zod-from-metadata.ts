// zod-from-metadata — build Zod schemas dynamically from QFieldMetaData

import { z } from 'zod'

import type { QFieldMetaData, QTableMetaData } from '@/types'

/** Build a string-based Zod schema with optional required/maxLength constraints. */
function buildStringSchema(isRequired: boolean, label: string, maxLength?: number): z.ZodTypeAny {
  let schema = z.string()
  if (isRequired) schema = schema.min(1, `${label} is required`)
  if (maxLength) schema = schema.max(maxLength, `${label} must be at most ${maxLength} characters`)
  return isRequired ? schema : schema.optional()
}

/** Build a string-based Zod schema for date/time fields (same as string but no maxLength). */
function buildDateTimeSchema(isRequired: boolean, label: string): z.ZodTypeAny {
  const schema = z.string()
  if (isRequired) return schema.min(1, `${label} is required`)
  return schema.optional()
}

/**
 * Build a Zod field validator for a single QFieldMetaData.
 * Returns a ZodTypeAny that can be added to a schema object.
 */
export function zodFieldFromMetadata(field: QFieldMetaData): z.ZodTypeAny {
  const { type, isRequired, maxLength, label } = field

  switch (type) {
    case 'INTEGER':
    case 'LONG': {
      const num = z.coerce.number().int(`${label} must be a whole number`)
      if (isRequired) return num
      return z.union([z.literal(''), z.coerce.number().int(`${label} must be a whole number`)]).optional()
    }

    case 'DECIMAL': {
      const dec = z.coerce.number({ message: `${label} must be a number` })
      if (isRequired) return dec
      return z.union([z.literal(''), z.coerce.number()]).optional()
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
 * Build a complete Zod schema object from a QTableMetaData's editable fields.
 * Only includes fields that are editable and not hidden.
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
 * Build a Zod schema from an array of QFieldMetaData (used for process form steps).
 * Useful for Package 4 process forms where we have a flat list of fields.
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
 * Build default form values from record data and table metadata.
 * Returns an object suitable for useForm's defaultValues.
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
