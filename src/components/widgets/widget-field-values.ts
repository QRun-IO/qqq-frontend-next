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
 * @file widget-field-values — turns the field metadata and records that widget payloads
 * carry (fieldValueList, childRecordList) into the shapes the shared field renderer
 * (`FieldValue`) takes, so widget values are formatted by type, display format and
 * adornment exactly as record views format them (Material `ValueUtils.getDisplayValue`).
 */

import type { FieldAdornment, QFieldMetaData, QFieldType, QRecord } from '@/types'
import { formatProcessValue } from '@/components/process/process-values'
import { isPlainObject } from './widget-types'

/** Numeric field types whose values a `displayFormat` formats. */
const NUMERIC_TYPES = new Set(['INTEGER', 'LONG', 'DECIMAL'])

/**
 * Normalizes one field from a widget payload (a serialized backend `QFieldMetaData`)
 * into complete field metadata, optionally renamed (join columns are `table.field`).
 *
 * @param field - The payload field.
 * @param name - Name to use instead of the field's own (the key of its record values).
 * @param label - Label to use instead of the field's own.
 * @returns Field metadata with every required property.
 */
export function widgetField(field: Record<string, unknown>, name?: string, label?: string): QFieldMetaData {
  const fieldName = name ?? (typeof field.name === 'string' ? field.name : '')
  return {
    ...(field as Partial<QFieldMetaData>),
    name: fieldName,
    label: label ?? (typeof field.label === 'string' && field.label ? field.label : fieldName),
    type: (typeof field.type === 'string' ? field.type : 'STRING') as QFieldType,
    isRequired: field.isRequired === true,
    isEditable: field.isEditable !== false,
    isHeavy: field.isHeavy === true,
    isHidden: field.isHidden === true,
    adornments: Array.isArray(field.adornments) ? (field.adornments as FieldAdornment[]) : [],
  }
}

/**
 * Builds the record a widget's values render from: its values and display values, with a
 * display value added for numeric fields that have a `displayFormat` but no backend display
 * value (e.g. `$%,.2f` shows `$1,234.50`).
 *
 * @param record - The payload record (`{ values, displayValues }`), possibly absent.
 * @param fields - The fields shown.
 * @param tableName - Table the record belongs to, when known.
 * @returns A complete record.
 */
export function widgetRecord(record: unknown, fields: QFieldMetaData[], tableName = ''): QRecord {
  const source = isPlainObject(record) ? record : {}
  const values = isPlainObject(source.values) ? { ...source.values } : {}
  const displayValues: Record<string, string> = isPlainObject(source.displayValues)
    ? Object.fromEntries(Object.entries(source.displayValues).filter(([, value]) => value !== null && value !== undefined).map(([key, value]) => [key, String(value)]))
    : {}
  for (const field of fields) {
    const value = values[field.name]
    if (displayValues[field.name] !== undefined || value === null || value === undefined || value === '') continue
    if (NUMERIC_TYPES.has(field.type) && field.displayFormat) displayValues[field.name] = formatProcessValue(field, value)
  }
  return { tableName: typeof source.tableName === 'string' ? source.tableName : tableName, values, displayValues }
}
