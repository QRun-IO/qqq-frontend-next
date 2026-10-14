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
 * @file Pure helpers for the related-record picker: which picker a field or child list has, its
 * columns and preview fields, the quick-create fields of a table, and a record's text.
 */

import type { QFieldMetaData, QRecord, QRelatedRecordPicker, QTableMetaData } from '@/types'

/** Default number of result columns when the picker declares none. */
const DEFAULT_COLUMN_COUNT = 5

/**
 * The SINGLE picker of a foreign-key field.
 *
 * @param table - The table the field is on.
 * @param fieldName - The field.
 * @returns The picker, if the table declares one for the field.
 */
export function singlePickerFor(table: QTableMetaData | undefined, fieldName: string): QRelatedRecordPicker | undefined {
  return table?.relatedRecordPickers?.find((picker) => picker.mode === 'SINGLE' && picker.fieldName === fieldName)
}

/**
 * The MULTI_CHILD and LINK pickers whose rows go into a child table, that the user may use.
 *
 * @param table - The parent table.
 * @param childTableName - The child list's table.
 * @returns The pickers.
 */
export function childPickersFor(table: QTableMetaData | undefined, childTableName: string): QRelatedRecordPicker[] {
  return (table?.relatedRecordPickers ?? []).filter((picker) => picker.mode !== 'SINGLE' && picker.childTableName === childTableName
    && (picker.canAddChildren === true || picker.canRemoveChildren === true))
}

/**
 * The target's T1 section fields (in order).
 *
 * @param table - The target table.
 * @returns The field names.
 */
function t1Fields(table: QTableMetaData | undefined): string[] {
  return (table?.sections ?? []).filter((section) => section.tier === 'T1').flatMap((section) => section.fieldNames ?? []).filter((name) => Boolean(table?.fields?.[name]))
}

/**
 * The result columns: the picker's, else the target's label and T1 fields.
 *
 * @param picker - The picker.
 * @param table - The target table.
 * @returns The field names the user may see.
 */
export function relatedPickerColumns(picker: QRelatedRecordPicker, table: QTableMetaData | undefined): string[] {
  const declared = picker.columns?.length ? picker.columns : [...new Set(t1Fields(table))].slice(0, DEFAULT_COLUMN_COUNT)
  return table ? declared.filter((name) => Boolean(table.fields?.[name])) : declared
}

/**
 * The preview fields: the picker's, else the target's T1 fields.
 *
 * @param picker - The picker.
 * @param table - The target table.
 * @returns The field names the user may see.
 */
export function relatedPickerPreviewFields(picker: QRelatedRecordPicker, table: QTableMetaData | undefined): string[] {
  const declared = picker.previewFields?.length ? picker.previewFields : t1Fields(table)
  return table ? declared.filter((name) => Boolean(table.fields?.[name])) : declared
}

/**
 * The fields of a quick-create form: the editable fields of the table's quick-create section,
 * else its required, editable fields.
 *
 * @param table - The table to create a record in.
 * @returns The fields, in order.
 */
export function quickCreateFields(table: QTableMetaData): QFieldMetaData[] {
  const editable = (field: QFieldMetaData | undefined): field is QFieldMetaData => Boolean(field) && field!.isEditable !== false && field!.isHidden !== true && field!.name !== table.primaryKeyField
  const section = table.quickCreateSectionName ? table.sections?.find((candidate) => candidate.name === table.quickCreateSectionName) : undefined
  if (section?.fieldNames?.length) return section.fieldNames.map((name) => table.fields?.[name]).filter(editable)
  return Object.values(table.fields ?? {}).filter((field) => editable(field) && field.isRequired === true)
}

/**
 * A record's text for a field: its display value, else its raw value.
 *
 * @param record - The record.
 * @param fieldName - The field.
 * @returns The text ('' when empty).
 */
export function recordText(record: QRecord, fieldName: string): string {
  const display = record.displayValues?.[fieldName]
  if (display !== undefined && display !== null && display !== '') return String(display)
  const raw = record.values?.[fieldName]
  return raw === null || raw === undefined ? '' : String(raw)
}
