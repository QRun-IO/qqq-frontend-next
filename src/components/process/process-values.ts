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
 * @file Pure helpers for presenting process values: display formatting, text
 * interpolation and the form defaults/payload of a process screen.
 */

import type { QFieldMetaData } from '@/types'

/**
 * Apply a QQQ `displayFormat` (a Java format string such as `%,d` or `$%,.2f`) to a number.
 * @param format - The field display format.
 * @param value - Numeric value.
 * @returns The formatted text.
 */
function formatNumber(format: string | undefined, value: number): string {
  if (!format || format === '%s') return String(value)
  const match = /%(,?)(?:\.(\d+))?([dfs])/.exec(format)
  if (!match) return String(value)
  const [token, grouping, decimals, conversion] = match
  let text: string
  if (conversion === 'f') {
    const digits = decimals === undefined ? 6 : Number(decimals)
    text = value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: grouping === ',' })
  } else if (conversion === 'd') {
    text = Math.trunc(value).toLocaleString('en-US', { useGrouping: grouping === ',' })
  } else {
    text = String(value)
  }
  return format.replace(token, text)
}

/**
 * Format a process value for read-only display, following the field's type and display format.
 * @param field - Field metadata.
 * @param value - Raw process value.
 * @param possibleValueLabel - Resolved possible-value label, when the field has a source.
 * @returns Text to display (empty string for no value).
 */
export function formatProcessValue(field: QFieldMetaData, value: unknown, possibleValueLabel?: string): string {
  if (value === null || value === undefined || value === '') return ''
  if (possibleValueLabel) return possibleValueLabel
  if (field.type === 'BOOLEAN') {
    if (value === true || value === 'true') return 'Yes'
    if (value === false || value === 'false') return 'No'
  }
  if ((field.type === 'INTEGER' || field.type === 'LONG' || field.type === 'DECIMAL') && value !== '' && !Number.isNaN(Number(value))) {
    return formatNumber(field.displayFormat, Number(value))
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * Replace `${name}` placeholders with process values, as the Material dashboard does for text blocks.
 * @param text - Text with placeholders.
 * @param values - Process values.
 * @returns The interpolated text.
 */
export function interpolateProcessValues(text: string, values: Record<string, unknown>): string {
  return text.replace(/\$\{([^}]+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) && values[name] !== null && values[name] !== undefined ? String(values[name]) : placeholder)
}

/**
 * Initial form value for a field on a process screen.
 * @param field - Field metadata.
 * @param value - Current process value for the field.
 * @returns A value compatible with the form controls (strings for text, booleans for checkboxes).
 */
export function initialFormValue(field: QFieldMetaData, value: unknown): unknown {
  const resolved = value === undefined || value === null ? field.defaultValue : value
  if (field.type === 'BOOLEAN') {
    if (resolved === true || resolved === 'true') return true
    if (resolved === false || resolved === 'false') return false
    return null
  }
  if (field.type === 'BLOB') return resolved instanceof File ? resolved : undefined
  if (resolved === undefined || resolved === null) return ''
  if (typeof resolved === 'object') return JSON.stringify(resolved)
  return field.possibleValueSourceName ? resolved : String(resolved)
}

/**
 * Whether a field is uploaded as a file rather than posted as a value.
 * @param field - Field metadata.
 * @returns `true` for BLOB fields and fields with a FILE_UPLOAD adornment.
 */
export function isFileField(field: QFieldMetaData): boolean {
  return field.type === 'BLOB' || Boolean(field.adornments?.some((adornment) => adornment.type === 'FILE_UPLOAD'))
}
