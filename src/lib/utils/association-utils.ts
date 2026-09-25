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

/** @file Resolve exact association bindings and relationship values. */

import type { QAssociation, QRecord, QTableMetaData, QWidgetMetaData } from '@/types'

/** Full target metadata is fetched by the page, independently of associated data. */
export interface AssociationTableState {
  table?: QTableMetaData
  isLoading: boolean
  isError: boolean
  /** The user may not read the associated table: the panel is not shown. */
  isDenied?: boolean
}

/**
 * Resolve only explicit bindings on the established association widget types.
 * @param widget - Existing frontend widget metadata.
 * @returns An exact association name, a binding error, or no association binding.
 */
export function associationWidgetBinding(widget: QWidgetMetaData | undefined): { name: string } | { error: string } | undefined {
  if (!widget || !['childRecordList', 'rowBuilder'].includes(widget.type ?? '')) return
  const defaults = widget.defaultValues
  const name = defaults?.[widget.type === 'childRecordList' ? 'manageAssociationName' : 'associationName']
  if (name === undefined) return
  if (typeof name !== 'string' || !name) return { error: 'Association binding is unavailable.' }
  const other = defaults?.[widget.type === 'childRecordList' ? 'associationName' : 'manageAssociationName']
  if (other !== undefined && other !== name) return { error: 'Association binding is ambiguous.' }
  return { name }
}

/**
 * Build the same exact relationship tuple for direct Add and View All.
 * @param association - Exact named relationship and registered join.
 * @param parentTable - Full parent metadata.
 * @param parent - Actual parent values, including non-primary join fields.
 * @param childTable - Full personalized target metadata.
 * @returns Fixed child values and orientation, or an unavailable relationship error.
 */
export function resolveAssociationValues(
  association: QAssociation,
  parentTable: QTableMetaData,
  parent: QRecord,
  childTable: QTableMetaData,
): { values: Record<string, string | number | boolean>; reverse: boolean } | { error: string } {
  const join = association.join
  const forward = join.leftTable === parentTable.name && join.rightTable === association.associatedTableName
  const reverse = !forward && join.rightTable === parentTable.name && join.leftTable === association.associatedTableName
  if ((!forward && !reverse) || childTable.name !== association.associatedTableName || !join.joinOns?.length) {
    return { error: 'Association join is unavailable.' }
  }
  const values: Record<string, string | number | boolean> = {}
  for (const pair of join.joinOns) {
    const parentField = forward ? pair.leftField : pair.rightField
    const childField = forward ? pair.rightField : pair.leftField
    const value = parent.values[parentField]
    if (!parentTable.fields[parentField] || !childTable.fields[childField] ||
      !['string', 'number', 'boolean'].includes(typeof value) || value === '' ||
      (typeof value === 'number' && !Number.isFinite(value))) {
      return { error: 'Relationship values are unavailable; this record cannot be linked.' }
    }
    const scalar = value as string | number | boolean
    if (Object.prototype.hasOwnProperty.call(values, childField) && values[childField] !== scalar) {
      return { error: 'Association join has conflicting relationship values.' }
    }
    values[childField] = scalar
  }
  return { values, reverse }
}
