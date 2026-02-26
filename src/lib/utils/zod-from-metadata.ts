// zod-from-metadata — build Zod schemas dynamically from QFieldMetaData

import { z } from 'zod'

import type { QFieldMetaData, QTableMetaData } from '@/types'

/**
 * Build a Zod field validator for a single QFieldMetaData.
 * Returns a ZodTypeAny that can be added to a schema object.
 */
export function zodFieldFromMetadata(field: QFieldMetaData): z.ZodTypeAny {
  const { type, isRequired, maxLength, label } = field

  let schema: z.ZodTypeAny

  switch (type) {
    case 'INTEGER':
    case 'LONG': {
      const num = z.coerce.number().int(`${label} must be a whole number`)
      if (isRequired) {
        schema = num
      } else {
        schema = z.union([z.literal(''), z.coerce.number().int(`${label} must be a whole number`)]).optional()
      }
      break
    }

    case 'DECIMAL': {
      const dec = z.coerce.number({ message: `${label} must be a number` })
      if (isRequired) {
        schema = dec
      } else {
        schema = z.union([z.literal(''), z.coerce.number()]).optional()
      }
      break
    }

    case 'BOOLEAN': {
      schema = z.boolean().optional()
      break
    }

    case 'DATE': {
      let dateSchema = z.string()
      if (isRequired) {
        dateSchema = dateSchema.min(1, `${label} is required`)
      }
      schema = isRequired ? dateSchema : dateSchema.optional()
      break
    }

    case 'TIME': {
      let timeSchema = z.string()
      if (isRequired) {
        timeSchema = timeSchema.min(1, `${label} is required`)
      }
      schema = isRequired ? timeSchema : timeSchema.optional()
      break
    }

    case 'DATE_TIME': {
      let dtSchema = z.string()
      if (isRequired) {
        dtSchema = dtSchema.min(1, `${label} is required`)
      }
      schema = isRequired ? dtSchema : dtSchema.optional()
      break
    }

    case 'PASSWORD': {
      let pwSchema = z.string()
      if (isRequired) {
        pwSchema = pwSchema.min(1, `${label} is required`)
      }
      if (maxLength) {
        pwSchema = pwSchema.max(maxLength, `${label} must be at most ${maxLength} characters`)
      }
      schema = isRequired ? pwSchema : pwSchema.optional()
      break
    }

    case 'TEXT':
    case 'HTML': {
      let textSchema = z.string()
      if (isRequired) {
        textSchema = textSchema.min(1, `${label} is required`)
      }
      schema = isRequired ? textSchema : textSchema.optional()
      break
    }

    case 'BLOB': {
      // BLOB fields accept File objects or strings (existing file URLs)
      const blobSchema = z.union([z.instanceof(File), z.string()]).optional()
      schema = blobSchema
      break
    }

    case 'STRING':
    default: {
      let strSchema = z.string()
      if (isRequired) {
        strSchema = strSchema.min(1, `${label} is required`)
      }
      if (maxLength) {
        strSchema = strSchema.max(maxLength, `${label} must be at most ${maxLength} characters`)
      }
      schema = isRequired ? strSchema : strSchema.optional()
      break
    }
  }

  return schema
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
