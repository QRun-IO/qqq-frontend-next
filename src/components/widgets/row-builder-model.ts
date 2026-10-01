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
 * @file row-builder-model — pure helpers of the `rowBuilder` widget: its configuration
 * (the widget's `defaultValues`, as `RowBuilderWidgetRenderer.Builder` writes them), its
 * row fields, seeding rows, new rows, per-field validation, and the output the widget
 * writes to a form (Material `RowBuilderWidget.runOnSaveCallback`).
 */

import type { QFieldMetaData, QFieldType } from '@/types'
import { fromLocalDateTimeInput } from '@/lib/utils/datetime-utils'
import { formValueFromRecordValue, zodFieldFromMetadata } from '@/lib/utils/zod-from-metadata'

import { asList, isPlainObject } from './widget-types'

/** Key of a row's stable index in the output (Material `ROW_INDEX_KEY`). */
export const ROW_INDEX_KEY = '_qRowIndex'

/** Default output field name when the widget names neither an association nor an output field. */
export const DEFAULT_OUTPUT_FIELD_NAME = 'records'

/** Default title of the modal editor. */
export const DEFAULT_MODAL_TITLE = 'Edit Rows'

/** One row as serialized by `RowBuilderData.records` (a `QRecord`). */
export interface RowBuilderRecord {
  values?: Record<string, unknown>
  displayValues?: Record<string, string>
}

/** One row being built: its stable key and its values as stored (wire values). */
export interface BuilderRow {
  /** Stable identity (Material `_qRowIndex`), kept as rows are reordered. */
  key: number
  /** Values as the backend stores them (DATE_TIME instants, numbers, booleans). */
  values: Record<string, unknown>
  /** Backend display values; a field's entry is dropped once its value is edited. */
  displayValues: Record<string, string>
}

/** The widget's configuration from `widgetMetaData.defaultValues`. */
export interface RowBuilderConfig {
  /** Association of the form's table whose child records the rows are (record forms). */
  associationName?: string
  /** Field (or process value) that receives the rows as JSON: `associationName ?? outputFieldName ?? 'records'`. */
  outputFieldName: string
  /** Field that receives each row's 0-based position when rows may be reordered. */
  orderByFieldName?: string
  /** Whether rows may be reordered (requires `orderByFieldName`). */
  mayReorderRows: boolean
  /** When true, the widget edits on record create/edit forms and is read-only elsewhere. */
  isForRecordViewAndEditScreen: boolean
  /** Whether the widget edits (ignored when `isForRecordViewAndEditScreen`). */
  isEditable: boolean
  /** Edit in a modal ("Edit" button) instead of inline. */
  useModalEditor: boolean
  /** Heading shown beside the widget label. */
  inlineHeading?: string
  /** Modal title from the metadata (the payload's `modalTitle` wins). */
  modalTitle?: string
  /** Parent form field name to the new row's field name it is copied to. */
  defaultValuesForNewRowsFromParentRecord: Record<string, string>
}

/** Screens a row builder can edit on (see `WidgetFormContext.screen`). */
export type RowBuilderScreen = 'recordCreate' | 'recordEdit' | 'processStep'

const FIELD_TYPES: readonly QFieldType[] = ['STRING', 'INTEGER', 'LONG', 'DECIMAL', 'BOOLEAN', 'DATE', 'TIME', 'DATE_TIME', 'TEXT', 'HTML', 'PASSWORD', 'BLOB']

/**
 * Material reads these flags with `` `${value}` == "true" ``: `true` or `"true"`.
 *
 * @param value - A default value.
 * @returns Whether it is true.
 */
function isTrue(value: unknown): boolean {
  return `${value}` === 'true'
}

/**
 * A non-empty string default value.
 *
 * @param value - A default value.
 * @returns The string, or undefined.
 */
function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/**
 * Reads the widget's configuration from its default values.
 *
 * @param defaultValues - `widgetMetaData.defaultValues`.
 * @returns The configuration.
 */
export function readRowBuilderConfig(defaultValues: Record<string, unknown> | undefined): RowBuilderConfig {
  const values = defaultValues ?? {}
  const associationName = optionalString(values.associationName)
  const fromParent: Record<string, string> = {}
  if (isPlainObject(values.defaultValuesForNewRowsFromParentRecord)) {
    for (const [from, to] of Object.entries(values.defaultValuesForNewRowsFromParentRecord)) {
      if (typeof to === 'string' && to) fromParent[from] = to
    }
  }
  return {
    associationName,
    outputFieldName: associationName ?? optionalString(values.outputFieldName) ?? DEFAULT_OUTPUT_FIELD_NAME,
    orderByFieldName: optionalString(values.orderByFieldName),
    mayReorderRows: isTrue(values.mayReorderRows),
    isForRecordViewAndEditScreen: isTrue(values.isForRecordViewAndEditScreen),
    isEditable: isTrue(values.isEditable),
    useModalEditor: isTrue(values.useModalEditor),
    inlineHeading: optionalString(values.inlineHeading),
    modalTitle: optionalString(values.modalTitle),
    defaultValuesForNewRowsFromParentRecord: fromParent,
  }
}

/**
 * Whether the widget edits on a screen (Material: `isForRecordViewAndEditScreen ? screen
 * === "recordEdit" : isEditable`, where the record create and edit forms both pass
 * `recordEdit` and process screens pass no screen).
 *
 * @param config - Widget configuration.
 * @param screen - The form screen, or undefined when not inside a form.
 * @returns True when the rows are editable there.
 */
export function isRowBuilderEditable(config: RowBuilderConfig, screen: RowBuilderScreen | undefined): boolean {
  if (!screen) return false
  if (config.isForRecordViewAndEditScreen) return screen === 'recordCreate' || screen === 'recordEdit'
  return config.isEditable
}

/**
 * One declared row field as field metadata, with the defaults of a backend
 * `QFieldMetaData` for anything the declaration omits.
 *
 * @param raw - A `frontendFields` or `fields` entry.
 * @returns The field, or null when it has no name.
 */
function normalizeField(raw: unknown): QFieldMetaData | null {
  if (!isPlainObject(raw) || typeof raw.name !== 'string' || raw.name === '') return null
  const type = FIELD_TYPES.includes(raw.type as QFieldType) ? (raw.type as QFieldType) : 'STRING'
  return {
    ...(raw as Partial<QFieldMetaData>),
    name: raw.name,
    label: typeof raw.label === 'string' && raw.label ? raw.label : raw.name,
    type,
    isRequired: raw.isRequired === true,
    isEditable: raw.isEditable !== false,
    isHidden: raw.isHidden === true,
    isHeavy: raw.isHeavy === true,
    adornments: Array.isArray(raw.adornments) ? (raw.adornments as QFieldMetaData['adornments']) : [],
  }
}

/**
 * The row fields: `frontendFields` (which the backend validator derives from `fields`),
 * else `fields`, as Material reads them.
 *
 * @param defaultValues - `widgetMetaData.defaultValues`.
 * @returns The fields in order (empty when none are declared).
 */
export function rowBuilderFields(defaultValues: Record<string, unknown> | undefined): QFieldMetaData[] {
  const frontend = asList(defaultValues?.frontendFields) ?? []
  const declared = frontend.length > 0 ? frontend : (asList(defaultValues?.fields) ?? [])
  return declared.map(normalizeField).filter((field): field is QFieldMetaData => field !== null)
}

/**
 * Text values of a display value map.
 *
 * @param value - A `displayValues` map.
 * @returns Its string entries.
 */
function displayValueMap(value: unknown): Record<string, string> {
  const result: Record<string, string> = {}
  if (!isPlainObject(value)) return result
  for (const [name, text] of Object.entries(value)) {
    if (typeof text === 'string') result[name] = text
  }
  return result
}

/**
 * Seeds the rows from records (the widget payload's rows, or the edited record's
 * associated records). A row index the backend sends is kept; others are numbered.
 * When rows may be reordered, each row's order-by field is its position.
 *
 * @param records - Records to seed from.
 * @param config - Widget configuration.
 * @returns The rows and the next free row key.
 */
export function seedRows(records: RowBuilderRecord[], config: RowBuilderConfig): { rows: BuilderRow[]; nextKey: number } {
  let nextKey = 0
  const rows = records.map((record, index) => {
    const values: Record<string, unknown> = { ...(isPlainObject(record.values) ? record.values : {}) }
    const sent = Number(values[ROW_INDEX_KEY])
    let key: number
    if (values[ROW_INDEX_KEY] !== undefined && values[ROW_INDEX_KEY] !== null && Number.isFinite(sent)) {
      key = sent
      nextKey = Math.max(sent, nextKey) + 1
    } else {
      key = nextKey++
    }
    delete values[ROW_INDEX_KEY]
    if (config.mayReorderRows && config.orderByFieldName) values[config.orderByFieldName] = index
    return { key, values, displayValues: displayValueMap(record.displayValues) }
  })
  // keys the backend sent may collide with numbered ones; keep every key unique
  const seen = new Set<number>()
  for (const row of rows) {
    if (seen.has(row.key)) row.key = nextKey++
    seen.add(row.key)
  }
  return { rows, nextKey }
}

/**
 * A new row: values copied from the parent form (`defaultValuesForNewRowsFromParentRecord`),
 * then the payload's `defaultValuesForNewRecords`, then its position when reorderable.
 *
 * @param key - The new row's key.
 * @param position - Its position (the number of rows before it).
 * @param config - Widget configuration.
 * @param parentValues - The host form's current values.
 * @param defaultValuesForNewRecords - The payload's defaults for new rows.
 * @returns The row.
 */
export function newRow(
  key: number,
  position: number,
  config: RowBuilderConfig,
  parentValues: Record<string, unknown> | undefined,
  defaultValuesForNewRecords: Record<string, unknown> | undefined
): BuilderRow {
  const values: Record<string, unknown> = {}
  for (const [from, to] of Object.entries(config.defaultValuesForNewRowsFromParentRecord)) {
    values[to] = parentValues?.[from]
  }
  Object.assign(values, defaultValuesForNewRecords ?? {})
  if (config.mayReorderRows && config.orderByFieldName) values[config.orderByFieldName] = position
  return { key, values, displayValues: {} }
}

/**
 * Converts a form control value back to the stored value: blank is null, local
 * DATE_TIME text is the UTC instant, INTEGER and DECIMAL text are numbers (LONG stays
 * its exact digits).
 *
 * @param field - Field metadata.
 * @param value - The control value.
 * @returns The stored value.
 */
export function wireValueFromForm(field: QFieldMetaData, value: unknown): unknown {
  if (value === undefined) return undefined
  if (value === '' || value === null) return null
  if (field.type === 'DATE_TIME' && typeof value === 'string') return fromLocalDateTimeInput(value) || null
  if ((field.type === 'INTEGER' || field.type === 'DECIMAL') && typeof value === 'string') {
    const number = Number(value.trim())
    return value.trim() !== '' && Number.isFinite(number) ? number : value
  }
  if (field.type === 'LONG' && typeof value === 'string') return value.trim()
  return value
}

/**
 * A row's values as its form edits them (see `formValueFromRecordValue`).
 *
 * @param fields - Row fields.
 * @param row - The row.
 * @returns Control values keyed by field name, plus every other stored value unchanged.
 */
export function rowFormValues(fields: QFieldMetaData[], row: BuilderRow): Record<string, unknown> {
  const values: Record<string, unknown> = { ...row.values }
  for (const field of fields) values[field.name] = formValueFromRecordValue(field, row.values[field.name])
  return values
}

/**
 * The fields a user edits (and that are validated): shown and editable.
 *
 * @param fields - Row fields.
 * @returns The editable fields.
 */
export function editableFields(fields: QFieldMetaData[]): QFieldMetaData[] {
  return fields.filter((field) => !field.isHidden && field.isEditable)
}

/**
 * Validates one row's control values against its fields' metadata (required, type,
 * bounds and, on process screens, maximum length) with the app's field schemas.
 *
 * @param fields - Row fields.
 * @param values - Control values keyed by field name.
 * @param enforceMaxLength - Apply `maxLength` (process screens); record forms leave it to the server.
 * @returns The first message of each invalid field, keyed by field name.
 */
export function rowErrors(fields: QFieldMetaData[], values: Record<string, unknown>, enforceMaxLength: boolean): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of editableFields(fields)) {
    const raw = values[field.name]
    const value = raw === null || raw === undefined ? (field.type === 'BOOLEAN' ? undefined : '') : raw
    const result = zodFieldFromMetadata(field, { enforceMaxLength }).safeParse(value)
    if (!result.success) errors[field.name] = result.error.issues[0]?.message ?? `${field.label} is invalid`
  }
  return errors
}

/**
 * Messages for invalid rows, each naming its row (1-based).
 *
 * @param rowNumber - The row's position, from 1.
 * @param errors - The row's errors from {@link rowErrors}.
 * @returns One message per invalid field.
 */
export function rowErrorMessages(rowNumber: number, errors: Record<string, string>): string[] {
  return Object.values(errors).map((message) => `Row ${rowNumber}: ${message}`)
}

/**
 * The rows as the widget writes them out (Material `runOnSaveCallback`): each row's field
 * values, its position in the order-by field when rows may be reordered and, unless left
 * out, its row index. Unset values are omitted.
 *
 * @param rows - The rows in order.
 * @param fields - Row fields.
 * @param config - Widget configuration.
 * @param includeRowIndex - Add `_qRowIndex` (JSON output); association records leave it out.
 * @returns Plain value maps.
 */
export function outputRows(rows: BuilderRow[], fields: QFieldMetaData[], config: RowBuilderConfig, includeRowIndex: boolean): Array<Record<string, unknown>> {
  return rows.map((row, index) => {
    const output: Record<string, unknown> = {}
    for (const field of fields) {
      const value = row.values[field.name]
      if (value !== undefined) output[field.name] = value
    }
    if (config.mayReorderRows && config.orderByFieldName) output[config.orderByFieldName] = index
    if (includeRowIndex) output[ROW_INDEX_KEY] = row.key
    return output
  })
}
